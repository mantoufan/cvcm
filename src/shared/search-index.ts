import { LOCALES, type Locale } from "./locale";
import { pageDescription, pageTitle, type SeoInput } from "./seo";
import { sitemapPages, SITE_ORIGIN, pageUrl, type SitemapPage } from "./sitemap";
import { messages } from "./messages";
import { nameFromTitle, SEARCH_CHANNEL_NAV, shortBlurb, type SearchChannel, type SearchEntry } from "./search";

/** A channel's front page (/tests/, /rankings/ …): listed under the channel's own name, not its SEO title. */
function isHub(page: SitemapPage): boolean {
  switch (page.kind) {
    case "learn":
      return page.tutorial === null;
    case "quiz":
      return page.quiz === null;
    case "dataset":
      return page.dataset === null;
    case "ranking":
      return page.ranking === null;
    case "ref":
    case "slang":
    case "ideas":
    case "nostalgia":
      return page.entry === null;
    case "games":
      return page.console === null && page.game === null;
    default:
      return false;
  }
}

function pageName(locale: Locale, page: SitemapPage, channel: SearchChannel, seo: SeoInput): string {
  if (isHub(page)) {
    const label = messages(locale).ui.nav[SEARCH_CHANNEL_NAV[channel]];
    if (typeof label === "string") return label;
  }
  return nameFromTitle(pageTitle(locale, seo));
}

/** Channel and SEO input of a sitemap page; null for pages search leaves out (home, legal). */
function describe(page: SitemapPage): { channel: SearchChannel; seo: SeoInput } | null {
  switch (page.kind) {
    case "tool":
      return { channel: "tool", seo: { tool: page.tool } };
    case "convert-job":
      return { channel: "tool", seo: { tool: "convert", convertJob: page.job } };
    case "resize-job":
      return { channel: "tool", seo: { tool: "resize", resizeJob: page.job } };
    case "device":
      return { channel: "tool", seo: { devicePage: page.page } };
    case "learn":
      return { channel: "learn", seo: { learn: true, tutorial: page.tutorial } };
    case "kb":
      return { channel: "kb", seo: { kb: true, kbId: page.article } };
    case "quiz":
      return { channel: "tests", seo: { quiz: true, quizId: page.quiz } };
    case "dataset":
      return { channel: "datasets", seo: { dataset: true, datasetId: page.dataset } };
    case "ranking":
      return { channel: "rankings", seo: { ranking: true, rankingId: page.ranking } };
    case "ref":
      return { channel: "reference", seo: { ref: true, refId: page.entry } };
    case "slang":
      return { channel: "slang", seo: { slang: true, slangId: page.entry } };
    case "ideas":
      return { channel: "ideas", seo: { ideas: true, ideaId: page.entry } };
    case "nostalgia":
      return { channel: "nostalgia", seo: { nostalgia: true, nostalgiaId: page.entry } };
    case "games":
      return { channel: "games", seo: { games: true, console: page.console, game: page.game } };
    default:
      return null;
  }
}

function relative(url: string): string {
  return url.startsWith(SITE_ORIGIN) ? url.slice(SITE_ORIGIN.length) || "/" : url;
}

/** English names of every page, keyed by the page without its locale: keywords for the other locales. */
function englishNames(pages: SitemapPage[]): Map<string, string> {
  const english = new Map<string, string>();
  for (const page of pages) {
    const info = page.locale === "en" ? describe(page) : null;
    if (info) english.set(keyOf(page), pageName("en", page, info.channel, info.seo));
  }
  return english;
}

/** The page title without the site suffix: used when the short name would repeat another result's name. */
function fullTitle(locale: Locale, seo: SeoInput): string {
  return pageTitle(locale, seo).replace(/\s*[|｜—–]\s*cv\.cm\s*$/i, "").trim();
}

/**
 * Every sitemap page of one locale as search entries, in sitemap order (tools first). Outside English
 * each entry also carries the English name, so "pdf merge" still finds 合并 PDF. When a short name repeats an
 * earlier one (the 麦克风测试 tool and its tutorial "麦克风测试：…"), the later entry keeps its full title.
 */
export function buildSearchIndex(locale: Locale, pages: SitemapPage[] = sitemapPages(), english = englishNames(pages)): SearchEntry[] {
  const entries: SearchEntry[] = [];
  const seen = new Set<string>();
  const names = new Set<string>();
  for (const page of pages) {
    if (page.locale !== locale) continue;
    const info = describe(page);
    if (!info) continue;
    const href = relative(pageUrl(page));
    if (seen.has(href)) continue;
    seen.add(href);
    let name = pageName(locale, page, info.channel, info.seo);
    if (names.has(name.toLowerCase())) name = fullTitle(locale, info.seo);
    // Still taken (two pages with the same title): number it, so every result reads differently.
    for (let n = 2, base = name; names.has(name.toLowerCase()); n++) name = `${base} (${n})`;
    names.add(name.toLowerCase());
    const entry: SearchEntry = [info.channel, href, name, shortBlurb(pageDescription(locale, info.seo))];
    const alt = english.get(keyOf(page));
    if (locale !== "en" && alt && alt !== name) entry.push(alt);
    entries.push(entry);
  }
  return entries;
}

/** A page's identity across locales: the sitemap entry without its locale. */
function keyOf(page: SitemapPage): string {
  const { locale: _locale, ...rest } = page;
  return JSON.stringify(rest);
}

export function buildAllSearchIndexes(): Record<Locale, SearchEntry[]> {
  const pages = sitemapPages();
  const english = englishNames(pages);
  return Object.fromEntries(LOCALES.map((locale) => [locale, buildSearchIndex(locale, pages, english)])) as Record<Locale, SearchEntry[]>;
}
