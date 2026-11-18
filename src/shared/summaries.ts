/**
 * The Summaries channel under `/{locale}/summaries/{id}/` ("一口气看完" in Chinese): one well-known book, film, TV series
 * or anime per page — who is in it, what happens, how it ends and what it means. Written for "X summary / X ending
 * explained / X あらすじ / X 줄거리 / tóm tắt X / sinopsis X / resumen de X" searches. Works were chosen with Google Ads
 * Keyword Planner (2026-11-18): school classics and much-searched films and shows worldwide, plus classics each of our
 * markets reads at school (Truyện Kiều, Chí Phèo, Pedro Páramo, Laskar Pelangi, Demian).
 */
export const SUMMARIES_SEGMENT = "summaries";

export const SUMMARY_GROUPS = [
  {
    id: "books",
    entries: [
      "hamlet", "macbeth", "romeo-and-juliet", "lord-of-the-flies", "animal-farm", "nineteen-eighty-four", "to-kill-a-mockingbird",
      "the-great-gatsby", "the-little-prince", "the-metamorphosis", "the-alchemist", "three-body-problem", "truyen-kieu", "chi-pheo",
      "pedro-paramo", "laskar-pelangi", "demian",
    ],
  },
  { id: "movies", entries: ["shutter-island", "donnie-darko", "interstellar", "inception", "mulholland-drive", "tenet", "parasite"] },
  { id: "series", entries: ["stranger-things", "lost", "severance", "squid-game"] },
  { id: "anime", entries: ["attack-on-titan", "neon-genesis-evangelion", "spirited-away", "your-name", "death-note"] },
] as const;

export type SummaryGroupId = (typeof SUMMARY_GROUPS)[number]["id"];
export type SummaryId = (typeof SUMMARY_GROUPS)[number]["entries"][number];

export const SUMMARY_ENTRIES: readonly SummaryId[] = SUMMARY_GROUPS.flatMap((group) => group.entries);

/** A summaries page: the hub, one work, or none. */
export type SummaryPage = SummaryId | "hub" | null;

export function isSummaryId(value: string): value is SummaryId {
  return (SUMMARY_ENTRIES as readonly string[]).includes(value);
}

export function summaryGroupOf(id: SummaryId): SummaryGroupId {
  return SUMMARY_GROUPS.find((group) => (group.entries as readonly string[]).includes(id))!.id;
}

export const SUMMARIES_PUBLISHED = "2026-11-18";

/** Works added after the first batch, by id, with the day each went live (set by hand when adding works). */
export const SUMMARIES_ADDED: Partial<Record<SummaryId, string>> = {};

/** When a work's page went live. */
export function summaryPublished(id: SummaryId): string {
  return SUMMARIES_ADDED[id] ?? SUMMARIES_PUBLISHED;
}

/** Pages edited after they were published, for dateModified and the sitemap. */
export const SUMMARIES_UPDATED: Partial<Record<SummaryId, string>> = {};

/** The hub's own copy (src/locales/summaries/<locale>.json) last edited; set by hand. */
export const SUMMARIES_HUB_UPDATED: string | null = null;

/** When a page last changed: its edit date, else the day it went live. */
export function summaryUpdated(id: SummaryId): string {
  return SUMMARIES_UPDATED[id] ?? summaryPublished(id);
}

/** Works the site footer links directly (highest Keyword Planner volume); names are core-pack `summariesFocus.*` and must equal each locale's entry `name`. */
export const SUMMARIES_FOCUS = [
  "hamlet",
  "macbeth",
  "stranger-things",
  "lord-of-the-flies",
  "shutter-island",
  "nineteen-eighty-four",
  "the-little-prince",
  "attack-on-titan",
  "truyen-kieu",
  "squid-game",
] as const satisfies readonly SummaryId[];
