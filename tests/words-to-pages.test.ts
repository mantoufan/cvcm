import { describe, expect, it } from "vitest";
import {
  ESSAY, FONT_IDS, countLines, countWords, layoutText, lineHeight, linesPerPage, pagesForWords, wordsForPages, wordsPerPage,
} from "../src/shared/words-to-pages";
import { FONT_METRICS } from "../src/shared/font-metrics";
import { SAMPLE_TEXT } from "../src/shared/words-to-pages-sample";

const single = { ...ESSAY, spacing: 1 };

describe("words to pages", () => {
  it("uses Word's single line heights: 1.15 em for Times New Roman, 1.22 for Calibri", () => {
    expect(FONT_METRICS.times.line).toBeCloseTo(1.15, 2);
    expect(FONT_METRICS.calibri.line).toBeCloseTo(1.22, 2);
    expect(lineHeight(ESSAY)).toBeCloseTo(27.6, 1);
    // 9 in of text height (648 pt): 23 double-spaced lines, 46 single-spaced.
    expect([linesPerPage(ESSAY), linesPerPage(single)]).toEqual([23, 46]);
    expect(linesPerPage({ ...ESSAY, paper: "a4" })).toBe(25);
  });

  it("matches the line counts a browser gives the sample text in the same fonts", () => {
    // Chromium 12 pt, 6.5 in wide, 0.5 in first-line indent, no kerning (2026-11-19): Times 122, Arial 133, Georgia 133, Verdana 153.
    // Verdana only matches with line breaks after hyphens inside words (self-|esteem), as browsers and Word make.
    const lines = (font: (typeof FONT_IDS)[number]) => countLines(SAMPLE_TEXT, { ...single, font });
    expect([lines("times"), lines("arial"), lines("georgia"), lines("verdana")]).toEqual([122, 133, 133, 153]);
  });

  it("gives about 350 words a double-spaced page in Times New Roman 12 pt, as the FAQ says", () => {
    expect(Math.round(wordsPerPage(ESSAY))).toBe(351);
    expect(Math.round(wordsPerPage(single))).toBe(702);
    expect(Math.round(wordsPerPage({ ...ESSAY, font: "arial" }))).toBe(322);
    expect(Math.round(wordsPerPage({ ...ESSAY, font: "courier" }))).toBe(239);
    expect(Math.round(pagesForWords(1000, ESSAY) * 10) / 10).toBe(2.8);
    expect(Math.round(pagesForWords(1000, single) * 10) / 10).toBe(1.4);
    expect(Math.round(pagesForWords(1000, { ...ESSAY, font: "arial" }) * 10) / 10).toBe(3.1);
    expect(wordsForPages(2, ESSAY)).toBeCloseTo(2 * wordsPerPage(ESSAY));
    expect([pagesForWords(0, ESSAY), wordsForPages(-1, ESSAY)]).toEqual([0, 0]);
  });

  it("fits fewer words with bigger type, wider margins or more spacing", () => {
    const base = wordsPerPage(ESSAY);
    expect(wordsPerPage({ ...ESSAY, size: 14 })).toBeLessThan(base);
    expect(wordsPerPage({ ...ESSAY, margin: 1.25 })).toBeLessThan(base);
    expect(wordsPerPage({ ...ESSAY, spacing: 1.5 })).toBeGreaterThan(base);
    for (const font of FONT_IDS) expect(wordsPerPage({ ...ESSAY, font }), font).toBeGreaterThan(200);
  });

  it("lays out pasted text: paragraphs, indents, long words, hyphens and CJK", () => {
    expect(countLines("", ESSAY)).toBe(0);
    expect(countLines("One short paragraph.\n\n\nAnother one.", ESSAY)).toBe(2);
    // A word longer than the line wraps onto as many lines as it needs.
    expect(countLines("x".repeat(400), { ...single, indent: false })).toBeGreaterThan(3);
    // 39 one-em characters per 468 pt line at 12 pt.
    expect(countLines("字".repeat(39), { ...single, indent: false })).toBe(1);
    expect(countLines("字".repeat(40), { ...single, indent: false })).toBe(2);
    expect(countWords("AI模型 test 人工智能")).toBe(1 + 2 + 1 + 4);
    const l = layoutText(SAMPLE_TEXT, ESSAY);
    expect(l.words).toBe(SAMPLE_TEXT.split(/\s+/).length);
    expect(l.pages).toBeCloseTo(l.lines / 23);
  });
});
