import type { Mesh, MeshLambertMaterial } from "three";
import { h } from "../dom";
import { t } from "../i18n";
import { creditLine, onScreen, readStore, typingTarget, writeStore } from "../game-input";
import { createStage, gameShell, lostContext, type Stage } from "../three-stage";
import {
  SLAB_HEIGHT,
  START_SIZE,
  axisFor,
  growSlab,
  hueFor,
  placeSlab,
  slideOffset,
  speed,
  type Axis,
  type Slab,
} from "../../shared/stack-game";

const STORE_KEY = "cvcm.stackgame.v1";
/** Slabs further than this below the top are dropped from the scene (never seen again, frees GPU memory). */
const KEEP_BELOW = 40;

interface Falling {
  mesh: Mesh;
  vy: number;
  spin: { x: number; z: number };
}

let mounted: { cleanup: () => void } | null = null;

export function mountStackGame(host: HTMLElement): void {
  unmountStackGame();
  let best = readStore<{ best?: number }>(STORE_KEY)?.best ?? 0;
  let score = 0;
  let playing = false;

  const scoreEl = h("dd", { "data-out": "score" }, "0");
  const bestEl = h("dd", { "data-out": "best" }, String(best));
  const hudScore = h("span", { class: "sk-hud-score", "data-out": "hud" }, "0");
  const statusEl = h("p", { class: "sk-status", "aria-live": "polite", "data-out": "status" });

  /** The running game, set while a 3D stage exists. */
  let game: { drop(): void; restart(): void } | null = null;

  const shell = gameShell({
    label: t("stackGame.stage"),
    intro: t("stackGame.intro"),
    className: "g3d-tall sk-root",
    start: async (el) => {
      const stage = await createStage(el, { mode: "loop", fov: 35, near: 0.1, far: 200, background: 0xfdf0f5, active: () => !shell.covered(), onLost: () => { game = null; lostContext(shell); } });
      if (!stage) return null;
      game = build(stage);
      game.restart();
      return () => {
        game = null;
        stage.dispose();
      };
    },
    resume: () => game?.restart(),
  });
  const hud = h("div", { class: "g3d-hud sk-hud", "aria-hidden": "true" }, hudScore);
  // Right after the stage, under the cover (Play / game over) and the full screen exit button.
  shell.root.insertBefore(hud, shell.stage.nextSibling);

  const setScore = (n: number) => {
    score = n;
    scoreEl.textContent = String(n);
    hudScore.textContent = String(n);
  };

  let coverTimer = 0;
  const gameOver = () => {
    playing = false;
    const record = score > best;
    if (record) {
      best = score;
      bestEl.textContent = String(best);
      writeStore(STORE_KEY, { best });
    }
    statusEl.textContent = record && score > 0 ? t("stackGame.newBest", { score }) : t("stackGame.over", { score });
    // Let the missed slab fall on screen first: frames stop while the cover is up.
    window.clearTimeout(coverTimer);
    coverTimer = window.setTimeout(() => shell.cover(t("stackGame.over", { score }), t("stackGame.again")), 1100);
  };

  function build(stage: Stage): { drop(): void; restart(): void } {
    const { THREE, scene, camera } = stage;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xf4d6e4, 1.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.3);
    sun.position.set(5, 12, 7);
    scene.add(sun);
    scene.add(sun.target);

    const pedestalGeo = new THREE.BoxGeometry(START_SIZE, 6, START_SIZE);
    const pedestal = new THREE.Mesh(pedestalGeo, new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(hueFor(0) / 360, 0.5, 0.8) }));
    pedestal.position.set(0, -3 - SLAB_HEIGHT / 2, 0);
    scene.add(pedestal);

    const tower: Mesh[] = [];
    let falling: Falling[] = [];
    let top: Slab = { x: 0, z: 0, w: START_SIZE, d: START_SIZE };
    let moving: Mesh | null = null;
    let slab: Slab = top;
    let axis: Axis = "x";
    let level = 0;
    let travelled = 0;
    let combo = 0;
    let camY = 0;

    const slabMesh = (s: Slab, lvl: number): Mesh => {
      const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(hueFor(lvl) / 360, 0.62, 0.76) });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(s.w, SLAB_HEIGHT, s.d), mat);
      mesh.position.set(s.x, lvl * SLAB_HEIGHT, s.z);
      return mesh;
    };
    const free = (mesh: Mesh) => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as MeshLambertMaterial).dispose();
    };

    /** Next slab: same footprint as the top, starting at the far end of its axis. */
    const spawn = () => {
      level += 1;
      axis = axisFor(level);
      travelled = 0;
      slab = { ...top, [axis]: top[axis] + slideOffset(0) };
      moving = slabMesh(slab, level);
      scene.add(moving);
    };

    const restart = () => {
      for (const m of tower) free(m);
      for (const f of falling) free(f.mesh);
      if (moving) free(moving);
      tower.length = 0;
      falling = [];
      moving = null;
      top = { x: 0, z: 0, w: START_SIZE, d: START_SIZE };
      level = 0;
      combo = 0;
      // Back to the ground at once: easing down from the old tower would hide the first slab.
      camY = 0;
      setScore(0);
      statusEl.textContent = "";
      playing = true;
      spawn();
    };

    const fall = (s: Slab, lvl: number) => {
      const mesh = slabMesh(s, lvl);
      scene.add(mesh);
      const away = (axis === "x" ? s.x - top.x : s.z - top.z) >= 0 ? 1 : -1;
      falling.push({ mesh, vy: 0, spin: axis === "x" ? { x: 0, z: -away * 2.2 } : { x: away * 2.2, z: 0 } });
    };

    const drop = () => {
      if (!playing || !moving) return;
      const result = placeSlab(top, slab, axis);
      free(moving);
      moving = null;
      if (result.missed || !result.kept) {
        fall(slab, level);
        gameOver();
        return;
      }
      let kept = result.kept;
      if (result.perfect) {
        combo += 1;
        kept = growSlab(kept, combo);
        statusEl.textContent = t("stackGame.perfect", { n: combo });
      } else {
        combo = 0;
        statusEl.textContent = "";
      }
      if (result.cut) fall(result.cut, level);
      const placed = slabMesh(kept, level);
      scene.add(placed);
      tower.push(placed);
      while (tower.length > KEEP_BELOW) free(tower.shift()!);
      top = kept;
      setScore(score + 1);
      spawn();
    };

    stage.onFrame((dt) => {
      if (playing && moving) {
        travelled += speed(level) * dt;
        slab = { ...slab, [axis]: top[axis] + slideOffset(travelled) };
        moving.position.set(slab.x, level * SLAB_HEIGHT, slab.z);
      }
      const keep: Falling[] = [];
      for (const f of falling) {
        f.vy -= 14 * dt;
        f.mesh.position.y += f.vy * dt;
        f.mesh.rotation.x += f.spin.x * dt;
        f.mesh.rotation.z += f.spin.z * dt;
        if (f.mesh.position.y < camY - 20) free(f.mesh);
        else keep.push(f);
      }
      falling = keep;
      // The camera follows the top of the tower, eased; at the start it shows the pedestal too.
      const target = level * SLAB_HEIGHT;
      camY += (target - camY) * Math.min(1, dt * 3);
      const { width, height } = stage.size();
      const far = 11 + (height > width ? 3 : 0);
      camera.position.set(far * 0.62, camY + far * 0.72, far * 0.62);
      camera.lookAt(0, camY - 0.6, 0);
    });
    return { drop, restart };
  }

  const onPointer = (e: PointerEvent) => {
    if (e.button > 0) return;
    e.preventDefault();
    shell.stage.focus({ preventScroll: true });
    game?.drop();
  };
  shell.stage.addEventListener("pointerdown", onPointer);
  const onKey = (e: KeyboardEvent) => {
    if (e.code !== "Space" && e.code !== "Enter" && e.code !== "NumpadEnter") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target;
    if (typingTarget(target)) return;
    const onStage = target === shell.stage;
    // Enter or Space on a button (Play, full screen) or link keeps its own meaning.
    if (!onStage && target instanceof HTMLElement && target.closest("button, a, summary")) return;
    if (!onStage && !onScreen(shell.root)) return;
    // Space or Enter on the stage after a game over plays again, like the cover's button.
    if (onStage && shell.covered() && game && !playing) {
      e.preventDefault();
      if (!e.repeat) shell.root.querySelector<HTMLButtonElement>('[data-act="play"]')?.click();
      return;
    }
    if (!game || !playing) return;
    e.preventDefault();
    if (!e.repeat) game.drop();
  };
  window.addEventListener("keydown", onKey);

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("stackGame.title")),
      h("p", { class: "lede" }, t("stackGame.privacyNote")),
    ),
    h("div", { class: "g3d-bar sk-bar" },
      h("dl", { class: "stats-grid sk-score" }, h("dt", null, t("stackGame.score")), scoreEl, h("dt", null, t("stackGame.best")), bestEl),
      shell.fullscreenButton,
    ),
    shell.root,
    statusEl,
    h("p", { class: "hint" }, t("stackGame.hint")),
    creditLine("game3d.credit", "https://threejs.org", "three.js"),
  );

  mounted = {
    cleanup: () => {
      window.clearTimeout(coverTimer);
      window.removeEventListener("keydown", onKey);
      shell.stage.removeEventListener("pointerdown", onPointer);
      shell.dispose();
      game = null;
    },
  };
}

export function unmountStackGame(): void {
  mounted?.cleanup();
  mounted = null;
}
