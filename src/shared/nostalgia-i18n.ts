import type { Locale } from "./locale";
import { fill } from "./fill";
import { PUBLISHER, type KbBlock } from "./kb-i18n";
import { nostalgiaEntryMessages, nostalgiaMessages, type NostalgiaMessages } from "./messages";
import { appHref, nostalgiaHref } from "./path";
import { NOSTALGIA_ENTRIES, nostalgiaGroupOf, nostalgiaPublished, nostalgiaUpdated, type NostalgiaId } from "./nostalgia";
import { HREFLANG } from "./sitemap";
import type { NostalgiaMeta } from "./nostalgia-meta";
import { nostalgiaImage, nostalgiaImagePath } from "./nostalgia-images";

/** One entry's copy, `src/locales/nostalgia/<locale>/<id>.json`. Blocks are the kb blocks. */
export type NostalgiaEntryCopy = {
  name: string;
  blurb: string;
  aka: string[];
  /** Without the " — cv.cm" suffix (nostalgiaTitle adds it). */
  title: string;
  description: string;
  h1: string;
  answer: string;
  sections: { h: string; body: KbBlock[] }[];
  faq: { q: string; a: string }[];
};

const ORIGIN = "https://cv.cm";

/** The decades the hub groups entries by, from each entry's `from`. */
export const NOSTALGIA_DECADES = ["1980s", "1990s", "2000s"] as const;
export type NostalgiaDecade = (typeof NOSTALGIA_DECADES)[number];

export type NostalgiaUi = NostalgiaMessages["ui"];

export function nostalgiaUi(locale: Locale): NostalgiaUi {
  return nostalgiaMessages(locale).ui;
}

export function nostalgiaHub(locale: Locale): NostalgiaMessages["hub"] {
  return nostalgiaMessages(locale).hub;
}

export function nostalgiaCopy(locale: Locale, id: NostalgiaId): NostalgiaEntryCopy {
  return nostalgiaEntryMessages(locale, id);
}

/** Name and one-line blurb from the nostalgia pack (`npm run nostalgia:sync`), so lists never load entry chunks. */
export function nostalgiaName(locale: Locale, id: NostalgiaId): { name: string; blurb: string } {
  return nostalgiaMessages(locale).list[id];
}

export function nostalgiaTitle(locale: Locale, id: NostalgiaId | null): string {
  return `${id ? nostalgiaCopy(locale, id).title : nostalgiaHub(locale).title} — cv.cm`;
}

export function nostalgiaDescription(locale: Locale, id: NostalgiaId | null): string {
  return id ? nostalgiaCopy(locale, id).description : fill(nostalgiaHub(locale).description, { n: NOSTALGIA_ENTRIES.length });
}

export function nostalgiaFaqItems(locale: Locale, id: NostalgiaId | null): { q: string; a: string }[] {
  return id ? nostalgiaCopy(locale, id).faq : nostalgiaHub(locale).faq;
}

/**
 * Still sold without a break: the only status a page may describe as lasting "to today". A revived item (QQ秀,
 * 北冰洋, Nokia 3310) had a gap, so it reads "from X" with its "brought back" status and gets no interval.
 */
export function stillAround(status: NostalgiaMeta["status"]): boolean {
  return status === "available";
}

/** An entry's years, status, related ids and sources, from the nostalgia pack. */
export function nostalgiaMeta(locale: Locale, id: NostalgiaId): NostalgiaMeta {
  return nostalgiaMessages(locale).meta[id];
}

/** ImageObject with the license fields Google Images reads (license, acquireLicensePage, creditText, creator). */
function imageJsonLd(locale: Locale, id: NostalgiaId): Record<string, unknown> | null {
  const image = nostalgiaImage(id);
  if (!image) return null;
  const url = `${ORIGIN}${nostalgiaImagePath(id)}`;
  const by = image.author ? `${image.author} / ` : "";
  return {
    "@type": "ImageObject",
    contentUrl: url,
    url,
    width: image.width,
    height: image.height,
    caption: fill(nostalgiaUi(locale).imageAlt, { name: nostalgiaName(locale, id).name }),
    ...(image.author && image.creatorType ? { creator: { "@type": image.creatorType, name: image.author } } : {}),
    creditText: `${by}${image.license} / Wikimedia Commons`,
    copyrightNotice: `${by}${image.license}`,
    license: image.licenseUrl,
    acquireLicensePage: image.page,
  };
}

export function nostalgiaBreadcrumbJsonLd(locale: Locale, id: NostalgiaId | null): Record<string, unknown> {
  const m = nostalgiaMessages(locale);
  const items = [
    { name: m.crumbHome, item: `${ORIGIN}${appHref(locale, null)}` },
    { name: m.hub.h1, item: `${ORIGIN}${nostalgiaHref(locale)}` },
  ];
  if (id) items.push({ name: nostalgiaName(locale, id).name, item: `${ORIGIN}${nostalgiaHref(locale, id)}` });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, ...item })),
  };
}

export function nostalgiaFaqJsonLd(locale: Locale, id: NostalgiaId | null): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: nostalgiaFaqItems(locale, id).map((item) => ({
      "@type": "Question",
      name: item.q.replaceAll("`", ""),
      acceptedAnswer: { "@type": "Answer", text: item.a.replaceAll("`", "") },
    })),
  };
}

/**
 * temporalCoverage as an ISO 8601 interval, only where the page states it: "1983/.." while it is still sold without a
 * break, "1983/2003" for a known run that is over (never for a revived item, which had a gap). Without an end year (a fad, a corner shop, a VCD
 * whose last year is undocumented) there is none: a lone year or decade would claim it existed only then.
 */
function coverage(locale: Locale, id: NostalgiaId): string | null {
  const { from, to, status } = nostalgiaMeta(locale, id);
  const start = from.slice(0, 4);
  if (stillAround(status)) return to ? null : `${start}/..`;
  // Revived after a gap (and Nokia 3310's known first run, then a remake): neither open nor closed, so none.
  if (!to || status === "revived") return null;
  return `${start}/${/^\d{4}s$/.test(to) ? Number(to.slice(0, 4)) + 9 : to}`;
}

/** Other names for the Thing: the original term and the copy's aka, without repeating the name; omitted when empty. */
function alternateNames(term: string, copy: NostalgiaEntryCopy): { alternateName?: string[] } {
  const names = [...new Set([term, ...copy.aka])].filter((n) => n !== copy.name);
  return names.length ? { alternateName: names } : {};
}

/** Article about a Thing for an entry; CollectionPage with an ItemList of every entry for the hub. */
export function nostalgiaArticleJsonLd(locale: Locale, id: NostalgiaId | null): Record<string, unknown> {
  if (!id) {
    const hub = nostalgiaHub(locale);
    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: hub.h1,
      description: nostalgiaDescription(locale, null),
      url: `${ORIGIN}${nostalgiaHref(locale)}`,
      inLanguage: HREFLANG[locale],
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: NOSTALGIA_ENTRIES.length,
        itemListElement: NOSTALGIA_ENTRIES.map((entry, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: nostalgiaName(locale, entry).name,
          url: `${ORIGIN}${nostalgiaHref(locale, entry)}`,
        })),
      },
    };
  }
  const copy = nostalgiaCopy(locale, id);
  const url = `${ORIGIN}${nostalgiaHref(locale, id)}`;
  const answer = copy.answer.replaceAll("`", "");
  const meta = nostalgiaMeta(locale, id);
  const period = coverage(locale, id);
  const image = imageJsonLd(locale, id);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: copy.h1,
    description: copy.description,
    abstract: answer,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: HREFLANG[locale],
    datePublished: nostalgiaPublished(id),
    dateModified: nostalgiaUpdated(id),
    author: PUBLISHER,
    publisher: PUBLISHER,
    isAccessibleForFree: true,
    articleSection: (nostalgiaHub(locale).groups as Record<string, string>)[nostalgiaGroupOf(id)],
    ...(period ? { temporalCoverage: period } : {}),
    ...(image ? { image } : {}),
    about: {
      "@type": "Thing",
      name: copy.name,
      description: answer,
      ...alternateNames(meta.term, copy),
    },
    ...(meta.sources.length ? { citation: meta.sources.map((s) => ({ "@type": "CreativeWork", name: s.name, url: s.url })) } : {}),
  };
}
