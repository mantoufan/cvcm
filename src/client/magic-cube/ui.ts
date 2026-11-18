import type { Group, Mesh, Object3D, Vector3 } from "three";
import { h } from "../dom";
import { t } from "../i18n";
import { formatClock } from "../../shared/game-clock";
import { creditLine, cryptoRand, readStore, typingTarget, writeStore } from "../game-input";
import { createStage, gameShell, lostContext, type Shell, type Stage } from "../three-stage";
import {
  applyMove, cloneCube, CUBE_COLORS, CUBE_SIZES, faceMove, FACES, invertMove, isSolved, movedCubies, moveToken, newCube,
  parseNotation, parseToken, scramble, stickerNormal, type Axis, type Cube, type CubeSize, type Face, type Move, type Vec,
} from "../../shared/magic-cube";

const STORE_KEY = "cvcm.magiccube.v1";
const TURN_MS = 150;

interface Saved {
  size: CubeSize;
  scramble: string[];
  moves: string[];
  /** Timed attempt in progress (a scramble not solved yet). */
  timing: boolean;
  elapsed: number;
  best: Partial<Record<CubeSize, { ms: number; moves: number }>>;
}

let mounted: { cleanup: () => void } | null = null;

export function formatTime(ms: number): string {
  return formatClock(ms, 2);
}

function loadSaved(): Saved {
  const raw = readStore<Partial<Saved>>(STORE_KEY);
  const size = (CUBE_SIZES as readonly number[]).includes(Number(raw?.size)) ? (raw!.size as CubeSize) : 3;
  const tokens = (list: unknown) => (Array.isArray(list) ? list.filter((x) => typeof x === "string" && parseToken(size, x)) : []) as string[];
  const best: Saved["best"] = {};
  for (const n of CUBE_SIZES) {
    const b = raw?.best?.[n];
    if (b && Number.isFinite(b.ms) && b.ms > 0 && Number.isFinite(b.moves)) best[n] = { ms: b.ms, moves: b.moves };
  }
  return {
    size,
    scramble: tokens(raw?.scramble),
    moves: tokens(raw?.moves),
    timing: raw?.timing === true,
    elapsed: Number.isFinite(raw?.elapsed) && raw!.elapsed! > 0 ? raw!.elapsed! : 0,
    best,
  };
}

export function mountMagicCube(host: HTMLElement): void {
  unmountMagicCube();
  const saved = loadSaved();
  let size: CubeSize = saved.size;
  let cube: Cube = newCube(size);
  let scrambleTokens = saved.scramble;
  let history: Move[] = [];
  for (const tok of scrambleTokens) applyMove(cube, parseToken(size, tok)!);
  for (const tok of saved.moves) {
    const mv = parseToken(size, tok)!;
    applyMove(cube, mv);
    history.push(mv);
  }
  // A timed attempt: armed by Scramble, the clock runs from the first turn until solved.
  let timing = saved.timing && scrambleTokens.length > 0 && !isSolved(cube);
  let elapsed = timing ? saved.elapsed : 0;
  let clockFrom = 0; // performance.now() when the clock last resumed; 0 while stopped
  const best = saved.best;
  let view: CubeView | null = null;

  const timeEl = h("dd", { "data-out": "time" });
  const movesEl = h("dd", { "data-out": "moves" });
  const bestEl = h("dd", { "data-out": "best" });
  const statusEl = h("p", { class: "mc-status", "aria-live": "polite", "data-out": "status" });
  const sizeSel = h("select", { "data-in": "size" },
    ...CUBE_SIZES.map((n) => h("option", { value: n, selected: n === size }, t(`magicCube.size${n}`)))) as HTMLSelectElement;
  const undoBtn = h("button", { type: "button", class: "btn ghost", "data-act": "undo" }, t("magicCube.undo")) as HTMLButtonElement;

  const now = () => elapsed + (clockFrom ? performance.now() - clockFrom : 0);
  const save = () => writeStore(STORE_KEY, {
    size,
    scramble: scrambleTokens,
    moves: history.map(moveToken),
    timing,
    elapsed: Math.round(now()),
    best,
  } satisfies Saved);

  const render = () => {
    timeEl.textContent = formatTime(now());
    movesEl.textContent = String(history.length);
    const b = best[size];
    bestEl.textContent = b ? formatTime(b.ms) : "—";
    undoBtn.disabled = history.length === 0;
  };
  let ticker = 0;
  const startClock = () => {
    if (clockFrom) return;
    clockFrom = performance.now();
    // The clock reads performance.now(); this only refreshes the display, so it idles in a hidden tab.
    ticker = window.setInterval(() => {
      if (!document.hidden) render();
    }, 100);
  };
  const stopClock = () => {
    if (clockFrom) elapsed += performance.now() - clockFrom;
    clockFrom = 0;
    window.clearInterval(ticker);
    ticker = 0;
  };

  /** A player's turn (drag, key or button): model now, animation queued. */
  const turn = (mv: Move) => {
    applyMove(cube, mv);
    view?.queue(mv);
    if (mv.layer >= 0) history.push(mv);
    if (timing && mv.layer >= 0) startClock();
    if (timing && isSolved(cube)) {
      stopClock();
      timing = false;
      const ms = Math.round(elapsed);
      const prev = best[size];
      const record = !prev || ms < prev.ms;
      if (record) best[size] = { ms, moves: history.length };
      statusEl.textContent = t(record ? "magicCube.solvedBest" : "magicCube.solved", { time: formatTime(ms), moves: history.length });
    } else if (mv.layer >= 0) {
      statusEl.textContent = "";
    }
    save();
    render();
  };

  const undo = () => {
    const mv = history.pop();
    if (!mv) return;
    const back = invertMove(mv);
    applyMove(cube, back);
    view?.queue(back);
    save();
    render();
  };

  const reset = (n: CubeSize) => {
    stopClock();
    size = n;
    cube = newCube(n);
    scrambleTokens = [];
    history = [];
    timing = false;
    elapsed = 0;
    view?.rebuild(cube);
    statusEl.textContent = "";
    save();
    render();
  };

  const doScramble = () => {
    reset(size);
    const moves = scramble(size, cryptoRand);
    for (const mv of moves) applyMove(cube, mv);
    scrambleTokens = moves.map(moveToken);
    timing = true;
    view?.rebuild(cube);
    statusEl.textContent = t("magicCube.scrambled");
    save();
    render();
  };

  // Face keys act with focus in the cube, so the toolbar hands focus back once the cube is playing.
  const focusCube = () => {
    if (view) shell.stage.focus({ preventScroll: true });
  };
  sizeSel.addEventListener("change", () => {
    reset(Number(sizeSel.value) as CubeSize);
    focusCube();
  });
  undoBtn.addEventListener("click", undo);

  const shell: Shell = gameShell({
    label: t("magicCube.stage"),
    intro: t("magicCube.intro"),
    className: "g3d-square",
    async start(el) {
      const stage = await createStage(el, { mode: "demand", background: 0xfdf0f5, fov: 40, onLost: () => lostContext(shell) });
      if (!stage) return null;
      view = buildView(stage, el, () => cube, turn);
      return () => {
        view?.dispose();
        view = null;
        stage.dispose();
      };
    },
  });

  const onKey = (e: KeyboardEvent) => {
    if (!view || e.ctrlKey || e.metaKey || e.altKey || typingTarget(e.target)) return;
    // Only with focus inside the game: page-wide arrows must keep scrolling the page, and letters must not start a solve.
    if (!shell.root.contains(document.activeElement)) return;
    const face = /^Key([UDLRFB])$/.exec(e.code)?.[1] as Face | undefined;
    if (face) {
      e.preventDefault();
      // A held key auto-repeats: one press is one turn.
      if (e.repeat) return;
      turn(faceMove(size, face, e.shiftKey));
      return;
    }
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const a = arrows[e.code];
    if (a) {
      e.preventDefault();
      view.orbit(a[0] * 0.26, a[1] * 0.2);
    }
  };
  window.addEventListener("keydown", onKey);

  const notation = h("details", { class: "mc-notation" },
    h("summary", null, t("magicCube.buttons")),
    h("div", { class: "mc-keys" },
      ...FACES.flatMap((f) => [f, `${f}'`]).map((label) =>
        h("button", {
          type: "button",
          class: "btn ghost mc-key",
          "data-move": label,
          onPointerdown: (e: Event) => e.preventDefault(),
          onClick: () => {
            // Only once the cube is drawn (after Play), like the keys and drags.
            const mv = view ? parseNotation(size, label) : null;
            if (mv) turn(mv);
          },
        }, label)),
    ),
  );

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("magicCube.title")),
      h("p", { class: "lede" }, t("magicCube.privacyNote")),
    ),
    h("div", { class: "mc-game" },
      h("div", { class: "g3d-bar mc-bar" },
        h("label", { class: "field" }, h("span", null, t("magicCube.size")), sizeSel),
        h("button", { type: "button", class: "btn", "data-act": "scramble", onClick: () => { doScramble(); focusCube(); } }, t("magicCube.scramble")),
        undoBtn,
        h("button", { type: "button", class: "btn ghost", "data-act": "reset", onClick: () => { reset(size); focusCube(); } }, t("magicCube.reset")),
        shell.fullscreenButton,
      ),
      h("dl", { class: "stats-grid mc-stats" },
        h("dt", null, t("magicCube.time")), timeEl,
        h("dt", null, t("magicCube.moves")), movesEl,
        h("dt", null, t("magicCube.best")), bestEl,
      ),
      shell.root,
      statusEl,
      notation,
      h("p", { class: "hint", id: "mc-help" }, t("magicCube.hint")),
      creditLine("game3d.credit", "https://threejs.org", "three.js"),
    ),
  );
  shell.stage.setAttribute("aria-describedby", "mc-help");
  if (timing && history.length) statusEl.textContent = t("magicCube.resumed");
  render();

  // A reload or closed tab does not unmount: keep the running clock's time then too.
  // Bank the running clock and save it, then keep it running (hiding the tab does not pause a solve).
  const onPageHide = () => {
    if (!clockFrom) return;
    stopClock();
    save();
    startClock();
  };
  const onHide = () => {
    if (document.hidden) onPageHide();
  };
  window.addEventListener("pagehide", onPageHide);
  document.addEventListener("visibilitychange", onHide);

  mounted = {
    cleanup() {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onHide);
      stopClock();
      // Keep the time since the last turn: the clock resumes from the saved elapsed on the next visit.
      save();
      window.removeEventListener("keydown", onKey);
      shell.dispose();
    },
  };
}

export function unmountMagicCube(): void {
  mounted?.cleanup();
  mounted = null;
}

interface CubeView {
  queue(mv: Move): void;
  rebuild(cube: Cube): void;
  orbit(dTheta: number, dPhi: number): void;
  dispose(): void;
}

interface StickerData {
  cubie: number;
  sticker: number;
}

function buildView(stage: Stage, el: HTMLElement, getCube: () => Cube, turn: (mv: Move) => void): CubeView {
  const { THREE, scene, camera } = stage;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xf3d6e2, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(4, 7, 5);
  scene.add(sun);

  const root = new THREE.Group();
  scene.add(root);
  const bodyGeo = new THREE.BoxGeometry(0.94, 0.94, 0.94);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1d1a1f, roughness: 0.55 });
  const stickerGeo = new THREE.PlaneGeometry(0.8, 0.8);
  const stickerMats = CUBE_COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35 }));

  let groups: Group[] = [];
  let stickers: Mesh[] = [];
  let n = getCube().n;

  const place = (cube: Cube) => {
    const m = new THREE.Matrix4();
    cube.cubies.forEach((q, i) => {
      const g = groups[i]!;
      const r = q.rot;
      m.set(r[0], r[1], r[2], 0, r[3], r[4], r[5], 0, r[6], r[7], r[8], 0, 0, 0, 0, 1);
      g.quaternion.setFromRotationMatrix(m);
      g.position.set(q.pos[0] / 2, q.pos[1] / 2, q.pos[2] / 2);
    });
  };

  const build = (cube: Cube) => {
    for (const g of groups) root.remove(g);
    groups = [];
    stickers = [];
    n = cube.n;
    cube.cubies.forEach((q, i) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(bodyGeo, bodyMat));
      q.stickers.forEach((s, k) => {
        const mesh = new THREE.Mesh(stickerGeo, stickerMats[s.color]!);
        const nrm = new THREE.Vector3(...s.normal);
        mesh.position.copy(nrm).multiplyScalar(0.475);
        mesh.lookAt(nrm.clone().multiplyScalar(2));
        mesh.userData = { cubie: i, sticker: k } satisfies StickerData;
        g.add(mesh);
        stickers.push(mesh);
      });
      root.add(g);
      groups.push(g);
    });
    place(cube);
    radius = n * 2.4 + 2.2;
    updateCamera();
  };

  // Orbit camera around the cube centre.
  let theta = 0.62;
  let phi = 1.02;
  let radius = 9;
  let fitAspect = 0;
  const updateCamera = () => {
    // Further back on a narrow (portrait) stage, e.g. full screen on a phone, so the whole cube stays in view.
    fitAspect = camera.aspect;
    const r = radius * Math.max(1, 1 / (fitAspect || 1));
    camera.position.set(r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.cos(theta));
    camera.lookAt(0, 0, 0);
    stage.invalidate();
  };

  // Turn animation queue: each entry turns the cubies it moved (positions before the move) on a pivot.
  const pending: { mv: Move; members: number[] }[] = [];
  let anim: { mv: Move; pivot: Group; start: number; members: number[] } | null = null;
  /** Model as the screen shows it: a copy that lags the real cube by the queued moves. */
  let shown: Cube = cloneCube(getCube());

  const startNext = () => {
    const next = pending.shift();
    if (!next) {
      anim = null;
      return;
    }
    const pivot = new THREE.Group();
    root.add(pivot);
    for (const i of next.members) pivot.attach(groups[i]!);
    anim = { mv: next.mv, pivot, start: performance.now(), members: next.members };
    stage.invalidate();
  };

  const finish = () => {
    if (!anim) return;
    for (const i of anim.members) root.attach(groups[i]!);
    root.remove(anim.pivot);
    applyMove(shown, anim.mv);
    place(shown);
    anim = null;
    startNext();
  };

  stage.onFrame(() => {
    if (camera.aspect !== fitAspect) updateCamera();
    if (!anim) return;
    const dur = anim.mv.turns === 2 ? TURN_MS * 1.5 : TURN_MS;
    const p = Math.min(1, (performance.now() - anim.start) / dur);
    const eased = 1 - (1 - p) * (1 - p);
    const angle = (anim.mv.turns === 2 ? Math.PI : (anim.mv.turns * Math.PI) / 2) * eased;
    anim.pivot.rotation.set(anim.mv.axis === 0 ? angle : 0, anim.mv.axis === 1 ? angle : 0, anim.mv.axis === 2 ? angle : 0);
    if (p >= 1) finish();
    stage.invalidate();
  });

  // Pointer: drag a sticker to turn its layer, drag elsewhere to orbit.
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let drag: { id: number; x: number; y: number; hit: { cubie: number; normal: Vec; point: Vector3 } | null; done: boolean } | null = null;

  const pick = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(stickers as Object3D[], false)[0];
    if (!hit) return null;
    const data = hit.object.userData as StickerData;
    // Use the model the screen shows (no turn is pending when a drag starts on a still cube).
    const q = shown.cubies[data.cubie]!;
    return { cubie: data.cubie, normal: stickerNormal(q, q.stickers[data.sticker]!), point: hit.point.clone() };
  };

  const toScreen = (v: Vector3) => {
    const p = v.clone().project(camera);
    const r = el.getBoundingClientRect();
    return { x: ((p.x + 1) / 2) * r.width, y: ((1 - p.y) / 2) * r.height };
  };

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    el.setPointerCapture?.(e.pointerId);
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, hit: anim || pending.length ? null : pick(e), done: false };
  };

  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id || drag.done) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.hit) {
      orbit(-dx * 0.008, -dy * 0.008);
      drag.x = e.clientX;
      drag.y = e.clientY;
      return;
    }
    if (Math.hypot(dx, dy) < 12) return;
    const nrm = drag.hit.normal;
    const faceAxis = nrm.findIndex((v) => v !== 0);
    const a0 = drag.hit.point;
    const s0 = toScreen(a0);
    let bestAxis = -1;
    let bestSign = 1;
    let bestScore = 0;
    for (let k = 0; k < 3; k++) {
      if (k === faceAxis) continue;
      const dir = new THREE.Vector3(k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0);
      const s1 = toScreen(a0.clone().add(dir));
      const sx = s1.x - s0.x;
      const sy = s1.y - s0.y;
      const len = Math.hypot(sx, sy) || 1;
      const score = (dx * sx + dy * sy) / len;
      if (Math.abs(score) > Math.abs(bestScore)) {
        bestScore = score;
        bestAxis = k;
        bestSign = score > 0 ? 1 : -1;
      }
    }
    drag.done = true;
    if (bestAxis < 0) return;
    // Rotation axis = normal × drag direction (both axis-aligned unit vectors).
    const tdir: Vec = [0, 0, 0];
    tdir[bestAxis] = bestSign;
    const cross: Vec = [
      nrm[1] * tdir[2] - nrm[2] * tdir[1],
      nrm[2] * tdir[0] - nrm[0] * tdir[2],
      nrm[0] * tdir[1] - nrm[1] * tdir[0],
    ];
    const axis = cross.findIndex((v) => v !== 0) as Axis;
    if (axis < 0) return;
    const q = shown.cubies[drag.hit.cubie]!;
    const layer = (q.pos[axis] + (n - 1)) / 2;
    turn({ axis, layer, turns: cross[axis]! > 0 ? 1 : -1 });
  };

  const onUp = (e: PointerEvent) => {
    if (drag && e.pointerId === drag.id) drag = null;
  };

  const orbit = (dTheta: number, dPhi: number) => {
    theta += dTheta;
    phi = Math.min(Math.PI - 0.25, Math.max(0.25, phi + dPhi));
    updateCamera();
  };

  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);

  build(getCube());

  return {
    queue(mv) {
      pending.push({ mv, members: movedCubies(shownAfterPending(), mv) });
      if (!anim) startNext();
    },
    rebuild(cube) {
      if (anim) {
        root.remove(anim.pivot);
        anim = null;
      }
      pending.length = 0;
      shown = cloneCube(cube);
      build(cube);
    },
    orbit,
    dispose() {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    },
  };

  /** The shown cube with every queued move applied: where cubies will be when a new move starts. */
  function shownAfterPending(): Cube {
    const c = cloneCube(shown);
    if (anim) applyMove(c, anim.mv);
    for (const p of pending) applyMove(c, p.mv);
    return c;
  }
}

