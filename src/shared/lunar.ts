// The lunisolar calendar and sky events for the calendar channel, read from calendar-data.json
// (scripts/build-calendar-data.mjs). Dates are "day numbers": whole days since 1970-01-01, so a civil date never
// depends on the reader's time zone.

/** The shape of calendar-data.json. It rides in the calendar pack (never the main bundle) and is handed over with
 *  `setLunarData` when the pack registers; tests and the Worker register it the same way. */
export interface LunarData {
  zones: Record<"vn" | "cn" | "kr", { first: number; years: string[] }>;
  detail: { from: number; to: number };
  terms: number[][];
  phases: number[][];
}

let data: LunarData | null = null;
function astro(): LunarData {
  if (!data) throw new Error("calendar data not registered");
  return data;
}

export function setLunarData(next: LunarData): void {
  if (data === next) return;
  data = next;
  for (const key of Object.keys(decoded) as LunarZone[]) delete decoded[key];
  terms = null;
  phases = null;
}

/** Which lunisolar reckoning: Vietnam (UTC+7), China / Taiwan / Hong Kong (UTC+8), Korea and Japan (UTC+9). */
export type LunarZone = "vn" | "cn" | "kr";

export interface LunarDate {
  /** The lunar year's Gregorian year number (the year its month 1 starts in). */
  year: number;
  month: number;
  day: number;
  leap: boolean;
  /** Days in this lunar month (29 or 30). */
  monthDays: number;
}

interface LunarYear {
  year: number;
  start: number;
  leap: number;
  lengths: number[];
}

const DAY = 86400000;
const decoded: Partial<Record<LunarZone, LunarYear[]>> = {};

function years(zone: LunarZone): LunarYear[] {
  const hit = decoded[zone];
  if (hit) return hit;
  const z = astro().zones[zone];
  const list = z.years.map((code, i) => {
    const [start, leap, bits] = code.split(".").map((part) => parseInt(part, 36));
    const count = leap ? 13 : 12;
    const lengths = Array.from({ length: count }, (_, k) => (bits & (1 << k) ? 30 : 29));
    return { year: z.first + i, start, leap, lengths };
  });
  decoded[zone] = list;
  return list;
}

/** Day number of a Gregorian date. */
export function dayNumber(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / DAY);
}

/** Gregorian [year, month, day] of a day number. */
export function civilDate(n: number): [number, number, number] {
  const d = new Date(n * DAY);
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(n: number): number {
  return (((n + 4) % 7) + 7) % 7;
}

/** The first and last day numbers the lunar tables cover. */
export function lunarRange(zone: LunarZone = "cn"): [number, number] {
  const list = years(zone);
  const last = list[list.length - 1];
  return [list[0].start, last.start + last.lengths.reduce((a, b) => a + b, 0) - 1];
}

/** The lunar date of a day number, or null outside 1900–2100. */
export function toLunar(n: number, zone: LunarZone = "cn"): LunarDate | null {
  const list = years(zone);
  let lo = 0;
  let hi = list.length - 1;
  if (n < list[0].start) return null;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (list[mid].start <= n) lo = mid;
    else hi = mid - 1;
  }
  const y = list[lo];
  let offset = n - y.start;
  for (let k = 0; k < y.lengths.length; k++) {
    if (offset < y.lengths[k]) {
      // Month k: months before the leap month count 1..leap, the leap month repeats `leap`, later ones shift by one.
      const leap = y.leap > 0 && k === y.leap;
      const month = y.leap > 0 && k >= y.leap ? k : k + 1;
      return { year: y.year, month, day: offset + 1, leap, monthDays: y.lengths[k] };
    }
    offset -= y.lengths[k];
  }
  return null;
}

/** Day number of a lunar date (the leap month when `leap`), or null when that date does not exist. */
export function fromLunar(year: number, month: number, day: number, leap = false, zone: LunarZone = "cn"): number | null {
  const y = years(zone).find((item) => item.year === year);
  if (!y || month < 1 || month > 12 || day < 1) return null;
  if (leap && y.leap !== month) return null;
  const k = y.leap > 0 && (month > y.leap || (leap && month === y.leap)) ? month : month - 1;
  if (day > y.lengths[k]) return null;
  let n = y.start;
  for (let i = 0; i < k; i++) n += y.lengths[i];
  return n + day - 1;
}

/** The leap month of a lunar year (0 when none). */
export function leapMonthOf(year: number, zone: LunarZone = "cn"): number {
  return years(zone).find((item) => item.year === year)?.leap ?? 0;
}

/** Day number of lunar new year (month 1 day 1). */
export function lunarNewYear(year: number, zone: LunarZone = "cn"): number | null {
  return years(zone).find((item) => item.year === year)?.start ?? null;
}

const STEMS = "甲乙丙丁戊己庚辛壬癸";
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";

/** Index 0–59 of a lunar year in the sexagenary cycle (0 = 甲子, 1984). */
export function cycleIndex(lunarYear: number): number {
  return (((lunarYear - 1984) % 60) + 60) % 60;
}

/** 干支 of a lunar year, e.g. 丙午 for 2026. */
export function ganzhi(lunarYear: number): string {
  const i = cycleIndex(lunarYear);
  return STEMS[i % 10] + BRANCHES[i % 12];
}

/** 0 = rat … 11 = pig. */
export function animalIndex(lunarYear: number): number {
  return cycleIndex(lunarYear) % 12;
}

/** Japanese rokuyō index: 0 大安, 1 赤口, 2 先勝, 3 友引, 4 先負, 5 仏滅 ((month + day) mod 6 of the kyūreki date). */
export function rokuyo(date: LunarDate): number {
  return (date.month + date.day) % 6;
}

export interface SkyEvent {
  /** Unix minutes, UTC. */
  at: number;
}
export interface SolarTerm extends SkyEvent {
  /** 0 = Start of Spring (立春, 315°) … 23 = Major Cold (大寒, 300°): the traditional order. */
  index: number;
  longitude: number;
}
export interface MoonPhase extends SkyEvent {
  /** 0 new moon, 1 first quarter, 2 full moon, 3 last quarter. */
  quarter: number;
}

let terms: SolarTerm[] | null = null;
let phases: MoonPhase[] | null = null;

/** The 24 solar terms of the detail years, in time order. */
export function solarTerms(): readonly SolarTerm[] {
  return (terms ??= astro().terms.map(([longitude, at]) => ({ longitude, at, index: ((longitude - 315 + 360) % 360) / 15 })));
}

/** The moon's quarters of the detail years, in time order. */
export function moonPhases(): readonly MoonPhase[] {
  return (phases ??= astro().phases.map(([quarter, at]) => ({ quarter, at })));
}

/** Day number of an instant in a fixed UTC offset (hours). */
export function dayAt(at: number, offsetHours: number): number {
  return Math.floor((at + offsetHours * 60) / 1440);
}
