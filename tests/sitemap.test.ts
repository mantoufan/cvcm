import { describe, expect, it } from "vitest";
import { LOCALES } from "../src/shared/locale";
import { GAME_CONSOLES, GAMES } from "../src/shared/games";
import { MARKET_PAGES } from "../src/shared/markets";
import { CONVERT_JOBS, RESIZE_JOBS, TOOLS, FEATURED_TUTORIALS, appHref, gamesHref, learnHref, marketsHref } from "../src/shared/path";
import { buildSitemapXml, HREFLANG, pageUrl, sitemapPages } from "../src/shared/sitemap";

describe("sitemap", () => {
  it("lists every locale home and tool with reciprocal hreflang", () => {
    const xml = buildSitemapXml("2026-09-13");
    expect(xml.startsWith("<?xml version=\"1.0\" encoding=\"UTF-8\"?>")).toBe(true);
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(sitemapPages().length).toBe(
      LOCALES.length * (1 + TOOLS.length + CONVERT_JOBS.length + RESIZE_JOBS.length + 1 + FEATURED_TUTORIALS.length + 1 + GAME_CONSOLES.length + GAMES.length + 1 + MARKET_PAGES.length),
    );
    for (const locale of LOCALES) {
      expect(xml).toContain(`https://cv.cm${appHref(locale, null)}`);
      expect(xml).toContain(`hreflang="${HREFLANG[locale]}"`);
      expect(xml).toContain(`https://cv.cm${learnHref(locale, null)}`);
      expect(xml).toContain(`https://cv.cm${gamesHref(locale, null)}`);
      expect(xml).toContain(`https://cv.cm${marketsHref(locale, "gold")}`);
      expect(xml).toContain(`https://cv.cm${gamesHref(locale, "fc", "contra")}`);
      for (const tool of TOOLS) {
        expect(xml).toContain(pageUrl({ locale, kind: "tool", tool }));
      }
      for (const tutorial of FEATURED_TUTORIALS) {
        expect(xml).toContain(pageUrl({ locale, kind: "learn", tutorial }));
      }
    }
    expect(xml).toContain('hreflang="x-default"');
    expect(xml).toContain('href="https://cv.cm/en/"');
    expect(xml).toContain("https://cv.cm/zh-cn/");
    expect(xml).toContain("https://cv.cm/zh-tw/");
    expect(xml).not.toContain("https://cv.cm/zh-CN/");
    expect(xml).not.toContain("https://cv.cm/zh-TW/");
    expect(xml).toContain("<lastmod>2026-09-13</lastmod>");
    expect(xml).not.toContain("<changefreq>");
    expect(xml).not.toContain("<priority>");
  });
});
