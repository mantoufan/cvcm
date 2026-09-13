import { LOCALES, DEFAULT_LOCALE, type Locale } from "./locale";
import { TOOLS, appHref, type ToolId } from "./path";

export const SITE_ORIGIN = "https://cv.cm";

/** hreflang values match our URL locale codes (ISO 639-1, plus region for Chinese). */
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

export type SitemapPage = { locale: Locale; tool: ToolId | null };

export function sitemapPages(): SitemapPage[] {
  const pages: SitemapPage[] = [];
  for (const locale of LOCALES) {
    pages.push({ locale, tool: null });
    for (const tool of TOOLS) pages.push({ locale, tool });
  }
  return pages;
}

export function pageUrl(page: SitemapPage): string {
  return `${SITE_ORIGIN}${appHref(page.locale, page.tool)}`;
}

function xmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function alternateLinks(tool: ToolId | null): string {
  const links = LOCALES.map((locale) => {
    const href = xmlAttr(`${SITE_ORIGIN}${appHref(locale, tool)}`);
    return `    <xhtml:link rel="alternate" hreflang="${HREFLANG[locale]}" href="${href}"/>`;
  });
  const fallback = xmlAttr(`${SITE_ORIGIN}${appHref(DEFAULT_LOCALE, tool)}`);
  links.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${fallback}"/>`);
  return links.join("\n");
}

export function buildSitemapXml(lastmod = new Date().toISOString().slice(0, 10)): string {
  const blocks = sitemapPages().map((page) => {
    const loc = xmlAttr(pageUrl(page));
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n${alternateLinks(page.tool)}\n  </url>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...blocks,
    "</urlset>",
    "",
  ].join("\n");
}
