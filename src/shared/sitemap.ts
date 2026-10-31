import { LOCALES, DEFAULT_LOCALE, type Locale } from "./locale";
import { GAME_CONSOLES, GAMES, type GameConsoleId, type GameId } from "./games";
import { DEVICE_PAGES, type DevicePageId } from "./device";
import { QUIZZES, type QuizId } from "./quiz";
import { KB_ARTICLES, kbArticleOf, kbGroupsOf, kbShelfOfPage, type KbPage } from "./kb";
import { DATASET_SNAPSHOT, DATASETS, type DatasetId } from "./datasets";
import { KB_UPDATED } from "../locales/kb/meta";
import { CONVERT_JOBS, RESIZE_JOBS, SITEMAP_SECTIONS, TOOLS, FEATURED_TUTORIALS, LEGAL_PAGES, appHref, deviceHref, gamesHref, kbHref, learnHref, legalHref, quizHref, datasetHref, type ConvertJobId, type ResizeJobId, type ToolId, type LegalPageId, type TutorialId } from "./path";

export const SITE_ORIGIN = "https://cv.cm";

/** hreflang stays BCP 47 (`zh-CN`); public URL paths are lowercase (`/zh-cn/`). */
export const HREFLANG: Record<Locale, string> = {
  en: "en",
  "zh-CN": "zh-CN",
  "zh-TW": "zh-TW",
  ja: "ja",
  ko: "ko",
  vi: "vi",
  id: "id",
  es: "es",
};

export type SitemapPage =
  | { locale: Locale; kind: "home" }
  | { locale: Locale; kind: "tool"; tool: ToolId }
  | { locale: Locale; kind: "convert-job"; job: ConvertJobId }
  | { locale: Locale; kind: "resize-job"; job: ResizeJobId }
  | { locale: Locale; kind: "learn"; tutorial: TutorialId | null }
  | { locale: Locale; kind: "games"; console: GameConsoleId | null; game: GameId | null }
  | { locale: Locale; kind: "device"; page: DevicePageId }
  | { locale: Locale; kind: "legal"; page: LegalPageId }
  | { locale: Locale; kind: "quiz"; quiz: QuizId | null }
  | { locale: Locale; kind: "dataset"; dataset: DatasetId | null }
  | { locale: Locale; kind: "kb"; article: KbPage };

export function sitemapPages(): SitemapPage[] {
  const pages: SitemapPage[] = [];
  for (const locale of LOCALES) {
    pages.push({ locale, kind: "home" });
    for (const tool of TOOLS) pages.push({ locale, kind: "tool", tool });
    for (const job of CONVERT_JOBS) pages.push({ locale, kind: "convert-job", job });
    for (const job of RESIZE_JOBS) pages.push({ locale, kind: "resize-job", job });
    pages.push({ locale, kind: "learn", tutorial: null });
    for (const tutorial of FEATURED_TUTORIALS) pages.push({ locale, kind: "learn", tutorial });
    pages.push({ locale, kind: "kb", article: null });
    pages.push({ locale, kind: "kb", article: "code" });
    for (const article of KB_ARTICLES) pages.push({ locale, kind: "kb", article });
    pages.push({ locale, kind: "games", console: null, game: null });
    for (const consoleId of GAME_CONSOLES) {
      pages.push({ locale, kind: "games", console: consoleId, game: null });
    }
    for (const game of GAMES) {
      pages.push({ locale, kind: "games", console: game.console, game: game.id });
    }
    for (const page of DEVICE_PAGES) pages.push({ locale, kind: "device", page });
    pages.push({ locale, kind: "quiz", quiz: null });
    for (const quiz of QUIZZES) pages.push({ locale, kind: "quiz", quiz });
    pages.push({ locale, kind: "dataset", dataset: null });
    for (const dataset of DATASETS) pages.push({ locale, kind: "dataset", dataset });
    for (const page of LEGAL_PAGES) pages.push({ locale, kind: "legal", page });
  }
  return pages;
}

export function pageUrl(page: SitemapPage): string {
  if (page.kind === "learn") return `${SITE_ORIGIN}${learnHref(page.locale, page.tutorial)}`;
  if (page.kind === "tool") return `${SITE_ORIGIN}${appHref(page.locale, page.tool)}`;
  if (page.kind === "convert-job") return `${SITE_ORIGIN}${appHref(page.locale, "convert", null, page.job)}`;
  if (page.kind === "resize-job") return `${SITE_ORIGIN}${appHref(page.locale, "resize", null, page.job)}`;
  if (page.kind === "games") return `${SITE_ORIGIN}${gamesHref(page.locale, page.console, page.game)}`;
  if (page.kind === "device") return `${SITE_ORIGIN}${deviceHref(page.locale, page.page)}`;
  if (page.kind === "legal") return `${SITE_ORIGIN}${legalHref(page.locale, page.page)}`;
  if (page.kind === "quiz") return `${SITE_ORIGIN}${quizHref(page.locale, page.quiz)}`;
  if (page.kind === "dataset") return `${SITE_ORIGIN}${datasetHref(page.locale, page.dataset)}`;
  if (page.kind === "kb") return `${SITE_ORIGIN}${kbHref(page.locale, page.article)}`;
  return `${SITE_ORIGIN}${appHref(page.locale, null)}`;
}

function xmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function pathFor(locale: Locale, page: SitemapPage): string {
  if (page.kind === "learn") return `${SITE_ORIGIN}${learnHref(locale, page.tutorial)}`;
  if (page.kind === "tool") return `${SITE_ORIGIN}${appHref(locale, page.tool)}`;
  if (page.kind === "convert-job") return `${SITE_ORIGIN}${appHref(locale, "convert", null, page.job)}`;
  if (page.kind === "resize-job") return `${SITE_ORIGIN}${appHref(locale, "resize", null, page.job)}`;
  if (page.kind === "games") return `${SITE_ORIGIN}${gamesHref(locale, page.console, page.game)}`;
  if (page.kind === "device") return `${SITE_ORIGIN}${deviceHref(locale, page.page)}`;
  if (page.kind === "legal") return `${SITE_ORIGIN}${legalHref(locale, page.page)}`;
  if (page.kind === "quiz") return `${SITE_ORIGIN}${quizHref(locale, page.quiz)}`;
  if (page.kind === "dataset") return `${SITE_ORIGIN}${datasetHref(locale, page.dataset)}`;
  if (page.kind === "kb") return `${SITE_ORIGIN}${kbHref(locale, page.article)}`;
  return `${SITE_ORIGIN}${appHref(locale, null)}`;
}

function alternateLinks(page: SitemapPage): string {
  const links = LOCALES.map((locale) => {
    const href = xmlAttr(pathFor(locale, page));
    return `    <xhtml:link rel="alternate" hreflang="${HREFLANG[locale]}" href="${href}"/>`;
  });
  const fallback = xmlAttr(pathFor(DEFAULT_LOCALE, page));
  links.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${fallback}"/>`);
  return links.join("\n");
}

export { SITEMAP_SECTIONS };
export type SitemapSection = (typeof SITEMAP_SECTIONS)[number];

export function sitemapSection(page: SitemapPage): SitemapSection {
  if (page.kind === "learn" || page.kind === "kb") return "learn";
  if (page.kind === "games") return "games";
  if (page.kind === "quiz") return "tests";
  if (page.kind === "dataset") return "datasets";
  return "pages";
}

export function sitemapSectionUrl(section: SitemapSection): string {
  return `${SITE_ORIGIN}/sitemaps/${section}.xml`;
}

/**
 * `<lastmod>` only where a real edit date exists: knowledge articles (per-locale dates from git via
 * `npm run kb:sync`), their hub (newest article), and data tables (snapshot date). Other pages have no tracked
 * edit date, and stamping the build date on every URL teaches Google to ignore lastmod.
 */
function pageLastmod(page: SitemapPage): string | null {
  if (page.kind === "kb") {
    const id = kbArticleOf(page.article);
    if (id) return KB_UPDATED[id][page.locale];
    // A hub: its newest article.
    return kbGroupsOf(kbShelfOfPage(page.article)).flatMap((group) => group.articles).map((article) => KB_UPDATED[article][page.locale]).sort().at(-1) ?? null;
  }
  if (page.kind === "dataset") return DATASET_SNAPSHOT;
  return null;
}

/** A `<urlset>` of the given pages (default: every page). */
export function buildSitemapXml(pages: SitemapPage[] = sitemapPages()): string {
  const blocks = pages.map((page) => {
    const loc = xmlAttr(pageUrl(page));
    const lastmod = pageLastmod(page);
    return `  <url>\n    <loc>${loc}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ""}${alternateLinks(page)}\n  </url>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...blocks,
    "</urlset>",
    "",
  ].join("\n");
}

/** One `<urlset>` per section. */
export function buildSectionSitemaps(): Record<SitemapSection, string> {
  const groups = Object.fromEntries(SITEMAP_SECTIONS.map((section) => [section, [] as SitemapPage[]])) as Record<SitemapSection, SitemapPage[]>;
  for (const page of sitemapPages()) groups[sitemapSection(page)].push(page);
  return Object.fromEntries(SITEMAP_SECTIONS.map((section) => [section, buildSitemapXml(groups[section])])) as Record<SitemapSection, string>;
}

/** `/sitemap.xml`: an index of the section sitemaps. */
export function buildSitemapIndexXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...SITEMAP_SECTIONS.map((section) => `  <sitemap>\n    <loc>${sitemapSectionUrl(section)}</loc>\n  </sitemap>`),
    "</sitemapindex>",
    "",
  ].join("\n");
}
