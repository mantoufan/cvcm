/** Refresh rates displays commonly run at, in Hz. */
export const STANDARD_RATES = [24, 30, 48, 50, 60, 72, 75, 85, 90, 100, 120, 144, 165, 170, 175, 180, 200, 240, 280, 300, 360, 480, 500, 540] as const;

/** Frame gaps longer than this (ms) are pauses (a hidden tab, a busy page), not frames. */
export const MAX_FRAME_MS = 250;

/** Median of the usable frame intervals in ms; 0 when there are none. */
export function medianInterval(intervals: readonly number[]): number {
  const v = intervals.filter((x) => Number.isFinite(x) && x > 0 && x <= MAX_FRAME_MS).sort((a, b) => a - b);
  if (!v.length) return 0;
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/**
 * Mean of the steady frame intervals (within half and 1.5 times the median), in ms; 0 when there are none.
 * The mean, not the median, because many browsers round frame times to whole ms: at 240 Hz (4.17 ms) the
 * intervals read 4, 4, 5, 4, … and only their average gives the true rate.
 */
export function steadyInterval(intervals: readonly number[]): number {
  const median = medianInterval(intervals);
  if (!median) return 0;
  const steady = intervals.filter((x) => x >= median * 0.5 && x < median * 1.5);
  return steady.length ? steady.reduce((a, b) => a + b, 0) / steady.length : median;
}

/** Frames per second for a frame interval, to one decimal. */
export function hzFromInterval(ms: number): number {
  if (!(ms > 0)) return 0;
  return Math.round((1000 / ms) * 10) / 10;
}

/** The standard rate within 4% of a measurement, or null. */
export function nearestStandardRate(hz: number): number | null {
  if (!(hz > 0)) return null;
  let best: number | null = null;
  for (const r of STANDARD_RATES) {
    if (Math.abs(hz - r) / r <= 0.04 && (best === null || Math.abs(hz - r) < Math.abs(hz - best))) best = r;
  }
  return best;
}

/** Frames that took at least 1.5 intervals: the screen showed the previous frame again (a skipped frame). */
export function countSkipped(intervals: readonly number[], median: number): number {
  if (!(median > 0)) return 0;
  return intervals.filter((x) => x >= median * 1.5 && x <= MAX_FRAME_MS).length;
}
