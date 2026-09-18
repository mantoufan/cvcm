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
import { parseStamp, unixToMs } from "../src/shared/timestamp";
import { normalizeDegrees, rotatedSize } from "../src/shared/rotate";
import { detectMetadata, hasJpegExif } from "../src/shared/exif";
import { concatClips } from "../src/shared/audio-join";
import { jsonToXml, xmlToJson } from "../src/shared/xml-json";
import { digest, md5, toHex } from "../src/shared/hash";
import { jsonToYaml, yamlToJson } from "../src/shared/yaml-json";
import { convertCase } from "../src/shared/case";
import { decodeJwt } from "../src/shared/jwt";
import { isWhatPercent, percentOf } from "../src/shared/percent";
import { randomInt, randomInts } from "../src/shared/random";
import { decodeHtml, encodeHtml } from "../src/shared/html";
import { describeCron } from "../src/shared/cron";
import { slugify } from "../src/shared/slug";
import { ageOn } from "../src/shared/age";
import { bmiBand, bmiFrom } from "../src/shared/bmi";
import { binaryToText, textToBinary } from "../src/shared/binary";
import { tipSplit } from "../src/shared/tip";
import { morseToText, textToMorse } from "../src/shared/morse";
import { fromRoman, toRoman } from "../src/shared/roman";
import { discountOf } from "../src/shared/discount";
import { fromSeconds, toSeconds } from "../src/shared/countdown";
import { loanPayment } from "../src/shared/loan";
import { formatElapsed } from "../src/shared/stopwatch";
import { compoundGrowth } from "../src/shared/compound";
import { vatOf } from "../src/shared/vat";
import { appHref, parseAppPath, withSearch } from "../src/shared/path";

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

describe("timestamp", () => {
  it("parses unix seconds, milliseconds, ISO, and now", () => {
    const sec = parseStamp("1700000000");
    expect(sec.ok).toBe(true);
    if (!sec.ok) return;
    expect(sec.stamp.iso).toBe("2023-11-14T22:13:20.000Z");
    expect(sec.stamp.seconds).toBe("1700000000");
    const ms = parseStamp("1700000000000");
    expect(ms.ok && ms.stamp.iso).toBe("2023-11-14T22:13:20.000Z");
    const iso = parseStamp("2023-11-14T22:13:20.000Z");
    expect(iso.ok && iso.stamp.milliseconds).toBe("1700000000000");
    const now = parseStamp("now", 1700000000000);
    expect(now.ok && now.stamp.seconds).toBe("1700000000");
    expect(parseStamp("")).toEqual({ ok: false, error: "empty" });
    expect(parseStamp("not-a-date")).toEqual({ ok: false, error: "invalid" });
    expect(unixToMs(1700000000)).toBe(1700000000000);
    expect(unixToMs(1700000000000)).toBe(1700000000000);
    expect(unixToMs(1700000000000000)).toBe(1700000000000);
  });
});

describe("rotate", () => {
  it("normalizes degrees and swaps size at 90", () => {
    expect(normalizeDegrees(-90)).toBe(270);
    expect(normalizeDegrees(450)).toBe(90);
    expect(rotatedSize(100, 50, 0)).toEqual({ width: 100, height: 50 });
    expect(rotatedSize(100, 50, 90)).toEqual({ width: 50, height: 100 });
    expect(rotatedSize(100, 50, 180)).toEqual({ width: 100, height: 50 });
  });
});

describe("exif", () => {
  it("detects JPEG APP1 Exif and ignores a bare JPEG", () => {
    const tagged = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x06, 0x45, 0x78, 0x69, 0x66, 0xff, 0xd9]);
    expect(hasJpegExif(tagged)).toBe(true);
    expect(detectMetadata(tagged)).toBe(true);
    expect(hasJpegExif(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBe(false);
  });
});

describe("audio joiner", () => {
  it("concatenates clips in order", () => {
    const joined = concatClips([
      { channels: [new Float32Array([1, 2, 3])], sampleRate: 100 },
      { channels: [new Float32Array([4, 5])], sampleRate: 100 },
    ]);
    expect(joined.sampleRate).toBe(100);
    expect(Array.from(joined.channels[0] || [])).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("xml-json", () => {
  it("converts attributes, children, and numbers", () => {
    const json = xmlToJson('<note id="1"><to>cv.cm</to><n>2</n></note>');
    expect(json).toEqual({ "@id": "1", to: "cv.cm", n: 2 });
    expect(jsonToXml({ item: "x" }, "root")).toContain("<item>x</item>");
  });
});

describe("hash", () => {
  it("hashes MD5 and SHA-256", async () => {
    expect(toHex(md5(new TextEncoder().encode("")))).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(toHex(md5(new TextEncoder().encode("abc")))).toBe("900150983cd24fb0d6963f7d28e17f72");
    const sha = await digest("SHA-256", new TextEncoder().encode(""));
    expect(toHex(sha)).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});

describe("yaml-json", () => {
  it("parses maps, lists, and scalars", () => {
    expect(yamlToJson("a: 1\nb: two")).toEqual({ a: 1, b: "two" });
    expect(yamlToJson("list:\n  - a\n  - 2")).toEqual({ list: ["a", 2] });
    expect(jsonToYaml({ a: 1 })).toContain("a: 1");
  });
});

describe("case", () => {
  it("converts title, snake, and camel", () => {
    expect(convertCase("hello cv.cm", "title")).toBe("Hello Cv Cm");
    expect(convertCase("HelloWorld", "snake")).toBe("hello_world");
    expect(convertCase("hello-world", "camel")).toBe("helloWorld");
  });
});

describe("jwt", () => {
  it("decodes header and payload without verifying", () => {
    const b64url = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    const token = `${b64url('{"alg":"none"}')}.${b64url('{"sub":"1","exp":2000000000}')}.x`;
    const out = decodeJwt(token, 1_700_000_000_000);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.alg).toBe("none");
    expect(out.payload).toEqual({ sub: "1", exp: 2000000000 });
    expect(out.expired).toBe(false);
    expect(decodeJwt("not-a-jwt")).toEqual({ ok: false, error: "format" });
  });
});

describe("percent", () => {
  it("computes percent-of and what-percent", () => {
    expect(percentOf(200, 25)).toBe(50);
    expect(isWhatPercent(50, 200)).toBe(25);
    expect(isWhatPercent(1, 0)).toBeNull();
  });
});

describe("random", () => {
  it("stays inside the inclusive range", () => {
    for (let i = 0; i < 40; i++) {
      const n = randomInt(3, 5);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(5);
    }
    expect(randomInts(1, 1, 4)).toEqual([1, 1, 1, 1]);
  });
});

describe("html", () => {
  it("encodes and decodes entities", () => {
    expect(encodeHtml(`<a href="x">`)).toBe("&lt;a href=&quot;x&quot;&gt;");
    expect(decodeHtml("&lt;a href=&quot;x&quot;&gt;")).toBe(`<a href="x">`);
    expect(decodeHtml("&#39;&#x41;")).toBe("'A");
  });
});

describe("cron", () => {
  it("explains a weekday range", () => {
    const out = describeCron("*/15 9-17 * * 1-5");
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.summary).toMatch(/every 15 minutes/);
    expect(out.summary).toMatch(/monday/);
    expect(describeCron("bad")).toEqual({ ok: false, error: "fields" });
  });
});

describe("slug", () => {
  it("folds punctuation and case", () => {
    expect(slugify("Hello, cv.cm — YAML")).toBe("hello-cv-cm-yaml");
    expect(slugify("")).toBe("");
  });
});

describe("age", () => {
  it("counts civil years months and days", () => {
    expect(ageOn("2000-01-01", "2001-01-01")).toEqual({ years: 1, months: 0, days: 0, totalDays: 366 });
    expect(ageOn("2020-06-01", "2019-01-01")).toBeNull();
  });
});

describe("bmi", () => {
  it("uses WHO bands", () => {
    const v = bmiFrom(70, 170);
    expect(v).toBeCloseTo(24.221, 3);
    expect(bmiBand(v!)).toBe("normal");
    expect(bmiFrom(0, 170)).toBeNull();
  });
});

describe("binary", () => {
  it("round-trips UTF-8 text", () => {
    expect(textToBinary("A")).toBe("01000001");
    expect(binaryToText("01000001")).toBe("A");
    expect(binaryToText("01")).toBeNull();
  });
});

describe("tip", () => {
  it("splits a bill", () => {
    const out = tipSplit(100, 15, 2);
    expect(out).toEqual({ tip: 15, total: 115, perPerson: 57.5 });
    expect(tipSplit(-1, 10, 1)).toBeNull();
  });
});

describe("morse", () => {
  it("round-trips a short phrase", () => {
    expect(textToMorse("sos")).toBe("... --- ...");
    expect(morseToText("... --- ...")).toBe("sos");
    expect(morseToText("not-morse")).toBeNull();
  });
});

describe("roman", () => {
  it("converts 1–3999 and rejects additive IIII", () => {
    expect(toRoman(2026)).toBe("MMXXVI");
    expect(fromRoman("iv")).toBe(4);
    expect(fromRoman("IIII")).toBeNull();
    expect(toRoman(0)).toBeNull();
  });
});

describe("discount", () => {
  it("applies a percent off", () => {
    expect(discountOf(80, 25)).toEqual({ sale: 60, saved: 20 });
    expect(discountOf(-1, 10)).toBeNull();
  });
});

describe("countdown", () => {
  it("packs and unpacks h:m:s", () => {
    expect(toSeconds(0, 5, 0)).toBe(300);
    expect(fromSeconds(300).label).toBe("00:05:00");
  });
});

describe("loan", () => {
  it("computes a 30-year payment", () => {
    const out = loanPayment(200000, 5, 30);
    expect(out).not.toBeNull();
    expect(out!.payment).toBeCloseTo(1073.64, 2);
    expect(loanPayment(0, 5, 30)).toBeNull();
  });
});

describe("stopwatch", () => {
  it("formats elapsed time to hundredths", () => {
    expect(formatElapsed(0)).toBe("00:00:00.00");
    expect(formatElapsed(1234)).toBe("00:00:01.23");
    expect(formatElapsed(3723120)).toBe("01:02:03.12");
  });
});

describe("compound", () => {
  it("grows a principal yearly", () => {
    const out = compoundGrowth(1000, 5, 10, 1);
    expect(out).not.toBeNull();
    expect(out!.future).toBeCloseTo(1628.89, 2);
    expect(compoundGrowth(1000, 0, 10, 12)).toEqual({ future: 1000, interest: 0 });
    expect(compoundGrowth(-1, 5, 10, 12)).toBeNull();
  });
});

describe("vat", () => {
  it("adds and extracts tax", () => {
    expect(vatOf(100, 20, false)).toEqual({ net: 100, tax: 20, gross: 120 });
    const inc = vatOf(120, 20, true);
    expect(inc).not.toBeNull();
    expect(inc!.net).toBeCloseTo(100, 8);
    expect(inc!.tax).toBeCloseTo(20, 8);
    expect(inc!.gross).toBe(120);
    expect(vatOf(-1, 10, false)).toBeNull();
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
    expect(parseAppPath("/en/timestamp/")).toEqual({ kind: "app", locale: "en", tool: "timestamp" });
    expect(parseAppPath("/en/rotate/")).toEqual({ kind: "app", locale: "en", tool: "rotate" });
    expect(parseAppPath("/en/exif/")).toEqual({ kind: "app", locale: "en", tool: "exif" });
    expect(parseAppPath("/en/audio-joiner/")).toEqual({ kind: "app", locale: "en", tool: "audio-joiner" });
    expect(parseAppPath("/en/hex-rgb/")).toEqual({ kind: "app", locale: "en", tool: "hex-rgb" });
    expect(parseAppPath("/en/xml-json/")).toEqual({ kind: "app", locale: "en", tool: "xml-json" });
    expect(parseAppPath("/en/hash/")).toEqual({ kind: "app", locale: "en", tool: "hash" });
    expect(parseAppPath("/en/yaml-json/")).toEqual({ kind: "app", locale: "en", tool: "yaml-json" });
    expect(parseAppPath("/en/case/")).toEqual({ kind: "app", locale: "en", tool: "case" });
    expect(parseAppPath("/en/jwt/")).toEqual({ kind: "app", locale: "en", tool: "jwt" });
    expect(parseAppPath("/en/screenshot/")).toEqual({ kind: "app", locale: "en", tool: "screenshot" });
    expect(parseAppPath("/en/percent/")).toEqual({ kind: "app", locale: "en", tool: "percent" });
    expect(parseAppPath("/en/random/")).toEqual({ kind: "app", locale: "en", tool: "random" });
    expect(parseAppPath("/en/html/")).toEqual({ kind: "app", locale: "en", tool: "html" });
    expect(parseAppPath("/en/cron/")).toEqual({ kind: "app", locale: "en", tool: "cron" });
    expect(parseAppPath("/en/slug/")).toEqual({ kind: "app", locale: "en", tool: "slug" });
    expect(parseAppPath("/en/age/")).toEqual({ kind: "app", locale: "en", tool: "age" });
    expect(parseAppPath("/en/bmi/")).toEqual({ kind: "app", locale: "en", tool: "bmi" });
    expect(parseAppPath("/en/binary/")).toEqual({ kind: "app", locale: "en", tool: "binary" });
    expect(parseAppPath("/en/tip/")).toEqual({ kind: "app", locale: "en", tool: "tip" });
    expect(parseAppPath("/en/morse/")).toEqual({ kind: "app", locale: "en", tool: "morse" });
    expect(parseAppPath("/en/roman/")).toEqual({ kind: "app", locale: "en", tool: "roman" });
    expect(parseAppPath("/en/discount/")).toEqual({ kind: "app", locale: "en", tool: "discount" });
    expect(parseAppPath("/en/countdown/")).toEqual({ kind: "app", locale: "en", tool: "countdown" });
    expect(parseAppPath("/en/loan/")).toEqual({ kind: "app", locale: "en", tool: "loan" });
    expect(parseAppPath("/en/stopwatch/")).toEqual({ kind: "app", locale: "en", tool: "stopwatch" });
    expect(parseAppPath("/en/compound/")).toEqual({ kind: "app", locale: "en", tool: "compound" });
    expect(parseAppPath("/en/vat/")).toEqual({ kind: "app", locale: "en", tool: "vat" });
    expect(parseAppPath("/en/portrait-sim/")).toEqual({ kind: "app", locale: "en", tool: "portrait-sim" });
    expect(appHref("ja", "qr")).toBe("/ja/qr/");
    expect(appHref("zh-CN", "uuid")).toBe("/zh-cn/uuid/");
    expect(appHref("zh-CN", "regex")).toBe("/zh-cn/regex/");
    expect(appHref("zh-CN", "favicon")).toBe("/zh-cn/favicon/");
    expect(appHref("zh-CN", "audio-cutter")).toBe("/zh-cn/audio-cutter/");
    expect(appHref("zh-CN", "timestamp")).toBe("/zh-cn/timestamp/");
    expect(appHref("zh-CN", "rotate")).toBe("/zh-cn/rotate/");
    expect(appHref("zh-CN", "exif")).toBe("/zh-cn/exif/");
    expect(appHref("zh-CN", "audio-joiner")).toBe("/zh-cn/audio-joiner/");
    expect(appHref("zh-CN", "hex-rgb")).toBe("/zh-cn/hex-rgb/");
    expect(appHref("zh-CN", "xml-json")).toBe("/zh-cn/xml-json/");
    expect(appHref("zh-CN", "hash")).toBe("/zh-cn/hash/");
    expect(appHref("zh-CN", "yaml-json")).toBe("/zh-cn/yaml-json/");
    expect(appHref("zh-CN", "case")).toBe("/zh-cn/case/");
    expect(appHref("zh-CN", "jwt")).toBe("/zh-cn/jwt/");
    expect(appHref("zh-CN", "screenshot")).toBe("/zh-cn/screenshot/");
    expect(appHref("zh-CN", "percent")).toBe("/zh-cn/percent/");
    expect(appHref("zh-CN", "random")).toBe("/zh-cn/random/");
    expect(appHref("zh-CN", "html")).toBe("/zh-cn/html/");
    expect(appHref("zh-CN", "cron")).toBe("/zh-cn/cron/");
    expect(appHref("zh-CN", "slug")).toBe("/zh-cn/slug/");
    expect(appHref("zh-CN", "age")).toBe("/zh-cn/age/");
    expect(appHref("zh-CN", "bmi")).toBe("/zh-cn/bmi/");
    expect(appHref("zh-CN", "binary")).toBe("/zh-cn/binary/");
    expect(appHref("zh-CN", "tip")).toBe("/zh-cn/tip/");
    expect(appHref("zh-CN", "morse")).toBe("/zh-cn/morse/");
    expect(appHref("zh-CN", "roman")).toBe("/zh-cn/roman/");
    expect(appHref("zh-CN", "discount")).toBe("/zh-cn/discount/");
    expect(appHref("zh-CN", "countdown")).toBe("/zh-cn/countdown/");
    expect(appHref("zh-CN", "loan")).toBe("/zh-cn/loan/");
    expect(appHref("zh-CN", "stopwatch")).toBe("/zh-cn/stopwatch/");
    expect(appHref("zh-CN", "compound")).toBe("/zh-cn/compound/");
    expect(appHref("zh-CN", "vat")).toBe("/zh-cn/vat/");
    expect(appHref("zh-CN", "portrait-sim")).toBe("/zh-cn/portrait-sim/");
    expect(appHref("zh-CN", "diff")).toBe("/zh-cn/diff/");
    expect(appHref("zh-CN", "signature")).toBe("/zh-cn/signature/");
    expect(appHref("zh-CN", "invoice")).toBe("/zh-cn/invoice/");
    expect(appHref("zh-CN", "text-to-speech")).toBe("/zh-cn/text-to-speech/");
    expect(appHref("zh-CN", "meme")).toBe("/zh-cn/meme/");
    expect(appHref("en", "barcode")).toBe("/en/barcode/");
    expect(appHref("en", "timezone")).toBe("/en/timezone/");
    expect(appHref("zh-CN", "units")).toBe("/zh-cn/units/");
  });

  it("keeps a query string on canonical paths", () => {
    expect(withSearch("/en/crop/", "?lens=85")).toBe("/en/crop/?lens=85");
    expect(withSearch("/en/crop/", "")).toBe("/en/crop/");
    expect(withSearch("/en/crop/", "?")).toBe("/en/crop/");
  });
});
