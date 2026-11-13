import { h } from "../dom";
import { t } from "../i18n";
import { randomBelow } from "../../shared/random";
import { LEVELS, computerMove, other, outcome, type Cell, type Level, type Mark } from "../../shared/tictactoe";

type Mode = "computer" | "friend";
const MODES: readonly Mode[] = ["computer", "friend"];
/** How long the computer "thinks" before it moves, so its move can be seen landing. */
const THINK_MS = 350;

let mounted: { cleanup: () => void } | null = null;

export function mountTicTacToe(host: HTMLElement): void {
  unmountTicTacToe();
  let board: Cell[] = new Array<Cell>(9).fill("");
  let turn: Mark = "X";
  let mode: Mode = "computer";
  let level: Level = "hard";
  let human: Mark = "X";
  let thinking = 0;
  let uncounted = false;
  const score = { X: 0, O: 0, draw: 0 };

  const select = <T extends string>(field: string, values: readonly T[], value: T, label: (v: T) => string, onChange: (v: T) => void) => {
    const el = h("select", { "data-field": field, onChange: () => onChange(el.value as T) },
      ...values.map((v) => h("option", { value: v, selected: v === value }, label(v))));
    return el;
  };
  // The score is kept per mark, so it starts again whenever the mark stops meaning the same player.
  const clearScore = () => {
    score.X = 0;
    score.O = 0;
    score.draw = 0;
  };
  const modeSel = select("mode", MODES, mode, (m) => t(`ticTacToe.m_${m}`), (m) => { mode = m; clearScore(); sync(); reset(); });
  const levelSel = select("level", LEVELS, level, (l) => t(`ticTacToe.l_${l}`), (l) => {
    // The new level plays from the next move with a fresh tally; a game that changed level mid-way is not counted.
    level = l;
    clearScore();
    if (board.some(Boolean) && !outcome(board)) uncounted = true;
    paint();
  });
  const sideSel = select("side", ["X", "O"] as const, human, (s) => t(s === "X" ? "ticTacToe.playX" : "ticTacToe.playO"), (s) => { human = s; clearScore(); reset(); });
  const levelField = h("label", { class: "field" }, h("span", null, t("ticTacToe.level")), levelSel);
  const sideField = h("label", { class: "field" }, h("span", null, t("ticTacToe.side")), sideSel);
  const statusEl = h("p", { class: "ttt-status", "aria-live": "polite", "data-out": "status" });
  const scoreEl = h("dl", { class: "stats-grid ttt-score", "data-out": "score" });
  const cellEls = Array.from({ length: 9 }, (_, i) =>
    h("button", { type: "button", class: "ttt-cell", "data-cell": i, onClick: () => play(i) }));
  const boardEl = h("div", { class: "ttt-board", role: "grid", tabindex: -1, "aria-label": t("ticTacToe.board"), "data-out": "board" },
    ...[0, 1, 2].map((r) => h("div", { class: "ttt-row", role: "row" }, ...cellEls.slice(r * 3, r * 3 + 3).map((c) => {
      c.setAttribute("role", "gridcell");
      return c;
    }))));

  const newBtn = h("button", { type: "button", class: "btn", "data-action": "new", onClick: () => reset() }, t("ticTacToe.newGame"));
  const computerTurn = () => mode === "computer" && turn !== human && !outcome(board);

  const paint = () => {
    const o = outcome(board);
    const line: readonly number[] = o && o.winner !== "draw" ? o.line : [];
    cellEls.forEach((el, i) => {
      el.textContent = board[i]!;
      el.classList.toggle("x", board[i] === "X");
      el.classList.toggle("o", board[i] === "O");
      el.classList.toggle("win", line.includes(i));
      el.disabled = !!board[i] || !!o || computerTurn();
      el.setAttribute("aria-label", t("ticTacToe.cell", { row: Math.floor(i / 3) + 1, col: (i % 3) + 1, value: board[i] || t("ticTacToe.empty") }));
    });
    // "You (X)" against the computer; just "X" between two players.
    const label = (m: Mark) => (mode === "computer" ? `${m === human ? t("ticTacToe.you") : t("ticTacToe.computer")} (${m})` : m);
    if (o) {
      statusEl.textContent = o.winner === "draw" ? t("ticTacToe.draw") : mode === "computer" ? (o.winner === human ? t("ticTacToe.youWin") : t("ticTacToe.computerWins")) : t("ticTacToe.wins", { mark: o.winner });
    } else statusEl.textContent = computerTurn() ? t("ticTacToe.thinking") : mode === "computer" ? t("ticTacToe.yourTurn", { mark: turn }) : t("ticTacToe.turn", { mark: turn });
    scoreEl.replaceChildren(
      h("dt", null, label("X")), h("dd", null, String(score.X)),
      h("dt", null, label("O")), h("dd", null, String(score.O)),
      h("dt", null, t("ticTacToe.draws")), h("dd", null, String(score.draw)),
    );
  };

  const finish = () => {
    const o = outcome(board);
    if (o && !uncounted) score[o.winner]++;
  };

  const place = (i: number) => {
    board[i] = turn;
    turn = other(turn);
    finish();
  };

  /** Puts focus back on the board after a move disables the cell that had it (keyboard play). */
  const refocus = (had: boolean) => {
    const active = document.activeElement;
    if (!had || (active instanceof HTMLButtonElement && cellEls.includes(active) && !active.disabled)) return;
    // Only when focus is still on the board (or was dropped to the body), not after the user moved it elsewhere.
    if (active && active !== document.body && !boardEl.contains(active)) return;
    // When the game is over no cell is playable: New game is the next thing to press.
    (cellEls.find((el) => !el.disabled) ?? newBtn).focus();
  };

  const queueComputer = (had: boolean) => {
    if (!computerTurn()) return;
    thinking = window.setTimeout(() => {
      thinking = 0;
      if (!computerTurn()) return;
      const i = computerMove(board, turn, level, (n) => randomBelow(n));
      if (i >= 0) place(i);
      paint();
      // Focus goes back to the board, on the first free cell, for keyboard players.
      refocus(had);
    }, THINK_MS);
  };

  const play = (i: number) => {
    if (board[i] || outcome(board) || computerTurn()) return;
    const had = boardEl.contains(document.activeElement);
    place(i);
    paint();
    // While the computer thinks every cell is disabled, so keep focus on the board itself until it moves.
    if (had && computerTurn()) boardEl.focus();
    else refocus(had);
    queueComputer(had);
  };

  const reset = () => {
    if (thinking) window.clearTimeout(thinking);
    thinking = 0;
    uncounted = false;
    board = new Array<Cell>(9).fill("");
    turn = "X";
    paint();
    queueComputer(false);
  };

  const sync = () => {
    levelField.hidden = mode !== "computer";
    sideField.hidden = mode !== "computer";
  };

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("ticTacToe.title")),
      h("p", { class: "lede" }, t("ticTacToe.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("label", { class: "field" }, h("span", null, t("ticTacToe.mode")), modeSel),
        levelField,
        sideField,
        h("div", { class: "stage-actions" },
          newBtn,
          h("button", { type: "button", class: "btn ghost", "data-action": "clear-score", onClick: () => { clearScore(); paint(); } }, t("ticTacToe.clearScore")),
        ),
        h("p", { class: "hint" }, t("ticTacToe.hint")),
      ),
      h("div", { class: "rail" }, boardEl, statusEl, scoreEl),
    ),
  );
  sync();
  paint();
  mounted = {
    cleanup: () => {
      if (thinking) window.clearTimeout(thinking);
      thinking = 0;
    },
  };
}

export function unmountTicTacToe(): void {
  mounted?.cleanup();
  mounted = null;
}
