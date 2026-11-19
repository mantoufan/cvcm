/** Chinese characters and Japanese kana: each one counts as a word. Korean, which spaces its words, counts by spaces. */
const PER_CHAR = /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}]/gu;

/**
 * Words as word processors count them: runs between spaces, every Chinese character or kana on its own, and nothing
 * for punctuation standing alone (，。 — …). A Korean word is one word, not one per syllable.
 */
export function countWords(text: string): number {
  return text.replace(PER_CHAR, " $& ").split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
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
