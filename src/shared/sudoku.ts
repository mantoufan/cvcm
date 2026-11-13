/**
 * Sudoku: seeded puzzle generator with a unique solution, a bitmask solver and a singles-only grader.
 * Cells are numbers 0–80 read row by row; 0 is an empty cell, 1–9 a digit.
 */
import { seeded } from "./random";
import { shuffle } from "./teams";

export const LEVELS = ["easy", "medium", "hard", "expert"] as const;
export type Level = (typeof LEVELS)[number];

/** Largest puzzle number; numbers run 1…MAX_SEED so a puzzle can be named and generated again. */
export const MAX_SEED = 999_999;

export type Puzzle = { seed: number; level: Level; clues: number[]; solution: number[] };

const ALL = 0x1ff;
const ROW = (i: number) => Math.floor(i / 9);
const COL = (i: number) => i % 9;
const BOX = (i: number) => Math.floor(ROW(i) / 3) * 3 + Math.floor(COL(i) / 3);

/** The 20 cells sharing a row, column or box with each cell. */
export const PEERS: readonly (readonly number[])[] = Array.from({ length: 81 }, (_, i) => {
  const out: number[] = [];
  for (let j = 0; j < 81; j++) {
    if (j !== i && (ROW(j) === ROW(i) || COL(j) === COL(i) || BOX(j) === BOX(i))) out.push(j);
  }
  return out;
});

/** The 27 units (9 rows, 9 columns, 9 boxes), each nine cell indexes. */
const UNITS: readonly (readonly number[])[] = [
  ...Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => r * 9 + c)),
  ...Array.from({ length: 9 }, (_, c) => Array.from({ length: 9 }, (_, r) => r * 9 + c)),
  ...Array.from({ length: 9 }, (_, b) =>
    Array.from({ length: 9 }, (_, k) => (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + (k % 3))),
];

export const rowOf = ROW;
export const colOf = COL;
export const boxOf = BOX;

/** Fisher–Yates with the seeded generator (teams.ts shuffle, fed a seeded draw instead of Web Crypto). */
const shuffled = <T>(list: readonly T[], rand: () => number): T[] => shuffle(list, (n) => Math.floor(rand() * n));

/** How many digits a candidate mask allows. */
export const bitCount = (m: number) => {
  let n = 0;
  for (let x = m; x; x &= x - 1) n++;
  return n;
};

/** The digits (as a bitmask, bit d-1 for digit d) still allowed in each empty cell; 0 for a filled one. */
export function candidates(grid: readonly number[]): number[] {
  const rows = new Array<number>(9).fill(0);
  const cols = new Array<number>(9).fill(0);
  const boxes = new Array<number>(9).fill(0);
  for (let i = 0; i < 81; i++) {
    const d = grid[i]!;
    if (d) {
      const bit = 1 << (d - 1);
      rows[ROW(i)]! |= bit;
      cols[COL(i)]! |= bit;
      boxes[BOX(i)]! |= bit;
    }
  }
  return Array.from({ length: 81 }, (_, i) => (grid[i] ? 0 : ALL & ~(rows[ROW(i)]! | cols[COL(i)]! | boxes[BOX(i)]!)));
}

/**
 * Counts solutions up to `limit` by depth-first search on the cell with the fewest candidates.
 * `onSolution` sees each solution found (used to fill a grid).
 */
export function countSolutions(grid: readonly number[], limit = 2, rand?: () => number, onSolution?: (g: number[]) => void): number {
  const g = grid.slice();
  const rows = new Array<number>(9).fill(0);
  const cols = new Array<number>(9).fill(0);
  const boxes = new Array<number>(9).fill(0);
  for (let i = 0; i < 81; i++) {
    const d = g[i]!;
    if (!d) continue;
    const bit = 1 << (d - 1);
    // A digit repeated in a unit: no solution at all.
    if ((rows[ROW(i)]! | cols[COL(i)]! | boxes[BOX(i)]!) & bit) return 0;
    rows[ROW(i)]! |= bit;
    cols[COL(i)]! |= bit;
    boxes[BOX(i)]! |= bit;
  }
  let found = 0;
  const search = (): boolean => {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const mask = ALL & ~(rows[ROW(i)]! | cols[COL(i)]! | boxes[BOX(i)]!);
      const n = bitCount(mask);
      if (n === 0) return false;
      if (n < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = n;
        if (n === 1) break;
      }
    }
    if (best < 0) {
      found++;
      onSolution?.(g.slice());
      return found >= limit;
    }
    let digits: number[] = [];
    for (let d = 1; d <= 9; d++) if (bestMask & (1 << (d - 1))) digits.push(d);
    if (rand) digits = shuffled(digits, rand);
    const r = ROW(best), c = COL(best), b = BOX(best);
    for (const d of digits) {
      const bit = 1 << (d - 1);
      g[best] = d;
      rows[r]! |= bit;
      cols[c]! |= bit;
      boxes[b]! |= bit;
      const stop = search();
      rows[r]! &= ~bit;
      cols[c]! &= ~bit;
      boxes[b]! &= ~bit;
      g[best] = 0;
      if (stop) return true;
    }
    return false;
  };
  search();
  return found;
}

/** The solution of a puzzle with exactly one, else null. */
export function solve(grid: readonly number[]): number[] | null {
  let out: number[] | null = null;
  const n = countSolutions(grid, 2, undefined, (g) => {
    out ??= g;
  });
  return n === 1 ? out : null;
}

/**
 * Fills cells by logic alone: naked singles (a cell with one candidate) and, unless `nakedOnly`, hidden singles
 * (a digit with one place left in a row, column or box). Returns the grid it reached.
 */
export function solveBySingles(grid: readonly number[], nakedOnly = false): number[] {
  const g = grid.slice();
  for (;;) {
    let progress = false;
    const cand = candidates(g);
    for (let i = 0; i < 81; i++) {
      if (!g[i] && bitCount(cand[i]!) === 1) {
        g[i] = Math.log2(cand[i]!) + 1;
        progress = true;
      }
    }
    if (progress) continue;
    if (nakedOnly) break;
    for (const unit of UNITS) {
      for (let d = 1; d <= 9 && !progress; d++) {
        const bit = 1 << (d - 1);
        let spot = -1;
        let n = 0;
        for (const i of unit) {
          if (g[i] === d) {
            n = -1;
            break;
          }
          if (!g[i] && cand[i]! & bit) {
            spot = i;
            n++;
          }
        }
        if (n === 1) {
          g[spot] = d;
          progress = true;
        }
      }
      if (progress) break;
    }
    if (!progress) break;
  }
  return g;
}

const filled = (g: readonly number[]) => g.every((d) => d !== 0);

/** Clue count each level aims for; removal also stops when no more clues can go. */
const TARGET: Record<Level, number> = { easy: 40, medium: 33, hard: 28, expert: 22 };

/**
 * Puzzle `seed` at `level`: a random full grid, then clues taken away in pairs symmetric about the centre while the
 * puzzle stays solvable the level's way: easy by naked singles, medium by singles, hard and expert just uniquely.
 * A medium puzzle that naked singles alone solve, or a hard or expert one that singles solve, is rejected and the
 * next attempt tried (after 40 attempts the last one is kept).
 */
export function generate(seed: number, level: Level): Puzzle {
  const s = Math.min(MAX_SEED, Math.max(1, Math.floor(seed) || 1));
  const levelSalt = LEVELS.indexOf(level) + 1;
  let last: Puzzle | null = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const rand = seeded(s * 7919 + levelSalt * 104_729 + attempt * 15_485_863);
    let solution: number[] = [];
    countSolutions(new Array<number>(81).fill(0), 1, rand, (g) => {
      solution = g;
    });
    const clues = solution.slice();
    const order = shuffled(Array.from({ length: 41 }, (_, i) => i), rand);
    const ok = (g: number[]) =>
      level === "easy" ? filled(solveBySingles(g, true)) : level === "medium" ? filled(solveBySingles(g)) : countSolutions(g, 2) === 1;
    let count = 81;
    for (const i of order) {
      if (count <= TARGET[level]) break;
      const j = 80 - i;
      const saved = [clues[i]!, clues[j]!];
      clues[i] = 0;
      clues[j] = 0;
      if (ok(clues)) count -= i === j ? 1 : 2;
      else [clues[i], clues[j]] = saved;
    }
    // Pairs can get stuck above the target; single cells can often still go.
    for (const i of shuffled(Array.from({ length: 81 }, (_, k) => k), rand)) {
      if (count <= TARGET[level]) break;
      if (!clues[i]) continue;
      const saved = clues[i]!;
      clues[i] = 0;
      if (ok(clues)) count--;
      else clues[i] = saved;
    }
    last = { seed: s, level, clues, solution };
    // Each level must need its own technique: medium a hidden single, hard and expert more than singles.
    if (level === "medium" && filled(solveBySingles(clues, true))) continue;
    if ((level === "hard" || level === "expert") && filled(solveBySingles(clues))) continue;
    return last;
  }
  return last!;
}

/** Cells whose digit also appears in a peer: the clashes a player can see without knowing the answer. */
export function conflicts(grid: readonly number[]): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < 81; i++) {
    const d = grid[i];
    if (!d) continue;
    for (const j of PEERS[i]!) {
      if (grid[j] === d) {
        out.add(i);
        break;
      }
    }
  }
  return out;
}

/** A puzzle as one line of 81 digits, 0 for empty cells (the usual text form other sudoku apps read). */
export function toLine(grid: readonly number[]): string {
  return grid.map((d) => String(d)).join("");
}
