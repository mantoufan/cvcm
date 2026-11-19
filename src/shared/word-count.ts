/** Chinese characters and Japanese kana: each one counts as a word. Korean, which spaces its words, counts by spaces. */
// A halfwidth voicing mark stays with its kana (ｶﾞ is one character).
const PER_CHAR = /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}][\uff9e\uff9f\u3099-\u309c]?/gu;

/**
 * Words as word processors count them: runs between spaces, every Chinese character or kana on its own, and nothing
 * for punctuation standing alone (，。 — …). A Korean word is one word, not one per syllable.
 */
export function countWords(text: string): number {
  // The katakana middle dot separates words (ジョン・スミス). Emoji and symbols (=, +) count as Word counts them.
  return text.replace(/\u30fb/g, " ").replace(PER_CHAR, " $& ").split(/\s+/).filter((t) => t && !/^\p{P}+$/u.test(t)).length;
}

export type TextStats = {
  chars: number;
  charsNoSpace: number;
  words: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  readingMinutes: number;
};

export function countText(text: string): TextStats {
  const chars = [...text].length;
  const charsNoSpace = [...text.replace(/\s/g, "")].length;
  const lines = text.length === 0 ? 0 : text.split(/\n/).length;
  const paragraphs = text.trim()
    ? text.split(/\n\s*\n/).filter((p) => p.trim()).length
    : 0;
  const words = countWords(text);
  const sentences = text.trim()
    ? text.split(/[.!?…。！？]+/).filter((s) => s.trim()).length
    : 0;
  const readingMinutes = words === 0 ? 0 : Math.max(1, Math.ceil(words / 200));
  return { chars, charsNoSpace, words, sentences, paragraphs, lines, readingMinutes };
}
