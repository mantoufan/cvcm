import { describe, expect, it } from "vitest";
import en from "../src/locales/legal/en.json";
import { LOCALES } from "../src/shared/locale";
import { legalMessages } from "../src/shared/messages";
import { LEGAL_UPDATED, legalStaticHtml } from "../src/shared/legal";
import { LEGAL_PAGES, legalHref, parseAppPath } from "../src/shared/path";
import { applyHtmlSeo, pageCanonical, pageTitle } from "../src/shared/seo";
import { buildSitemapXml } from "../src/shared/sitemap";

const SHELL = `<!doctype html><html lang="en"><head><title>cv.cm</title><meta name="description" content="x" /><link rel="canonical" href="https://cv.cm/" /></head><body><div id="app"></div></body></html>`;

function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]));
  }
  return typeof value;
}

describe("legal pages", () => {
  it("parses locale and bare paths", () => {
    expect(parseAppPath("/en/privacy/")).toEqual({ kind: "legal", locale: "en", page: "privacy" });
    expect(parseAppPath("/zh/terms")).toEqual({ kind: "legal", locale: "zh-CN", page: "terms" });
    expect(parseAppPath("/privacy/")).toEqual({ kind: "bare-legal", page: "privacy" });
    expect(parseAppPath("/terms")).toEqual({ kind: "bare-legal", page: "terms" });
    expect(parseAppPath("/en/privacy/x/")).toEqual({ kind: "unknown" });
    expect(parseAppPath("/privacy/x/")).toEqual({ kind: "unknown" });
    expect(legalHref("zh-TW", "terms")).toBe("/zh-tw/terms/");
  });

  it("has the same copy structure in every locale", () => {
    for (const locale of LOCALES) {
      expect(shape(legalMessages(locale)), locale).toEqual(shape(en));
    }
  });

  it("keeps the contact email and links it", () => {
    for (const locale of LOCALES) {
      for (const page of LEGAL_PAGES) {
        const html = legalStaticHtml(locale, page);
        expect(html, `${locale} ${page}`).toContain('href="mailto:m@cv.cm"');
        expect(html).toContain(`datetime="${LEGAL_UPDATED}"`);
        expect(html).toContain(legalHref(locale, page === "privacy" ? "terms" : "privacy"));
        expect(html).not.toContain("<script");
      }
    }
  });

  it("serves crawlable HTML with title, canonical and hreflang", () => {
    const html = applyHtmlSeo(SHELL, "ja", { legalPage: "privacy" });
    expect(html).toContain(`<title>${pageTitle("ja", { legalPage: "privacy" })}</title>`);
    expect(html).toContain('<link rel="canonical" href="https://cv.cm/ja/privacy/"');
    expect(html).toContain('hreflang="zh" href="https://cv.cm/zh/privacy/"');
    expect(html).toContain('id="breadcrumb-jsonld"');
    expect(html).not.toContain('id="faq-jsonld"');
    expect(html).not.toContain('id="howto-jsonld"');
    expect(html).toContain('<article class="legal">');
    expect(pageCanonical("en", { legalPage: "terms" })).toBe("https://cv.cm/en/terms/");
  });

  it("links both pages from the home HTML and lists them in the sitemap", () => {
    const home = applyHtmlSeo(SHELL, "en", { tool: null });
    expect(home).toContain('href="/en/privacy/"');
    expect(home).toContain('href="/en/terms/"');
    const xml = buildSitemapXml("2026-10-09");
    for (const locale of LOCALES) {
      for (const page of LEGAL_PAGES) expect(xml).toContain(`https://cv.cm${legalHref(locale, page)}`);
    }
  });
});
