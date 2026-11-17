import { fill } from "../../shared/fill";
import type { Locale } from "../../shared/locale";
import { CALENDAR_LOCALE, type CalendarPage } from "../../shared/calendar";
import { calendarCopy, isoWeek, offsetLabel } from "../../shared/calendar-i18n";
import { calendarPageHtml, longDate, lunarLine } from "../../shared/calendar-page";
import { dayAt, dayNumber, fromLunar, moonPhases, solarTerms, type LunarZone } from "../../shared/lunar";

/** The build's prerender (happy-dom) identifies itself; it must not bake the build day in as "today". */
const PRERENDER = typeof navigator !== "undefined" && navigator.userAgent === "cv.cm prerender";

/** Today's day number in the reader's own time zone. */
function today(): number {
  const d = new Date();
  return dayNumber(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function stamp(locale: Locale, at: number, offset: number): string {
  const d = new Date((at + offset * 60) * 60000);
  return `${longDate(locale, Math.floor(d.getTime() / 86400000))} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
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
  if (cfg.lunar) out("lunar", lunarLine(locale, n, cfg.zone));
  out("week", fill(c.ui.isoWeek, { n: isoWeek(n) }));
  const termOffset = cfg.lunar ? { vn: 7, cn: 8, kr: 9 }[cfg.zone] : cfg.offset;
  const current = [...solarTerms()].reverse().find((t) => dayAt(t.at, termOffset) <= n);
  out("term", current ? c.solarTerms[current.index] : "—");
  const now = Math.floor(Date.now() / 60000);
  const full = moonPhases().find((p) => p.quarter === 2 && p.at >= now);
  out("full", full ? `${stamp(locale, full.at, cfg.offset)} (${offsetLabel(locale)})` : "—");
  const y = new Date().getFullYear();
  out("left", String(dayNumber(y, 12, 31) - n));
}

function wireConverter(host: HTMLElement, locale: Locale): void {
  const box = host.querySelector<HTMLElement>(".cal-convert");
  if (!box) return;
  const c = calendarCopy(locale);
  const field = <T extends HTMLElement>(key: string): T | null => box.querySelector<T>(`[data-in="${key}"]`);
  const zone = field<HTMLSelectElement>("zone");
  const solar = field<HTMLInputElement>("solar");
  const ly = field<HTMLInputElement>("ly");
  const lm = field<HTMLInputElement>("lm");
  const ld = field<HTMLInputElement>("ld");
  const leap = field<HTMLInputElement>("leap");
  const lunarOut = box.querySelector<HTMLElement>('[data-out="lunar-result"]');
  const solarOut = box.querySelector<HTMLElement>('[data-out="solar-result"]');
  const toLunarNow = (): void => {
    if (!solar || !lunarOut) return;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(solar.value);
    if (!m) return;
    lunarOut.textContent = lunarLine(locale, dayNumber(Number(m[1]), Number(m[2]), Number(m[3])), (zone?.value ?? "cn") as LunarZone);
  };
  const toSolarNow = (): void => {
    if (!ly || !lm || !ld || !solarOut) return;
    const y = Number(ly.value);
    if (!Number.isInteger(y) || y < 1900 || y > 2100) {
      solarOut.textContent = c.ui.outOfRange;
      return;
    }
    const n = fromLunar(y, Number(lm.value), Number(ld.value), Boolean(leap?.checked), (zone?.value ?? "cn") as LunarZone);
    solarOut.textContent = n === null ? c.ui.noSuchDate : longDate(locale, n);
  };
  solar?.addEventListener("input", toLunarNow);
  for (const el of [ly, lm, ld, leap]) el?.addEventListener("input", toSolarNow);
  zone?.addEventListener("change", () => {
    toLunarNow();
    toSolarNow();
  });
}

export function mountCalendar(host: HTMLElement, locale: Locale, page: CalendarPage): void {
  host.innerHTML = calendarPageHtml(locale, page);
  wireConverter(host, locale);
  if (PRERENDER) return;
  markToday(host);
  fillToday(host, locale);
}

export function unmountCalendar(): void {
  /* nothing runs in the background */
}
