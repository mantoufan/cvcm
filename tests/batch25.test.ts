import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { GifWriter, delayCs, lzw, mapPixels, quantize } from "../src/shared/gif";
import { MAX_FRAMES, fitFrame, frameCount, frameTimes, gifSize } from "../src/shared/gif-frames";
import { AREA_FIELDS, AREA_SHAPES, convertArea, solveArea } from "../src/shared/area";
import { VOLUME_FIELDS, VOLUME_SHAPES, convertVolume, solveVolume } from "../src/shared/volume";
import { ALPHABET, ALPHABETS, drawLetters, letterPool } from "../src/shared/random-letter";
import { cropArea, postingOrder, splitGrid, tileName } from "../src/shared/image-split";
import { readSvg, sizedSvg, svgLength, svgPixelSize, svgText, MAX_SVG_EDGE, MAX_SVG_PIXELS } from "../src/shared/svg-size";
import { parseDecimalInput } from "../src/shared/decimal-input";

const W = 160;
const H = 90;

function gradient(base: [number, number, number]): Uint8ClampedArray {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let p = 0; p < W * H; p++) {
    d[p * 4] = Math.min(255, base[0] + (p % W));
    d[p * 4 + 1] = base[1];
    d[p * 4 + 2] = base[2];
    d[p * 4 + 3] = 255;
  }
  return d;
}

function noise(seed = 1): Uint8ClampedArray {
  const d = new Uint8ClampedArray(W * H * 4);
  let s = seed;
  for (let i = 0; i < d.length; i++) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    d[i] = i % 4 === 3 ? 255 : (s >>> 16) & 255;
  }
  return d;
}

describe("gif encoder", () => {
  it("writes an animated GIF that a real decoder reads back: frames, delays, loop and colours", async () => {
    const w = new GifWriter({ width: W, height: H, loop: 0 });
    w.addFrame(gradient([200, 0, 0]), { colors: 64, dither: false, delayMs: 250 });
    w.addFrame(gradient([0, 200, 80]), { colors: 64, dither: true, delayMs: 250 });
    w.addFrame(gradient([30, 60, 200]), { colors: 32, dither: false, delayMs: 1000 });
    const pixels = noise();
    // A noisy full-colour frame fills the LZW table many times over, so the clear/reset path runs.
    w.addFrame(pixels, { colors: 256, dither: false, delayMs: 40 });
    expect(w.frameCount).toBe(4);
    const gif = Buffer.from(w.finish());
    const meta = await sharp(gif, { animated: true }).metadata();
    expect(meta.pages).toBe(4);
    expect(meta.width).toBe(W);
    expect(meta.pageHeight).toBe(H);
    expect(meta.delay).toEqual([250, 250, 1000, 40]);
    expect(meta.loop).toBe(0);
    const raw = await sharp(gif, { animated: true }).ensureAlpha().raw().toBuffer();
    const at = (k: number, x: number, y: number) => {
      const o = ((k * H + y) * W + x) * 4;
      return [raw[o]!, raw[o + 1]!, raw[o + 2]!];
    };
    const near = (a: number[], b: number[], tol: number) => a.forEach((v, i) => expect(Math.abs(v - b[i]!)).toBeLessThanOrEqual(tol));
    near(at(0, 0, 0), [200, 0, 0], 6);
    near(at(0, 50, 40), [250, 0, 0], 6);
    near(at(2, 100, 80), [130, 60, 200], 8);
    // Even random noise keeps its average level per channel.
    let sum = 0;
    let want = 0;
    for (let p = 0; p < W * H; p++) {
      sum += at(3, p % W, Math.floor(p / W))[0]!;
      want += pixels[p * 4]!;
    }
    expect(Math.abs(sum - want) / (W * H)).toBeLessThan(6);
  });

  it("plays once without a loop block, and repeats n more times with one", async () => {
    const once = new GifWriter({ width: 4, height: 4, loop: null });
    once.addFrame(new Uint8ClampedArray(64).fill(255), { colors: 2, dither: false, delayMs: 100 });
    const bytes = once.finish();
    expect(Buffer.from(bytes).includes(Buffer.from("NETSCAPE2.0"))).toBe(false);
    const three = new GifWriter({ width: 4, height: 4, loop: 2 });
    three.addFrame(new Uint8ClampedArray(64).fill(255), { colors: 2, dither: false, delayMs: 100 });
    const meta = await sharp(Buffer.from(three.finish()), { animated: true }).metadata();
    // libvips reports total plays: a NETSCAPE count of 2 is the first play plus two repeats.
    expect(meta.loop).toBe(3);
  });

  it("keeps a flat colour exact and a two-colour image to two entries", () => {
    const flat = new Uint8ClampedArray(400);
    for (let i = 0; i < 400; i += 4) flat.set([12, 34, 56, 255], i);
    expect([...quantize(flat, 256)]).toEqual([12, 34, 56]);
    const two = new Uint8ClampedArray(800);
    for (let i = 0; i < 800; i += 4) two.set(i < 400 ? [0, 0, 0, 255] : [255, 255, 255, 255], i);
    const palette = quantize(two, 256);
    expect(palette.length).toBe(6);
    const idx = mapPixels(two, 200, 1, palette, true);
    // Dithering a two-colour picture with an exact palette changes nothing.
    expect(new Set(idx.slice(0, 100)).size).toBe(1);
    expect(idx[0]).not.toBe(idx[199]);
  });

  it("frames LZW output in sub-blocks of at most 255 bytes, ending with an empty block", () => {
    const out = lzw(new Uint8Array(20000).map((_, i) => (i * 7919) % 256), 8);
    expect(out[0]).toBe(8);
    let i = 1;
    while (out[i] !== 0) {
      expect(out[i]).toBeLessThanOrEqual(255);
      i += out[i]! + 1;
    }
    expect(i).toBe(out.length - 1);
  });

  it("widens the end code when the decoder widens after the last code", () => {
    // [0, 1, 2] at code size 2: entries 6 and 7 fill the 3-bit range, so the decoder reads the end code in 4 bits.
    // Codes, least significant bit first: clear(4) 0 1 2 in 3 bits, then end(5) in 4 bits = 16 bits in one sub-block.
    // (Zero padding hides a 3-bit end code in this tiny case; the layout is what a strict decoder expects.)
    const out = lzw(new Uint8Array([0, 1, 2]), 2);
    expect([...out]).toEqual([2, 2, 0b01000100, 0b01010100, 0]);
  });

  it("stores delays in hundredths with a 2 floor", () => {
    expect(delayCs(500)).toBe(50);
    expect(delayCs(5)).toBe(2);
    expect(delayCs(1e9)).toBe(65535);
  });

  it("sizes frames and samples video moments", () => {
    expect(gifSize(1920, 1080, 480)).toEqual({ width: 480, height: 270 });
    expect(gifSize(300, 200, 800)).toEqual({ width: 300, height: 200 });
    // A tall screenshot is narrowed so the GIF is at most 1600 px tall.
    expect(gifSize(1080, 8000, 480)).toEqual({ width: 216, height: 1600 });
    const contain = fitFrame(100, 50, 100, 100, "contain");
    expect(contain).toMatchObject({ dx: 0, dy: 25, dw: 100, dh: 50 });
    const cover = fitFrame(100, 50, 100, 100, "cover");
    expect(cover).toMatchObject({ sx: 25, sy: 0, sw: 50, sh: 50, dw: 100, dh: 100 });
    const times = frameTimes(1, 2, 10, 5);
    expect(times).toHaveLength(10);
    expect(times[0]).toBeCloseTo(1.05);
    expect(times[9]).toBeCloseTo(1.95);
    expect(frameTimes(4, 9, 10, 5)).toHaveLength(10);
    expect(frameTimes(2, 2, 10, 5)).toEqual([]);
    expect(frameTimes(0, 1000, 25, 1000)).toHaveLength(MAX_FRAMES + 1);
    expect(frameCount(0, 60, 10, 120)).toBe(600);
  });
});

describe("area", () => {
  const close = (shape: (typeof AREA_SHAPES)[number], values: Record<string, number>, area: number, perimeter: number | null) => {
    const r = solveArea(shape, values);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.area).toBeCloseTo(area, 6);
    if (perimeter === null) expect(r.perimeter).toBeNull();
    else expect(r.perimeter).toBeCloseTo(perimeter, 6);
  };

  it("solves every shape", () => {
    close("rectangle", { length: 5, width: 3 }, 15, 16);
    close("square", { side: 4 }, 16, 16);
    close("triangle", { base: 6, height: 4 }, 12, null);
    close("triangle-sides", { a: 3, b: 4, c: 5 }, 6, 12);
    close("circle", { radius: 2 }, 4 * Math.PI, 4 * Math.PI);
    close("ellipse", { semiMajor: 3, semiMinor: 3 }, 9 * Math.PI, 6 * Math.PI);
    close("trapezoid", { base1: 4, base2: 6, height: 3 }, 15, null);
    close("parallelogram", { base: 7, height: 2 }, 14, null);
    close("rhombus", { d1: 6, d2: 8 }, 24, 20);
    close("sector", { radius: 2, angle: 90 }, Math.PI, Math.PI + 4);
    close("sector", { radius: 1, angle: 360 }, Math.PI, 2 * Math.PI);
    close("polygon", { count: 6, side: 2 }, 6 * Math.sqrt(3), 12);
    close("polygon", { count: 4, side: 3 }, 9, 12);
    close("annulus", { outer: 3, inner: 1 }, 8 * Math.PI, 8 * Math.PI);
  });

  it("approximates the ellipse perimeter closely", () => {
    const r = solveArea("ellipse", { semiMajor: 10, semiMinor: 1 });
    // Exact perimeter of a 10:1 ellipse is 40.6397...
    expect(r.ok && r.perimeter).toBeCloseTo(40.6397, 3);
    expect(r.ok && r.perimeterApprox).toBe(true);
  });

  it("says what is wrong", () => {
    expect(solveArea("rectangle", { length: 5 })).toEqual({ ok: false, error: "missing" });
    expect(solveArea("rectangle", { length: 5, width: -1 })).toEqual({ ok: false, error: "positive" });
    expect(solveArea("rectangle", { length: 5, width: NaN })).toEqual({ ok: false, error: "positive" });
    expect(solveArea("triangle-sides", { a: 1, b: 2, c: 3 })).toEqual({ ok: false, error: "triangle" });
    expect(solveArea("triangle-sides", { a: 0.1, b: 0.2, c: 0.3 })).toEqual({ ok: false, error: "triangle" });
    expect(solveArea("polygon", { count: 2.5, side: 1 })).toEqual({ ok: false, error: "count" });
    expect(solveArea("sector", { radius: 1, angle: 400 })).toEqual({ ok: false, error: "angle" });
    expect(solveArea("annulus", { outer: 1, inner: 1 })).toEqual({ ok: false, error: "annulus" });
  });

  it("names every field a shape needs and shows the working with the result", () => {
    for (const shape of AREA_SHAPES) expect(AREA_FIELDS[shape].length).toBeGreaterThan(0);
    const r = solveArea("rectangle", { length: 5, width: 3 });
    expect(r.ok && r.working[0]).toBe("A = 5 × 3 = 15");
  });

  it("converts area units", () => {
    const ft = convertArea(1, "m");
    expect(ft.ft2).toBeCloseTo(10.7639104, 6);
    expect(convertArea(43560, "ft").acre).toBeCloseTo(1, 9);
    expect(convertArea(1, "km").ha).toBeCloseTo(100, 9);
    expect(convertArea(1, "mi").acre).toBeCloseTo(640, 6);
  });
});

describe("volume", () => {
  const close = (shape: (typeof VOLUME_SHAPES)[number], values: Record<string, number>, volume: number, surface: number) => {
    const r = solveVolume(shape, values);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.volume).toBeCloseTo(volume, 6);
    expect(r.surface).toBeCloseTo(surface, 6);
  };

  it("solves every solid", () => {
    close("box", { length: 2, width: 3, height: 4 }, 24, 52);
    close("cube", { side: 3 }, 27, 54);
    close("cylinder", { radius: 1, height: 2 }, 2 * Math.PI, 6 * Math.PI);
    close("sphere", { radius: 3 }, 36 * Math.PI, 36 * Math.PI);
    close("cone", { radius: 3, height: 4 }, 12 * Math.PI, 24 * Math.PI);
    // Square pyramid 6 × 6, height 4: slant height 5, four faces of 15.
    close("pyramid", { length: 6, width: 6, height: 4 }, 48, 96);
    close("triangular-prism", { a: 3, b: 4, c: 5, length: 10 }, 60, 132);
    close("hemisphere", { radius: 1 }, (2 / 3) * Math.PI, 3 * Math.PI);
    close("capsule", { radius: 1, length: 2 }, 2 * Math.PI + (4 / 3) * Math.PI, 4 * Math.PI + 4 * Math.PI);
    // A frustum with equal radii is a cylinder.
    close("frustum", { radius1: 1, radius2: 1, height: 2 }, 2 * Math.PI, 6 * Math.PI);
    close("ellipsoid", { axisA: 2, axisB: 2, axisC: 2 }, (32 / 3) * Math.PI, 16 * Math.PI);
    close("tube", { outer: 2, inner: 1, height: 1 }, 3 * Math.PI, 6 * Math.PI + 6 * Math.PI);
  });

  it("flags bad input", () => {
    expect(solveVolume("tube", { outer: 1, inner: 2, height: 1 })).toEqual({ ok: false, error: "tube" });
    expect(solveVolume("triangular-prism", { a: 1, b: 1, c: 5, length: 1 })).toEqual({ ok: false, error: "triangle" });
    expect(solveVolume("box", { length: 1, width: 1 })).toEqual({ ok: false, error: "missing" });
    for (const shape of VOLUME_SHAPES) expect(VOLUME_FIELDS[shape].length).toBeGreaterThan(0);
  });

  it("marks the ellipsoid surface as approximate unless it is a sphere", () => {
    const r = solveVolume("ellipsoid", { axisA: 3, axisB: 2, axisC: 1 });
    expect(r.ok && r.surfaceApprox).toBe(true);
    // Exact surface of the 3-2-1 ellipsoid is 48.8821...; Thomsen's formula is within about 1%.
    expect(r.ok && Math.abs(r.surface - 48.8821) / 48.8821).toBeLessThan(0.012);
  });

  it("converts to litres and gallons", () => {
    const v = convertVolume(1000, "cm");
    expect(v.l).toBeCloseTo(1, 12);
    expect(v.ml).toBeCloseTo(1000, 9);
    expect(convertVolume(231, "in").usGal).toBeCloseTo(1, 12);
    expect(convertVolume(1, "m").ukGal).toBeCloseTo(219.969248, 5);
    expect(convertVolume(1, "ft").l).toBeCloseTo(28.316846592, 9);
  });
});

describe("random letter", () => {
  /** A fake source that cycles through fixed picks. */
  const fixed = (picks: number[]) => {
    let i = 0;
    return (n: number) => picks[i++ % picks.length]! % n;
  };

  it("builds pools from the alphabet, kind and exclusions", () => {
    expect(letterPool({ alphabet: "en", kind: "all", exclude: "" })).toHaveLength(26);
    expect(letterPool({ alphabet: "en", kind: "vowels", exclude: "" }).join("")).toBe("AEIOU");
    expect(letterPool({ alphabet: "en", kind: "consonants", exclude: "x, q z" })).toHaveLength(18);
    expect(letterPool({ alphabet: "es", kind: "all", exclude: "" })).toContain("Ñ");
    expect(letterPool({ alphabet: "vi", kind: "all", exclude: "" })).toHaveLength(29);
    // A decomposed ă (a + combining breve) leaves out Ă, not A.
    const vi = letterPool({ alphabet: "vi", kind: "all", exclude: "a\u0306" });
    expect(vi).toContain("A");
    expect(vi).not.toContain("Ă");
    expect(letterPool({ alphabet: "ru", kind: "all", exclude: "" })).toHaveLength(33);
    // Ъ and Ь are neither vowels nor consonants.
    expect(letterPool({ alphabet: "ru", kind: "consonants", exclude: "" })).not.toContain("Ь");
    expect(letterPool({ alphabet: "el", kind: "all", exclude: "" })).toHaveLength(24);
    expect(letterPool({ alphabet: "hiragana", kind: "vowels", exclude: "" })).toHaveLength(46);
    for (const a of ALPHABETS) expect(new Set(ALPHABET[a].letters).size).toBe(ALPHABET[a].letters.length);
  });

  it("draws with or without repeats and applies case after the draw", () => {
    const base = { alphabet: "en" as const, kind: "all" as const, exclude: "", unique: false };
    expect(drawLetters({ ...base, letterCase: "upper", count: 3 }, fixed([0, 0, 25]))).toEqual({ ok: true, letters: ["A", "A", "Z"] });
    expect(drawLetters({ ...base, letterCase: "lower", count: 2 }, fixed([1, 2]))).toEqual({ ok: true, letters: ["b", "c"] });
    const unique = drawLetters({ ...base, unique: true, letterCase: "upper", count: 26 }, fixed([0]));
    expect(unique.ok && new Set(unique.letters).size).toBe(26);
    expect(drawLetters({ ...base, unique: true, letterCase: "upper", count: 27 })).toEqual({ ok: false, error: "unique" });
    expect(drawLetters({ ...base, letterCase: "upper", count: 0 })).toEqual({ ok: false, error: "count" });
    expect(drawLetters({ ...base, letterCase: "upper", count: 1, exclude: "abcdefghijklmnopqrstuvwxyz" })).toEqual({ ok: false, error: "empty" });
    // Kana have no case.
    expect(drawLetters({ ...base, alphabet: "katakana", letterCase: "lower", count: 1 }, fixed([0]))).toEqual({ ok: true, letters: ["ア"] });
  });

  it("is roughly uniform with the real random source", () => {
    const r = drawLetters({ alphabet: "en", kind: "vowels", letterCase: "upper", exclude: "", unique: false, count: 1000 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const v of "AEIOU") {
      const n = r.letters.filter((x) => x === v).length;
      expect(n).toBeGreaterThan(130);
      expect(n).toBeLessThan(270);
    }
  });
});

describe("image splitter", () => {
  it("covers the picture with tiles that differ by at most a pixel", () => {
    const tiles = splitGrid({ x: 0, y: 0, width: 1001, height: 500 }, 2, 3);
    expect(tiles).toHaveLength(6);
    expect(tiles.map((t) => t.width).slice(0, 3)).toEqual([334, 333, 334]);
    expect(tiles.reduce((s, t) => s + t.width * t.height, 0)).toBe(1001 * 500);
    expect(tiles[5]).toMatchObject({ row: 1, col: 2, index: 5, x: 667, y: 250 });
  });

  it("crops to square or 3:4 tiles in the centre", () => {
    expect(cropArea(1200, 900, 3, 3, "square")).toEqual({ x: 150, y: 0, width: 900, height: 900 });
    expect(cropArea(1000, 300, 1, 3, "square")).toEqual({ x: 50, y: 0, width: 900, height: 300 });
    expect(cropArea(1000, 300, 1, 3, "whole")).toEqual({ x: 0, y: 0, width: 1000, height: 300 });
    // 3 × 3 portrait from a 3000 × 3000 picture: 750 × 1000 tiles (250 × 3 by 250 × 4), centred left to right.
    const area = cropArea(3000, 3000, 3, 3, "portrait");
    expect(area).toEqual({ x: 375, y: 0, width: 2250, height: 3000 });
    const tiles = splitGrid(area, 3, 3);
    for (const t of tiles) expect(t.width * 4).toBe(t.height * 3);
    // Sizes that do not divide: tiles stay within a pixel of 3:4 and almost nothing extra is trimmed.
    const odd = cropArea(1199, 1599, 20, 20, "portrait");
    expect(odd).toEqual({ x: 9, y: 9, width: 1180, height: 1580 });
    for (const t of splitGrid(odd, 20, 20)) expect(Math.abs(t.width / t.height - 0.75)).toBeLessThan(1 / t.height + 1e-9);
    // A tiny picture still splits (1 px tiles) instead of reporting a grid finer than the picture.
    expect(cropArea(50, 50, 20, 20, "portrait")).toEqual({ x: 15, y: 15, width: 20, height: 20 });
  });

  it("numbers posts from the last tile and names files in reading order", () => {
    expect(postingOrder(3)).toEqual([3, 2, 1]);
    const tiles = splitGrid({ x: 0, y: 0, width: 100, height: 100 }, 10, 2);
    expect(tileName("photo", tiles[0]!, 10, 2, "png")).toBe("photo-r01-c1.png");
    expect(tileName("photo", tiles[19]!, 10, 2, "jpg")).toBe("photo-r10-c2.jpg");
  });
});

describe("svg size", () => {
  it("reads lengths in CSS units", () => {
    expect(svgLength("100")).toBe(100);
    expect(svgLength("72pt")).toBe(96);
    expect(svgLength("1in")).toBe(96);
    expect(svgLength("50%")).toBeNull();
    expect(svgLength(null)).toBeNull();
  });

  it("works out the drawing size the way browsers do", () => {
    expect(readSvg('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"></svg>')).toMatchObject({ width: 64, height: 32, hasViewBox: false });
    expect(readSvg('<?xml version="1.0"?><svg viewBox="0 0 24 12"><path stroke-width="2"/></svg>')).toMatchObject({ width: 24, height: 12, hasViewBox: true });
    expect(readSvg('<svg width="48" viewBox="0 0 24 12"></svg>')).toMatchObject({ width: 48, height: 24 });
    expect(readSvg('<svg width="100%" height="100%"></svg>')).toMatchObject({ width: 300, height: 150 });
    expect(readSvg("<html></html>")).toBeNull();
    // A prefixed root is left to the browser rather than rewritten into broken markup.
    expect(readSvg('<svg:svg xmlns:svg="http://www.w3.org/2000/svg" width="10" height="10"/>')).toBeNull();
    expect(readSvg('<svg:svg xmlns:svg="http://www.w3.org/2000/svg" width="800" height="600"><svg width="50" height="50"/></svg:svg>')).toBeNull();
    // Attribute names are case-sensitive: browsers ignore "viewbox", so a viewBox is still added.
    expect(readSvg('<svg viewbox="0 0 10 10"></svg>')).toMatchObject({ width: 300, height: 150, hasViewBox: false });
    // A tag inside a comment or the DOCTYPE is not the root.
    const commented = '<!DOCTYPE svg [<!ENTITY x "<svg width=\'1\'>">]><!-- <svg width="16" height="16"> --><svg width="64" height="32"></svg>';
    expect(readSvg(commented)).toMatchObject({ width: 64, height: 32 });
    expect(sizedSvg(commented, readSvg(commented)!, 128, 64)).toContain('<!-- <svg width="16" height="16"> --><svg width="128" height="64"');
  });

  it("rewrites only the root size and adds a viewBox when there is none", () => {
    const text = '<svg width="10" height="20" stroke-width="3"><rect width="5" height="5"/></svg>';
    const info = readSvg(text)!;
    const out = sizedSvg(text, info, 40, 80);
    expect(out).toBe('<svg width="40" height="80" viewBox="0 0 10 20" stroke-width="3"><rect width="5" height="5"/></svg>');
    const vb = '<svg viewBox="0 0 24 24" width="24px" height="24px"/>';
    expect(sizedSvg(vb, readSvg(vb)!, 96, 96)).toBe('<svg width="96" height="96" viewBox="0 0 24 24"/>');
  });

  it("decodes an SVG in its declared encoding and redeclares it as UTF-8", () => {
    const latin1 = new Uint8Array([...new TextEncoder().encode('<?xml version="1.0" encoding="ISO-8859-1"?><svg><text>caf'), 0xe9, ...new TextEncoder().encode("</text></svg>")]);
    expect(svgText(latin1.buffer)).toBe('<?xml version="1.0" encoding="UTF-8"?><svg><text>café</text></svg>');
    expect(svgText(new TextEncoder().encode("<svg>é</svg>").buffer)).toBe("<svg>é</svg>");
  });

  it("scales but caps the pixel size", () => {
    expect(svgPixelSize({ width: 24, height: 12 }, 4)).toEqual({ width: 96, height: 48 });
    expect(svgPixelSize({ width: 5000, height: 1000 }, 4)).toEqual({ width: MAX_SVG_EDGE, height: 1638 });
    // iOS Safari's canvas limit: 2048² at 4× would be 67 megapixels; it stays at 16.7.
    const big = svgPixelSize({ width: 2048, height: 2048 }, 4);
    expect(big).toEqual({ width: 4096, height: 4096 });
    expect(big.width * big.height).toBeLessThanOrEqual(MAX_SVG_PIXELS);
  });
});

describe("decimal input", () => {
  it("reads points, decimal commas and thousands the way each locale writes them", () => {
    expect(parseDecimalInput("3.5", "en")).toBe(3.5);
    expect(parseDecimalInput("3,5", "es")).toBe(3.5);
    expect(parseDecimalInput("1,000", "en")).toBe(1000);
    expect(parseDecimalInput("1,000", "vi")).toBe(1);
    expect(parseDecimalInput("1,000.5", "es")).toBe(1000.5);
    expect(parseDecimalInput("1.000,5", "es")).toBe(1000.5);
    expect(parseDecimalInput("1.000,5", "en")).toBe(1000.5);
    // A lone dot is a decimal point everywhere (phones type "." on decimal keypads); several dots are not a number.
    expect(parseDecimalInput("2.375", "vi")).toBe(2.375);
    expect(parseDecimalInput("1.000", "id")).toBe(1);
    expect(parseDecimalInput("12.500.000", "vi")).toBeNaN();
    expect(parseDecimalInput("1.5", "es")).toBe(1.5);
    expect(parseDecimalInput("1.000", "en")).toBe(1);
    expect(parseDecimalInput("1.000.5", "en")).toBeNaN();
    expect(parseDecimalInput("+5", "en")).toBe(5);
    // Mixed separators must be real thousands groups.
    expect(parseDecimalInput("1.5,000", "en")).toBeNaN();
    expect(parseDecimalInput("1,2,3.4", "en")).toBeNaN();
    expect(parseDecimalInput("12,345,678.9", "en")).toBe(12345678.9);
    expect(parseDecimalInput("0,125", "en")).toBe(0.125);
    expect(parseDecimalInput("−2", "en")).toBe(-2);
    expect(parseDecimalInput("", "en")).toBeUndefined();
    expect(parseDecimalInput("abc", "en")).toBeNaN();
    expect(parseDecimalInput("0x10", "en")).toBeNaN();
  });
});
