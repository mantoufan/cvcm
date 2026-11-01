/** Test lengths offered by the click speed test, in seconds. */
export const CLICK_DURATIONS = [1, 5, 10, 30, 60] as const;
export const DEFAULT_CLICK_DURATION = 5;

/** Clicks per second over the elapsed time, to two decimals; 0 before any time has passed. */
export function clicksPerSecond(clicks: number, elapsedMs: number): number {
  if (!(clicks > 0) || !(elapsedMs > 0)) return 0;
  return Math.round((clicks / (elapsedMs / 1000)) * 100) / 100;
}

/** A rough band for a CPS result: under 5 is relaxed, 5–8 typical, 8–11 fast, 11+ very fast (jitter or butterfly clicking). */
export function cpsBand(cps: number): "slow" | "typical" | "fast" | "veryFast" {
  if (cps >= 11) return "veryFast";
  if (cps >= 8) return "fast";
  if (cps >= 5) return "typical";
  return "slow";
}
