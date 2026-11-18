/*! @license Uses chess.js (https://github.com/jhlywa/chess.js) — Copyright (c) 2025, Jeff Hlywa. BSD-2-Clause. THIS SOFTWARE IS PROVIDED "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES ARE DISCLAIMED. */
import { Chess, type Move, type PieceSymbol, type Square } from "chess.js";
import type { Group, Material, Mesh, Object3D, Vector3 } from "three";
import { h } from "../dom";
import { t } from "../i18n";
import { creditLine, readStore, typingTarget, writeStore } from "../game-input";
import { createStage, coarsePointer, gameShell, lostContext, type Stage } from "../three-stage";
import { Engine, LEVELS, type LevelIndex } from "../chess/engine";
import { endReason, replay, uci } from "../chess/rules";
import {
  KNIGHT_HEAD,
  PHI_HOME,
  PROFILES,
  cameraRadius,
  clampPhi,
  homeTheta,
  parseSaved,
  squareToWorld,
  stepCursor,
  type Mode,
  type Side,
  type Sq,
} from "../../shared/chess3d";

/**
 * Chess on a 3D board (games3d group). Rules come from chess.js and the computer is the chess page's Stockfish.js
 * worker (src/client/chess/engine.ts, GPL-3.0); both load nothing until play. The page mounts DOM only: the board,
 * three.js and the engine start on Play (three-stage.ts). Pieces are turned (LatheGeometry) shapes; the knight's head
 * is an extruded side profile. Saved as UCI moves in `cvcm.chess3d.v1`.
 */

const STORE_KEY = "cvcm.chess3d.v1";
const PIECES_2D = "/assets/games/chess/pieces";
const MOVE_MS = 220;
const BOARD_TOP = 0.06;

let mounted: { cleanup: () => void } | null = null;

type View = {
  stage: Stage;
  squares: Mesh[];
  pieces: Map<Square, { group: Group; key: string }>;
  marks: Group;
  cursorMark: Mesh;
  anims: { group: Group; from: Vector3; to: Vector3; lift: number; start: number }[];
  theta: number;
  phi: number;
  make(color: Side, type: PieceSymbol): Group;
  dispose(): void;
};

export function mountChess3d(host: HTMLElement): void {
  unmountChess3d();
  const saved = parseSaved(readStore(STORE_KEY), LEVELS.length);
  let mode: Mode = saved.mode;
  let level = saved.level as LevelIndex;
  let side: Side = saved.side;
  let game = replay(saved.moves);
  // chess.js history() undoes and replays the whole game, so it is read once per change (`version`), not per paint.
  let version = 0;
  let seen = -1;
  let verbose: Move[] = [];
  const moves = (): Move[] => {
    if (seen !== version) {
      verbose = game.history({ verbose: true });
      seen = version;
    }
    return verbose;
  };
  let selected: Square | null = null;
  let promo: { from: Square; to: Square } | null = null;
  let thinking = false;
  let generation = 0;
  let engineFailed = false;
  let started = false;
  let cursor: Sq = side === "b" && mode === "computer" ? "e7" : "e2";
  let showCursor = false;
  let view: View | null = null;
  const engine = new Engine();

  const select = <T extends string | number>(field: string, values: readonly T[], value: T, label: (v: T) => string, onChange: (v: T) => void) => {
    const el = h("select", { "data-field": field, onChange: () => onChange(values[el.selectedIndex]!) },
      ...values.map((v) => h("option", { value: String(v), selected: v === value }, label(v))));
    return el;
  };
  const modeSel = select("mode", ["computer", "friend"] as const, mode, (m) => t(`chess.m_${m}`), (m) => { stopEngine(); promo = null; promoEl.hidden = true; mode = m; sync(); save(); paint(); queue(); });
  const levelSel = select("level", [0, 1, 2, 3, 4] as const, level, (l) => t(`chess.l_${l}`), (l) => { level = l as LevelIndex; save(); });
  const sideSel = select("side", ["w", "b"] as const, side, (s) => t(s === "w" ? "chess.playWhite" : "chess.playBlack"), (s) => { side = s; newGame(); });
  const levelField = h("label", { class: "field" }, h("span", null, t("chess.level")), levelSel);
  const sideField = h("label", { class: "field" }, h("span", null, t("chess.side")), sideSel);
  const statusEl = h("p", { class: "c3-status", "aria-live": "polite", "data-out": "status" });
  const hudEl = h("p", { class: "g3d-hud c3-hud", "aria-hidden": "true" });
  const cursorLive = h("p", { class: "sr-only", "aria-live": "polite" });
  const movesEl = h("ol", { class: "c3-moves", "data-out": "moves" });
  const promoEl = h("div", { class: "c3-promo", hidden: true, role: "dialog", "aria-label": t("chess.promote") });
  const undoBtn = h("button", { type: "button", class: "btn ghost", "data-action": "undo", onClick: () => undo() }, t("chess.undo")) as HTMLButtonElement;
  const flipBtn = h("button", { type: "button", class: "btn ghost", "data-action": "flip", onClick: () => flip() }, t("chess3d.flip")) as HTMLButtonElement;

  const computerTurn = () => mode === "computer" && game.turn() !== side && !game.isGameOver();
  const save = () => writeStore(STORE_KEY, { moves: moves().map(uci), mode, level, side });
  const pieceName = (sq: Square) => {
    const p = game.get(sq);
    return p ? t(`chess.p_${p.color}${p.type}`) : t("chess.empty");
  };

  const shell = gameShell({
    label: t("chess3d.stage"),
    intro: t("chess3d.intro"),
    className: "g3d-square c3-root",
    start: async (stageEl) => {
      const stage = await createStage(stageEl, { mode: "demand", fov: 40, near: 0.1, far: 100, background: 0xfdf0f5, onLost: () => lostContext(shell) });
      if (!stage) return null;
      view = buildView(stage, mode === "computer" ? side : "w");
      started = true;
      reconcile();
      paint();
      queue();
      const offInput = bindInput(stageEl);
      return () => {
        offInput();
        view?.dispose();
        view = null;
        started = false;
        stopEngine();
      };
    },
  });
  shell.root.append(promoEl, hudEl);

  /** Puts every piece mesh where the game has it, keeping the ones already right (after undo, load, new game). */
  const reconcile = () => {
    if (!view) return;
    const want = new Map<Square, string>();
    for (const row of game.board()) for (const p of row) if (p) want.set(p.square, `${p.color}${p.type}`);
    for (const [sq, item] of view.pieces) {
      if (want.get(sq) !== item.key) {
        item.group.removeFromParent();
        view.pieces.delete(sq);
      }
    }
    for (const [sq, key] of want) {
      if (view.pieces.has(sq)) continue;
      const group = view.make(key[0] as Side, key[1] as PieceSymbol);
      const { x, z } = squareToWorld(sq as Sq);
      group.position.set(x, BOARD_TOP, z);
      group.userData.sq = sq;
      view.stage.scene.add(group);
      view.pieces.set(sq, { group, key });
    }
    view.stage.invalidate();
  };

  /** Moves the meshes of one move with a short slide (castling rook too, en passant capture removed), then reconciles. */
  const animateMove = (m: Move) => {
    if (!view) return;
    const v = view;
    const slide = (from: Square, to: Square) => {
      const item = v.pieces.get(from);
      if (!item) return;
      v.pieces.get(to)?.group.removeFromParent();
      v.pieces.delete(from);
      const a = squareToWorld(from as Sq);
      const b = squareToWorld(to as Sq);
      const fromV = item.group.position.clone().set(a.x, BOARD_TOP, a.z);
      const toV = item.group.position.clone().set(b.x, BOARD_TOP, b.z);
      item.group.userData.sq = to;
      v.anims.push({ group: item.group, from: fromV, to: toV, lift: item.key[1] === "n" ? 0.6 : 0.12, start: performance.now() });
      v.pieces.set(to, item);
    };
    if (m.flags.includes("e")) {
      const cap = `${m.to[0]}${m.from[1]}` as Square;
      v.pieces.get(cap)?.group.removeFromParent();
      v.pieces.delete(cap);
    }
    slide(m.from, m.to);
    if (m.flags.includes("k")) slide(`h${m.from[1]}` as Square, `f${m.from[1]}` as Square);
    if (m.flags.includes("q")) slide(`a${m.from[1]}` as Square, `d${m.from[1]}` as Square);
    // A promoting pawn slides as a pawn; reconcile() swaps in the new piece at the end of the slide.
    v.stage.invalidate();
  };

  const paint = () => {
    const end = endReason(game);
    let text: string;
    if (engineFailed) text = t("chess.engineFailed");
    else if (end) text = t(`chess.${end}`);
    else if (thinking) text = t("chess.thinking");
    else {
      const who = game.turn() === "w" ? t("chess.white") : t("chess.black");
      text = game.inCheck() ? t("chess.check", { side: who }) : t("chess.toMove", { side: who });
    }
    statusEl.textContent = text;
    hudEl.textContent = text;
    const sans = moves().map((m) => m.san);
    movesEl.replaceChildren(...Array.from({ length: Math.ceil(sans.length / 2) }, (_, i) =>
      h("li", null, sans[i * 2]!, sans[i * 2 + 1] ? ` ${sans[i * 2 + 1]}` : "")));
    movesEl.scrollTop = movesEl.scrollHeight;
    undoBtn.disabled = !sans.length;
    paintMarks();
  };

  /** Square marks: selection, legal targets (disc) and captures (ring), last move, king in check, keyboard cursor. */
  const paintMarks = () => {
    if (!view) return;
    const { THREE } = view.stage;
    const marks = view.marks;
    marks.clear();
    const flat = (sq: Square, color: number, opacity: number, y = BOARD_TOP + 0.004) => {
      const m = new THREE.Mesh(MARK_GEOS.plane!, markMaterial(THREE, color, opacity));
      const { x, z } = squareToWorld(sq as Sq);
      m.position.set(x, y, z);
      marks.add(m);
    };
    const last = moves().at(-1);
    if (last) {
      flat(last.from, 0xf4a9c6, 0.45);
      flat(last.to, 0xf4a9c6, 0.45);
    }
    if (game.inCheck()) {
      const king = game.board().flat().find((p) => p?.type === "k" && p.color === game.turn());
      if (king) flat(king.square, 0xe5484d, 0.6, BOARD_TOP + 0.006);
    }
    if (selected) {
      flat(selected, 0xc2336c, 0.55, BOARD_TOP + 0.008);
      for (const m of game.moves({ square: selected, verbose: true })) {
        const { x, z } = squareToWorld(m.to as Sq);
        const capture = !!game.get(m.to) || m.flags.includes("e");
        const mesh = new THREE.Mesh(capture ? MARK_GEOS.ring! : MARK_GEOS.disc!, markMaterial(THREE, 0xa42a5b, 0.8));
        mesh.position.set(x, BOARD_TOP + 0.02, z);
        marks.add(mesh);
      }
    }
    view.cursorMark.visible = showCursor;
    const c = squareToWorld(cursor);
    view.cursorMark.position.set(c.x, BOARD_TOP + 0.012, c.z);
    view.stage.invalidate();
  };

  const play = (from: Square, to: Square, promotion?: PieceSymbol) => {
    let move: Move;
    try {
      move = game.move({ from, to, promotion });
      version++;
    } catch {
      return false;
    }
    selected = null;
    animateMove(move);
    save();
    paint();
    queue();
    return true;
  };

  const askPromotion = (from: Square, to: Square) => {
    promo = { from, to };
    const color = game.turn();
    const close = () => {
      promo = null;
      promoEl.hidden = true;
      shell.stage.focus({ preventScroll: true });
    };
    promoEl.replaceChildren(
      ...(["q", "r", "b", "n"] as const).map((p) =>
        h("button", { type: "button", class: "c3-promo-btn", "data-promo": p, "aria-label": t(`chess.p_${color}${p}`), onClick: () => {
          close();
          play(from, to, p);
        } }, h("img", { src: `${PIECES_2D}/${p}${color === "w" ? "l" : "d"}.svg`, alt: "" }))),
      h("button", { type: "button", class: "btn ghost", onClick: () => { close(); selected = null; paint(); } }, t("chess.cancel")),
    );
    promoEl.hidden = false;
    (promoEl.querySelector("button") as HTMLButtonElement | null)?.focus();
    paint();
  };

  const tap = (sq: Square) => {
    cursor = sq as Sq;
    if (computerTurn() || game.isGameOver() || promo) return paint();
    const piece = game.get(sq);
    if (selected) {
      const move = game.moves({ square: selected, verbose: true }).find((m) => m.to === sq);
      if (move) {
        if (move.promotion) askPromotion(selected, sq);
        else play(selected, sq);
        return;
      }
    }
    selected = piece && piece.color === game.turn() && sq !== selected ? sq : null;
    paint();
  };

  const queue = () => {
    // The engine downloads only once the 3D board is running (after Play), never at mount.
    if (!started || !computerTurn()) return;
    const gen = ++generation;
    thinking = true;
    paint();
    void engine.bestMove(game.fen(), level).then((best) => {
      if (gen !== generation) return;
      thinking = false;
      engineFailed = engine.failed;
      if (best) {
        try {
          const move = game.move({ from: best.slice(0, 2), to: best.slice(2, 4), promotion: best[4] });
          version++;
          animateMove(move);
        } catch {
          // An answer for another position; ignore it.
        }
        save();
      }
      paint();
    });
  };

  const stopEngine = () => {
    generation++;
    thinking = false;
    engine.cancel();
  };

  const undo = () => {
    stopEngine();
    promo = null;
    promoEl.hidden = true;
    selected = null;
    game.undo();
    if (mode === "computer" && game.turn() !== side && game.history().length) game.undo();
    version++;
    save();
    reconcile();
    paint();
    queue();
  };

  const newGame = () => {
    stopEngine();
    game = new Chess();
    version++;
    selected = null;
    promo = null;
    promoEl.hidden = true;
    engineFailed = false;
    cursor = side === "b" && mode === "computer" ? "e7" : "e2";
    if (view) {
      view.theta = homeTheta(mode === "computer" ? side : "w");
      view.phi = PHI_HOME;
    }
    save();
    reconcile();
    paint();
    queue();
  };

  const flip = () => {
    if (!view) return;
    view.theta += Math.PI;
    view.stage.invalidate();
  };

  const sync = () => {
    levelField.hidden = mode !== "computer";
    sideField.hidden = mode !== "computer";
  };

  /** Pointer taps pick squares; a drag (over ~6 px) or a second finger turns the view. Arrows + Enter on focus. */
  function bindInput(stageEl: HTMLElement): () => void {
    const pointers = new Map<number, { x: number; y: number; sx: number; sy: number }>();
    let dragged = false;
    const down = (e: PointerEvent) => {
      if (e.button > 0) return;
      stageEl.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
      if (pointers.size > 1) dragged = true;
      else dragged = false;
    };
    const move = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      if (!p || !view) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (!dragged && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 6) return;
      dragged = true;
      // Two fingers move the view at half speed each, so it turns as fast as one finger.
      const k = 1 / pointers.size;
      view.theta -= dx * 0.008 * k;
      view.phi = clampPhi(view.phi - dy * 0.006 * k);
      view.stage.invalidate();
    };
    const up = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      pointers.delete(e.pointerId);
      if (!p || dragged || pointers.size) return;
      const sq = pick(e.clientX, e.clientY);
      if (sq) {
        showCursor = false;
        tap(sq);
      }
    };
    const cancel = (e: PointerEvent) => pointers.delete(e.pointerId);
    const key = (e: KeyboardEvent) => {
      if (typingTarget(e.target)) return;
      if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        showCursor = true;
        cursor = stepCursor(cursor, e.key, view?.theta ?? 0);
        cursorLive.textContent = t("chess3d.cursor", { square: cursor, piece: pieceName(cursor) });
        paintMarks();
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        showCursor = true;
        tap(cursor);
        cursorLive.textContent = t("chess3d.cursor", { square: cursor, piece: pieceName(cursor) });
      } else if (e.key === "Escape" && selected) {
        selected = null;
        paint();
      }
    };
    stageEl.addEventListener("pointerdown", down);
    stageEl.addEventListener("pointermove", move);
    stageEl.addEventListener("pointerup", up);
    stageEl.addEventListener("pointercancel", cancel);
    stageEl.addEventListener("keydown", key);
    return () => {
      stageEl.removeEventListener("pointerdown", down);
      stageEl.removeEventListener("pointermove", move);
      stageEl.removeEventListener("pointerup", up);
      stageEl.removeEventListener("pointercancel", cancel);
      stageEl.removeEventListener("keydown", key);
    };
  }

  /** The square under a screen point: a piece hit counts for its square, else the board square. */
  function pick(clientX: number, clientY: number): Square | null {
    if (!view) return null;
    const { THREE, camera, canvas } = view.stage;
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    const targets: Object3D[] = [...view.squares, ...[...view.pieces.values()].map((p) => p.group)];
    for (const hit of ray.intersectObjects(targets, true)) {
      let o: Object3D | null = hit.object;
      while (o && !o.userData.sq) o = o.parent;
      if (o?.userData.sq) return o.userData.sq as Square;
    }
    return null;
  }

  /** Builds the board, lights, shared piece geometry and the frame loop on a new stage. */
  function buildView(stage: Stage, viewSide: Side): View {
    const { THREE, scene, renderer, camera } = stage;
    const shadows = !coarsePointer();
    renderer.shadowMap.enabled = shadows;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xf2dbe5, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(4, 11, 6);
    if (shadows) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
      sun.shadow.camera.updateProjectionMatrix();
    }
    scene.add(sun);

    const light = new THREE.MeshStandardMaterial({ color: 0xfff7fa, roughness: 0.7 });
    const dark = new THREE.MeshStandardMaterial({ color: 0xe7a3bf, roughness: 0.7 });
    const squareGeo = new THREE.BoxGeometry(1, 0.12, 1);
    const squares: Mesh[] = [];
    for (let f = 0; f < 8; f++) {
      for (let r = 0; r < 8; r++) {
        const m = new THREE.Mesh(squareGeo, (f + r) % 2 ? light : dark);
        m.position.set(f - 3.5, 0, 3.5 - r);
        m.receiveShadow = shadows;
        m.userData.sq = `${"abcdefgh"[f]}${r + 1}`;
        scene.add(m);
        squares.push(m);
      }
    }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.2, 8.8), new THREE.MeshStandardMaterial({ color: 0xa42a5b, roughness: 0.6 }));
    frame.position.y = -0.05;
    frame.receiveShadow = shadows;
    scene.add(frame);

    MARK_GEOS.plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    MARK_GEOS.disc = new THREE.CylinderGeometry(0.13, 0.13, 0.02, 24);
    MARK_GEOS.ring = new THREE.TorusGeometry(0.4, 0.035, 8, 32).rotateX(Math.PI / 2);
    const marks = new THREE.Group();
    scene.add(marks);
    const cursorMark = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.48, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2e2229 }));
    cursorMark.visible = false;
    scene.add(cursorMark);

    markMats.clear();
    const segments = coarsePointer() ? 16 : 28;
    const geos = new Map<PieceSymbol, ReturnType<typeof lathe>>();
    function lathe(type: PieceSymbol) {
      return new THREE.LatheGeometry(PROFILES[type].map(([x, y]) => new THREE.Vector2(x, y)), segments);
    }
    const headShape = new THREE.Shape(KNIGHT_HEAD.map(([x, y]) => new THREE.Vector2(x, y)));
    const headGeo = new THREE.ExtrudeGeometry(headShape, { depth: 0.28, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2 });
    headGeo.translate(0, 0, -0.14);
    const crossV = new THREE.BoxGeometry(0.06, 0.2, 0.06).translate(0, 1.0, 0);
    const crossH = new THREE.BoxGeometry(0.17, 0.06, 0.06).translate(0, 1.01, 0);
    const mats: Record<Side, Material> = {
      w: new THREE.MeshStandardMaterial({ color: 0xf6efe4, roughness: 0.45 }),
      b: new THREE.MeshStandardMaterial({ color: 0x4a2340, roughness: 0.4 }),
    };
    const make = (color: Side, type: PieceSymbol): Group => {
      const group = new THREE.Group();
      if (!geos.has(type)) geos.set(type, lathe(type));
      const parts: Mesh[] = [new THREE.Mesh(geos.get(type)!, mats[color])];
      if (type === "n") {
        const head = new THREE.Mesh(headGeo, mats[color]);
        // The head is a flat extruded profile, so it faces sideways (as on a diagram) to show its outline from the
        // players' seats: white looks to the a-file, black to the h-file.
        head.rotation.y = color === "w" ? Math.PI : 0;
        parts.push(head);
      }
      if (type === "k") parts.push(new THREE.Mesh(crossV, mats[color]), new THREE.Mesh(crossH, mats[color]));
      for (const p of parts) {
        p.castShadow = shadows;
        group.add(p);
      }
      return group;
    };

    const v: View = {
      stage,
      squares,
      pieces: new Map(),
      marks,
      cursorMark,
      anims: [],
      theta: homeTheta(viewSide),
      phi: PHI_HOME,
      make,
      dispose: () => stage.dispose(),
    };

    stage.onFrame(() => {
      const { width, height } = stage.size();
      const radius = cameraRadius(width / height);
      camera.position.set(
        radius * Math.sin(v.phi) * Math.sin(v.theta),
        radius * Math.cos(v.phi),
        radius * Math.sin(v.phi) * Math.cos(v.theta),
      );
      camera.lookAt(0, 0, 0.15 * Math.cos(v.theta));
      if (!v.anims.length) return;
      const now = performance.now();
      v.anims = v.anims.filter((a) => {
        const k = Math.min(1, (now - a.start) / MOVE_MS);
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        a.group.position.lerpVectors(a.from, a.to, e);
        a.group.position.y = BOARD_TOP + Math.sin(Math.PI * e) * a.lift;
        return k < 1;
      });
      if (!v.anims.length) reconcile();
      stage.invalidate();
    });
    return v;
  }

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("chess3d.title")),
      h("p", { class: "lede" }, t("chess3d.privacyNote")),
    ),
    h("div", { class: "c3-tool" },
      h("div", { class: "c3-main" }, shell.root, statusEl, cursorLive),
      h("aside", { class: "rail controls" },
        h("label", { class: "field" }, h("span", null, t("chess.mode")), modeSel),
        levelField,
        sideField,
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", "data-action": "new", onClick: () => newGame() }, t("chess.newGame")),
          undoBtn,
          flipBtn,
          shell.fullscreenButton,
        ),
        h("h2", null, t("chess.movesTitle")),
        movesEl,
        h("p", { class: "hint" }, t("chess3d.hint")),
        creditLine("chess.credit", "https://github.com/nmrugg/stockfish.js", "Stockfish.js"),
        creditLine("chess.creditRules", "https://github.com/jhlywa/chess.js", "chess.js"),
        creditLine("game3d.credit", "https://threejs.org", "three.js"),
        h("p", { class: "hint game-credit" }, h("a", { href: "https://s3.cv.cm/files/games/src/stockfish.js-19.0.1-source.tar.gz", rel: "noopener" }, t("chess.sourceLink"))),
      ),
    ),
  );
  sync();
  paint();
  mounted = {
    cleanup: () => {
      shell.dispose();
      stopEngine();
      engine.dispose();
    },
  };
}

/** Shared mark geometry, built with the first view (three is not loaded before). */
const MARK_GEOS: { plane?: import("three").BufferGeometry; disc?: import("three").BufferGeometry; ring?: import("three").BufferGeometry } = {};
const markMats = new Map<string, Material>();
function markMaterial(THREE: Stage["THREE"], color: number, opacity: number): Material {
  const key = `${color}-${opacity}`;
  let m = markMats.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    markMats.set(key, m);
  }
  return m;
}

export function unmountChess3d(): void {
  mounted?.cleanup();
  mounted = null;
}
