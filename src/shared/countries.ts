/**
 * Country profiles under `/{locale}/countries/{slug}/`: flag, capital, population, GDP, currency, calling code, time
 * zones and every World Bank figure the data tables have, each with its world rank and a link to its /datasets/ table.
 * Pages exist for every economy with World Bank figures (the dataset tables' rows, the same list and names they use).
 * Data is built offline by `npm run countries:sync` (scripts/countries-sync.mjs) from src/data/ and the Wikidata
 * capitals snapshot; this module holds only the slugs, so the main bundle stays small.
 */
import index from "./countries-index.json";

export const COUNTRIES_SEGMENT = "countries";

/** URL slug → ISO 3166-1 alpha-2 code (XK Kosovo and JG Channel Islands are World Bank codes). Slugs never change. */
export const COUNTRY_SLUGS: Readonly<Record<string, string>> = index.slugs;
export const COUNTRY_LIST: readonly string[] = Object.keys(COUNTRY_SLUGS);
const CODE_SLUG = new Map(Object.entries(COUNTRY_SLUGS).map(([slug, code]) => [code, slug]));

/** The date the country data last changed (any table a page reads, the capitals or the flags): the sitemap lastmod. */
export const COUNTRIES_UPDATED: string = index.updated;

/** A country page: the hub, one country (its slug), or none. */
export type CountryPage = string | "hub" | null;

export function isCountrySlug(value: string): boolean {
  return Object.hasOwn(COUNTRY_SLUGS, value);
}

export function countryCode(slug: string): string {
  return COUNTRY_SLUGS[slug];
}

export function countrySlug(code: string): string | undefined {
  return CODE_SLUG.get(code);
}

/** Linked from the site footer (names come from Intl, so no copy is needed). The most searched profiles. */
export const COUNTRIES_FOCUS: readonly string[] = ["japan", "china", "united-states", "australia", "south-korea", "vietnam", "india"];

/** The data chunk (`src/shared/countries/b<n>.json`) holding a country's figures, as countries:sync wrote it. */
export function countryBucket(code: string): number {
  return (index.bucket as Record<string, number>)[code];
}
