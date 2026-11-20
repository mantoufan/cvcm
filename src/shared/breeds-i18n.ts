/**
 * Breeds channel: names, facts, titles, descriptions, FAQ and JSON-LD (main bundle, for the page head). Everything it
 * reads rides in the breeds pack (breeds-store.ts), so this module stays small; page HTML is in `breeds-page.ts`, kept
 * out of the main bundle (AGENTS.md, seo.ts / seo-html.ts).
 */
import type { Locale } from "./locale";
import { fill } from "./fill";
import { PUBLISHER } from "./kb-i18n";
import { appHref, breedsHref } from "./path";
import { dataCrumbItem } from "./channel-parent";
import { HREFLANG } from "./sitemap";
import { coverUrl } from "./covers";
import { BREED_IDS, BREEDS_PUBLISHED, CAT_COUNT, DOG_COUNT, breedKindOf, breedsUpdated, type BreedId } from "./breeds";

export { breedsUpdated };
import { breedEntryMessages, breedsMessages, type BreedEntryCopy, type BreedFacts, type BreedsMessages } from "./breeds-store";

const ORIGIN = "https://cv.cm";

export type BreedImage = {
  src: string;
  width: number;
  height: number;
  author: string | null;
  creatorType: string | null;
  license: string;
  licenseUrl: string;
  page: string;
};

export type BreedsUi = BreedsMessages["ui"];

export function breedsUi(locale: Locale): BreedsUi {
  return breedsMessages(locale).ui;
}

export function breedsHub(locale: Locale): BreedsMessages["hub"] {
  return breedsMessages(locale).hub;
}

export function breedName(locale: Locale, id: BreedId): string {
  return breedsMessages(locale).names[id];
}

export function breedEnglishName(locale: Locale, id: BreedId): string {
  return breedsMessages(locale).english[id];
}

export function breedBlurb(locale: Locale, id: BreedId): string {
  return breedsMessages(locale).list[id];
}

export function breedFacts(locale: Locale, id: BreedId): BreedFacts {
  return breedsMessages(locale).data[id];
}

export function breedCopy(locale: Locale, id: BreedId): BreedEntryCopy {
  return breedEntryMessages(locale, id);
}

/** A breed's picture (src/shared/breeds-images.json, in the pack), or null. */
export function breedImage(locale: Locale, id: BreedId | null): BreedImage | null {
  if (!id) return null;
  return (breedsMessages(locale).images as Partial<Record<string, BreedImage>>)[id] ?? null;
}

/** Site path of a breed's picture (`/covers/breeds/<kind>-<slug>.webp`), or null: the page, og:image and the sitemap. */
export function breedImagePath(locale: Locale, id: BreedId | null): string | null {
  const image = breedImage(locale, id);
  return image ? `/covers/${image.src}` : null;
}

export const BREED_SIZES = ["small", "medium", "large", "giant"] as const;
export type BreedSize = (typeof BREED_SIZES)[number];

/**
 * Size group from the largest height (dogs) or weight Wikidata lists, null when it lists neither. Dogs: under 41 cm
 * small, to 57 cm medium, to 70 cm large, above giant; by weight when there is no height: under 10 kg, to 25 kg, to
 * 45 kg, above. Cats by weight: under 5 kg small, to 7 kg medium, above large. The hub copy states the same rule.
 */
export function breedSize(facts: BreedFacts, kind: "dogs" | "cats"): BreedSize | null {
  if (kind === "cats") {
    if (!facts.weight) return null;
    return facts.weight.max < 5 ? "small" : facts.weight.max <= 7 ? "medium" : "large";
  }
  if (facts.height) return facts.height.max < 41 ? "small" : facts.height.max <= 57 ? "medium" : facts.height.max <= 70 ? "large" : "giant";
  if (facts.weight) return facts.weight.max < 10 ? "small" : facts.weight.max <= 25 ? "medium" : facts.weight.max <= 45 ? "large" : "giant";
  return null;
}

export function breedsTitle(locale: Locale, id: BreedId | null): string {
  if (!id) return `${breedsHub(locale).title} — cv.cm`;
  const ui = breedsUi(locale);
  return `${fill(breedKindOf(id) === "dogs" ? ui.titleDog : ui.titleCat, { name: breedName(locale, id) })} — cv.cm`;
}

export function breedsDescription(locale: Locale, id: BreedId | null): string {
  if (!id) return fill(breedsHub(locale).description, { dogs: DOG_COUNT, cats: CAT_COUNT });
  return breedCopy(locale, id).description;
}

export function breedsFaqItems(locale: Locale, id: BreedId | null): { q: string; a: string }[] {
  if (!id) {
    const vars = { dogs: DOG_COUNT, cats: CAT_COUNT };
    return breedsHub(locale).faq.map((item) => ({ q: fill(item.q, vars), a: fill(item.a, vars) }));
  }
  return breedCopy(locale, id).faq;
}

/** A breed's sources: its English Wikipedia article, the FCI breed page, each registry standard and the Wikidata item. */
export function breedSources(locale: Locale, id: BreedId): { name: string; url: string }[] {
  const facts = breedFacts(locale, id);
  const ui = breedsUi(locale);
  const english = breedEnglishName(locale, id);
  const registries = ui.registries as Record<string, string>;
  return [
    { name: fill(ui.sourceWikipedia, { name: english }), url: facts.wikipedia },
    ...(facts.fci ? [{ name: fill(ui.sourceFci, { n: facts.fci.number }), url: facts.fci.page }] : []),
    ...facts.registries.filter((r) => r.id !== "FCI" || !facts.fci).map((r) => ({ name: fill(ui.sourceStandard, { club: registries[r.id] ?? r.id }), url: r.url })),
    { name: fill(ui.sourceWikidata, { qid: facts.qid }), url: `https://www.wikidata.org/wiki/${facts.qid}` },
  ];
}

/** ImageObject with the license fields Google Images reads (license, acquireLicensePage, creditText, creator). */
function imageJsonLd(locale: Locale, id: BreedId): Record<string, unknown> | null {
  const image = breedImage(locale, id);
  if (!image) return null;
  const url = coverUrl(breedImagePath(locale, id)!);
  const by = image.author ? `${image.author} / ` : "";
  return {
    "@type": "ImageObject",
    contentUrl: url,
    url,
    width: image.width,
    height: image.height,
    caption: fill(breedsUi(locale).imageAlt, { name: breedName(locale, id) }),
    ...(image.author && image.creatorType ? { creator: { "@type": image.creatorType, name: image.author } } : {}),
    creditText: `${by}${image.license} / Wikimedia Commons`,
    copyrightNotice: `${by}${image.license}`,
    license: image.licenseUrl,
    acquireLicensePage: image.page,
  };
}

export function breedsBreadcrumbJsonLd(locale: Locale, id: BreedId | null): Record<string, unknown> {
  const m = breedsMessages(locale);
  const items = [
    { name: m.crumbHome, item: `${ORIGIN}${appHref(locale, null)}` },
    dataCrumbItem(locale),
    { name: m.hub.h1, item: `${ORIGIN}${breedsHref(locale)}` },
  ];
  if (id) items.push({ name: breedName(locale, id), item: `${ORIGIN}${breedsHref(locale, id)}` });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, ...item })),
  };
}

export function breedsFaqJsonLd(locale: Locale, id: BreedId | null): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: breedsFaqItems(locale, id).map((item) => ({
      "@type": "Question",
      name: item.q.replaceAll("`", ""),
      acceptedAnswer: { "@type": "Answer", text: item.a.replaceAll("`", "") },
    })),
  };
}

const WIKIDATA = { "@type": "CreativeWork", name: "Wikidata", url: "https://www.wikidata.org/", license: "https://creativecommons.org/publicdomain/zero/1.0/" };

/** Article about a Thing (the breed) for a breed page; CollectionPage with an ItemList of every breed for the hub. */
export function breedsArticleJsonLd(locale: Locale, id: BreedId | null): Record<string, unknown> {
  const hub = breedsHub(locale);
  if (!id) {
    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: hub.h1,
      description: breedsDescription(locale, null),
      url: `${ORIGIN}${breedsHref(locale)}`,
      inLanguage: HREFLANG[locale],
      datePublished: BREEDS_PUBLISHED,
      dateModified: breedsUpdated(null),
      citation: [WIKIDATA],
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: BREED_IDS.length,
        itemListElement: BREED_IDS.map((breed, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: breedName(locale, breed),
          url: `${ORIGIN}${breedsHref(locale, breed)}`,
        })),
      },
    };
  }
  const copy = breedCopy(locale, id);
  const facts = breedFacts(locale, id);
  const url = `${ORIGIN}${breedsHref(locale, id)}`;
  const name = breedName(locale, id);
  const english = breedEnglishName(locale, id);
  const image = imageJsonLd(locale, id);
  const ui = breedsUi(locale);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: fill(breedKindOf(id) === "dogs" ? ui.titleDog : ui.titleCat, { name }),
    description: copy.description,
    abstract: copy.answer.replaceAll("`", ""),
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: HREFLANG[locale],
    datePublished: BREEDS_PUBLISHED,
    dateModified: breedsUpdated(id),
    author: PUBLISHER,
    publisher: PUBLISHER,
    isAccessibleForFree: true,
    articleSection: breedKindOf(id) === "dogs" ? hub.dogs : hub.cats,
    ...(image ? { image } : {}),
    about: {
      "@type": "Thing",
      name,
      ...(english !== name ? { alternateName: english } : {}),
      description: copy.answer.replaceAll("`", ""),
      sameAs: [`https://www.wikidata.org/wiki/${facts.qid}`, facts.wikipedia],
    },
    citation: breedSources(locale, id).map((s) => ({ "@type": "CreativeWork", name: s.name, url: s.url })),
  };
}
