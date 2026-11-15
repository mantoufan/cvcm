/**
 * Word search, written for cv.cm. Puzzle N of a theme, size and level comes from `seeded`: the theme's words are
 * shuffled, the longest placed first along the level's directions (letters may cross where they agree), and the
 * empty cells filled with letters drawn from all of the language's words, so the filler looks like the language.
 */
import type { Locale } from "./locale";
import { seeded } from "./random";
import { WS_THEMES, WS_WORDS, type WsTheme } from "./word-search-words";

export { WS_THEMES, type WsTheme };
export const WS_SIZES = [10, 12, 15] as const;
export type WsSize = (typeof WS_SIZES)[number];
export const WS_LEVELS = ["easy", "medium", "hard"] as const;
export type WsLevel = (typeof WS_LEVELS)[number];
export const WS_MAX_PUZZLE = 999_999;
/** Words hidden per size. */
export const WS_COUNT: Record<WsSize, number> = { 10: 8, 12: 10, 15: 14 };

/** [row step, column step]. */
type Dir = readonly [number, number];
const FORWARD: Dir[] = [[0, 1], [1, 0]];
const DIAGONAL: Dir[] = [[1, 1], [-1, 1]];
const BACKWARD: Dir[] = [[0, -1], [-1, 0], [-1, -1], [1, -1]];
export const LEVEL_DIRS: Record<WsLevel, readonly Dir[]> = {
  easy: FORWARD,
  medium: [...FORWARD, ...DIAGONAL],
  hard: [...FORWARD, ...DIAGONAL, ...BACKWARD],
};

const CJK: ReadonlySet<Locale> = new Set<Locale>(["zh-CN", "zh-TW", "ja", "ko"]);
export const isCjk = (loc: Locale) => CJK.has(loc);

/** The words of a theme as written, in list order. */
export function themeWords(loc: Locale, theme: WsTheme): string[] {
  return WS_WORDS[loc][theme].split(",").map((w) => w.trim()).filter(Boolean);
}

/**
 * A word's letters as they appear in the grid: one character per cell for Chinese, Japanese and Korean; upper case
 * without spaces, hyphens or accents elsewhere (Spanish keeps Ñ; Vietnamese Đ becomes D).
 */
export function gridLetters(loc: Locale, word: string): string[] {
  if (isCjk(loc)) return [...word.replace(/\s+/g, "")];
  let s = word.toUpperCase();
  if (loc === "es") s = s.replace(/Ñ/g, "\u0001");
  s = s.replace(/Đ/g, "D").normalize("NFD").replace(/\p{M}/gu, "").replace(/\u0001/g, "Ñ");
  return [...s.replace(/[^\p{L}]/gu, "")];
}

export type WsWord = { label: string; letters: string[]; cells: number[] };
export type WsPuzzle = { loc: Locale; theme: WsTheme; size: WsSize; level: WsLevel; n: number; grid: string[]; words: WsWord[] };

/** One seed per (theme, size, level, number), the same in every language. */
export function puzzleSeed(theme: WsTheme, size: WsSize, level: WsLevel, n: number): number {
  const kind = WS_THEMES.indexOf(theme) * 9 + WS_SIZES.indexOf(size) * 3 + WS_LEVELS.indexOf(level);
  return (Math.imul(n, 0x9e3779b1) ^ Math.imul(kind + 1, 0x85ebca6b)) >>> 0;
}

const fillPool = new Map<Locale, string[]>();
function fillLetters(loc: Locale): string[] {
  let pool = fillPool.get(loc);
  if (!pool) {
    pool = WS_THEMES.flatMap((th) => themeWords(loc, th).flatMap((w) => gridLetters(loc, w)));
    fillPool.set(loc, pool);
  }
  return pool;
}

function shuffle<T>(list: readonly T[], rand: () => number): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function generate(loc: Locale, theme: WsTheme, size: WsSize, level: WsLevel, n: number): WsPuzzle {
  const rand = seeded(puzzleSeed(theme, size, level, n));
  const minLen = isCjk(loc) ? 2 : 3;
  const pool = shuffle(themeWords(loc, theme), rand)
    .map((label) => ({ label, letters: gridLetters(loc, label) }))
    .filter((w) => w.letters.length >= minLen && w.letters.length <= size);
  // Distinct grid spellings only (two words that look the same in the grid would be ambiguous).
  const seen = new Set<string>();
  const unique = pool.filter((w) => {
    const k = w.letters.join("");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const target = WS_COUNT[size];
  // Try a few more words than needed, longest first, so long words get the room.
  const tryList = unique.slice(0, target + 6).sort((a, b) => b.letters.length - a.letters.length);
  const dirs = LEVEL_DIRS[level];
  const grid = new Array<string>(size * size).fill("");
  const words: WsWord[] = [];
  for (const w of tryList) {
    if (words.length >= target) break;
    // Words already placed must not be found inside a new one (or the other way round).
    const key = w.letters.join("");
    if (words.some((p) => p.letters.join("").includes(key) || key.includes(p.letters.join("")))) continue;
    for (let attempt = 0; attempt < 300; attempt++) {
      const [dr, dc] = dirs[Math.floor(rand() * dirs.length)]!;
      const len = w.letters.length;
      const r0 = Math.floor(rand() * size);
      const c0 = Math.floor(rand() * size);
      const r1 = r0 + dr * (len - 1);
      const c1 = c0 + dc * (len - 1);
      if (r1 < 0 || r1 >= size || c1 < 0 || c1 >= size) continue;
      const cells = w.letters.map((_, k) => (r0 + dr * k) * size + (c0 + dc * k));
      if (!cells.every((cell, k) => grid[cell] === "" || grid[cell] === w.letters[k])) continue;
      // At most two shared letters, so a word is never almost hidden under others.
      if (cells.filter((cell) => grid[cell] !== "").length > 2) continue;
      cells.forEach((cell, k) => { grid[cell] = w.letters[k]!; });
      words.push({ label: w.label, letters: w.letters, cells });
      break;
    }
  }
  const fill = fillLetters(loc);
  for (let i = 0; i < grid.length; i++) if (!grid[i]) grid[i] = fill[Math.floor(rand() * fill.length)]!;
  words.sort((a, b) => a.label.localeCompare(b.label, loc));
  return { loc, theme, size, level, n, grid, words };
}

/** Cells from `from` to `to` if they lie on one straight line (across, down or diagonal), else null. */
export function lineCells(size: number, from: number, to: number): number[] | null {
  const r0 = Math.floor(from / size);
  const c0 = from % size;
  const r1 = Math.floor(to / size);
  const c1 = to % size;
  const dr = Math.sign(r1 - r0);
  const dc = Math.sign(c1 - c0);
  const len = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0));
  if (r1 - r0 !== 0 && c1 - c0 !== 0 && Math.abs(r1 - r0) !== Math.abs(c1 - c0)) return null;
  return Array.from({ length: len + 1 }, (_, k) => (r0 + dr * k) * size + (c0 + dc * k));
}

/**
 * The index of the not-yet-found word a selection spells, read either way, or -1. A selection that covers a word's
 * own cells wins over a look-alike elsewhere; otherwise the letters decide (a copy formed by the filler counts too).
 */
export function matchSelection(p: WsPuzzle, cells: readonly number[], found: ReadonlySet<number>): number {
  if (cells.length < 2) return -1;
  const text = cells.map((c) => p.grid[c]).join("");
  const back = [...cells].reverse().map((c) => p.grid[c]).join("");
  const key = cells.join(",");
  const keyBack = [...cells].reverse().join(",");
  const exact = p.words.findIndex((w, i) => !found.has(i) && (w.cells.join(",") === key || w.cells.join(",") === keyBack));
  if (exact >= 0) return exact;
  return p.words.findIndex((w, i) => !found.has(i) && (w.letters.join("") === text || w.letters.join("") === back));
}
