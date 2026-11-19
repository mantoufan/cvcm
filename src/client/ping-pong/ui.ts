import type { MeshBasicMaterial, Object3D } from "three";
import { h } from "../dom";
import { t } from "../i18n";
import { creditLine, cryptoRand, readStore, typingTarget, writeStore } from "../game-input";
import { coarsePointer, createStage, gameShell, heldKeys, lostContext, type Stage } from "../three-stage";
import {
  BALL_R,
  LEVELS,
  NET_H,
  NET_OVERHANG,
  PADDLE_R,
  TABLE_L,
  TABLE_W,
  cleanRecord,
  clampPlayer,
  newGame,
  step,
  type Game,
  type Level,
} from "../../shared/ping-pong";

/**
 * Ping pong / table tennis against the computer (games3d group). Rules, physics and the computer player are in
 * src/shared/ping-pong.ts; this page draws the table with three.js (loaded on Play, three-stage.ts) and feeds the
 * player's paddle target from the pointer (mouse hover, or a finger dragged on the table) or the arrow keys / WASD.
 * A click, tap or Space swings: it serves, and adds pace to the next hit. Wins and losses per level in
 * `cvcm.pingpong.v1`.
 */

const STORE_KEY = "cvcm.pingpong.v1";
/** Height of the playing surface above the floor (world y of the table top). */
const TOP = 0.76;
const KEYS: Record<string, "up" | "down" | "left" | "right"> = {
  ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
};
/** Keyboard paddle speed (m/s). */
const KEY_SPEED = 2.2;

let mounted: { cleanup: () => void } | null = null;

export function mountPingPong(host: HTMLElement): void {
  unmountPingPong();
  const record = cleanRecord(readStore(STORE_KEY));
  let level: Level = record.level;
  let game: Game = newGame(level);
  let playing = false;
  type View = { restart(): void; swing(): void; dispose(): void };
  let view: View | null = null;

  const youEl = h("dd", { "data-out": "you" }, "0");
  const cpuEl = h("dd", { "data-out": "cpu" }, "0");
  const recordEl = h("p", { class: "pp-record", "data-out": "record" });
  const statusEl = h("p", { class: "pp-status", "aria-live": "polite", "data-out": "status" });
  const hudEl = h("div", { class: "g3d-hud pp-hud", "aria-hidden": "true" });

  const save = () => writeStore(STORE_KEY, record);
  const showRecord = () => {
    recordEl.textContent = t("pingPong.record", { w: record.wins[level], l: record.losses[level] });
  };

  // HUD and score: rebuilt only when the score, the phase or the server changes.
  let shownP = -1, shownC = -1, shownPhase = "", shownServer = "";
  const showScore = () => {
    if (game.score[0] === shownP && game.score[1] === shownC && game.phase === shownPhase && game.server === shownServer) return;
    shownP = game.score[0];
    shownC = game.score[1];
    shownPhase = game.phase;
    shownServer = game.server;
    youEl.textContent = String(shownP);
    cpuEl.textContent = String(shownC);
    const serveNote = game.phase === "serve" ? (game.server === "p" ? t("pingPong.yourServe") : t("pingPong.cpuServe")) : "";
    hudEl.textContent = serveNote ? `${t("pingPong.hud", { you: shownP, cpu: shownC })} · ${serveNote}` : t("pingPong.hud", { you: shownP, cpu: shownC });
  };

  // The point message: when a new point ends.
  let shownRallies = 0;
  const showPoint = () => {
    if (game.rallies === shownRallies || !game.lastPoint) return;
    shownRallies = game.rallies;
    const { winner, reason } = game.lastPoint;
    statusEl.textContent = reason === "let"
      ? t("pingPong.let")
      : t(winner === "p" ? "pingPong.youPoint" : "pingPong.cpuPoint", { why: t(`pingPong.r_${reason}`), you: game.score[0], cpu: game.score[1] });
  };

  const shell = gameShell({
    label: t("pingPong.stage"),
    intro: t("pingPong.intro"),
    className: "g3d-tall pp-root",
    start: async (el) => {
      const stage = await createStage(el, { mode: "loop", fov: 50, near: 0.05, far: 60, background: 0xfdf0f5, active: () => !shell.covered(), onLost: () => lostContext(shell) });
      if (!stage) return null;
      let built: View;
      try {
        built = build(stage);
      } catch (err) {
        stage.dispose();
        throw err;
      }
      view = built;
      built.restart();
      return () => {
        built.dispose();
        view = null;
        stage.dispose();
      };
    },
    resume: () => view?.restart(),
  });
  shell.root.insertBefore(hudEl, shell.stage.nextSibling);

  function finish() {
    playing = false;
    const [you, cpu] = game.score;
    if (game.winner === "p") record.wins[level]++;
    else record.losses[level]++;
    save();
    showRecord();
    const text = game.winner === "p" ? t("pingPong.youWin", { you, cpu }) : t("pingPong.cpuWins", { you, cpu });
    statusEl.textContent = text;
    shell.cover(text, t("pingPong.again"));
  }

  function build(stage: Stage): View {
    const { THREE, scene, camera } = stage;
    const shadows = !coarsePointer();
    if (shadows) stage.renderer.shadowMap.enabled = true;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xf2d4e2, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(1.5, 4, 2);
    sun.castShadow = shadows;
    if (shadows) {
      Object.assign(sun.shadow.camera, { left: -2.5, right: 2.5, top: 3, bottom: -3, near: 0.5, far: 10 });
      sun.shadow.camera.updateProjectionMatrix();
    }
    scene.add(sun);

    const lambert = (color: number) => new THREE.MeshLambertMaterial({ color });
    // Floor, table top with its white lines, legs.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), lambert(0xf6e3ec));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = shadows;
    scene.add(floor);
    const top = new THREE.Mesh(new THREE.BoxGeometry(TABLE_W, 0.03, TABLE_L), lambert(0x2f7a96));
    top.position.y = TOP - 0.015;
    top.receiveShadow = shadows;
    scene.add(top);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const line = (w: number, l: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), lineMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, TOP + 0.001, z);
      scene.add(m);
    };
    line(0.02, TABLE_L, -TABLE_W / 2 + 0.01, 0);
    line(0.02, TABLE_L, TABLE_W / 2 - 0.01, 0);
    line(TABLE_W, 0.02, 0, -TABLE_L / 2 + 0.01);
    line(TABLE_W, 0.02, 0, TABLE_L / 2 - 0.01);
    line(0.006, TABLE_L, 0, 0);
    const legMat = lambert(0x5a4752);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, TOP - 0.03, 0.05), legMat);
      leg.position.set(sx * (TABLE_W / 2 - 0.15), (TOP - 0.03) / 2, sz * (TABLE_L / 2 - 0.3));
      scene.add(leg);
    }
    // Net and posts.
    const net = new THREE.Mesh(
      new THREE.BoxGeometry(TABLE_W + NET_OVERHANG * 2, NET_H, 0.008),
      new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }),
    );
    net.position.set(0, TOP + NET_H / 2, 0);
    scene.add(net);
    const postMat = lambert(0x3a2433);
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, NET_H + 0.02, 8), postMat);
      post.position.set(sx * (TABLE_W / 2 + NET_OVERHANG), TOP + NET_H / 2, 0);
      scene.add(post);
    }

    // Ball (drawn a touch larger than it is, for visibility) and its shadow spot, which helps judge its height.
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R * 1.25, 20, 14),
      new THREE.MeshStandardMaterial({ color: 0xfff4e6, emissive: 0xffd9a8, emissiveIntensity: 0.25, roughness: 0.4 }),
    );
    ball.castShadow = shadows;
    scene.add(ball);
    const spotMat = new THREE.MeshBasicMaterial({ color: 0x1d1218, transparent: true, opacity: 0.35, depthWrite: false });
    const spot = new THREE.Mesh(new THREE.CircleGeometry(BALL_R * 1.3, 20), spotMat);
    spot.rotation.x = -Math.PI / 2;
    scene.add(spot);

    // Paddles: a round blade facing along the table, with a handle.
    // The player's own paddle is near the camera: drawn see-through so it never hides the ball.
    const paddle = (color: number, seeThrough: boolean): Object3D => {
      const group = new THREE.Group();
      const blade = new THREE.Mesh(
        new THREE.CylinderGeometry(PADDLE_R, PADDLE_R, 0.012, 28),
        new THREE.MeshStandardMaterial({ color, roughness: 0.55, transparent: seeThrough, opacity: seeThrough ? 0.55 : 1 }),
      );
      blade.rotation.x = Math.PI / 2;
      blade.castShadow = shadows;
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.1, 0.022), lambert(0xd9b38c));
      handle.position.y = -PADDLE_R - 0.045;
      group.add(blade, handle);
      scene.add(group);
      return group;
    };
    const you = paddle(0xc2336c, true);
    const cpu = paddle(0x7b5cc4, false);

    const place = () => {
      const b = game.ball;
      ball.position.set(b.x, TOP + b.z, -b.y);
      const over = Math.abs(b.x) <= TABLE_W / 2 && Math.abs(b.y) <= TABLE_L / 2;
      spot.position.set(b.x, over ? TOP + 0.002 : 0.002, -b.y);
      const lift = Math.max(0, b.z) / 0.8;
      (spot.material as MeshBasicMaterial).opacity = Math.max(0.08, 0.35 - lift * 0.25);
      you.position.set(game.player.x, TOP + game.player.z, -game.player.y);
      cpu.position.set(game.cpu.x, TOP + game.cpu.z, -game.cpu.y);
      // A small tilt toward the side the paddle moves to reads as a swing.
      you.rotation.z = Math.max(-0.5, Math.min(0.5, -game.player.vx * 0.08));
      cpu.rotation.z = Math.max(-0.5, Math.min(0.5, game.cpu.vx * 0.08));
    };

    // Pointer: where it meets a plane just above the table is the paddle's target (x across, y along the table).
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(TOP + 0.1));
    const hit = new THREE.Vector3();
    let target = { x: game.player.x, y: game.player.y };
    let swingPending = false;
    const aim = (e: PointerEvent) => {
      const r = stage.canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.ray.intersectPlane(plane, hit)) target = clampPlayer(hit.x, -hit.z);
    };
    const onMove = (e: PointerEvent) => {
      if (!playing || shell.covered()) return;
      if (e.pointerType !== "mouse" && e.buttons === 0) return;
      aim(e);
    };
    const onDown = (e: PointerEvent) => {
      if (!playing || shell.covered()) return;
      if (e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      shell.stage.focus({ preventScroll: true });
      aim(e);
      swingPending = true;
    };
    shell.stage.addEventListener("pointermove", onMove);
    shell.stage.addEventListener("pointerdown", onDown);

    // Keys move the target from where the paddle is, so keys and the mouse never fight.
    const keys = heldKeys(KEYS, () => playing && !shell.covered() && shell.root.contains(document.activeElement));

    let fit = 0;
    const fitCamera = () => {
      fit = camera.aspect;
      // Further back on a narrow (portrait) stage so the whole table stays in view.
      const k = Math.max(1, 0.8 / (fit || 1));
      camera.position.set(0, 1.75 + 0.35 * (k - 1), 3.05 * k);
      camera.lookAt(0, TOP - 0.1, -0.25);
    };

    stage.onFrame((dt) => {
      if (camera.aspect !== fit) fitCamera();
      if (playing) {
        const dx = (keys.held.has("right") ? 1 : 0) - (keys.held.has("left") ? 1 : 0);
        const dy = (keys.held.has("up") ? 1 : 0) - (keys.held.has("down") ? 1 : 0);
        if (dx || dy) {
          const n = Math.hypot(dx, dy);
          // Move the target at KEY_SPEED; the paddle follows it, so it stops where the key is released.
          target = clampPlayer(target.x + (dx / n) * KEY_SPEED * dt, target.y + (dy / n) * KEY_SPEED * dt);
        }
        game = step(game, { x: target.x, y: target.y, swing: swingPending }, dt);
        swingPending = false;
        showScore();
        showPoint();
        if (game.phase === "over") finish();
      }
      ball.rotation.x += game.ball.spin * dt * 25;
      place();
    });

    return {
      restart() {
        // A fresh random match each time (a restart must not replay the same computer errors to learn them).
        game = newGame(level, 1 + Math.floor(cryptoRand() * 0x7fffffff));
        target = { x: game.player.x, y: game.player.y };
        swingPending = false;
        playing = true;
        shownRallies = 0;
        statusEl.textContent = "";
        showScore();
        place();
      },
      swing() {
        swingPending = true;
      },
      dispose() {
        keys.dispose();
        shell.stage.removeEventListener("pointermove", onMove);
        shell.stage.removeEventListener("pointerdown", onDown);
      },
    };
  }

  const newMatch = () => {
    if (!view) return;
    if (shell.covered()) shell.uncover();
    view.restart();
    shell.stage.focus({ preventScroll: true });
  };
  const levelSel = h("select", { "data-in": "level" },
    ...LEVELS.map((l) => h("option", { value: String(l), selected: l === level }, t(`pingPong.l_${l}`)))) as HTMLSelectElement;
  levelSel.addEventListener("change", () => {
    const n = Number(levelSel.value);
    level = (LEVELS as readonly number[]).includes(n) ? (n as Level) : 1;
    record.level = level;
    save();
    showRecord();
    // A new level starts a new match.
    newMatch();
  });
  const restartBtn = h("button", { type: "button", class: "btn ghost", "data-act": "restart" }, t("pingPong.restart"));
  restartBtn.addEventListener("click", newMatch);

  // Space or Enter on the focused stage swings (serves) while playing; on the cover gameShell presses its button.
  const onKey = (e: KeyboardEvent) => {
    if (e.code !== "Space" && e.code !== "Enter" && e.code !== "NumpadEnter") return;
    if (e.ctrlKey || e.metaKey || e.altKey || typingTarget(e.target)) return;
    if (e.target !== shell.stage) return;
    e.preventDefault();
    if (e.repeat) return;
    if (shell.covered()) return;
    if (playing && view) view.swing();
  };
  window.addEventListener("keydown", onKey);

  showScore();
  showRecord();
  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("pingPong.title")),
      h("p", { class: "lede" }, t("pingPong.privacyNote")),
    ),
    h("div", { class: "g3d-bar pp-bar" },
      h("label", { class: "field" }, h("span", null, t("pingPong.level")), levelSel),
      restartBtn,
      shell.fullscreenButton,
      h("dl", { class: "stats-grid pp-score" }, h("dt", null, t("pingPong.you")), youEl, h("dt", null, t("pingPong.computer")), cpuEl),
    ),
    shell.root,
    statusEl,
    recordEl,
    h("p", { class: "hint" }, t("pingPong.hint")),
    creditLine("game3d.credit", "https://threejs.org", "three.js"),
  );

  mounted = {
    cleanup: () => {
      window.removeEventListener("keydown", onKey);
      shell.dispose();
      view = null;
    },
  };
}

export function unmountPingPong(): void {
  mounted?.cleanup();
  mounted = null;
}
