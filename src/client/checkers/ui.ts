import { h } from "../dom";
import { t } from "../i18n";
import { cryptoRand, readStore, writeStore } from "../game-input";
import { MODES, buttonGrid, pointName, selectField, thinker, type Mode } from "../board-game";
import { CHECKERS_LEVELS, bestMove, isDark, legalMoves, play, replay, result, sideOf, type CheckersMove, type Level, type Side } from "../../shared/checkers";

/** American checkers against the computer or a friend, written for cv.cm (rules in src/shared/checkers.ts). */

const STORE_KEY = "cvcm.checkers.v1";
type Saved = { moves: number[][]; mode: Mode; level: Level; side: Side };

let mounted: { cleanup: () => void } | null = null;

export function mountCheckers(host: HTMLElement): void {
  unmountCheckers();
  const saved = readStore<Saved>(STORE_KEY);
  let mode: Mode = saved?.mode === "friend" ? "friend" : "computer";
  let level: Level = CHECKERS_LEVELS.includes(saved?.level as Level) ? saved!.level : "medium";
  let human: Side = saved?.side === -1 ? -1 : 1;
  const paths = Array.isArray(saved?.moves) ? saved!.moves.filter((p) => Array.isArray(p) && p.every((s) => Number.isInteger(s))) : [];
  let { game, moves } = replay(paths);
  /** The squares tapped so far for the move being made: the piece, then each landing square of a multi-jump. */
  let pending: number[] = [];
  let message = "";
  const brain = thinker();

  const sideName = (s: Side | 0) => t(s === 1 ? "checkers.black" : "checkers.white");
  const computerTurn = () => mode === "computer" && game.turn !== human && !result(game);
  const flipped = () => mode === "computer" && human === -1;
  const save = () => writeStore(STORE_KEY, { moves: moves.map((m) => m.path), mode, level, side: human });

  const modeSel = selectField("checkers", "mode", MODES, mode, (m) => t(`checkers.m_${m}`), (m) => { brain.cancel(); mode = m; sync(); save(); paint(); queue(); });
  const levelSel = selectField("checkers", "level", CHECKERS_LEVELS, level, (l) => t(`checkers.l_${l}`), (l) => { level = l; save(); });
  const sideSel = selectField("checkers", "side", ["1", "-1"] as const, String(human) as "1" | "-1", (s) => t(s === "1" ? "checkers.playBlack" : "checkers.playWhite"), (s) => { human = Number(s) as Side; newGame(); });
  const statusEl = h("p", { class: "bg-status", "aria-live": "polite", "data-out": "status" });
  const countEl = h("dl", { class: "stats-grid bg-count", "data-out": "count" });
  const undoBtn = h("button", { type: "button", class: "btn ghost", "data-action": "undo", onClick: () => undo() }, t("checkers.undo"));
  const gridEl = h("div", { class: "ckr-board", role: "grid", "aria-label": t("checkers.board"), "data-out": "board" });
  const grid = buttonGrid(gridEl, 8, "ckr-sq", (row, col) => (flipped() ? (7 - row) * 8 + (7 - col) : row * 8 + col), (i) => tap(i));

  /** Legal moves that start with what has been tapped so far. */
  const matching = (): CheckersMove[] => legalMoves(game).filter((m) => pending.every((s, i) => m.path[i] === s));

  const paint = () => {
    const legal = legalMoves(game);
    const live = matching();
    const next = new Set(pending.length ? live.map((m) => m.path[pending.length]).filter((s): s is number => s !== undefined) : []);
    const movable = new Set(legal.map((m) => m.path[0]!));
    // Mid-jump the piece is drawn on its latest landing square and the pieces it has jumped are marked.
    const hopping = pending.length > 1;
    const from = pending[0];
    const at = pending[pending.length - 1];
    const taken = new Set(hopping ? live[0]?.captures.slice(0, pending.length - 1) ?? [] : []);
    const last = moves[moves.length - 1];
    const over = result(game);
    for (const [sq, cell] of grid.cells) {
      let p = game.board[sq]!;
      if (hopping && sq === from) p = 0;
      if (hopping && sq === at) p = game.board[from!]!;
      cell.replaceChildren();
      cell.classList.toggle("dark", isDark(sq));
      if (p) cell.append(h("span", { class: `ckr-piece ${p > 0 ? "black" : "white"}${Math.abs(p) === 2 ? " king" : ""}${taken.has(sq) ? " taken" : ""}`, "aria-hidden": "true" }, Math.abs(p) === 2 ? "♛" : ""));
      cell.classList.toggle("on", pending.includes(sq));
      cell.classList.toggle("target", next.has(sq));
      cell.classList.toggle("can", !pending.length && !over && !computerTurn() && movable.has(sq));
      cell.classList.toggle("last", !!last && last.path.includes(sq));
      const what = p ? t(`checkers.p_${p > 0 ? "black" : "white"}${Math.abs(p) === 2 ? "King" : "Man"}`) : t("checkers.empty");
      cell.setAttribute("aria-label", `${pointName(sq, 8)} ${what}${next.has(sq) ? `, ${t("checkers.canMove")}` : ""}`);
      // Not `disabled`: arrow keys move focus orthogonally, through light squares (tap() ignores them).
      cell.setAttribute("aria-disabled", String(!isDark(sq)));
    }
    const black = game.board.filter((p) => p > 0).length;
    const white = game.board.filter((p) => p < 0).length;
    countEl.replaceChildren(h("dt", null, t("checkers.black")), h("dd", null, String(black)), h("dt", null, t("checkers.white")), h("dd", null, String(white)));
    if (over) {
      if (over.winner === 0) statusEl.textContent = t("checkers.draw");
      else if (mode === "computer") statusEl.textContent = over.winner === human ? t("checkers.youWin") : t("checkers.computerWins");
      else statusEl.textContent = t("checkers.wins", { side: sideName(over.winner) });
    } else if (brain.busy || computerTurn()) statusEl.textContent = t("checkers.thinking");
    else if (message) statusEl.textContent = message;
    else if (hopping) statusEl.textContent = t("checkers.keepJumping");
    else statusEl.textContent = legal[0]?.captures.length ? t("checkers.mustJump", { side: sideName(game.turn) }) : t("checkers.toMove", { side: sideName(game.turn) });
    undoBtn.disabled = !moves.length && !pending.length;
  };

  const commit = (m: CheckersMove) => {
    game = play(game, m);
    moves.push(m);
    pending = [];
    message = "";
    save();
    paint();
    queue();
  };

  const tap = (sq: number) => {
    if (result(game) || computerTurn() || !isDark(sq)) return;
    message = "";
    const legal = legalMoves(game);
    if (pending.length) {
      const live = matching();
      const step = live.filter((m) => m.path[pending.length] === sq);
      if (step.length) {
        pending = [...pending, sq];
        const done = step.find((m) => m.path.length === pending.length);
        if (done) return commit(done);
        return paint();
      }
      // Mid-jump the same piece has to carry on.
      if (pending.length > 1) {
        message = t("checkers.keepJumping");
        return paint();
      }
    }
    if (sideOf(game.board[sq]!) === game.turn) {
      if (legal.some((m) => m.path[0] === sq)) pending = pending[0] === sq ? [] : [sq];
      else {
        pending = [];
        message = legal[0]?.captures.length ? t("checkers.mustJump", { side: sideName(game.turn) }) : t("checkers.noMoves");
      }
    } else pending = [];
    paint();
  };

  const queue = () => {
    if (!computerTurn()) return;
    paint();
    brain.run(() => {
      const m = bestMove(game, level, cryptoRand);
      if (m) commit(m);
      else paint();
    });
  };

  const rebuild = (list: number[][]) => {
    ({ game, moves } = replay(list));
  };

  const undo = () => {
    brain.cancel();
    message = "";
    if (pending.length > 1 || (pending.length && !moves.length)) {
      pending = [];
      return paint();
    }
    pending = [];
    const list = moves.map((m) => m.path);
    list.pop();
    // Against the computer, take back its reply too so it is your move again.
    if (mode === "computer") while (list.length && replay(list).game.turn !== human) list.pop();
    rebuild(list);
    save();
    paint();
    queue();
  };

  const newGame = () => {
    brain.cancel();
    rebuild([]);
    pending = [];
    message = "";
    grid.build();
    save();
    paint();
    queue();
  };

  const sync = () => {
    levelSel.wrap.hidden = mode !== "computer";
    sideSel.wrap.hidden = mode !== "computer";
    grid.build();
  };

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("checkers.title")),
      h("p", { class: "lede" }, t("checkers.privacyNote")),
    ),
    h("div", { class: "bg-tool" },
      h("div", { class: "bg-main" }, gridEl, statusEl, countEl),
      h("aside", { class: "rail controls" },
        modeSel.wrap, levelSel.wrap, sideSel.wrap,
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", "data-action": "new", onClick: () => newGame() }, t("checkers.newGame")),
          undoBtn,
        ),
        h("p", { class: "hint" }, t("checkers.hint")),
      ),
    ),
  );
  sync();
  paint();
  // A restored game where the computer was to move: it moves now (no download involved, so this is safe at mount
  // only after the page is live; the prerender never has a save).
  queue();
  mounted = { cleanup: () => brain.cancel() };
}

export function unmountCheckers(): void {
  mounted?.cleanup();
  mounted = null;
}
