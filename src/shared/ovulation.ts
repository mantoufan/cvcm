import { parseIsoDate, todayIso } from "./age";
import { isoOf } from "./due-date";

export const DEFAULT_CYCLE = 28;
export const MIN_CYCLE = 21;
export const MAX_CYCLE = 45;
/** The luteal phase (ovulation to next period) is about 14 days; the variable part of a cycle comes before ovulation. */
export const LUTEAL_DAYS = 14;
const DAY = 86400000;

export type OvulationCycle = {
  periodStart: Date;
  ovulation: Date;
  /** Five days before ovulation through the day after: sperm survive up to five days, the egg about one. */
  fertileStart: Date;
  fertileEnd: Date;
  nextPeriod: Date;
};

function addDays(d: Date, n: number): Date {
  const r = new Date(d.getTime());
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

/** The next `count` cycles from the first day of the last period, starting with the cycle that contains `today` or later. */
export function ovulationCycles(lastPeriodIso: string, cycle = DEFAULT_CYCLE, count = 3, todayIsoStr = todayIso()): OvulationCycle[] | null {
  const lmp = parseIsoDate(lastPeriodIso);
  const today = parseIsoDate(todayIsoStr);
  if (!lmp || !today || !Number.isInteger(cycle) || cycle < MIN_CYCLE || cycle > MAX_CYCLE) return null;
  if (lmp.getUTCFullYear() < 1900 || lmp.getUTCFullYear() > 2200) return null;
  // Skip whole cycles that ended before today so the list stays current.
  const elapsed = Math.floor((today.getTime() - lmp.getTime()) / DAY);
  const skip = elapsed > cycle ? Math.floor(elapsed / cycle) : 0;
  const out: OvulationCycle[] = [];
  for (let i = 0; i < count; i++) {
    const periodStart = addDays(lmp, (skip + i) * cycle);
    const ovulation = addDays(periodStart, cycle - LUTEAL_DAYS);
    out.push({
      periodStart,
      ovulation,
      fertileStart: addDays(ovulation, -5),
      fertileEnd: addDays(ovulation, 1),
      nextPeriod: addDays(periodStart, cycle),
    });
  }
  return out;
}

export { isoOf };
