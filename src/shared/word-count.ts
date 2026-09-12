const CJK =
  /[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\u31f0-\u31ff\uac00-\ud7af]/u;

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
  const marked = text.replace(new RegExp(CJK, "gu"), " $& ");
  const words = marked.trim() ? marked.trim().split(/\s+/).length : 0;
  const sentences = text.trim()
    ? text.split(/[.!?…。！？]+/).filter((s) => s.trim()).length
    : 0;
  const readingMinutes = words === 0 ? 0 : Math.max(1, Math.ceil(words / 200));
  return { chars, charsNoSpace, words, sentences, paragraphs, lines, readingMinutes };
}
