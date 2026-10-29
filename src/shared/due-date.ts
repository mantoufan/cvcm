import { parseIsoDate, todayIso } from "./age";

export type DueDateMode = "lmp" | "conception" | "due";
export const DEFAULT_CYCLE = 28;
export const MIN_CYCLE = 20;
export const MAX_CYCLE = 45;
/** Naegele's rule: 280 days from the first day of the last period for a 28-day cycle. */
export const PREGNANCY_DAYS = 280;
const DAY = 86400000;

export type DueDateResult = {
  due: Date;
  lmp: Date;
  conception: Date;
  trimester2: Date;
  trimester3: Date;
  /** Days since LMP on `today`, may be negative or past 280. */
  daysAlong: number;
  weeks: number;
  days: number;
  trimester: 1 | 2 | 3 | null;
  daysLeft: number;
};

function addDays(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
}

export function isoOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * `date` is the LMP, the conception date, or the known due date depending on `mode`.
 * Cycle length shifts ovulation: a 32-day cycle moves everything 4 days later.
 */
export function dueDate(mode: DueDateMode, dateIso: string, cycle = DEFAULT_CYCLE, todayIsoStr = todayIso()): DueDateResult | null {
  const date = parseIsoDate(dateIso);
  const today = parseIsoDate(todayIsoStr);
  if (!date || !today || !Number.isInteger(cycle) || cycle < MIN_CYCLE || cycle > MAX_CYCLE) return null;
  const shift = cycle - DEFAULT_CYCLE;
  // A longer cycle ovulates later, so gestation effectively starts `shift` days after the real LMP.
  // One adjusted LMP drives the due date, conception, weeks along and trimester dates, so they agree.
  let start: Date;
  if (mode === "lmp") start = addDays(date, shift);
  else if (mode === "conception") start = addDays(date, -14);
  else start = addDays(date, -PREGNANCY_DAYS);
  const lmp = addDays(start, -shift);
  const due = addDays(start, PREGNANCY_DAYS);
  const conception = addDays(start, 14);
  const daysAlong = Math.round((today.getTime() - start.getTime()) / DAY);
  const weeks = Math.floor(daysAlong / 7);
  const trimester = daysAlong < 0 || daysAlong > PREGNANCY_DAYS + 21 ? null : weeks < 13 ? 1 : weeks < 27 ? 2 : 3;
  return {
    due,
    lmp,
    conception,
    trimester2: addDays(start, 13 * 7),
    trimester3: addDays(start, 27 * 7),
    daysAlong,
    weeks,
    days: daysAlong - weeks * 7,
    trimester,
    daysLeft: Math.round((due.getTime() - today.getTime()) / DAY),
  };
}
