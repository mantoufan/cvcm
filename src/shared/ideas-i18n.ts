/**
 * Ideas channel copy, data helpers, titles, descriptions and JSON-LD: what every page head needs (the main bundle).
 * The page HTML lives in ideas-page.ts.
 */
import type { Locale } from "./locale";
import { fill } from "./fill";
import { PUBLISHER, type KbBlock } from "./kb-i18n";
import { ideaEntryMessages, ideasMessages, type IdeasMessages } from "./messages";
import { appHref, ideasHref } from "./path";
import { IDEA_ENTRIES, ideaGroupOf, ideaModified, ideaPublished, type IdeaId } from "./ideas";
import { HREFLANG } from "./sitemap";

/** One idea's copy, `src/locales/ideas/<locale>/<id>.json`. Blocks are the kb blocks (backticks are the only inline markup). */
export type IdeaEntryCopy = {
  name: string;
  blurb: string;
  /** Without the " — cv.cm" suffix (ideaTitle adds it). */
  title: string;
  description: string;
  h1: string;
  answer: string;
  sections: { h: string; body: KbBlock[] }[];
  faq: { q: string; a: string }[];
};

/**
 * Monthly snapshot from `scripts/ideas/fetch_kp.py`, derived from Google Ads Keyword Planner. Only bands, indexes, scores
 * and percentages: raw volumes and bids stay out of the (public) repo.
 */
export type IdeaScores = { demand: number; momentum: number; value: number; openness: number; total: number };
export type IdeaData = {
  /** Monthly searches, all languages combined, scaled so the 48-month peak is 100. */
  idx: number[];
  /** The 12-month forecast on the same scale, with a rough 80% band. */
  fc: number[];
  fcLo: number[];
  fcHi: number[];
  /** Index into `bands.demand` (last 12 months' average monthly searches). */
  demand: number;
  /** Last 12 months vs the 12 before, in percent; null when the year before had no searches (a new idea). */
  yoy: number | null;
  /** Last 12 months over the first 12 of the 48-month window, three years earlier (a multiple), when that year had 10+ searches a month. */
  fourYear: number | null;
  /** Forecast for the next 12 months vs the last 12, in percent. */
  next12: number;
  /** Index into `bands.cpc` (average top-of-page bid in USD), when advertisers bid at all. */
  cpc: number | null;
  /** Index into `bands.value` (searches × bid, USD per month). */
  value: number | null;
  /** Google's advertiser competition, null when no phrase had an index (then openness is a neutral 50). */
  competition: "low" | "medium" | "high" | null;
  scores: IdeaScores;
  /** Per language (as a site locale): demand band and change, for languages with at least 10 searches a month. */
  langs: Partial<Record<Locale, { demand: number; yoy: number | null }>>;
};
export type IdeasData = {
  /** First and last month of the window, "YYYY-MM". */
  from: string;
  to: string;
  /** The day the snapshot was taken (YYYY-MM-DD). */
  fetched: string;
  bands: { demand: number[]; cpc: number[]; value: number[] };
  ideas: Record<string, IdeaData>;
};

const ORIGIN = "https://cv.cm";

export type IdeasUi = IdeasMessages["ui"];


export function ideasHub(locale: Locale): IdeasMessages["hub"] {
  return ideasMessages(locale).hub;
}

export function ideaCopy(locale: Locale, id: IdeaId): IdeaEntryCopy {
  return ideaEntryMessages(locale, id);
}

/** Name and one-line blurb from the ideas pack (`npm run ideas:sync`), so lists never load idea chunks. */
export function ideaName(locale: Locale, id: IdeaId): { name: string; blurb: string } {
  return ideasMessages(locale).list[id];
}

export function ideasData(locale: Locale): IdeasData {
  return ideasMessages(locale).data;
}

export function ideaData(locale: Locale, id: IdeaId): IdeaData | null {
  return ideasData(locale).ideas[id] ?? null;
}

export function ideaTitle(locale: Locale, id: IdeaId | null): string {
  return `${id ? ideaCopy(locale, id).title : fill(ideasHub(locale).title, hubVars(locale))} — cv.cm`;
}

export function ideaDescription(locale: Locale, id: IdeaId | null): string {
  return id ? ideaCopy(locale, id).description : fill(ideasHub(locale).description, hubVars(locale));
}

/** Hub placeholders: the idea count and the year of the data snapshot ("business ideas 2027" after a January refresh). */
function hubVars(locale: Locale): { n: number; year: string } {
  return { n: IDEA_ENTRIES.length, year: ideasData(locale).fetched.slice(0, 4) };
}

export function ideaFaqItems(locale: Locale, id: IdeaId | null): { q: string; a: string }[] {
  return id ? ideaCopy(locale, id).faq : ideasHub(locale).faq.map((item) => ({ q: fill(item.q, hubVars(locale)), a: fill(item.a, hubVars(locale)) }));
}


/** Every idea with data, best outlook score first (ties: more demand first, then catalog order). */
export function rankedIdeas(locale: Locale): { id: IdeaId; data: IdeaData }[] {
  return IDEA_ENTRIES
    .flatMap((id) => {
      const data = ideaData(locale, id);
      return data ? [{ id, data }] : [];
    })
    .sort((a, b) => b.data.scores.total - a.data.scores.total || b.data.scores.demand - a.data.scores.demand);
}


export function ideaSources(locale: Locale, id: IdeaId): { name: string; url: string }[] {
  return ideasMessages(locale).sources[id] ?? [];
}

export function ideasBreadcrumbJsonLd(locale: Locale, id: IdeaId | null): Record<string, unknown> {
  const m = ideasMessages(locale);
  const items = [
    { name: m.crumbHome, item: `${ORIGIN}${appHref(locale, null)}` },
    { name: m.hub.h1, item: `${ORIGIN}${ideasHref(locale)}` },
  ];
  if (id) items.push({ name: ideaName(locale, id).name, item: `${ORIGIN}${ideasHref(locale, id)}` });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, ...item })),
  };
}

export function ideasFaqJsonLd(locale: Locale, id: IdeaId | null): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: ideaFaqItems(locale, id).map((item) => ({
      "@type": "Question",
      name: item.q.replaceAll("`", ""),
      acceptedAnswer: { "@type": "Answer", text: item.a.replaceAll("`", "") },
    })),
  };
}

/** Article for an idea; CollectionPage with the ideas as an ItemList (outlook-score order) for the hub. */
export function ideasArticleJsonLd(locale: Locale, id: IdeaId | null): Record<string, unknown> {
  if (!id) {
    const hub = ideasHub(locale);
    const ranked = rankedIdeas(locale);
    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: hub.h1,
      description: ideaDescription(locale, null),
      url: `${ORIGIN}${ideasHref(locale)}`,
      inLanguage: HREFLANG[locale],
      mainEntity: {
        "@type": "ItemList",
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        numberOfItems: ranked.length,
        itemListElement: ranked.map(({ id: entry }, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: ideaName(locale, entry).name,
          url: `${ORIGIN}${ideasHref(locale, entry)}`,
        })),
      },
    };
  }
  const copy = ideaCopy(locale, id);
  const url = `${ORIGIN}${ideasHref(locale, id)}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: copy.h1,
    description: copy.description,
    abstract: copy.answer.replaceAll("`", ""),
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: HREFLANG[locale],
    datePublished: ideaPublished(id),
    dateModified: ideaModified(id),
    author: PUBLISHER,
    publisher: PUBLISHER,
    isAccessibleForFree: true,
    articleSection: (ideasHub(locale).groups as Record<string, string>)[ideaGroupOf(id)],
    ...(ideaSources(locale, id).length ? { citation: ideaSources(locale, id).map((s) => ({ "@type": "CreativeWork", name: s.name, url: s.url })) } : {}),
  };
}
