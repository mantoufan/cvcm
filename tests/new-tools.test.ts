import { describe, expect, it } from "vitest";
import { charsetFor, entropyBits, generatePassword } from "../src/shared/password";
import { encodeQr, qrSize, qrVersion } from "../src/shared/qr";
import { countText } from "../src/shared/word-count";
import { generateName, generateNames } from "../src/shared/names";
import { generateLorem, loremWords } from "../src/shared/lorem";
import { convertWallTime } from "../src/shared/timezone";
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

describe("new routes", () => {
  it("parses qr, password, and word-count paths", () => {
    expect(parseAppPath("/en/qr/")).toEqual({ kind: "app", locale: "en", tool: "qr" });
    expect(parseAppPath("/zh-CN/password/")).toEqual({ kind: "app", locale: "zh-CN", tool: "password" });
    expect(parseAppPath("/es/word-count/")).toEqual({ kind: "app", locale: "es", tool: "word-count" });
    expect(parseAppPath("/en/timezone/")).toEqual({ kind: "app", locale: "en", tool: "timezone" });
    expect(parseAppPath("/zh-CN/lorem/")).toEqual({ kind: "app", locale: "zh-CN", tool: "lorem" });
    expect(appHref("ja", "qr")).toBe("/ja/qr/");
    expect(appHref("en", "timezone")).toBe("/en/timezone/");
  });
});
