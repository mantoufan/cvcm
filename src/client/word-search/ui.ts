import { h } from "../dom";
import { locale, t } from "../i18n";
import { shortClock } from "../../shared/subtitles";
import { WS_LEVELS, WS_MAX_PUZZLE, WS_SIZES, WS_THEMES, generate, lineCells, matchSelection, type WsLevel, type WsPuzzle, type WsSize, type WsTheme } from "../../shared/word-search";
import { cryptoRand, readStore, writeStore } from "../game-input";

const STORE_KEY = "cvcm.wordsearch.v1";
const BEST_KEY = "cvcm.wordsearch.best";
/** The puzzle a first visit (and the prerendered page) shows. */
const START = { theme: "animals" as WsTheme, size: 10 as WsSize, level: "easy" as WsLevel, n: 1 };

type Saved = { loc: string; theme: string; size: number; level: string; n: number; found: number[]; hints: number[]; elapsed: number };

let mounted: { cleanup: () => void } | null = null;

function readSaved(): { puzzle: WsPuzzle; found: Set<number>; hints: Set<number>; elapsed: number } | null {
  const raw = readStore<Saved>(STORE_KEY);
  const loc = locale();
  // Words depend on the page language: a game saved on another language's page starts fresh here.
  if (!raw || raw.loc !== loc || !WS_THEMES.includes(raw.theme as WsTheme) || !WS_SIZES.includes(raw.size as WsSize) || !WS_LEVELS.includes(raw.level as WsLevel)) return null;
  if (!Number.isInteger(raw.n) || raw.n < 1 || raw.n > WS_MAX_PUZZLE) return null;
  const puzzle = generate(loc, raw.theme as WsTheme, raw.size as WsSize, raw.level as WsLevel, raw.n);
  const okIndex = (list: unknown, max: number) => (Array.isArray(list) ? list.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < max) : []);
  return {
    puzzle,
    found: new Set(okIndex(raw.found, puzzle.words.length)),
    hints: new Set(okIndex(raw.hints, puzzle.grid.length)),
    elapsed: Math.max(0, Number(raw.elapsed) || 0),
  };
}

export function mountWordSearch(host: HTMLElement): void {
  unmountWordSearch();
  const loc = locale();
  const saved = readSaved();
  let puzzle: WsPuzzle = saved?.puzzle ?? generate(loc, START.theme, START.size, START.level, START.n);
  let found = saved?.found ?? new Set<number>();
  let hints = saved?.hints ?? new Set<number>();
  let elapsed = saved?.elapsed ?? 0;
  let focus = 0;
  let anchor: number | null = null;
  let current: number | null = null;
  let tapStart: number | null = null;
  let drag: { pointer: number; moved: boolean } | null = null;
  let confirmNew = false;
  let message = "";
  let timer = 0;
  const best = (readStore<Record<string, number>>(BEST_KEY) ?? {}) as Record<string, number>;

  const done = () => found.size === puzzle.words.length;
  const started = () => (found.size > 0 || hints.size > 0) && !done();
  const bestKey = () => `${puzzle.size}-${puzzle.level}`;

  const select = <T extends string | number>(field: string, values: readonly T[], value: T, label: (v: T) => string) =>
    h("select", { "data-field": field, onChange: () => changeOption() }, ...values.map((v) => h("option", { value: String(v), selected: v === value }, label(v))));
  const themeSel = select("theme", WS_THEMES, puzzle.theme, (v) => t(`wordSearch.th_${v}`));
  const sizeSel = select("size", WS_SIZES, puzzle.size, (v) => t("wordSearch.sizeOption", { n: v, words: v === 10 ? 8 : v === 12 ? 10 : 14 }));
  const levelSel = select("level", WS_LEVELS, puzzle.level, (v) => t(`wordSearch.l_${v}`));
  const numInput = h("input", { type: "number", min: 1, max: WS_MAX_PUZZLE, step: 1, inputmode: "numeric", value: String(puzzle.n), "data-field": "number" }) as HTMLInputElement;
  const foundEl = h("dd", { "data-out": "found" });
  const timeEl = h("dd", { "data-out": "time", "data-volatile": "" });
  const bestEl = h("dd", { "data-out": "best" });
  const statusEl = h("p", { class: "ws-status", "aria-live": "polite", "data-out": "status" });
  const newBtn = h("button", { type: "button", class: "btn", "data-action": "new", onClick: () => askNew() });
  const hintBtn = h("button", { type: "button", class: "btn ghost", "data-action": "hint", onClick: () => hint() }, t("wordSearch.hint"));
  const playBtn = h("button", { type: "button", class: "btn ghost", "data-action": "play-number", onClick: () => {
    const n = Math.floor(Number(numInput.value));
    if (!Number.isInteger(n) || n < 1 || n > WS_MAX_PUZZLE) { message = t("wordSearch.badNumber", { max: WS_MAX_PUZZLE.toLocaleString() }); return paint(); }
    if (started() && !confirmNew) { confirmNew = true; message = t("wordSearch.confirmNew"); return paint(); }
    load(generate(loc, themeSel.value as WsTheme, Number(sizeSel.value) as WsSize, levelSel.value as WsLevel, n));
  } }, t("wordSearch.play"));
  const grid = h("div", { class: "ws-grid", role: "grid", "aria-label": t("wordSearch.board"), "data-out": "board" });
  const listEl = h("ul", { class: "ws-words", "aria-label": t("wordSearch.wordList"), "data-out": "words" });
  let cellEls: HTMLButtonElement[] = [];

  const save = () => writeStore(STORE_KEY, done() ? null : { loc, theme: puzzle.theme, size: puzzle.size, level: puzzle.level, n: puzzle.n, found: [...found], hints: [...hints], elapsed });

  const build = () => {
    grid.style.setProperty("--n", String(puzzle.size));
    grid.classList.toggle("cjk", /[^\p{Script=Latin}]/u.test(puzzle.grid.join("")));
    grid.replaceChildren();
    cellEls = [];
    for (let r = 0; r < puzzle.size; r++) {
      const row = h("div", { class: "ws-row", role: "row" });
      for (let c = 0; c < puzzle.size; c++) {
        const i = r * puzzle.size + c;
        const cell = h("button", { type: "button", class: "ws-cell", role: "gridcell", "data-cell": i, tabindex: -1 }, puzzle.grid[i]!);
        cell.addEventListener("keydown", (e) => onCellKey(e, i));
        cellEls.push(cell);
        row.append(cell);
      }
      grid.append(row);
    }
  };

  const paint = () => {
    const sel = new Set(anchor !== null && current !== null ? lineCells(puzzle.size, anchor, current) ?? [anchor] : tapStart !== null ? [tapStart] : []);
    const foundCells = new Set([...found].flatMap((i) => puzzle.words[i]!.cells));
    cellEls.forEach((el, i) => {
      el.classList.toggle("sel", sel.has(i));
      el.classList.toggle("found", foundCells.has(i));
      el.classList.toggle("hint", hints.has(i) && !foundCells.has(i));
      el.tabIndex = i === focus ? 0 : -1;
      el.setAttribute("aria-label", t("wordSearch.cell", { row: Math.floor(i / puzzle.size) + 1, col: (i % puzzle.size) + 1, letter: puzzle.grid[i]! }) + (foundCells.has(i) ? `, ${t("wordSearch.inFound")}` : ""));
      el.setAttribute("aria-pressed", String(sel.has(i)));
    });
    listEl.replaceChildren(...puzzle.words.map((w, i) => h("li", { class: found.has(i) ? "done" : "", "aria-label": found.has(i) ? t("wordSearch.wordFound", { word: w.label }) : w.label }, w.label)));
    foundEl.textContent = t("wordSearch.foundCount", { n: found.size, total: puzzle.words.length });
    timeEl.textContent = shortClock(elapsed);
    bestEl.textContent = best[bestKey()] ? shortClock(best[bestKey()]!) : "–";
    newBtn.textContent = confirmNew ? t("wordSearch.confirmNew") : t("wordSearch.newGame");
    hintBtn.disabled = done();
    numInput.value = String(puzzle.n);
    if (done()) statusEl.textContent = t("wordSearch.won", { time: shortClock(elapsed) });
    else statusEl.textContent = message;
  };

  const tick = () => {
    if (document.hidden || done()) return;
    elapsed++;
    timeEl.textContent = shortClock(elapsed);
    if (elapsed % 10 === 0) save();
  };
  const startClock = () => {
    if (!timer && !done()) timer = window.setInterval(tick, 1000);
  };

  const finish = () => {
    window.clearInterval(timer);
    timer = 0;
    const k = bestKey();
    if (!best[k] || elapsed < best[k]!) {
      best[k] = elapsed;
      writeStore(BEST_KEY, best);
    }
  };

  /** Checks a selection from `a` to `b`; marks the word found if it spells one. */
  const tryLine = (a: number, b: number) => {
    confirmNew = false;
    const cells = lineCells(puzzle.size, a, b);
    anchor = null;
    current = null;
    if (!cells || cells.length < 2) { message = cells ? "" : t("wordSearch.straight"); return paint(); }
    startClock();
    const i = matchSelection(puzzle, cells, found);
    if (i < 0) message = t("wordSearch.notWord");
    else {
      // A look-alike elsewhere counts, and the word's own place is what gets marked.
      found = new Set(found).add(i);
      message = t("wordSearch.foundWord", { word: puzzle.words[i]!.label });
      if (done()) finish();
    }
    save();
    paint();
  };

  const tap = (i: number) => {
    focus = i;
    if (done()) return paint();
    if (tapStart === null) {
      tapStart = i;
      message = t("wordSearch.pickEnd");
      return paint();
    }
    const from = tapStart;
    tapStart = null;
    if (from === i) { message = ""; return paint(); }
    tryLine(from, i);
  };

  // ---- pointer: drag from the first letter to the last, or tap one and then the other.
  const cellAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>(".ws-cell");
    return el && grid.contains(el) ? Number(el.dataset.cell) : -1;
  };
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const i = cellAt(e.clientX, e.clientY);
    if (i < 0 || done()) return;
    e.preventDefault();
    drag = { pointer: e.pointerId, moved: false };
    anchor = i;
    current = i;
    focus = i;
    grid.setPointerCapture?.(e.pointerId);
    paint();
  };
  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointer || anchor === null) return;
    const i = cellAt(e.clientX, e.clientY);
    if (i < 0 || i === current) return;
    // Only straight lines: other cells keep the last straight end.
    if (!lineCells(puzzle.size, anchor, i)) return;
    if (i !== anchor) drag.moved = true;
    current = i;
    paint();
  };
  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    const moved = drag.moved;
    drag = null;
    const a = anchor;
    const b = current;
    if (a === null || b === null) return;
    if (moved && a !== b) {
      tapStart = null;
      tryLine(a, b);
    } else {
      anchor = null;
      current = null;
      tap(a);
    }
  };
  const onCancel = () => {
    drag = null;
    anchor = null;
    current = null;
    paint();
  };
  grid.addEventListener("pointerdown", onDown);
  grid.addEventListener("pointermove", onMove);
  grid.addEventListener("pointerup", onUp);
  grid.addEventListener("pointercancel", onCancel);

  const onCellKey = (e: KeyboardEvent, i: number) => {
    const n = puzzle.size;
    const d = ({ ArrowUp: -n, ArrowDown: n, ArrowLeft: -1, ArrowRight: 1 } as Record<string, number>)[e.key];
    if (d !== undefined) {
      e.preventDefault();
      const next = i + d;
      if (next < 0 || next >= n * n || (Math.abs(d) === 1 && Math.floor(next / n) !== Math.floor(i / n))) return;
      focus = next;
      paint();
      cellEls[next]?.focus();
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      tap(i);
      cellEls[focus]?.focus();
    } else if (e.key === "Escape" && tapStart !== null) {
      tapStart = null;
      message = "";
      paint();
    }
  };

  const hint = () => {
    if (done()) return;
    // The first letter of the first word not yet found or hinted; then the next one.
    const w = puzzle.words.find((word, i) => !found.has(i) && !hints.has(word.cells[0]!)) ?? puzzle.words.find((_, i) => !found.has(i));
    if (!w) return;
    hints = new Set(hints).add(w.cells[0]!);
    message = t("wordSearch.hintShown", { word: w.label });
    startClock();
    save();
    paint();
  };

  const load = (next: WsPuzzle) => {
    window.clearInterval(timer);
    timer = 0;
    puzzle = next;
    found = new Set();
    hints = new Set();
    elapsed = 0;
    focus = 0;
    anchor = null;
    current = null;
    tapStart = null;
    confirmNew = false;
    message = "";
    themeSel.value = puzzle.theme;
    sizeSel.value = String(puzzle.size);
    levelSel.value = puzzle.level;
    build();
    save();
    paint();
  };

  const fresh = () => load(generate(loc, themeSel.value as WsTheme, Number(sizeSel.value) as WsSize, levelSel.value as WsLevel, 1 + Math.floor(cryptoRand() * WS_MAX_PUZZLE)));

  /** A theme, size or level picked mid-game waits for New puzzle; otherwise a new puzzle starts at once. */
  const changeOption = () => {
    if (started()) {
      message = t("wordSearch.optionNext");
      return paint();
    }
    fresh();
  };

  const askNew = () => {
    if (started() && !confirmNew) {
      confirmNew = true;
      return paint();
    }
    fresh();
  };

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("wordSearch.title")),
      h("p", { class: "lede" }, t("wordSearch.privacyNote")),
    ),
    h("div", { class: "ws-tool" },
      h("div", { class: "ws-main" },
        h("dl", { class: "stats-grid ws-stats" },
          h("dt", null, t("wordSearch.found")), foundEl,
          h("dt", null, t("wordSearch.time")), timeEl,
          h("dt", null, t("wordSearch.best")), bestEl,
        ),
        h("div", { class: "ws-wrap" }, grid),
        statusEl,
        h("h2", { class: "ws-words-title" }, t("wordSearch.wordList")),
        listEl,
      ),
      h("aside", { class: "rail controls" },
        h("label", { class: "field" }, h("span", null, t("wordSearch.theme")), themeSel),
        h("label", { class: "field" }, h("span", null, t("wordSearch.size")), sizeSel),
        h("label", { class: "field" }, h("span", null, t("wordSearch.level")), levelSel),
        h("div", { class: "stage-actions" }, newBtn, hintBtn),
        h("div", { class: "ws-number" }, h("label", { class: "field" }, h("span", null, t("wordSearch.number")), numInput), playBtn),
        h("p", { class: "hint" }, t("wordSearch.help")),
      ),
    ),
  );
  build();
  paint();
  if (started()) startClock();
  // The clock is saved every 10 s; also save it when the tab is hidden and when the page is left.
  const onHide = () => { if (document.hidden && started() && !done()) save(); };
  document.addEventListener("visibilitychange", onHide);
  mounted = {
    cleanup: () => {
      if (started() && !done()) save();
      document.removeEventListener("visibilitychange", onHide);
      window.clearInterval(timer);
      timer = 0;
    },
  };
}

export function unmountWordSearch(): void {
  mounted?.cleanup();
  mounted = null;
}
