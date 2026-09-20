import { parseIsoDate } from "./age";

export type IsoWeek = { year: number; week: number; weekday: number };

export function isoWeek(iso: string): IsoWeek | null {
  const d = parseIsoDate(iso);
  if (!d) return null;
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const weekday = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: utc.getUTCFullYear(), week, weekday };
}

export function isoWeekLabel(info: IsoWeek): string {
  return `${info.year}-W${String(info.week).padStart(2, "0")}`;
}
