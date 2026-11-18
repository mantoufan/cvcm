import type { Group, Material, Mesh, MeshStandardMaterial } from "three";
import { h } from "../dom";
import { t } from "../i18n";
import { creditLine, readStore, typingTarget, writeStore } from "../game-input";
import { coarsePointer, createStage, gameShell, heldKeys, holdPad, lostContext, type Stage } from "../three-stage";
import {
  BALL_R,
  BUMPERS,
  FLIPPER_LEN,
  FLIPPER_R,
  H,
  LANE_X,
  NO_INPUT,
  ROLLOVERS,
  ROLLOVER_R,
  SEGMENTS,
  W,
  flipperGeom,
  newGame,
  step,
  type Input,
  type Pin,
  type Side,
} from "../../shared/pinball";

/**
 * Pinball (games3d): an original pastel table drawn with three.js over the 2D physics in shared/pinball.ts. three.js
 * and the renderer load on Play (three-stage.ts); the mount is plain DOM. Best score in `cvcm.pinball.v1`.
 */

const STORE_KEY = "cvcm.pinball.v1";

type Action = "left" | "right" | "plunger";
const KEYS: Record<string, Action> = {
  ArrowLeft: "left", KeyZ: "left", ShiftLeft: "left",
  ArrowRight: "right", Slash: "right", ShiftRight: "right",
  Space: "plunger", ArrowDown: "plunger",
};

let mounted: { cleanup: () => void } | null = null;

interface Game {
  restart(): void;
  dispose(): void;
}

export function mountPinball(host: HTMLElement): void {
  unmountPinball();
  let best = Math.max(0, Math.floor(Number(readStore<{ best?: number }>(STORE_KEY)?.best) || 0));
  let playing = false;
  let game: Game | null = null;
  let coverTimer = 0;
  /** Keys held (set by heldKeys once a game is built), the phone pad, and taps on the two halves of the table. */
  let keyHeld = new Set<Action>();
  const padHeld = new Set<Action>();
  const touchHeld = new Map<number, Action>();

  const scoreEl = h("dd", { "data-out": "score" }, "0");
  const bestEl = h("dd", { "data-out": "best" }, String(best));
  const ballEl = h("dd", { "data-out": "ball" }, "—");
  const statusEl = h("p", { class: "pb-status", "aria-live": "polite", "data-out": "status" });
  const hudScore = h("span", { class: "pb-hud-score" }, "0");
  const hudBall = h("span", { class: "pb-hud-ball" });
  const hudMult = h("span", { class: "pb-hud-mult" });

  const shell = gameShell({
    label: t("pinball.stage"),
    intro: t("pinball.intro"),
    className: "g3d-tall pb-root",
    start: async (el) => {
      const stage = await createStage(el, {
        mode: "loop", fov: 42, near: 0.1, far: 200, background: 0xfdf0f5,
        active: () => !shell.covered(),
        onLost: () => { game = null; lostContext(shell); },
      });
      if (!stage) return null;
      const built = build(stage);
      // Window key listeners only once the game is built, so a build that throws leaves none behind.
      const keys = heldKeys<Action>(KEYS, () => playing && !shell.covered() && shell.root.contains(document.activeElement));
      keyHeld = keys.held;
      game = built;
      built.restart();
      return () => {
        keys.dispose();
        keyHeld = new Set();
        built.dispose();
        game = null;
        stage.dispose();
      };
    },
    resume: () => game?.restart(),
  });

  const hud = h("div", { class: "g3d-hud pb-hud", "aria-hidden": "true" }, hudScore, hudBall, hudMult);
  const pad = holdPad<Action>([
    { action: "left", label: "◀", aria: t("pinball.leftFlipper") },
    { action: "plunger", label: "▼", aria: t("pinball.plunger") },
    { action: "right", label: "▶", aria: t("pinball.rightFlipper") },
  ], padHeld, "g3d-touch-only pb-pad");
  // Right after the stage, under the cover and the full screen exit button.
  shell.root.insertBefore(hud, shell.stage.nextSibling);
  shell.root.insertBefore(pad, hud.nextSibling);

  const input = (): Input => {
    if (!playing) return NO_INPUT;
    const on = (a: Action) => keyHeld.has(a) || padHeld.has(a) || [...touchHeld.values()].includes(a);
    return { left: on("left"), right: on("right"), plunger: on("plunger") };
  };

  let shownKey = "";
  const showStats = (s: Pin) => {
    const key = `${s.score}|${s.balls}|${s.multiplier}`;
    if (key === shownKey) return;
    shownKey = key;
    const ballNo = Math.max(1, 3 - s.balls + 1);
    scoreEl.textContent = String(s.score);
    hudScore.textContent = String(s.score);
    ballEl.textContent = s.over ? "—" : t("pinball.ballOf", { n: ballNo, of: 3 });
    hudBall.textContent = s.over ? "" : t("pinball.ballOf", { n: ballNo, of: 3 });
    hudMult.textContent = s.multiplier > 1 ? `×${s.multiplier}` : "";
  };

  const gameOver = (score: number) => {
    playing = false;
    const record = score > best;
    if (record) {
      best = score;
      bestEl.textContent = String(best);
      writeStore(STORE_KEY, { best });
    }
    statusEl.textContent = record && score > 0 ? t("pinball.newBest", { score }) : t("pinball.over", { score });
    window.clearTimeout(coverTimer);
    coverTimer = window.setTimeout(() => shell.cover(t("pinball.over", { score }), t("pinball.again")), 900);
  };

  function build(stage: Stage): Game {
    const { THREE, scene, camera, renderer } = stage;
    const fine = !coarsePointer();
    const owned: { dispose(): void }[] = [];
    const geo = <T extends { dispose(): void }>(g: T): T => { owned.push(g); return g; };
    const mat = <T extends Material>(m: T): T => { owned.push(m); return m; };

    // Table coordinates (x right, y up the table) → world inside the tilted table group.
    const table: Group = new THREE.Group();
    table.rotation.x = 0.12;
    scene.add(table);
    const place = (o: { position: { set(x: number, y: number, z: number): void } }, x: number, y: number, up = 0) =>
      o.position.set(x - W / 2, up, H / 2 - y);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xf4d6e4, 1.45));
    const sun = new THREE.DirectionalLight(0xffffff, 1.15);
    sun.position.set(-4, 16, 8);
    scene.add(sun);
    if (fine) {
      renderer.shadowMap.enabled = true;
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 13, bottom: -13, near: 1, far: 60 });
      sun.shadow.camera.updateProjectionMatrix();
    }

    // Playfield and rim.
    const floor = new THREE.Mesh(geo(new THREE.PlaneGeometry(W + 0.6, H + 1)), mat(new THREE.MeshStandardMaterial({ color: 0xfff3f7, roughness: 0.55 })));
    floor.rotation.x = -Math.PI / 2;
    place(floor, W / 2, H / 2);
    floor.receiveShadow = fine;
    table.add(floor);
    // Soft colour patches under the bumpers and the flippers (part of the table art).
    const patch = (x: number, y: number, r: number, color: number) => {
      const m = new THREE.Mesh(geo(new THREE.CircleGeometry(r, 32)), mat(new THREE.MeshStandardMaterial({ color, roughness: 0.6 })));
      m.rotation.x = -Math.PI / 2;
      place(m, x, y, 0.005);
      table.add(m);
    };
    patch(4.6, 14.2, 2.6, 0xfde3ee);
    patch(4.6, 3.2, 2.2, 0xf6ecff);

    const wallMat = mat(new THREE.MeshStandardMaterial({ color: 0xf4a9c6, roughness: 0.45 }));
    const slingMats: MeshStandardMaterial[] = [];
    const targetMats: MeshStandardMaterial[] = [];
    for (const seg of SEGMENTS) {
      const dx = seg.b[0] - seg.a[0], dy = seg.b[1] - seg.a[1];
      const len = Math.hypot(dx, dy);
      let m: Material = wallMat;
      if (seg.kind === "sling") {
        const sm = mat(new THREE.MeshStandardMaterial({ color: 0xffc9a8, roughness: 0.35, emissive: 0x000000 }));
        slingMats[seg.id] = sm;
        m = sm;
      } else if (seg.kind === "target") {
        const tm = mat(new THREE.MeshStandardMaterial({ color: 0xc8b6f0, roughness: 0.4, emissive: 0x000000 }));
        targetMats[seg.id] = tm;
        m = tm;
      }
      const height = seg.kind === "wall" ? 0.6 : 0.5;
      const mesh = new THREE.Mesh(geo(new THREE.BoxGeometry(len + 0.14, height, 0.16)), m);
      place(mesh, (seg.a[0] + seg.b[0]) / 2, (seg.a[1] + seg.b[1]) / 2, height / 2);
      mesh.rotation.y = Math.atan2(dy, dx);
      mesh.castShadow = fine;
      table.add(mesh);
    }

    // Pop bumpers: a body and a cap that lights up when hit.
    const bumperCaps: MeshStandardMaterial[] = [];
    const bumperColors = [0x9fe3c9, 0xffd36e, 0x9fd0ff];
    BUMPERS.forEach((b, i) => {
      const body = new THREE.Mesh(geo(new THREE.CylinderGeometry(b.r, b.r * 1.08, 0.45, 28)), mat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })));
      place(body, b.x, b.y, 0.225);
      body.castShadow = fine;
      table.add(body);
      const capMat = mat(new THREE.MeshStandardMaterial({ color: bumperColors[i]!, roughness: 0.3, emissive: 0x000000 }));
      bumperCaps.push(capMat);
      const cap = new THREE.Mesh(geo(new THREE.CylinderGeometry(b.r * 0.82, b.r * 0.9, 0.18, 28)), capMat);
      place(cap, b.x, b.y, 0.54);
      table.add(cap);
    });

    // Rollover lights.
    const rollMats: MeshStandardMaterial[] = ROLLOVERS.map(([x, y]) => {
      const m = mat(new THREE.MeshStandardMaterial({ color: 0xe9d9e2, roughness: 0.5, emissive: 0x000000 }));
      const disc = new THREE.Mesh(geo(new THREE.CircleGeometry(ROLLOVER_R * 0.8, 24)), m);
      disc.rotation.x = -Math.PI / 2;
      place(disc, x, y, 0.01);
      table.add(disc);
      return m;
    });

    // Flippers: a rounded bar turning about its pivot.
    const flipMat = mat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
    const makeFlipper = (side: Side): Group => {
      const g = new THREE.Group();
      const bar = new THREE.Mesh(geo(new THREE.BoxGeometry(FLIPPER_LEN, 0.42, FLIPPER_R * 2)), flipMat);
      bar.position.x = FLIPPER_LEN / 2;
      bar.castShadow = fine;
      const hub = new THREE.Mesh(geo(new THREE.CylinderGeometry(FLIPPER_R * 1.25, FLIPPER_R * 1.25, 0.44, 20)), mat(new THREE.MeshStandardMaterial({ color: 0xc2336c, roughness: 0.4 })));
      const tipCap = new THREE.Mesh(geo(new THREE.CylinderGeometry(FLIPPER_R, FLIPPER_R, 0.42, 16)), flipMat);
      tipCap.position.x = FLIPPER_LEN;
      g.add(bar, hub, tipCap);
      const pivot = flipperGeom(side, 0).pivot;
      place(g, pivot[0], pivot[1], 0.21);
      table.add(g);
      return g;
    };
    const leftFlipper = makeFlipper("left");
    const rightFlipper = makeFlipper("right");

    // Plunger in the lane.
    const plunger = new THREE.Mesh(geo(new THREE.BoxGeometry(0.5, 0.35, 0.9)), mat(new THREE.MeshStandardMaterial({ color: 0xc2336c, roughness: 0.4 })));
    table.add(plunger);

    // The ball.
    const ball: Mesh = new THREE.Mesh(geo(new THREE.SphereGeometry(BALL_R, 28, 18)), mat(new THREE.MeshStandardMaterial({ color: 0xeef1f6, metalness: 0.35, roughness: 0.18 })));
    ball.castShadow = fine;
    table.add(ball);

    let state: Pin = newGame();
    let noticeAt = -1;

    const placeCamera = () => {
      const { width, height } = stage.size();
      const aspect = width / Math.max(1, height);
      // Further back on a narrow stage so the whole width of the table stays in view.
      const k = Math.max(1, 0.8 / aspect);
      camera.position.set(0, 21 * k, 15.5 * k);
      camera.lookAt(0, 0, 0.4);
    };

    const flash = (m: MeshStandardMaterial, on: boolean, color = 0xffffff, strength = 0.55) => {
      m.emissive.setHex(on ? color : 0x000000);
      m.emissiveIntensity = on ? strength : 0;
    };

    stage.onFrame((dt) => {
      placeCamera();
      if (playing) {
        state = step(state, input(), dt);
        if (state.notice.t !== noticeAt && state.notice.kind) {
          noticeAt = state.notice.t;
          const n = state.notice.kind;
          if (n === "saved") statusEl.textContent = t("pinball.saved");
          else if (n === "lost") statusEl.textContent = t("pinball.lost", { n: state.balls });
          else if (n === "multiplier") statusEl.textContent = t("pinball.multiplier", { n: state.multiplier });
          else if (n === "targets") statusEl.textContent = t("pinball.targets");
          else if (n === "launch") statusEl.textContent = "";
        }
        if (state.over) gameOver(state.score);
      }
      showStats(state);
      place(ball, state.x, state.y, BALL_R);
      ball.visible = !state.over;
      leftFlipper.rotation.y = state.left.a;
      rightFlipper.rotation.y = Math.PI - state.right.a;
      place(plunger, (LANE_X + W) / 2, 0.05 - state.charge * 0.6, 0.18);
      const recent = (key: string) => state.t - (state.hits[key] ?? -9) < 0.12;
      bumperCaps.forEach((m, i) => flash(m, recent(`b${i}`), 0xffffff, 0.7));
      slingMats.forEach((m, i) => flash(m, recent(`s${i}`), 0xffffff, 0.6));
      targetMats.forEach((m, i) => flash(m, state.targets[i]! || recent(`t${i}`), 0xb48cff, 0.6));
      rollMats.forEach((m, i) => flash(m, state.rollovers[i]!, 0xff7aa8, 0.8));
    });

    return {
      restart() {
        window.clearTimeout(coverTimer);
        state = newGame();
        noticeAt = -1;
        shownKey = "";
        statusEl.textContent = t("pinball.ready");
        playing = true;
      },
      dispose() {
        for (const o of owned) o.dispose();
        owned.length = 0;
      },
    };
  }

  // Taps on the left or right half of the table work the flippers on phones.
  const onPointerDown = (e: PointerEvent) => {
    if (shell.covered() || !playing) return;
    if (e.pointerType === "mouse" && e.button > 0) return;
    e.preventDefault();
    shell.stage.focus({ preventScroll: true });
    const r = shell.stage.getBoundingClientRect();
    touchHeld.set(e.pointerId, e.clientX < r.left + r.width / 2 ? "left" : "right");
    shell.stage.setPointerCapture?.(e.pointerId);
  };
  const onPointerUp = (e: PointerEvent) => {
    touchHeld.delete(e.pointerId);
  };
  shell.stage.addEventListener("pointerdown", onPointerDown);
  shell.stage.addEventListener("pointerup", onPointerUp);
  shell.stage.addEventListener("pointercancel", onPointerUp);
  shell.stage.addEventListener("lostpointercapture", onPointerUp);
  shell.stage.addEventListener("contextmenu", (e) => e.preventDefault());

  // Space or Enter on the stage after a game over plays again, like the cover's button.
  const onKey = (e: KeyboardEvent) => {
    if (e.code !== "Space" && e.code !== "Enter" && e.code !== "NumpadEnter") return;
    if (e.ctrlKey || e.metaKey || e.altKey || typingTarget(e.target)) return;
    if (e.target !== shell.stage || !shell.covered() || !game || playing) return;
    e.preventDefault();
    if (!e.repeat) shell.root.querySelector<HTMLButtonElement>('[data-act="play"]')?.click();
  };
  window.addEventListener("keydown", onKey);

  const newBtn = h("button", { type: "button", class: "btn ghost", "data-act": "new-game" }, t("pinball.newGame")) as HTMLButtonElement;
  newBtn.addEventListener("click", () => {
    if (!game) return;
    shell.uncover();
    game.restart();
    shell.stage.focus({ preventScroll: true });
  });

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("pinball.title")),
      h("p", { class: "lede" }, t("pinball.privacyNote")),
    ),
    h("div", { class: "g3d-bar pb-bar" },
      h("dl", { class: "stats-grid pb-stats" },
        h("dt", null, t("pinball.score")), scoreEl,
        h("dt", null, t("pinball.ball")), ballEl,
        h("dt", null, t("pinball.best")), bestEl),
      newBtn,
      shell.fullscreenButton,
    ),
    shell.root,
    statusEl,
    h("p", { class: "hint" }, t("pinball.hint")),
    creditLine("game3d.credit", "https://threejs.org", "three.js"),
  );

  mounted = {
    cleanup: () => {
      window.clearTimeout(coverTimer);
      window.removeEventListener("keydown", onKey);
      shell.stage.removeEventListener("pointerdown", onPointerDown);
      shell.stage.removeEventListener("pointerup", onPointerUp);
      shell.stage.removeEventListener("pointercancel", onPointerUp);
      shell.stage.removeEventListener("lostpointercapture", onPointerUp);
      touchHeld.clear();
      padHeld.clear();
      shell.dispose();
      game = null;
    },
  };
}

export function unmountPinball(): void {
  mounted?.cleanup();
  mounted = null;
}
