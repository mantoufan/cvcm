import type { Group, Mesh, Texture } from "three";
import { h } from "../dom";
import { t } from "../i18n";
import { creditLine, readStore, writeStore } from "../game-input";
import { createStage, gameShell, heldKeys, lostContext, type Stage } from "../three-stage";
import { formatClock } from "../../shared/game-clock";
import {
  BALL_R,
  BOARD_BOTTOM,
  BOARD_TOP,
  BOARD_W,
  BOARD_Z,
  MAX_YAW,
  RELEASE_Y,
  RELOAD,
  RIM_R,
  RIM_TUBE,
  RIM_Y,
  SHOT_MAX,
  SPOTS,
  THREE_POINT,
  canShoot,
  clampSpot,
  cleanSaved,
  distanceOf,
  newGame,
  shoot,
  step,
  type Game,
  type Mode,
  type ShotEvent,
} from "../../shared/basketball-game";

/**
 * Basketball shooting game (games3d group). Swipe or drag up to shoot (direction and strength from the swipe), or
 * aim with the arrow keys and hold Space to build power, release to shoot. A 60-second timed round or practice from
 * one of five spots. Physics and scoring in src/shared/basketball-game.ts; three.js loads on Play (three-stage.ts).
 */

const STORE_KEY = "cvcm.basketballgame.v1";
/** Seconds for the keyboard power meter to go from empty to full (it then falls back, and so on). */
const CHARGE_TIME = 1.1;
/** A swipe this share of the stage's height is full power. */
const FULL_SWIPE = 0.55;
/** Meshes for balls in the air: one per shot that can still be flying (SHOT_MAX / RELOAD), plus one. */
const BALL_POOL = Math.ceil(SHOT_MAX / RELOAD) + 1;

type Action = "power" | "left" | "right";
const KEYS: Record<string, Action> = {
  Space: "power",
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
};

let mounted: { cleanup: () => void } | null = null;

export function mountBasketballGame(host: HTMLElement): void {
  unmountBasketballGame();
  const saved = cleanSaved(readStore(STORE_KEY));
  let mode: Mode = saved.mode;
  let spot = saved.spot;
  let best = saved.best;
  let game: Game = newGame(mode, spot);
  let playing = false;
  let aim = 0;
  let power = 0;
  let coverTimer = 0;

  const save = () => writeStore(STORE_KEY, { mode, spot, best });

  const scoreEl = h("dd", { "data-out": "score" }, "0");
  const bestEl = h("dd", { "data-out": "best" }, String(best));
  const madeEl = h("dd", { "data-out": "made" }, "0 / 0");
  const statusEl = h("p", { class: "bb-status", "aria-live": "polite", "data-out": "status" });
  const hudScore = h("span", { class: "bb-hud-score" }, "0");
  const hudTime = h("span", { class: "bb-hud-time" });
  const hudStreak = h("span", { class: "bb-hud-streak" });
  const meterFill = h("span", { class: "bb-meter-fill" });
  const meter = h("span", { class: "bb-meter", "aria-hidden": "true" }, meterFill);

  /** The running 3D game, while a stage exists. */
  let view: { restart(): void; dispose(): void } | null = null;

  const shell = gameShell({
    label: t("basketballGame.stage"),
    intro: t("basketballGame.intro"),
    className: "g3d-tall bb-root",
    start: async (el) => {
      const stage = await createStage(el, { mode: "loop", fov: 50, near: 0.05, far: 80, background: 0xfdf0f5, active: () => !shell.covered(), onLost: () => lostContext(shell) });
      if (!stage) return null;
      try {
        view = buildView(stage, el);
      } catch (err) {
        stage.dispose();
        throw err;
      }
      view.restart();
      return () => {
        view?.dispose();
        view = null;
        stage.dispose();
      };
    },
    resume: () => view?.restart(),
  });
  const hud = h("div", { class: "g3d-hud bb-hud", "aria-hidden": "true" }, hudScore, hudTime, hudStreak, meter);
  shell.root.insertBefore(hud, shell.stage.nextSibling);

  let hudKey = "";
  const paint = () => {
    const time = game.timeLeft === null ? "" : formatClock(Math.ceil(game.timeLeft) * 1000).replace(/\.\d+$/, "");
    const key = `${game.score}|${time}|${game.streak}|${game.makes}|${game.shots}|${best}`;
    if (key === hudKey) return;
    hudKey = key;
    scoreEl.textContent = String(game.score);
    hudScore.textContent = String(game.score);
    hudTime.textContent = time ? t("basketballGame.time", { time }) : t("basketballGame.practice");
    hudStreak.textContent = game.streak >= 2 ? t("basketballGame.streak", { n: game.streak }) : "";
    madeEl.textContent = `${game.makes} / ${game.shots}`;
    bestEl.textContent = String(best);
  };

  const announce = (e: ShotEvent) => {
    const what = t(`basketballGame.r_${e.result}`);
    statusEl.textContent = e.points ? t("basketballGame.scored", { what, points: e.points }) : what;
  };

  const finish = () => {
    playing = false;
    const record = mode === "timed" && game.score > best;
    if (record) {
      best = game.score;
      save();
    }
    paint();
    const msg = record ? t("basketballGame.newBest", { score: game.score }) : t("basketballGame.over", { score: game.score });
    statusEl.textContent = msg;
    window.clearTimeout(coverTimer);
    coverTimer = window.setTimeout(() => shell.cover(msg, t("basketballGame.again")), 900);
  };

  /** A fresh round (mode or spot changed, New game, Play again). Never uncovers before the 3D view exists. */
  const newRound = () => {
    window.clearTimeout(coverTimer);
    game = newGame(mode, spot);
    aim = 0;
    power = 0;
    statusEl.textContent = "";
    hudKey = "";
    paint();
    if (view) {
      view.restart();
      shell.uncover();
    }
  };

  function buildView(stage: Stage, stageEl: HTMLElement): { restart(): void; dispose(): void } {
    const { THREE, scene, camera } = stage;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xe8c9d6, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(3, 9, 6);
    scene.add(sun);

    const textures: Texture[] = [];
    // Court: floor, free-throw line and the three-point arc drawn on a canvas.
    const court = document.createElement("canvas");
    court.width = court.height = 512;
    const c2 = court.getContext("2d")!;
    c2.fillStyle = "#f3d9c4";
    c2.fillRect(0, 0, 512, 512);
    c2.strokeStyle = "#ffffff";
    c2.lineWidth = 6;
    const px = 512 / 16; // canvas pixels per metre; the canvas covers x −8…8, z −2…14
    const toC = (x: number, z: number) => [256 + x * px, (z + 2) * px] as const;
    c2.beginPath();
    const [cx, cz] = toC(0, 0);
    c2.arc(cx, cz, THREE_POINT * px, 0, Math.PI);
    c2.stroke();
    c2.strokeStyle = "#e7a3bf";
    c2.strokeRect(...toC(-2.45, -0.4), 4.9 * px, 5.0 * px);
    const floorTex = new THREE.CanvasTexture(court);
    textures.push(floorTex);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshLambertMaterial({ map: floorTex }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 6);
    scene.add(floor);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshLambertMaterial({ color: 0xfbe4ee }));
    wall.position.set(0, 4, -2);
    scene.add(wall);

    // Backboard, square, pole.
    const board = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W, BOARD_TOP - BOARD_BOTTOM, 0.04), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, transparent: true, opacity: 0.88 }));
    board.position.set(0, (BOARD_TOP + BOARD_BOTTOM) / 2, BOARD_Z - 0.02);
    scene.add(board);
    const square = new THREE.Mesh(new THREE.PlaneGeometry(0.59, 0.45), new THREE.MeshBasicMaterial({ color: 0xc2336c, wireframe: true }));
    square.position.set(0, RIM_Y + 0.25, BOARD_Z + 0.001);
    scene.add(square);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, BOARD_BOTTOM, 12), new THREE.MeshLambertMaterial({ color: 0x8a6a78 }));
    pole.position.set(0, BOARD_BOTTOM / 2, BOARD_Z - 0.6);
    scene.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.6), pole.material);
    arm.position.set(0, BOARD_BOTTOM + 0.2, BOARD_Z - 0.3);
    scene.add(arm);

    // Rim and net (the net is only drawn: the physics treats the rim as the hoop).
    const rim = new THREE.Mesh(new THREE.TorusGeometry(RIM_R, RIM_TUBE * 1.6, 8, 40), new THREE.MeshStandardMaterial({ color: 0xe0503a, roughness: 0.4, metalness: 0.3 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, RIM_Y, 0);
    scene.add(rim);
    const netPts = [new THREE.Vector2(RIM_R, 0), new THREE.Vector2(RIM_R * 0.8, -0.22), new THREE.Vector2(RIM_R * 0.62, -0.42)];
    const net = new THREE.Mesh(new THREE.LatheGeometry(netPts, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.8 }));
    net.position.set(0, RIM_Y, 0);
    scene.add(net);

    // Ball texture: pink-orange with dark seams, drawn on a canvas (no brand).
    const ballCanvas = document.createElement("canvas");
    ballCanvas.width = 256;
    ballCanvas.height = 128;
    const b2 = ballCanvas.getContext("2d")!;
    b2.fillStyle = "#ee7b4a";
    b2.fillRect(0, 0, 256, 128);
    b2.strokeStyle = "#3b2228";
    b2.lineWidth = 4;
    for (const x of [0, 64, 128, 192]) {
      b2.beginPath();
      b2.moveTo(x, 0);
      b2.lineTo(x, 128);
      b2.stroke();
    }
    b2.beginPath();
    b2.moveTo(0, 64);
    b2.lineTo(256, 64);
    b2.stroke();
    const ballTex = new THREE.CanvasTexture(ballCanvas);
    textures.push(ballTex);
    const ballGeo = new THREE.SphereGeometry(BALL_R, 24, 16);
    const ballMat = new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.75 });
    const balls: Mesh[] = [];
    for (let i = 0; i < BALL_POOL; i++) {
      const m = new THREE.Mesh(ballGeo, ballMat);
      m.visible = false;
      scene.add(m);
      balls.push(m);
    }
    // The ball in hand and the aim line on the floor.
    const hand = new THREE.Mesh(ballGeo, ballMat);
    scene.add(hand);
    const aimLine = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 2.2), new THREE.MeshBasicMaterial({ color: 0xc2336c, transparent: true, opacity: 0.55 }));
    aimLine.rotation.x = -Math.PI / 2;
    const aimGroup: Group = new THREE.Group();
    aimLine.position.set(0, 0.01, -1.1);
    aimGroup.add(aimLine);
    scene.add(aimGroup);
    const spotMark = new THREE.Mesh(new THREE.CircleGeometry(0.28, 24), new THREE.MeshBasicMaterial({ color: 0xc2336c, transparent: true, opacity: 0.35 }));
    spotMark.rotation.x = -Math.PI / 2;
    scene.add(spotMark);

    let fitAspect = 0;
    let fitSpot = -1;
    const placeCamera = () => {
      if (camera.aspect === fitAspect && game.spot === fitSpot) return;
      fitAspect = camera.aspect;
      fitSpot = game.spot;
      const s = SPOTS[game.spot]!;
      const d = Math.hypot(s.x, s.z) || 1;
      // Behind the shooter, further back on a narrow (portrait) stage.
      const back = 2.4 * Math.max(1, 0.75 / fitAspect);
      camera.position.set(s.x + (s.x / d) * back, 2.6, s.z + (s.z / d) * back);
      camera.lookAt(0, RIM_Y - 0.35, 0);
      spotMark.position.set(s.x, 0.01, s.z);
      aimGroup.position.set(s.x, 0, s.z);
    };

    // Input: held keys (built with the game, so a failed build leaves no listeners).
    const keys = heldKeys<Action>(KEYS, () => playing && !shell.covered() && document.activeElement === stageEl);
    let charging = false;
    let chargeT = 0;
    let lastPower = false;

    const throwBall = (yaw: number, p: number) => {
      if (!playing || !canShoot(game)) return;
      game = shoot(game, yaw, p);
      statusEl.textContent = "";
    };

    // Pointer: drag up to throw; sideways sets the direction, length the strength.
    let drag: { id: number; x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.button > 0 || shell.covered()) return;
      e.preventDefault();
      stageEl.focus({ preventScroll: true });
      stageEl.setPointerCapture?.(e.pointerId);
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    };
    const swipe = (e: PointerEvent) => {
      const dx = e.clientX - drag!.x, dy = drag!.y - e.clientY;
      const len = Math.hypot(dx, dy);
      const hgt = stage.size().height;
      return { dx, dy, len, p: Math.min(1, len / (hgt * FULL_SWIPE)), yaw: len ? Math.max(-MAX_YAW, Math.min(MAX_YAW, (dx / len) * MAX_YAW * 1.6)) : 0 };
    };
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const s = swipe(e);
      if (s.dy > 0) {
        aim = s.yaw;
        power = s.p;
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const s = swipe(e);
      drag = null;
      if (s.dy > 12 && s.len > 16) throwBall(s.yaw, s.p);
      power = 0;
    };
    stageEl.addEventListener("pointerdown", onDown);
    stageEl.addEventListener("pointermove", onMove);
    stageEl.addEventListener("pointerup", onUp);
    // A cancelled gesture (edge swipe, palm rejection, a call) is dropped, never thrown.
    const onCancel = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      power = 0;
    };
    stageEl.addEventListener("pointercancel", onCancel);
    // Losing the window while Space charges must not throw: heldKeys drops "power" on blur, which would read as a
    // release on the next frame.
    const onBlur = () => {
      charging = false;
      power = 0;
    };
    window.addEventListener("blur", onBlur);

    stage.onFrame((dt) => {
      placeCamera();
      if (playing) {
        // Keyboard aim and the back-and-forth power meter (Space held), thrown on release.
        if (keys.held.has("left")) aim = Math.max(-MAX_YAW, aim - dt * 0.5);
        if (keys.held.has("right")) aim = Math.min(MAX_YAW, aim + dt * 0.5);
        const holding = keys.held.has("power");
        if (holding && !lastPower) {
          charging = true;
          chargeT = 0;
        }
        if (charging && holding) {
          chargeT += dt;
          const k = (chargeT / CHARGE_TIME) % 2;
          power = k <= 1 ? k : 2 - k;
        }
        if (charging && !holding) {
          charging = false;
          throwBall(aim, power);
          power = 0;
        }
        lastPower = holding;

        const r = step(game, dt);
        game = r.game;
        for (const e of r.events) announce(e);
        if (game.over) finish();
      }
      // Balls in the air, the ball in hand, the aim line, the meter.
      for (let i = 0; i < balls.length; i++) {
        const b = game.balls[i];
        const m = balls[i]!;
        m.visible = !!b;
        if (b) {
          m.position.set(b.x, b.y, b.z);
          m.rotation.x -= dt * 6;
        }
      }
      const s = SPOTS[game.spot]!;
      const ready = playing && canShoot(game);
      hand.visible = ready;
      if (ready) hand.position.set(s.x, RELEASE_Y, s.z);
      // Along the throw's heading (base - aim, see launch()).
      aimGroup.rotation.y = Math.atan2(-s.x, -s.z) - aim + Math.PI;
      aimGroup.visible = ready;
      meterFill.style.width = `${Math.round(power * 100)}%`;
      paint();
    });

    return {
      restart() {
        window.clearTimeout(coverTimer);
        game = newGame(mode, spot);
        aim = 0;
        power = 0;
        charging = false;
        hudKey = "";
        statusEl.textContent = "";
        playing = true;
        fitSpot = -1;
        paint();
      },
      dispose() {
        playing = false;
        keys.dispose();
        stageEl.removeEventListener("pointerdown", onDown);
        stageEl.removeEventListener("pointermove", onMove);
        stageEl.removeEventListener("pointerup", onUp);
        stageEl.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("blur", onBlur);
        // Geometry, materials and textures are freed by stage.dispose() (disposeScene); the canvas textures again
        // here in case a lost context stops before the scene walk.
        for (const tex of textures) tex.dispose();
      },
    };
  }

  // Space / Enter on the covered stage is handled by gameShell (it presses Play / Play again).

  const modeSel = h("select", { "data-in": "mode" },
    h("option", { value: "timed", selected: mode === "timed" }, t("basketballGame.m_timed")),
    h("option", { value: "practice", selected: mode === "practice" }, t("basketballGame.m_practice"))) as HTMLSelectElement;
  const spotSel = h("select", { "data-in": "spot" },
    ...SPOTS.map((_, i) => h("option", { value: String(i), selected: i === spot },
      t("basketballGame.spotOption", { n: i + 1, m: distanceOf(i).toFixed(1) })))) as HTMLSelectElement;
  const spotField = h("label", { class: "field", hidden: mode !== "practice" }, h("span", null, t("basketballGame.spot")), spotSel);
  const backToStage = () => {
    if (view) shell.stage.focus({ preventScroll: true });
  };
  modeSel.addEventListener("change", () => {
    mode = modeSel.value === "practice" ? "practice" : "timed";
    spotField.hidden = mode !== "practice";
    save();
    newRound();
    backToStage();
  });
  spotSel.addEventListener("change", () => {
    const n = Number(spotSel.value);
    spot = clampSpot(n);
    save();
    newRound();
    backToStage();
  });
  const newBtn = h("button", { type: "button", class: "btn", "data-act": "new" }, t("basketballGame.newGame")) as HTMLButtonElement;
  newBtn.addEventListener("click", () => {
    newRound();
    backToStage();
  });

  paint();
  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("basketballGame.title")),
      h("p", { class: "lede" }, t("basketballGame.privacyNote")),
    ),
    h("div", { class: "g3d-bar bb-bar" },
      h("label", { class: "field" }, h("span", null, t("basketballGame.mode")), modeSel),
      spotField,
      newBtn,
      shell.fullscreenButton,
    ),
    h("dl", { class: "stats-grid bb-stats" },
      h("dt", null, t("basketballGame.score")), scoreEl,
      h("dt", null, t("basketballGame.made")), madeEl,
      h("dt", null, t("basketballGame.best")), bestEl),
    shell.root,
    statusEl,
    h("p", { class: "hint" }, t("basketballGame.hint")),
    creditLine("game3d.credit", "https://threejs.org", "three.js"),
  );

  mounted = {
    cleanup: () => {
      window.clearTimeout(coverTimer);
      shell.dispose();
      view = null;
    },
  };
}

export function unmountBasketballGame(): void {
  mounted?.cleanup();
  mounted = null;
}
