import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { t } from "../i18n";
import { randomBelow } from "../../shared/random";
import { shortClock } from "../../shared/subtitles";
import { LEVELS, MAX_SEED, PEERS, bitCount, boxOf, candidates, colOf, conflicts, generate, rowOf, toLine, type Level, type Puzzle } from "../../shared/sudoku";

const STORE_KEY = "cvcm.sudoku.v1";
/** The puzzle a first visit (and the prerendered page) starts on, so the page is the same before and after mount. */
const START = { seed: 2027, level: "medium" as Level };
const UNDO_LIMIT = 300;

type Saved = { seed: number; level: Level; cells: number[]; notes: number[]; elapsed: number; hints: number };
type Snapshot = { cells: number[]; notes: number[]; elapsed: number; hints: number };

let mounted: { cleanup: () => void } | null = null;

/** "4:05" or "1:02:05" (the subtitle tools' clock). */
export const clock = shortClock;

function readSaved(): Saved | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "null") as Partial<Saved> | null;
    if (!raw || !LEVELS.includes(raw.level as Level) || !Number.isInteger(raw.seed)) return null;
    const cells = raw.cells;
    const notes = raw.notes;
    const okList = (l: unknown, max: number) => Array.isArray(l) && l.length === 81 && l.every((v) => Number.isInteger(v) && v >= 0 && v <= max);
    if (!okList(cells, 9) || !okList(notes, 0x1ff)) return null;
    return { seed: raw.seed!, level: raw.level as Level, cells: cells!, notes: notes!, elapsed: Math.max(0, Number(raw.elapsed) || 0), hints: Math.max(0, Number(raw.hints) || 0) };
  } catch {
    return null;
  }
}

export function mountSudoku(host: HTMLElement): void {
  unmountSudoku();
  // A saved game is generated once; the start puzzle only when there is none.
  const saved = readSaved();
  let puzzle: Puzzle = saved ? generate(saved.seed, saved.level) : generate(START.seed, START.level);
  let cells: number[] = puzzle.clues.slice();
  let notes: number[] = new Array<number>(81).fill(0);
  let undo: Snapshot[] = [];
  let selected = -1;
  let notesMode = false;
  let showMistakes = false;
  let elapsed = 0;
  let hints = 0;
  let solved = false;
  let timer = 0;

  // A new level starts a new puzzle at once only when there is nothing to lose; otherwise New puzzle does it.
  const levelSel = h("select", { "data-field": "level", onChange: () => {
    const started = cells.some((d, i) => d !== puzzle.clues[i]) || notes.some(Boolean);
    if (started && !solved) {
      statusEl.textContent = t("sudoku.levelPending", { level: t(`sudoku.l_${levelSel.value}`) });
      return;
    }
    newGame();
  } },
    ...LEVELS.map((l) => h("option", { value: l, selected: l === puzzle.level }, t(`sudoku.l_${l}`))),
  );
  const numberEl = h("span", { class: "sudoku-number", "data-out": "number" });
  const timeEl = h("span", { class: "sudoku-time", "data-out": "time", "data-volatile": "" }, clock(0));
  const statusEl = h("p", { class: "sudoku-status", "aria-live": "polite", "data-out": "status" });
  const board = h("div", { class: "sudoku-board", role: "grid", "aria-label": t("sudoku.board"), "data-out": "board" });
  const cellEls: HTMLButtonElement[] = [];
  for (let r = 0; r < 9; r++) {
    const row = h("div", { class: "sudoku-row", role: "row" });
    for (let c = 0; c < 9; c++) {
      const i = r * 9 + c;
      const el = h("button", {
        type: "button",
        class: "sudoku-cell",
        role: "gridcell",
        "data-cell": i,
        tabindex: i === 0 ? 0 : -1,
        onClick: () => select(i),
      });
      if (c % 3 === 2 && c < 8) el.classList.add("edge-r");
      if (r % 3 === 2 && r < 8) el.classList.add("edge-b");
      cellEls.push(el);
      row.append(el);
    }
    board.append(row);
  }
  const padBtns = Array.from({ length: 9 }, (_, k) =>
    h("button", { type: "button", class: "sudoku-key", "data-digit": k + 1, onClick: () => { enter(k + 1); if (selected >= 0) cellEls[selected]?.focus(); } },
      h("span", null, String(k + 1)),
      h("small", { "data-left": k + 1 }),
    ));
  const notesBtn = h("button", { type: "button", class: "btn ghost", "data-action": "notes", "aria-pressed": "false", onClick: () => toggleNotes() }, t("sudoku.notes"));
  const mistakesBox = h("input", { type: "checkbox", "data-field": "mistakes", onChange: () => { showMistakes = mistakesBox.checked; paint(); } });
  let copyBtn: HTMLButtonElement | null = null;

  const save = () => {
    try {
      const data: Saved = { seed: puzzle.seed, level: puzzle.level, cells, notes, elapsed, hints };
      window.localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch {
      /* private mode: progress just is not kept */
    }
  };

  /** Saves the state for Undo; every change goes through here, so it also starts the clock (Hint and the pad too). */
  const snapshot = () => {
    undo.push({ cells: cells.slice(), notes: notes.slice(), elapsed, hints });
    if (undo.length > UNDO_LIMIT) undo.shift();
    startTimer();
  };

  const isClue = (i: number) => puzzle.clues[i] !== 0;

  /** Writes digit d (0 clears) and takes it out of the notes of its row, column and box. */
  const put = (i: number, d: number) => {
    cells[i] = d;
    notes[i] = 0;
    if (d) for (const j of PEERS[i]!) notes[j] = notes[j]! & ~(1 << (d - 1));
  };

  /** Erase on the selected cell: its digit, or else its notes. */
  const erase = () => {
    if (selected < 0 || isClue(selected)) return;
    if (cells[selected]) return enter(0);
    if (!notes[selected]) return;
    snapshot();
    notes[selected] = 0;
    save();
    paint();
  };

  const checkSolved = () => {
    if (solved || cells.some((d, i) => d !== puzzle.solution[i])) return;
    solved = true;
    stopTimer();
    selected = -1;
  };

  const select = (i: number) => {
    selected = i;
    paint();
    cellEls[i]?.focus();
  };

  const enter = (d: number) => {
    if (solved || selected < 0 || isClue(selected)) return;
    const i = selected;
    if (notesMode && d) {
      if (cells[i]) return;
      snapshot();
      notes[i] = notes[i]! ^ (1 << (d - 1));
    } else {
      if (cells[i] === d) return;
      snapshot();
      put(i, d);
      checkSolved();
    }
    save();
    paint();
  };

  const toggleNotes = () => {
    notesMode = !notesMode;
    paint();
  };

  const hint = () => {
    if (solved) return;
    // The selected cell when it is empty or wrong; else a wrong digit; else the empty cell with the fewest options
    // (counted with wrong digits taken out), the one a solver would fill next.
    let i = selected >= 0 && !isClue(selected) && cells[selected] !== puzzle.solution[selected] ? selected : -1;
    if (i < 0) i = cells.findIndex((d, k) => d !== 0 && d !== puzzle.solution[k]);
    if (i < 0) {
      const cand = candidates(cells);
      let best = 10;
      cells.forEach((d, k) => {
        if (d) return;
        const n = bitCount(cand[k]!);
        if (n < best) {
          best = n;
          i = k;
        }
      });
    }
    if (i < 0) return;
    snapshot();
    put(i, puzzle.solution[i]!);
    hints++;
    selected = i;
    checkSolved();
    save();
    paint();
  };

  const startTimer = () => {
    if (timer || solved) return;
    timer = window.setInterval(() => {
      if (document.hidden) return;
      elapsed++;
      timeEl.textContent = clock(elapsed);
      if (elapsed % 10 === 0) save();
    }, 1000);
  };
  const stopTimer = () => {
    if (timer) window.clearInterval(timer);
    timer = 0;
  };

  const load = (p: Puzzle, saved?: Saved) => {
    puzzle = p;
    cells = saved ? saved.cells.map((d, i) => (p.clues[i] ? p.clues[i]! : d)) : p.clues.slice();
    notes = saved ? saved.notes.map((m, i) => (cells[i] ? 0 : m)) : new Array<number>(81).fill(0);
    elapsed = saved?.elapsed ?? 0;
    hints = saved?.hints ?? 0;
    undo = [];
    selected = -1;
    solved = false;
    levelSel.value = p.level;
    stopTimer();
    checkSolved();
    timeEl.textContent = clock(elapsed);
    paint();
  };

  function newGame() {
    const level = levelSel.value as Level;
    load(generate(randomBelow(MAX_SEED) + 1, level));
    save();
    startTimer();
  }

  const restart = () => {
    if (cells.every((d, i) => d === puzzle.clues[i]) && notes.every((m) => !m)) return;
    snapshot();
    cells = puzzle.clues.slice();
    notes = new Array<number>(81).fill(0);
    solved = false;
    levelSel.value = puzzle.level;
    // A fresh attempt: the clock and the hint count start again too.
    elapsed = 0;
    hints = 0;
    timeEl.textContent = clock(0);
    stopTimer();
    save();
    paint();
    startTimer();
  };

  const back = () => {
    const prev = undo.pop();
    if (!prev) return;
    cells = prev.cells;
    notes = prev.notes;
    levelSel.value = puzzle.level;
    // Undoing Start over brings back that attempt's clock and hints, and a finished grid is finished again.
    if (prev.elapsed > elapsed || prev.hints > hints) {
      elapsed = prev.elapsed;
      hints = prev.hints;
      timeEl.textContent = clock(elapsed);
    }
    solved = false;
    checkSolved();
    save();
    paint();
    if (!solved) startTimer();
  };

  const paint = () => {
    numberEl.textContent = t("sudoku.puzzle", { n: puzzle.seed });
    const clash = conflicts(cells);
    const sel = selected;
    const selDigit = sel >= 0 ? cells[sel] : 0;
    const counts = new Array<number>(10).fill(0);
    for (const d of cells) counts[d]!++;
    cellEls.forEach((el, i) => {
      const d = cells[i]!;
      el.replaceChildren();
      if (d) el.textContent = String(d);
      else if (notes[i]) {
        const grid = h("span", { class: "sudoku-notes", "aria-hidden": "true" });
        for (let k = 1; k <= 9; k++) grid.append(h("span", null, notes[i]! & (1 << (k - 1)) ? String(k) : ""));
        el.append(grid);
      }
      const peer = sel >= 0 && i !== sel && (rowOf(i) === rowOf(sel) || colOf(i) === colOf(sel) || boxOf(i) === boxOf(sel));
      el.classList.toggle("given", isClue(i));
      el.classList.toggle("sel", i === sel);
      el.classList.toggle("peer", peer);
      el.classList.toggle("same", !!selDigit && d === selDigit && i !== sel);
      el.classList.toggle("clash", clash.has(i) && !isClue(i));
      el.classList.toggle("wrong", showMistakes && !!d && !isClue(i) && d !== puzzle.solution[i]);
      el.tabIndex = i === (sel >= 0 ? sel : 0) ? 0 : -1;
      const value = d ? String(d) : notes[i] ? t("sudoku.cellNotes", { notes: [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((k) => notes[i]! & (1 << (k - 1))).join(" ") }) : t("sudoku.empty");
      el.setAttribute("aria-label", t("sudoku.cell", { row: rowOf(i) + 1, col: colOf(i) + 1, value }));
      el.setAttribute("aria-readonly", isClue(i) ? "true" : "false");
    });
    padBtns.forEach((b, k) => {
      const left = 9 - counts[k + 1]!;
      b.querySelector("small")!.textContent = left > 0 ? String(left) : "";
      b.classList.toggle("done", left <= 0);
    });
    notesBtn.setAttribute("aria-pressed", String(notesMode));
    notesBtn.classList.toggle("on", notesMode);
    notesBtn.textContent = notesMode ? t("sudoku.notesOn") : t("sudoku.notes");
    const filled = cells.filter(Boolean).length;
    statusEl.textContent = solved
      ? hints
        ? t("sudoku.solvedHints", { time: clock(elapsed), hints })
        : t("sudoku.solved", { time: clock(elapsed) })
      : clash.size
        ? t("sudoku.clash")
        : t("sudoku.progress", { filled, total: 81 });
    statusEl.classList.toggle("ok", solved);
    board.classList.toggle("is-solved", solved);
  };

  const onKey = (e: KeyboardEvent) => {
    if (!(e.target instanceof Node) || !board.contains(e.target)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        back();
      }
      return;
    }
    const at = selected >= 0 ? selected : 0;
    const move = (dr: number, dc: number) => {
      e.preventDefault();
      select(((rowOf(at) + dr + 9) % 9) * 9 + ((colOf(at) + dc + 9) % 9));
    };
    if (e.key === "ArrowUp") return move(-1, 0);
    if (e.key === "ArrowDown") return move(1, 0);
    if (e.key === "ArrowLeft") return move(0, -1);
    if (e.key === "ArrowRight") return move(0, 1);
    // Digits by physical key too, so a number row typed with Shift or a numpad still counts.
    const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
    const digit = /^[0-9]$/.test(e.key) ? Number(e.key) : m ? Number(m[1]) : -1;
    if (digit >= 0) {
      e.preventDefault();
      if (selected < 0) selected = at;
      if (digit === 0) erase();
      else enter(digit);
      return;
    }
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      erase();
      return;
    }
    if (e.key === "n" || e.key === "N") {
      e.preventDefault();
      toggleNotes();
    }
  };

  const copyLine = () => toLine(puzzle.clues);

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("sudoku.title")),
      h("p", { class: "lede" }, t("sudoku.privacyNote")),
    ),
    h("div", { class: "sudoku-tool" },
      h("div", { class: "sudoku-main" },
        h("div", { class: "sudoku-bar" }, numberEl, timeEl),
        board,
        statusEl,
      ),
      h("div", { class: "sudoku-side" },
        h("div", { class: "sudoku-pad", "data-out": "pad" }, ...padBtns),
        h("div", { class: "stage-actions" },
          notesBtn,
          h("button", { type: "button", class: "btn ghost", "data-action": "erase", onClick: () => erase() }, t("sudoku.erase")),
          h("button", { type: "button", class: "btn ghost", "data-action": "undo", onClick: () => back() }, t("sudoku.undo")),
          h("button", { type: "button", class: "btn ghost", "data-action": "hint", onClick: () => hint() }, t("sudoku.hint")),
        ),
        h("label", { class: "check" }, mistakesBox, h("span", null, t("sudoku.showMistakes"))),
        h("label", { class: "field" }, h("span", null, t("sudoku.level")), levelSel),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", "data-action": "new", onClick: () => newGame() }, t("sudoku.newGame")),
          h("button", { type: "button", class: "btn ghost", "data-action": "restart", onClick: () => restart() }, t("sudoku.restart")),
          copyBtn = h("button", { type: "button", class: "btn ghost", "data-action": "copy", onClick: () => void copyWithFlash(copyBtn, copyLine(), { done: t("sudoku.copied"), failed: t("sudoku.copyFailed") }) }, t("sudoku.copy")),
        ),
        h("p", { class: "hint" }, t("sudoku.keys")),
      ),
    ),
  );

  if (saved) load(puzzle, saved);
  else paint();
  board.addEventListener("keydown", onKey);
  // The clock starts with the first touch of the board, not when the page opens.
  const firstTouch = () => startTimer();
  board.addEventListener("pointerdown", firstTouch);
  board.addEventListener("keydown", firstTouch);
  const onHide = () => {
    if (document.hidden) save();
  };
  document.addEventListener("visibilitychange", onHide);
  mounted = {
    cleanup: () => {
      stopTimer();
      save();
      document.removeEventListener("visibilitychange", onHide);
      copyBtn = null;
    },
  };
}

export function unmountSudoku(): void {
  mounted?.cleanup();
  mounted = null;
}
