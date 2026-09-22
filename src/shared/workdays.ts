import { parseIsoDate } from "./age";

export type Workdays = { business: number; weekends: number };

/** Monday–Friday dates in the inclusive span. Weekends are not signed. */
export function workdaysBetween(fromIso: string, toIso: string): Workdays | null {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  if (!from || !to) return null;
  const sign = to.getTime() < from.getTime() ? -1 : 1;
  const start = sign < 0 ? to : from;
  const end = sign < 0 ? from : to;
  const inclusive = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const business = countWeekdays(start.getUTCDay(), inclusive);
  return { business: sign * business, weekends: inclusive - business };
}

function countWeekdays(startDay: number, inclusive: number): number {
  const full = Math.floor(inclusive / 7);
  let count = full * 5;
  const rem = inclusive % 7;
  for (let i = 0; i < rem; i++) {
    const wd = (startDay + i) % 7;
    if (wd !== 0 && wd !== 6) count++;
  }
  return count;
}
