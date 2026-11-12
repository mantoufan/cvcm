/**
 * Word unscrambler: every English word that can be spelt from a set of letters, with blanks.
 *
 * The word list is ENABLE (Enhanced North American Benchmark LEXicon, public domain), 172,823 lower-case words.
 * Each typed letter can be used once; a blank (? or *) stands for any one letter.
 */

/** Most letters (blanks included) a search takes: a 7-tile rack plus a board word comes to about 15. */
export const MAX_LETTERS = 20;
/** Most blanks: three keep the result lists readable and the search quick. */
export const MAX_BLANKS = 3;
/** Words shown per search; the rest are counted. */
export const MAX_SHOWN = 3000;

export type Rack = { counts: Int8Array; blanks: number; length: number };

export type RackError = "empty" | "tooLong" | "tooManyBlanks";

const A = 97;

/** Reads typed letters: a–z in any case (accents dropped: "é" is e), ? * _ or space-free dots as blanks; anything else is ignored. */
export function parseRack(raw: string): { ok: true; rack: Rack } | { ok: false; error: RackError } {
  const counts = new Int8Array(26);
  let blanks = 0;
  let length = 0;
  const plain = raw.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  for (const ch of plain) {
    const c = ch.charCodeAt(0);
    if (c >= A && c < A + 26) {
      counts[c - A]++;
      length++;
    } else if (ch === "?" || ch === "*" || ch === "_" || ch === "." || ch === "？" || ch === "＊") {
      blanks++;
      length++;
    }
  }
  if (length === 0) return { ok: false, error: "empty" };
  if (length > MAX_LETTERS) return { ok: false, error: "tooLong" };
  if (blanks > MAX_BLANKS) return { ok: false, error: "tooManyBlanks" };
  return { ok: true, rack: { counts, blanks, length } };
}

/** Letters a filter box asks for, lower-case a–z only. */
export function plainLetters(raw: string): string {
  return raw.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
}

export type Filters = {
  /** Fewest letters a word may have (2 by default: ENABLE has no one-letter words). */
  min?: number;
  /** Most letters; the rack length when unset. */
  max?: number;
  startsWith?: string;
  endsWith?: string;
  contains?: string;
};

export type Found = {
  /** The word, and the letters in it that a blank stood for (indexes into the word). */
  word: string;
  blanks: number[];
};

export type SearchResult = {
  /** Shown words, longest first, then A–Z. */
  words: Found[];
  /** Every match, shown or not. */
  total: number;
};

/**
 * Words in `dict` that can be spelt from `rack` and pass `filters`. Letters a filter asks for must come from the rack too
 * (a blank can stand for them), as on a board where the start, end or middle letters are your own tiles.
 */
export function unscramble(dict: readonly string[], rack: Rack, filters: Filters = {}): SearchResult {
  const min = Math.max(1, filters.min ?? 2);
  const max = Math.min(rack.length, filters.max ?? rack.length);
  const starts = filters.startsWith ? plainLetters(filters.startsWith) : "";
  const ends = filters.endsWith ? plainLetters(filters.endsWith) : "";
  const contains = filters.contains ? plainLetters(filters.contains) : "";
  const found: Found[] = [];
  const left = new Int8Array(26);
  for (const word of dict) {
    const n = word.length;
    if (n < min || n > max) continue;
    if (starts && !word.startsWith(starts)) continue;
    if (ends && !word.endsWith(ends)) continue;
    if (contains && !word.includes(contains)) continue;
    left.set(rack.counts);
    let blanks = rack.blanks;
    let used: number[] | null = null;
    let ok = true;
    for (let i = 0; i < n; i++) {
      const c = word.charCodeAt(i) - A;
      if (c < 0 || c >= 26) {
        ok = false;
        break;
      }
      if (left[c] > 0) left[c]--;
      else if (blanks > 0) {
        blanks--;
        (used ??= []).push(i);
      } else {
        ok = false;
        break;
      }
    }
    if (ok) found.push({ word, blanks: used ?? [] });
  }
  found.sort((a, b) => b.word.length - a.word.length || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));
  return { words: found.length > MAX_SHOWN ? found.slice(0, MAX_SHOWN) : found, total: found.length };
}

/** Words grouped by length, longest group first. */
export function byLength(words: readonly Found[]): Array<{ length: number; words: Found[] }> {
  const groups = new Map<number, Found[]>();
  for (const w of words) {
    const g = groups.get(w.word.length);
    if (g) g.push(w);
    else groups.set(w.word.length, [w]);
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([length, list]) => ({ length, words: list }));
}

/** Splits the word list file (one word per line, LF or CRLF) into words. */
export function parseWordList(text: string): string[] {
  return text.split(/\r?\n/).filter((w) => w.length > 0);
}
