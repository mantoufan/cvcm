import { h } from "../dom";
import { t } from "../i18n";
import { randomBelow } from "../../shared/random";
import { shortClock } from "../../shared/subtitles";
import { LEVELS, LIMITS, chord, clampSize, count, flagsLeft, newBoard, reveal, toggleFlag, type Board, type LevelId } from "../../shared/minesweeper";
import { readStore, writeStore } from "../game-input";

const BEST_KEY = "cvcm.minesweeper.best";
const LEVEL_IDS: readonly LevelId[] = ["beginner", "intermediate", "expert", "custom"];
/** A touch held this long flags instead of revealing. */
const LONG_PRESS_MS = 400;

let mounted: { cleanup: () => void } | null = null;

export function mountMinesweeper(host: HTMLElement): void {
  unmountMinesweeper();
  // A first visit (and the prerendered page) is an empty beginner board: mines are laid on the first reveal.
  let level: LevelId = "beginner";
  let custom = { rows: 16, cols: 30, mines: 60 };
  let board: Board = newBoard(9, 9, 10);
  let elapsed = 0;
  let timer = 0;
  let flagMode = false;
  let focus = 0;
  const best = (readStore<Record<string, number>>(BEST_KEY) ?? {}) as Record<string, number>;

  const levelSel = h("select", { "data-field": "level", onChange: () => { level = levelSel.value as LevelId; sync(); restart(); } },
    ...LEVEL_IDS.map((l) => h("option", { value: l, selected: l === level }, t(`minesweeper.l_${l}`))));
  const num = (field: "rows" | "cols" | "mines", min: number, max: number) =>
    h("input", { type: "number", inputmode: "numeric", min, max, value: custom[field], "data-field": field, onChange: () => readCustom() });
  const rowsIn = num("rows", LIMITS.minRows, LIMITS.maxRows);
  const colsIn = num("cols", LIMITS.minCols, LIMITS.maxCols);
  const minesIn = num("mines", 1, LIMITS.maxRows * LIMITS.maxCols - 9);
  const customBox = h("div", { class: "ms-custom", hidden: true },
    h("label", { class: "field" }, h("span", null, t("minesweeper.rows")), rowsIn),
    h("label", { class: "field" }, h("span", null, t("minesweeper.cols")), colsIn),
    h("label", { class: "field" }, h("span", null, t("minesweeper.mines")), minesIn),
  );
  const minesEl = h("dd", { "data-out": "mines" });
  const timeEl = h("dd", { "data-out": "time" });
  const bestEl = h("dd", { "data-out": "best" });
  const statusEl = h("p", { class: "ms-status", "aria-live": "polite", "data-out": "status" });
  const flagBtn = h("button", { type: "button", class: "btn ghost", "data-action": "flag-mode", "aria-pressed": "false", onClick: () => { flagMode = !flagMode; paint(); } });
  const grid = h("div", { class: "ms-grid", role: "grid", "aria-label": t("minesweeper.board"), "data-out": "board" });
  let cells: HTMLButtonElement[] = [];

  const readCustom = () => {
    custom = clampSize(Number(rowsIn.value), Number(colsIn.value), Number(minesIn.value));
    rowsIn.value = String(custom.rows);
    colsIn.value = String(custom.cols);
    minesIn.value = String(custom.mines);
    if (level === "custom") restart();
  };

  const size = () => (level === "custom" ? custom : LEVELS[level]);

  const stopClock = () => {
    if (timer) window.clearInterval(timer);
    timer = 0;
  };

  const build = () => {
    grid.replaceChildren();
    grid.style.setProperty("--cols", String(board.cols));
    cells = [];
    for (let r = 0; r < board.rows; r++) {
      const row = h("div", { class: "ms-row", role: "row" });
      for (let c = 0; c < board.cols; c++) {
        const i = r * board.cols + c;
        const cell = h("button", { type: "button", role: "gridcell", class: "ms-cell", "data-cell": i, tabindex: -1 });
        cells.push(cell);
        row.append(cell);
      }
      grid.append(row);
    }
  };

  const paint = () => {
    const over = board.status === "won" || board.status === "lost";
    board.state.forEach((s, i) => {
      const el = cells[i]!;
      const mine = !!board.mine[i];
      let text = "";
      let cls = "ms-cell";
      let label: string;
      if (s === "open") {
        cls += " open";
        if (mine) {
          text = "✹";
          cls += i === board.hit ? " hit" : " mine";
          label = t("minesweeper.cellMine");
        } else {
          const n = count(board, i);
          text = n ? String(n) : "";
          if (n) cls += ` n${n}`;
          label = n ? String(n) : t("minesweeper.cellEmpty");
        }
      } else if (s === "flag") {
        text = "⚑";
        cls += " flag";
        // After a loss, a flag on a safe cell was wrong.
        if (board.status === "lost" && !mine) cls += " wrong";
        label = t("minesweeper.cellFlag");
      } else if (board.status === "lost" && mine) {
        text = "✹";
        cls += " mine";
        label = t("minesweeper.cellMine");
      } else label = t("minesweeper.cellHidden");
      el.className = cls;
      el.textContent = text;
      el.tabIndex = i === focus ? 0 : -1;
      const r = Math.floor(i / board.cols) + 1;
      const c = (i % board.cols) + 1;
      el.setAttribute("aria-label", t("minesweeper.cell", { row: r, col: c, value: label }));
      el.setAttribute("aria-disabled", String(over));
    });
    minesEl.textContent = String(flagsLeft(board));
    timeEl.textContent = shortClock(elapsed);
    const b = best[key()];
    bestEl.textContent = b ? shortClock(b) : "–";
    flagBtn.textContent = flagMode ? t("minesweeper.flagModeOn") : t("minesweeper.flagModeOff");
    flagBtn.setAttribute("aria-pressed", String(flagMode));
    flagBtn.classList.toggle("ghost", !flagMode);
    statusEl.textContent = board.status === "won" ? t("minesweeper.won", { time: shortClock(elapsed) })
      : board.status === "lost" ? t("minesweeper.lost")
      : board.status === "ready" ? t("minesweeper.ready") : "";
  };

  /** Best times are kept per level; a custom size has its own entry. */
  const key = () => (level === "custom" ? `custom-${board.rows}x${board.cols}x${board.mines}` : level);

  const apply = (next: Board) => {
    if (next === board) return;
    const was = board.status;
    board = next;
    if (was === "ready" && board.status === "playing" && !timer) timer = window.setInterval(tick, 1000);
    if (board.status === "won" || board.status === "lost") {
      stopClock();
      if (board.status === "won" && (!best[key()] || elapsed < best[key()]!)) {
        best[key()] = Math.max(1, elapsed);
        writeStore(BEST_KEY, best);
      }
    }
    paint();
  };

  const tick = () => {
    if (document.hidden || board.status !== "playing") return;
    elapsed++;
    timeEl.textContent = shortClock(elapsed);
  };

  const act = (i: number, flag: boolean) => {
    focus = i;
    if (board.status === "won" || board.status === "lost") return;
    if (flag) apply(toggleFlag(board, i));
    else if (board.state[i] === "open") apply(chord(board, i));
    else apply(reveal(board, i, (n) => randomBelow(n)));
  };

  const restart = () => {
    stopClock();
    const s = size();
    board = newBoard(s.rows, s.cols, s.mines);
    elapsed = 0;
    focus = 0;
    build();
    paint();
  };

  const sync = () => {
    customBox.hidden = level !== "custom";
  };

  // Pointer input: a click reveals (or flags in Flag mode), right click flags, a long touch flags.
  let press: { i: number; timer: number; fired: boolean } | null = null;
  const cellOf = (e: Event) => {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(".ms-cell");
    return el ? Number(el.dataset.cell) : -1;
  };
  grid.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const i = cellOf(e);
    if (i < 0) return;
    // Touch browsers fire their own long-press contextmenu at about the same time as our timer: whichever comes
    // first flags, the other does nothing (otherwise the square would be flagged and unflagged at once).
    if (press) {
      window.clearTimeout(press.timer);
      if (!press.fired) {
        press.fired = true;
        act(i, true);
      }
      return;
    }
    act(i, true);
  });
  grid.addEventListener("pointerdown", (e) => {
    const i = cellOf(e);
    if (i < 0 || e.pointerType === "mouse") return;
    if (press) window.clearTimeout(press.timer);
    press = { i, fired: false, timer: window.setTimeout(() => {
      if (!press) return;
      press.fired = true;
      act(i, true);
    }, LONG_PRESS_MS) };
  });
  const endPress = () => {
    if (press) window.clearTimeout(press.timer);
  };
  grid.addEventListener("pointerup", endPress);
  grid.addEventListener("pointercancel", () => { endPress(); press = null; });
  grid.addEventListener("click", (e) => {
    const i = cellOf(e);
    if (i < 0) return;
    // A long press already flagged; the click that follows it does nothing.
    if (press?.fired && press.i === i) {
      press = null;
      return;
    }
    press = null;
    act(i, flagMode);
  });
  grid.addEventListener("keydown", (e) => {
    const i = cellOf(e);
    if (i < 0) return;
    const d = { ArrowUp: -board.cols, ArrowDown: board.cols, ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (d !== undefined) {
      e.preventDefault();
      const col = i % board.cols;
      if ((e.key === "ArrowLeft" && col === 0) || (e.key === "ArrowRight" && col === board.cols - 1)) return;
      const j = i + d;
      if (j < 0 || j >= board.rows * board.cols) return;
      focus = j;
      paint();
      cells[j]?.focus();
    } else if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      act(i, true);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      act(i, false);
    }
  });

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("minesweeper.title")),
      h("p", { class: "lede" }, t("minesweeper.privacyNote")),
    ),
    h("div", { class: "ms-tool" },
      h("div", { class: "ms-main" },
        h("dl", { class: "stats-grid ms-stats" },
          h("dt", null, t("minesweeper.minesLeft")), minesEl,
          h("dt", null, t("minesweeper.time")), timeEl,
          h("dt", null, t("minesweeper.best")), bestEl,
        ),
        h("div", { class: "ms-wrap" }, grid),
        statusEl,
      ),
      h("aside", { class: "rail controls" },
        h("label", { class: "field" }, h("span", null, t("minesweeper.level")), levelSel),
        customBox,
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", "data-action": "new", onClick: () => restart() }, t("minesweeper.newGame")),
          flagBtn,
        ),
        h("p", { class: "hint" }, t("minesweeper.hint")),
      ),
    ),
  );
  sync();
  build();
  paint();
  mounted = {
    cleanup: () => {
      stopClock();
      if (press) window.clearTimeout(press.timer);
      press = null;
    },
  };
}

export function unmountMinesweeper(): void {
  mounted?.cleanup();
  mounted = null;
}
