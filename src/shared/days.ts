import { parseIsoDate } from "./age";

export function daysBetween(fromIso: string, toIso: string): number | null {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}
