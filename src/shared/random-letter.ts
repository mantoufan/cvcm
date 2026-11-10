/** Random letter generator: alphabets, filters and unbiased draws (Web Crypto through randomBelow). */
import { randomBelow } from "./random";

export const ALPHABETS = ["en", "es", "vi", "el", "ru", "hiragana", "katakana"] as const;
export type AlphabetId = (typeof ALPHABETS)[number];

type Alphabet = { letters: readonly string[]; vowels: ReadonlySet<string> | null; cased: boolean };

const split = (s: string) => [...s];

/** Letters in alphabetical order, upper case where the script has case. Kana have no vowel/consonant split here. */
export const ALPHABET: Record<AlphabetId, Alphabet> = {
  en: { letters: split("ABCDEFGHIJKLMNOPQRSTUVWXYZ"), vowels: new Set(split("AEIOU")), cased: true },
  es: { letters: split("ABCDEFGHIJKLMNÑOPQRSTUVWXYZ"), vowels: new Set(split("AEIOU")), cased: true },
  // The 29 letters of the Vietnamese alphabet (no F, J, W, Z); Y counts as a vowel.
  vi: { letters: split("AĂÂBCDĐEÊGHIKLMNOÔƠPQRSTUƯVXY"), vowels: new Set(split("AĂÂEÊIOÔƠUƯY")), cased: true },
  el: { letters: split("ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ"), vowels: new Set(split("ΑΕΗΙΟΥΩ")), cased: true },
  // Ё is its own letter in the Russian alphabet (33 letters); Ъ and Ь are signs, neither vowel nor consonant.
  ru: { letters: split("АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ"), vowels: new Set(split("АЕЁИОУЫЭЮЯ")), cased: true },
  hiragana: { letters: split("あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん"), vowels: null, cased: false },
  katakana: { letters: split("アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン"), vowels: null, cased: false },
};

/** Russian signs that are neither vowels nor consonants. */
const SIGNS: ReadonlySet<string> = new Set(["Ъ", "Ь"]);

export type LetterKind = "all" | "vowels" | "consonants";
export type LetterCase = "upper" | "lower" | "mixed";

export type LetterOptions = {
  alphabet: AlphabetId;
  kind: LetterKind;
  letterCase: LetterCase;
  /** Letters to leave out, in any case, separated or not. */
  exclude: string;
  count: number;
  unique: boolean;
};

export const MAX_LETTERS = 1000;

/** The letters a draw picks from, in alphabetical order and upper case. */
export function letterPool(o: Pick<LetterOptions, "alphabet" | "kind" | "exclude">): string[] {
  const a = ALPHABET[o.alphabet];
  const out = new Set([...o.exclude.toUpperCase()].filter((ch) => ch.trim() !== ""));
  // Kana have no vowel split: every kind keeps them all.
  return a.letters.filter((ch) => {
    if (out.has(ch)) return false;
    if (!a.vowels || o.kind === "all") return true;
    return o.kind === "vowels" ? a.vowels.has(ch) : !a.vowels.has(ch) && !SIGNS.has(ch);
  });
}

export type LetterDraw = { ok: true; letters: string[] } | { ok: false; error: "empty" | "count" | "unique" };

/**
 * `count` letters from the pool, each uniform. With `unique` no letter repeats (a partial Fisher–Yates), so count
 * cannot exceed the pool. Case is applied after the draw; "mixed" flips a fair coin per letter.
 */
export function drawLetters(o: LetterOptions, below: (n: number) => number = randomBelow): LetterDraw {
  const pool = letterPool(o);
  if (pool.length === 0) return { ok: false, error: "empty" };
  if (!Number.isInteger(o.count) || o.count < 1 || o.count > MAX_LETTERS) return { ok: false, error: "count" };
  if (o.unique && o.count > pool.length) return { ok: false, error: "unique" };
  const picked: string[] = [];
  if (o.unique) {
    const rest = [...pool];
    for (let i = 0; i < o.count; i++) {
      const j = i + below(rest.length - i);
      [rest[i], rest[j]] = [rest[j]!, rest[i]!];
      picked.push(rest[i]!);
    }
  } else {
    for (let i = 0; i < o.count; i++) picked.push(pool[below(pool.length)]!);
  }
  const cased = ALPHABET[o.alphabet].cased;
  const letters = picked.map((ch) => {
    if (!cased || o.letterCase === "upper") return ch;
    if (o.letterCase === "lower") return ch.toLowerCase();
    return below(2) === 0 ? ch : ch.toLowerCase();
  });
  return { ok: true, letters };
}
