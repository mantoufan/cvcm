import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { mergePdfBuffers, pdfPageCount } from "../src/shared/pdf-ops";
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

describe("pdf routes", () => {
  it("parses pdf-jpg and merge-pdf", () => {
    expect(parseAppPath("/en/pdf-jpg/")).toEqual({ kind: "app", locale: "en", tool: "pdf-jpg" });
    expect(parseAppPath("/zh-CN/merge-pdf/")).toEqual({ kind: "app", locale: "zh-CN", tool: "merge-pdf" });
    expect(parseAppPath("/en/compress-pdf/")).toEqual({ kind: "app", locale: "en", tool: "compress-pdf" });
    expect(appHref("es", "pdf-jpg")).toBe("/es/pdf-jpg/");
  });
});
