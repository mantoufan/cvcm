import { h } from "../dom";
import { t } from "../i18n";
import { cryptoRand, readStore, writeStore } from "../game-input";
import { MODES, selectField, thinker, type Mode } from "../board-game";
import { CC_LEVELS, HOLES, HOME, bestMove, destinations, legalMoves, passTurn, play, replay, winner, type Level, type Move, type Side } from "../../shared/chinese-checkers";

/** Chinese checkers for two against the computer or a friend, written for cv.cm (rules in src/shared/chinese-checkers.ts). */

const STORE_KEY = "cvcm.chinese-checkers.v1";
type Saved = { moves: number[][]; mode: Mode; level: Level; side: Side };
const ROW_H = Math.sqrt(3);
const W = 34;
const H = 16 * ROW_H + 2;

let mounted: { cleanup: () => void } | null = null;

export function mountChineseCheckers(host: HTMLElement): void {
  unmountChineseCheckers();
  const saved = readStore<Saved>(STORE_KEY);
  let mode: Mode = saved?.mode === "friend" ? "friend" : "computer";
  let level: Level = CC_LEVELS.includes(saved?.level as Level) ? saved!.level : "medium";
  let human: Side = saved?.side === 2 ? 2 : 1;
  let { game, moves } = replay(Array.isArray(saved?.moves) ? saved!.moves : []);
  let selected = -1;
  let targets = new Map<number, Move>();
  let focusIndex = HOME[1][0]!;
  const brain = thinker();

  const sideName = (s: Side) => t(s === 1 ? "chineseCheckers.pink" : "chineseCheckers.blue");
  const computerTurn = () => mode === "computer" && game.turn !== human && !winner(game.board);
  const flipped = () => mode === "computer" && human === 2;
  const save = () => writeStore(STORE_KEY, { moves, mode, level, side: human });

  const modeSel = selectField("chineseCheckers", "mode", MODES, mode, (m) => t(`chineseCheckers.m_${m}`), (m) => { brain.cancel(); mode = m; sync(); save(); paint(); queue(); });
  const levelSel = selectField("chineseCheckers", "level", CC_LEVELS, level, (l) => t(`chineseCheckers.l_${l}`), (l) => { level = l; save(); });
  const sideSel = selectField("chineseCheckers", "side", ["1", "2"] as const, String(human) as "1" | "2", (s) => t(s === "1" ? "chineseCheckers.playPink" : "chineseCheckers.playBlue"), (s) => { human = Number(s) as Side; newGame(); });
  const statusEl = h("p", { class: "bg-status", "aria-live": "polite", "data-out": "status" });
  const undoBtn = h("button", { type: "button", class: "btn ghost", "data-action": "undo", onClick: () => undo() }, t("chineseCheckers.undo"));
  const boardEl = h("div", { class: "cc-board", role: "grid", "aria-label": t("chineseCheckers.board"), "data-out": "board" });

  /** Screen position of hole i (the human's point at the bottom). */
  const pos = (i: number) => {
    const hole = HOLES[i]!;
    const row = flipped() ? 16 - hole.row : hole.row;
    const col = flipped() ? -hole.col : hole.col;
    return { row, col };
  };

  const cells = HOLES.map((_, i) => {
    const b = h("button", { type: "button", role: "gridcell", class: "cc-hole", "data-i": i, tabindex: -1 });
    b.addEventListener("click", () => { focusIndex = i; tap(i); });
    b.addEventListener("keydown", (e) => arrows(e, i));
    return b;
  });
  boardEl.append(...cells);

  const place = () => {
    cells.forEach((b, i) => {
      const { row, col } = pos(i);
      b.style.left = `${((col + W / 2) / W) * 100}%`;
      b.style.top = `${((row * ROW_H + 1) / H) * 100}%`;
    });
  };

  /** Arrow keys: left/right along the row, up/down to the nearest hole in the next row, in screen terms. */
  const arrows = (e: KeyboardEvent, i: number) => {
    const d = ({ ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -2], ArrowRight: [0, 2] } as Record<string, [number, number]>)[e.key];
    if (!d) return;
    e.preventDefault();
    const here = pos(i);
    const row = here.row + d[0];
    const col = here.col + d[1];
    let best = -1;
    let bestD = Infinity;
    HOLES.forEach((_, j) => {
      const p = pos(j);
      if (p.row !== row) return;
      const dist = Math.abs(p.col - col);
      if (d[0] === 0 && Math.sign(p.col - here.col) !== Math.sign(d[1])) return;
      if (dist < bestD) {
        bestD = dist;
        best = j;
      }
    });
    if (best < 0) return;
    focusIndex = best;
    syncTab();
    cells[best]!.focus();
  };

  const syncTab = () => cells.forEach((b, i) => { b.tabIndex = i === focusIndex ? 0 : -1; });

  const paint = (path: readonly number[] = []) => {
    const win = winner(game.board);
    const onPath = new Set(path);
    const last = moves[moves.length - 1];
    cells.forEach((b, i) => {
      const s = game.board[i]!;
      b.replaceChildren();
      if (s) b.append(h("span", { class: `cc-marble ${s === 1 ? "pink" : "blue"}`, "aria-hidden": "true" }));
      b.classList.toggle("on", i === selected);
      b.classList.toggle("target", targets.has(i));
      b.classList.toggle("path", onPath.has(i));
      b.classList.toggle("last", !!last && (last[0] === i || last[last.length - 1] === i));
      const what = s ? t(s === 1 ? "chineseCheckers.marblePink" : "chineseCheckers.marbleBlue") : t("chineseCheckers.empty");
      b.setAttribute("aria-label", `${what}${targets.has(i) ? `, ${t("chineseCheckers.canMove")}` : ""}`);
    });
    if (win) {
      statusEl.textContent = mode === "computer" ? (win === human ? t("chineseCheckers.youWin") : t("chineseCheckers.computerWins")) : t("chineseCheckers.wins", { side: sideName(win) });
    } else if (brain.busy || computerTurn()) statusEl.textContent = t("chineseCheckers.thinking");
    else statusEl.textContent = t("chineseCheckers.toMove", { side: sideName(game.turn) });
    // Against the computer, Undo needs a move of yours to take back (undoing only its opening would replay it).
    const humanMoves = mode === "computer" ? moves.filter((m, k) => m.length && (k % 2 === 0 ? 1 : 2) === human).length : moves.length;
    undoBtn.disabled = !humanMoves;
    syncTab();
  };

  const commit = (path: Move) => {
    const next = play(game, path);
    if (!next) return;
    game = next;
    moves.push(path);
    // A side left with no move at all passes (saved as an empty move, so a reload replays it).
    if (!winner(game.board) && !legalMoves(game).length) {
      game = passTurn(game);
      moves.push([]);
    }
    selected = -1;
    targets = new Map();
    save();
    paint(path);
    queue();
  };

  const tap = (i: number) => {
    if (winner(game.board) || computerTurn()) return;
    const path = targets.get(i);
    if (path) return commit(path);
    if (game.board[i] === game.turn && i !== selected) {
      selected = i;
      targets = destinations(game.board, i);
    } else {
      selected = -1;
      targets = new Map();
    }
    paint();
  };

  const queue = () => {
    if (!computerTurn()) return;
    paint();
    brain.run(() => {
      const m = bestMove(game, level, cryptoRand);
      if (m) commit(m);
      else {
        // No move at all (very rare): the turn passes.
        game = passTurn(game);
        moves.push([]);
        save();
        paint();
      }
    }, 250);
  };

  const undo = () => {
    brain.cancel();
    const list = moves.slice(0, -1);
    if (mode === "computer") while (list.length && replay(list).game.turn !== human) list.pop();
    ({ game, moves } = replay(list));
    selected = -1;
    targets = new Map();
    save();
    paint();
    queue();
  };

  const newGame = () => {
    brain.cancel();
    ({ game, moves } = replay([]));
    selected = -1;
    targets = new Map();
    focusIndex = HOME[human][0]!;
    place();
    save();
    paint();
    queue();
  };

  const sync = () => {
    levelSel.wrap.hidden = mode !== "computer";
    sideSel.wrap.hidden = mode !== "computer";
    place();
  };

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("chineseCheckers.title")),
      h("p", { class: "lede" }, t("chineseCheckers.privacyNote")),
    ),
    h("div", { class: "bg-tool" },
      h("div", { class: "bg-main" }, boardEl, statusEl),
      h("aside", { class: "rail controls" },
        modeSel.wrap, levelSel.wrap, sideSel.wrap,
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", "data-action": "new", onClick: () => newGame() }, t("chineseCheckers.newGame")),
          undoBtn,
        ),
        h("p", { class: "hint" }, t("chineseCheckers.hint")),
      ),
    ),
  );
  focusIndex = HOME[human][0]!;
  sync();
  paint();
  queue();
  mounted = { cleanup: () => brain.cancel() };
}

export function unmountChineseCheckers(): void {
  mounted?.cleanup();
  mounted = null;
}
