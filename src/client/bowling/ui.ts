import type { Group, Mesh, Quaternion, Vector3 } from "three";
import { h } from "../dom";
import { t } from "../i18n";
import { creditLine, cryptoRand, readStore, typingTarget, writeStore } from "../game-input";
import { coarsePointer, createStage, gameShell, lostContext, type Stage } from "../three-stage";
import {
  BALL_R,
  DECK_END,
  FRAMES,
  GUTTER_W,
  LANE_HALF,
  LANE_LEN,
  LEVELS,
  MAX_ANGLE,
  PIN_H,
  PIN_R,
  PIN_SPOTS,
  PIT_Y,
  RELEASE_X,
  advanceRoll,
  applyRoll,
  cleanSaved,
  cpuRelease,
  finishRoll,
  frameMarks,
  knocked,
  newGame,
  rackPins,
  scoreCard,
  standingAfter,
  startRoll,
  type Game,
  type Level,
  type Release,
  type Roll,
} from "../../shared/bowling";

/**
 * Ten-pin bowling (games3d group): ten frames against the computer or alone. Lane physics, pins and scoring are in
 * src/shared/bowling.ts; this page draws the lane with three.js (loaded on Play, three-stage.ts) and turns a swipe,
 * or the keys, into a release. The best game and a game in progress are kept in `cvcm.bowling.v1`.
 */

const STORE_KEY = "cvcm.bowling.v1";
type Phase = "aim" | "charging" | "rolling" | "result" | "cpu" | "over";
/** How long the result of a roll stays on screen before the pins are swept / the next player steps up. */
const RESULT_MS = 1300;
const CPU_MS = 900;
const COVER_MS = 1100;
/** The power meter swings 0 → 1 → 0 over this many seconds while Space is held. */
const POWER_PERIOD = 1.6;

let mounted: { cleanup: () => void } | null = null;

export function mountBowling(host: HTMLElement): void {
  unmountBowling();
  const saved = cleanSaved(readStore(STORE_KEY));
  let mode = saved.mode;
  let level: Level = saved.level;
  let best = saved.best;
  // A finished game is not resumed: the next visit starts a fresh one.
  let game: Game = saved.game && !saved.game.over ? saved.game : newGame(mode === "cpu");
  const resumed = !!(saved.game && !saved.game.over && saved.game.players.some((p) => p.rolls.length));
  let phase: Phase = "aim";
  let roll: Roll | null = null;
  let release: Release = { x: 0.12, angle: -0.0045, power: 0.6, hook: 0 };
  let charge = 0;
  let resultTimer = 0;
  let cpuTimer = 0;
  let coverTimer = 0;
  let view: View | null = null;

  const save = () => writeStore(STORE_KEY, { best, mode, level, game });
  const isCpuTurn = () => !game.over && !!game.players[game.turn]?.cpu;
  const whoName = (i: number) => (game.players[i]!.cpu ? t("bowling.computer") : game.players.length > 1 ? t("bowling.you") : t("bowling.player"));

  // ---- DOM
  const statusEl = h("p", { class: "bw-status", "aria-live": "polite", "data-out": "status" });
  const bestEl = h("dd", { "data-out": "best" }, String(best));
  const hudText = h("span", { class: "bw-hud-text" });
  const meterFill = h("span", { class: "bw-meter-fill" });
  const meter = h("span", { class: "bw-meter", hidden: true }, meterFill);
  const hudEl = h("div", { class: "g3d-hud bw-hud", "aria-hidden": "true" }, hudText, meter);
  const sheet = h("table", { class: "bw-sheet", "data-out": "sheet" });
  const sheetWrap = h("div", { class: "bw-sheet-wrap" }, sheet);

  let sheetKey = "";
  const renderSheet = () => {
    const key = JSON.stringify(game.players.map((p) => p.rolls)) + game.turn;
    if (key === sheetKey) return;
    sheetKey = key;
    const head = h("tr", null, h("th", { scope: "col" }, ""),
      ...Array.from({ length: FRAMES }, (_, f) => h("th", { scope: "col" }, String(f + 1))),
      h("th", { scope: "col" }, t("bowling.total")));
    const rows = game.players.map((p, i) => {
      const marks = frameMarks(p.rolls);
      const card = scoreCard(p.rolls);
      return h("tr", { class: i === game.turn && !game.over ? "bw-now" : "" },
        h("th", { scope: "row" }, whoName(i)),
        ...marks.map((m, f) => h("td", null,
          h("span", { class: "bw-marks" }, m.join(" ")),
          h("span", { class: "bw-cum" }, card.cumulative[f] === null ? "" : String(card.cumulative[f])))),
        h("td", { class: "bw-total" }, String(card.total)));
    });
    sheet.replaceChildren(h("thead", null, head), h("tbody", null, ...rows));
  };

  let hudKey = "";
  const renderHud = () => {
    const card = scoreCard(game.players[game.turn]!.rolls);
    const text = game.over ? "" : t("bowling.hud", { who: whoName(game.turn), f: Math.min(FRAMES, card.frame + 1), b: card.ball + 1 });
    // charge runs 0 → 2 and back (a ping-pong meter); the thrown power is the triangle wave below.
    const pct = phase === "charging" ? Math.round((charge <= 1 ? charge : 2 - charge) * 100) : -1;
    const key = `${text}|${pct}`;
    if (key === hudKey) return;
    hudKey = key;
    hudText.textContent = text;
    meter.hidden = pct < 0;
    if (pct >= 0) meterFill.style.width = `${pct}%`;
  };

  // ---- game flow
  const clearTimers = () => {
    window.clearTimeout(resultTimer);
    window.clearTimeout(cpuTimer);
    window.clearTimeout(coverTimer);
  };

  const finishGame = () => {
    phase = "over";
    const scores = game.players.map((p) => scoreCard(p.rolls).total);
    const mine = scores[0]!;
    const record = mine > best;
    if (record) {
      best = mine;
      bestEl.textContent = String(best);
    }
    save();
    let text: string;
    if (game.players.length === 1) text = record ? t("bowling.newBest", { score: mine }) : t("bowling.gameOver", { score: mine });
    else if (scores[0]! > scores[1]!) text = t("bowling.youWin", { you: scores[0]!, cpu: scores[1]! });
    else if (scores[0]! < scores[1]!) text = t("bowling.cpuWins", { you: scores[0]!, cpu: scores[1]! });
    else text = t("bowling.tie", { score: mine });
    statusEl.textContent = text;
    window.clearTimeout(coverTimer);
    coverTimer = window.setTimeout(() => shell.cover(text, t("bowling.again")), COVER_MS);
  };

  /** The rack and the ball for whoever bowls next; the computer throws after a short pause. */
  const nextRoll = () => {
    roll = null;
    renderSheet();
    renderHud();
    if (game.over) return finishGame();
    view?.rack(game.standing);
    view?.resetBall();
    if (isCpuTurn()) {
      phase = "cpu";
      statusEl.textContent = t("bowling.cpuTurn");
      window.clearTimeout(cpuTimer);
      cpuTimer = window.setTimeout(() => {
        if (phase !== "cpu" || !view) return;
        throwBall(cpuRelease(game.standing, level, cryptoRand));
      }, CPU_MS);
    } else {
      phase = "aim";
    }
  };

  /** Records the finished roll and moves on (at once when leaving the page, after a pause on screen). */
  const settle = (now: boolean) => {
    if (!roll) return;
    const done = roll;
    const card = scoreCard(game.players[game.turn]!.rolls);
    const down = knocked(done);
    const all = game.standing.filter(Boolean).length;
    statusEl.textContent = down === all && card.fresh ? t("bowling.strike")
      : down === all ? t("bowling.spare")
      : done.ball.gutter && down === 0 ? t("bowling.gutter")
      : down === 0 ? t("bowling.none")
      : down === 1 ? t("bowling.pin1")
      : t("bowling.pins", { n: down });
    game = applyRoll(game, standingAfter(done));
    save();
    phase = "result";
    window.clearTimeout(resultTimer);
    if (now) nextRoll();
    else resultTimer = window.setTimeout(nextRoll, RESULT_MS);
  };

  const throwBall = (rel: Release) => {
    if (game.over) return;
    // Keep the player's own position and aim for their next ball; the computer's release is not theirs.
    if (!isCpuTurn()) release = rel;
    roll = startRoll(game.standing, rel);
    phase = "rolling";
    statusEl.textContent = "";
    view?.showGuide(false);
    renderHud();
  };

  const startNewGame = () => {
    clearTimers();
    game = newGame(mode === "cpu");
    roll = null;
    phase = "aim";
    statusEl.textContent = "";
    save();
    sheetKey = "";
    nextRoll();
    // Before Play the cover holds the only Play button: keep it until the 3D view exists.
    if (view) {
      if (shell.covered()) shell.uncover();
      shell.stage.focus({ preventScroll: true });
    }
  };

  // ---- 3D view
  interface View {
    rack(standing: readonly boolean[]): void;
    resetBall(): void;
    showGuide(on: boolean): void;
    dispose(): void;
  }

  const shell = gameShell({
    label: t("bowling.stage"),
    intro: t("bowling.intro"),
    className: "g3d-tall bw-root",
    start: async (el) => {
      const stage = await createStage(el, { mode: "loop", fov: 50, near: 0.05, far: 80, background: 0xfdf0f5, active: () => !shell.covered(), onLost: () => lostContext(shell) });
      if (!stage) return null;
      try {
        view = buildView(stage);
      } catch (err) {
        stage.dispose();
        throw err;
      }
      nextRoll();
      return () => {
        clearTimers();
        // Leaving mid-roll: play it out and keep the result, so a reload is not a free retry.
        if (phase === "rolling" && roll) {
          roll = finishRoll(roll);
          settle(true);
        } else if (phase === "result") nextRoll();
        // Settling can start a new cover or computer timer (last roll, the computer's turn): clear again.
        clearTimers();
        view?.dispose();
        view = null;
        stage.dispose();
      };
    },
    resume: () => startNewGame(),
  });
  shell.root.insertBefore(hudEl, shell.stage.nextSibling);

  function buildView(stage: Stage): View {
    const { THREE, scene, camera } = stage;
    const shadows = !coarsePointer();
    if (shadows) stage.renderer.shadowMap.enabled = true;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xe9d2dc, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(2, 6, -(LANE_LEN - 2));
    sun.target.position.set(0, 0, -(LANE_LEN + 0.5));
    sun.castShadow = shadows;
    if (shadows) {
      Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 3, bottom: -3, near: 0.5, far: 20 });
      sun.shadow.camera.updateProjectionMatrix();
    }
    scene.add(sun, sun.target);

    const lambert = (color: number) => new THREE.MeshLambertMaterial({ color });
    // Approach, lane, gutters, side boards and the pit. Lane coordinates: x across, y down the lane = world −z.
    const laneLen = PIT_Y + 2.5;
    const lane = new THREE.Mesh(new THREE.BoxGeometry(LANE_HALF * 2, 0.1, laneLen), lambert(0xf3d9b6));
    lane.position.set(0, -0.05, -(laneLen / 2 - 2.5));
    lane.receiveShadow = shadows;
    scene.add(lane);
    const foul = new THREE.Mesh(new THREE.PlaneGeometry(LANE_HALF * 2, 0.02), new THREE.MeshBasicMaterial({ color: 0xc2336c }));
    foul.rotation.x = -Math.PI / 2;
    foul.position.set(0, 0.002, 0);
    scene.add(foul);
    const markMat = new THREE.MeshBasicMaterial({ color: 0xc2336c });
    const arrowGeo = new THREE.ConeGeometry(0.03, 0.14, 3);
    for (let i = -3; i <= 3; i++) {
      // The seven aiming arrows, about 4.6 m down the lane, as on a real lane.
      const a = new THREE.Mesh(arrowGeo, markMat);
      a.rotation.x = -Math.PI / 2;
      a.position.set(i * 0.127, 0.003, -(4.6 + Math.abs(i) * 0.15));
      a.scale.set(1, 1, 0.05);
      scene.add(a);
    }
    const gutterMat = lambert(0xb9a3ae);
    for (const side of [-1, 1]) {
      const gutter = new THREE.Mesh(new THREE.BoxGeometry(GUTTER_W, 0.04, laneLen), gutterMat);
      gutter.position.set(side * (LANE_HALF + GUTTER_W / 2), -0.1, lane.position.z);
      scene.add(gutter);
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, laneLen), lambert(0xc2336c));
      board.position.set(side * (LANE_HALF + GUTTER_W + 0.04), 0.05, lane.position.z);
      scene.add(board);
    }
    const pit = new THREE.Mesh(new THREE.BoxGeometry(LANE_HALF * 2 + GUTTER_W * 2, 0.6, 1.2), lambert(0x2e2229));
    pit.position.set(0, 0.25, -(PIT_Y + 0.7));
    scene.add(pit);

    // Pins: a turned body with a red neck band, sharing geometry and materials.
    const profile = [[0, 0], [0.026, 0], [0.04, 0.03], [0.0605, 0.115], [0.056, 0.18], [0.036, 0.24], [0.026, 0.27], [0.03, 0.31], [0.033, 0.34], [0.027, 0.37], [0.012, PIN_H], [0, PIN_H]] as const;
    const pinGeo = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), coarsePointer() ? 14 : 24);
    const pinMat = new THREE.MeshStandardMaterial({ color: 0xfbf8f4, roughness: 0.35 });
    const bandGeo = new THREE.CylinderGeometry(0.0275, 0.029, 0.02, 20, 1, true);
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xd2335f, roughness: 0.4 });
    const pins: Group[] = PIN_SPOTS.map(() => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(pinGeo, pinMat);
      body.castShadow = shadows;
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.y = 0.262;
      g.add(body, band);
      scene.add(g);
      return g;
    });

    const ball: Mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, coarsePointer() ? 20 : 32, coarsePointer() ? 14 : 20), new THREE.MeshStandardMaterial({ color: 0xc2336c, roughness: 0.22, metalness: 0.1 }));
    ball.castShadow = shadows;
    scene.add(ball);

    // Aim guide: a faint line ahead of the ball.
    const guide = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 8), new THREE.MeshBasicMaterial({ color: 0xc2336c, transparent: true, opacity: 0.45 }));
    guide.rotation.x = -Math.PI / 2;
    scene.add(guide);

    // Scratch objects reused every frame.
    const up = new THREE.Vector3(0, 1, 0);
    const axis: Vector3 = new THREE.Vector3();
    const q: Quaternion = new THREE.Quaternion();
    const camGoal = new THREE.Vector3();
    const lookGoal = new THREE.Vector3();
    const look = new THREE.Vector3(0, 0, -12);
    let shownPins = rackPins(game.standing);
    let lastBallY = 0;

    const placePin = (g: Group, p: { x: number; y: number; tilt: number; fall: number; gone: boolean }) => {
      g.visible = !p.gone;
      if (p.gone) return;
      g.position.set(p.x, p.tilt * PIN_R * 0.9, -p.y);
      if (p.tilt > 0) {
        // Tip over toward the fall direction (lane → world: y becomes −z).
        axis.set(-Math.sin(p.fall), 0, -Math.cos(p.fall)).normalize();
        q.setFromAxisAngle(axis, (p.tilt * Math.PI) / 2);
        g.quaternion.copy(q);
      } else g.quaternion.identity();
    };

    const placeBall = (x: number, y: number, gutter: boolean) => {
      ball.position.set(x, gutter ? BALL_R - 0.07 : BALL_R, -y);
      ball.rotation.x -= (y - lastBallY) / BALL_R;
      lastBallY = y;
    };

    const placeGuide = () => {
      guide.visible = phase === "aim" || phase === "charging";
      if (!guide.visible) return;
      guide.position.set(release.x + Math.sin(release.angle) * 4, 0.004, -Math.cos(release.angle) * 4);
      guide.rotation.z = -release.angle;
    };

    let fit = 0;
    stage.onFrame((dt) => {
      if (camera.aspect !== fit) {
        fit = camera.aspect;
        camera.fov = fit < 0.8 ? 58 : 48;
        camera.updateProjectionMatrix();
      }
      if (phase === "charging") {
        charge += dt / (POWER_PERIOD / 2);
        if (charge > 2) charge -= 2;
        renderHud();
      }
      if (phase === "rolling" && roll) {
        advanceRoll(roll, dt);
        if (roll.ended) settle(false);
      }
      const r = roll;
      if (r) {
        placeBall(r.ball.x, r.ball.y, r.ball.gutter);
        for (let i = 0; i < pins.length; i++) placePin(pins[i]!, r.pins[i]!);
      } else {
        placeBall(release.x, 0, false);
        for (let i = 0; i < pins.length; i++) placePin(pins[i]!, shownPins[i]!);
      }
      placeGuide();
      // Camera: behind the ball while it rolls, then over the pin deck; behind the foul line while aiming.
      const by = r ? r.ball.y : 0;
      if (r && by > LANE_LEN - 4.5) {
        camGoal.set(0, 1.35, -(LANE_LEN - 3.2));
        lookGoal.set(0, 0.15, -(LANE_LEN + 0.6));
      } else if (r) {
        camGoal.set(r.ball.x * 0.6, 1.0, -by + 2.6);
        lookGoal.set(r.ball.x * 0.4, 0.1, -by - 6);
      } else {
        camGoal.set(release.x * 0.5, 1.25, 2.3);
        lookGoal.set(0, 0.1, -(DECK_END - 2));
      }
      const k = 1 - Math.exp(-dt * 4);
      camera.position.lerp(camGoal, k);
      look.lerp(lookGoal, k);
      camera.lookAt(look);
      camera.up.copy(up);
    });
    // Start where the camera should be, without a glide from the origin.
    camera.position.set(release.x * 0.5, 1.25, 2.3);
    look.set(0, 0.1, -(DECK_END - 2));
    camera.lookAt(look);

    return {
      rack(standing) {
        shownPins = rackPins(standing);
      },
      resetBall() {
        lastBallY = 0;
        ball.rotation.set(0, 0, 0);
      },
      showGuide(on) {
        guide.visible = on;
      },
      dispose() {
        // Geometries, materials and the context are freed by stage.dispose() (disposeScene).
      },
    };
  }

  // ---- input: swipe on the stage, or keys
  const canAim = () => phase === "aim" && !!view && !isCpuTurn() && !shell.covered();
  /** x0/y0: the press (sideways drag moves the ball); fx0/fy0/ft0 and pts: the upward flick that throws it. */
  let swipe: { id: number; x0: number; y0: number; relX: number; fx0: number; fy0: number; ft0: number; pts: number[] } | null = null;
  const onDown = (e: PointerEvent) => {
    if (!canAim()) return;
    e.preventDefault();
    shell.stage.focus({ preventScroll: true });
    shell.stage.setPointerCapture?.(e.pointerId);
    const now = performance.now();
    swipe = { id: e.pointerId, x0: e.clientX, y0: e.clientY, relX: release.x, fx0: e.clientX, fy0: e.clientY, ft0: now, pts: [e.clientX, e.clientY] };
  };
  const onMove = (e: PointerEvent) => {
    if (!swipe || e.pointerId !== swipe.id || !canAim()) return;
    const dx = e.clientX - swipe.x0, dy = e.clientY - swipe.y0;
    // A mostly sideways drag moves the ball across the foul line. While it does, the throw has not started yet:
    // the flick (its speed, angle and bend) is measured from where the upward motion begins, not from the press.
    const last = swipe.pts.length - 2;
    const stepX = e.clientX - (swipe.pts[last] ?? swipe.fx0), stepY = e.clientY - (swipe.pts[last + 1] ?? swipe.fy0);
    if (Math.abs(dx) > Math.abs(dy) * 1.5) {
      const w = shell.stage.clientWidth || 1;
      release = { ...release, x: Math.max(-RELEASE_X, Math.min(RELEASE_X, swipe.relX + (dx / w) * 1.4)) };
    }
    if (stepY >= 0 || Math.abs(stepX) > Math.abs(stepY) * 1.5) {
      // Not moving up: restart the flick here.
      swipe.fx0 = e.clientX;
      swipe.fy0 = e.clientY;
      swipe.ft0 = performance.now();
      swipe.pts = [e.clientX, e.clientY];
    } else if (swipe.pts.length < 512) {
      swipe.pts.push(e.clientX, e.clientY);
    }
  };
  const onUp = (e: PointerEvent) => {
    if (!swipe || e.pointerId !== swipe.id) return;
    const s = swipe;
    swipe = null;
    if (!canAim()) return;
    // The flick only: from where the upward motion began to the release.
    const dx = e.clientX - s.fx0, dy = e.clientY - s.fy0;
    if (dy > -30 || Math.abs(dx) > Math.abs(dy) * 1.5) return;
    const ms = Math.max(30, performance.now() - s.ft0);
    const speed = -dy / ms; // px per ms
    const len = Math.hypot(dx, dy);
    // Bend: how far the middle of the flick strays from the straight line, signed (right = positive).
    const mid = Math.floor(s.pts.length / 4) * 2;
    const mx = s.pts[mid] ?? s.fx0, my = s.pts[mid + 1] ?? s.fy0;
    const cross = (dx * (my - s.fy0) - dy * (mx - s.fx0)) / len;
    const bend = Math.max(-1, Math.min(1, (cross / len) * 5));
    const hook = Math.abs(bend) > 0.15 ? bend : Number(spinIn.value);
    throwBall({
      x: release.x,
      angle: Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, (dx / -dy) * 0.1)),
      power: Math.max(0, Math.min(1, (speed - 0.4) / 2)),
      hook,
    });
  };
  shell.stage.addEventListener("pointerdown", onDown);
  shell.stage.addEventListener("pointermove", onMove);
  shell.stage.addEventListener("pointerup", onUp);
  // A cancelled gesture (edge swipe, palm rejection, a call) is dropped, never rolled.
  const onCancel = (e: PointerEvent) => {
    if (swipe && e.pointerId === swipe.id) swipe = null;
  };
  shell.stage.addEventListener("pointercancel", onCancel);
  // Space held while the window or the focus goes elsewhere: drop the charge (its keyup may never reach us).
  const dropCharge = () => {
    if (phase !== "charging") return;
    phase = "aim";
    charge = 0;
    renderHud();
  };
  window.addEventListener("blur", dropCharge);

  const onKey = (e: KeyboardEvent) => {
    // A Space release after the focus left the game: drop the charge rather than leave the meter running.
    if (e.type === "keyup" && e.code === "Space" && phase === "charging" && !shell.root.contains(document.activeElement)) {
      dropCharge();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || typingTarget(e.target)) return;
    if (!shell.root.contains(document.activeElement)) return;
    // Keys on a focused button or link keep their own meaning.
    if (e.target instanceof Element && e.target !== shell.stage && e.target.closest("button, a, summary, select, input")) return;
    if (e.type === "keyup") {
      if (e.code === "Space" && phase === "charging") {
        e.preventDefault();
        // No throw behind a cover (lost context) or without a view: the player cannot see the roll.
        if (shell.covered() || !view) {
          dropCharge();
          return;
        }
        const power = charge <= 1 ? charge : 2 - charge;
        phase = "aim";
        throwBall({ ...release, power, hook: Number(spinIn.value) });
      }
      return;
    }
    // Space / Enter on the covered stage is handled by gameShell (it presses Play / Play again).
    if (shell.covered()) return;
    if (!canAim()) {
      if (e.code === "Space" && phase === "charging") e.preventDefault();
      return;
    }
    if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
      e.preventDefault();
      release = { ...release, x: Math.max(-RELEASE_X, Math.min(RELEASE_X, release.x + (e.code === "ArrowRight" ? 0.02 : -0.02))) };
    } else if (e.code === "ArrowUp" || e.code === "ArrowDown") {
      e.preventDefault();
      release = { ...release, angle: Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, release.angle + (e.code === "ArrowUp" ? 0.002 : -0.002))) };
    } else if (e.code === "KeyQ" || e.code === "KeyE") {
      e.preventDefault();
      if (e.repeat) return;
      spinIn.value = String(Math.max(-1, Math.min(1, Number(spinIn.value) + (e.code === "KeyE" ? 0.2 : -0.2))));
    } else if (e.code === "Space") {
      e.preventDefault();
      if (e.repeat) return;
      charge = 0;
      phase = "charging";
      renderHud();
    }
  };
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);

  // Reloading or closing the tab mid-roll keeps the roll's result (a reload is not a free retry).
  const onLeave = () => {
    if (phase === "rolling" && roll) {
      roll = finishRoll(roll);
      settle(true);
    } else if (phase === "result") {
      window.clearTimeout(resultTimer);
      nextRoll();
    }
  };
  const onHidden = () => {
    if (document.hidden) onLeave();
  };
  window.addEventListener("pagehide", onLeave);
  document.addEventListener("visibilitychange", onHidden);

  // ---- toolbar
  const oppValue = () => (mode === "solo" ? "solo" : String(level));
  const oppSel = h("select", { "data-in": "opponent" },
    h("option", { value: "solo", selected: oppValue() === "solo" }, t("bowling.solo")),
    ...LEVELS.map((l) => h("option", { value: String(l), selected: oppValue() === String(l) }, t(`bowling.cpu_${l}`)))) as HTMLSelectElement;
  oppSel.addEventListener("change", () => {
    const n = Number(oppSel.value);
    if (oppSel.value === "solo") mode = "solo";
    else {
      mode = "cpu";
      level = (LEVELS as readonly number[]).includes(n) ? (n as Level) : 1;
    }
    // A different opponent is a different game.
    startNewGame();
  });
  const spinIn = h("input", { type: "range", min: "-1", max: "1", step: "0.1", value: "0", "data-in": "spin", "aria-label": t("bowling.spin") }) as HTMLInputElement;
  spinIn.addEventListener("change", () => {
    if (view) shell.stage.focus({ preventScroll: true });
  });
  const newBtn = h("button", { type: "button", class: "btn ghost", "data-act": "new" }, t("bowling.newGame"));
  newBtn.addEventListener("click", startNewGame);

  renderSheet();
  renderHud();
  if (resumed) statusEl.textContent = t("bowling.resumed", { f: Math.min(FRAMES, scoreCard(game.players[game.turn]!.rolls).frame + 1) });
  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("bowling.title")),
      h("p", { class: "lede" }, t("bowling.privacyNote")),
    ),
    h("div", { class: "g3d-bar bw-bar" },
      h("label", { class: "field" }, h("span", null, t("bowling.opponent")), oppSel),
      h("label", { class: "field bw-spin" }, h("span", null, t("bowling.spin")), spinIn),
      newBtn,
      shell.fullscreenButton,
    ),
    shell.root,
    statusEl,
    sheetWrap,
    h("dl", { class: "stats-grid bw-best" }, h("dt", null, t("bowling.best")), bestEl),
    h("p", { class: "hint" }, t("bowling.hint")),
    creditLine("game3d.credit", "https://threejs.org", "three.js"),
  );

  mounted = {
    cleanup: () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("pagehide", onLeave);
      document.removeEventListener("visibilitychange", onHidden);
      shell.stage.removeEventListener("pointerdown", onDown);
      shell.stage.removeEventListener("pointermove", onMove);
      shell.stage.removeEventListener("pointerup", onUp);
      shell.stage.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("blur", dropCharge);
      clearTimers();
      shell.dispose();
      view = null;
    },
  };
}

export function unmountBowling(): void {
  mounted?.cleanup();
  mounted = null;
}
