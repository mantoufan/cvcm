/*! @license Uses chess.js (https://github.com/jhlywa/chess.js) — Copyright (c) 2025, Jeff Hlywa. BSD-2-Clause. Chess pieces by Colin M.L. Burnett (Wikimedia Commons), BSD. THIS SOFTWARE IS PROVIDED "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES ARE DISCLAIMED. */
import { Chess, type Move, type PieceSymbol, type Square } from "chess.js";
import { h } from "../dom";
import { t } from "../i18n";
import { creditLine, readStore, writeStore } from "../game-input";
import { Engine, LEVELS, type LevelIndex } from "./engine";

/**
 * Chess against Stockfish or a friend. Rules, check, mate and draws come from chess.js (BSD-2-Clause,
 * https://github.com/jhlywa/chess.js); pieces are Colin M.L. Burnett's set from Wikimedia Commons (used under its BSD
 * licence, one of the three it is offered under).
 */

const STORE_KEY = "cvcm.chess.v1";
const PIECES = "/assets/games/chess/pieces";
const FILES = "abcdefgh";
type Mode = "computer" | "friend";
type Side = "w" | "b";
type Saved = { moves: string[]; mode: Mode; level: number; side: Side };

let mounted: { cleanup: () => void } | null = null;

const pieceSrc = (color: Side, type: PieceSymbol) => `${PIECES}/${type}${color === "w" ? "l" : "d"}.svg`;
const squareAt = (file: number, rank: number) => `${FILES[file]}${rank + 1}` as Square;

/** Replays saved UCI moves; stops at the first one that is not legal. */
export function replay(moves: readonly string[]): Chess {
  const game = new Chess();
  for (const m of moves) {
    try {
      game.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
    } catch {
      break;
    }
  }
  return game;
}

export const uci = (m: Pick<Move, "from" | "to" | "promotion">) => `${m.from}${m.to}${m.promotion ?? ""}`;

/** The reason the game ended, as a locale key under chess.*, or null while it goes on. */
export function endReason(game: Chess): string | null {
  if (game.isCheckmate()) return game.turn() === "w" ? "blackMates" : "whiteMates";
  if (game.isStalemate()) return "stalemate";
  if (game.isInsufficientMaterial()) return "insufficient";
  if (game.isThreefoldRepetition()) return "repetition";
  if (game.isDrawByFiftyMoves()) return "fifty";
  if (game.isDraw()) return "draw";
  return null;
}

export function mountChess(host: HTMLElement): void {
  unmountChess();
  const saved = readStore<Saved>(STORE_KEY);
  let mode: Mode = saved?.mode === "friend" ? "friend" : "computer";
  let level = (Number.isInteger(saved?.level) && saved!.level >= 0 && saved!.level < LEVELS.length ? saved!.level : 1) as LevelIndex;
  let side: Side = saved?.side === "b" ? "b" : "w";
  let game = replay(Array.isArray(saved?.moves) ? saved!.moves.filter((m) => typeof m === "string") : []);
  let selected: Square | null = null;
  let promo: { from: Square; to: Square } | null = null;
  let thinking = false;
  let generation = 0;
  let engineFailed = false;
  const engine = new Engine();

  const select = <T extends string | number>(field: string, values: readonly T[], value: T, label: (v: T) => string, onChange: (v: T) => void) => {
    const el = h("select", { "data-field": field, onChange: () => onChange(values[el.selectedIndex]!) },
      ...values.map((v) => h("option", { value: String(v), selected: v === value }, label(v))));
    return el;
  };
  const modeSel = select("mode", ["computer", "friend"] as const, mode, (m) => t(`chess.m_${m}`), (m) => { stopEngine(); mode = m; sync(); save(); paint(); queue(); });
  const levelSel = select("level", [0, 1, 2, 3, 4] as const, level, (l) => t(`chess.l_${l}`), (l) => { level = l as LevelIndex; save(); });
  const sideSel = select("side", ["w", "b"] as const, side, (s) => t(s === "w" ? "chess.playWhite" : "chess.playBlack"), (s) => { side = s; newGame(); });
  const levelField = h("label", { class: "field" }, h("span", null, t("chess.level")), levelSel);
  const sideField = h("label", { class: "field" }, h("span", null, t("chess.side")), sideSel);
  const statusEl = h("p", { class: "chess-status", "aria-live": "polite", "data-out": "status" });
  const movesEl = h("ol", { class: "chess-moves", "data-out": "moves" });
  const promoEl = h("div", { class: "chess-promo", hidden: true, role: "dialog", "aria-label": t("chess.promote") });
  const boardEl = h("div", { class: "chess-board", role: "grid", "aria-label": t("chess.board"), "data-out": "board" });
  const undoBtn = h("button", { type: "button", class: "btn ghost", "data-action": "undo", onClick: () => undo() }, t("chess.undo"));
  const cells = new Map<Square, HTMLButtonElement>();
  let focusSq: Square = "e2";

  const computerTurn = () => mode === "computer" && game.turn() !== side && !game.isGameOver();
  const flipped = () => (mode === "computer" ? side === "b" : false);

  const save = () => writeStore(STORE_KEY, { moves: game.history({ verbose: true }).map(uci), mode, level, side });

  const buildBoard = () => {
    boardEl.replaceChildren();
    cells.clear();
    const ranks = flipped() ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    const files = flipped() ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
    for (const r of ranks) {
      const row = h("div", { class: "chess-row", role: "row" });
      for (const f of files) {
        const sq = squareAt(f, r);
        const cell = h("button", {
          type: "button",
          role: "gridcell",
          class: `chess-sq ${(f + r) % 2 ? "light" : "dark"}`,
          "data-sq": sq,
          tabindex: -1,
          onClick: () => tap(sq),
          onKeydown: (e: KeyboardEvent) => arrows(e, sq),
        });
        cells.set(sq, cell);
        row.append(cell);
      }
      boardEl.append(row);
    }
  };

  /** Roving focus: one square is tabbable, arrow keys move between squares (in screen orientation). */
  const arrows = (e: KeyboardEvent, sq: Square) => {
    const d = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
    if (!d) return;
    e.preventDefault();
    const sign = flipped() ? -1 : 1;
    const f = FILES.indexOf(sq[0]!) + d[0]! * sign;
    const r = Number(sq[1]) - 1 + d[1]! * sign;
    if (f < 0 || f > 7 || r < 0 || r > 7) return;
    focusSq = squareAt(f, r);
    paint();
    cells.get(focusSq)?.focus();
  };

  const paint = () => {
    const last = game.history({ verbose: true }).at(-1);
    const targets = new Set(selected ? game.moves({ square: selected, verbose: true }).map((m) => m.to) : []);
    const checked = game.inCheck() ? game.board().flat().find((p) => p?.type === "k" && p.color === game.turn())?.square : undefined;
    const locked = computerTurn() || game.isGameOver() || !!promo;
    for (const [sq, cell] of cells) {
      const piece = game.get(sq);
      cell.replaceChildren();
      if (piece) cell.append(h("img", { src: pieceSrc(piece.color, piece.type), alt: "", draggable: "false" }));
      cell.classList.toggle("on", sq === selected);
      cell.classList.toggle("target", targets.has(sq));
      cell.classList.toggle("capture", targets.has(sq) && !!piece);
      cell.classList.toggle("last", !!last && (last.from === sq || last.to === sq));
      cell.classList.toggle("check", sq === checked);
      cell.tabIndex = sq === focusSq ? 0 : -1;
      cell.setAttribute("aria-disabled", String(locked));
      const what = piece ? t(`chess.p_${piece.color}${piece.type}`) : t("chess.empty");
      cell.setAttribute("aria-label", `${sq} ${what}${targets.has(sq) ? `, ${t("chess.canMove")}` : ""}`);
    }
    const end = endReason(game);
    if (engineFailed) statusEl.textContent = t("chess.engineFailed");
    else if (end) statusEl.textContent = t(`chess.${end}`);
    else if (thinking) statusEl.textContent = t("chess.thinking");
    else {
      const who = game.turn() === "w" ? t("chess.white") : t("chess.black");
      statusEl.textContent = game.inCheck() ? t("chess.check", { side: who }) : t("chess.toMove", { side: who });
    }
    const sans = game.history();
    movesEl.replaceChildren(...Array.from({ length: Math.ceil(sans.length / 2) }, (_, i) =>
      h("li", null, sans[i * 2]!, sans[i * 2 + 1] ? ` ${sans[i * 2 + 1]}` : "")));
    movesEl.scrollTop = movesEl.scrollHeight;
    undoBtn.disabled = !sans.length;
  };

  const play = (from: Square, to: Square, promotion?: PieceSymbol) => {
    try {
      game.move({ from, to, promotion });
    } catch {
      return false;
    }
    selected = null;
    save();
    paint();
    queue();
    return true;
  };

  const askPromotion = (from: Square, to: Square) => {
    promo = { from, to };
    const color = game.turn();
    promoEl.replaceChildren(
      ...(["q", "r", "b", "n"] as const).map((p) =>
        h("button", { type: "button", class: "chess-promo-btn", "data-promo": p, "aria-label": t(`chess.p_${color}${p}`), onClick: () => {
          promo = null;
          promoEl.hidden = true;
          play(from, to, p);
        } }, h("img", { src: pieceSrc(color, p), alt: "" }))),
      h("button", { type: "button", class: "btn ghost", onClick: () => { promo = null; promoEl.hidden = true; selected = null; paint(); } }, t("chess.cancel")),
    );
    promoEl.hidden = false;
    (promoEl.querySelector("button") as HTMLButtonElement | null)?.focus();
    paint();
  };

  const tap = (sq: Square) => {
    focusSq = sq;
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

  /** Removes the "computer to move" prompt of a restored game (button and board tap), whatever starts play first. */
  let dropResume = () => {};
  const queue = () => {
    dropResume();
    if (!computerTurn()) return;
    const gen = ++generation;
    thinking = true;
    paint();
    void engine.bestMove(game.fen(), level).then((best) => {
      if (gen !== generation) return;
      thinking = false;
      engineFailed = engine.failed;
      if (best) {
        try {
          game.move({ from: best.slice(0, 2), to: best.slice(2, 4), promotion: best[4] });
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
    // Against the computer, take back the computer's reply too, so it is your move again.
    game.undo();
    if (mode === "computer" && game.turn() !== side && game.history().length) game.undo();
    save();
    paint();
    queue();
  };

  const newGame = () => {
    stopEngine();
    game = new Chess();
    selected = null;
    promo = null;
    promoEl.hidden = true;
    engineFailed = false;
    focusSq = side === "b" && mode === "computer" ? "e7" : "e2";
    buildBoard();
    save();
    paint();
    queue();
  };

  const sync = () => {
    levelField.hidden = mode !== "computer";
    sideField.hidden = mode !== "computer";
    buildBoard();
  };

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("chess.title")),
      h("p", { class: "lede" }, t("chess.privacyNote")),
    ),
    h("div", { class: "chess-tool" },
      h("div", { class: "chess-main" }, h("div", { class: "chess-wrap" }, boardEl, promoEl), statusEl),
      h("aside", { class: "rail controls" },
        h("label", { class: "field" }, h("span", null, t("chess.mode")), modeSel),
        levelField,
        sideField,
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", "data-action": "new", onClick: () => newGame() }, t("chess.newGame")),
          undoBtn,
        ),
        h("h2", null, t("chess.movesTitle")),
        movesEl,
        h("p", { class: "hint" }, t("chess.hint")),
        creditLine("chess.credit", "https://github.com/nmrugg/stockfish.js", "Stockfish.js"),
        creditLine("chess.creditRules", "https://github.com/jhlywa/chess.js", "chess.js"),
        h("p", { class: "hint game-credit" }, h("a", { href: "https://s3.cv.cm/files/games/src/stockfish.js-19.0.1-source.tar.gz", rel: "noopener" }, t("chess.sourceLink"))),
      ),
    ),
  );
  sync();
  paint();
  // A saved game where the computer was about to move resumes only on interaction (no engine download at mount).
  if (computerTurn()) {
    statusEl.textContent = t("chess.tapToResume");
    const btn = h("button", { type: "button", class: "btn ghost", "data-action": "resume", onClick: () => resume() }, t("chess.resume"));
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
      stopEngine();
      engine.dispose();
    },
  };
}

export function unmountChess(): void {
  mounted?.cleanup();
  mounted = null;
}
