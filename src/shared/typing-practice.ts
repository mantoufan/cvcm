/**
 * Typing practice, written for cv.cm: touch-typing lessons row by row, then real words.
 *
 * Key drills are judged by the physical key (`KeyboardEvent.code`), not the character, so they work with any input
 * method switched on: Korean pages drill the 2-set (dubeolsik) layout, every other page the QWERTY letters (Japanese
 * romaji input uses the same keys). Word practice reuses the typing game's word lists and matcher.
 */
import type { Locale } from "./locale";
import { kanaUnits } from "./typing-game";

export type Finger = "lp" | "lr" | "lm" | "li" | "ri" | "rm" | "rr" | "rp" | "th";
export const FINGERS: readonly Finger[] = ["lp", "lr", "lm", "li", "ri", "rm", "rr", "rp", "th"];

/** The three letter rows and the space bar, in screen order (QWERTY positions). */
export const KEY_ROWS: readonly (readonly string[])[] = [
  ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP"],
  ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon"],
  ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period", "Slash"],
];
export const SPACE = "Space";

/** Standard touch-typing finger for each key. */
export const FINGER_OF: Record<string, Finger> = (() => {
  const cols: Finger[] = ["lp", "lr", "lm", "li", "li", "ri", "ri", "rm", "rr", "rp"];
  const out: Record<string, Finger> = { [SPACE]: "th" };
  for (const row of KEY_ROWS) row.forEach((code, i) => (out[code] = cols[i]!));
  return out;
})();

/** The key's letter on a US keyboard. */
const LATIN: Record<string, string> = {
  Semicolon: ";", Comma: ",", Period: ".", Slash: "/", [SPACE]: " ",
};
for (const row of KEY_ROWS) for (const code of row) if (code.startsWith("Key")) LATIN[code] = code.slice(3).toLowerCase();

/** Korean 2-set (dubeolsik) jamo on each key. */
const HANGUL: Record<string, string> = {
  KeyQ: "ㅂ", KeyW: "ㅈ", KeyE: "ㄷ", KeyR: "ㄱ", KeyT: "ㅅ", KeyY: "ㅛ", KeyU: "ㅕ", KeyI: "ㅑ", KeyO: "ㅐ", KeyP: "ㅔ",
  KeyA: "ㅁ", KeyS: "ㄴ", KeyD: "ㅇ", KeyF: "ㄹ", KeyG: "ㅎ", KeyH: "ㅗ", KeyJ: "ㅓ", KeyK: "ㅏ", KeyL: "ㅣ", Semicolon: ";",
  KeyZ: "ㅋ", KeyX: "ㅌ", KeyC: "ㅊ", KeyV: "ㅍ", KeyB: "ㅠ", KeyN: "ㅜ", KeyM: "ㅡ", Comma: ",", Period: ".", Slash: "/",
  [SPACE]: " ",
};

/** What a key shows on this locale's practice keyboard. */
export function keyLabel(code: string, locale: Locale): string {
  return (locale === "ko" ? HANGUL[code] : LATIN[code]) ?? "";
}

export type LessonId = "home" | "home2" | "top" | "bottom" | "letters" | "words";
export const LESSONS: readonly LessonId[] = ["home", "home2", "top", "bottom", "letters", "words"];

const letterKeys = (row: readonly string[]) => row.filter((c) => c.startsWith("Key"));

/** The keys each drill uses (new keys are practised together with the ones learned before). */
export const LESSON_KEYS: Record<Exclude<LessonId, "words">, readonly string[]> = {
  home: ["KeyA", "KeyS", "KeyD", "KeyF", "KeyJ", "KeyK", "KeyL", "Semicolon"],
  home2: ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon"],
  top: [...letterKeys(KEY_ROWS[0]!), "KeyA", "KeyS", "KeyD", "KeyF", "KeyJ", "KeyK", "KeyL"],
  bottom: [...letterKeys(KEY_ROWS[2]!), "KeyA", "KeyS", "KeyD", "KeyF", "KeyJ", "KeyK", "KeyL"],
  letters: [...letterKeys(KEY_ROWS[0]!), ...letterKeys(KEY_ROWS[1]!), ...letterKeys(KEY_ROWS[2]!)],
};

/** Keys a lesson brings in for the first time (highlighted in the lesson list and on the keyboard). */
export function newKeys(lesson: Exclude<LessonId, "words">): string[] {
  const i = LESSONS.indexOf(lesson);
  // Keys met in any earlier lesson are not new (all-letters review adds none).
  const before = new Set(LESSONS.slice(0, i).flatMap((id) => (id === "words" ? [] : LESSON_KEYS[id])));
  return LESSON_KEYS[lesson].filter((c) => !before.has(c));
}

/** Drill length in keys, spaces included. */
export const DRILL_KEYS = 60;

/**
 * A drill: groups of 2–5 keys from the lesson separated by spaces, with the lesson's new keys drawn twice as often
 * and no key three times in a row. `rand` is uniform in [0, 1).
 */
export function makeDrill(lesson: Exclude<LessonId, "words">, rand: () => number, length = DRILL_KEYS): string[] {
  const pool = [...LESSON_KEYS[lesson], ...newKeys(lesson)];
  const out: string[] = [];
  while (out.length < length) {
    const size = 2 + Math.floor(rand() * 4);
    for (let i = 0; i < size && out.length < length; i++) {
      let code = pool[Math.floor(rand() * pool.length)]!;
      for (let tries = 0; tries < 5 && out.length >= 2 && out[out.length - 1] === code && out[out.length - 2] === code; tries++) {
        code = pool[Math.floor(rand() * pool.length)]!;
      }
      out.push(code);
    }
    if (out.length < length - 1) out.push(SPACE);
  }
  // Never start or end on a space.
  while (out[out.length - 1] === SPACE) out.pop();
  return out;
}

export type DrillStats = { keys: number; misses: number; seconds: number; missedKeys: Record<string, number> };

export function emptyStats(): DrillStats {
  return { keys: 0, misses: 0, seconds: 0, missedKeys: {} };
}

/** Keys per minute and accuracy (correct keys / all key presses) as whole numbers. */
export function rates(s: DrillStats): { kpm: number; accuracy: number } {
  const kpm = s.seconds > 0 ? Math.round((s.keys / s.seconds) * 60) : 0;
  const presses = s.keys + s.misses;
  return { kpm, accuracy: presses ? Math.round((s.keys / presses) * 100) : 100 };
}

/** The most-missed keys, worst first (at most `n`). */
export function weakKeys(s: DrillStats, n = 3): string[] {
  return Object.entries(s.missedKeys)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([k]) => k);
}

/** A lesson is passed at 90% accuracy or better. */
export const PASS_ACCURACY = 90;

/** Saved results: best keys per minute and accuracy per lesson, and which lessons were passed. */
export type Progress = Record<string, { kpm: number; accuracy: number; passed: boolean }>;

export function recordResult(p: Progress, lesson: LessonId, r: { kpm: number; accuracy: number }): Progress {
  const old = p[lesson];
  const passed = (old?.passed ?? false) || r.accuracy >= PASS_ACCURACY;
  // The best run is the faster one among runs that were accurate enough (or the more accurate one if neither was).
  const better = !old || (r.accuracy >= PASS_ACCURACY && (old.accuracy < PASS_ACCURACY || r.kpm > old.kpm)) || (old.accuracy < PASS_ACCURACY && r.accuracy > old.accuracy);
  return { ...p, [lesson]: better ? { ...r, passed } : { ...old!, passed } };
}

export function fromSavedProgress(raw: unknown): Progress {
  const out: Progress = {};
  if (!raw || typeof raw !== "object") return out;
  for (const id of LESSONS) {
    const v = (raw as Record<string, unknown>)[id] as Record<string, unknown> | undefined;
    if (!v || typeof v !== "object") continue;
    const kpm = Number(v.kpm);
    const accuracy = Number(v.accuracy);
    if (!Number.isFinite(kpm) || !Number.isFinite(accuracy) || kpm < 0 || accuracy < 0 || accuracy > 100) continue;
    out[id] = { kpm: Math.round(kpm), accuracy: Math.round(accuracy), passed: v.passed === true };
  }
  return out;
}

/** Words per lesson in the word round. */
export const WORD_ROUND = 20;

/**
 * A Hepburn romaji spelling of a hiragana reading, shown under Japanese words (any spelling the typing game accepts
 * is still fine): ん is "n", or "nn" before a vowel, y or n; っ doubles the next consonant ("tch" before ch).
 */
export function romajiHint(reading: string): string {
  const units = kanaUnits(reading);
  let out = "";
  for (let i = 0; i < units.length; i++) {
    const u = units[i]!;
    const next = units[i + 1]?.options[0] ?? "";
    if (u.kana === "ん") out += /^[aiueoyn]/.test(next) || !next ? (next ? "nn" : "n") : "n";
    else if (u.kana === "っ") out += next.startsWith("ch") ? "t" : next.charAt(0);
    else out += u.options[0] ?? u.kana;
  }
  return out;
}
