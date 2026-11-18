import type { Locale } from "./locale";
import { fill } from "./fill";
import { PUBLISHER, type KbBlock } from "./kb-i18n";
import { summaryEntryMessages, summariesMessages, type SummariesMessages } from "./messages";
import { appHref, summariesHref } from "./path";
import { SUMMARY_ENTRIES, summaryGroupOf, summaryPublished, summaryUpdated, type SummaryId } from "./summaries";
import { HREFLANG } from "./sitemap";
import type { SummaryKind, SummaryMeta } from "./summaries-meta";

/** One work's copy, `src/locales/summaries/<locale>/<id>.json`. Blocks are the kb blocks. */
export type SummaryEntryCopy = {
  name: string;
  blurb: string;
  aka: string[];
  /** Without the " — cv.cm" suffix (summariesTitle adds it). */
  title: string;
  description: string;
  h1: string;
  /** Spoiler-free: what the work is and what it is about. */
  answer: string;
  /** Characters, plot (spoiler), ending explained (spoiler), themes, before you read / watch. */
  sections: { h: string; spoiler?: boolean; body: KbBlock[] }[];
  /** The "did you get it?" self-check: three questions, three options, `answer` the right option's index. */
  check: { q: string; options: string[]; answer: number; why: string }[];
  faq: { q: string; a: string }[];
};

const ORIGIN = "https://cv.cm";

export type SummariesUi = SummariesMessages["ui"];

export function summariesUi(locale: Locale): SummariesUi {
  return summariesMessages(locale).ui;
}

export function summariesHub(locale: Locale): SummariesMessages["hub"] {
  return summariesMessages(locale).hub;
}

export function summaryCopy(locale: Locale, id: SummaryId): SummaryEntryCopy {
  return summaryEntryMessages(locale, id);
}

/** Name and one-line blurb from the summaries pack (`npm run summaries:sync`), so lists never load entry chunks. */
export function summaryName(locale: Locale, id: SummaryId): { name: string; blurb: string } {
  return summariesMessages(locale).list[id];
}

/** A work's kind, creator, years, related ids and sources, from the summaries pack. */
export function summaryMeta(locale: Locale, id: SummaryId): SummaryMeta {
  return summariesMessages(locale).meta[id];
}

export function summariesTitle(locale: Locale, id: SummaryId | null): string {
  return `${id ? summaryCopy(locale, id).title : summariesHub(locale).title} — cv.cm`;
}

export function summariesDescription(locale: Locale, id: SummaryId | null): string {
  return id ? summaryCopy(locale, id).description : fill(summariesHub(locale).description, { n: SUMMARY_ENTRIES.length });
}

export function summariesFaqItems(locale: Locale, id: SummaryId | null): { q: string; a: string }[] {
  return id ? summaryCopy(locale, id).faq : summariesHub(locale).faq;
}

/** The schema.org type a work is described as. */
export function summaryWorkType(kind: SummaryKind): "Book" | "Movie" | "TVSeries" {
  if (kind === "film" || kind === "anime-film") return "Movie";
  if (kind === "series" || kind === "anime-series") return "TVSeries";
  return "Book";
}

/** The people in a creator credit: "Matt Duffer and Ross Duffer", "A, B and C", "Hayao Miyazaki" (meta is written in English). */
export function creatorNames(creator: string): string[] {
  return creator.split(/\s*,\s*|\s+(?:and|&)\s+/).map((n) => n.trim()).filter(Boolean);
}

/** A creator credit for display, joined the locale's way ("A、B和C", "A, B y C") instead of with the English "and". */
export function summaryCreators(locale: Locale, creator: string): string {
  const names = creatorNames(creator);
  try {
    return new Intl.ListFormat(HREFLANG[locale], { style: "long", type: "conjunction" }).format(names);
  } catch {
    return names.join(", ");
  }
}

/** One Person per name in the credit. */
function people(creator: string): Record<string, string>[] | Record<string, string> {
  const list = creatorNames(creator).map((name) => ({ "@type": "Person", name }));
  return list.length === 1 ? list[0] : list;
}

/** The work the page is about: Book (plays, novels, poems), Movie or TVSeries. */
function workJsonLd(copy: SummaryEntryCopy, meta: SummaryMeta): Record<string, unknown> {
  const type = summaryWorkType(meta.kind);
  const names = [...new Set([meta.original, ...copy.aka])].filter((n) => n && n !== copy.name);
  const by = people(meta.creator);
  return {
    "@type": type,
    name: copy.name,
    ...(names.length ? { alternateName: names } : {}),
    inLanguage: meta.language,
    ...(type === "Book" ? { author: by, datePublished: meta.year } : {}),
    ...(type === "Movie" ? { director: by, datePublished: meta.year } : {}),
    ...(type === "TVSeries" ? { creator: by, startDate: meta.year, ...(meta.end ? { endDate: meta.end } : {}) } : {}),
  };
}

export function summariesBreadcrumbJsonLd(locale: Locale, id: SummaryId | null): Record<string, unknown> {
  const m = summariesMessages(locale);
  const items = [
    { name: m.crumbHome, item: `${ORIGIN}${appHref(locale, null)}` },
    { name: m.hub.h1, item: `${ORIGIN}${summariesHref(locale)}` },
  ];
  if (id) items.push({ name: summaryName(locale, id).name, item: `${ORIGIN}${summariesHref(locale, id)}` });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, ...item })),
  };
}

export function summariesFaqJsonLd(locale: Locale, id: SummaryId | null): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: summariesFaqItems(locale, id).map((item) => ({
      "@type": "Question",
      name: item.q.replaceAll("`", ""),
      acceptedAnswer: { "@type": "Answer", text: item.a.replaceAll("`", "") },
    })),
  };
}

/** Article about the work for a summary; CollectionPage with an ItemList of every work for the hub. The self-check stays out. */
export function summariesArticleJsonLd(locale: Locale, id: SummaryId | null): Record<string, unknown> {
  if (!id) {
    const hub = summariesHub(locale);
    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: hub.h1,
      description: summariesDescription(locale, null),
      url: `${ORIGIN}${summariesHref(locale)}`,
      inLanguage: HREFLANG[locale],
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: SUMMARY_ENTRIES.length,
        itemListElement: SUMMARY_ENTRIES.map((entry, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: summaryName(locale, entry).name,
          url: `${ORIGIN}${summariesHref(locale, entry)}`,
        })),
      },
    };
  }
  const copy = summaryCopy(locale, id);
  const url = `${ORIGIN}${summariesHref(locale, id)}`;
  const meta = summaryMeta(locale, id);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: copy.h1,
    description: copy.description,
    abstract: copy.answer.replaceAll("`", ""),
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: HREFLANG[locale],
    datePublished: summaryPublished(id),
    dateModified: summaryUpdated(id),
    author: PUBLISHER,
    publisher: PUBLISHER,
    isAccessibleForFree: true,
    articleSection: (summariesHub(locale).groups as Record<string, string>)[summaryGroupOf(id)],
    about: workJsonLd(copy, meta),
    ...(meta.sources.length ? { citation: meta.sources.map((s) => ({ "@type": "CreativeWork", name: s.name, url: s.url })) } : {}),
  };
}
