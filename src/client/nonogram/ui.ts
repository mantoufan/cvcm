import { h } from "../dom";
import { t } from "../i18n";
import { shortClock } from "../../shared/subtitles";
import { MAX_PUZZLE, SIZES, generate, isSolved, lineDone, rowOf, colOf, type Puzzle, type Size } from "../../shared/nonogram";
import { cryptoRand, onScreen, readStore, typingTarget, writeStore } from "../game-input";

const STORE_KEY = "cvcm.nonogram.v1";
const BEST_KEY = "cvcm.nonogram.best";
/** A touch held this long marks a cross instead of filling. */
const LONG_PRESS_MS = 400;
/** The puzzle a first visit (and the prerendered page) shows. */
const START = { size: 5 as Size, n: 1 };

type Saved = { size: number; n: number; cells: string; elapsed: number };
type Mark = 0 | 1 | 2;

let mounted: { cleanup: () => void } | null = null;

function readSaved(): { puzzle: Puzzle; cells: Mark[]; elapsed: number } | null {
  const raw = readStore<Saved>(STORE_KEY);
  if (!raw || !SIZES.includes(raw.size as Size) || !Number.isInteger(raw.n) || raw.n < 1 || raw.n > MAX_PUZZLE) return null;
  const size = raw.size as Size;
  if (typeof raw.cells !== "string" || !new RegExp(`^[012]{${size * size}}$`).test(raw.cells)) return null;
  return { puzzle: generate(size, raw.n), cells: [...raw.cells].map(Number) as Mark[], elapsed: Math.max(0, Number(raw.elapsed) || 0) };
}

export function mountNonogram(host: HTMLElement): void {
  unmountNonogram();
  const saved = readSaved();
  let puzzle: Puzzle = saved?.puzzle ?? generate(START.size, START.n);
  let cells: Mark[] = saved?.cells ?? new Array<Mark>(puzzle.size * puzzle.size).fill(0);
  let elapsed = saved?.elapsed ?? 0;
  let undo: Mark[][] = [];
  let crossMode = false;
  let checkMistakes = false;
  let focus = 0;
  let confirmNew = false;
  let message = "";
  let done = isSolved(cells, puzzle.solution);
  let stroke: { from: number; mark: Mark; axis: "row" | "col" | null; pointer: number; timer: number; moved: boolean; before: Mark[] } | null = null;
  const best = (readStore<Record<string, number>>(BEST_KEY) ?? {}) as Record<string, number>;

  const started = () => cells.some(Boolean) && !done;

  const sizeSel = h("select", { "data-field": "size", onChange: () => {
    if (started()) { message = t("nonogram.sizeNext"); paint(); return; }
    load(generate(Number(sizeSel.value) as Size, 1 + Math.floor(cryptoRand() * MAX_PUZZLE)));
  } }, ...SIZES.map((s) => h("option", { value: String(s), selected: s === puzzle.size }, t("nonogram.sizeOption", { n: s }))));
  const numInput = h("input", { type: "number", min: 1, max: MAX_PUZZLE, step: 1, inputmode: "numeric", value: String(puzzle.n), "data-field": "number" }) as HTMLInputElement;
  const timeEl = h("dd", { "data-out": "time", "data-volatile": "" });
  const bestEl = h("dd", { "data-out": "best" });
  const numEl = h("dd", { "data-out": "number" });
  const statusEl = h("p", { class: "nono-status", "aria-live": "polite", "data-out": "status" });
  const newBtn = h("button", { type: "button", class: "btn", "data-action": "new", onClick: () => askNew() });
  const undoBtn = h("button", { type: "button", class: "btn ghost", "data-action": "undo", onClick: () => doUndo() }, t("nonogram.undo"));
  const clearBtn = h("button", { type: "button", class: "btn ghost", "data-action": "clear", onClick: () => { if (cells.some(Boolean) && !done) { push(); cells = cells.map(() => 0 as Mark); save(); paint(); } } }, t("nonogram.clear"));
  const crossBtn = h("button", { type: "button", class: "btn ghost", "data-action": "cross-mode", "aria-pressed": "false", onClick: () => { crossMode = !crossMode; paint(); } });
  const checkBox = h("input", { type: "checkbox", "data-field": "check", onChange: () => { checkMistakes = checkBox.checked; paint(); } }) as HTMLInputElement;
  const playBtn = h("button", { type: "button", class: "btn ghost", "data-action": "play-number", onClick: () => {
    const n = Math.floor(Number(numInput.value));
    if (!Number.isInteger(n) || n < 1 || n > MAX_PUZZLE) { message = t("nonogram.badNumber", { max: MAX_PUZZLE.toLocaleString() }); return paint(); }
    load(generate(Number(sizeSel.value) as Size, n));
  } }, t("nonogram.play"));
  const grid = h("div", { class: "nono-grid", role: "grid", "aria-label": t("nonogram.board"), "data-out": "board" });
  let cellEls: HTMLButtonElement[] = [];
  let rowClueEls: HTMLElement[] = [];
  let colClueEls: HTMLElement[] = [];

  const save = () => writeStore(STORE_KEY, done ? null : { size: puzzle.size, n: puzzle.n, cells: cells.join(""), elapsed });
  const push = () => {
    undo.push(cells.slice());
    if (undo.length > 1000) undo.shift();
  };

  const build = () => {
    const size = puzzle.size;
    grid.style.setProperty("--n", String(size));
    grid.replaceChildren();
    cellEls = [];
    rowClueEls = [];
    colClueEls = [];
    const corner = h("div", { class: "nono-corner", "aria-hidden": "true" });
    const head = h("div", { class: "nono-row nono-head", role: "row" }, corner);
    for (let c = 0; c < size; c++) {
      const clue = puzzle.cols[c]!;
      const el = h("div", { class: "nono-clue col", role: "columnheader", "aria-label": t("nonogram.colClue", { n: c + 1, clue: clue.length ? clue.join(" ") : "0" }) },
        ...(clue.length ? clue : [0]).map((v) => h("span", null, String(v))));
      colClueEls.push(el);
      head.append(el);
    }
    grid.append(head);
    for (let r = 0; r < size; r++) {
      const clue = puzzle.rows[r]!;
      const rc = h("div", { class: "nono-clue row", role: "rowheader", "aria-label": t("nonogram.rowClue", { n: r + 1, clue: clue.length ? clue.join(" ") : "0" }) },
        ...(clue.length ? clue : [0]).map((v) => h("span", null, String(v))));
      rowClueEls.push(rc);
      const row = h("div", { class: "nono-row", role: "row" }, rc);
      for (let c = 0; c < size; c++) {
        const i = r * size + c;
        const cell = h("button", { type: "button", class: "nono-cell", role: "gridcell", "data-cell": i, tabindex: -1 });
        // Thicker lines every five cells, as on paper.
        if (c % 5 === 4 && c !== size - 1) cell.classList.add("edge-r");
        if (r % 5 === 4 && r !== size - 1) cell.classList.add("edge-b");
        cell.addEventListener("keydown", (e) => onCellKey(e, i));
        cellEls.push(cell);
        row.append(cell);
      }
      grid.append(row);
    }
  };

  const paint = () => {
    const size = puzzle.size;
    cellEls.forEach((el, i) => {
      const m = cells[i]!;
      el.classList.toggle("on", m === 1 || (done && puzzle.solution[i] === 1));
      el.classList.toggle("x", m === 2 && !done);
      el.classList.toggle("bad", checkMistakes && !done && ((m === 1 && puzzle.solution[i] !== 1) || (m === 2 && puzzle.solution[i] === 1)));
      el.tabIndex = i === focus ? 0 : -1;
      const state = m === 1 ? t("nonogram.filled") : m === 2 ? t("nonogram.crossed") : t("nonogram.blank");
      el.setAttribute("aria-label", t("nonogram.cell", { row: Math.floor(i / size) + 1, col: (i % size) + 1, state }));
      el.disabled = done;
    });
    rowClueEls.forEach((el, r) => el.classList.toggle("done", lineDone(rowOf(cells, size, r), puzzle.rows[r]!)));
    colClueEls.forEach((el, c) => el.classList.toggle("done", lineDone(colOf(cells, size, c), puzzle.cols[c]!)));
    grid.classList.toggle("won", done);
    timeEl.textContent = shortClock(elapsed);
    const b = best[String(size)];
    bestEl.textContent = b ? shortClock(b) : "–";
    numEl.textContent = t("nonogram.puzzleNo", { size, n: puzzle.n });
    crossBtn.textContent = crossMode ? t("nonogram.crossOn") : t("nonogram.crossOff");
    crossBtn.setAttribute("aria-pressed", String(crossMode));
    newBtn.textContent = confirmNew ? t("nonogram.confirmNew") : t("nonogram.newPuzzle");
    undoBtn.disabled = !undo.length || done;
    statusEl.textContent = done ? t("nonogram.won", { time: shortClock(elapsed) }) : message;
  };

  const finishIfSolved = () => {
    if (!isSolved(cells, puzzle.solution)) return;
    done = true;
    stopClock();
    const key = String(puzzle.size);
    if (!best[key] || elapsed < best[key]!) {
      best[key] = elapsed;
      writeStore(BEST_KEY, best);
    }
  };

  /** Sets cell `i` to `mark` (no undo step; strokes push one before they start). */
  const setCell = (i: number, mark: Mark) => {
    if (cells[i] === mark) return false;
    cells[i] = mark;
    startClock();
    return true;
  };

  const commitChange = () => {
    message = "";
    confirmNew = false;
    finishIfSolved();
    save();
    paint();
  };

  /** One tap or key press: toggles the cell to `tool` (or back to blank). */
  const act = (i: number, tool: 1 | 2) => {
    if (done) return;
    push();
    setCell(i, cells[i] === tool ? 0 : tool);
    commitChange();
  };

  // ---- pointer strokes: the first cell decides the mark; dragging paints that mark along one row or column.
  const cellAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>(".nono-cell");
    return el && grid.contains(el) ? Number(el.dataset.cell) : -1;
  };
  const onDown = (e: PointerEvent) => {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(".nono-cell");
    if (!el || done || (e.button !== 0 && e.button !== 2)) return;
    e.preventDefault();
    const i = Number(el.dataset.cell);
    focus = i;
    const tool: 1 | 2 = e.button === 2 || crossMode ? 2 : 1;
    const before = cells.slice();
    const mark: Mark = cells[i] === tool ? 0 : tool;
    stroke = { from: i, mark, axis: null, pointer: e.pointerId, timer: 0, moved: false, before };
    setCell(i, mark);
    paint();
    // A touch held still turns the stroke into a cross.
    if (e.pointerType !== "mouse" && tool === 1) {
      stroke.timer = window.setTimeout(() => {
        if (!stroke || stroke.moved) return;
        const m: Mark = before[i] === 2 ? 0 : 2;
        stroke.mark = m;
        cells[i] = m;
        paint();
      }, LONG_PRESS_MS);
    }
    grid.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!stroke || e.pointerId !== stroke.pointer) return;
    const i = cellAt(e.clientX, e.clientY);
    if (i < 0 || i === stroke.from) return;
    const size = puzzle.size;
    const fr = Math.floor(stroke.from / size);
    const fc = stroke.from % size;
    const r = Math.floor(i / size);
    const c = i % size;
    stroke.moved = true;
    window.clearTimeout(stroke.timer);
    if (!stroke.axis) stroke.axis = r === fr ? "row" : c === fc ? "col" : Math.abs(r - fr) < Math.abs(c - fc) ? "row" : "col";
    // Paint from the start cell to the pointer along the locked line, leaving cells the stroke did not reach as they were.
    cells = stroke.before.slice();
    const from = stroke.axis === "row" ? fc : fr;
    const to = stroke.axis === "row" ? c : r;
    for (let k = Math.min(from, to); k <= Math.max(from, to); k++) {
      const j = stroke.axis === "row" ? fr * size + k : k * size + fc;
      // Painting never overwrites the other kind of mark: filling skips crosses and crossing skips fills.
      if (stroke.mark === 0 ? cells[j] === stroke.before[stroke.from] : cells[j] === 0 || cells[j] === stroke.mark) cells[j] = stroke.mark;
    }
    focus = i;
    paint();
  };
  const onUp = (e: PointerEvent) => {
    if (!stroke || e.pointerId !== stroke.pointer) return;
    window.clearTimeout(stroke.timer);
    const changed = cells.some((v, i) => v !== stroke!.before[i]);
    if (changed) {
      undo.push(stroke.before);
      startClock();
    }
    stroke = null;
    commitChange();
  };
  grid.addEventListener("pointerdown", onDown);
  grid.addEventListener("pointermove", onMove);
  grid.addEventListener("pointerup", onUp);
  grid.addEventListener("pointercancel", onUp);
  grid.addEventListener("contextmenu", (e) => e.preventDefault());

  const onCellKey = (e: KeyboardEvent, i: number) => {
    const size = puzzle.size;
    const r = Math.floor(i / size);
    const c = i % size;
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const d = moves[e.key];
    if (d) {
      e.preventDefault();
      const nr = Math.min(size - 1, Math.max(0, r + d[0]));
      const nc = Math.min(size - 1, Math.max(0, c + d[1]));
      focus = nr * size + nc;
      paint();
      cellEls[focus]?.focus();
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      act(i, crossMode ? 2 : 1);
    } else if (e.key.toLowerCase() === "x") {
      e.preventDefault();
      act(i, 2);
    }
  };

  const doUndo = () => {
    const prev = undo.pop();
    if (!prev || done) return;
    cells = prev;
    message = "";
    save();
    paint();
  };

  let timer = 0;
  const tick = () => {
    if (document.hidden || done) return;
    elapsed++;
    timeEl.textContent = shortClock(elapsed);
    if (elapsed % 10 === 0) save();
  };
  const startClock = () => {
    if (!timer && !done) timer = window.setInterval(tick, 1000);
  };
  const stopClock = () => {
    if (timer) window.clearInterval(timer);
    timer = 0;
  };

  const load = (p: Puzzle) => {
    stopClock();
    puzzle = p;
    cells = new Array<Mark>(p.size * p.size).fill(0);
    elapsed = 0;
    undo = [];
    done = false;
    focus = 0;
    confirmNew = false;
    message = "";
    sizeSel.value = String(p.size);
    numInput.value = String(p.n);
    build();
    save();
    paint();
  };

  const askNew = () => {
    if (started() && !confirmNew) {
      confirmNew = true;
      return paint();
    }
    load(generate(Number(sizeSel.value) as Size, 1 + Math.floor(cryptoRand() * MAX_PUZZLE)));
  };

  const onDocKey = (e: KeyboardEvent) => {
    if (typingTarget(e.target) || e.altKey) return;
    // Page-wide undo only while the puzzle is on screen or focused (game-input.ts convention).
    if (!grid.contains(document.activeElement) && !onScreen(grid)) return;
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
      e.preventDefault();
      doUndo();
    }
  };
  document.addEventListener("keydown", onDocKey);

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("nonogram.title")),
      h("p", { class: "lede" }, t("nonogram.privacyNote")),
    ),
    h("div", { class: "nono-tool" },
      h("div", { class: "nono-main" },
        h("dl", { class: "stats-grid nono-stats" },
          h("dt", null, t("nonogram.puzzle")), numEl,
          h("dt", null, t("nonogram.time")), timeEl,
          h("dt", null, t("nonogram.best")), bestEl,
        ),
        h("div", { class: "nono-wrap" }, grid),
        statusEl,
      ),
      h("aside", { class: "rail controls" },
        h("label", { class: "field" }, h("span", null, t("nonogram.size")), sizeSel),
        h("div", { class: "stage-actions" }, newBtn, undoBtn, clearBtn, crossBtn),
        h("label", { class: "check" }, checkBox, h("span", null, t("nonogram.check"))),
        h("div", { class: "nono-number" }, h("label", { class: "field" }, h("span", null, t("nonogram.numberLabel")), numInput), playBtn),
        h("p", { class: "hint" }, t("nonogram.hint")),
      ),
    ),
  );
  build();
  paint();
  mounted = {
    cleanup: () => {
      stopClock();
      if (stroke) window.clearTimeout(stroke.timer);
      stroke = null;
      document.removeEventListener("keydown", onDocKey);
    },
  };
}

export function unmountNonogram(): void {
  mounted?.cleanup();
  mounted = null;
}
