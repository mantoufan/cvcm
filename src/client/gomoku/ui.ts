import { h } from "../dom";
import { t } from "../i18n";
import { cryptoRand, readStore, writeStore } from "../game-input";
import { MODES, buttonGrid, pointName, selectField, thinker, type Mode } from "../board-game";
import { GOMOKU_LEVELS, N, bestMove, play, replay, result, type Level, type Side } from "../../shared/gomoku";

/** Gomoku (five in a row) against the computer or a friend, written for cv.cm (rules in src/shared/gomoku.ts). */

const STORE_KEY = "cvcm.gomoku.v1";
type Saved = { moves: number[]; mode: Mode; level: Level; side: Side };

let mounted: { cleanup: () => void } | null = null;

/** The grid lines and the five marked points, in a 0..N-1 coordinate space. */
function lines(): SVGSVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const art = document.createElementNS(NS, "svg");
  art.setAttribute("viewBox", `-0.5 -0.5 ${N} ${N}`);
  art.setAttribute("class", "gm-lines");
  art.setAttribute("aria-hidden", "true");
  for (let i = 0; i < N; i++) {
    for (const [x1, y1, x2, y2] of [[0, i, N - 1, i], [i, 0, i, N - 1]] as const) {
      const l = document.createElementNS(NS, "line");
      l.setAttribute("x1", String(x1));
      l.setAttribute("y1", String(y1));
      l.setAttribute("x2", String(x2));
      l.setAttribute("y2", String(y2));
      art.append(l);
    }
  }
  for (const [x, y] of [[3, 3], [11, 3], [7, 7], [3, 11], [11, 11]]) {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", String(x));
    c.setAttribute("cy", String(y));
    c.setAttribute("r", "0.12");
    art.append(c);
  }
  return art;
}

export function mountGomoku(host: HTMLElement): void {
  unmountGomoku();
  const saved = readStore<Saved>(STORE_KEY);
  let mode: Mode = saved?.mode === "friend" ? "friend" : "computer";
  let level: Level = GOMOKU_LEVELS.includes(saved?.level as Level) ? saved!.level : "medium";
  let human: Side = saved?.side === -1 ? -1 : 1;
  let { game, moves } = replay(Array.isArray(saved?.moves) ? saved!.moves : []);
  const brain = thinker();

  const sideName = (s: Side) => t(s === 1 ? "gomoku.black" : "gomoku.white");
  const computerTurn = () => mode === "computer" && game.turn !== human && !result(game);
  const save = () => writeStore(STORE_KEY, { moves, mode, level, side: human });

  const modeSel = selectField("gomoku", "mode", MODES, mode, (m) => t(`gomoku.m_${m}`), (m) => { brain.cancel(); mode = m; sync(); save(); paint(); queue(); });
  const levelSel = selectField("gomoku", "level", GOMOKU_LEVELS, level, (l) => t(`gomoku.l_${l}`), (l) => { level = l; save(); });
  const sideSel = selectField("gomoku", "side", ["1", "-1"] as const, String(human) as "1" | "-1", (s) => t(s === "1" ? "gomoku.playBlack" : "gomoku.playWhite"), (s) => { human = Number(s) as Side; newGame(); });
  const statusEl = h("p", { class: "bg-status", "aria-live": "polite", "data-out": "status" });
  const undoBtn = h("button", { type: "button", class: "btn ghost", "data-action": "undo", onClick: () => undo() }, t("gomoku.undo"));
  const points = h("div", { class: "gm-points", role: "grid", "aria-label": t("gomoku.board") });
  const boardEl = h("div", { class: "gm-board", "data-out": "board" }, lines(), points);
  const grid = buttonGrid(points, N, "gm-pt", (row, col) => row * N + col, (i) => tap(i));

  const paint = () => {
    const r = result(game);
    const line = new Set(r?.line ?? []);
    for (const [p, cell] of grid.cells) {
      const s = game.board[p]!;
      cell.replaceChildren();
      if (s) cell.append(h("span", { class: `gm-stone ${s > 0 ? "black" : "white"}`, "aria-hidden": "true" }));
      cell.classList.toggle("last", p === game.last);
      cell.classList.toggle("win", line.has(p));
      const what = s ? t(s > 0 ? "gomoku.stoneBlack" : "gomoku.stoneWhite") : t("gomoku.empty");
      cell.setAttribute("aria-label", `${pointName(p, N, true)} ${what}${p === game.last ? `, ${t("gomoku.lastMove")}` : ""}`);
    }
    if (r) {
      if (r.winner === 0) statusEl.textContent = t("gomoku.draw");
      else if (mode === "computer") statusEl.textContent = r.winner === human ? t("gomoku.youWin") : t("gomoku.computerWins");
      else statusEl.textContent = t("gomoku.wins", { side: sideName(r.winner) });
    } else if (brain.busy || computerTurn()) statusEl.textContent = t("gomoku.thinking");
    else statusEl.textContent = t("gomoku.toMove", { side: sideName(game.turn) });
    undoBtn.disabled = !moves.length;
  };

  const commit = (p: number) => {
    const next = play(game, p);
    if (!next) return;
    game = next;
    moves.push(p);
    save();
    paint();
    queue();
  };

  const tap = (p: number) => {
    if (result(game) || computerTurn() || game.board[p] !== 0) return;
    commit(p);
  };

  const queue = () => {
    if (!computerTurn()) return;
    paint();
    brain.run(() => {
      const p = bestMove(game, level, cryptoRand);
      if (p !== null) commit(p);
      else paint();
    }, 200);
  };

  const undo = () => {
    brain.cancel();
    const list = moves.slice(0, -1);
    if (mode === "computer") while (list.length && replay(list).game.turn !== human) list.pop();
    ({ game, moves } = replay(list));
    save();
    paint();
    queue();
  };

  const newGame = () => {
    brain.cancel();
    ({ game, moves } = replay([]));
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
      h("h1", null, t("gomoku.title")),
      h("p", { class: "lede" }, t("gomoku.privacyNote")),
    ),
    h("div", { class: "bg-tool" },
      h("div", { class: "bg-main" }, boardEl, statusEl),
      h("aside", { class: "rail controls" },
        modeSel.wrap, levelSel.wrap, sideSel.wrap,
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", "data-action": "new", onClick: () => newGame() }, t("gomoku.newGame")),
          undoBtn,
        ),
        h("p", { class: "hint" }, t("gomoku.hint")),
      ),
    ),
  );
  grid.build();
  grid.focus(7 * N + 7);
  sync();
  paint();
  queue();
  mounted = { cleanup: () => brain.cancel() };
}

export function unmountGomoku(): void {
  mounted?.cleanup();
  mounted = null;
}
