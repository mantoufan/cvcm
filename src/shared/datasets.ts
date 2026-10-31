// Public data tables (`/{locale}/datasets/{id}/`). Rows are snapshots in `src/data/*.json`, written by
// `scripts/fetch-datasets.mjs` together with the CSV downloads in `public/datasets/`. Pages never call the
// source APIs. Copy lives in `src/locales/datasets/<locale>.json`.
import meta from "../data/meta.json";
import indicatorSpec from "./indicators.json";
import type { ToolId } from "./path";

/** `/data/` is the JSON / CSV converter, so the column lives under `/datasets/`. */
export const DATASET_SEGMENT = "datasets";

export const DATASET_GROUPS = [
  { id: "economy", sets: ["gdp", "gdp-per-capita", "gdp-ppp-per-capita", "gdp-growth", "inflation", "unemployment", "exports", "imports", "female-labor-force"] },
  { id: "people", sets: ["population", "population-growth", "population-density", "urban-population", "aged-65-plus", "life-expectancy", "life-expectancy-female", "life-expectancy-male", "fertility-rate", "birth-rate", "death-rate", "infant-mortality", "maternal-mortality", "health-spending-per-capita"] },
  { id: "planet", sets: ["land-area", "forest-area", "co2-per-capita", "renewable-energy", "electricity-access", "internet-users"] },
  { id: "codes", sets: ["country-codes", "calling-codes", "currency-codes", "time-zones"] },
  { id: "reference", sets: ["paper-sizes", "ascii"] },
] as const;

export type DatasetGroupId = (typeof DATASET_GROUPS)[number]["id"];
export type DatasetId = (typeof DATASET_GROUPS)[number]["sets"][number];
export const DATASETS: readonly DatasetId[] = DATASET_GROUPS.flatMap((group) => [...group.sets]);

export function isDatasetId(value: string): value is DatasetId {
  return (DATASETS as readonly string[]).includes(value);
}

export function datasetGroupOf(id: DatasetId): DatasetGroupId {
  return DATASET_GROUPS.find((group) => (group.sets as readonly string[]).includes(id))!.id;
}

/**
 * World Bank indicators: one value per country, ranked. `indicators.json` is the one list: the fetch script
 * reads the same file. `decimals` is both the stored and the shown precision; `total` adds a share-of-world
 * column; `format` "usd" / "usd-compact" shows US dollars.
 */
export type IndicatorSpec = { code: string; decimals: number; format?: "usd" | "usd-compact"; total?: boolean; maxAge?: number; floor?: number; skip?: string[]; why?: string };
export const INDICATOR_SPEC = indicatorSpec as Record<keyof typeof indicatorSpec, IndicatorSpec>;
export type IndicatorId = keyof typeof indicatorSpec;
export const INDICATORS = Object.keys(INDICATOR_SPEC) as IndicatorId[];

export function isIndicator(id: DatasetId): id is DatasetId & IndicatorId {
  return id in INDICATOR_SPEC;
}

export const WB_CODE = Object.fromEntries(INDICATORS.map((id) => [id, INDICATOR_SPEC[id].code])) as Record<IndicatorId, string>;

export type DatasetSource = { name: string; url: string; license: string; licenseUrl: string };

const WORLD_BANK = (code: string): DatasetSource => ({
  name: "World Bank, World Development Indicators",
  url: `https://data.worldbank.org/indicator/${code}`,
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
});
const PUBLIC_DOMAIN = "https://opendatacommons.org/licenses/pddl/1-0/";

export const DATASET_SOURCE: Record<DatasetId, DatasetSource> = {
  ...(Object.fromEntries(INDICATORS.map((id) => [id, WORLD_BANK(WB_CODE[id])])) as Record<IndicatorId, DatasetSource>),
  "country-codes": { name: "ISO 3166-1 (via datahub.io core/country-codes)", url: "https://www.iso.org/iso-3166-country-codes.html", license: "ODC-PDDL", licenseUrl: PUBLIC_DOMAIN },
  "calling-codes": { name: "ITU-T E.164 (via datahub.io core/country-codes)", url: "https://www.itu.int/pub/T-SP-E.164D", license: "ODC-PDDL", licenseUrl: PUBLIC_DOMAIN },
  "currency-codes": { name: "ISO 4217 (via datahub.io core/currency-codes)", url: "https://www.iso.org/iso-4217-currency-codes.html", license: "ODC-PDDL", licenseUrl: PUBLIC_DOMAIN },
  "time-zones": { name: "IANA Time Zone Database", url: "https://www.iana.org/time-zones", license: "Public domain", licenseUrl: "https://www.iana.org/time-zones" },
  "paper-sizes": { name: "ISO 216, ISO 269, JIS P 0138, ANSI/ASME Y14.1", url: "https://www.iso.org/standard/36631.html", license: "Public domain", licenseUrl: PUBLIC_DOMAIN },
  ascii: { name: "ANSI X3.4-1986 (US-ASCII)", url: "https://www.rfc-editor.org/rfc/rfc20", license: "Public domain", licenseUrl: PUBLIC_DOMAIN },
};

/** Tools a reader of the table may want next. */
export const DATASET_TOOLS: Partial<Record<DatasetId, readonly ToolId[]>> = {
  population: ["percent"],
  gdp: ["percent", "compound"],
  "gdp-per-capita": ["hourly", "compound"],
  "life-expectancy": ["age", "days"],
  "fertility-rate": ["percent"],
  "internet-users": ["percent"],
  "gdp-ppp-per-capita": ["hourly", "compound"],
  "gdp-growth": ["compound", "percent"],
  inflation: ["compound", "percent", "loan"],
  unemployment: ["percent", "hourly"],
  "land-area": ["units", "percent"],
  "population-density": ["units", "percent"],
  "urban-population": ["percent"],
  "aged-65-plus": ["age", "percent"],
  "birth-rate": ["due-date", "ovulation"],
  "infant-mortality": ["percent"],
  "co2-per-capita": ["fuel-cost", "electricity"],
  "electricity-access": ["electricity", "percent"],
  "population-growth": ["percent", "compound"],
  "death-rate": ["age", "percent"],
  "life-expectancy-male": ["age", "days"],
  "life-expectancy-female": ["age", "days"],
  "maternal-mortality": ["due-date", "percent"],
  "exports": ["percent", "vat"],
  "imports": ["percent", "vat"],
  "health-spending-per-capita": ["percent", "compound"],
  "female-labor-force": ["hourly", "percent"],
  "forest-area": ["units", "percent"],
  "renewable-energy": ["electricity", "percent"],
  "country-codes": ["data", "json"],
  "calling-codes": ["qr"],
  "currency-codes": ["vat", "margin"],
  "time-zones": ["timezone", "timestamp"],
  "paper-sizes": ["resize", "aspect", "units"],
  ascii: ["binary", "text-hex", "url-encode"],
};

/** Summary of the snapshot: row counts, years, top and bottom rows. Small enough for the Worker's head tags. */
export type IndicatorMeta = {
  rows: number;
  from: number;
  to: number;
  sourceUpdated: string;
  world: [number, number] | null;
  /** [iso2, value, English name, year] */
  top: [string, number, string, number][];
  bottom: [string, number, string, number][];
};
/** `west` / `east`: the extreme UTC offsets in minutes (time zones only). */
export type DatasetMeta = { rows: number; year?: number; tzdata?: string | null; west?: number; east?: number } & Partial<IndicatorMeta>;

export const DATASET_SNAPSHOT: string = meta.updated;

export function datasetMeta(id: DatasetId): DatasetMeta {
  return (meta.sets as unknown as Record<DatasetId, DatasetMeta>)[id];
}

export function indicatorMeta(id: IndicatorId): IndicatorMeta {
  return datasetMeta(id) as IndicatorMeta;
}

/** Row files in `src/data/` each table reads (the currency table names its users from the country list). */
export const DATASET_FILES: Record<DatasetId, readonly string[]> = {
  ...(Object.fromEntries(INDICATORS.map((id) => [id, [id] as readonly string[]])) as Record<IndicatorId, readonly string[]>),
  "country-codes": ["countries"],
  "calling-codes": ["countries"],
  "currency-codes": ["currencies", "countries"],
  "time-zones": ["time-zones"],
  "paper-sizes": ["paper-sizes"],
  ascii: ["ascii"],
};

export function csvHref(id: DatasetId): string {
  return `/${DATASET_SEGMENT}/${id}.csv`;
}

// --- Rows -------------------------------------------------------------------

/** [iso2, iso3, value, year, English name], sorted by value, largest first. */
export type IndicatorRow = [string, string, number, number, string];
/** [alpha2, alpha3, numeric, tld, continent, dial codes ("+1-809, +1-829"), currencies ("INR,BTN"), English name] */
export type CountryRow = [string, string, string, string, string, string, string, string];
/** [code, numeric, minor unit (null for funds and metals), alpha2 users, English name] */
export type CurrencyRow = [string, string, number | null, string[], string];
/** [IANA id, offset in minutes on 15 Jan, on 15 Jul, alpha2 from zone.tab] */
export type ZoneRow = [string, number, number, string];
/** [name, series, width mm, height mm] */
export type PaperRow = [string, string, number, number];
/** [code, character or control abbreviation, control name] */
export type AsciiRow = [number, string, string];

export type DatasetRows = IndicatorRow[] | CountryRow[] | CurrencyRow[] | ZoneRow[] | PaperRow[] | AsciiRow[];
