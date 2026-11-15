import { h } from "../dom";
import { t } from "../i18n";
import { cryptoRand, readStore, writeStore } from "../game-input";
import { MODES, buttonGrid, pointName, selectField, thinker, type Mode } from "../board-game";
import { REVERSI_LEVELS, bestMove, count, flips, movesFor, over, play, replay, winner, type Level, type Side } from "../../shared/reversi";

/** Reversi against the computer or a friend, written for cv.cm (rules in src/shared/reversi.ts). */

const STORE_KEY = "cvcm.reversi.v1";
type Saved = { moves: number[]; mode: Mode; level: Level; side: Side };

let mounted: { cleanup: () => void } | null = null;

export function mountReversi(host: HTMLElement): void {
  unmountReversi();
  const saved = readStore<Saved>(STORE_KEY);
  let mode: Mode = saved?.mode === "friend" ? "friend" : "computer";
  let level: Level = REVERSI_LEVELS.includes(saved?.level as Level) ? saved!.level : "medium";
  let human: Side = saved?.side === -1 ? -1 : 1;
  let { game, moves } = replay(Array.isArray(saved?.moves) ? saved!.moves : []);
  let flipped: number[] = [];
  let passNote = "";
  const brain = thinker();

  const sideName = (s: Side) => t(s === 1 ? "reversi.black" : "reversi.white");
  const computerTurn = () => mode === "computer" && game.turn !== human && !over(game);
  const save = () => writeStore(STORE_KEY, { moves, mode, level, side: human });

  const modeSel = selectField("reversi", "mode", MODES, mode, (m) => t(`reversi.m_${m}`), (m) => { brain.cancel(); mode = m; sync(); save(); paint(); queue(); });
  const levelSel = selectField("reversi", "level", REVERSI_LEVELS, level, (l) => t(`reversi.l_${l}`), (l) => { level = l; save(); });
  const sideSel = selectField("reversi", "side", ["1", "-1"] as const, String(human) as "1" | "-1", (s) => t(s === "1" ? "reversi.playBlack" : "reversi.playWhite"), (s) => { human = Number(s) as Side; newGame(); });
  const statusEl = h("p", { class: "bg-status", "aria-live": "polite", "data-out": "status" });
  const countEl = h("dl", { class: "stats-grid bg-count", "data-out": "count" });
  const undoBtn = h("button", { type: "button", class: "btn ghost", "data-action": "undo", onClick: () => undo() }, t("reversi.undo"));
  const gridEl = h("div", { class: "rv-board", role: "grid", "aria-label": t("reversi.board"), "data-out": "board" });
  const grid = buttonGrid(gridEl, 8, "rv-sq", (row, col) => row * 8 + col, (i) => tap(i));

  const paint = () => {
    const legal = new Set(over(game) || computerTurn() ? [] : movesFor(game.board, game.turn));
    const last = moves[moves.length - 1];
    for (const [sq, cell] of grid.cells) {
      const d = game.board[sq]!;
      cell.replaceChildren();
      if (d) cell.append(h("span", { class: `rv-disc ${d > 0 ? "black" : "white"}${flipped.includes(sq) ? " flip" : ""}`, "aria-hidden": "true" }));
      cell.classList.toggle("target", legal.has(sq));
      cell.classList.toggle("last", sq === last);
      const what = d ? t(d > 0 ? "reversi.discBlack" : "reversi.discWhite") : t("reversi.empty");
      cell.setAttribute("aria-label", `${pointName(sq, 8)} ${what}${legal.has(sq) ? `, ${t("reversi.canPlace", { n: flips(game.board, sq, game.turn).length })}` : ""}`);
    }
    countEl.replaceChildren(
      h("dt", null, t("reversi.black")), h("dd", null, String(count(game.board, 1))),
      h("dt", null, t("reversi.white")), h("dd", null, String(count(game.board, -1))),
    );
    const w = winner(game);
    if (w !== null) {
      if (w === 0) statusEl.textContent = t("reversi.draw");
      else if (mode === "computer") statusEl.textContent = w === human ? t("reversi.youWin") : t("reversi.computerWins");
      else statusEl.textContent = t("reversi.wins", { side: sideName(w) });
    } else if (brain.busy || computerTurn()) statusEl.textContent = [passNote, t("reversi.thinking")].filter(Boolean).join(" ");
    else statusEl.textContent = [passNote, t("reversi.toMove", { side: sideName(game.turn) })].filter(Boolean).join(" ");
    undoBtn.disabled = !moves.length;
  };

  const commit = (sq: number) => {
    const r = play(game, sq);
    if (!r) return;
    const mover = game.turn;
    game = r.game;
    moves.push(sq);
    flipped = r.flipped;
    passNote = r.passed ? t("reversi.passed", { side: sideName(-mover as Side) }) : "";
    save();
    paint();
    queue();
  };

  const tap = (sq: number) => {
    if (over(game) || computerTurn()) return;
    if (!flips(game.board, sq, game.turn).length) return;
    commit(sq);
  };

  const queue = () => {
    if (!computerTurn()) return;
    paint();
    brain.run(() => {
      const sq = bestMove(game, level, cryptoRand);
      if (sq !== null) commit(sq);
      else paint();
    }, 250);
  };

  const rebuild = (list: number[]) => {
    ({ game, moves } = replay(list));
    flipped = [];
    passNote = "";
  };

  const undo = () => {
    brain.cancel();
    const list = moves.slice(0, -1);
    // Against the computer, take back to your own turn (its replies and any passes in between).
    if (mode === "computer") while (list.length && replay(list).game.turn !== human) list.pop();
    rebuild(list);
    save();
    paint();
    queue();
  };

  const newGame = () => {
    brain.cancel();
    rebuild([]);
    save();
    paint();
    queue();
  };

  const sync = () => {
    levelSel.wrap.hidden = mode !== "computer";
    sideSel.wrap.hidden = mode !== "computer";
  };

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("reversi.title")),
      h("p", { class: "lede" }, t("reversi.privacyNote")),
    ),
    h("div", { class: "bg-tool" },
      h("div", { class: "bg-main" }, gridEl, statusEl, countEl),
      h("aside", { class: "rail controls" },
        modeSel.wrap, levelSel.wrap, sideSel.wrap,
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", "data-action": "new", onClick: () => newGame() }, t("reversi.newGame")),
          undoBtn,
        ),
        h("p", { class: "hint" }, t("reversi.hint")),
      ),
    ),
  );
  grid.build();
  sync();
  paint();
  queue();
  mounted = { cleanup: () => brain.cancel() };
}

export function unmountReversi(): void {
  mounted?.cleanup();
  mounted = null;
}
