import { describe, expect, it } from "vitest";
import "../src/shared/messages-all";
import { LOCALES } from "../src/shared/locale";
import { CALENDAR_PAGES, COUNTRY_CODE, HOLIDAY_COUNTRIES, calendarPageOf } from "../src/shared/calendar";
import { calendarCopy, calendarDescription, calendarFaqItems, calendarTitle, daysOffCount, holidayDays, holidayYears, longBreaks } from "../src/shared/calendar-i18n";
import { calendarPageHtml, pasaranOf } from "../src/shared/calendar-page";
import { converterHtml } from "../src/shared/lunar-converter-page";
import { calendarHref, parseAppPath } from "../src/shared/path";
import { dayNumber } from "../src/shared/lunar";
import holidays from "../src/shared/calendar-holidays.json";
import en from "../src/locales/calendar/en.json";
import { readFileSync } from "node:fs";

const LEFTOVER = /\{[a-zA-Z]+\}|undefined|NaN|\[object Object\]/;

function shape(value: unknown): unknown {
  if (Array.isArray(value)) return "array";
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]));
  return typeof value;
}

describe("calendar copy", () => {
  it("has the English keys in every locale", () => {
    const base = shape({ ...en, holidayNames: {}, countryNotes: {} });
    for (const locale of LOCALES) {
      const raw = JSON.parse(readFileSync(`src/locales/calendar/${locale}.json`, "utf8"));
      expect(shape({ ...raw, holidayNames: {}, countryNotes: {} }), locale).toEqual(base);
      expect(raw.solarTerms, locale).toHaveLength(24);
      expect(raw.animals, locale).toHaveLength(12);
      expect(raw.lunarMonths, locale).toHaveLength(12);
      expect(raw.lunarDays, locale).toHaveLength(30);
      expect(raw.rokuyo, locale).toHaveLength(6);
      expect(raw.quarters, locale).toHaveLength(4);
    }
  });
});

describe("calendar pages", () => {
  it("render every page in every locale with filled titles, descriptions and FAQ", () => {
    for (const locale of LOCALES) {
      for (const page of CALENDAR_PAGES) {
        const html = calendarPageHtml(locale, page);
        const where = `${locale} ${page}`;
        expect(html, where).not.toMatch(LEFTOVER);
        expect(calendarTitle(locale, page), where).not.toMatch(LEFTOVER);
        expect(calendarDescription(locale, page), where).not.toMatch(LEFTOVER);
        const faq = calendarFaqItems(locale, page);
        expect(faq.length, where).toBe(3);
        for (const f of faq) expect(`${f.q} ${f.a}`, where).not.toMatch(LEFTOVER);
      }
    }
  });

  it("parses and links every page", () => {
    for (const page of CALENDAR_PAGES) {
      const href = calendarHref("ja", page);
      expect(parseAppPath(href)).toEqual({ kind: "calendar", locale: "ja", page });
      expect(parseAppPath(href.replace("/ja", ""))).toEqual({ kind: "bare-calendar", page });
    }
    expect(calendarPageOf(["2031"])).toBeNull();
    expect(calendarPageOf(["holidays", "atlantis"])).toBeNull();
    expect(calendarPageOf(["hub"])).toBeNull();
    expect(parseAppPath("/en/calendar/2027-13/").kind).toBe("unknown");
  });

  it("puts the converter on its own tool page and links it from the hub", () => {
    const tool = converterHtml("zh-CN");
    expect(tool).toContain('value="2027-02-06"');
    expect(tool).toContain("正月初一");
    expect(calendarPageHtml("zh-CN", "hub")).toContain('href="/zh-cn/lunar-converter/"');
  });

  it("places the calendar under Tools in the trail", () => {
    const trail = calendarPageHtml("en", "2027-02").match(/<nav class="device-crumb"[^]*?<\/nav>/)![0];
    expect(trail).toMatch(/data-nav="home"[^]*data-nav="tools"[^]*data-nav="calendar"[^]*data-nav="calendar-2027"/);
  });

  it("labels each row with the ISO week of its Monday", () => {
    const weeks = (html: string) => [...html.matchAll(/<th scope="row" class="cal-wk">(\d+)<\/th>/g)].map((m) => Number(m[1]));
    expect(weeks(calendarPageHtml("en", "2027-02"))).toEqual([5, 6, 7, 8, 9]);
    expect(weeks(calendarPageHtml("zh-CN", "2027-02"))).toEqual([5, 6, 7, 8]);
    expect(weeks(calendarPageHtml("zh-CN", "2026-12"))).toEqual([49, 50, 51, 52, 53]);
  });

  it("keeps one holiday in one run and counts the US federal holidays of the year", () => {
    const feb = calendarFaqItems("zh-CN", "2026-02")[0].a;
    expect(feb).toContain("2月15日–2月23日");
    expect(daysOffCount("united-states", 2027)).toEqual({ off: 11, work: 0 });
    // Friday 31 December 2027 (observed New Year's Day 2028) plus the weekend is a long break of 2027.
    expect(longBreaks("united-states", 2027).at(-1)).toMatchObject({ from: dayNumber(2027, 12, 31), to: dayNumber(2028, 1, 2) });
  });

  it("marks China's 2027 makeup working days and the Spring Festival break", () => {
    const html = calendarPageHtml("zh-CN", "2027-02");
    expect(html).toMatch(/data-day="\d+"><span class="cal-n">14<\/span>/);
    expect(daysOffCount("china", 2027)).toEqual({ off: 29, work: 5 });
    const spring = longBreaks("china", 2027).find((b) => b.names.some((h) => h.key === "lunar-new-year"))!;
    expect([spring.from, spring.to]).toEqual([dayNumber(2027, 2, 5), dayNumber(2027, 2, 13)]);
  });
});

describe("holiday data", () => {
  const TYPES = new Set(["public", "substitute", "workday", "collective-leave", "bridge"]);
  it("is well formed and has a source for every year it lists", () => {
    for (const [code, country] of Object.entries(holidays as Record<string, { sources: { year: number; url: string }[]; days: { date: string; type: string; key: string; local: string; en: string }[] }>)) {
      expect(Object.values(COUNTRY_CODE)).toContain(code);
      const years = new Set(country.sources.map((s) => s.year));
      for (const s of country.sources) expect(s.url, code).toMatch(/^https?:\/\//);
      const seen = new Set<string>();
      for (const d of country.days) {
        expect(d.date, code).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(Number.isNaN(Date.parse(d.date)), d.date).toBe(false);
        expect(years.has(Number(d.date.slice(0, 4))), `${code} ${d.date} has no source`).toBe(true);
        expect(TYPES.has(d.type), `${code} ${d.type}`).toBe(true);
        expect(d.key, code).toMatch(/^[a-z0-9-]+$/);
        expect(d.local && d.en, `${code} ${d.date}`).toBeTruthy();
        const id = `${d.date} ${d.key} ${d.type}`;
        expect(seen.has(id), `${code} duplicate ${id}`).toBe(false);
        seen.add(id);
      }
    }
  });

  it("answers null for a year a country has not announced", () => {
    calendarCopy("en");
    for (const country of HOLIDAY_COUNTRIES) {
      const years = holidayYears(country).map((y) => y.year);
      expect(holidayDays(country, 2031)).toBeNull();
      for (const y of years) expect(holidayDays(country, y)).not.toBeNull();
    }
  });

  it("anchors the Javanese market week on Jumat Legi, 17 August 1945", () => {
    expect(pasaranOf(dayNumber(1945, 8, 17))).toBe(0);
    expect(pasaranOf(dayNumber(1945, 8, 22))).toBe(0);
    expect(pasaranOf(dayNumber(1945, 8, 18))).toBe(1);
  });
});
