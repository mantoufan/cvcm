/** Tries in one reaction time round. */
export const REACTION_TRIES = 5;
export const MIN_WAIT_MS = 1500;
export const MAX_WAIT_MS = 4500;
/** Faster than this is a guess, not a reaction (visual reactions take well over 100 ms), so it counts as too soon. */
export const MIN_REACTION_MS = 80;

/** Random wait before the pad turns green, from a uniform 0–1 value (Web Crypto in the page, fixed in tests). */
export function waitMs(unit: number): number {
  const u = Math.min(1, Math.max(0, Number.isFinite(unit) ? unit : 0));
  return Math.round(MIN_WAIT_MS + u * (MAX_WAIT_MS - MIN_WAIT_MS));
}

export type ReactionSummary = { average: number; median: number; best: number; worst: number };

/** Average, median, best and worst of the recorded times in ms (rounded), or null when there are none. */
export function summarize(times: readonly number[]): ReactionSummary | null {
  const list = times.filter((x) => Number.isFinite(x) && x >= 0);
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const sum = list.reduce((a, b) => a + b, 0);
  return { average: Math.round(sum / list.length), median: Math.round(median), best: Math.round(sorted[0]), worst: Math.round(sorted[sorted.length - 1]) };
}

/** A rough band for an average visual reaction time with a mouse or touch screen. */
export function reactionBand(ms: number): "fast" | "typical" | "slow" {
  if (ms < 200) return "fast";
  if (ms <= 300) return "typical";
  return "slow";
}
