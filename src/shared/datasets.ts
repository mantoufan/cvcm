// Public data tables (`/{locale}/datasets/{id}/`). Rows are snapshots in `src/data/*.json`, written by
// `scripts/fetch-datasets.mjs` together with the CSV downloads in `public/datasets/`. Pages never call the
// source APIs. Copy lives in `src/locales/datasets/<locale>.json`.
import meta from "../data/meta.json";
import type { ToolId } from "./path";

/** `/data/` is the JSON / CSV converter, so the column lives under `/datasets/`. */
export const DATASET_SEGMENT = "datasets";

export const DATASET_GROUPS = [
  { id: "economy", sets: ["gdp", "gdp-per-capita", "gdp-ppp-per-capita", "gdp-growth", "inflation", "unemployment"] },
  { id: "people", sets: ["population", "population-density", "urban-population", "aged-65-plus", "life-expectancy", "fertility-rate", "birth-rate", "infant-mortality"] },
  { id: "planet", sets: ["land-area", "co2-per-capita", "electricity-access", "internet-users"] },
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

/** World Bank indicators: one value per country, ranked. */
export const INDICATORS = [
  "population", "gdp", "gdp-per-capita", "life-expectancy", "fertility-rate", "internet-users",
  "gdp-ppp-per-capita", "gdp-growth", "inflation", "unemployment", "land-area", "population-density",
  "urban-population", "aged-65-plus", "birth-rate", "infant-mortality", "co2-per-capita", "electricity-access",
] as const;
export type IndicatorId = (typeof INDICATORS)[number];

export function isIndicator(id: DatasetId): id is IndicatorId {
  return (INDICATORS as readonly string[]).includes(id);
}

export const WB_CODE: Record<IndicatorId, string> = {
  population: "SP.POP.TOTL",
  gdp: "NY.GDP.MKTP.CD",
  "gdp-per-capita": "NY.GDP.PCAP.CD",
  "life-expectancy": "SP.DYN.LE00.IN",
  "fertility-rate": "SP.DYN.TFRT.IN",
  "internet-users": "IT.NET.USER.ZS",
  "gdp-ppp-per-capita": "NY.GDP.PCAP.PP.CD",
  "gdp-growth": "NY.GDP.MKTP.KD.ZG",
  inflation: "FP.CPI.TOTL.ZG",
  unemployment: "SL.UEM.TOTL.ZS",
  "land-area": "AG.LND.TOTL.K2",
  "population-density": "EN.POP.DNST",
  "urban-population": "SP.URB.TOTL.IN.ZS",
  "aged-65-plus": "SP.POP.65UP.TO.ZS",
  "birth-rate": "SP.DYN.CBRT.IN",
  "infant-mortality": "SP.DYN.IMRT.IN",
  "co2-per-capita": "EN.GHG.CO2.PC.CE.AR5",
  "electricity-access": "EG.ELC.ACCS.ZS",
};

export type DatasetSource = { name: string; url: string; license: string; licenseUrl: string };

const WORLD_BANK = (code: string): DatasetSource => ({
  name: "World Bank, World Development Indicators",
  url: `https://data.worldbank.org/indicator/${code}`,
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
});
const PUBLIC_DOMAIN = "https://opendatacommons.org/licenses/pddl/1-0/";

export const DATASET_SOURCE: Record<DatasetId, DatasetSource> = {
  population: WORLD_BANK(WB_CODE.population),
  gdp: WORLD_BANK(WB_CODE.gdp),
  "gdp-per-capita": WORLD_BANK(WB_CODE["gdp-per-capita"]),
  "life-expectancy": WORLD_BANK(WB_CODE["life-expectancy"]),
  "fertility-rate": WORLD_BANK(WB_CODE["fertility-rate"]),
  "internet-users": WORLD_BANK(WB_CODE["internet-users"]),
  "gdp-ppp-per-capita": WORLD_BANK(WB_CODE["gdp-ppp-per-capita"]),
  "gdp-growth": WORLD_BANK(WB_CODE["gdp-growth"]),
  inflation: WORLD_BANK(WB_CODE["inflation"]),
  unemployment: WORLD_BANK(WB_CODE["unemployment"]),
  "land-area": WORLD_BANK(WB_CODE["land-area"]),
  "population-density": WORLD_BANK(WB_CODE["population-density"]),
  "urban-population": WORLD_BANK(WB_CODE["urban-population"]),
  "aged-65-plus": WORLD_BANK(WB_CODE["aged-65-plus"]),
  "birth-rate": WORLD_BANK(WB_CODE["birth-rate"]),
  "infant-mortality": WORLD_BANK(WB_CODE["infant-mortality"]),
  "co2-per-capita": WORLD_BANK(WB_CODE["co2-per-capita"]),
  "electricity-access": WORLD_BANK(WB_CODE["electricity-access"]),
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
  population: ["population"],
  gdp: ["gdp"],
  "gdp-per-capita": ["gdp-per-capita"],
  "life-expectancy": ["life-expectancy"],
  "fertility-rate": ["fertility-rate"],
  "internet-users": ["internet-users"],
  "gdp-ppp-per-capita": ["gdp-ppp-per-capita"],
  "gdp-growth": ["gdp-growth"],
  inflation: ["inflation"],
  unemployment: ["unemployment"],
  "land-area": ["land-area"],
  "population-density": ["population-density"],
  "urban-population": ["urban-population"],
  "aged-65-plus": ["aged-65-plus"],
  "birth-rate": ["birth-rate"],
  "infant-mortality": ["infant-mortality"],
  "co2-per-capita": ["co2-per-capita"],
  "electricity-access": ["electricity-access"],
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
