/** Silent reading speeds (words per minute) and a conversational speaking speed. */
export const READ_WPM = { slow: 150, average: 238, fast: 300 } as const;
export const SPEAK_WPM = 130;
/** CJK text is counted in characters; adults read roughly 300 characters a minute. */
export const CJK_CPM = { slow: 200, average: 300, fast: 400 } as const;
export const CJK_SPEAK_CPM = 180;
export type Speed = keyof typeof READ_WPM;

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u30FC\u3005]/gu;
/** A leftover token counts as a word only if it has a letter or digit (CJK punctuation does not). */
const WORD = /[\p{L}\p{N}]/u;

export type ReadingStats = {
  /** Space-separated words outside CJK scripts. */
  latin: number;
  chars: number;
  charsNoSpaces: number;
  cjk: number;
  /** Counted units: words for Latin text, characters for CJK, both when mixed. */
  units: number;
  readSec: number;
  speakSec: number;
  cjkMode: boolean;
};

export function readingTime(text: string, speed: Speed = "average"): ReadingStats {
  const trimmed = text.trim();
  const cjk = (trimmed.match(CJK) ?? []).length;
  const latinWords = trimmed.replace(CJK, " ").split(/\s+/).filter((w) => WORD.test(w)).length;
  const chars = Array.from(trimmed).length;
  const charsNoSpaces = Array.from(trimmed.replace(/\s/g, "")).length;
  const cjkMode = cjk > latinWords;
  const readMin = latinWords / READ_WPM[speed] + cjk / CJK_CPM[speed];
  const speakMin = latinWords / SPEAK_WPM + cjk / CJK_SPEAK_CPM;
  const units = latinWords + cjk;
  const seconds = (min: number) => (units === 0 ? 0 : Math.max(1, Math.round(min * 60)));
  return {
    latin: latinWords,
    chars,
    charsNoSpaces,
    cjk,
    units,
    readSec: seconds(readMin),
    speakSec: seconds(speakMin),
    cjkMode,
  };
}

/** "3 min 20 s" style pieces: minutes and leftover seconds. */
export function splitSec(sec: number): { min: number; sec: number } {
  return { min: Math.floor(sec / 60), sec: sec % 60 };
}
