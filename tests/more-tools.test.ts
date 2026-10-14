import { describe, expect, it } from "vitest";
import { bmrMifflin, feetInchesToCm, lbToKg, tdeeFrom } from "../src/shared/tdee";
import { maskToPrefix, parseCidr, parseIpv4, rangeToCidrs, subnetOf } from "../src/shared/cidr";
import { chmodCommand, parseOctal, parseSymbolic, toOctal, toSymbolic } from "../src/shared/chmod";
import { TYPING_METRIC, addStrokes, markPassage, scoreTyping } from "../src/shared/typing";
import { TYPING_PASSAGES } from "../src/shared/typing-passages";
import { extractPalette, rgbToHex, sampleSize } from "../src/shared/image-colors";
import { LOCALES } from "../src/shared/locale";
import { UNTRACKED_TOOLS, isTrackedPath } from "../src/shared/analytics";
import { appHref, parseAppPath } from "../src/shared/path";
import { faqItems, pageDescription, pageTitle } from "../src/shared/seo";

describe("tdee", () => {
  it("uses Mifflin–St Jeor and activity factors", () => {
    expect(bmrMifflin("male", 70, 175, 30)).toBeCloseTo(1648.75, 6);
    expect(bmrMifflin("female", 60, 165, 30)).toBeCloseTo(1320.25, 6);
    const r = tdeeFrom("male", 70, 175, 30, "moderate")!;
    expect(r.tdee).toBeCloseTo(1648.75 * 1.55, 6);
    expect(r.cut).toBeCloseTo(r.tdee - 500, 6);
    expect(r.bulk).toBeCloseTo(r.tdee + 300, 6);
    expect(tdeeFrom("male", 0, 175, 30, "light")).toBeNull();
    expect(tdeeFrom("male", 70, 175, 12, "light")).toBeNull();
    expect(lbToKg(154)).toBeCloseTo(69.85, 2);
    expect(feetInchesToCm(5, 9)).toBeCloseTo(175.26, 2);
  });
});

describe("cidr", () => {
  it("parses addresses, prefixes and masks", () => {
    expect(parseIpv4("255.255.255.255")).toBe(4294967295);
    expect(parseIpv4("256.0.0.1")).toBeNull();
    expect(parseIpv4("1.2.3")).toBeNull();
    expect(maskToPrefix(parseIpv4("255.255.252.0")!)).toBe(22);
    expect(maskToPrefix(parseIpv4("255.0.255.0")!)).toBeNull();
    expect(parseCidr("10.1.2.3 255.255.252.0")).toEqual({ ip: parseIpv4("10.1.2.3"), prefix: 22 });
    expect(parseCidr("10.0.0.1/33")).toBeNull();
  });

  it("describes a subnet", () => {
    expect(subnetOf("192.168.1.10/24")).toEqual({
      cidr: "192.168.1.0/24",
      prefix: 24,
      network: "192.168.1.0",
      broadcast: "192.168.1.255",
      mask: "255.255.255.0",
      wildcard: "0.0.0.255",
      firstHost: "192.168.1.1",
      lastHost: "192.168.1.254",
      total: 256,
      usable: 254,
    });
    const p31 = subnetOf("10.0.0.1/31")!;
    expect([p31.firstHost, p31.lastHost, p31.usable]).toEqual(["10.0.0.0", "10.0.0.1", 2]);
    const p32 = subnetOf("10.0.0.7")!;
    expect([p32.cidr, p32.usable]).toEqual(["10.0.0.7/32", 1]);
    const all = subnetOf("0.0.0.0/0")!;
    expect([all.mask, all.broadcast, all.total]).toEqual(["0.0.0.0", "255.255.255.255", 2 ** 32]);
  });

  it("splits a range into the fewest CIDR blocks", () => {
    expect(rangeToCidrs("10.0.0.5", "10.0.0.20")).toEqual(["10.0.0.5/32", "10.0.0.6/31", "10.0.0.8/29", "10.0.0.16/30", "10.0.0.20/32"]);
    expect(rangeToCidrs("192.168.0.0", "192.168.255.255")).toEqual(["192.168.0.0/16"]);
    expect(rangeToCidrs("0.0.0.0", "255.255.255.255")).toEqual(["0.0.0.0/0"]);
    expect(rangeToCidrs("10.0.0.9", "10.0.0.1")).toBeNull();
  });
});

describe("chmod", () => {
  it("converts octal, symbolic and command", () => {
    expect(toSymbolic(0o755)).toBe("rwxr-xr-x");
    expect(toSymbolic(0o644)).toBe("rw-r--r--");
    expect(toSymbolic(0o4755)).toBe("rwsr-xr-x");
    expect(toSymbolic(0o4644)).toBe("rwSr--r--");
    expect(toSymbolic(0o1777)).toBe("rwxrwxrwt");
    expect(toSymbolic(0o2750)).toBe("rwxr-s---");
    expect(parseSymbolic("rwxr-xr-x")).toBe(0o755);
    expect(parseSymbolic("-rw-r--r--")).toBe(0o644);
    expect(parseSymbolic("drwxrwxrwt")).toBe(0o1777);
    expect(parseSymbolic("rwSr--r--")).toBe(0o4644);
    expect(parseSymbolic("rwxr-xr-t")).toBe(0o1755);
    expect(parseSymbolic("rwsr-xr-s")).toBeNull();
    expect(parseOctal("755")).toBe(0o755);
    expect(parseOctal("0644")).toBe(0o644);
    expect(parseOctal("788")).toBeNull();
    expect(toOctal(0o755)).toBe("755");
    expect(toOctal(0o4755)).toBe("4755");
    expect(toOctal(0o7)).toBe("007");
    expect(chmodCommand(0o755, "deploy.sh")).toBe("chmod 755 deploy.sh");
    expect(chmodCommand(0o644, "my file.txt", true)).toBe("chmod -R 644 'my file.txt'");
    expect(chmodCommand(0o600, "")).toBe("chmod 600 file");
  });
});

describe("typing", () => {
  it("scores net WPM, CPM and accuracy honestly", () => {
    // 50 correct characters in one minute = 10 WPM.
    const target = "a".repeat(60);
    const s = scoreTyping(target, "a".repeat(50), 60_000, "wpm");
    expect(s.speed).toBeCloseTo(10, 6);
    expect(s.accuracy).toBe(100);
    const wrong = scoreTyping("abcd", "abxd", 30_000, "wpm");
    expect(wrong).toMatchObject({ correct: 3, errors: 1, typed: 4, accuracy: 75 });
    // CJK: correct characters per minute, spaces excluded.
    const cjk = scoreTyping("你好 世界", "你好 世", 30_000, "cpm");
    expect(cjk.speed).toBeCloseTo(6, 6);
    expect(scoreTyping("abc", "", 0, "wpm")).toMatchObject({ speed: 0, accuracy: 100 });
    expect(markPassage("abc", "ax").map((c) => c.state)).toEqual(["ok", "bad", "cur"]);
  });

  it("keeps fixed mistakes in accuracy", () => {
    let k = { typed: 0, wrong: 0 };
    k = addStrokes("abcd", "", "ab", k);
    k = addStrokes("abcd", "ab", "abx", k); // wrong
    k = addStrokes("abcd", "abx", "ab", k); // backspace adds nothing
    k = addStrokes("abcd", "ab", "abcd", k);
    expect(k).toEqual({ typed: 5, wrong: 1 });
    const s = scoreTyping("abcd", "abcd", 60_000, "wpm", k);
    expect(s).toMatchObject({ correct: 4, errors: 1, accuracy: 80 });
    expect(s.speed).toBeCloseTo(0.8, 6);
    // An edit in the middle of the text is not counted as new typing.
    expect(addStrokes("abcd", "abc", "xbc", { typed: 3, wrong: 0 })).toEqual({ typed: 3, wrong: 0 });
  });

  it("has passages and an honest metric for every locale", () => {
    for (const locale of LOCALES) {
      expect(TYPING_PASSAGES[locale].length, locale).toBe(3);
      for (const text of TYPING_PASSAGES[locale]) expect(text.length, locale).toBeGreaterThan(90);
    }
    expect(TYPING_METRIC.en).toBe("wpm");
    expect(TYPING_METRIC["zh-CN"]).toBe("cpm");
    expect(TYPING_METRIC.ja).toBe("cpm");
  });
});

describe("image-colors", () => {
  it("finds the dominant colors in order", () => {
    const px: number[] = [];
    for (let i = 0; i < 70; i++) px.push(255, 0, 0, 255);
    for (let i = 0; i < 30; i++) px.push(0, 0, 255, 255);
    for (let i = 0; i < 50; i++) px.push(0, 255, 0, 0); // transparent: ignored
    const palette = extractPalette(px, 4);
    expect(palette.map((c) => c.hex)).toEqual(["#FF0000", "#0000FF"]);
    expect(palette[0].share).toBeCloseTo(0.7, 6);
    expect(extractPalette([0, 0, 0, 0], 5)).toEqual([]);
    expect(rgbToHex([18, 52, 86])).toBe("#123456");
    expect(sampleSize(4000, 2000)).toEqual({ width: 160, height: 80 });
    expect(sampleSize(10, 10)).toEqual({ width: 10, height: 10 });
  });

  it("is a file tool without analytics", () => {
    expect(UNTRACKED_TOOLS.has("image-colors")).toBe(true);
    expect(isTrackedPath("/en/image-colors/")).toBe(false);
    expect(isTrackedPath("/en/typing/")).toBe(true);
  });
});

describe("routes and SEO", () => {
  it("routes and titles the five tools", () => {
    for (const tool of ["tdee", "cidr", "chmod", "typing", "image-colors"] as const) {
      expect(parseAppPath(`/en/${tool}/`)).toEqual({ kind: "app", locale: "en", tool });
      expect(appHref("zh-CN", tool)).toBe(`/zh-cn/${tool}/`);
      for (const locale of LOCALES) {
        expect(faqItems(locale, tool).length, `${locale} ${tool}`).toBe(5);
        expect(pageDescription(locale, tool).length, `${locale} ${tool}`).toBeGreaterThan(30);
      }
    }
    expect(pageTitle("en", "tdee")).toMatch(/TDEE/);
    expect(pageTitle("en", "cidr")).toMatch(/Subnet/);
    expect(pageTitle("en", "chmod")).toMatch(/Chmod/);
    expect(pageTitle("en", "typing")).toMatch(/Typing speed/);
    expect(pageTitle("en", "image-colors")).toMatch(/palette/i);
    expect(pageTitle("zh-CN", "cidr")).toMatch(/子网/);
    expect(pageTitle("zh-TW", "cidr")).toMatch(/子網路/);
    expect(pageTitle("zh-CN", "typing")).toMatch(/打字/);
  });
});
