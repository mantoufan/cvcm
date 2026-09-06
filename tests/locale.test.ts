import { describe, expect, it } from "vitest";
import { negotiateLocale } from "../src/shared/locale";
import { appHref, parseAppPath } from "../src/shared/path";

describe("negotiateLocale", () => {
  it("prefers the locale cookie", () => {
    expect(negotiateLocale("en-US,en;q=0.9", "ja")).toBe("ja");
  });

  it("maps zh-TW and zh-HK to Traditional Chinese", () => {
    expect(negotiateLocale("zh-TW,zh;q=0.8", null)).toBe("zh-TW");
    expect(negotiateLocale("zh-HK", null)).toBe("zh-TW");
    expect(negotiateLocale("zh-Hant-HK", null)).toBe("zh-TW");
  });

  it("maps generic zh to Simplified Chinese", () => {
    expect(negotiateLocale("zh-CN", null)).toBe("zh-CN");
    expect(negotiateLocale("zh", null)).toBe("zh-CN");
  });

  it("respects q-values", () => {
    expect(negotiateLocale("en;q=0.4,ja;q=0.8", null)).toBe("ja");
  });

  it("falls back to English", () => {
    expect(negotiateLocale("fr-FR,de;q=0.8", null)).toBe("en");
  });
});

describe("parseAppPath", () => {
  it("parses locale home and tools", () => {
    expect(parseAppPath("/zh-CN/")).toEqual({ kind: "app", locale: "zh-CN", tool: null });
    expect(parseAppPath("/en/watermark/")).toEqual({
      kind: "app",
      locale: "en",
      tool: "watermark",
    });
  });

  it("treats missing locale as bare", () => {
    expect(parseAppPath("/")).toEqual({ kind: "bare", tool: null });
    expect(parseAppPath("/watermark")).toEqual({ kind: "bare", tool: "watermark" });
  });

  it("keeps static files out of the app router", () => {
    expect(parseAppPath("/favicon.svg")).toEqual({ kind: "static" });
    expect(parseAppPath("/assets/index-abc.js")).toEqual({ kind: "static" });
  });

  it("builds canonical hrefs", () => {
    expect(appHref("ko", null)).toBe("/ko/");
    expect(appHref("ja", "watermark")).toBe("/ja/watermark/");
  });
});
