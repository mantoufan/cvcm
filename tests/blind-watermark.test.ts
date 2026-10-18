import sharp, { type Sharp } from "sharp";
import { describe, expect, it } from "vitest";
import { BLIND_GRID, BLIND_MAX_BYTES, blindPayloadOf, fitBlindText, decodeBlind, embedBlind, type Pixels } from "../src/client/watermark/blind";

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

const TEXT = { text: "仅供XX办理使用 他用无效", date: "2026-10-18" };
const PHOTOS = ["public/covers/watermark-sweet.jpg", "public/covers/clip-sweet.jpg", "public/covers/collage-sweet.jpg"];

describe("blind watermark", () => {
  it("packs preset phrases small and clips long text on a character boundary", () => {
    expect(fitBlindText("仅供XX办理使用 他用无效").bytes).toBe(6);
    expect(fitBlindText("FOR [ORG] USE ONLY NOT VALID OTHERWISE").bytes).toBe(6);
    expect(fitBlindText("関係者限り 目的外使用不可").bytes).toBe(3);
    const long = fitBlindText("x".repeat(60));
    expect(long.text.length).toBe(BLIND_MAX_BYTES);
    expect(blindPayloadOf("一".repeat(30), "2026-10-18").text).toBe("一".repeat(20));
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
      expect(decodeBlind(px)).toEqual(TEXT);
      expect(psnr(orig, px), path).toBeGreaterThan(42);
      for (const [name, op] of edits) expect(decodeBlind(await via(px, op)), `${path} ${name}`).toEqual(TEXT);
    }
  }, 60_000);

  it("leaves blank paper alone and reports that nothing could be hidden", async () => {
    const blank = await load(sharp({ create: { width: 800, height: 500, channels: 4, background: "#ffffff" } }));
    const before = blank.data.slice();
    expect(embedBlind(blank, TEXT)).toBe(false);
    expect(blank.data.every((v, i) => v === before[i])).toBe(true);
  });

  it("never greys the white paper between ink strokes", async () => {
    const svg = `<svg width="1200" height="700"><rect width="1200" height="700" fill="#fff"/>${Array.from({ length: 10 }, (_, i) => `<text x="80" y="${80 + i * 60}" font-size="36" fill="#111">NAME ZHANG SAN 110101199001011234</text>`).join("")}</svg>`;
    const page = await load(sharp(Buffer.from(svg)));
    const before = page.data.slice();
    embedBlind(page, TEXT);
    let greyed = 0;
    let drift = 0;
    for (let i = 0; i < before.length; i += 4) {
      if (before[i] === 255 && page.data[i] !== 255) greyed++;
      drift = Math.max(drift, Math.abs(page.data[i] - before[i]));
    }
    expect(greyed).toBe(0);
    // Ink next to paper undershoots every round; the per-call cap keeps it from creeping.
    expect(drift).toBeLessThanOrEqual(21);
    // The export's lossy correction rounds share the same budget.
    const spent = new Float32Array(BLIND_GRID * BLIND_GRID);
    const again = await load(sharp(Buffer.from(svg)));
    embedBlind(again, TEXT, { spent, verify: false });
    for (let round = 0; round < 2; round++) {
      embedBlind(again, TEXT, { rounds: 1, measure: await via(again, (x) => x.jpeg({ quality: 92 })), spent, verify: false });
    }
    let total = 0;
    for (let i = 0; i < before.length; i += 4) total = Math.max(total, Math.abs(again.data[i] - before[i]));
    // MAX_TOTAL (20) plus up to half a level of rounding per write-back.
    expect(total).toBeLessThanOrEqual(22);
  });

  it("corrects against a lossy copy", async () => {
    const px = await load(sharp(PHOTOS[1]));
    embedBlind(px, TEXT);
    const jpeg = await via(px, (s) => s.jpeg({ quality: 40 }));
    embedBlind(px, TEXT, { rounds: 1, measure: jpeg });
    expect(decodeBlind(await via(px, (s) => s.jpeg({ quality: 40 })))).toEqual(TEXT);
  });

  it("carries English and mixed text with the date through JPEG", async () => {
    for (const text of ["FOR [ORG] USE ONLY NOT VALID OTHERWISE", "给招商银行 深圳 开户"]) {
      const payload = { text, date: "2027-01-05" };
      const px = await load(sharp(PHOTOS[1]));
      expect(embedBlind(px, payload)).toBe(true);
      expect(decodeBlind(await via(px, (s) => s.jpeg({ quality: 70 })))).toEqual(payload);
    }
  });
});
