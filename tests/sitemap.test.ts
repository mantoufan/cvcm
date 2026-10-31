import { describe, expect, it } from "vitest";
import { LOCALES } from "../src/shared/locale";
import { GAME_CONSOLES, GAMES } from "../src/shared/games";
import { DEVICE_PAGES } from "../src/shared/device";
import { CONVERT_JOBS, LEGAL_PAGES, RESIZE_JOBS, TOOLS, FEATURED_TUTORIALS, appHref, gamesHref, kbHref, learnHref, parseAppPath } from "../src/shared/path";
import { buildSectionSitemaps, buildSitemapIndexXml, buildSitemapXml, HREFLANG, pageUrl, SITEMAP_SECTIONS, sitemapPages, sitemapSectionUrl } from "../src/shared/sitemap";
import { QUIZZES } from "../src/shared/quiz";
import { DATASET_SNAPSHOT, DATASETS } from "../src/shared/datasets";
import { CODE_ARTICLES, KB_ARTICLES, KNOWLEDGE_ARTICLES, kbUpdatedOn } from "../src/shared/kb";
import { REF_ENTRIES } from "../src/shared/ref";

describe("sitemap", () => {
  it("lists every locale home and tool with reciprocal hreflang", () => {
    const xml = buildSitemapXml();
    expect(xml.startsWith("<?xml version=\"1.0\" encoding=\"UTF-8\"?>")).toBe(true);
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(sitemapPages().length).toBe(
      LOCALES.length * (1 + TOOLS.length + CONVERT_JOBS.length + RESIZE_JOBS.length + 1 + FEATURED_TUTORIALS.length + 1 + GAME_CONSOLES.length + GAMES.length + DEVICE_PAGES.length + LEGAL_PAGES.length + 1 + QUIZZES.length + 1 + DATASETS.length + 2 + KB_ARTICLES.length + 1 + REF_ENTRIES.length),
    );
    for (const locale of LOCALES) {
      expect(xml).toContain(`https://cv.cm${appHref(locale, null)}`);
      expect(xml).toContain(`hreflang="${HREFLANG[locale]}"`);
      expect(xml).toContain(`https://cv.cm${learnHref(locale, null)}`);
      expect(xml).toContain(`https://cv.cm${gamesHref(locale, null)}`);
      expect(xml).toContain(`https://cv.cm${appHref(locale, "gold")}`);
      expect(xml).toContain(`https://cv.cm${appHref(locale, "oil")}`);
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
    // Only kb pages (two hubs and their articles), data tables and reference pages have real edit dates.
    expect(xml.match(/<lastmod>/g)?.length).toBe(LOCALES.length * (KB_ARTICLES.length + 2 + DATASETS.length + 1 + REF_ENTRIES.length + 1));
    expect(xml).toContain(`<lastmod>${DATASET_SNAPSHOT}</lastmod>`);
    const newest = KNOWLEDGE_ARTICLES.map((id) => kbUpdatedOn(id, "en")).sort().at(-1);
    expect(xml).toContain(`<loc>https://cv.cm${kbHref("en", null)}</loc>\n    <lastmod>${newest}</lastmod>`);
    const newestCode = CODE_ARTICLES.map((id) => kbUpdatedOn(id, "en")).sort().at(-1);
    expect(xml).toContain(`<loc>https://cv.cm${kbHref("en", "code")}</loc>\n    <lastmod>${newestCode}</lastmod>`);
    expect(xml).toContain(`<loc>https://cv.cm${kbHref("en", KB_ARTICLES[0])}</loc>\n    <lastmod>${kbUpdatedOn(KB_ARTICLES[0], "en")}</lastmod>`);
    expect(xml).toContain(`<loc>https://cv.cm${appHref("en", null)}</loc>\n    <xhtml:link`);
    expect(xml).not.toContain("<changefreq>");
    expect(xml).not.toContain("<priority>");
  });

  it("splits pages into section sitemaps listed by the index", () => {
    const index = buildSitemapIndexXml();
    expect(index).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    for (const section of SITEMAP_SECTIONS) {
      expect(index).toContain(`<loc>${sitemapSectionUrl(section)}</loc>`);
      expect(parseAppPath(new URL(sitemapSectionUrl(section)).pathname)).toEqual({ kind: "static" });
    }
    const sections = buildSectionSitemaps();
    const counts = SITEMAP_SECTIONS.map((section) => sections[section].match(/<loc>/g)?.length ?? 0);
    expect(counts.every((count) => count > 0)).toBe(true);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(sitemapPages().length);
    expect(sections.games).toContain(`https://cv.cm${gamesHref("en", "fc", "contra")}`);
    expect(sections.games).not.toContain(`https://cv.cm${appHref("en", "qr")}`);
    expect(sections.learn).toContain(`https://cv.cm${kbHref("ja", null)}`);
    expect(parseAppPath("/sitemaps/nope.xml")).toEqual({ kind: "unknown" });
  });
});
