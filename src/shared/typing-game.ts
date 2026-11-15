/**
 * Typing game (falling words), written for cv.cm: the rules that do not touch the page — which typed text clears a
 * word, how fast words fall at each level, and the score. The words themselves are in typing-game-words.ts.
 *
 * What counts as typing a word, per language:
 * - every language: the word as shown, ignoring case, width (NFKC) and surrounding spaces;
 * - es, vi (and any Latin word): the word without accents or tone marks too (đ → d);
 * - zh-CN / zh-TW: the characters, or the toneless pinyin without spaces;
 * - ja: the kanji/kana form, its reading in hiragana or katakana, or that reading in romaji (Hepburn or Kunrei:
 *   shi/si, chi/ti, tsu/tu, fu/hu, ji/zi …; ん as nn, n' or — before a consonant other than n/y, and at the end — n;
 *   っ by doubling the next consonant, or xtu / ltu);
 * - ko: the Hangul word (compared after the IME finishes composing, which the page handles).
 */
import type { Locale } from "./locale";

export type TypingWord = { text: string; reading?: string };
export const TYPING_LEVELS = ["easy", "medium", "hard"] as const;
export type TypingLevel = (typeof TYPING_LEVELS)[number];

/** Seconds a word takes to fall the whole field at the start of each level. */
export const START_FALL: Record<TypingLevel, number> = { easy: 11, medium: 8, hard: 5.5 };
/** Every this many cleared words the fall gets faster by FALL_STEP, down to MIN_FALL seconds. */
export const SPEED_EVERY = 5;
export const FALL_STEP = 0.93;
export const MIN_FALL = 2.4;
export const LIVES = 3;

export function fallSeconds(level: TypingLevel, cleared: number): number {
  return Math.max(MIN_FALL, START_FALL[level] * FALL_STEP ** Math.floor(Math.max(0, cleared) / SPEED_EVERY));
}

/** A new word appears every this many seconds: a third of the fall time, so about three are on screen. */
export function spawnSeconds(level: TypingLevel, cleared: number): number {
  return fallSeconds(level, cleared) / 3;
}

/** The stage number shown to the player (1, 2, 3 …), one step per speed-up. */
export function stageOf(cleared: number): number {
  return 1 + Math.floor(Math.max(0, cleared) / SPEED_EVERY);
}

const norm = (s: string) => s.normalize("NFKC").trim().toLowerCase();

/** Removes accents and tone marks (é → e, ệ → e, đ → d). */
export function stripMarks(s: string): string {
  return s.normalize("NFD").replace(/\p{M}+/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").normalize("NFC");
}

/** Katakana to hiragana (ァ–ヶ → ぁ–ゖ); the long-vowel mark stays. */
export function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

// ---------------------------------------------------------------- kana → romaji

const BASE: Record<string, string[]> = {};
const add = (table: string) => {
  for (const pair of table.trim().split(/\s+/)) {
    const [k, v] = pair.split(":") as [string, string];
    BASE[k] = v.split(",");
  }
};
add(`あ:a い:i,yi う:u,wu え:e お:o か:ka,ca き:ki く:ku,cu,qu け:ke こ:ko,co さ:sa し:shi,si,ci す:su せ:se,ce そ:so
た:ta ち:chi,ti つ:tsu,tu て:te と:to な:na に:ni ぬ:nu ね:ne の:no は:ha ひ:hi ふ:fu,hu へ:he ほ:ho
ま:ma み:mi む:mu め:me も:mo や:ya ゆ:yu よ:yo ら:ra り:ri る:ru れ:re ろ:ro わ:wa を:wo,o
が:ga ぎ:gi ぐ:gu げ:ge ご:go ざ:za じ:ji,zi ず:zu ぜ:ze ぞ:zo だ:da ぢ:di,ji づ:du,zu で:de ど:do
ば:ba び:bi ぶ:bu べ:be ぼ:bo ぱ:pa ぴ:pi ぷ:pu ぺ:pe ぽ:po ゔ:vu
ぁ:xa,la ぃ:xi,li ぅ:xu,lu ぇ:xe,le ぉ:xo,lo ゃ:xya,lya ゅ:xyu,lyu ょ:xyo,lyo ゎ:xwa,lwa ー:-`);
// Contracted sounds: consonant + ゃゅょ.
const YOUON: Record<string, [string[], string[], string[]]> = {
  き: [["kya"], ["kyu"], ["kyo"]],
  ぎ: [["gya"], ["gyu"], ["gyo"]],
  し: [["sha", "sya"], ["shu", "syu"], ["sho", "syo"]],
  じ: [["ja", "zya", "jya"], ["ju", "zyu", "jyu"], ["jo", "zyo", "jyo"]],
  ち: [["cha", "tya", "cya"], ["chu", "tyu", "cyu"], ["cho", "tyo", "cyo"]],
  ぢ: [["dya"], ["dyu"], ["dyo"]],
  に: [["nya"], ["nyu"], ["nyo"]],
  ひ: [["hya"], ["hyu"], ["hyo"]],
  び: [["bya"], ["byu"], ["byo"]],
  ぴ: [["pya"], ["pyu"], ["pyo"]],
  み: [["mya"], ["myu"], ["myo"]],
  り: [["rya"], ["ryu"], ["ryo"]],
};
// A few loanword sounds.
const EXTRA: Record<string, string[]> = {
  ふぁ: ["fa"], ふぃ: ["fi"], ふぇ: ["fe"], ふぉ: ["fo"], てぃ: ["thi"], でぃ: ["dhi"], しぇ: ["she", "sye"], じぇ: ["je", "zye"],
  ちぇ: ["che", "tye"], うぃ: ["wi"], うぇ: ["we"], うぉ: ["who"], ゔぁ: ["va"], ゔぃ: ["vi"], ゔぇ: ["ve"], ゔぉ: ["vo"],
};

type Unit = { kana: string; options: string[] };

/** Splits a hiragana reading into typing units (contracted sounds stay together; っ and ん are their own units). */
export function kanaUnits(reading: string): Unit[] {
  const s = toHiragana(reading);
  const units: Unit[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    const two = s.slice(i, i + 2);
    // indexOf("") is 0, so the last kana must not look up an empty next character.
    const small = i + 1 < s.length ? "ゃゅょ".indexOf(s[i + 1]!) : -1;
    if (YOUON[c] && small >= 0) {
      units.push({ kana: two, options: YOUON[c][small]! });
      i++;
    } else if (EXTRA[two]) {
      units.push({ kana: two, options: EXTRA[two]! });
      i++;
    } else if (c === "っ" || c === "ん") units.push({ kana: c, options: [] });
    else if (BASE[c]) units.push({ kana: c, options: BASE[c]! });
    else units.push({ kana: c, options: [c] }); // anything else must be typed as it is
  }
  return units;
}

const VOWELISH = /^[aiueoyn']/;

/** Whether `typed` is a romaji spelling of the hiragana `reading`. */
export function romajiMatches(reading: string, typed: string): boolean {
  const units = kanaUnits(reading);
  const input = typed.toLowerCase();
  const memo = new Map<string, boolean>();
  const go = (ui: number, pos: number): boolean => {
    if (ui === units.length) return pos === input.length;
    const key = `${ui}:${pos}`;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    const u = units[ui]!;
    let ok = false;
    const tryOpt = (opt: string, nextUi: number) => {
      if (!ok && input.startsWith(opt, pos) && go(nextUi, pos + opt.length)) ok = true;
    };
    if (u.kana === "ん") {
      for (const opt of ["nn", "n'", "xn"]) tryOpt(opt, ui + 1);
      const next = units[ui + 1];
      // A single n is unambiguous only at the end or before a consonant other than n and y.
      if (!next || (next.options.length && next.options.every((o) => !VOWELISH.test(o)))) tryOpt("n", ui + 1);
    } else if (u.kana === "っ") {
      const next = units[ui + 1];
      for (const opt of ["xtu", "ltu", "xtsu", "ltsu"]) tryOpt(opt, ui + 1);
      if (next) {
        for (const o of next.options) {
          if (VOWELISH.test(o) || o.startsWith("-")) continue;
          tryOpt(o[0] + o, ui + 2);
          if (o.startsWith("ch")) tryOpt(`t${o}`, ui + 2);
        }
      }
    } else for (const opt of u.options) tryOpt(opt, ui + 1);
    memo.set(key, ok);
    return ok;
  };
  return input.length > 0 && go(0, 0);
}

// ---------------------------------------------------------------- matching

/** Every spelling that clears `word` in `locale` (besides the romaji, which `matches` checks by parsing). */
export function spellings(word: TypingWord, locale: Locale): string[] {
  const out = new Set<string>([norm(word.text)]);
  if (word.reading) {
    out.add(norm(word.reading));
    if (locale === "ja") out.add(norm(toHiragana(word.reading)));
  }
  if (locale !== "ja" && locale !== "ko" && locale !== "zh-CN" && locale !== "zh-TW") out.add(norm(stripMarks(word.text)));
  // zh readings are toneless pinyin; accept them with spaces removed or with tone marks typed.
  if ((locale === "zh-CN" || locale === "zh-TW") && word.reading) out.add(norm(stripMarks(word.reading)).replace(/\s+/g, ""));
  return [...out];
}

/** Whether `typed` could still become `word` (same loosening as `matches`: case, width, and accents outside ja/ko/zh). */
export function isPrefixOf(word: TypingWord, typed: string, locale: Locale): boolean {
  const fold = (s: string) => (locale === "ja" || locale === "ko" || locale === "zh-CN" || locale === "zh-TW" ? norm(s) : norm(stripMarks(s)));
  return fold(word.text).startsWith(fold(typed.trimStart()).replace(/\s+$/, " "));
}

export function matches(word: TypingWord, typed: string, locale: Locale): boolean {
  const t = norm(typed);
  if (!t) return false;
  const loose = locale === "zh-CN" || locale === "zh-TW" ? norm(stripMarks(t)).replace(/\s+/g, "") : t;
  const forms = spellings(word, locale);
  if (forms.includes(t) || forms.includes(loose)) return true;
  if (locale !== "ja" && locale !== "ko" && forms.includes(norm(stripMarks(t)))) return true;
  if (locale === "ja") {
    if (forms.includes(norm(toHiragana(t)))) return true;
    if (word.reading && /^[a-z'-]+$/.test(t)) return romajiMatches(word.reading, t);
  }
  return false;
}

/** The characters a cleared word scores: what is shown (kanji count as one each). */
export function scoreOf(word: TypingWord): number {
  return [...word.text.normalize("NFC")].length;
}

/** Characters per minute and accuracy for the end-of-game summary. */
export function summary(chars: number, hits: number, attempts: number, seconds: number): { cpm: number; accuracy: number } {
  return {
    cpm: seconds > 0 ? Math.round((chars / seconds) * 60) : 0,
    accuracy: attempts > 0 ? Math.round((hits / attempts) * 100) : 100,
  };
}
