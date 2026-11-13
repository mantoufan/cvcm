import { h } from "../dom";
import { locale, t } from "../i18n";
import { creditLine, readStore, writeStore } from "../game-input";
import { LEVEL_MS, Xiangqi, fromIccs, moveDst, moveSrc, pointOf, sqOf, toIccs, type Piece, type Side } from "../../shared/xiangqi";

/**
 * Chinese chess against XiangQi Wizard Light (GPL-2.0-or-later, https://github.com/xqbase/xqwlight) or a friend.
 * The rules come from the same engine (src/shared/xiangqi.ts); its search runs in engine.worker.ts, created on the
 * computer's first move.
 */

const STORE_KEY = "cvcm.chinese-chess.v1";
type Mode = "computer" | "friend";
type Saved = { moves: string[]; mode: Mode; level: number; side: Side };

// Traditional characters, the common printed set; mainland Chinese readers get simplified ones.
const NAMES: Record<"trad" | "simp", Record<Side, Record<Piece["type"], string>>> = {
  trad: {
    red: { k: "帥", a: "仕", b: "相", n: "傌", r: "俥", c: "炮", p: "兵" },
    black: { k: "將", a: "士", b: "象", n: "馬", r: "車", c: "砲", p: "卒" },
  },
  simp: {
    red: { k: "帅", a: "仕", b: "相", n: "马", r: "车", c: "炮", p: "兵" },
    black: { k: "将", a: "士", b: "象", n: "马", r: "车", c: "炮", p: "卒" },
  },
};

let mounted: { cleanup: () => void } | null = null;

export function pieceChar(p: Piece): string {
  return NAMES[locale() === "zh-CN" ? "simp" : "trad"][p.side][p.type];
}

/** The board lines: 9 files × 10 ranks, the river and the two palaces, in a 0..8 × 0..9 coordinate space. */
function boardArt(): SVGSVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const art = document.createElementNS(NS, "svg");
  art.setAttribute("viewBox", "-0.5 -0.5 9 10");
  art.setAttribute("class", "xq-lines");
  art.setAttribute("aria-hidden", "true");
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    const l = document.createElementNS(NS, "line");
    l.setAttribute("x1", String(x1));
    l.setAttribute("y1", String(y1));
    l.setAttribute("x2", String(x2));
    l.setAttribute("y2", String(y2));
    art.append(l);
  };
  for (let y = 0; y <= 9; y++) line(0, y, 8, y);
  line(0, 0, 0, 9);
  line(8, 0, 8, 9);
  for (let x = 1; x < 8; x++) {
    line(x, 0, x, 4);
    line(x, 5, x, 9);
  }
  line(3, 0, 5, 2);
  line(5, 0, 3, 2);
  line(3, 7, 5, 9);
  line(5, 7, 3, 9);
  return art;
}

export function mountChineseChess(host: HTMLElement): void {
  unmountChineseChess();
  const saved = readStore<Saved>(STORE_KEY);
  let mode: Mode = saved?.mode === "friend" ? "friend" : "computer";
  let level = Number.isInteger(saved?.level) && saved!.level >= 0 && saved!.level < LEVEL_MS.length ? saved!.level : 1;
  let side: Side = saved?.side === "black" ? "black" : "red";
  let game = Xiangqi.replay(Array.isArray(saved?.moves) ? saved!.moves.filter((m) => typeof m === "string") : []);
  let selected = -1;
  let targets: number[] = [];
  let thinking = false;
  let request = 0;
  let worker: Worker | null = null;
  let failed = false;
  let focusSq = sqOf({ file: 4, rank: 9 });

  const select = <T extends string | number>(field: string, values: readonly T[], value: T, label: (v: T) => string, onChange: (v: T) => void) => {
    const el = h("select", { "data-field": field, onChange: () => onChange(values[el.selectedIndex]!) },
      ...values.map((v) => h("option", { value: String(v), selected: v === value }, label(v))));
    return el;
  };
  const modeSel = select("mode", ["computer", "friend"] as const, mode, (m) => t(`chineseChess.m_${m}`), (m) => { stop(); mode = m; sync(); save(); paint(); queue(); });
  const levelSel = select("level", [0, 1, 2, 3] as const, level as 0, (l) => t(`chineseChess.l_${l}`), (l) => { level = l; save(); });
  const sideSel = select("side", ["red", "black"] as const, side, (s) => t(s === "red" ? "chineseChess.playRed" : "chineseChess.playBlack"), (s) => { side = s; newGame(); });
  const levelField = h("label", { class: "field" }, h("span", null, t("chineseChess.level")), levelSel);
  const sideField = h("label", { class: "field" }, h("span", null, t("chineseChess.side")), sideSel);
  const statusEl = h("p", { class: "xq-status", "aria-live": "polite", "data-out": "status" });
  const undoBtn = h("button", { type: "button", class: "btn ghost", "data-action": "undo", onClick: () => undo() }, t("chineseChess.undo"));
  const points = h("div", { class: "xq-points", role: "grid", "aria-label": t("chineseChess.board") });
  const boardEl = h("div", { class: "xq-board", "data-out": "board" },
    boardArt(),
    h("span", { class: "xq-river l", "aria-hidden": "true" }, t("chineseChess.riverLeft")),
    h("span", { class: "xq-river r", "aria-hidden": "true" }, t("chineseChess.riverRight")),
    points,
  );
  const cells = new Map<number, HTMLButtonElement>();

  const computerTurn = () => mode === "computer" && game.turn() !== side && !game.result();
  const flipped = () => mode === "computer" && side === "black";

  const save = () => writeStore(STORE_KEY, { moves: game.moves.map(toIccs), mode, level, side });

  const build = () => {
    points.replaceChildren();
    cells.clear();
    for (let row = 0; row < 10; row++) {
      const r = h("div", { class: "xq-row", role: "row" });
      for (let col = 0; col < 9; col++) {
        const p = flipped() ? { file: 8 - col, rank: 9 - row } : { file: col, rank: row };
        const sq = sqOf(p);
        const cell = h("button", {
          type: "button",
          role: "gridcell",
          class: "xq-pt",
          tabindex: -1,
          "data-sq": `${"abcdefghi"[p.file]}${9 - p.rank}`,
          style: { left: `${((col + 0.5) / 9) * 100}%`, top: `${((row + 0.5) / 10) * 100}%` },
          onClick: () => tap(sq),
          onKeydown: (e: KeyboardEvent) => arrows(e, row, col),
        });
        cells.set(sq, cell);
        r.append(cell);
      }
      points.append(r);
    }
  };

  const arrows = (e: KeyboardEvent, row: number, col: number) => {
    const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const nr = row + d[0]!;
    const nc = col + d[1]!;
    if (nr < 0 || nr > 9 || nc < 0 || nc > 8) return;
    focusSq = sqOf(flipped() ? { file: 8 - nc, rank: 9 - nr } : { file: nc, rank: nr });
    paint();
    cells.get(focusSq)?.focus();
  };

  const paint = () => {
    const last = game.moves.at(-1);
    const check = game.inCheck() ? game.kingSquare() : -1;
    const result = game.result();
    const dests = new Set(targets.map(moveDst));
    for (const [sq, cell] of cells) {
      const p = pointOf(sq);
      const piece = game.pieceAt(p);
      cell.replaceChildren();
      if (piece) cell.append(h("span", { class: `xq-piece ${piece.side}` }, pieceChar(piece)));
      cell.classList.toggle("on", sq === selected);
      cell.classList.toggle("target", dests.has(sq));
      cell.classList.toggle("last", last !== undefined && (moveSrc(last) === sq || moveDst(last) === sq));
      cell.classList.toggle("check", sq === check);
      cell.tabIndex = sq === focusSq ? 0 : -1;
      const name = `${"abcdefghi"[p.file]}${9 - p.rank}`;
      const what = piece ? t(`chineseChess.p_${piece.side}_${piece.type}`) : t("chineseChess.empty");
      cell.setAttribute("aria-label", `${name} ${what}${dests.has(sq) ? `, ${t("chineseChess.canMove")}` : ""}`);
    }
    const who = t(game.turn() === "red" ? "chineseChess.red" : "chineseChess.black");
    if (failed) statusEl.textContent = t("chineseChess.engineFailed");
    else if (result) statusEl.textContent = result.winner
      ? t(`chineseChess.r_${result.kind}Win`, { side: t(result.winner === "red" ? "chineseChess.red" : "chineseChess.black") })
      : t(`chineseChess.r_${result.kind}Draw`);
    else if (thinking) statusEl.textContent = t("chineseChess.thinking");
    else statusEl.textContent = game.inCheck() ? t("chineseChess.check", { side: who }) : t("chineseChess.toMove", { side: who });
    undoBtn.disabled = !game.moves.length;
  };

  const tap = (sq: number) => {
    focusSq = sq;
    if (computerTurn() || game.result()) return paint();
    const mv = targets.find((m) => moveDst(m) === sq);
    if (mv !== undefined && game.play(mv)) {
      selected = -1;
      targets = [];
      save();
      paint();
      queue();
      return;
    }
    const piece = game.pieceAt(pointOf(sq));
    if (piece && piece.side === game.turn() && sq !== selected) {
      selected = sq;
      targets = game.legalFrom(sq);
    } else {
      selected = -1;
      targets = [];
    }
    paint();
  };

  const engine = () => {
    if (!worker) {
      worker = new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module", name: "cvcm-xiangqi" });
      worker.onmessage = (e: MessageEvent<{ id: number; move: string | null }>) => {
        if (e.data.id !== request) return;
        thinking = false;
        const mv = e.data.move ? fromIccs(e.data.move) : null;
        if (mv !== null) game.play(mv);
        save();
        paint();
      };
      worker.onerror = () => {
        failed = true;
        thinking = false;
        paint();
      };
    }
    return worker;
  };

  /** Removes the "computer to move" prompt of a restored game (button and board tap), whatever starts play first. */
  let dropResume = () => {};
  const queue = () => {
    dropResume();
    if (!computerTurn()) return;
    thinking = true;
    paint();
    engine().postMessage({ id: ++request, moves: game.moves.map(toIccs), millis: LEVEL_MS[level as 0] });
  };

  const stop = () => {
    // A search cannot be interrupted; its answer is simply ignored (the request id moves on).
    request++;
    thinking = false;
  };

  const undo = () => {
    stop();
    selected = -1;
    targets = [];
    game.undo();
    if (mode === "computer" && game.turn() !== side && game.moves.length) game.undo();
    save();
    paint();
    queue();
  };

  const newGame = () => {
    stop();
    game = new Xiangqi();
    selected = -1;
    targets = [];
    failed = false;
    build();
    save();
    paint();
    queue();
  };

  const sync = () => {
    levelField.hidden = mode !== "computer";
    sideField.hidden = mode !== "computer";
    build();
  };

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("chineseChess.title")),
      h("p", { class: "lede" }, t("chineseChess.privacyNote")),
    ),
    h("div", { class: "xq-tool" },
      h("div", { class: "xq-main" }, boardEl, statusEl),
      h("aside", { class: "rail controls" },
        h("label", { class: "field" }, h("span", null, t("chineseChess.mode")), modeSel),
        levelField,
        sideField,
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", "data-action": "new", onClick: () => newGame() }, t("chineseChess.newGame")),
          undoBtn,
        ),
        h("p", { class: "hint" }, t("chineseChess.hint")),
        creditLine("chineseChess.credit", "https://github.com/xqbase/xqwlight", "XiangQi Wizard Light"),
        h("p", { class: "hint game-credit" }, h("a", { href: "https://github.com/mantoufan/cvcm/tree/main/src/vendor/xqwlight", rel: "noopener" }, t("chineseChess.sourceLink"))),
      ),
    ),
  );
  sync();
  paint();
  // A saved game where the computer was to move resumes on the first tap, so nothing loads at mount.
  if (computerTurn()) {
    statusEl.textContent = t("chineseChess.tapToResume");
    const btn = h("button", { type: "button", class: "btn ghost", "data-action": "resume", onClick: () => resume() }, t("chineseChess.resume"));
    const resume = () => queue();
    dropResume = () => {
      boardEl.removeEventListener("pointerdown", resume);
      btn.remove();
      dropResume = () => {};
    };
    boardEl.addEventListener("pointerdown", resume);
    statusEl.after(btn);
  }
  mounted = {
    cleanup: () => {
      stop();
      worker?.terminate();
      worker = null;
    },
  };
}

export function unmountChineseChess(): void {
  mounted?.cleanup();
  mounted = null;
}
