/** The meter's floor in dBFS; quieter input reads as silence. */
export const METER_FLOOR_DB = -60;

/** Root mean square of float samples (−1…1). */
export function rms(samples: ArrayLike<number>): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

/** Level in dBFS (0 = full scale), never below the meter floor. */
export function toDbfs(level: number): number {
  if (!(level > 0)) return METER_FLOOR_DB;
  return Math.max(METER_FLOOR_DB, Math.min(0, 20 * Math.log10(level)));
}

/** Meter fill 0–100 for a dBFS value. */
export function meterPercent(db: number): number {
  return Math.round(((Math.min(0, Math.max(METER_FLOOR_DB, db)) - METER_FLOOR_DB) / -METER_FLOOR_DB) * 100);
}

/** What the peak says about the microphone: nothing, quiet (below −20 dBFS), good, or too loud (from −3 dBFS, close to clipping). */
export function levelVerdict(peakDb: number): "silent" | "quiet" | "good" | "loud" {
  if (peakDb <= -55) return "silent";
  if (peakDb < -20) return "quiet";
  if (peakDb >= -3) return "loud";
  return "good";
}
