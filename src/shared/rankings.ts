// Rankings column (`/{locale}/rankings/{id}/`). Rows are snapshots written by `scripts/fetch-rankings.mjs`: the rows
// (`rankings-rows.json`) load only on a ranking page, the summary (`rankings-meta.json`) is small enough for the head
// tags. Pages never call the sources. Copy lives under `rankings` in `src/locales/datasets/<locale>.json`.
import meta from "./rankings-meta.json";

export const RANKING_SEGMENT = "rankings";

export const RANKING_GROUPS = [
  { id: "ai", sets: ["ai-models", "ai-coding-models", "ai-image-models", "ai-video-models", "ai-usage", "ai-companies"] },
  { id: "share", sets: ["browser-market-share", "os-market-share", "search-engine-market-share", "phone-market-share", "social-media-market-share"] },
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

export type RankingKind = "arena" | "usage" | "companies" | "share";

export function rankingKind(id: RankingId): RankingKind {
  if (id === "ai-usage") return "usage";
  if (id === "ai-companies") return "companies";
  return rankingGroupOf(id) === "ai" ? "arena" : "share";
}

export type RankingSource = { name: string; url: string; license: string; licenseUrl: string };
const CC_BY = "https://creativecommons.org/licenses/by/4.0/";
const ARENA: RankingSource = { name: "Arena leaderboard dataset", url: "https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset", license: "CC BY 4.0", licenseUrl: CC_BY };
const OPENROUTER: RankingSource = { name: "OpenRouter rankings", url: "https://openrouter.ai/rankings", license: "CC BY 4.0", licenseUrl: CC_BY };
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
};

/** The markets a share table compares, after the world column: the countries cv.cm's languages mostly reach. */
export const RANKING_REGIONS = ["US", "CN", "TW", "JP", "KR", "VN", "ID", "ES"] as const;
export type RankingRegion = (typeof RANKING_REGIONS)[number];

export type RankingMeta = {
  asOf: string;
  rows: number;
  /** [name, value] of the first three rows. */
  top: [string, number][];
  /** Arena only: the organization with the most places in the top ten. */
  leadOrg?: string;
  leadCount?: number;
  /** Share only: the same month a year before, and each market's first place. */
  yearAgo?: string;
  leaders?: Record<"ww" | RankingRegion, [string, number]>;
};

export const RANKING_SNAPSHOT: string = meta.updated;

export function rankingMeta(id: RankingId): RankingMeta {
  return (meta.sets as unknown as Record<RankingId, RankingMeta>)[id];
}

export function rankingCsvHref(id: RankingId): string {
  return `/${RANKING_SEGMENT}/${id}.csv`;
}

/** [rank, model, organization, licence, score, votes] */
export type ArenaRow = [number, string, string, string, number, number];
/** [rank, model, author, tokens, share of the listed models' tokens in percent, requests] */
export type UsageRow = [number, string, string, number, number, number];
/** [rank, company, tokens, share of the listed models' tokens in percent, models listed] */
export type CompanyRow = [number, string, number, number, number];
/** [rank, name, world a year ago (null when it was not listed), world, ...RANKING_REGIONS] in percent */
export type ShareRow = [number, string, number | null, number, ...number[]];
export type RankingRows = Record<RankingId, ArenaRow[] | UsageRow[] | CompanyRow[] | ShareRow[]>;
