import type { Group } from "three";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { creditLine, cryptoRand, readStore, typingTarget, writeStore } from "../game-input";
import { createStage, gameShell, lostContext, type Shell, type Stage } from "../three-stage";
import { appHref } from "../../shared/path";
import {
  applyMove, applyMoves, cloneCube, CUBE_COLORS, inverse, movedCubies, type Cube, type Move,
} from "../../shared/magic-cube";
import {
  FACE_COLOR, FACE_ORDER, SOLVED, centreIndex, cleanFacelets, colourCounts, parseSolution, randomState, solvedCube, validate,
  type CubeError, type Facelet, type FaceLetter,
} from "../../shared/cube-solver";

/**
 * Cube solver: paint the six faces of a real 3×3 on an unfolded net, check the cube can exist, and get a short
 * solution from cubejs (MIT, Kociemba's two-phase algorithm) in a worker created on the first Solve. The net works
 * without WebGL; the 3D view (three-stage.ts, on Play) steps through the solution. Painted state in
 * `cvcm.cubesolver.v1`.
 */

const STORE_KEY = "cvcm.cubesolver.v1";
const STEP_MS = 650;
const TURN_MS = 260;
/** Top-left (row, col) of each face in the 9 × 12 net grid: U above F, then L F R B, D below F. */
const FACE_AT: Record<FaceLetter, [number, number]> = { U: [0, 3], L: [3, 0], F: [3, 3], R: [3, 6], B: [3, 9], D: [6, 3] };

let mounted: { cleanup: () => void } | null = null;

function cellOf(i: number): [number, number] {
  const face = FACE_ORDER[Math.floor(i / 9)]!;
  const [r0, c0] = FACE_AT[face];
  return [r0 + Math.floor((i % 9) / 3), c0 + (i % 3)];
}

function hex(c: number): string {
  return `#${c.toString(16).padStart(6, "0")}`;
}

export function errorText(err: CubeError): string {
  switch (err.kind) {
    case "blank": return t("cubeSolver.e_blank", { n: err.n });
    case "count": return t("cubeSolver.e_count", { n: err.n, colour: t(`cubeSolver.c_${err.face}`) });
    default: return t(`cubeSolver.e_${err.kind}`);
  }
}

export function mountCubeSolver(host: HTMLElement): void {
  unmountCubeSolver();
  const raw = readStore<{ facelets?: unknown; colour?: unknown }>(STORE_KEY);
  // First visit: a solved cube (rule 8: the same page before and after mount).
  let facelets: string = cleanFacelets(raw?.facelets) ?? SOLVED;
  let colour: FaceLetter = (FACE_ORDER as readonly string[]).includes(String(raw?.colour)) ? (raw!.colour as FaceLetter) : "U";
  let focusIdx = 0;
  const save = () => writeStore(STORE_KEY, { facelets, colour });

  // Solution state.
  let solution: { tokens: string[]; moves: Move[]; start: Cube } | null = null;
  let step = 0;
  let playTimer = 0;

  // ---- palette
  const countEls = new Map<FaceLetter, HTMLElement>();
  const swatches = FACE_ORDER.map((f, k) => {
    const count = h("span", { class: "cs-count" });
    countEls.set(f, count);
    const b = h("button", {
      type: "button",
      class: "cs-swatch",
      "data-c": f,
      "aria-pressed": String(f === colour),
      title: `${k + 1}`,
      onClick: () => pickColour(f),
    }, h("span", { class: "cs-dot", style: { background: hex(FACE_COLOR[f]) }, "aria-hidden": "true" }), t(`cubeSolver.c_${f}`), count);
    return b;
  });
  const palette = h("div", { class: "cs-palette", role: "group", "aria-label": t("cubeSolver.palette") }, ...swatches);

  // ---- net
  const stickerEls: HTMLButtonElement[] = [];
  const net = h("div", { class: "cs-net", role: "group", "aria-label": t("cubeSolver.net") });
  for (let i = 0; i < 54; i++) {
    const [r, c] = cellOf(i);
    const centre = i % 9 === 4;
    const b = h("button", {
      type: "button",
      class: `cs-sticker${centre ? " cs-centre" : ""}`,
      "data-i": String(i),
      tabindex: i === focusIdx ? 0 : -1,
      "aria-disabled": centre ? "true" : null,
      style: { gridRow: String(r + 1), gridColumn: String(c + 1) },
      onClick: () => paint(i),
    }) as HTMLButtonElement;
    stickerEls.push(b);
    net.append(b);
  }

  const statusEl = h("p", { class: "cs-status", "aria-live": "polite", "data-out": "status" });

  // ---- solution panel
  const movesEl = h("ol", { class: "cs-moves", "aria-label": t("cubeSolver.movesLabel") });
  const stepEl = h("p", { class: "cs-step", "data-out": "step" });
  const btnStart = h("button", { type: "button", class: "btn ghost", "data-act": "to-start", onClick: () => { stopPlay(); goTo(0); } }, t("cubeSolver.toStart")) as HTMLButtonElement;
  const btnPrev = h("button", { type: "button", class: "btn ghost", "data-act": "prev", onClick: () => { stopPlay(); goTo(step - 1); } }, t("cubeSolver.prev")) as HTMLButtonElement;
  const btnNext = h("button", { type: "button", class: "btn ghost", "data-act": "next", onClick: () => { stopPlay(); goTo(step + 1); } }, t("cubeSolver.next")) as HTMLButtonElement;
  const btnPlay = h("button", { type: "button", class: "btn", "data-act": "play-moves", onClick: () => togglePlay() }, t("cubeSolver.playMoves")) as HTMLButtonElement;

  // ---- 3D view (on Play)
  let view: SolveView | null = null;
  const shell: Shell = gameShell({
    label: t("cubeSolver.stage"),
    intro: t("cubeSolver.intro"),
    className: "g3d-square cs-root",
    async start(stageEl) {
      const stage = await createStage(stageEl, { mode: "demand", fov: 40, near: 0.1, far: 100, background: 0xfdf0f5, onLost: () => { view = null; lostContext(shell); } });
      if (!stage) return null;
      view = buildView(stage, stageEl);
      view.show(stateAt(step));
      return () => {
        view?.dispose();
        view = null;
        stage.dispose();
      };
    },
  });
  const solutionBox = h("section", { class: "cs-solution", "aria-labelledby": "cs-solution-title", hidden: true },
    h("h2", { id: "cs-solution-title" }, t("cubeSolver.solutionTitle")),
    h("p", { class: "hint" }, t("cubeSolver.holdNote")),
    movesEl,
    h("div", { class: "g3d-bar cs-steps" }, btnStart, btnPrev, btnNext, btnPlay, shell.fullscreenButton),
    stepEl,
    shell.root,
  );

  // ---- worker (first Solve)
  let worker: Worker | null = null;
  let reqId = 0;
  let solving = false;
  const solveBtn = h("button", { type: "button", class: "btn", "data-act": "solve", onClick: () => solve() }, t("cubeSolver.solve")) as HTMLButtonElement;

  const ensureWorker = (): Worker => {
    if (worker) return worker;
    worker = new Worker(new URL("./solver.worker.ts", import.meta.url), { type: "module", name: "cvcm-cube-solver" });
    worker.onmessage = (e: MessageEvent<{ id?: number; ready?: boolean; solution?: string; error?: string }>) => {
      const d = e.data;
      if (d.ready) {
        if (solving) statusEl.textContent = t("cubeSolver.solving");
        return;
      }
      if (d.id !== reqId) return;
      solving = false;
      solveBtn.disabled = false;
      if (d.error !== undefined || d.solution === undefined) {
        statusEl.textContent = t("cubeSolver.failed");
        return;
      }
      showSolution(d.solution);
    };
    worker.onerror = () => {
      solving = false;
      solveBtn.disabled = false;
      statusEl.textContent = t("cubeSolver.failed");
      worker?.terminate();
      worker = null;
    };
    return worker;
  };

  function solve() {
    const err = validate(facelets);
    if (err) {
      clearSolution();
      statusEl.textContent = errorText(err);
      return;
    }
    if (facelets === SOLVED) {
      clearSolution();
      statusEl.textContent = t("cubeSolver.already");
      return;
    }
    let w: Worker;
    try {
      w = ensureWorker();
    } catch {
      statusEl.textContent = t("cubeSolver.failed");
      return;
    }
    solving = true;
    solveBtn.disabled = true;
    statusEl.textContent = t("cubeSolver.preparing");
    reqId++;
    w.postMessage({ id: reqId, facelets });
  }

  function showSolution(text: string) {
    let parsed: { tokens: string[]; moves: Move[] };
    try {
      parsed = parseSolution(text);
    } catch {
      statusEl.textContent = t("cubeSolver.failed");
      return;
    }
    const start = solvedCube();
    applyMoves(start, inverse(parsed.moves));
    solution = { ...parsed, start };
    step = 0;
    statusEl.textContent = t("cubeSolver.solved", { n: parsed.tokens.length });
    movesEl.replaceChildren(...parsed.tokens.map((tok, k) => h("li", { "data-k": String(k) }, tok)));
    solutionBox.hidden = false;
    view?.show(stateAt(0));
    renderStep();
  }

  function clearSolution() {
    stopPlay();
    solution = null;
    step = 0;
    solutionBox.hidden = true;
    reqId++;
    solving = false;
    solveBtn.disabled = false;
  }

  /** The cube after the first `k` solution moves (the painted cube at 0). */
  function stateAt(k: number): Cube {
    if (!solution) return solvedCube();
    const c = cloneCube(solution.start);
    applyMoves(c, solution.moves.slice(0, k));
    return c;
  }

  function goTo(k: number) {
    if (!solution) return;
    const target = Math.max(0, Math.min(solution.moves.length, k));
    if (target === step) return;
    if (view) {
      if (target === step + 1) view.animate(solution.moves[step]!);
      else if (target === step - 1) view.animate(inverse([solution.moves[target]!])[0]!);
      else view.show(stateAt(target));
    }
    step = target;
    renderStep();
  }

  function togglePlay() {
    if (playTimer) return stopPlay();
    if (!solution) return;
    if (step >= solution.moves.length) goTo(0);
    btnPlay.textContent = t("cubeSolver.pauseMoves");
    playTimer = window.setInterval(() => {
      if (!solution || step >= solution.moves.length) return stopPlay();
      goTo(step + 1);
    }, STEP_MS);
  }

  function stopPlay() {
    if (playTimer) window.clearInterval(playTimer);
    playTimer = 0;
    btnPlay.textContent = t("cubeSolver.playMoves");
  }

  function renderStep() {
    if (!solution) return;
    const n = solution.moves.length;
    stepEl.textContent = step === 0
      ? t("cubeSolver.stepStart", { n })
      : t("cubeSolver.step", { k: step, n, move: solution.tokens[step - 1]! });
    movesEl.querySelectorAll("li").forEach((li, k) => li.classList.toggle("on", k === step - 1));
    btnStart.disabled = btnPrev.disabled = step === 0;
    btnNext.disabled = step >= n;
  }

  // ---- painting
  function render() {
    stickerEls.forEach((b, i) => {
      const f = facelets[i] as Facelet;
      b.dataset.c = f;
      b.style.background = f === "?" ? "" : hex(FACE_COLOR[f]);
      const face = t(`cubeSolver.f_${FACE_ORDER[Math.floor(i / 9)]!}`);
      const col = f === "?" ? t("cubeSolver.blank") : t(`cubeSolver.c_${f}`);
      b.setAttribute("aria-label", i % 9 === 4 ? t("cubeSolver.centreLabel", { face, colour: col }) : t("cubeSolver.stickerLabel", { face, n: (i % 9) + 1, colour: col }));
    });
    const counts = colourCounts(facelets);
    for (const f of FACE_ORDER) {
      countEls.get(f)!.textContent = t("cubeSolver.count", { n: counts[f] });
      countEls.get(f)!.classList.toggle("cs-off", counts[f] !== 9);
    }
    swatches.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.c === colour)));
  }

  function changed() {
    clearSolution();
    statusEl.textContent = "";
    save();
    render();
  }

  function paint(i: number) {
    if (i % 9 === 4) return;
    focusIdx = i;
    stickerEls.forEach((b, k) => b.setAttribute("tabindex", k === i ? "0" : "-1"));
    if (facelets[i] === colour) return;
    facelets = facelets.slice(0, i) + colour + facelets.slice(i + 1);
    changed();
  }

  function pickColour(f: FaceLetter) {
    colour = f;
    save();
    render();
  }

  const fill = (text: string) => {
    facelets = text;
    changed();
  };
  const clearBtn = h("button", { type: "button", class: "btn ghost", "data-act": "clear", onClick: () => {
    const chars = "?".repeat(54).split("");
    FACE_ORDER.forEach((f, k) => { chars[centreIndex(k)] = f; });
    fill(chars.join(""));
  } }, t("cubeSolver.clear"));
  const randomBtn = h("button", { type: "button", class: "btn ghost", "data-act": "random", onClick: () => {
    fill(randomState(cryptoRand));
  } }, t("cubeSolver.random"));
  const resetBtn = h("button", { type: "button", class: "btn ghost", "data-act": "reset", onClick: () => fill(SOLVED) }, t("cubeSolver.reset"));

  // Keys: 1–6 pick a colour, arrows move between stickers; only with focus in the palette or the net.
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || typingTarget(e.target)) return;
    const target = e.target as Node | null;
    if (!target || !(net.contains(target) || palette.contains(target))) return;
    if (/^[1-6]$/.test(e.key)) {
      e.preventDefault();
      if (!e.repeat) pickColour(FACE_ORDER[Number(e.key) - 1]!);
      return;
    }
    if (!net.contains(target)) return;
    const dirs: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const d = dirs[e.key];
    if (!d) return;
    e.preventDefault();
    const [r, c] = cellOf(focusIdx);
    // Walk in that direction to the next cell that holds a sticker (the net has gaps).
    for (let s = 1; s < 12; s++) {
      const rr = r + d[0] * s, cc = c + d[1] * s;
      if (rr < 0 || rr > 8 || cc < 0 || cc > 11) break;
      const j = stickerEls.findIndex((_, k) => { const p = cellOf(k); return p[0] === rr && p[1] === cc; });
      if (j >= 0) {
        focusIdx = j;
        stickerEls.forEach((b, k) => b.setAttribute("tabindex", k === j ? "0" : "-1"));
        stickerEls[j]!.focus();
        break;
      }
    }
  };
  host.addEventListener("keydown", onKey);

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("cubeSolver.title")),
      h("p", { class: "lede" }, t("cubeSolver.privacyNote")),
    ),
    palette,
    net,
    h("div", { class: "g3d-bar cs-bar" }, solveBtn, randomBtn, clearBtn, resetBtn),
    statusEl,
    h("p", { class: "hint" }, t("cubeSolver.hint")),
    solutionBox,
    h("p", { class: "more" }, h("a", { href: appHref(locale(), "magic-cube"), "data-nav": "magic-cube" }, t("cubeSolver.practise"))),
    creditLine("cubeSolver.credit", "https://github.com/ldez/cubejs", "cubejs"),
    creditLine("game3d.credit", "https://threejs.org", "three.js"),
  );
  render();

  mounted = {
    cleanup() {
      stopPlay();
      host.removeEventListener("keydown", onKey);
      worker?.terminate();
      worker = null;
      shell.dispose();
    },
  };
}

export function unmountCubeSolver(): void {
  mounted?.cleanup();
  mounted = null;
}

interface SolveView {
  show(cube: Cube): void;
  animate(mv: Move): void;
  dispose(): void;
}

/** The 3D cube for the solution steps: rebuild to a state, or animate one turn (queued). Drag or arrows orbit. */
function buildView(stage: Stage, el: HTMLElement): SolveView {
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
  let shown: Cube = solvedCube();
  const queue: Move[] = [];
  let anim: { mv: Move; pivot: Group; start: number; members: number[] } | null = null;

  const place = (cube: Cube) => {
    const m = new THREE.Matrix4();
    cube.cubies.forEach((q, i) => {
      const r = q.rot;
      m.set(r[0], r[1], r[2], 0, r[3], r[4], r[5], 0, r[6], r[7], r[8], 0, 0, 0, 0, 1);
      groups[i]!.quaternion.setFromRotationMatrix(m);
      groups[i]!.position.set(q.pos[0] / 2, q.pos[1] / 2, q.pos[2] / 2);
    });
  };

  const build = (cube: Cube) => {
    for (const g of groups) root.remove(g);
    groups = cube.cubies.map((q) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(bodyGeo, bodyMat));
      for (const s of q.stickers) {
        const mesh = new THREE.Mesh(stickerGeo, stickerMats[s.color]!);
        const nrm = new THREE.Vector3(...s.normal);
        mesh.position.copy(nrm).multiplyScalar(0.475);
        mesh.lookAt(nrm.clone().multiplyScalar(2));
        g.add(mesh);
      }
      root.add(g);
      return g;
    });
    place(cube);
  };

  let theta = 0.62;
  let phi = 1.02;
  let fitAspect = 0;
  const updateCamera = () => {
    fitAspect = camera.aspect;
    const r = 9.4 * Math.max(1, 1 / (fitAspect || 1));
    camera.position.set(r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.cos(theta));
    camera.lookAt(0, 0, 0);
    stage.invalidate();
  };
  const orbit = (dt: number, dp: number) => {
    theta += dt;
    phi = Math.min(Math.PI - 0.25, Math.max(0.25, phi + dp));
    updateCamera();
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
  const startNext = () => {
    const mv = queue.shift();
    if (!mv) return;
    const members = movedCubies(shown, mv);
    const pivot = new THREE.Group();
    root.add(pivot);
    for (const i of members) pivot.attach(groups[i]!);
    anim = { mv, pivot, start: performance.now(), members };
    stage.invalidate();
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

  // Drag to look around; arrows with the stage focused.
  let drag: { id: number; x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => {
    el.setPointerCapture?.(e.pointerId);
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onMove = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    orbit(-(e.clientX - drag.x) * 0.008, -(e.clientY - drag.y) * 0.008);
    drag.x = e.clientX;
    drag.y = e.clientY;
  };
  const onUp = () => { drag = null; };
  const onKey = (e: KeyboardEvent) => {
    const a: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const d = a[e.key];
    if (!d || e.target !== el) return;
    e.preventDefault();
    orbit(d[0] * 0.26, d[1] * 0.2);
  };
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
  el.addEventListener("keydown", onKey);

  build(shown);
  updateCamera();

  return {
    show(cube) {
      queue.length = 0;
      if (anim) {
        for (const i of anim.members) root.attach(groups[i]!);
        root.remove(anim.pivot);
        anim = null;
      }
      shown = cloneCube(cube);
      build(shown);
      stage.invalidate();
    },
    animate(mv) {
      queue.push(mv);
      if (!anim) startNext();
    },
    dispose() {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("keydown", onKey);
    },
  };
}

