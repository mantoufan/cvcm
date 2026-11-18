/**
 * The Scripts channel under `/{locale}/scripts/{id}/` ("灵感剧本库" in Chinese): original short scripts anyone may film or
 * perform (vertical shorts, short-drama episodes, stage skits, duets and monologues), lists of video ideas by niche,
 * and a plot / video idea generator. Picked with Google Ads Keyword Planner (2026-11-18): outside English the demand
 * is for free scripts to perform ("naskah drama 5 orang", "obras de teatro cortas", "フリー台本", "2인 대본"); in English
 * also for idea lists ("youtube video ideas", "prank ideas") and generators ("plot generator").
 */
export const SCRIPTS_SEGMENT = "scripts";

export const SCRIPT_GROUPS = [
  {
    id: "shorts",
    entries: [
      "wrong-order-delivery", "the-last-slice", "first-day-at-a-new-job", "the-elevator-stranger", "text-from-future-me",
      "grandma-reviews-gadgets", "the-lost-dog-poster", "silent-library", "the-five-second-rule", "the-mirror-blinked",
    ],
  },
  {
    id: "drama",
    entries: ["the-intern-is-the-ceo", "contract-marriage", "the-real-daughter-comes-home", "second-chance", "the-delivery-rider-heir", "my-roommate-is-a-ghost"],
  },
  {
    id: "skits",
    entries: [
      "the-group-project", "the-worst-job-interview", "the-time-machine-class", "family-dinner-chaos", "haunted-school-night",
      "the-honest-salesman", "who-stole-the-lunch", "the-last-day-of-school",
    ],
  },
  {
    id: "duets",
    entries: ["the-breakup-scene", "the-apology", "first-date-or-interview", "letter-to-my-father", "the-alarm-clock", "night-radio-call"],
  },
  {
    id: "ideas",
    entries: [
      "youtube-shorts-ideas-for-beginners", "faceless-video-ideas", "couple-video-ideas", "cooking-video-ideas", "fitness-video-ideas",
      "pet-video-ideas", "gaming-video-ideas", "small-business-video-ideas",
    ],
  },
  { id: "tools", entries: ["plot-generator"] },
] as const;

export type ScriptGroupId = (typeof SCRIPT_GROUPS)[number]["id"];
export type ScriptId = (typeof SCRIPT_GROUPS)[number]["entries"][number];

export const SCRIPT_ENTRIES: readonly ScriptId[] = SCRIPT_GROUPS.flatMap((group) => group.entries);

/** What an entry's page is: a script to film or perform, a list of ideas, or the generator. */
export type ScriptEntryKind = "script" | "ideas" | "generator";

export function scriptEntryKind(id: ScriptId): ScriptEntryKind {
  const group = scriptGroupOf(id);
  return group === "ideas" ? "ideas" : group === "tools" ? "generator" : "script";
}

/** A scripts page: the hub, one entry, or none. */
export type ScriptPage = ScriptId | "hub" | null;

export function isScriptId(value: string): value is ScriptId {
  return (SCRIPT_ENTRIES as readonly string[]).includes(value);
}

export function scriptGroupOf(id: ScriptId): ScriptGroupId {
  return SCRIPT_GROUPS.find((group) => (group.entries as readonly string[]).includes(id))!.id;
}

export const SCRIPTS_PUBLISHED = "2026-11-18";

/** Entries added after the first batch, by id, with the day each went live (set by hand when adding entries). */
export const SCRIPTS_ADDED: Partial<Record<ScriptId, string>> = {};

export function scriptPublished(id: ScriptId): string {
  return SCRIPTS_ADDED[id] ?? SCRIPTS_PUBLISHED;
}

/** Pages edited after they were published, for dateModified and the sitemap. */
export const SCRIPTS_UPDATED: Partial<Record<ScriptId, string>> = {};

/** The hub's own copy (src/locales/scripts/<locale>.json) last edited; set by hand. */
export const SCRIPTS_HUB_UPDATED: string | null = null;

export function scriptUpdated(id: ScriptId): string {
  return SCRIPTS_UPDATED[id] ?? scriptPublished(id);
}

/** Entries the site footer links directly; names are core-pack `scriptsFocus.*` and must equal each locale's entry `name`. */
export const SCRIPTS_FOCUS = [
  "plot-generator",
  "youtube-shorts-ideas-for-beginners",
  "the-group-project",
  "the-breakup-scene",
  "the-intern-is-the-ceo",
  "wrong-order-delivery",
] as const satisfies readonly ScriptId[];
