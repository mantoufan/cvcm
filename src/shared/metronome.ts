export const MIN_BPM = 20;
export const MAX_BPM = 300;
export const BEATS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12] as const;

export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return 120;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

/** Seconds between clicks for `bpm` with `subdivision` clicks per beat. */
export function clickInterval(bpm: number, subdivision = 1): number {
  return 60 / clampBpm(bpm) / subdivision;
}

/** Italian tempo marking for a BPM (common modern ranges). */
export function tempoName(bpm: number): string {
  const b = clampBpm(bpm);
  if (b < 40) return "Grave";
  if (b < 60) return "Largo";
  if (b < 66) return "Larghetto";
  if (b < 76) return "Adagio";
  if (b < 108) return "Andante";
  if (b < 120) return "Moderato";
  if (b < 156) return "Allegro";
  if (b < 176) return "Vivace";
  if (b < 200) return "Presto";
  return "Prestissimo";
}

/** A gap longer than this starts a new tap sequence (20 BPM is 3000 ms a beat). */
export const TAP_RESET_MS = 3500;

/** BPM from tap times (ms, ascending): mean of the last up to 4 intervals; null until two taps. */
export function tapBpm(times: readonly number[]): number | null {
  const recent = times.slice(-5);
  if (recent.length < 2) return null;
  const span = recent[recent.length - 1] - recent[0];
  if (span <= 0) return null;
  return clampBpm((60000 * (recent.length - 1)) / span);
}
