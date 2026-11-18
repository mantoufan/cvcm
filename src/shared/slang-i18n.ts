import type { Locale } from "./locale";
import { fill } from "./fill";
import { PUBLISHER, type KbBlock } from "./kb-i18n";
import { slangEntryMessages, slangMessages, type SlangMessages } from "./messages";
import { appHref, slangHref } from "./path";
import { SLANG_ENTRIES, SLANG_META, isSong, SLANG_UPDATED, slangGroupOf, slangPublished, type SlangId } from "./slang";
import { coverUrl } from "./covers";
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

/** A song's credited artists as this locale writes them (fallbacks in `SlangArtist`). */
export function songArtists(locale: Locale, id: SlangId): string[] {
  return (SLANG_META[id].song?.by ?? []).map((artist) => {
    const names = artist.names ?? {};
    if (locale === "zh-CN") return names[locale] ?? artist.name;
    if (locale === "zh-TW" || locale === "ja") return names[locale] ?? names["zh-TW"] ?? artist.name;
    return names[locale] ?? names.en ?? artist.name;
  });
}

/**
 * Alt text and caption of an entry's picture: "<name> meme", or "<who> (<name>)" for a photo of a person: the image's
 * `who` when set, else for a song its first credited artist (named as the page names them).
 */
export function memeImageAlt(locale: Locale, id: SlangId): string {
  const name = slangName(locale, id).name;
  const who = memeImage(id)?.who;
  const named = typeof who === "string" ? who : who ? who[locale] ?? who.en : undefined;
  const person = named ?? (isSong(id) ? songArtists(locale, id)[0] : undefined);
  return person ? fill(slangUi(locale).imageAltWho, { who: person, name }) : fill(slangUi(locale).imageAlt, { name });
}

/** ImageObject with the license fields Google Images reads (license, acquireLicensePage, creditText, creator). */
function imageJsonLd(locale: Locale, id: SlangId): Record<string, unknown> | null {
  const image = memeImage(id);
  if (!image) return null;
  const url = coverUrl(memeImagePath(id)!);
  const by = image.author ? `${image.author} / ` : "";
  return {
    "@type": "ImageObject",
    contentUrl: url,
    url,
    width: image.width,
    height: image.height,
    caption: memeImageAlt(locale, id),
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

/**
 * Article about a DefinedTerm (a song: about a MusicRecording) for an entry; for the hub, a CollectionPage whose main
 * entity is the DefinedTermSet of the terms, with the songs as `hasPart`.
 */
export function slangArticleJsonLd(locale: Locale, id: SlangId | null): Record<string, unknown> {
  if (!id) {
    const hub = slangHub(locale);
    const songs = SLANG_ENTRIES.filter(isSong);
    const terms = SLANG_ENTRIES.filter((entry) => !isSong(entry));
    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: hub.h1,
      description: slangDescription(locale, null),
      url: `${ORIGIN}${slangHref(locale)}`,
      inLanguage: HREFLANG[locale],
      mainEntity: {
        ...termSetRef(locale),
        hasDefinedTerm: terms.map((entry) => ({
          "@type": "DefinedTerm",
          name: slangName(locale, entry).name,
          url: `${ORIGIN}${slangHref(locale, entry)}`,
        })),
      },
      // The song pages are part of the collection too: pages about a recording, not terms.
      hasPart: songs.map((entry) => ({
        "@type": "WebPage",
        url: `${ORIGIN}${slangHref(locale, entry)}`,
        about: { "@type": "MusicRecording", name: slangName(locale, entry).name },
      })),
    };
  }
  const copy = slangCopy(locale, id);
  const url = `${ORIGIN}${slangHref(locale, id)}`;
  const answer = copy.answer.replaceAll("`", "");
  const image = imageJsonLd(locale, id);
  const song = SLANG_META[id].song;
  const artists = songArtists(locale, id);
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
      name: copy.name,
      description: answer,
      ...(copy.aka.length ? { alternateName: copy.aka } : {}),
      ...(song
        ? { "@type": "MusicRecording", byArtist: song.by.map((artist, i) => ({ "@type": artist.type, name: artists[i] })) }
        : { "@type": "DefinedTerm", inDefinedTermSet: termSetRef(locale) }),
    },
    ...(SLANG_META[id].sources.length ? { citation: SLANG_META[id].sources.map((s) => ({ "@type": "CreativeWork", name: s.name, url: s.url })) } : {}),
  };
}
