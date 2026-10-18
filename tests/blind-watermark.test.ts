import sharp, { type Sharp } from "sharp";
import { describe, expect, it } from "vitest";
import { BLIND_MAX_BYTES, clipUtf8, decodeBlind, embedBlind, type Pixels } from "../src/client/watermark/blind";

async function load(input: Sharp): Promise<Pixels> {
  const { data, info } = await input.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
}

function via(px: Pixels, op: (s: Sharp) => Sharp): Promise<Pixels> {
  const src = sharp(Buffer.from(px.data), { raw: { width: px.width, height: px.height, channels: 4 } });
  return op(src).toBuffer().then((buf) => load(sharp(buf)));
}

function psnr(a: Pixels, b: Pixels): number {
  let se = 0;
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4)
    for (let c = 0; c < 3; c++) {
      const d = a.data[i + c] - b.data[i + c];
      se += d * d;
      n++;
    }
  return 10 * Math.log10((255 * 255) / (se / n));
}

const TEXT = "给招行 1018";
const PHOTOS = ["public/covers/watermark-sweet.jpg", "public/covers/clip-sweet.jpg", "public/covers/collage-sweet.jpg"];

describe("blind watermark", () => {
  it("clips the payload on a character boundary", () => {
    expect(new TextEncoder().encode(clipUtf8("一二三四五六七八九十")).length).toBe(15);
    expect(clipUtf8("abc")).toBe("abc");
    expect(clipUtf8("x".repeat(40)).length).toBe(BLIND_MAX_BYTES);
  });

  it("finds nothing in unmarked images", async () => {
    for (const path of PHOTOS) expect(decodeBlind(await load(sharp(path)))).toBeNull();
    expect(decodeBlind(await load(sharp(PHOTOS[0]).resize({ width: 500 })))).toBeNull();
  });

  it("stays invisible and survives recompression, resizing and tone edits", async () => {
    const edits: [string, (s: Sharp) => Sharp][] = [
      ["jpeg q50", (s) => s.jpeg({ quality: 50 })],
      ["webp q60", (s) => s.webp({ quality: 60 })],
      ["480 px + jpeg q70", (s) => s.resize({ width: 480 }).jpeg({ quality: 70 })],
      ["2× upscale + jpeg", (s) => s.resize({ width: 2560 }).jpeg({ quality: 80 })],
      ["stretched", (s) => s.resize({ width: 1000, height: 700, fit: "fill" }).jpeg({ quality: 80 })],
      ["brighter", (s) => s.linear(1, 6).jpeg({ quality: 80 })],
      ["more contrast", (s) => s.linear(1.08, -10).jpeg({ quality: 80 })],
    ];
    for (const path of PHOTOS) {
      const orig = await load(sharp(path));
      const px: Pixels = { ...orig, data: orig.data.slice() };
      expect(embedBlind(px, TEXT), path).toBe(true);
      expect(psnr(orig, px), path).toBeGreaterThan(42);
      for (const [name, op] of edits) expect(decodeBlind(await via(px, op))?.text, `${path} ${name}`).toBe(TEXT);
    }
  }, 60_000);

  it("leaves blank paper alone and reports that nothing could be hidden", async () => {
    const blank = await load(sharp({ create: { width: 800, height: 500, channels: 4, background: "#ffffff" } }));
    const before = blank.data.slice();
    expect(embedBlind(blank, TEXT)).toBe(false);
    expect(blank.data).toEqual(before);
  });

  it("never greys the white paper between ink strokes", async () => {
    const svg = `<svg width="1200" height="700"><rect width="1200" height="700" fill="#fff"/>${Array.from({ length: 10 }, (_, i) => `<text x="80" y="${80 + i * 60}" font-size="36" fill="#111">NAME ZHANG SAN 110101199001011234</text>`).join("")}</svg>`;
    const page = await load(sharp(Buffer.from(svg)));
    const before = page.data.slice();
    embedBlind(page, TEXT);
    for (let i = 0; i < before.length; i += 4) if (before[i] === 255) expect(page.data[i]).toBe(255);
  });

  it("corrects against a lossy copy", async () => {
    const px = await load(sharp(PHOTOS[1]));
    embedBlind(px, TEXT);
    const jpeg = await via(px, (s) => s.jpeg({ quality: 40 }));
    embedBlind(px, TEXT, 1, jpeg);
    expect(decodeBlind(await via(px, (s) => s.jpeg({ quality: 40 })))?.text).toBe(TEXT);
  });
});
