export type DurationSum = { text: string; totalSeconds: number };

/** Parse H:MM:SS. Minutes and seconds must be 0–59. Hours may be large. */
export function parseDuration(raw: string): number | null {
  const text = raw.trim();
  const match = text.match(/^(\d+):([0-5]?\d):([0-5]?\d)$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (minutes > 59 || seconds > 59) return null;
  if (hours > 1_000_000) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

export function formatDuration(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? "-" : "";
  let rest = Math.abs(totalSeconds);
  const hours = Math.floor(rest / 3600);
  rest -= hours * 3600;
  const minutes = Math.floor(rest / 60);
  const seconds = rest - minutes * 60;
  return `${sign}${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function durationBetween(aRaw: string, bRaw: string, subtract: boolean): DurationSum | null {
  const a = parseDuration(aRaw);
  const b = parseDuration(bRaw);
  if (a == null || b == null) return null;
  const totalSeconds = subtract ? a - b : a + b;
  return { text: formatDuration(totalSeconds), totalSeconds };
}
