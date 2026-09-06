import { describe, expect, it } from "vitest";
import { outputFilename } from "../src/shared/filename";
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

describe("outputFilename", () => {
  it("adds a suffix and maps mime to extension", () => {
    expect(outputFilename("photo.JPEG", "image/png")).toBe("photo-watermark.png");
    expect(outputFilename("a/b/c.webp", "image/jpeg")).toBe("c-watermark.jpg");
  });
});
