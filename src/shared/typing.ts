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
  /** Mistakes: settled ones (even if fixed later) plus wrong characters not yet settled, when keystrokes are tracked. */
  errors: number;
};

/** Code points, so a CJK character or an emoji counts once. */
export function chars(text: string): string[] {
  return Array.from(text.normalize("NFC"));
}

/**
 * Keystroke bookkeeping for accuracy.
 * - typed: characters entered (backspace + retype counts again).
 * - wrong: settled mistakes. They stay counted after the user goes back and fixes them.
 * - pending: positions holding a wrong character that is not settled yet.
 *
 * A wrong character settles once the user has moved on: a space was typed after it, or the cursor is
 * SETTLE_DISTANCE characters further. Until then a fix in place is free. That is how Vietnamese Telex/VNI
 * input methods (Unikey, EVKey) work without composition events: they insert "a", delete it, then insert "á",
 * and the same goes for clusters such as "uo" → "ươ". Counting the bare letter would make every diacritic a mistake.
 */
export type Strokes = { typed: number; wrong: number; pending: number[] };

export const SETTLE_DISTANCE = 8;

export function emptyStrokes(): Strokes {
  return { typed: 0, wrong: 0, pending: [] };
}

/** Updates the bookkeeping for one edit of the typing box (prev → next). */
export function addStrokes(target: string, prev: string, next: string, strokes: Strokes): Strokes {
  const want = chars(target);
  const before = chars(prev);
  const after = chars(next);
  let same = 0;
  while (same < before.length && same < after.length && before[same] === after[same]) same += 1;
  let { typed, wrong } = strokes;
  // A pending position that was deleted or now holds the right character is forgiven.
  const pending = new Set(strokes.pending.filter((p) => p < after.length && after[p] !== want[p]));
  for (let i = same; i < after.length; i++) {
    typed += 1;
    if (after[i] !== want[i]) pending.add(i);
  }
  const end = after.length - 1;
  for (const p of [...pending]) {
    let movedOn = end - p >= SETTLE_DISTANCE;
    for (let q = p + 1; !movedOn && q <= end; q++) if (/\s/.test(after[q])) movedOn = true;
    if (movedOn) {
      wrong += 1;
      pending.delete(p);
    }
  }
  return { typed, wrong, pending: [...pending].sort((a, b) => a - b) };
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
  // With keystrokes: settled mistakes (even if fixed later) plus wrong characters still on screen.
  // Without: just the final text.
  const useStrokes = strokes != null && strokes.typed > 0;
  const total = useStrokes ? strokes.typed : got.length;
  const errors = useStrokes ? Math.min(total, strokes.wrong + strokes.pending.length) : got.length - correct;
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
