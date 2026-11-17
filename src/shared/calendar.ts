/**
 * The calendar channel under `/{locale}/calendar/`: year and month calendars with public holidays, the lunisolar
 * calendar (农历 / 農曆, âm lịch, 음력, 旧暦 and 六曜), the 24 solar terms and the moon's phases, plus one public-holiday
 * page per country. Chosen with Google Ads Keyword Planner (2026-11-17): "lịch âm" 2.7M, 農曆 / 農民曆 368k each,
 * calendario 2027 450k, kalender 2027 550k, 2027 行事曆 201k, 大安カレンダー 201k, next full moon 450k.
 *
 * Page ids: "hub", a year ("2027"), a month ("2027-02"), "holidays/<country>", "solar-terms", "moon-phases".
 * Astronomy comes from calendar-data.json (scripts/build-calendar-data.mjs); holidays from calendar-holidays.json,
 * typed in from each government's own announcement (sources listed per country).
 */
import type { Locale } from "./locale";
import type { LunarZone } from "./lunar";

export const CALENDAR_SEGMENT = "calendar";

/** Years with year and month pages. */
export const CALENDAR_YEARS = [2026, 2027, 2028] as const;
export type CalendarYear = (typeof CALENDAR_YEARS)[number];

export const HOLIDAY_COUNTRIES = [
  "china", "taiwan", "hong-kong", "japan", "south-korea", "vietnam", "indonesia", "united-states", "united-kingdom", "spain", "mexico",
] as const;
export type HolidayCountry = (typeof HOLIDAY_COUNTRIES)[number];

/** ISO 3166 code of each holiday country (the key in calendar-holidays.json and for Intl.DisplayNames). */
export const COUNTRY_CODE: Record<HolidayCountry, string> = {
  china: "CN", taiwan: "TW", "hong-kong": "HK", japan: "JP", "south-korea": "KR", vietnam: "VN", indonesia: "ID",
  "united-states": "US", "united-kingdom": "GB", spain: "ES", mexico: "MX",
};

export type CalendarPage =
  | "hub"
  | "solar-terms"
  | "moon-phases"
  | `${CalendarYear}`
  | `${CalendarYear}-${string}`
  | `holidays/${HolidayCountry}`;

const MONTHS = CALENDAR_YEARS.flatMap((y) => Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`));

/** Every page of the channel, hub first (sitemap order). */
export const CALENDAR_PAGES: readonly CalendarPage[] = [
  "hub",
  ...CALENDAR_YEARS.map((y) => `${y}` as CalendarPage),
  ...(MONTHS as CalendarPage[]),
  ...HOLIDAY_COUNTRIES.map((c) => `holidays/${c}` as CalendarPage),
  "solar-terms",
  "moon-phases",
];

const PAGE_SET = new Set<string>(CALENDAR_PAGES);

export function isCalendarPage(value: string): value is CalendarPage {
  return PAGE_SET.has(value);
}

/** The page id of the path segments after `/calendar/` (["2027"], ["holidays", "japan"]), or null. */
export function calendarPageOf(parts: readonly string[]): CalendarPage | null {
  if (!parts.length) return "hub";
  const id = parts.join("/");
  return id !== "hub" && isCalendarPage(id) ? id : null;
}

export type CalendarView =
  | { kind: "hub" }
  | { kind: "year"; year: CalendarYear }
  | { kind: "month"; year: CalendarYear; month: number }
  | { kind: "holidays"; country: HolidayCountry }
  | { kind: "solar-terms" }
  | { kind: "moon-phases" };

export function calendarView(page: CalendarPage): CalendarView {
  if (page === "hub" || page === "solar-terms" || page === "moon-phases") return { kind: page } as CalendarView;
  if (page.startsWith("holidays/")) return { kind: "holidays", country: page.slice(9) as HolidayCountry };
  const [y, m] = page.split("-");
  const year = Number(y) as CalendarYear;
  return m ? { kind: "month", year, month: Number(m) } : { kind: "year", year };
}

export function monthPage(year: number, month: number): CalendarPage | null {
  const id = `${year}-${String(month).padStart(2, "0")}`;
  return isCalendarPage(id) ? id : null;
}

/** How each locale reads a calendar. */
export interface CalendarLocale {
  /** The holiday list shown on year and month pages. */
  country: HolidayCountry;
  /** 0 = weeks start on Sunday, 1 = Monday. */
  weekStart: 0 | 1;
  /** Lunar dates in day cells: Chinese (zh), Vietnamese âm lịch, Korean 음력, Japanese 旧暦 + 六曜, or none (moon phases instead). */
  lunar: "zh" | "vi" | "ko" | "ja" | null;
  /** Reckoning behind `lunar` and the lunar festivals. */
  zone: LunarZone;
  /** Fixed UTC offset (hours) for solar-term and moon-phase times, and its label. */
  offset: number;
  /** Javanese five-day market week (pasaran) in day cells. */
  pasaran: boolean;
}

export const CALENDAR_LOCALE: Record<Locale, CalendarLocale> = {
  en: { country: "united-states", weekStart: 0, lunar: null, zone: "cn", offset: 0, pasaran: false },
  "zh-CN": { country: "china", weekStart: 1, lunar: "zh", zone: "cn", offset: 8, pasaran: false },
  "zh-TW": { country: "taiwan", weekStart: 0, lunar: "zh", zone: "cn", offset: 8, pasaran: false },
  ja: { country: "japan", weekStart: 0, lunar: "ja", zone: "kr", offset: 9, pasaran: false },
  ko: { country: "south-korea", weekStart: 0, lunar: "ko", zone: "kr", offset: 9, pasaran: false },
  vi: { country: "vietnam", weekStart: 1, lunar: "vi", zone: "vn", offset: 7, pasaran: false },
  id: { country: "indonesia", weekStart: 0, lunar: null, zone: "cn", offset: 7, pasaran: true },
  es: { country: "spain", weekStart: 1, lunar: null, zone: "cn", offset: 0, pasaran: false },
};

/** Lunar zone a holiday country reckons its lunar holidays in. */
export const COUNTRY_ZONE: Record<HolidayCountry, LunarZone> = {
  china: "cn", taiwan: "cn", "hong-kong": "cn", japan: "kr", "south-korea": "kr", vietnam: "vn", indonesia: "cn",
  "united-states": "cn", "united-kingdom": "cn", spain: "cn", mexico: "cn",
};

/** Lunar festivals shown in day cells and month lists for each lunar style: [month, day, key]; day 0 = the month's last day. */
export const LUNAR_FESTIVALS: Record<"zh" | "vi" | "ko", readonly [number, number, string][]> = {
  zh: [[1, 1, "spring"], [1, 15, "lantern"], [2, 2, "dragon-head"], [5, 5, "dragon-boat"], [7, 7, "qixi"], [7, 15, "ghost"], [8, 15, "mid-autumn"], [9, 9, "double-ninth"], [12, 8, "laba"], [12, 23, "kitchen-god"], [12, 0, "new-year-eve"]],
  vi: [[1, 1, "tet"], [1, 15, "ram-thang-gieng"], [3, 3, "han-thuc"], [3, 10, "hung-kings"], [5, 5, "doan-ngo"], [7, 15, "vu-lan"], [8, 15, "trung-thu"], [12, 23, "ong-tao"], [12, 0, "tat-nien"]],
  ko: [[1, 1, "seollal"], [1, 15, "daeboreum"], [5, 5, "dano"], [7, 7, "chilseok"], [8, 15, "chuseok"]],
};

/** The year titles of the solar-term and moon pages name (the next year while people plan it); bump each autumn. */
export const CALENDAR_FOCUS_YEAR = 2027;

/** When the channel went live, and the day its data or copy last changed (sitemap lastmod, dateModified). */
export const CALENDAR_PUBLISHED = "2026-11-17";
export const CALENDAR_UPDATED = "2026-11-17";

/** Japanese era year (令和) and Minguo year (民國) for titles. */
export function reiwa(year: number): number {
  return year - 2018;
}
export function minguo(year: number): number {
  return year - 1911;
}
