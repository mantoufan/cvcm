/**
 * Minesweeper rules, written for cv.cm. Mines are laid after the first reveal so that cell and its eight neighbours
 * are always safe (the first click opens an area). Revealing a zero opens its neighbours (flood fill); a revealed
 * number whose flagged neighbours equal it "chords" (opens the rest). All state is plain data so moves are testable.
 */

export type LevelId = "beginner" | "intermediate" | "expert" | "custom";
export const LEVELS: Record<Exclude<LevelId, "custom">, { rows: number; cols: number; mines: number }> = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 },
};
export const LIMITS = { minRows: 5, maxRows: 30, minCols: 5, maxCols: 40 } as const;

export type CellState = "hidden" | "flag" | "open";
export type Status = "ready" | "playing" | "won" | "lost";
export type Board = {
  rows: number;
  cols: number;
  mines: number;
  /** Empty until the first reveal. */
  mine: boolean[];
  state: CellState[];
  status: Status;
  /** The mine that was opened (loss). */
  hit: number;
};

/** Clamps a custom size: rows 5–30, cols 5–40, mines 1 to cells − 9 (the first click's 3 × 3 stays free). */
export function clampSize(rows: number, cols: number, mines: number): { rows: number; cols: number; mines: number } {
  const r = Math.min(LIMITS.maxRows, Math.max(LIMITS.minRows, Math.round(rows) || LIMITS.minRows));
  const c = Math.min(LIMITS.maxCols, Math.max(LIMITS.minCols, Math.round(cols) || LIMITS.minCols));
  const m = Math.min(r * c - 9, Math.max(1, Math.round(mines) || 1));
  return { rows: r, cols: c, mines: m };
}

export function newBoard(rows: number, cols: number, mines: number): Board {
  const n = rows * cols;
  return { rows, cols, mines, mine: [], state: new Array<CellState>(n).fill("hidden"), status: "ready", hit: -1 };
}

export function neighbours(b: Pick<Board, "rows" | "cols">, i: number): number[] {
  const r = Math.floor(i / b.cols);
  const c = i % b.cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < b.rows && cc >= 0 && cc < b.cols) out.push(rr * b.cols + cc);
    }
  }
  return out;
}

export function count(b: Board, i: number): number {
  return neighbours(b, i).reduce((n, j) => n + (b.mine[j] ? 1 : 0), 0);
}

/** Lays the mines with `below(n)` (uniform in [0, n)), keeping `safe` and its neighbours clear. */
export function layMines(b: Board, safe: number, below: (n: number) => number): void {
  const keep = new Set([safe, ...neighbours(b, safe)]);
  const free: number[] = [];
  for (let i = 0; i < b.rows * b.cols; i++) if (!keep.has(i)) free.push(i);
  b.mine = new Array<boolean>(b.rows * b.cols).fill(false);
  // Partial Fisher–Yates: the first `mines` picks are the mines.
  for (let k = 0; k < b.mines && k < free.length; k++) {
    const j = k + below(free.length - k);
    [free[k], free[j]] = [free[j]!, free[k]!];
    b.mine[free[k]!] = true;
  }
}

function clone(b: Board): Board {
  return { ...b, mine: b.mine.slice(), state: b.state.slice() };
}

function finishIfWon(b: Board): void {
  const n = b.rows * b.cols;
  for (let i = 0; i < n; i++) if (!b.mine[i] && b.state[i] !== "open") return;
  b.status = "won";
  for (let i = 0; i < n; i++) if (b.mine[i]) b.state[i] = "flag";
}

/** Opens cells from `start`, spreading through zeros. Returns false if a mine was opened. */
function open(b: Board, start: number): boolean {
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    if (b.state[i] !== "hidden") continue;
    b.state[i] = "open";
    if (b.mine[i]) {
      b.status = "lost";
      b.hit = i;
      return false;
    }
    if (count(b, i) === 0) for (const j of neighbours(b, i)) if (b.state[j] === "hidden") stack.push(j);
  }
  return true;
}

/** Reveal a cell (or chord a revealed number). The first reveal lays the mines. */
export function reveal(prev: Board, i: number, below: (n: number) => number): Board {
  if (prev.status === "won" || prev.status === "lost" || prev.state[i] === "flag") return prev;
  const b = clone(prev);
  if (b.status === "ready") {
    layMines(b, i, below);
    b.status = "playing";
  }
  if (b.state[i] === "open") return chord(b, i);
  open(b, i);
  if (b.status === "playing") finishIfWon(b);
  return b;
}

/** A revealed number with as many flags around it as its count opens every other hidden neighbour. */
export function chord(prev: Board, i: number): Board {
  if (prev.status !== "playing" || prev.state[i] !== "open") return prev;
  const around = neighbours(prev, i);
  const flags = around.filter((j) => prev.state[j] === "flag").length;
  if (!flags || flags !== count(prev, i)) return prev;
  const hidden = around.filter((j) => prev.state[j] === "hidden");
  if (!hidden.length) return prev;
  const b = clone(prev);
  for (const j of hidden) if (!open(b, j)) break;
  if (b.status === "playing") finishIfWon(b);
  return b;
}

export function toggleFlag(prev: Board, i: number): Board {
  if (prev.status === "won" || prev.status === "lost" || prev.state[i] === "open") return prev;
  const b = clone(prev);
  b.state[i] = b.state[i] === "flag" ? "hidden" : "flag";
  return b;
}

export function flagsLeft(b: Board): number {
  return b.mines - b.state.filter((s) => s === "flag").length;
}
