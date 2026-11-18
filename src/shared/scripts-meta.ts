import type { ScriptId } from "./scripts";
import META from "./scripts-meta.json";

// Pages read the meta from the scripts pack (`scriptMeta(locale, id)` in scripts-i18n.ts), so the JSON never lands in
// the entry bundle; SCRIPTS_META here is for tests and scripts only. Do not import it from client code.
export const SCRIPT_GENRES = ["comedy", "twist", "horror", "romance", "drama", "mystery", "sci-fi", "wholesome", "revenge", "fantasy"] as const;
export type ScriptGenre = (typeof SCRIPT_GENRES)[number];

/** How a script is played: a phone video (9:16), on a stage, as audio, or as a horizontal film. Lists and the generator have their own. */
export const SCRIPT_FORMATS = ["vertical", "stage", "audio", "screen", "list", "tool"] as const;
export type ScriptFormat = (typeof SCRIPT_FORMATS)[number];

export const SCRIPT_USES = ["shorts", "short-drama", "school", "acting-practice", "voice-drama", "youtube"] as const;
export type ScriptUse = (typeof SCRIPT_USES)[number];

export type ScriptMeta = {
  /** Speaking roles; 0 for idea lists and the generator. */
  cast: number;
  /** Roles can be any gender and the cast can grow or shrink easily. */
  flexible: boolean;
  /** Runtime in seconds; 0 for idea lists and the generator. */
  seconds: number;
  genres: ScriptGenre[];
  format: ScriptFormat;
  uses: ScriptUse[];
  /** Three other entries, closest first. */
  related: ScriptId[];
};

/** Meta per entry, merged from the authoring sidecars (tests/scripts.test.ts checks the shape). */
export const SCRIPTS_META = META as unknown as Record<ScriptId, ScriptMeta>;
