/** One sleep cycle (light → deep → REM) averages about 90 minutes. */
export const CYCLE_MIN = 90;
/** The average adult takes about 14 minutes to fall asleep. */
export const FALL_ASLEEP_MIN = 14;
export const MIN_CYCLES = 3;
export const MAX_CYCLES = 6;
export const MINUTES_PER_DAY = 1440;

export type SleepSlot = { cycles: number; minutes: number; sleepMin: number };

/** "HH:MM" (24-hour) → minutes since midnight, or null when malformed. */
export function parseClock(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return hh * 60 + mm;
}

export function formatClock(minutes: number): string {
  const m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Bedtimes that let you wake at `wake` after 6 down to 3 whole cycles, plus the time to fall asleep. */
export function bedtimesFor(wake: number): SleepSlot[] {
  const out: SleepSlot[] = [];
  for (let cycles = MAX_CYCLES; cycles >= MIN_CYCLES; cycles--) {
    const sleepMin = cycles * CYCLE_MIN;
    out.push({ cycles, minutes: (wake - FALL_ASLEEP_MIN - sleepMin + MINUTES_PER_DAY * 2) % MINUTES_PER_DAY, sleepMin });
  }
  return out;
}

/** Wake-up times if you go to bed at `bed` now and sleep 3 to 6 whole cycles. */
export function wakeTimesFor(bed: number): SleepSlot[] {
  const out: SleepSlot[] = [];
  for (let cycles = MIN_CYCLES; cycles <= MAX_CYCLES; cycles++) {
    const sleepMin = cycles * CYCLE_MIN;
    out.push({ cycles, minutes: (bed + FALL_ASLEEP_MIN + sleepMin) % MINUTES_PER_DAY, sleepMin });
  }
  return out;
}

/** "7.5 h" style hours for a slot. */
export function hoursOf(sleepMin: number): number {
  return Math.round((sleepMin / 60) * 10) / 10;
}
