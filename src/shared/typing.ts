import type { Locale } from "./locale";

/**
 * Chinese and Japanese have no spaces between words and go through an IME, so "words per minute" would be made up:
 * those locales report correct characters per minute (spaces not counted). Korean does the same, counting each
 * syllable block once (Korean typing tests often count keystrokes instead, which gives a higher number).
 * Latin-script locales use the usual net WPM: correct characters ÷ 5 per minute.
 */
export type TypingMetric = "wpm" | "cpm";

export const TYPING_METRIC: Record<Locale, TypingMetric> = {
  en: "wpm",
  "zh-CN": "cpm",
  "zh-TW": "cpm",
  ja: "cpm",
  ko: "cpm",
  vi: "wpm",
  id: "wpm",
  es: "wpm",
};

export const TYPING_DURATIONS = [30, 60] as const;
export type TypingDuration = (typeof TYPING_DURATIONS)[number];

export type TypingScore = {
  /** Net speed: WPM (correct chars ÷ 5) or CPM (correct non-space chars), per minute. */
  speed: number;
  /** Share of typed characters that were right when typed, 0–100. 100 before anything is typed. */
  accuracy: number;
  typed: number;
  correct: number;
  /** Mistakes made (including fixed ones when keystrokes are tracked). */
  errors: number;
};

/** Code points, so a CJK character or an emoji counts once. */
export function chars(text: string): string[] {
  return Array.from(text.normalize("NFC"));
}

/** Characters typed so far and how many of them were wrong when typed (fixed mistakes still count). */
export type Strokes = { typed: number; wrong: number };

/**
 * Counts the characters added by one edit of the typing box. Only text appended at the end counts
 * (a deletion or an edit in the middle adds nothing), so backspacing and retyping is counted again.
 */
export function addStrokes(target: string, prev: string, next: string, strokes: Strokes): Strokes {
  const want = chars(target);
  const before = chars(prev);
  const after = chars(next);
  let same = 0;
  while (same < before.length && same < after.length && before[same] === after[same]) same += 1;
  if (same < before.length) return strokes;
  let { typed, wrong } = strokes;
  for (let i = same; i < after.length; i++) {
    typed += 1;
    if (after[i] !== want[i]) wrong += 1;
  }
  return { typed, wrong };
}

export function scoreTyping(target: string, typed: string, elapsedMs: number, metric: TypingMetric, strokes?: Strokes): TypingScore {
  const want = chars(target);
  const got = chars(typed);
  let correct = 0;
  let correctNonSpace = 0;
  for (let i = 0; i < got.length; i++) {
    if (got[i] === want[i]) {
      correct += 1;
      if (!/\s/.test(got[i])) correctNonSpace += 1;
    }
  }
  const minutes = elapsedMs / 60000;
  const units = metric === "wpm" ? correct / 5 : correctNonSpace;
  // With keystrokes, accuracy counts every mistake made, even ones fixed later; without, it reads the final text.
  const useStrokes = strokes != null && strokes.typed > 0;
  const total = useStrokes ? strokes.typed : got.length;
  const errors = useStrokes ? strokes.wrong : got.length - correct;
  return {
    speed: minutes > 0 ? units / minutes : 0,
    accuracy: total ? ((total - errors) / total) * 100 : 100,
    typed: got.length,
    correct,
    errors,
  };
}

/** Per-character state for painting the passage: done, wrong, current, or todo. */
export function markPassage(target: string, typed: string): Array<{ ch: string; state: "ok" | "bad" | "cur" | "todo" }> {
  const want = chars(target);
  const got = chars(typed);
  return want.map((ch, i) => ({
    ch,
    state: i < got.length ? (got[i] === ch ? "ok" : "bad") : i === got.length ? "cur" : "todo",
  }));
}

export function isFinished(target: string, typed: string): boolean {
  return chars(typed).length >= chars(target).length;
}
