import { coverUrl } from "./covers";
import type { Locale } from "./locale";
import { PUBLISHER, type KbBlock } from "./kb-i18n";
import { refEntryMessages, refMessages, type RefMessages } from "./messages";
import { appHref, refHref } from "./path";
import { REF_GROUPS, REF_MANNEQUINS, REF_PUBLISHED, REF_UPDATED, refGroupOf, refMannequinUrl, type RefId } from "./ref";
import { HREFLANG } from "./sitemap";

/** One entry's copy, `src/locales/ref/<locale>/<id>.json`. Blocks are the kb blocks (backticks are the only inline markup). */
export type RefEntryCopy = {
  name: string;
  blurb: string;
  aka: string[];
  /** Without the " — cv.cm" suffix (refTitle adds it). */
  title: string;
  description: string;
  h1: string;
  answer: string;
  sections: { h: string; body: KbBlock[] }[];
  faq: { q: string; a: string }[];
};

/** A photo on mfan8.com: image id on s1.mtf6.com, the photo set's page id, its size, and who made it. */
export type RefPhoto = { img: string; item: string; w: number; h: number; photo?: string; model?: string };

const ORIGIN = "https://cv.cm";
export type RefUi = RefMessages["ui"];

export function refHub(locale: Locale): RefMessages["hub"] {
  return refMessages(locale).hub;
}

export function refCopy(locale: Locale, id: RefId): RefEntryCopy {
  return refEntryMessages(locale, id);
}

/** Name and one-line blurb from the ref pack (`npm run ref:sync`), so lists never load entry chunks. */
export function refName(locale: Locale, id: RefId): { name: string; blurb: string } {
  return refMessages(locale).list[id];
}

export function refTitle(locale: Locale, id: RefId | null): string {
  return `${id ? refCopy(locale, id).title : refHub(locale).title} — cv.cm`;
}

export function refDescription(locale: Locale, id: RefId | null): string {
  return id ? refCopy(locale, id).description : refHub(locale).description;
}

export function refFaqItems(locale: Locale, id: RefId | null): { q: string; a: string }[] {
  return id ? refCopy(locale, id).faq : refHub(locale).faq;
}

export const CC0_URL = "https://creativecommons.org/publicdomain/zero/1.0/";
export const SHISEI_URL = "https://github.com/wquguru/shisei";
/** Rights metadata for the Shisei line art: CC0, licence page pinned to the commit the files came from (docs/ref-mannequins.md). */
const SHISEI_IMAGE_META = {
  creator: { "@type": "Person", name: "wquguru", url: "https://github.com/wquguru" },
  creditText: "Shisei",
  copyrightNotice: "Shisei by wquguru, dedicated to the public domain under CC0 1.0",
  license: CC0_URL,
  acquireLicensePage: `${SHISEI_URL}/tree/26522a708c77088eda4631327b15d8d05f6281c0`,
} as const;

export function refBreadcrumbJsonLd(locale: Locale, id: RefId | null): Record<string, unknown> {
  const m = refMessages(locale);
  const items = [
    { name: m.crumbHome, item: `${ORIGIN}${appHref(locale, null)}` },
    { name: m.hub.h1, item: `${ORIGIN}${refHref(locale)}` },
  ];
  if (id) items.push({ name: refName(locale, id).name, item: `${ORIGIN}${refHref(locale, id)}` });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, ...item })),
  };
}

export function refFaqJsonLd(locale: Locale, id: RefId | null): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: refFaqItems(locale, id).map((item) => ({
      "@type": "Question",
      name: item.q.replaceAll("`", ""),
      acceptedAnswer: { "@type": "Answer", text: item.a.replaceAll("`", "") },
    })),
  };
}

/** Article (with the look as a DefinedTerm and its CC0 mannequins as ImageObjects; third-party photos are left out) for an entry; CollectionPage + ItemList for the hub. */
export function refArticleJsonLd(locale: Locale, id: RefId | null): Record<string, unknown> {
  if (!id) {
    const hub = refHub(locale);
    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: hub.h1,
      description: hub.description,
      url: `${ORIGIN}${refHref(locale)}`,
      inLanguage: HREFLANG[locale],
      mainEntity: {
        "@type": "ItemList",
        itemListElement: REF_GROUPS.flatMap((group) => group.entries).map((entry, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${ORIGIN}${refHref(locale, entry)}`,
          name: refName(locale, entry).name,
        })),
      },
    };
  }
  const copy = refCopy(locale, id);
  const url = `${ORIGIN}${refHref(locale, id)}`;
  const mannequins = (REF_MANNEQUINS[id] ?? []).map((angle) => ({
    "@type": "ImageObject",
    contentUrl: coverUrl(refMannequinUrl(id, angle, 900)),
    ...SHISEI_IMAGE_META,
  }));
  // Only cv.cm's own CC0 mannequins are article images. Third-party mfan8 photos stay out of the
  // structured data: we can't state their rights, so we don't offer them as this page's images.
  const images = mannequins;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: copy.h1,
    description: copy.description,
    abstract: copy.answer.replaceAll("`", ""),
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: HREFLANG[locale],
    datePublished: REF_PUBLISHED,
    dateModified: REF_UPDATED[id] ?? REF_PUBLISHED,
    author: PUBLISHER,
    publisher: PUBLISHER,
    isAccessibleForFree: true,
    articleSection: (refHub(locale).groups as Record<string, string>)[refGroupOf(id)],
    about: { "@type": "DefinedTerm", name: refName(locale, id).name, ...(copy.aka.length ? { alternateName: copy.aka } : {}) },
    ...(images.length ? { image: images } : {}),
  };
}
