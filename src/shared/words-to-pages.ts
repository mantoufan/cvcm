/**
 * Words to pages: lays text out the way a word processor does (greedy line filling with each font's real glyph
 * widths and Word's line heights) and counts the lines that fit on a page. A bare word count is turned into pages
 * with the words per page measured on SAMPLE_TEXT under the same settings.
 */
import { FONT_METRICS } from "./font-metrics";
import { SAMPLE_TEXT } from "./words-to-pages-sample";

export const FONT_IDS = ["times", "arial", "calibri", "aptos", "cambria", "georgia", "verdana", "courier"] as const;
export type FontId = (typeof FONT_IDS)[number];
export const SIZES = [10, 10.5, 11, 12, 13, 14] as const;
/** Line spacing as Word names it: single, 1.15, 1.5 lines, double. */
export const SPACINGS = [1, 1.15, 1.5, 2] as const;
export const PAPER_IDS = ["letter", "a4"] as const;
export type PaperId = (typeof PAPER_IDS)[number];
/** Page size in points (1/72 inch). */
export const PAPERS: Record<PaperId, { w: number; h: number }> = { letter: { w: 612, h: 792 }, a4: { w: 595.28, h: 841.89 } };
/** Margins in inches: 1 inch (2.54 cm) is the default in Word and in APA, MLA and Chicago. */
export const MARGINS = [1, 0.75, 1.25] as const;
/** First-line indent of an essay paragraph (APA, MLA): half an inch. */
const INDENT_PT = 36;

export type PageSetup = {
  font: FontId;
  size: number;
  spacing: number;
  paper: PaperId;
  /** Inches on every side. */
  margin: number;
  /** Indent each paragraph's first line by half an inch. */
  indent: boolean;
};

/** Times New Roman 12, double-spaced, 1-inch margins and indented paragraphs: an APA or MLA essay. */
export const ESSAY: PageSetup = { font: "times", size: 12, spacing: 2, paper: "letter", margin: 1, indent: true };

type Widths = { ascii: number[]; extra: Map<string, number>; fallback: number; line: number };
const WIDTHS = new Map<FontId, Widths>();

function widths(font: FontId): Widths {
  let w = WIDTHS.get(font);
  if (!w) {
    const m = FONT_METRICS[font];
    const ascii = m.ascii.split(",").map(Number);
    // Unknown Latin characters: the average lowercase letter.
    const lower = ascii.slice(97 - 32, 123 - 32);
    w = { ascii, extra: new Map(Object.entries(m.extra)), fallback: lower.reduce((a, b) => a + b, 0) / lower.length, line: m.line };
    WIDTHS.set(font, w);
  }
  return w;
}

/** Chinese, Japanese and Korean characters: one full em each, and a line may break between any two of them. */
const WIDE = /[\u1100-\u11ff\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/u;

function charWidth(w: Widths, ch: string): number {
  const c = ch.codePointAt(0)!;
  if (c >= 32 && c < 127) return w.ascii[c - 32]!;
  if (WIDE.test(ch)) return 1000;
  return w.extra.get(ch) ?? w.fallback;
}

export type Layout = {
  words: number;
  lines: number;
  linesPerPage: number;
  /** Fractional pages: 3.4 means three full pages and 40 % of a fourth. */
  pages: number;
  wordsPerLine: number;
  wordsPerPage: number;
};

export function textArea(setup: PageSetup): { width: number; height: number } {
  const paper = PAPERS[setup.paper];
  const m = setup.margin * 72;
  return { width: paper.w - 2 * m, height: paper.h - 2 * m };
}

export function lineHeight(setup: PageSetup): number {
  return widths(setup.font).line * setup.size * setup.spacing;
}

export function linesPerPage(setup: PageSetup): number {
  // A hair of tolerance so 648 / 27.6 lands on 23 lines, not 22.999….
  return Math.max(1, Math.floor(textArea(setup).height / lineHeight(setup) + 1e-9));
}

/** Pieces a line can break between: words (with the space after them), the parts of a hyphenated word and single CJK characters. */
function tokens(paragraph: string): { text: string; space: boolean }[] {
  const out: { text: string; space: boolean }[] = [];
  for (const word of paragraph.split(/\s+/).filter(Boolean)) {
    if (!WIDE.test(word)) {
      // A line may also break after a hyphen inside a word (self-|esteem), as in Word and browsers.
      const pieces = word.split(/(?<=\p{L}-)(?=\p{L})/u);
      pieces.forEach((piece, i) => out.push({ text: piece, space: i === pieces.length - 1 }));
      continue;
    }
    // Split a mixed run like "AI模型" into "AI" and one token per wide character.
    let run = "";
    for (const ch of word) {
      if (WIDE.test(ch)) {
        if (run) out.push({ text: run, space: false });
        run = "";
        out.push({ text: ch, space: false });
      } else run += ch;
    }
    if (run) out.push({ text: run, space: false });
    out[out.length - 1]!.space = true;
  }
  return out;
}

/** Chinese characters and Japanese kana: each one counts as a word. Korean, which spaces its words, counts by spaces. */
const PER_CHAR = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/gu;

/**
 * Words as word processors count them: runs between spaces, every Chinese character or kana on its own, and nothing
 * for punctuation standing alone (，。 — …). Unlike word-count.ts, a Korean word is one word, not one per syllable.
 */
export function countWords(text: string): number {
  return text.replace(PER_CHAR, " $& ").split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
}

/** Lines the text takes. Each line of input is a paragraph; blank lines between paragraphs are not counted. */
export function countLines(text: string, setup: PageSetup): number {
  const w = widths(setup.font);
  const scale = setup.size / 1000;
  const width = textArea(setup).width;
  const space = w.ascii[0]! * scale;
  const measure = (s: string) => {
    let x = 0;
    for (const ch of s) x += charWidth(w, ch);
    return x * scale;
  };
  let lines = 0;
  for (const paragraph of text.split(/\r?\n/)) {
    const parts = tokens(paragraph);
    if (!parts.length) continue;
    lines++;
    // x is where the next piece would start; the first line begins after the indent.
    let x = setup.indent ? INDENT_PT : 0;
    let empty = true;
    let gap = 0;
    for (const part of parts) {
      let pw = measure(part.text);
      if (!empty && x + gap + pw > width + 1e-6) {
        lines++;
        x = 0;
      } else if (!empty) x += gap;
      // A piece wider than what is left of the line is broken where it runs out, as Word does.
      while (x + pw > width + 1e-6) {
        pw -= width - x;
        lines++;
        x = 0;
      }
      x += pw;
      empty = false;
      gap = part.space ? space : 0;
    }
  }
  return lines;
}

export function layoutText(text: string, setup: PageSetup): Layout {
  const words = countWords(text);
  const lines = countLines(text, setup);
  const perPage = linesPerPage(setup);
  return {
    words,
    lines,
    linesPerPage: perPage,
    pages: lines / perPage,
    wordsPerLine: lines ? words / lines : 0,
    wordsPerPage: lines ? (words / lines) * perPage : 0,
  };
}

const PER_PAGE = new Map<string, number>();

/** Words that fit on a page with these settings, measured on the sample prose. */
export function wordsPerPage(setup: PageSetup): number {
  const key = JSON.stringify(setup);
  let n = PER_PAGE.get(key);
  if (n === undefined) PER_PAGE.set(key, (n = layoutText(SAMPLE_TEXT, setup).wordsPerPage));
  return n;
}

/** Pages for a bare word count. */
export function pagesForWords(words: number, setup: PageSetup): number {
  return words > 0 ? words / wordsPerPage(setup) : 0;
}

/** Words that fill a number of pages. */
export function wordsForPages(pages: number, setup: PageSetup): number {
  return pages > 0 ? pages * wordsPerPage(setup) : 0;
}
