/**
 * Loaded breed copy and data. The client registers the breeds pack (hub copy, names, blurbs, facts) and the one breed
 * chunk a page needs before it renders; the Worker, tests and the prerender register everything (breeds-all.ts).
 * Kept out of messages.ts so the channel adds no code to the shared message store.
 */
import type { Locale } from "./locale";
import type { BreedId } from "./breeds";
import type { KbBlock } from "./kb-i18n";

/** A range as Wikidata gives it (both ends equal for a single value). */
export type BreedRange = { min: number; max: number };

/** A registry whose breed standard the English Wikipedia infobox links (the link was opened when the data was fetched). */
export type BreedRegistry = { id: string; url: string };

/** Language-neutral facts per breed, src/shared/breeds-data.json (`node scripts/fetch-breeds.mjs`). Null = not in Wikidata. */
export type BreedFacts = {
  qid: string;
  /** ISO 3166-1 alpha-2 codes of the countries of origin (names from Intl). */
  origin: string[];
  fci: { number: number; group: number; page: string } | null;
  /** Height at the withers in cm. */
  height: BreedRange | null;
  /** Weight in kg. */
  weight: BreedRange | null;
  /** Life expectancy in years. */
  life: BreedRange | null;
  registries: BreedRegistry[];
  wikipedia: string;
};

/** One breed's copy, `src/locales/breeds/<locale>/<kind>/<slug>.json`. Blocks are the kb blocks. */
export type BreedEntryCopy = {
  blurb: string;
  description: string;
  answer: string;
  sections: { h: string; body: KbBlock[] }[];
  faq: { q: string; a: string }[];
};

export type BreedsMessages = typeof import("../locales/breeds/en.json") & {
  /** Names in this locale (Wikidata / Wikipedia, see scripts/fetch-breeds.mjs). */
  names: Record<BreedId, string>;
  /** English names, shown next to the local name and used as search keywords. */
  english: Record<BreedId, string>;
  /** Each breed's one-line blurb in this locale (`npm run breeds:sync`), so lists load no breed chunk. */
  list: Record<BreedId, string>;
  /** Every breed's names in all eight locales, lower case (`npm run breeds:sync`): the hub search matches any of them. */
  words: Record<BreedId, string>;
  data: Record<BreedId, BreedFacts>;
  /** src/shared/breeds-images.json: a breed's Commons picture, where one passed the licence and content checks. */
  images: Partial<Record<BreedId, import("./breeds-i18n").BreedImage>>;
};

const packs: Partial<Record<Locale, BreedsMessages>> = {};
const entries: Partial<Record<Locale, Partial<Record<BreedId, BreedEntryCopy>>>> = {};

export function registerBreedsMessages(locale: Locale, pack: BreedsMessages): void {
  packs[locale] = pack;
}

export function hasBreedsMessages(locale: Locale): boolean {
  return Boolean(packs[locale]);
}

/** Breeds copy, names and facts; on the client only after the breeds pack is loaded (breed pages). */
export function breedsMessages(locale: Locale): BreedsMessages {
  const pack = packs[locale] ?? packs.en;
  if (!pack) throw new Error(`breeds messages not loaded: ${locale}`);
  return pack;
}

export function registerBreedEntry(locale: Locale, id: BreedId, copy: BreedEntryCopy): void {
  (entries[locale] ??= {})[id] = copy;
}

export function hasBreedEntry(locale: Locale, id: BreedId): boolean {
  return Boolean(entries[locale]?.[id]);
}

export function breedEntryMessages(locale: Locale, id: BreedId): BreedEntryCopy {
  const copy = entries[locale]?.[id] ?? entries.en?.[id];
  if (!copy) throw new Error(`breed not loaded: ${locale} ${id}`);
  return copy;
}
