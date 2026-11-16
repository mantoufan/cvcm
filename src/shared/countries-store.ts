/**
 * Loaded country copy and data. The client registers the countries pack (copy + `summary`) and the one data bucket a
 * page needs before it renders; the Worker, tests and the prerender register everything (countries-all.ts).
 */
import type { Locale } from "./locale";

/** [value, year, world rank (ties share a rank, 1 = highest)] */
export type CountryFigure = [number, number, number];

/** What lists need about every country, from src/shared/countries/summary.json (`npm run countries:sync`). */
export type CountrySummary = {
  /** The World Bank's English name: the fallback when Intl has no name (Channel Islands). */
  en: string;
  /** Continent code (AF AN AS EU NA OC SA). */
  c: string;
  flag: boolean;
  /** Capital names by locale (none where it is disputed). */
  cap: Partial<Record<Locale, string>>[];
  pop?: CountryFigure;
};

export type CountriesSummary = {
  updated: string;
  /** Rows in each World Bank table: the "of N" after a rank. */
  rows: Record<string, number>;
  countries: Record<string, CountrySummary>;
};

/** Everything else a profile shows, from src/shared/countries/b<n>.json. */
export type CountryDetail = {
  a3?: string;
  num?: string;
  tld?: string;
  /** "+1-809, +1-829" */
  dial?: string;
  cur?: string[];
  /** [IANA id, UTC offset in minutes on 15 Jan, on 15 Jul] */
  tz: [string, number, number][];
  v: Record<string, CountryFigure>;
  /** Rankings on cv.cm that list this country, with how many of their rows do. */
  rk: Record<string, number>;
};

export type CountriesMessages = typeof import("../locales/countries/en.json") & { summary: CountriesSummary };

const packs: Partial<Record<Locale, CountriesMessages>> = {};
const details = new Map<string, CountryDetail>();
const buckets = new Set<number>();

export function registerCountriesMessages(locale: Locale, pack: CountriesMessages): void {
  packs[locale] = pack;
}

export function hasCountriesMessages(locale: Locale): boolean {
  return Boolean(packs[locale]);
}

/** Countries copy and the summary; on the client only after the countries pack is loaded (country pages). */
export function countriesMessages(locale: Locale): CountriesMessages {
  const pack = packs[locale] ?? packs.en;
  if (!pack) throw new Error(`countries messages not loaded: ${locale}`);
  return pack;
}

export function registerCountryBucket(bucket: number, data: Record<string, CountryDetail>): void {
  buckets.add(bucket);
  for (const [code, detail] of Object.entries(data)) details.set(code, detail);
}

export function hasCountryBucket(bucket: number): boolean {
  return buckets.has(bucket);
}

export function countryDetail(code: string): CountryDetail {
  const detail = details.get(code);
  if (!detail) throw new Error(`country data not loaded: ${code}`);
  return detail;
}
