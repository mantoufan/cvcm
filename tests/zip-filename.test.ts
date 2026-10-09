import { describe, expect, it } from "vitest";
import { outputFilename } from "../src/shared/filename";
import { pdfFromJpegs } from "../src/shared/pdf";
import { crc32, zipStore } from "../src/shared/zip";

describe("crc32", () => {
  it("matches the ISO 3309 check value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
});

describe("zipStore", () => {
  it("builds a zip that contains the file name and payload", () => {
    const data = new TextEncoder().encode("hello");
    const zip = zipStore([{ name: "a.txt", data }], new Date("2026-09-06T00:00:00"));
    const asText = new TextDecoder().decode(zip);
    expect(asText.includes("a.txt")).toBe(true);
    expect(asText.includes("hello")).toBe(true);
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
  });
});

describe("pdfFromJpegs", () => {
  it("rejects an empty page list", () => {
    expect(() => pdfFromJpegs([])).toThrow();
  });

  it("keeps an explicit page size and draws the image edge to edge", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const pdf = new TextDecoder().decode(
      pdfFromJpegs([{ jpeg, width: 918, height: 1188, page: { w: 612, h: 792 } }], "fit"),
    );
    expect(pdf).toContain("/MediaBox [0 0 612.00 792.00]");
    expect(pdf).toContain("q 612.00 0 0 792.00 0.00 0.00 cm");
  });
});

describe("outputFilename", () => {
  it("adds a suffix and maps mime to extension", () => {
    expect(outputFilename("photo.JPEG", "image/png")).toBe("photo-watermark.png");
    expect(outputFilename("a/b/c.webp", "image/jpeg")).toBe("c-watermark.jpg");
    expect(outputFilename("shot.png", "application/pdf", "")).toBe("shot.pdf");
  });
});
