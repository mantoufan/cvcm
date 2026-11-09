/** Online alarm clock maths: next time a wall-clock alarm rings, and how long until then. */

/** "07:30" → minutes after midnight; null when not HH:MM in 00:00–23:59. */
export function parseClock(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** The next local Date at that clock time, strictly after now (today if still ahead, else tomorrow). */
export function nextAlarm(now: Date, minutes: number): Date {
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(minutes / 60), minutes % 60, 0, 0);
  if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);
  // A clock time skipped by a DST jump lands an hour later; that is what the clock on the wall will show.
  return at;
}

/** "7:05:09" / "05:09" countdown text from milliseconds (rounded up to whole seconds). */
export function remainingText(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}

/** Hours and minutes until the alarm, for "Rings in 7 h 30 min". */
export function untilParts(ms: number): { h: number; m: number } {
  const mins = Math.max(0, Math.ceil(ms / 60000));
  return { h: Math.floor(mins / 60), m: mins % 60 };
}

export const SNOOZE_MINUTES = [5, 10] as const;
export const SOUNDS = ["beep", "chime", "bell", "digital"] as const;
export type AlarmSound = (typeof SOUNDS)[number];
/** Stop ringing on its own after this long, like a phone alarm. */
export const RING_LIMIT_MS = 10 * 60 * 1000;
