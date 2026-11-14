import { LOCALES, type Locale } from "./locale";
import { pageDescription, pageTitle, type SeoInput } from "./seo";
import { sitemapPages, SITE_ORIGIN, pageUrl, type SitemapPage } from "./sitemap";
import { messages } from "./messages";
import { nameFromTitle, SEARCH_CHANNEL_LABEL, shortBlurb, type SearchChannel, type SearchEntry } from "./search";

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
      return page.entry === null;
    case "games":
      return page.console === null && page.game === null;
    default:
      return false;
  }
}

function pageName(locale: Locale, page: SitemapPage, channel: SearchChannel, seo: SeoInput): string {
  if (isHub(page)) {
    const key = SEARCH_CHANNEL_LABEL[channel].split(".")[1] as keyof ReturnType<typeof messages>["ui"]["nav"];
    const label = messages(locale).ui.nav[key];
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
    case "games":
      return { channel: "games", seo: { games: true, console: page.console, game: page.game } };
    default:
      return null;
  }
}

function relative(url: string): string {
  return url.startsWith(SITE_ORIGIN) ? url.slice(SITE_ORIGIN.length) || "/" : url;
}

/**
 * Every sitemap page of one locale as search entries, in sitemap order (tools first). Outside English
 * each entry also carries the English name, so "pdf merge" still finds 合并 PDF.
 */
export function buildSearchIndex(locale: Locale, pages: SitemapPage[] = sitemapPages()): SearchEntry[] {
  const english = new Map<string, string>();
  const entries: SearchEntry[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    const info = describe(page);
    if (!info) continue;
    if (page.locale === "en") english.set(keyOf(page), pageName("en", page, info.channel, info.seo));
  }
  for (const page of pages) {
    if (page.locale !== locale) continue;
    const info = describe(page);
    if (!info) continue;
    const href = relative(pageUrl(page));
    if (seen.has(href)) continue;
    seen.add(href);
    const name = pageName(locale, page, info.channel, info.seo);
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
  return Object.fromEntries(LOCALES.map((locale) => [locale, buildSearchIndex(locale, pages)])) as Record<Locale, SearchEntry[]>;
}
