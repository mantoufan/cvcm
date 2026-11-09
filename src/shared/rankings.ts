// Rankings column (`/{locale}/rankings/{id}/`). Rows are snapshots written by `scripts/fetch-rankings.mjs`: the rows
// (`rankings-rows.json`) load only on a ranking page, the summary (`rankings-meta.json`) is small enough for the head
// tags. Pages never call the sources. Copy lives under `rankings` in `src/locales/datasets/<locale>.json`.
import meta from "./rankings-meta.json";
import type { ToolId } from "./path";

export const RANKING_SEGMENT = "rankings";

export const RANKING_GROUPS = [
  { id: "ai", sets: ["ai-models", "ai-coding-models", "ai-image-models", "ai-video-models", "ai-usage", "ai-companies"] },
  { id: "share", sets: ["browser-market-share", "os-market-share", "search-engine-market-share", "phone-market-share", "social-media-market-share"] },
  { id: "markets", sets: ["crypto-market-cap", "commodity-prices", "currency-strength"] },
  { id: "geography", sets: ["tallest-mountains", "longest-rivers", "largest-lakes", "largest-islands"] },
] as const;

export type RankingGroupId = (typeof RANKING_GROUPS)[number]["id"];
export type RankingId = (typeof RANKING_GROUPS)[number]["sets"][number];
export const RANKINGS: readonly RankingId[] = RANKING_GROUPS.flatMap((group) => [...group.sets]);

export function isRankingId(value: string): value is RankingId {
  return (RANKINGS as readonly string[]).includes(value);
}

export function rankingGroupOf(id: RankingId): RankingGroupId {
  return RANKING_GROUPS.find((group) => (group.sets as readonly string[]).includes(id))!.id;
}

/** The rows chunk a ranking page preloads: each geography table (names in eight languages) is its own; the rest share one. */
export function rankingRowsChunk(id: RankingId): string {
  return rankingGroupOf(id) === "geography" ? `rows-ranking-${id}` : "rows-rankings";
}

export type RankingKind = "arena" | "usage" | "companies" | "share" | "crypto" | "commodity" | "fx" | "mountain" | "river" | "lake" | "island";

export function rankingKind(id: RankingId): RankingKind {
  if (id === "ai-usage") return "usage";
  if (id === "ai-companies") return "companies";
  if (id === "crypto-market-cap") return "crypto";
  if (id === "commodity-prices") return "commodity";
  if (id === "currency-strength") return "fx";
  if (id === "tallest-mountains") return "mountain";
  if (id === "longest-rivers") return "river";
  if (id === "largest-lakes") return "lake";
  if (id === "largest-islands") return "island";
  return rankingGroupOf(id) === "ai" ? "arena" : "share";
}

export type RankingSource = { name: string; url: string; license: string; licenseUrl: string };
const CC_BY = "https://creativecommons.org/licenses/by/4.0/";
const ARENA: RankingSource = { name: "Arena leaderboard dataset", url: "https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset", license: "CC BY 4.0", licenseUrl: CC_BY };
const OPENROUTER: RankingSource = { name: "OpenRouter rankings", url: "https://openrouter.ai/rankings", license: "CC BY 4.0", licenseUrl: CC_BY };
const wikipediaList = (page: string): RankingSource => ({ name: `Wikipedia: ${page.replace(/_/g, " ")}`, url: `https://en.wikipedia.org/wiki/${page}`, license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" });
const statCounter = (path: string): RankingSource => ({ name: "StatCounter Global Stats", url: `https://gs.statcounter.com/${path}`, license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/" });

export const RANKING_SOURCE: Record<RankingId, RankingSource> = {
  "ai-models": ARENA,
  "ai-coding-models": ARENA,
  "ai-image-models": ARENA,
  "ai-video-models": ARENA,
  "ai-usage": OPENROUTER,
  "ai-companies": OPENROUTER,
  "browser-market-share": statCounter("browser-market-share"),
  "os-market-share": statCounter("os-market-share"),
  "search-engine-market-share": statCounter("search-engine-market-share"),
  "phone-market-share": statCounter("vendor-market-share/mobile"),
  "social-media-market-share": statCounter("social-media-stats"),
  // CoinMarketCap's licence covers showing the data on cv.cm, not passing it on: no CSV for this table.
  "crypto-market-cap": { name: "CoinMarketCap", url: "https://coinmarketcap.com/", license: "CoinMarketCap API terms", licenseUrl: "https://coinmarketcap.com/api/" },
  "commodity-prices": { name: "World Bank Commodity Price Data (The Pink Sheet)", url: "https://www.worldbank.org/en/research/commodity-markets", license: "CC BY 4.0", licenseUrl: CC_BY },
  "longest-rivers": wikipediaList("List_of_river_systems_by_length"),
  "largest-lakes": wikipediaList("List_of_lakes_by_area"),
  "largest-islands": wikipediaList("List_of_islands_by_area"),
  "tallest-mountains": { name: "Wikidata", url: "https://www.wikidata.org/", license: "CC0 1.0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/" },
  "currency-strength": { name: "ECB euro foreign exchange reference rates", url: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html", license: "Reuse with source named", licenseUrl: "https://www.ecb.europa.eu/services/disclaimer/html/index.en.html" },
};

/** cv.cm tools a reader of the table may want next. */
export const RANKING_TOOLS: Partial<Record<RankingId, readonly ToolId[]>> = {
  "commodity-prices": ["gold", "silver", "platinum", "oil"],
};

/** Tables whose source allows showing but not redistributing the rows. */
export const NO_CSV: ReadonlySet<RankingId> = new Set<RankingId>(["crypto-market-cap"]);

/** The markets a share table compares, after the world column: the countries cv.cm's languages mostly reach. */
export const RANKING_REGIONS = ["US", "CN", "TW", "JP", "KR", "VN", "ID", "ES"] as const;
export type RankingRegion = (typeof RANKING_REGIONS)[number];

export type RankingMeta = {
  asOf: string;
  /** The last date this table's rows changed. */
  updated: string;
  rows: number;
  /** [name, value] of the first three rows. */
  top: [string, number][];
  /** Arena only: the organization with the most places in the top ten. */
  leadOrg?: string;
  leadCount?: number;
  /** Share only: the same month a year before, and each market's first place. */
  yearAgo?: string;
  leaders?: Record<"ww" | RankingRegion, [string, number]>;
  /** Commodities and currencies: the last three, worst first. */
  bottom?: [string, number][];
  /** Crypto: total market cap of the listed coins, and Bitcoin's share of all crypto. */
  total?: number;
  dominance?: number;
  /** Currencies: the dates the changes are measured from (`yearAgo` also above). */
  monthAgo?: string;
  /** Mountains: rows are Wikidata ids, named here for the head tags; peaks of 8,000 m or more; the country with the most peaks. */
  names?: Record<string, LocaleNames>;
  over8000?: number;
  /** Mountains: the place of the last row, which shares a place with the one above when they are the same height. */
  lowRank?: number;
  /** Geography: the month the rows were last asked for (asOf is the month they last changed). */
  checked?: string;
  /** Wikipedia lists: the revision the rows were read from. */
  revision?: number;
  countryLead?: string[];
  countryCount?: number;
};

/** Kilometres to miles and square kilometres to square miles, rounded to the unit. */
export function toMiles(km: number): number {
  return Math.round(km / 1.609344);
}
export function toSqMiles(km2: number): number {
  return Math.round(km2 / 2.589988110336);
}

/** Metres to feet, rounded to the foot, for the table and the copy alike. */
export function toFeet(metres: number): number {
  return Math.round(metres / 0.3048);
}

export const RANKING_SNAPSHOT: string = meta.updated;

export function rankingMeta(id: RankingId): RankingMeta {
  return (meta.sets as unknown as Record<RankingId, RankingMeta>)[id];
}

export function rankingCsvHref(id: RankingId): string | null {
  return NO_CSV.has(id) ? null : `/${RANKING_SEGMENT}/${id}.csv`;
}

/** [rank, model, organization, licence, score, votes] */
export type ArenaRow = [number, string, string, string, number, number];
/** [rank, model, author, tokens over the last 7 days, share of all OpenRouter tokens in percent] */
export type UsageRow = [number, string, string, number, number];
/** [rank, company, tokens over the last 7 days, share of all OpenRouter tokens in percent, models named by OpenRouter] */
export type CompanyRow = [number, string, number, number, number];
/** [rank, name, world a year ago (null when it was not listed), world, ...RANKING_REGIONS] in percent */
export type ShareRow = [number, string, number | null, number, ...number[]];
/** [rank, name, symbol, price USD, 24h change %, 7-day change %, market cap USD, 24h volume USD]; a new coin can lack a change or volume (null). */
export type CryptoRow = [number, string, string, number, number | null, number | null, number, number | null];
/** [rank, commodity id, unit, latest monthly price USD, 1-month change %, 12-month change %] */
export type CommodityRow = [number, string, string, number, number, number];
/** A name by cv.cm locale; a locale left out reads the English one. */
export type LocaleNames = Record<string, string>;
/** [rank, Wikidata id, names, elevation m, prominence m, ISO 3166 countries (empty when Wikidata names none), range names (null likewise)] */
export type MountainRow = [number, string, LocaleNames, number, number, string[], LocaleNames | null];
/** A country column entry: an ISO 3166 code, or the names of a state without one (the Danish Realm). */
export type CountryRef = string | LocaleNames;
/** [rank, Wikidata id, names, length km, countries in the basin, the whole river system in English (null for a single river)] */
export type RiverRow = [number, string, LocaleNames, number, CountryRef[], string | null];
/** [rank, Wikidata id, names, area km², countries on the shore, max depth m (null if unlisted), water] */
export type LakeRow = [number, string, LocaleNames, number, CountryRef[], number | null, "fresh" | "saline" | "variable"];
/** [rank, Wikidata id ("" for an island the list does not link), names, area km², countries] */
export type IslandRow = [number, string, LocaleNames, number, CountryRef[]];
/** [rank, ISO 4217 code, units per US dollar, change vs USD over 1 month %, over 1 year %] */
export type FxRow = [number, string, number, number, number];
