import { parseIsoDate, todayIso } from "./age";
import { MAX_YEAR, MIN_YEAR, addDays } from "./due-date";

export const DEFAULT_CYCLE = 28;
export const MIN_CYCLE = 21;
export const MAX_CYCLE = 45;
/** The luteal phase (ovulation to next period) is about 14 days; the variable part of a cycle comes before ovulation. */
export const LUTEAL_DAYS = 14;
const DAY = 86400000;
/** Projecting more than a year of cycles from one date is guesswork; ask for the most recent period instead. */
export const MAX_ELAPSED_DAYS = 365;

export type OvulationCycle = {
  periodStart: Date;
  ovulation: Date;
  /** The five days before ovulation plus ovulation day (Wilcox et al., 1995): sperm survive up to five days, the egg about one. */
  fertileStart: Date;
  fertileEnd: Date;
  nextPeriod: Date;
};

/** The next `count` cycles from the first day of the last period, starting with the first whose fertile window has not ended by `today`. */
export function ovulationCycles(lastPeriodIso: string, cycle = DEFAULT_CYCLE, count = 3, todayIsoStr = todayIso()): OvulationCycle[] | null {
  const lmp = parseIsoDate(lastPeriodIso);
  const today = parseIsoDate(todayIsoStr);
  if (!lmp || !today || !Number.isInteger(cycle) || cycle < MIN_CYCLE || cycle > MAX_CYCLE) return null;
  if (lmp.getUTCFullYear() < MIN_YEAR || lmp.getUTCFullYear() > MAX_YEAR) return null;
  const elapsed = Math.floor((today.getTime() - lmp.getTime()) / DAY);
  // A last period in the future, or more than a year back, is a typo (often the year), not a basis for a forecast.
  if (elapsed < 0 || elapsed > MAX_ELAPSED_DAYS) return null;
  // Start at the cycle that contains today, then skip it too if its fertile window has already ended.
  let skip = Math.floor(elapsed / cycle);
  const ovulationDay = cycle - LUTEAL_DAYS;
  if (elapsed - skip * cycle > ovulationDay) skip += 1;
  const out: OvulationCycle[] = [];
  for (let i = 0; i < count; i++) {
    const periodStart = addDays(lmp, (skip + i) * cycle);
    const ovulation = addDays(periodStart, cycle - LUTEAL_DAYS);
    out.push({
      periodStart,
      ovulation,
      fertileStart: addDays(ovulation, -5),
      fertileEnd: ovulation,
      nextPeriod: addDays(periodStart, cycle),
    });
  }
  return out;
}

