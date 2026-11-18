import { fill } from "../../shared/fill";
import type { Locale } from "../../shared/locale";
import { CALENDAR_LOCALE, type CalendarPage } from "../../shared/calendar";
import { calendarCopy, isoWeek, lunarText, offsetLabel, stamp, termOffset } from "../../shared/calendar-i18n";
import { calendarPageHtml, longDate } from "../../shared/calendar-page";
import { dayAt, dayNumber, moonPhases, solarTerms } from "../../shared/lunar";

/** The build's prerender (happy-dom) identifies itself; it must not bake the build day in as "today". */
const PRERENDER = typeof navigator !== "undefined" && navigator.userAgent === "cv.cm prerender";

/** Today's day number in the reader's own time zone. */
function today(): number {
  const d = new Date();
  return dayNumber(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function markToday(host: HTMLElement): void {
  const cell = host.querySelector<HTMLElement>(`td[data-day="${today()}"]`);
  if (!cell) return;
  cell.classList.add("is-today");
  cell.setAttribute("aria-current", "date");
}

function fillToday(host: HTMLElement, locale: Locale): void {
  const panel = host.querySelector<HTMLElement>(".cal-today");
  if (!panel) return;
  const c = calendarCopy(locale);
  const cfg = CALENDAR_LOCALE[locale];
  const n = today();
  const out = (key: string, text: string): void => {
    const el = panel.querySelector<HTMLElement>(`[data-out="${key}"]`);
    if (el) el.textContent = text;
  };
  out("date", longDate(locale, n));
  if (cfg.lunar) out("lunar", lunarText(locale, n, cfg.zone));
  out("week", fill(c.ui.isoWeek, { n: isoWeek(n) }));
  const current = [...solarTerms()].reverse().find((t) => dayAt(t.at, termOffset(locale)) <= n);
  out("term", current ? c.solarTerms[current.index] : "—");
  const now = Math.floor(Date.now() / 60000);
  const full = moonPhases().find((p) => p.quarter === 2 && p.at >= now);
  out("full", full ? `${stamp(locale, full.at, cfg.offset)} (${offsetLabel(locale)})` : "—");
  const y = new Date().getFullYear();
  out("left", String(dayNumber(y, 12, 31) - n));
}

export function mountCalendar(host: HTMLElement, locale: Locale, page: CalendarPage): void {
  host.innerHTML = calendarPageHtml(locale, page);
  if (PRERENDER) return;
  markToday(host);
  fillToday(host, locale);
}

export function unmountCalendar(): void {
  /* nothing runs in the background */
}
