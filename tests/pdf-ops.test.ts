import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { extractPdfPages, mergePdfBuffers, parsePageRanges, pdfPageCount, splitPdfEachPage } from "../src/shared/pdf-ops";
import { appHref, parseAppPath } from "../src/shared/path";

async function pages(n: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < n; i++) doc.addPage();
  return doc.save();
}

describe("mergePdfBuffers", () => {
  it("concatenates pages in order", async () => {
    const merged = await mergePdfBuffers([await pages(1), await pages(2)]);
    expect(await pdfPageCount(merged)).toBe(3);
    const loaded = await PDFDocument.load(merged);
    expect(loaded.getPageCount()).toBe(3);
  });

  it("rejects an empty list", async () => {
    await expect(mergePdfBuffers([])).rejects.toThrow();
  });
});

describe("split pdf", () => {
  it("parses ranges and extracts pages", async () => {
    expect(parsePageRanges("1-3,5", 8)).toEqual([1, 2, 3, 5]);
    expect(parsePageRanges("", 3)).toEqual([1, 2, 3]);
    expect(() => parsePageRanges("nope", 3)).toThrow();
    const src = await pages(4);
    const part = await extractPdfPages(src, [2, 4]);
    expect(await pdfPageCount(part)).toBe(2);
    expect((await splitPdfEachPage(src)).length).toBe(4);
  });
});

describe("pdf routes", () => {
  it("parses pdf-jpg and merge-pdf", () => {
    expect(parseAppPath("/en/pdf-jpg/")).toEqual({ kind: "app", locale: "en", tool: "pdf-jpg" });
    expect(parseAppPath("/zh-CN/merge-pdf/")).toEqual({ kind: "app", locale: "zh-CN", tool: "merge-pdf" });
    expect(parseAppPath("/en/compress-pdf/")).toEqual({ kind: "app", locale: "en", tool: "compress-pdf" });
    expect(parseAppPath("/ja/split-pdf/")).toEqual({ kind: "app", locale: "ja", tool: "split-pdf" });
    expect(parseAppPath("/en/names/")).toEqual({ kind: "app", locale: "en", tool: "names" });
    expect(appHref("es", "pdf-jpg")).toBe("/es/pdf-jpg/");
  });
});
