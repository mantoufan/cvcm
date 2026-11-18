/**
 * The calendar page HTML (hub, years, months, holiday lists, solar terms, moon phases), shared by the client page and
 * the Worker's crawler copy. Kept out of calendar-i18n so the main bundle, which needs only titles, descriptions and
 * JSON-LD, does not carry the tables. Every value is computed from calendar-data.json and calendar-holidays.json,
 * never from the clock, so the page is the same at build time and in the browser (today is marked by the client).
 */
import type { Locale } from "./locale";
import { escapeHtml } from "./device-i18n";
import { fill } from "./fill";
import { inline, linkListHtml } from "./article-html";
import { calendarMessages, messages } from "./messages";
import { appHref, calendarHref } from "./path";
import { toolsCrumbHtml } from "./channel-parent";
import { HREFLANG } from "./sitemap";
import {
  CALENDAR_LOCALE, CALENDAR_YEARS, HOLIDAY_COUNTRIES, LUNAR_FESTIVALS, calendarView, monthPage,
  type CalendarPage, type HolidayCountry,
} from "./calendar";
import {
  animalIndex, moonPhases, solarTerms, civilDate, dayAt, dayNumber, rokuyo, toLunar, weekday,
  type LunarDate,
} from "./lunar";
import {
  calendarCopy, calendarFaqItems, calendarHeading, calendarLede, countryName, holidayDays, holidayName, holidayYears, holidaysByDay,
  cycleLabel, isoWeek, longBreaks, longDate, termOffset, type HolidayDay,
} from "./calendar-i18n";

const lang = (locale: Locale): string => HREFLANG[locale];

function fmt(locale: Locale, n: number, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(lang(locale), { timeZone: "UTC", ...opts }).format(new Date(n * 86400000));
}

function shortDate(locale: Locale, n: number): string {
  return fmt(locale, n, { month: "short", day: "numeric" });
}
function weekdayName(locale: Locale, n: number, style: "long" | "short" | "narrow" = "short"): string {
  return fmt(locale, n, { weekday: style });
}
export function monthName(locale: Locale, year: number, month: number): string {
  return fmt(locale, dayNumber(year, month, 1), { month: "long" });
}
function timeAt(locale: Locale, at: number, offset: number): string {
  const d = new Date((at + offset * 60) * 60000);
  const day = fmt(locale, Math.floor(d.getTime() / 86400000), { month: "short", day: "numeric", weekday: "short" });
  const hm = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  return `${day} ${hm}`;
}

/** The short lunar label of a day cell, by the locale's style; null when the locale shows none. */
export function lunarCell(locale: Locale, n: number): { text: string; title: string } | null {
  const style = CALENDAR_LOCALE[locale].lunar;
  if (!style) return null;
  const c = calendarMessages(locale);
  const l = toLunar(n, CALENDAR_LOCALE[locale].zone);
  if (!l) return null;
  const full = lunarLabel(locale, l);
  if (style === "ja") return { text: c.rokuyo[rokuyo(l)], title: full };
  if (style === "zh") {
    const festival = festivalOn(locale, n);
    if (festival) return { text: festival, title: full };
    const term = termOn(locale, n);
    if (term) return { text: term, title: full };
    if (l.day === 1) return { text: (l.leap ? c.leapPrefix : "") + c.lunarMonths[l.month - 1], title: full };
    return { text: c.lunarDays[l.day - 1], title: full };
  }
  if (style === "vi") return { text: l.day === 1 ? `${l.day}/${l.month}${l.leap ? "N" : ""}` : String(l.day), title: full };
  return { text: l.day === 1 ? `${l.leap ? c.leapPrefix : ""}${l.month}.1` : String(l.day), title: full };
}

/** "农历丙午年十月初九" / "Ngày 9/10 năm Bính Ngọ" / "음력 10월 9일": the full lunar date. */
export function lunarLabel(locale: Locale, l: LunarDate): string {
  const c = calendarMessages(locale);
  const style = CALENDAR_LOCALE[locale].lunar;
  const month = style === "zh" ? c.lunarMonths[l.month - 1] : String(l.month);
  const day = style === "zh" ? c.lunarDays[l.day - 1] : String(l.day);
  return fill(c.ui.lunarFull, {
    gz: cycleLabel(locale, l.year),
    animal: c.animals[animalIndex(l.year)],
    lm: month,
    ld: day,
    leap: l.leap ? c.leapPrefix : "",
  });
}

function festivalOn(locale: Locale, n: number): string | null {
  const style = CALENDAR_LOCALE[locale].lunar;
  if (style !== "zh" && style !== "vi" && style !== "ko") return null;
  const zone = CALENDAR_LOCALE[locale].zone;
  const l = toLunar(n, zone);
  if (!l || l.leap) return null;
  for (const [m, d, key] of LUNAR_FESTIVALS[style]) {
    if (m !== l.month) continue;
    if (d === l.day || (d === 0 && l.day === l.monthDays)) return (calendarMessages(locale).festivals as Record<string, string>)[key];
  }
  return null;
}

/** Name of the solar term starting on day `n` in the locale's zone, or null. */
function termOn(locale: Locale, n: number): string | null {
  const offset = termOffset(locale);
  const term = solarTerms().find((t) => dayAt(t.at, offset) === n);
  return term ? calendarMessages(locale).solarTerms[term.index] : null;
}


const MOON_MARK = ["●", "◐", "○", "◑"];

function moonOn(locale: Locale, n: number): number | null {
  const offset = CALENDAR_LOCALE[locale].offset;
  const phase = moonPhases().find((p) => dayAt(p.at, offset) === n);
  return phase ? phase.quarter : null;
}

/** 17 August 1945 was a Jumat Legi: the anchor of the five-day Javanese market week. */
const PASARAN_ANCHOR = dayNumber(1945, 8, 17);
export function pasaranOf(n: number): number {
  return (((n - PASARAN_ANCHOR) % 5) + 5) % 5;
}

/** One month as a table: week numbers, weekday columns in the locale's order, and each day's notes. */
export function monthGridHtml(locale: Locale, year: number, month: number, big: boolean, country: HolidayCountry): string {
  const c = calendarMessages(locale);
  const cfg = CALENDAR_LOCALE[locale];
  const first = dayNumber(year, month, 1);
  const days = dayNumber(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1) - first;
  const lead = (weekday(first) - cfg.weekStart + 7) % 7;
  const holidays = holidaysByDay(country);
  const heads = Array.from({ length: 7 }, (_, i) => {
    const sample = dayNumber(2023, 1, 1 + ((i + cfg.weekStart) % 7)); // 2023-01-01 is a Sunday
    return `<th scope="col" abbr="${escapeHtml(weekdayName(locale, sample, "long"))}">${escapeHtml(weekdayName(locale, sample, big ? "short" : "narrow"))}</th>`;
  }).join("");
  const rows: string[] = [];
  let cell = 1 - lead;
  while (cell <= days) {
    // The ISO week of the row's Monday (weeks run Monday–Sunday, so a Sunday-first row is labelled by its Monday).
    const wk = isoWeek(first + cell - 1 + (cfg.weekStart === 0 ? 1 : 0));
    const tds: string[] = [`<th scope="row" class="cal-wk">${wk}</th>`];
    for (let i = 0; i < 7; i++, cell++) {
      if (cell < 1 || cell > days) { tds.push('<td class="cal-pad"></td>'); continue; }
      const n = first + cell - 1;
      const wd = weekday(n);
      const marks = holidays.get(n) ?? [];
      const off = marks.some((h) => h.type !== "workday");
      const work = marks.some((h) => h.type === "workday");
      const cls = ["cal-day", wd === 0 || wd === 6 ? "is-weekend" : "", off ? "is-off" : "", work ? "is-work" : ""].filter(Boolean).join(" ");
      const notes: string[] = [];
      if (big) {
        const lunar = lunarCell(locale, n);
        if (lunar) notes.push(`<span class="cal-lunar" title="${escapeHtml(lunar.title)}">${escapeHtml(lunar.text)}</span>`);
        if (cfg.pasaran) notes.push(`<span class="cal-lunar">${escapeHtml(c.pasaran[pasaranOf(n)])}</span>`);
        const moon = cfg.lunar ? null : moonOn(locale, n);
        if (moon !== null) notes.push(`<span class="cal-moon" title="${escapeHtml(c.quarters[moon])}">${MOON_MARK[moon]} ${escapeHtml(c.quarters[moon])}</span>`);
        for (const h of marks) notes.push(`<span class="cal-hol${h.type === "workday" ? " work" : ""}">${escapeHtml(h.type === "workday" ? c.ui.workShort : holidayName(locale, country, h))}</span>`);
      }
      const title = marks.length && !big ? ` title="${escapeHtml(marks.map((h) => (h.type === "workday" ? c.ui.types.workday : holidayName(locale, country, h))).join(", "))}"` : "";
      tds.push(`<td class="${cls}" data-day="${n}"${title}><span class="cal-n">${cell}</span>${notes.join("")}</td>`);
    }
    rows.push(`<tr>${tds.join("")}</tr>`);
  }
  const caption = big ? "" : `<caption><a href="${escapeHtml(calendarHref(locale, monthPage(year, month)))}" data-nav="calendar-${year}-${String(month).padStart(2, "0")}">${escapeHtml(monthName(locale, year, month))}</a></caption>`;
  return `<table class="cal-grid${big ? " cal-big" : ""}">${caption}<thead><tr><th scope="col" class="cal-wk" abbr="${escapeHtml(c.ui.week)}">${escapeHtml(c.ui.weekShort)}</th>${heads}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
}

function crumbHtml(locale: Locale, page: CalendarPage): string {
  const c = calendarMessages(locale);
  const sep = ` <span aria-hidden="true">/</span> `;
  const parts = [`<a href="${escapeHtml(appHref(locale, null))}" data-nav="home">${escapeHtml(c.crumbHome)}</a>`, toolsCrumbHtml(locale)];
  if (page === "hub") parts.push(`<span>${escapeHtml(c.hub.h1)}</span>`);
  else {
    parts.push(`<a href="${escapeHtml(calendarHref(locale))}" data-nav="calendar">${escapeHtml(c.hub.h1)}</a>`);
    const view = calendarView(page);
    if (view.kind === "month") parts.push(`<a href="${escapeHtml(calendarHref(locale, `${view.year}`))}" data-nav="calendar-${view.year}">${view.year}</a>`);
    parts.push(`<span>${escapeHtml(calendarHeading(locale, page))}</span>`);
  }
  return `<nav class="device-crumb" aria-label="${escapeHtml(messages(locale).ui.nav.breadcrumb)}">${parts.join(sep)}</nav>`;
}

function faqHtml(locale: Locale, page: CalendarPage): string {
  const items = calendarFaqItems(locale, page).map((item, index) => (
    `<details${index === 0 ? " open" : ""}><summary>${inline(item.q)}</summary><p>${inline(item.a)}</p></details>`
  )).join("");
  return `<section class="faq" aria-labelledby="faq-title"><h2 id="faq-title">${escapeHtml(calendarMessages(locale).ui.faq)}</h2>${items}</section>`;
}

function link(locale: Locale, page: CalendarPage, text: string): string {
  return `<a href="${escapeHtml(calendarHref(locale, page))}" data-nav="calendar-${escapeHtml(page)}">${escapeHtml(text)}</a>`;
}

function holidayTableHtml(locale: Locale, country: HolidayCountry, days: readonly HolidayDay[]): string {
  const c = calendarMessages(locale);
  if (!days.length) return `<p class="muted">${escapeHtml(c.ui.noHolidays)}</p>`;
  const types = c.ui.types as Record<string, string>;
  const rows = days.map((h) => {
    const n = dayNumber(...(h.date.split("-").map(Number) as [number, number, number]));
    const name = holidayName(locale, country, h);
    const local = h.local !== name ? `<td lang="${escapeHtml(h.lang)}">${escapeHtml(h.local)}</td>` : "<td></td>";
    return `<tr class="${h.type === "workday" ? "is-work" : ""}"><th scope="row">${escapeHtml(shortDate(locale, n))}</th><td>${escapeHtml(weekdayName(locale, n))}</td><td>${escapeHtml(name)}</td>${local}<td>${escapeHtml(types[h.type] ?? h.type)}</td></tr>`;
  }).join("");
  return `<div class="kb-table"><table><thead><tr><th scope="col">${escapeHtml(c.ui.date)}</th><th scope="col">${escapeHtml(c.ui.weekday)}</th><th scope="col">${escapeHtml(c.ui.name)}</th><th scope="col">${escapeHtml(c.ui.localName)}</th><th scope="col">${escapeHtml(c.ui.type)}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function breaksHtml(locale: Locale, country: HolidayCountry, year: number): string {
  const c = calendarMessages(locale);
  const list = longBreaks(country, year);
  if (!list.length) return "";
  const items = list.map((b) => `<li>${escapeHtml(fill(c.ui.breakLine, { from: shortDate(locale, b.from), to: shortDate(locale, b.to), n: b.to - b.from + 1 }))} · ${escapeHtml(b.names.map((h) => holidayName(locale, country, h)).join(", "))}</li>`).join("");
  return `<h3>${escapeHtml(c.ui.longBreaks)}</h3><ul class="cal-breaks">${items}</ul>`;
}

function termsTableHtml(locale: Locale, years: readonly number[]): string {
  const c = calendarMessages(locale);
  const offset = termOffset(locale);
  const head = `<th scope="col">${escapeHtml(c.ui.term)}</th><th scope="col">${escapeHtml(c.ui.longitude)}</th>${years.map((y) => `<th scope="col">${y}</th>`).join("")}`;
  const rows = Array.from({ length: 24 }, (_, index) => {
    const cells = years.map((y) => {
      const t = solarTerms().find((s) => s.index === index && civilDate(dayAt(s.at, offset))[0] === y);
      return `<td>${t ? escapeHtml(timeAt(locale, t.at, offset)) : "—"}</td>`;
    }).join("");
    return `<tr><th scope="row">${escapeHtml(c.solarTerms[index])}${c.termHan.length ? ` <span lang="zh">${escapeHtml(c.termHan[index])}</span>` : ""}</th><td>${(315 + index * 15) % 360}°</td>${cells}</tr>`;
  }).join("");
  return `<div class="kb-table"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function phasesListHtml(locale: Locale, from: number, to: number): string {
  const c = calendarMessages(locale);
  const offset = CALENDAR_LOCALE[locale].offset;
  const list = moonPhases().filter((p) => { const n = dayAt(p.at, offset); return n >= from && n <= to; });
  if (!list.length) return "";
  return `<ul class="cal-phases">${list.map((p) => `<li${p.quarter === 2 ? ' class="is-full"' : ""}>${MOON_MARK[p.quarter]} <strong>${escapeHtml(c.quarters[p.quarter])}</strong> ${escapeHtml(timeAt(locale, p.at, offset))}</li>`).join("")}</ul>`;
}

function festivalsHtml(locale: Locale, from: number, to: number): string {
  const c = calendarMessages(locale);
  const items: string[] = [];
  for (let n = from; n <= to; n++) {
    const f = festivalOn(locale, n);
    if (f) items.push(`<li>${escapeHtml(shortDate(locale, n))} · ${escapeHtml(f)}</li>`);
  }
  return items.length ? `<h3>${escapeHtml(c.ui.festivals)}</h3><ul class="cal-breaks">${items.join("")}</ul>` : "";
}

function termsInRangeHtml(locale: Locale, from: number, to: number): string {
  const c = calendarMessages(locale);
  const offset = termOffset(locale);
  const list = solarTerms().filter((t) => { const n = dayAt(t.at, offset); return n >= from && n <= to; });
  if (!list.length) return "";
  return `<h3>${link(locale, "solar-terms", c.ui.solarTerms)}</h3><ul class="cal-breaks">${list.map((t) => `<li>${escapeHtml(timeAt(locale, t.at, offset))} · ${escapeHtml(c.solarTerms[t.index])}</li>`).join("")}</ul>`;
}

function sourcesHtml(locale: Locale, country: HolidayCountry): string {
  const c = calendarMessages(locale);
  const notes = (c.countryNotes as Record<string, string[]>)[country] ?? [];
  const sources = holidayYears(country).flatMap((y) => y.sources);
  return `<section class="kb-about"><h2>${escapeHtml(c.ui.sources)}</h2><ul>${sources.map((s) => `<li><a href="${escapeHtml(s.url)}" rel="noopener" target="_blank">${escapeHtml(s.title)}</a></li>`).join("")}</ul>${notes.map((p) => `<p>${inline(p)}</p>`).join("")}</section>`;
}

function otherCountriesHtml(locale: Locale, except: HolidayCountry | null): string {
  return `<p class="slang-jump">${HOLIDAY_COUNTRIES.filter((x) => x !== except).map((x) => link(locale, `holidays/${x}`, countryName(locale, x))).join(" · ")}</p>`;
}

function yearNavHtml(locale: Locale, year: number): string {
  const c = calendarMessages(locale);
  return `<p class="slang-jump">${escapeHtml(c.ui.moreYears)}: ${CALENDAR_YEARS.map((y) => (y === year ? `<strong>${y}</strong>` : link(locale, `${y}`, String(y)))).join(" · ")}</p>`;
}

function monthLinksHtml(locale: Locale, year: number): string {
  return `<p class="slang-jump">${Array.from({ length: 12 }, (_, i) => link(locale, monthPage(year, i + 1)!, monthName(locale, year, i + 1))).join(" · ")}</p>`;
}

function hubHtml(locale: Locale): string {
  const c = calendarMessages(locale);
  const cfg = CALENDAR_LOCALE[locale];
  const years = CALENDAR_YEARS.map((y) => ({ href: calendarHref(locale, `${y}`), name: calendarHeading(locale, `${y}`), nav: `calendar-${y}` }));
  const months = CALENDAR_YEARS.map((y) => `<h3>${y}</h3>${monthLinksHtml(locale, y)}`).join("");
  const countries = HOLIDAY_COUNTRIES.map((x) => ({ href: calendarHref(locale, `holidays/${x}`), name: calendarHeading(locale, `holidays/${x}`), nav: `calendar-holidays/${x}` }));
  const today = `<section class="wall cal-today" id="today"><h2>${escapeHtml(c.hub.today)}</h2><dl class="stats-grid">`
    + `<dt>${escapeHtml(c.ui.today)}</dt><dd data-volatile="" data-out="date">…</dd>`
    + (cfg.lunar ? `<dt>${escapeHtml(c.ui.todayLunar)}</dt><dd data-volatile="" data-out="lunar">…</dd>` : "")
    + `<dt>${escapeHtml(c.ui.week)}</dt><dd data-volatile="" data-out="week">…</dd>`
    + `<dt>${escapeHtml(c.ui.currentTerm)}</dt><dd data-volatile="" data-out="term">…</dd>`
    + `<dt>${escapeHtml(c.ui.nextFull)}</dt><dd data-volatile="" data-out="full">…</dd>`
    + `<dt>${escapeHtml(c.ui.daysLeftLabel)}</dt><dd data-volatile="" data-out="left">…</dd>`
    + `</dl></section>`;
  return [
    crumbHtml(locale, "hub"),
    `<header class="tool-head"><h1>${escapeHtml(c.hub.h1)}</h1><p class="lede">${escapeHtml(c.hub.lede)}</p></header>`,
    today,
    `<section class="wall"><h2>${escapeHtml(c.hub.years)}</h2>${linkListHtml(years)}</section>`,
    `<section class="wall"><h2>${escapeHtml(c.hub.months)}</h2>${months}</section>`,
    `<section class="wall"><h2>${escapeHtml(c.hub.holidays)}</h2>${linkListHtml(countries)}</section>`,
    `<section class="wall"><h2>${escapeHtml(c.hub.more)}</h2>${linkListHtml([
      { href: calendarHref(locale, "solar-terms"), name: calendarHeading(locale, "solar-terms"), nav: "calendar-solar-terms" },
      { href: calendarHref(locale, "moon-phases"), name: calendarHeading(locale, "moon-phases"), nav: "calendar-moon-phases" },
    ])}</section>`,
    `<section class="wall" id="convert"><h2>${escapeHtml(c.hub.converter)}</h2>${linkListHtml([{ href: appHref(locale, "lunar-converter"), name: messages(locale).ui.tools["lunar-converter"].name, blurb: messages(locale).ui.tools["lunar-converter"].blurb, nav: "lunar-converter" }])}</section>`,
    `<section class="kb-about">${c.hub.about.map((p) => `<p>${inline(p)}</p>`).join("")}</section>`,
    faqHtml(locale, "hub"),
  ].join("");
}

function yearHtml(locale: Locale, year: number): string {
  const c = calendarMessages(locale);
  const country = CALENDAR_LOCALE[locale].country;
  const page = `${year}` as CalendarPage;
  const grids = Array.from({ length: 12 }, (_, i) => monthGridHtml(locale, year, i + 1, false, country)).join("");
  const days = holidayDays(country, year);
  const from = dayNumber(year, 1, 1);
  const to = dayNumber(year, 12, 31);
  const holidays = days === null
    ? `<p class="muted">${escapeHtml(fill(c.ui.notAnnounced, { country: countryName(locale, country), y: year }))}</p>`
    : holidayTableHtml(locale, country, days) + breaksHtml(locale, country, year);
  const fulls = moonPhases().filter((p) => p.quarter === 2 && civilDate(dayAt(p.at, CALENDAR_LOCALE[locale].offset))[0] === year);
  return [
    crumbHtml(locale, page),
    `<header class="tool-head"><h1>${escapeHtml(calendarHeading(locale, page))}</h1><p class="lede">${escapeHtml(calendarLede(locale, page))}</p></header>`,
    yearNavHtml(locale, year),
    `<div class="cal-year">${grids}</div>`,
    `<p class="muted cal-note">${escapeHtml(c.ui.weekNumbers)}</p>`,
    `<section class="wall"><h2>${link(locale, `holidays/${country}`, fill(c.ui.holidaysIn, { country: countryName(locale, country) }))} ${year}</h2>${holidays}<h3>${escapeHtml(c.ui.otherCountries)}</h3>${otherCountriesHtml(locale, country)}</section>`,
    `<section class="wall">${festivalsHtml(locale, from, to)}${termsInRangeHtml(locale, from, to)}<h3>${link(locale, "moon-phases", c.quarters[2])}</h3><ul class="cal-phases">${fulls.map((p) => `<li>○ ${escapeHtml(timeAt(locale, p.at, CALENDAR_LOCALE[locale].offset))}</li>`).join("")}</ul></section>`,
    `<p class="muted cal-note">${escapeHtml(c.ui.dataNote)}</p>`,
    faqHtml(locale, page),
  ].join("");
}

function monthHtml(locale: Locale, year: number, month: number): string {
  const c = calendarMessages(locale);
  const country = CALENDAR_LOCALE[locale].country;
  const page = monthPage(year, month)!;
  const from = dayNumber(year, month, 1);
  const to = dayNumber(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1) - 1;
  const prev = month === 1 ? monthPage(year - 1, 12) : monthPage(year, month - 1);
  const next = month === 12 ? monthPage(year + 1, 1) : monthPage(year, month + 1);
  const pager = `<p class="cal-pager">${prev ? link(locale, prev, `← ${monthName(locale, Number(prev.slice(0, 4)), Number(prev.slice(5)))}`) : "<span></span>"}${link(locale, `${year}` as CalendarPage, String(year))}${next ? link(locale, next, `${monthName(locale, Number(next.slice(0, 4)), Number(next.slice(5)))} →`) : "<span></span>"}</p>`;
  const all = holidayDays(country, year);
  const inMonth = all?.filter((h) => h.date.startsWith(page)) ?? null;
  const holidays = inMonth === null
    ? `<p class="muted">${escapeHtml(fill(c.ui.notAnnounced, { country: countryName(locale, country), y: year }))}</p>`
    : holidayTableHtml(locale, country, inMonth);
  return [
    crumbHtml(locale, page),
    `<header class="tool-head"><h1>${escapeHtml(calendarHeading(locale, page))}</h1><p class="lede">${escapeHtml(calendarLede(locale, page))}</p></header>`,
    pager,
    `<div class="cal-month">${monthGridHtml(locale, year, month, true, country)}</div>`,
    `<p class="muted cal-note">${escapeHtml(c.ui.weekNumbers)}</p>`,
    `<section class="wall"><h2>${link(locale, `holidays/${country}`, fill(c.ui.holidaysIn, { country: countryName(locale, country) }))}</h2>${holidays}</section>`,
    `<section class="wall">${festivalsHtml(locale, from, to)}${termsInRangeHtml(locale, from, to)}<h3>${link(locale, "moon-phases", c.ui.moonPhases)}</h3>${phasesListHtml(locale, from, to)}</section>`,
    `<p class="slang-jump">${escapeHtml(c.ui.otherCountries)}: ${HOLIDAY_COUNTRIES.filter((x) => x !== country).map((x) => link(locale, `holidays/${x}`, countryName(locale, x))).join(" · ")}</p>`,
    `<p class="muted cal-note">${escapeHtml(c.ui.dataNote)}</p>`,
    faqHtml(locale, page),
  ].join("");
}

function holidaysHtml(locale: Locale, country: HolidayCountry): string {
  const c = calendarMessages(locale);
  const page = `holidays/${country}` as CalendarPage;
  const years = holidayYears(country).map((y) => y.year).sort((a, b) => b - a);
  const sections = years.map((y) => (
    `<section class="wall" id="y${y}"><h2>${escapeHtml(fill(c.holidays.h1, { country: countryName(locale, country), y }))}</h2>${holidayTableHtml(locale, country, holidayDays(country, y) ?? [])}${breaksHtml(locale, country, y)}${(CALENDAR_YEARS as readonly number[]).includes(y) ? `<p class="slang-jump">${link(locale, `${y}` as CalendarPage, calendarHeading(locale, `${y}` as CalendarPage))}</p>` : ""}</section>`
  )).join("");
  return [
    crumbHtml(locale, page),
    `<header class="tool-head"><h1>${escapeHtml(calendarHeading(locale, page))}</h1><p class="lede">${escapeHtml(calendarLede(locale, page))}</p></header>`,
    sections,
    sourcesHtml(locale, country),
    `<section class="wall"><h2>${escapeHtml(c.ui.otherCountries)}</h2>${otherCountriesHtml(locale, country)}</section>`,
    faqHtml(locale, page),
  ].join("");
}

function termsHtml(locale: Locale): string {
  const c = calendarMessages(locale);
  return [
    crumbHtml(locale, "solar-terms"),
    `<header class="tool-head"><h1>${escapeHtml(calendarHeading(locale, "solar-terms"))}</h1><p class="lede">${escapeHtml(calendarLede(locale, "solar-terms"))}</p></header>`,
    termsTableHtml(locale, CALENDAR_YEARS),
    `<p class="muted cal-note">${escapeHtml(c.ui.dataNote)}</p>`,
    faqHtml(locale, "solar-terms"),
  ].join("");
}

function moonHtml(locale: Locale): string {
  const c = calendarMessages(locale);
  const sections = CALENDAR_YEARS.map((y) => (
    `<section class="wall" id="y${y}"><h2>${y}</h2>${phasesListHtml(locale, dayNumber(y, 1, 1), dayNumber(y, 12, 31))}</section>`
  )).join("");
  return [
    crumbHtml(locale, "moon-phases"),
    `<header class="tool-head"><h1>${escapeHtml(calendarHeading(locale, "moon-phases"))}</h1><p class="lede">${escapeHtml(calendarLede(locale, "moon-phases"))}</p></header>`,
    sections,
    `<p class="muted cal-note">${escapeHtml(c.ui.dataNote)}</p>`,
    faqHtml(locale, "moon-phases"),
  ].join("");
}

export function calendarPageHtml(locale: Locale, page: CalendarPage): string {
  calendarCopy(locale);
  const view = calendarView(page);
  switch (view.kind) {
    case "hub": return hubHtml(locale);
    case "year": return yearHtml(locale, view.year);
    case "month": return monthHtml(locale, view.year, view.month);
    case "holidays": return holidaysHtml(locale, view.country);
    case "solar-terms": return termsHtml(locale);
    case "moon-phases": return moonHtml(locale);
  }
}


// Kept for modules that took the date formatter from here.
export { longDate };
