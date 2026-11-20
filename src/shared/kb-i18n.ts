import type { Locale } from "./locale";
import { kbArticleOf, kbHubOf, kbGroupOf, kbGroupsOf, kbMeta, kbShelfOf, kbShelfOfPage, kbUpdatedOn, type KbId, type KbPage, type KbShelf } from "./kb";
import { kbArticleMessages, kbMessages, messages, type KbMessages } from "./messages";
import { HREFLANG } from "./sitemap";
import { appHref, kbHref, learnHref } from "./path";

export type KbBlock =
  | string
  | { ul: string[] }
  | { ol: string[] }
  | { table: { head: string[]; rows: string[][] } }
  | { note: string }
  /** A multi-line code sample, the same in every locale. */
  | { code: string; lang: string };

export type KbSection = { h: string; body: KbBlock[] };

export type KbArticleCopy = {
  title: string;
  description: string;
  h1: string;
  answer: string;
  sections: KbSection[];
  faq: { q: string; a: string }[];
};

export type KbUi = KbMessages["ui"];
export type KbHubCopy = Omit<KbMessages["hub"], "groups"> & { groups: Record<string, string>; kicker?: string; all?: string };

const ORIGIN = "https://cv.cm";

/** Hub copy of a shelf: `hub` for knowledge, `codeHub` for coding, `aiHub` for AI, `photoHub` for photography, `massageHub` for massage. */
const HUB_COPY_KEY: Record<KbShelf, "hub" | "codeHub" | "aiHub" | "photoHub" | "massageHub"> = { knowledge: "hub", code: "codeHub", ai: "aiHub", photo: "photoHub", massage: "massageHub" };

export function kbHub(locale: Locale, shelf: KbShelf = "knowledge"): KbHubCopy {
  return kbMessages(locale)[HUB_COPY_KEY[shelf]];
}

export function kbCopy(locale: Locale, id: KbId): KbArticleCopy {
  return kbArticleMessages(locale, id);
}

/** Name and one-line blurb, from the core pack: the tutorial hub and tool pages list articles without the kb pack. */
export function kbName(locale: Locale, id: KbId): { name: string; blurb: string } {
  return (messages(locale).ui.kb as unknown as Record<KbId, { name: string; blurb: string }>)[id];
}

export function kbTitle(locale: Locale, page: KbPage): string {
  const id = kbArticleOf(page);
  return id ? kbCopy(locale, id).title : kbHub(locale, kbShelfOfPage(page)).title;
}

export function kbDescription(locale: Locale, page: KbPage): string {
  const id = kbArticleOf(page);
  return id ? kbCopy(locale, id).description : kbHub(locale, kbShelfOfPage(page)).description;
}

export function kbFaqItems(locale: Locale, page: KbPage): { q: string; a: string }[] {
  const id = kbArticleOf(page);
  return id ? kbCopy(locale, id).faq : kbHub(locale, kbShelfOfPage(page)).faq;
}

/** When this locale's page last changed (copy or sources), from `npm run kb:sync`. */
export function kbUpdated(locale: Locale, id: KbId): string {
  return kbUpdatedOn(id, locale);
}

export function kbLinkItems(locale: Locale, ids: readonly KbId[]): { href: string; name: string; blurb: string; nav: string }[] {
  return ids.map((id) => ({ href: kbHref(locale, id), ...kbName(locale, id), nav: `kb-${id}` }));
}

export function kbBreadcrumbJsonLd(locale: Locale, page: KbPage): Record<string, unknown> {
  const m = kbMessages(locale);
  const id = kbArticleOf(page);
  const shelf = kbShelfOfPage(page);
  const items = [
    { name: m.crumbHome, item: `${ORIGIN}${appHref(locale, null)}` },
    { name: m.ui.learn, item: `${ORIGIN}${learnHref(locale)}` },
    { name: kbHub(locale, shelf).h1, item: `${ORIGIN}${kbHref(locale, kbHubOf(shelf))}` },
  ];
  if (id) items.push({ name: kbName(locale, id).name, item: `${ORIGIN}${kbHref(locale, id)}` });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, ...item })),
  };
}

export function kbFaqJsonLd(locale: Locale, page: KbPage): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: kbFaqItems(locale, page).map((item) => ({
      "@type": "Question",
      name: item.q.replaceAll("`", ""),
      acceptedAnswer: { "@type": "Answer", text: item.a.replaceAll("`", "") },
    })),
  };
}

export const PUBLISHER = {
  "@type": "Organization",
  name: "cv.cm",
  url: `${ORIGIN}/`,
  logo: `${ORIGIN}/favicon-512.png`,
};

/** TechArticle for an article (Article in the culture group); CollectionPage + ItemList for the hub. */
export function kbArticleJsonLd(locale: Locale, page: KbPage): Record<string, unknown> {
  const id = kbArticleOf(page);
  if (!id) {
    const shelf = kbShelfOfPage(page);
    const hub = kbHub(locale, shelf);
    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: hub.h1,
      description: hub.description,
      url: `${ORIGIN}${kbHref(locale, kbHubOf(shelf))}`,
      inLanguage: HREFLANG[locale],
      mainEntity: {
        "@type": "ItemList",
        itemListElement: kbGroupsOf(shelf).flatMap((group) => group.articles).map((article, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${ORIGIN}${kbHref(locale, article)}`,
          name: kbName(locale, article).name,
        })),
      },
    };
  }
  const copy = kbCopy(locale, id);
  const meta = kbMeta(id);
  const url = `${ORIGIN}${kbHref(locale, id)}`;
  return {
    "@context": "https://schema.org",
    "@type": kbGroupOf(id) === "culture" ? "Article" : "TechArticle",
    headline: copy.h1,
    description: copy.description,
    abstract: copy.answer.replaceAll("`", ""),
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: HREFLANG[locale],
    datePublished: meta.published,
    dateModified: kbUpdated(locale, id),
    author: PUBLISHER,
    publisher: PUBLISHER,
    isAccessibleForFree: true,
    articleSection: kbHub(locale, kbShelfOf(id)).groups[kbGroupOf(id)],
    ...(meta.sources.length ? { citation: meta.sources.map((s) => ({ "@type": "CreativeWork", name: s.title, url: s.href })) } : {}),
  };
}
