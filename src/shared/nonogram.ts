/**
 * Nonogram (griddlers, paint by numbers), written for cv.cm. Puzzle N of a size comes from `seeded`: a random picture
 * is kept only when a pure line solver finishes it, so every puzzle has one solution and never needs a guess.
 *
 * A cell is 1 (filled), 0 (empty) or -1 (unknown) in solver lines; the player's board uses 0 blank, 1 filled, 2 cross.
 */
import { seeded } from "./random";

export const SIZES = [5, 10, 15] as const;
export type Size = (typeof SIZES)[number];
export const MAX_PUZZLE = 999_999;

export type Puzzle = { size: Size; n: number; solution: number[]; rows: number[][]; cols: number[][] };

/** Run lengths of filled cells; an empty line is [] (shown as "0"). */
export function clueOf(line: readonly number[]): number[] {
  const out: number[] = [];
  let run = 0;
  for (const c of line) {
    if (c === 1) run++;
    else if (run) {
      out.push(run);
      run = 0;
    }
  }
  if (run) out.push(run);
  return out;
}

export const rowOf = (cells: readonly number[], size: number, r: number) => cells.slice(r * size, r * size + size);
export const colOf = (cells: readonly number[], size: number, c: number) => Array.from({ length: size }, (_, r) => cells[r * size + c]!);

/**
 * Every cell that is filled in all placements of `clue` consistent with `line` becomes 1, every cell empty in all of
 * them becomes 0. Returns null when no placement fits (a contradiction).
 */
export function solveLine(clue: readonly number[], line: readonly number[]): number[] | null {
  const L = line.length;
  const n = clue.length;
  // ok[i][k]: positions i.. can be completed with blocks k..
  const memo = new Map<number, boolean>();
  const key = (i: number, k: number) => i * 64 + k;
  const fits = (i: number, k: number): boolean => {
    if (i >= L) return k === n;
    const id = key(i, k);
    const hit = memo.get(id);
    if (hit !== undefined) return hit;
    let ok = false;
    if (line[i] !== 1 && fits(i + 1, k)) ok = true;
    if (!ok && k < n && blockAt(i, k)) ok = fits(i + clue[k]! + 1, k + 1);
    memo.set(id, ok);
    return ok;
  };
  const blockAt = (i: number, k: number) => {
    const len = clue[k]!;
    if (i + len > L) return false;
    for (let j = i; j < i + len; j++) if (line[j] === 0) return false;
    return i + len === L || line[i + len] !== 1;
  };
  if (!fits(0, 0)) return null;
  const canFill = new Array<boolean>(L).fill(false);
  const canEmpty = new Array<boolean>(L).fill(false);
  const seen = new Set<number>();
  // Walk only the states that lead to a full placement, marking what each choice does to the cells.
  const walk = (i: number, k: number) => {
    if (i >= L) return;
    const id = key(i, k);
    if (seen.has(id)) return;
    seen.add(id);
    if (line[i] !== 1 && fits(i + 1, k)) {
      canEmpty[i] = true;
      walk(i + 1, k);
    }
    if (k < n && blockAt(i, k) && fits(i + clue[k]! + 1, k + 1)) {
      const len = clue[k]!;
      for (let j = i; j < i + len; j++) canFill[j] = true;
      if (i + len < L) canEmpty[i + len] = true;
      walk(i + len + 1, k + 1);
    }
  };
  walk(0, 0);
  return line.map((c, i) => (c !== -1 ? c : canFill[i] && !canEmpty[i] ? 1 : !canFill[i] && canEmpty[i] ? 0 : -1));
}

/** Line-by-line solving to a fixed point. Returns the grid (with -1 where logic alone cannot decide) or null. */
export function solve(rows: readonly number[][], cols: readonly number[][]): number[] | null {
  const size = rows.length;
  const grid = new Array<number>(size * size).fill(-1);
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < size; r++) {
      const line = solveLine(rows[r]!, rowOf(grid, size, r));
      if (!line) return null;
      line.forEach((v, c) => {
        if (grid[r * size + c] !== v) {
          grid[r * size + c] = v;
          changed = true;
        }
      });
    }
    for (let c = 0; c < size; c++) {
      const line = solveLine(cols[c]!, colOf(grid, size, c));
      if (!line) return null;
      line.forEach((v, r) => {
        if (grid[r * size + c] !== v) {
          grid[r * size + c] = v;
          changed = true;
        }
      });
    }
  }
  return grid;
}

export function cluesFor(solution: readonly number[], size: number): { rows: number[][]; cols: number[][] } {
  return {
    rows: Array.from({ length: size }, (_, r) => clueOf(rowOf(solution, size, r))),
    cols: Array.from({ length: size }, (_, c) => clueOf(colOf(solution, size, c))),
  };
}

/** Puzzle `n` of a size: the same picture everywhere, solvable by line logic alone. */
export function generate(size: Size, n: number): Puzzle {
  const rand = seeded((n >>> 0) * 31 + size);
  for (let attempt = 0; attempt < 5000; attempt++) {
    const density = 0.55 + rand() * 0.07;
    const solution = Array.from({ length: size * size }, () => (rand() < density ? 1 : 0));
    const { rows, cols } = cluesFor(solution, size);
    const solved = solve(rows, cols);
    if (solved && solved.every((v, i) => v === solution[i])) return { size, n, solution, rows, cols };
  }
  throw new Error(`no line-solvable nonogram for ${size}/${n}`);
}

/** Won when exactly the solution's cells are filled (crosses and blanks are the same). */
export function isSolved(cells: readonly number[], solution: readonly number[]): boolean {
  return cells.every((c, i) => (c === 1) === (solution[i] === 1));
}

/** A row or column whose filled runs already equal its clue (its clue is greyed out). */
export function lineDone(cells: readonly number[], clue: readonly number[]): boolean {
  const runs = clueOf(cells);
  return runs.length === clue.length && runs.every((v, i) => v === clue[i]);
}
