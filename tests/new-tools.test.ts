import { describe, expect, it } from "vitest";
import { charsetFor, entropyBits, generatePassword } from "../src/shared/password";
import { encodeQr, qrSize, qrVersion } from "../src/shared/qr";
import { countText } from "../src/shared/word-count";
import { generateName, generateNames } from "../src/shared/names";
import { generateLorem, loremWords } from "../src/shared/lorem";
import { convertWallTime } from "../src/shared/timezone";
import { convertAmount, convertUnits } from "../src/shared/units";
import { ean13Checksum, encodeBarcode } from "../src/shared/barcode";
import { memeFontSize, normalizeMemeText, wrapByWidth } from "../src/shared/meme";
import { pickVoice, splitUtterances } from "../src/shared/tts";
import { invoiceTotals, lineAmount, wrapInvoiceText } from "../src/shared/invoice";
import { clampBounds, hasInk, strokeBounds } from "../src/shared/signature";
import { diffCounts, diffLines, unifiedDiff } from "../src/shared/diff";
import { generateUuids, isUuidV4, uuidV4 } from "../src/shared/uuid";
import { MAX_MATCHES, normalizeFlags, runRegex } from "../src/shared/regex";
import { packIco, squareDest, squareSource } from "../src/shared/favicon";
import { clampRange, formatClock, sliceChannels, waveformPeaks } from "../src/shared/audio-cut";
import { appHref, parseAppPath } from "../src/shared/path";

describe("qr", () => {
  it("paints finders and grows with payload", () => {
    const small = encodeQr("https://cv.cm", "M");
    expect(small.length).toBe(qrSize("https://cv.cm", "M"));
    expect(small[0]?.length).toBe(small.length);
    expect(small[0]?.slice(0, 7)).toEqual([true, true, true, true, true, true, true]);
    expect(small[1]?.slice(0, 7)).toEqual([true, false, false, false, false, false, true]);
    expect(qrVersion("https://cv.cm", "L")).toBe(1);
    expect(qrVersion("x".repeat(80), "L")).toBeGreaterThan(1);
    expect(() => encodeQr("x".repeat(4000), "H")).toThrow();
  });
});

describe("password", () => {
  it("stays inside the requested charset and length", () => {
    const opts = {
      length: 24,
      lower: true,
      upper: true,
      digits: true,
      symbols: false,
      excludeSimilar: true,
    };
    const set = charsetFor(opts);
    expect(set).not.toMatch(/[0OIl1]/);
    const pwd = generatePassword(opts);
    expect(pwd).toHaveLength(24);
    expect([...pwd].every((ch) => set.includes(ch))).toBe(true);
    expect(entropyBits(16, 26)).toBeCloseTo(16 * Math.log2(26), 5);
  });
});

describe("word count", () => {
  it("counts latin words and CJK characters", () => {
    expect(countText("hello world").words).toBe(2);
    expect(countText("你好世界").words).toBe(4);
    expect(countText("  ").words).toBe(0);
    expect(countText("one.\n\ntwo!").paragraphs).toBe(2);
    expect(countText("abc").chars).toBe(3);
  });
});

describe("names", () => {
  it("makes person names and usernames", () => {
    expect(generateName("person")).toMatch(/^[A-Z][a-z]+ [A-Z][A-Za-z]+$/);
    expect(generateName("username")).toMatch(/^[a-z]+[a-z]+\d*$/);
    expect(generateNames("username", 8)).toHaveLength(8);
  });
});

describe("timezone", () => {
  it("converts New York wall time to UTC across DST", () => {
    const winter = convertWallTime(2026, 1, 15, 12, 0, 0, "America/New_York", "UTC");
    expect(winter.formatted).toBe("2026-01-15 17:00:00");
    expect(winter.offset).toBe("UTC+00:00");
    expect(winter.iso).toBe("2026-01-15T17:00:00.000Z");

    const summer = convertWallTime(2026, 7, 15, 12, 0, 0, "America/New_York", "UTC");
    expect(summer.formatted).toBe("2026-07-15 16:00:00");
    expect(summer.iso).toBe("2026-07-15T16:00:00.000Z");

    const tokyo = convertWallTime(2026, 7, 15, 12, 0, 0, "Asia/Tokyo", "America/New_York");
    expect(tokyo.formatted).toBe("2026-07-14 23:00:00");

    const shanghai = convertWallTime(2026, 3, 1, 12, 0, 0, "Asia/Shanghai", "UTC");
    expect(shanghai.formatted).toBe("2026-03-01 04:00:00");
  });
});

describe("lorem", () => {
  it("opens with the classic sentence and stays deterministic", () => {
    expect(loremWords(5)).toBe("lorem ipsum dolor sit amet");
    const para = generateLorem("paragraphs", 1);
    expect(para.startsWith("Lorem ipsum dolor sit amet, consectetur adipiscing elit.")).toBe(true);
    expect(para).not.toMatch(/Lorem ipsum dolor sit amet, consectetur adipiscing elit\. Lorem ipsum/);
    expect(generateLorem("sentences", 2).split(". ")).toHaveLength(2);
    expect(generateLorem("words", 50).split(" ")).toHaveLength(50);
  });
});

describe("barcode", () => {
  it("encodes Code 128, Code 39, and EAN-13", () => {
    const c128 = encodeBarcode("code128", "ABC");
    expect(c128.text).toBe("ABC");
    expect(c128.modules.filter(Boolean).length).toBeGreaterThan(20);

    const digits = encodeBarcode("code128", "123456");
    expect(digits.modules.length).toBeGreaterThan(40);

    const c39 = encodeBarcode("code39", "CVCM");
    expect(c39.text).toBe("CVCM");
    expect(() => encodeBarcode("code39", "ab!")).toThrow();

    expect(ean13Checksum("590123412345")).toBe(7);
    const ean = encodeBarcode("ean13", "590123412345");
    expect(ean.text).toBe("5901234123457");
    const core = ean.modules.slice(11, 11 + 95);
    expect(core).toHaveLength(95);
    expect(core.slice(0, 3)).toEqual([true, false, true]);
    expect(() => encodeBarcode("ean13", "5901234123450")).toThrow();
  });
});

describe("meme", () => {
  it("uppercases captions and wraps by measured width", () => {
    expect(normalizeMemeText("  one does   not  ", true)).toBe("ONE DOES NOT");
    expect(normalizeMemeText("Keep Case", false)).toBe("Keep Case");
    expect(wrapByWidth("ONE DOES NOT SIMPLY", 8, (s) => s.length)).toEqual([
      "ONE DOES",
      "NOT",
      "SIMPLY",
    ]);
    expect(memeFontSize(1000, 1000, 1)).toBe(85);
  });
});

describe("tts", () => {
  it("splits sentences and picks a matching voice", () => {
    expect(splitUtterances("Hello. How are you?")).toEqual(["Hello.", "How are you?"]);
    expect(splitUtterances("  ")).toEqual([]);
    const long = "a".repeat(200);
    expect(splitUtterances(long).every((part) => part.length <= 160)).toBe(true);
    const voices = [
      { name: "Samantha", lang: "en-US" },
      { name: "Tingting", lang: "zh-CN" },
    ];
    expect(pickVoice(voices, "zh-CN")?.name).toBe("Tingting");
    expect(pickVoice(voices, "en", "Samantha")?.name).toBe("Samantha");
  });
});

describe("invoice", () => {
  it("totals line items and tax", () => {
    expect(lineAmount({ description: "A", qty: 2, price: 10 })).toBe(20);
    expect(invoiceTotals([{ description: "A", qty: 2, price: 10 }, { description: "B", qty: 1, price: 5 }], 10)).toEqual({
      subtotal: 25,
      tax: 2.5,
      total: 27.5,
    });
    expect(wrapInvoiceText("hello world", 5, (s) => s.length)).toEqual(["hello", "world"]);
  });
});

describe("signature", () => {
  it("crops ink bounds with padding", () => {
    expect(hasInk([])).toBe(false);
    const bounds = strokeBounds([[{ x: 10, y: 20 }, { x: 30, y: 40 }]], 5);
    expect(bounds).toEqual({ x: 5, y: 15, w: 30, h: 30 });
    expect(clampBounds({ x: -4, y: 2, w: 50, h: 10 }, 40, 20)).toEqual({ x: 0, y: 2, w: 40, h: 10 });
  });
});

describe("diff", () => {
  it("marks added and removed lines", () => {
    const lines = diffLines("a\nb\nc", "a\nx\nc");
    expect(lines).toEqual([
      { kind: "eq", text: "a" },
      { kind: "del", text: "b" },
      { kind: "add", text: "x" },
      { kind: "eq", text: "c" },
    ]);
    expect(diffCounts(lines)).toEqual({ added: 1, removed: 1, same: 2 });
    expect(unifiedDiff(lines)).toBe("  a\n- b\n+ x\n  c");
    expect(diffLines("a  b", "a b", true)).toEqual([{ kind: "eq", text: "a b" }]);
  });
});

describe("uuid", () => {
  it("makes RFC 4122 version 4 ids", () => {
    const id = uuidV4();
    expect(isUuidV4(id)).toBe(true);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const batch = generateUuids(8, false, true);
    expect(batch).toHaveLength(8);
    expect(new Set(batch).size).toBe(8);
    expect(batch[0]).toMatch(/^[0-9A-F]{32}$/);
    expect(generateUuids(0, true, false)).toHaveLength(1);
    expect(generateUuids(99, true, false)).toHaveLength(50);
    expect(generateUuids(1, true, false)[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(isUuidV4("not-a-uuid")).toBe(false);
  });
});

describe("regex", () => {
  it("finds matches, groups, flags, and replace", () => {
    const found = runRegex("\\d+", "g", "a12b3");
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.matches.map((m) => m.text)).toEqual(["12", "3"]);
    expect(found.matches[0]?.index).toBe(1);
    const grouped = runRegex("(\\w+)@(\\w+)", "", "hi a@b now");
    expect(grouped.ok).toBe(true);
    if (!grouped.ok) return;
    expect(grouped.matches).toHaveLength(1);
    expect(grouped.matches[0]?.groups).toEqual(["a", "b"]);
    const folded = runRegex("A", "i", "ba");
    expect(folded.ok && folded.matches[0]?.text).toBe("a");
    const swapped = runRegex("a", "g", "aa", "b");
    expect(swapped.ok && swapped.replaced).toBe("bb");
    expect(runRegex("(", "g", "x")).toMatchObject({ ok: false });
    expect(runRegex("", "g", "x")).toEqual({ ok: false, error: "empty-pattern" });
    expect(normalizeFlags("giuugx")).toBe("giu");
    const many = runRegex("a", "g", "a".repeat(300));
    expect(many.ok && many.matches).toHaveLength(MAX_MATCHES);
  });
});

describe("favicon", () => {
  it("packs ICO headers and square-fits cover vs contain", () => {
    const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4]);
    const ico = packIco([
      { width: 16, height: 16, png },
      { width: 32, height: 32, png },
    ]);
    expect(ico[2]).toBe(1);
    expect(ico[4]).toBe(2);
    expect(ico[6]).toBe(16);
    const view = new DataView(ico.buffer);
    expect(view.getUint32(14, true)).toBe(png.length);
    expect(view.getUint32(18, true)).toBe(6 + 16 * 2);
    expect(squareSource(100, 40, "cover")).toEqual({ sx: 30, sy: 0, sw: 40, sh: 40 });
    expect(squareSource(50, 50, "contain")).toEqual({ sx: 0, sy: 0, sw: 50, sh: 50 });
    const dest = squareDest(100, 50, 32, "contain");
    expect(dest.dw).toBeCloseTo(32);
    expect(dest.dh).toBeCloseTo(16);
    expect(dest.dy).toBeCloseTo(8);
  });
});

describe("audio cutter", () => {
  it("clamps range, slices samples, and formats clocks", () => {
    expect(clampRange(5, 1, 10)).toEqual({ start: 1, end: 5 });
    expect(clampRange(-2, 99, 10)).toEqual({ start: 0, end: 10 });
    expect(formatClock(0)).toBe("0:00.00");
    expect(formatClock(0.5)).toBe("0:00.50");
    expect(formatClock(65.2)).toBe("1:05.20");
    expect(formatClock(59.996)).toBe("1:00.00");
    const ch = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) ch[i] = i;
    const cut = sliceChannels([ch], 100, 1, 2);
    expect(cut[0]?.length).toBe(100);
    expect(cut[0]?.[0]).toBe(100);
    expect(cut[0]?.[99]).toBe(199);
    const peaks = waveformPeaks(new Float32Array([0, 0.2, -0.9, 0.1]), 2);
    expect(peaks[0]).toBeCloseTo(0.2);
    expect(peaks[1]).toBeCloseTo(0.9);
  });
});

describe("units", () => {
  it("converts length, mass, temperature, and speed", () => {
    expect(convertAmount("length", 1, "in", "cm")).toBeCloseTo(2.54, 10);
    expect(convertAmount("length", 1, "mi", "km")).toBeCloseTo(1.609344, 10);
    expect(convertAmount("mass", 1, "kg", "lb")).toBeCloseTo(2.2046226218, 6);
    expect(convertAmount("temperature", 100, "C", "F")).toBeCloseTo(212, 10);
    expect(convertAmount("temperature", 0, "K", "C")).toBeCloseTo(-273.15, 10);
    expect(convertAmount("speed", 1, "mph", "kph")).toBeCloseTo(1.609344, 6);
    expect(convertAmount("volume", 1, "gal", "l")).toBeCloseTo(3.785411784, 8);
    expect(convertUnits("length", 1, "in", "cm").formatted).toBe("2.54");
  });
});

describe("new routes", () => {
  it("parses qr, password, and word-count paths", () => {
    expect(parseAppPath("/en/qr/")).toEqual({ kind: "app", locale: "en", tool: "qr" });
    expect(parseAppPath("/zh-CN/password/")).toEqual({ kind: "app", locale: "zh-CN", tool: "password" });
    expect(parseAppPath("/es/word-count/")).toEqual({ kind: "app", locale: "es", tool: "word-count" });
    expect(parseAppPath("/en/timezone/")).toEqual({ kind: "app", locale: "en", tool: "timezone" });
    expect(parseAppPath("/zh-CN/lorem/")).toEqual({ kind: "app", locale: "zh-CN", tool: "lorem" });
    expect(parseAppPath("/en/units/")).toEqual({ kind: "app", locale: "en", tool: "units" });
    expect(parseAppPath("/en/barcode/")).toEqual({ kind: "app", locale: "en", tool: "barcode" });
    expect(parseAppPath("/en/meme/")).toEqual({ kind: "app", locale: "en", tool: "meme" });
    expect(parseAppPath("/en/text-to-speech/")).toEqual({ kind: "app", locale: "en", tool: "text-to-speech" });
    expect(parseAppPath("/en/invoice/")).toEqual({ kind: "app", locale: "en", tool: "invoice" });
    expect(parseAppPath("/en/signature/")).toEqual({ kind: "app", locale: "en", tool: "signature" });
    expect(parseAppPath("/en/diff/")).toEqual({ kind: "app", locale: "en", tool: "diff" });
    expect(parseAppPath("/en/uuid/")).toEqual({ kind: "app", locale: "en", tool: "uuid" });
    expect(parseAppPath("/en/regex/")).toEqual({ kind: "app", locale: "en", tool: "regex" });
    expect(parseAppPath("/en/favicon/")).toEqual({ kind: "app", locale: "en", tool: "favicon" });
    expect(parseAppPath("/en/audio-cutter/")).toEqual({ kind: "app", locale: "en", tool: "audio-cutter" });
    expect(appHref("ja", "qr")).toBe("/ja/qr/");
    expect(appHref("zh-CN", "uuid")).toBe("/zh-cn/uuid/");
    expect(appHref("zh-CN", "regex")).toBe("/zh-cn/regex/");
    expect(appHref("zh-CN", "favicon")).toBe("/zh-cn/favicon/");
    expect(appHref("zh-CN", "audio-cutter")).toBe("/zh-cn/audio-cutter/");
    expect(appHref("zh-CN", "diff")).toBe("/zh-cn/diff/");
    expect(appHref("zh-CN", "signature")).toBe("/zh-cn/signature/");
    expect(appHref("zh-CN", "invoice")).toBe("/zh-cn/invoice/");
    expect(appHref("zh-CN", "text-to-speech")).toBe("/zh-cn/text-to-speech/");
    expect(appHref("zh-CN", "meme")).toBe("/zh-cn/meme/");
    expect(appHref("en", "barcode")).toBe("/en/barcode/");
    expect(appHref("en", "timezone")).toBe("/en/timezone/");
    expect(appHref("zh-CN", "units")).toBe("/zh-cn/units/");
  });
});
