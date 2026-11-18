/**
 * Calendar channel copy helpers: titles, descriptions, FAQ answers, holiday lookups and JSON-LD. In the main bundle,
 * so it imports no data: the astronomy tables and holiday lists ride in the calendar pack (`calendarMessages`) and are
 * handed to lunar.ts by `calendarCopy`.
 */
import type { Locale } from "./locale";
import { fill } from "./fill";
import { calendarMessages, type CalendarMessages } from "./messages";
import { appHref, calendarHref } from "./path";
import { HREFLANG } from "./sitemap";
import {
  CALENDAR_FOCUS_YEAR, CALENDAR_LOCALE, CALENDAR_PAGES, COUNTRY_CODE, calendarView, minguo, reiwa,
  type CalendarPage, type HolidayCountry,
} from "./calendar";
import { animalIndex, civilDate, dayAt, dayNumber, ganzhi, lunarNewYear, moonPhases, setLunarData, solarTerms, toLunar, weekday, type LunarData } from "./lunar";

const ORIGIN = "https://cv.cm";

export type HolidayType = "public" | "substitute" | "workday" | "collective-leave" | "bridge";
export interface HolidayDay {
  date: string;
  type: HolidayType;
  key: string;
  local: string;
  en: string;
  note?: string;
  /** BCP 47 language of `local` (added on read). */
  lang: string;
}
export interface HolidaySource { year: number; title: string; url: string; published?: string }
export type HolidayData = Record<string, { sources: HolidaySource[]; days: Omit<HolidayDay, "lang">[] }>;

/** The calendar pack, with its astronomy tables registered for lunar.ts. */
export function calendarCopy(locale: Locale): CalendarMessages {
  const c = calendarMessages(locale);
  setLunarData(c.astro as LunarData);
  if (holidayData !== c.holidayData) {
    holidayData = c.holidayData as HolidayData;
    byDayCache.clear();
    countryCache.clear();
  }
  return c;
}

let holidayData: HolidayData | null = null;

const OFFICIAL_LANG: Record<string, string> = { CN: "zh-Hans", TW: "zh-Hant", HK: "zh-Hant", JP: "ja", KR: "ko", VN: "vi", ID: "id", US: "en", GB: "en", ES: "es", MX: "es" };
/** The site locale that reads a country's official language as is. */
const SAME_LANG: Record<string, Locale> = { CN: "zh-CN", TW: "zh-TW", HK: "zh-TW", JP: "ja", KR: "ko", VN: "vi", ID: "id", US: "en", GB: "en", ES: "es", MX: "es" };

const byDayCache = new Map<HolidayCountry, Map<number, HolidayDay[]>>();

const countryCache = new Map<HolidayCountry, { sources: HolidaySource[]; days: HolidayDay[] }>();

function countryData(country: HolidayCountry): { sources: HolidaySource[]; days: HolidayDay[] } {
  const hit = countryCache.get(country);
  if (hit) return hit;
  const code = COUNTRY_CODE[country];
  if (!holidayData) throw new Error("calendar holidays not registered");
  const raw = holidayData[code];
  const data = raw ? { sources: raw.sources, days: raw.days.map((d) => ({ ...d, lang: OFFICIAL_LANG[code] })) } : { sources: [], days: [] };
  countryCache.set(country, data);
  return data;
}

/** The years with an official list, newest first, with their sources. */
export function holidayYears(country: HolidayCountry): { year: number; sources: HolidaySource[] }[] {
  const { sources } = countryData(country);
  const years = [...new Set(sources.map((s) => s.year))].sort((a, b) => b - a);
  return years.map((year) => ({ year, sources: sources.filter((s) => s.year === year) }));
}

/** A country's holiday days in a year (official list), or null when that year has not been announced. */
export function holidayDays(country: HolidayCountry, year: number): HolidayDay[] | null {
  if (!holidayYears(country).some((y) => y.year === year)) return null;
  return countryData(country).days.filter((d) => d.date.startsWith(`${year}-`));
}

export function holidaysByDay(country: HolidayCountry): Map<number, HolidayDay[]> {
  let map = byDayCache.get(country);
  if (map) return map;
  map = new Map();
  for (const d of countryData(country).days) {
    const [y, m, day] = d.date.split("-").map(Number);
    const n = dayNumber(y, m, day);
    map.set(n, [...(map.get(n) ?? []), d]);
  }
  byDayCache.set(country, map);
  return map;
}

/** A holiday's name for a reader: the locale's translation, the official name when the reader shares its language, else English. */
export function holidayName(locale: Locale, country: HolidayCountry, h: Pick<HolidayDay, "key" | "local" | "en">): string {
  const code = COUNTRY_CODE[country];
  const own = (calendarMessages(locale).holidayNames as Record<string, string>)[`${code}:${h.key}`];
  if (own) return own;
  if (SAME_LANG[code] === locale) return h.local;
  return h.en;
}

/** English needs "the" before these names inside a sentence ("the United States has …"), not in headings. */
const EN_THE = new Set<HolidayCountry>(["united-states", "united-kingdom"]);

/** A country's name inside running text (FAQ answers, ledes). */
export function countryInText(locale: Locale, country: HolidayCountry): string {
  const name = countryName(locale, country);
  return locale === "en" && EN_THE.has(country) ? `the ${name}` : name;
}

export function countryName(locale: Locale, country: HolidayCountry): string {
  return (calendarMessages(locale).countries as Record<string, string>)[country];
}

const isOff = (h: HolidayDay): boolean => h.type !== "workday";

/**
 * Days off in a year: listed dates that are not makeup working days, except a holiday's own date on a Saturday or
 * Sunday when it is observed on the adjacent Friday or Monday instead (US federal holidays: only the observed day is a day
 * off). Elsewhere a weekend holiday stays a holiday and its substitute is an extra day (Japan, Korea, Taiwan).
 */
export function daysOffCount(country: HolidayCountry, year: number): { off: number; work: number } | null {
  const days = holidayDays(country, year);
  if (!days) return null;
  const num = (iso: string): number => {
    const [y, m, d] = iso.split("-").map(Number);
    return dayNumber(y, m, d);
  };
  const observed = new Set(days.filter((d) => d.type === "substitute").map((d) => `${d.key} ${num(d.date)}`));
  const replaced = (d: HolidayDay): boolean => {
    if (country !== "united-states" || d.type !== "public") return false;
    const n = num(d.date);
    const wd = weekday(n);
    return (wd === 6 && observed.has(`${d.key} ${n - 1}`)) || (wd === 0 && observed.has(`${d.key} ${n + 1}`));
  };
  // The US observes a Saturday New Year's Day on the Friday before: 31 December belongs to the next year's holiday.
  const nextYear = (d: HolidayDay): boolean => d.key === "new-year" && d.date.endsWith("-12-31");
  const off = days.filter((d) => isOff(d) && !replaced(d) && !nextYear(d));
  return { off: new Set(off.map((d) => d.date)).size, work: days.filter((d) => d.type === "workday").length };
}

/** Runs of 3+ days off (weekends included unless worked) that hold at least one holiday. */
export function longBreaks(country: HolidayCountry, year: number): { from: number; to: number; names: HolidayDay[] }[] {
  const map = holidaysByDay(country);
  const start = dayNumber(year, 1, 1);
  const end = dayNumber(year, 12, 31);
  const off = (n: number): boolean => {
    const marks = map.get(n) ?? [];
    if (marks.some((h) => h.type === "workday")) return false;
    if (marks.some(isOff)) return true;
    const wd = weekday(n);
    return wd === 0 || wd === 6;
  };
  const out: { from: number; to: number; names: HolidayDay[] }[] = [];
  let n = start;
  while (n <= end) {
    if (!off(n)) { n++; continue; }
    // A break that starts this year may run into the next one (31 December observed for New Year's Day).
    let to = n;
    while (to + 1 <= end + 14 && off(to + 1)) to++;
    const names: HolidayDay[] = [];
    for (let k = n; k <= to; k++) for (const h of map.get(k) ?? []) if (isOff(h) && !names.some((x) => x.key === h.key)) names.push(h);
    if (to - n + 1 >= 3 && names.length) out.push({ from: n, to, names });
    n = to + 1;
  }
  return out;
}

/** ISO 8601 week number of a day. */
export function isoWeek(n: number): number {
  const wd = weekday(n) || 7;
  const thursday = n + 4 - wd;
  const [y] = civilDate(thursday);
  return Math.floor((thursday - dayNumber(y, 1, 1)) / 7) + 1;
}

/** UTC offset (hours) of each lunar reckoning's standard time. */
export const ZONE_OFFSET: Record<"vn" | "cn" | "kr", number> = { vn: 7, cn: 8, kr: 9 };

/** The fixed offset (hours) a locale shows solar terms in: its lunar zone's standard time, else its moon offset. */
export function termOffset(locale: Locale): number {
  const cfg = CALENDAR_LOCALE[locale];
  return cfg.lunar ? ZONE_OFFSET[cfg.zone] : cfg.offset;
}

export function offsetLabel(locale: Locale): string {
  const c = calendarMessages(locale);
  const offset = termOffset(locale);
  return offset ? fill(c.ui.zoneOffset, { sign: "+", h: offset }) : c.ui.zoneUtc;
}

function fmt(locale: Locale, n: number, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(HREFLANG[locale], { timeZone: "UTC", ...opts }).format(new Date(n * 86400000));
}
/** "Saturday, 6 February 2027" (UTC day number). */
export function longDate(locale: Locale, n: number): string {
  return fmt(locale, n, { year: "numeric", month: "long", day: "numeric", weekday: "long" });
}
const dateLong = longDate;
const dateShort = (locale: Locale, n: number): string => fmt(locale, n, { month: "short", day: "numeric" });
const weekdayLong = (locale: Locale, n: number): string => fmt(locale, n, { weekday: "long" });
const monthLong = (locale: Locale, y: number, m: number): string => fmt(locale, dayNumber(y, m, 1), { month: "long" });
/** "Saturday, 20 February 2027 23:24" for an instant (Unix minutes) shown at a fixed UTC offset. */
export function stamp(locale: Locale, at: number, offset: number): string {
  const d = new Date((at + offset * 60) * 60000);
  return `${dateLong(locale, Math.floor(d.getTime() / 86400000))} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function yearVars(locale: Locale, y: number): Record<string, string | number> {
  const c = calendarCopy(locale);
  const lny = lunarNewYear(y, CALENDAR_LOCALE[locale].zone)!;
  return {
    y,
    reiwa: reiwa(y),
    minguo: minguo(y),
    first: weekdayLong(locale, dayNumber(y, 1, 1)),
    last: weekdayLong(locale, dayNumber(y, 12, 31)),
    days: dayNumber(y + 1, 1, 1) - dayNumber(y, 1, 1),
    weeks: isoWeek(dayNumber(y, 12, 28)),
    lny: dateLong(locale, lny),
    animal: c.animals[animalIndex(y)],
    gz: cycleLabel(locale, y),
    country: countryName(locale, CALENDAR_LOCALE[locale].country),
  };
}

/** The full lunar date of a day ("农历丙午年腊月廿五（属马）", "2026 (Bính Ngọ …), month 12, day 25"), or the range note. */
export function lunarText(locale: Locale, n: number, zone: "cn" | "vn" | "kr"): string {
  const c = calendarCopy(locale);
  const l = toLunar(n, zone);
  if (!l) return c.ui.outOfRange;
  const zh = CALENDAR_LOCALE[locale].lunar === "zh";
  return fill(c.ui.lunarLine, {
    ly: l.year,
    gz: cycleLabel(locale, l.year),
    animal: c.animals[animalIndex(l.year)],
    lm: zh ? c.lunarMonths[l.month - 1] : l.month,
    leap: l.leap ? c.ui.leapMark : "",
    ld: zh ? c.lunarDays[l.day - 1] : l.day,
  });
}

/** 丙午 / Bính Ngọ / 병오. */
export function cycleLabel(locale: Locale, year: number): string {
  const c = calendarMessages(locale);
  const gz = ganzhi(year);
  if (!c.stems.length) return gz;
  return `${c.stems["甲乙丙丁戊己庚辛壬癸".indexOf(gz[0])]}${c.stemJoin}${c.branches["子丑寅卯辰巳午未申酉戌亥".indexOf(gz[1])]}`;
}

function monthVars(locale: Locale, y: number, m: number): Record<string, string | number> {
  const first = dayNumber(y, m, 1);
  const next = dayNumber(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1);
  const offset = CALENDAR_LOCALE[locale].offset;
  const full = moonPhases().find((p) => p.quarter === 2 && dayAt(p.at, offset) >= first && dayAt(p.at, offset) < next);
  return {
    ...yearVars(locale, y),
    m,
    month: monthLong(locale, y, m),
    days: next - first,
    first: weekdayLong(locale, first),
    full: full ? dateShort(locale, dayAt(full.at, offset)) : "—",
  };
}

function holidayVars(locale: Locale, country: HolidayCountry): Record<string, string | number> {
  const years = holidayYears(country);
  const y = years[0]?.year ?? CALENDAR_FOCUS_YEAR;
  const count = daysOffCount(country, y);
  return {
    country: countryName(locale, country),
    y,
    prev: years[1]?.year ?? y - 1,
    n: count?.off ?? 0,
    source: years[0]?.sources[0]?.title ?? "",
  };
}

/** The page's visible heading (h1), also the breadcrumb's last step. */
export function calendarHeading(locale: Locale, page: CalendarPage): string {
  const c = calendarCopy(locale);
  const view = calendarView(page);
  switch (view.kind) {
    case "hub": return c.hub.h1;
    case "year": return fill(c.year.h1, yearVars(locale, view.year));
    case "month": return fill(c.month.h1, monthVars(locale, view.year, view.month));
    case "holidays": return fill(c.holidays.h1, holidayVars(locale, view.country));
    case "solar-terms": return fill(c.terms.h1, { y: CALENDAR_FOCUS_YEAR });
    case "moon-phases": return fill(c.moon.h1, { y: CALENDAR_FOCUS_YEAR });
  }
}

export function calendarLede(locale: Locale, page: CalendarPage): string {
  const c = calendarCopy(locale);
  const view = calendarView(page);
  switch (view.kind) {
    case "hub": return c.hub.lede;
    case "year": return fill(c.year.lede, yearVars(locale, view.year));
    case "month": return fill(c.month.lede, monthVars(locale, view.year, view.month));
    case "holidays": return fill(c.holidays.lede, holidayVars(locale, view.country));
    case "solar-terms": return fill(c.terms.lede, { zone: offsetLabel(locale) });
    case "moon-phases": return fill(c.moon.lede, { zone: offsetLabel(locale) });
  }
}

export function calendarTitle(locale: Locale, page: CalendarPage): string {
  const c = calendarCopy(locale);
  const view = calendarView(page);
  const text = (() => {
    switch (view.kind) {
      case "hub": return c.hub.title;
      case "year": return fill(c.year.title, yearVars(locale, view.year));
      case "month": return fill(c.month.title, monthVars(locale, view.year, view.month));
      case "holidays": return fill(c.holidays.title, holidayVars(locale, view.country));
      case "solar-terms": return fill(c.terms.title, { y: CALENDAR_FOCUS_YEAR });
      case "moon-phases": return fill(c.moon.title, { y: CALENDAR_FOCUS_YEAR });
    }
  })();
  return `${text} — cv.cm`;
}

export function calendarDescription(locale: Locale, page: CalendarPage): string {
  const c = calendarCopy(locale);
  const view = calendarView(page);
  switch (view.kind) {
    case "hub": return c.hub.description;
    case "year": return fill(c.year.description, yearVars(locale, view.year));
    case "month": return fill(c.month.description, monthVars(locale, view.year, view.month));
    case "holidays": return fill(c.holidays.description, holidayVars(locale, view.country));
    case "solar-terms": return fill(c.terms.description, { y: CALENDAR_FOCUS_YEAR, zone: offsetLabel(locale) });
    case "moon-phases": return fill(c.moon.description, { y: CALENDAR_FOCUS_YEAR, zone: offsetLabel(locale) });
  }
}

/** "5 November 2026", or "June 2026" when the source gives only a month, or the year. */
function publishedLabel(locale: Locale, src: HolidaySource): string {
  const [y, m, d] = (src.published ?? "").split("-").map(Number);
  if (y && m && d) return fmt(locale, dayNumber(y, m, d), { year: "numeric", month: "long", day: "numeric" });
  if (y && m) return fmt(locale, dayNumber(y, m, 1), { year: "numeric", month: "long" });
  return String(y || src.year);
}

function list(locale: Locale, items: string[]): string {
  try {
    return new Intl.ListFormat(HREFLANG[locale], { type: "conjunction", style: "long" }).format(items);
  } catch {
    return items.join(", ");
  }
}

/** Holiday runs of one key as "5–13 Feb Spring Festival". */
function holidayRuns(locale: Locale, country: HolidayCountry, days: HolidayDay[]): string[] {
  const runs: { from: number; to: number; h: HolidayDay }[] = [];
  for (const h of days.filter(isOff)) {
    const [y, m, d] = h.date.split("-").map(Number);
    const n = dayNumber(y, m, d);
    const last = runs[runs.length - 1];
    // One run per holiday and shown name: China's statutory and swapped days are one break, Indonesia's cuti bersama its own.
    if (last && last.h.key === h.key && holidayName(locale, country, last.h) === holidayName(locale, country, h) && last.to === n - 1) last.to = n;
    else if (!(last && last.h.key === h.key && last.to === n)) runs.push({ from: n, to: n, h });
  }
  return runs.map((r) => `${dateShort(locale, r.from)}${r.to > r.from ? `–${dateShort(locale, r.to)}` : ""} ${holidayName(locale, country, r.h)}`);
}

function countAnswer(locale: Locale, country: HolidayCountry, y: number): string {
  const c = calendarCopy(locale);
  const count = daysOffCount(country, y);
  if (!count) return fill(c.ui.notAnnounced, { country: countryInText(locale, country), y });
  return fill(c.answers.countLine, {
    country: countryInText(locale, country),
    n: count.off,
    y,
    work: count.work ? fill(c.answers.workdays, { n: count.work }) : "",
  });
}

export function calendarFaqItems(locale: Locale, page: CalendarPage): { q: string; a: string }[] {
  const c = calendarCopy(locale);
  const view = calendarView(page);
  const zone = offsetLabel(locale);
  switch (view.kind) {
    case "hub": return c.hub.faq;
    case "year": {
      const vars = { ...yearVars(locale, view.year), country: countryInText(locale, CALENDAR_LOCALE[locale].country), holidayAnswer: countAnswer(locale, CALENDAR_LOCALE[locale].country, view.year) };
      return c.year.faq.map((f) => ({ q: fill(f.q, vars), a: fill(f.a, vars) }));
    }
    case "month": {
      const country = CALENDAR_LOCALE[locale].country;
      const vars = { ...monthVars(locale, view.year, view.month), country: countryInText(locale, country) };
      const all = holidayDays(country, view.year);
      const inMonth = all?.filter((h) => h.date.startsWith(`${view.year}-${String(view.month).padStart(2, "0")}`)) ?? null;
      const runs = inMonth ? holidayRuns(locale, country, inMonth) : [];
      const holidayAnswer = inMonth === null
        ? fill(c.ui.notAnnounced, { country: vars.country, y: view.year })
        : runs.length ? fill(c.answers.monthHolidays, { country: vars.country, list: list(locale, runs) }) : fill(c.answers.monthNone, vars);
      const first = dayNumber(view.year, view.month, 1);
      const next = dayNumber(view.month === 12 ? view.year + 1 : view.year, view.month === 12 ? 1 : view.month + 1, 1);
      const offset = CALENDAR_LOCALE[locale].offset;
      const fulls = moonPhases().filter((p) => p.quarter === 2 && dayAt(p.at, offset) >= first && dayAt(p.at, offset) < next);
      const fullAnswer = fulls.length
        ? fill(c.answers.monthFull, { time: list(locale, fulls.map((p) => stamp(locale, p.at, offset))), zone })
        : fill(c.answers.monthNoFull, { ...vars, time: stamp(locale, moonPhases().find((p) => p.quarter === 2 && dayAt(p.at, offset) >= next)!.at, offset), zone });
      const lunarAnswer = fill(c.answers.monthLunar, { ...vars, lunar: lunarText(locale, first, CALENDAR_LOCALE[locale].zone) });
      const all3 = { ...vars, holidayAnswer, fullAnswer, lunarAnswer };
      return c.month.faq.map((f) => ({ q: fill(f.q, all3), a: fill(f.a, all3) }));
    }
    case "holidays": {
      const vars: Record<string, string | number> = { ...holidayVars(locale, view.country), country: countryInText(locale, view.country) };
      const y = Number(vars.y);
      const breaks = longBreaks(view.country, y);
      const longAnswer = breaks.length
        ? fill(c.answers.longLine, { y, list: list(locale, breaks.map((b) => `${dateShort(locale, b.from)}–${dateShort(locale, b.to)} (${b.to - b.from + 1})`)) })
        : fill(c.answers.longNone, { y });
      const src = holidayYears(view.country)[0]?.sources[0];
      const sourceAnswer = src ? fill(c.answers.sourceLine, { title: src.title, date: publishedLabel(locale, src) }) : "";
      const all = { ...vars, countAnswer: countAnswer(locale, view.country, y), longAnswer, sourceAnswer };
      return c.holidays.faq.map((f) => ({ q: fill(f.q, all), a: fill(f.a, all) }));
    }
    case "solar-terms": {
      const y = CALENDAR_FOCUS_YEAR;
      const offset = termOffset(locale);
      const find = (index: number) => solarTerms().find((t) => t.index === index && civilDate(dayAt(t.at, offset))[0] === y)!;
      const vars = {
        y,
        solsticeAnswer: fill(c.answers.termLine, { time: stamp(locale, find(21).at, offset), zone }),
        springAnswer: fill(c.answers.termLine, { time: stamp(locale, find(0).at, offset), zone }),
      };
      return c.terms.faq.map((f) => ({ q: fill(f.q, vars), a: fill(f.a, vars) }));
    }
    case "moon-phases": {
      const y = CALENDAR_FOCUS_YEAR;
      const offset = CALENDAR_LOCALE[locale].offset;
      const fulls = moonPhases().filter((p) => p.quarter === 2 && civilDate(dayAt(p.at, offset))[0] === y);
      const vars = {
        y,
        nextAnswer: fill(c.answers.moonList, { y, zone, list: list(locale, fulls.map((p) => dateShort(locale, dayAt(p.at, offset)))) }),
        countAnswer: fill(c.answers.moonCount, { y, n: fulls.length }),
      };
      return c.moon.faq.map((f) => ({ q: fill(f.q, vars), a: fill(f.a, vars) }));
    }
  }
}

export function calendarBreadcrumbJsonLd(locale: Locale, page: CalendarPage): Record<string, unknown> {
  const c = calendarCopy(locale);
  const items = [
    { name: c.crumbHome, item: `${ORIGIN}${appHref(locale, null)}` },
    { name: c.hub.h1, item: `${ORIGIN}${calendarHref(locale)}` },
  ];
  const view = calendarView(page);
  if (view.kind === "month") items.push({ name: String(view.year), item: `${ORIGIN}${calendarHref(locale, `${view.year}`)}` });
  if (page !== "hub") items.push({ name: calendarHeading(locale, page), item: `${ORIGIN}${calendarHref(locale, page)}` });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, ...item })),
  };
}

export function calendarFaqJsonLd(locale: Locale, page: CalendarPage): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: calendarFaqItems(locale, page).map((item) => ({
      "@type": "Question",
      name: item.q.replaceAll("`", ""),
      acceptedAnswer: { "@type": "Answer", text: item.a.replaceAll("`", "") },
    })),
  };
}

/** CollectionPage of every calendar page for the hub; a WebPage for the others. */
export function calendarPageJsonLd(locale: Locale, page: CalendarPage): Record<string, unknown> {
  const url = `${ORIGIN}${calendarHref(locale, page)}`;
  const base = {
    "@context": "https://schema.org",
    name: calendarHeading(locale, page),
    description: calendarDescription(locale, page),
    url,
    inLanguage: HREFLANG[locale],
  };
  if (page !== "hub") return { ...base, "@type": "WebPage", isPartOf: { "@type": "CollectionPage", url: `${ORIGIN}${calendarHref(locale)}` } };
  const pages = CALENDAR_PAGES.filter((p) => p !== "hub");
  return {
    ...base,
    "@type": "CollectionPage",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: pages.length,
      itemListElement: pages.map((p, index) => ({ "@type": "ListItem", position: index + 1, name: calendarHeading(locale, p), url: `${ORIGIN}${calendarHref(locale, p)}` })),
    },
  };
}
