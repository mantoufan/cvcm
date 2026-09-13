import { describe, expect, it } from "vitest";
import { LOCALES } from "../src/shared/locale";
import { TOOLS, appHref } from "../src/shared/path";
import { buildSitemapXml, HREFLANG, pageUrl, sitemapPages } from "../src/shared/sitemap";

describe("sitemap", () => {
  it("lists every locale home and tool with reciprocal hreflang", () => {
    const xml = buildSitemapXml("2026-09-13");
    expect(xml.startsWith("<?xml version=\"1.0\" encoding=\"UTF-8\"?>")).toBe(true);
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(sitemapPages().length).toBe(LOCALES.length * (1 + TOOLS.length));
    for (const locale of LOCALES) {
      expect(xml).toContain(`https://cv.cm${appHref(locale, null)}`);
      expect(xml).toContain(`hreflang="${HREFLANG[locale]}"`);
      for (const tool of TOOLS) {
        expect(xml).toContain(pageUrl({ locale, tool }));
      }
    }
    expect(xml).toContain('hreflang="x-default"');
    expect(xml).toContain('href="https://cv.cm/en/"');
    expect(xml).toContain("<lastmod>2026-09-13</lastmod>");
    expect(xml).not.toContain("<changefreq>");
    expect(xml).not.toContain("<priority>");
  });
});
