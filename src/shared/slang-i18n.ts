import type { Locale } from "./locale";
import { fill } from "./fill";
import { PUBLISHER, type KbBlock } from "./kb-i18n";
import { slangEntryMessages, slangMessages, type SlangMessages } from "./messages";
import { appHref, slangHref } from "./path";
import { SLANG_ENTRIES, SLANG_GROUPS, SLANG_META, SLANG_UPDATED, slangGroupOf, slangPublished, type SlangId } from "./slang";
import { memeImage, memeImagePath } from "./meme-images";
import { HREFLANG } from "./sitemap";

/** One entry's copy, `src/locales/slang/<locale>/<id>.json`. Blocks are the kb blocks (backticks are the only inline markup). */
export type SlangEntryCopy = {
  name: string;
  blurb: string;
  aka: string[];
  /** Without the " — cv.cm" suffix (slangTitle adds it). */
  title: string;
  description: string;
  h1: string;
  answer: string;
  sections: { h: string; body: KbBlock[] }[];
  faq: { q: string; a: string }[];
};

const ORIGIN = "https://cv.cm";

export type SlangUi = SlangMessages["ui"];

export function slangUi(locale: Locale): SlangUi {
  return slangMessages(locale).ui;
}

export function slangHub(locale: Locale): SlangMessages["hub"] {
  return slangMessages(locale).hub;
}

export function slangCopy(locale: Locale, id: SlangId): SlangEntryCopy {
  return slangEntryMessages(locale, id);
}

/** Name and one-line blurb from the slang pack (`npm run slang:sync`), so lists never load entry chunks. */
export function slangName(locale: Locale, id: SlangId): { name: string; blurb: string } {
  return slangMessages(locale).list[id];
}

export function slangTitle(locale: Locale, id: SlangId | null): string {
  return `${id ? slangCopy(locale, id).title : slangHub(locale).title} — cv.cm`;
}

export function slangDescription(locale: Locale, id: SlangId | null): string {
  return id ? slangCopy(locale, id).description : fill(slangHub(locale).description, { n: SLANG_ENTRIES.length });
}

export function slangFaqItems(locale: Locale, id: SlangId | null): { q: string; a: string }[] {
  return id ? slangCopy(locale, id).faq : slangHub(locale).faq;
}

export function slangUpdated(id: SlangId): string {
  return SLANG_UPDATED[id] ?? slangPublished(id);
}

/** ImageObject with the license fields Google Images reads (license, acquireLicensePage, creditText, creator). */
function imageJsonLd(locale: Locale, id: SlangId): Record<string, unknown> | null {
  const image = memeImage(id);
  if (!image) return null;
  const name = slangName(locale, id).name;
  const url = `${ORIGIN}${memeImagePath(id)}`;
  const by = image.author ? `${image.author} / ` : "";
  return {
    "@type": "ImageObject",
    contentUrl: url,
    url,
    width: image.width,
    height: image.height,
    caption: fill(slangUi(locale).imageAlt, { name }),
    ...(image.author && image.creatorType ? { creator: { "@type": image.creatorType, name: image.author } } : {}),
    creditText: `${by}${image.license} / Wikimedia Commons`,
    copyrightNotice: `${by}${image.license}`,
    license: image.licenseUrl,
    acquireLicensePage: image.page,
  };
}

/** Daily snapshot from `scripts/fetch-meme.mjs`: weekly Wikipedia views per entry and coins named after a meme. */
export type MemeTrend = { w: number[]; to: string };

export type MemeDir = "up" | "flat" | "down";

export type MemeCoin = { cmc: number; slug: string; symbol: string; name: string; price: number; cap: number; d1: number; d7: number; added: string; rank: number | null };

export type MemeData = { trend: Record<string, MemeTrend>; coins: Record<string, MemeCoin>; coinsAsOf: string | null };

/** The snapshot comes with the slang pack (not the main bundle, which it would re-hash every day). */
export function memeData(locale: Locale): MemeData {
  return slangMessages(locale).memes;
}

/**
 * Coin prices are never shown in Simplified Chinese: mainland rules (PBoC et al. 2021 notice) bar commercial display and
 * promotion of virtual currencies, and most zh-CN readers are in the mainland.
 */
export function showsCoins(locale: Locale): boolean {
  return locale !== "zh-CN";
}

export function memeTrend(locale: Locale, id: SlangId): MemeTrend | null {
  const t = memeData(locale).trend[id];
  return t && t.w.length && t.w.some((v) => v > 0) ? t : null;
}

/** Views over the last four weeks of a trend (the figure the page shows and the trending list weighs). */
export function recentViews(trend: MemeTrend): number {
  return trend.w.slice(-4).reduce((a, b) => a + b, 0);
}

/** Views over the four weeks before those. */
function priorViews(trend: MemeTrend): number {
  return trend.w.slice(-8, -4).reduce((a, b) => a + b, 0);
}

/** Rising when the last four weeks are a quarter above the four before, cooling off when a fifth below, else steady. */
export function memeDir(trend: MemeTrend): MemeDir {
  const recent = recentViews(trend);
  const before = priorViews(trend);
  // No views before (a new or renamed article): nothing to compare with, so not "rising".
  if (before === 0) return "flat";
  return recent >= before * 1.25 ? "up" : recent <= before * 0.8 ? "down" : "flat";
}

export function memeCoin(locale: Locale, id: SlangId): MemeCoin | null {
  return showsCoins(locale) ? memeData(locale).coins[id] ?? null : null;
}

/** An article needs this many views in four weeks to count as trending, so a tiny article's jump is not news. */
const TRENDING_FLOOR = 500;

/**
 * The hub's "popularity now" list: entries not cooling off, fastest-growing first (last four weeks over the four before).
 * Growth, not raw views, so memes measured on a smaller Wikipedia (zh) compete fairly with English ones; each keeps its
 * own rising/steady badge, so the list never claims a steady meme is rising.
 */
export function trendingIds(locale: Locale, limit: number): { id: SlangId; trend: MemeTrend; dir: MemeDir }[] {
  return SLANG_ENTRIES
    .flatMap((id) => {
      const trend = memeTrend(locale, id);
      if (!trend) return [];
      const recent = recentViews(trend);
      const prior = priorViews(trend);
      const dir = memeDir(trend);
      // Both windows need real traffic: a tiny or brand-new article's jump is not news.
      return recent >= TRENDING_FLOOR && prior >= TRENDING_FLOOR / 5 && dir !== "down" ? [{ id, trend, dir, recent, growth: recent / prior }] : [];
    })
    .sort((a, b) => b.growth - a.growth || b.recent - a.recent)
    .slice(0, limit)
    .map(({ id, trend, dir }) => ({ id, trend, dir }));
}

export function slangLinkItems(locale: Locale, ids: readonly SlangId[]): { href: string; name: string; blurb: string; nav: string }[] {
  return ids.map((id) => ({ href: slangHref(locale, id), ...slangName(locale, id), nav: `slang-${id}` }));
}

export function slangBreadcrumbJsonLd(locale: Locale, id: SlangId | null): Record<string, unknown> {
  const m = slangMessages(locale);
  const items = [
    { name: m.crumbHome, item: `${ORIGIN}${appHref(locale, null)}` },
    { name: m.hub.h1, item: `${ORIGIN}${slangHref(locale)}` },
  ];
  if (id) items.push({ name: slangName(locale, id).name, item: `${ORIGIN}${slangHref(locale, id)}` });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, ...item })),
  };
}

export function slangFaqJsonLd(locale: Locale, id: SlangId | null): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: slangFaqItems(locale, id).map((item) => ({
      "@type": "Question",
      name: item.q.replaceAll("`", ""),
      acceptedAnswer: { "@type": "Answer", text: item.a.replaceAll("`", "") },
    })),
  };
}

/** The dictionary as a DefinedTermSet (its id is the hub URL), so every entry's DefinedTerm can point back to it. */
function termSetRef(locale: Locale): Record<string, unknown> {
  return { "@type": "DefinedTermSet", "@id": `${ORIGIN}${slangHref(locale)}#terms`, name: slangHub(locale).h1 };
}

/** Article about a DefinedTerm for an entry; CollectionPage whose main entity is the DefinedTermSet for the hub. */
export function slangArticleJsonLd(locale: Locale, id: SlangId | null): Record<string, unknown> {
  if (!id) {
    const hub = slangHub(locale);
    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: hub.h1,
      description: slangDescription(locale, null),
      url: `${ORIGIN}${slangHref(locale)}`,
      inLanguage: HREFLANG[locale],
      mainEntity: {
        ...termSetRef(locale),
        hasDefinedTerm: SLANG_GROUPS.flatMap((group) => group.entries).map((entry) => ({
          "@type": "DefinedTerm",
          name: slangName(locale, entry).name,
          url: `${ORIGIN}${slangHref(locale, entry)}`,
        })),
      },
    };
  }
  const copy = slangCopy(locale, id);
  const url = `${ORIGIN}${slangHref(locale, id)}`;
  const answer = copy.answer.replaceAll("`", "");
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
    datePublished: slangPublished(id),
    dateModified: slangUpdated(id),
    author: PUBLISHER,
    publisher: PUBLISHER,
    isAccessibleForFree: true,
    articleSection: (slangHub(locale).groups as Record<string, string>)[slangGroupOf(id)],
    ...(image ? { image } : {}),
    about: {
      "@type": "DefinedTerm",
      name: copy.name,
      description: answer,
      ...(copy.aka.length ? { alternateName: copy.aka } : {}),
      inDefinedTermSet: termSetRef(locale),
    },
    ...(SLANG_META[id].sources.length ? { citation: SLANG_META[id].sources.map((s) => ({ "@type": "CreativeWork", name: s.name, url: s.url })) } : {}),
  };
}
