import { parseIsoDate, todayIso } from "./age";
import { MAX_YEAR, MIN_YEAR, addDays } from "./due-date";

export const DEFAULT_CYCLE = 28;
export const MIN_CYCLE = 21;
export const MAX_CYCLE = 45;
/** The luteal phase (ovulation to next period) is about 14 days; the variable part of a cycle comes before ovulation. */
export const LUTEAL_DAYS = 14;
const DAY = 86400000;

export type OvulationCycle = {
  periodStart: Date;
  ovulation: Date;
  /** The five days before ovulation plus ovulation day (Wilcox et al., 1995): sperm survive up to five days, the egg about one. */
  fertileStart: Date;
  fertileEnd: Date;
  nextPeriod: Date;
};

/** The next `count` cycles from the first day of the last period, starting with the cycle that contains `today` or later. */
export function ovulationCycles(lastPeriodIso: string, cycle = DEFAULT_CYCLE, count = 3, todayIsoStr = todayIso()): OvulationCycle[] | null {
  const lmp = parseIsoDate(lastPeriodIso);
  const today = parseIsoDate(todayIsoStr);
  if (!lmp || !today || !Number.isInteger(cycle) || cycle < MIN_CYCLE || cycle > MAX_CYCLE) return null;
  if (lmp.getUTCFullYear() < MIN_YEAR || lmp.getUTCFullYear() > MAX_YEAR) return null;
  // Skip whole cycles that ended before today so the list stays current.
  const elapsed = Math.floor((today.getTime() - lmp.getTime()) / DAY);
  // A last period in the future is a typo (often the year), not a forecast.
  if (elapsed < 0) return null;
  // On the day the next period is due (elapsed === cycle) that new cycle is the current one.
  const skip = elapsed >= cycle ? Math.floor(elapsed / cycle) : 0;
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

