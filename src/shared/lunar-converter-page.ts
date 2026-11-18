/**
 * The solar ↔ lunar converter markup for the /lunar-converter/ tool, on its own so the tool's chunk carries no calendar
 * page builders. Wired by src/client/calendar/converter.ts.
 */
import type { Locale } from "./locale";
import { escapeHtml } from "./device-i18n";
import { CALENDAR_LOCALE } from "./calendar";
import { calendarCopy, longDate, lunarText } from "./calendar-i18n";
import { dayNumber } from "./lunar";

/** The sample (Lunar New Year 2027) is fixed, so the prerendered page and the mounted one match. */
export function converterHtml(locale: Locale): string {
  const c = calendarCopy(locale);
  const cfg = CALENDAR_LOCALE[locale];
  const sample = dayNumber(2027, 2, 6);
  const reck = (["cn", "vn", "kr"] as const).map((z) => `<option value="${z}"${z === cfg.zone ? " selected" : ""}>${escapeHtml((c.ui.reckonings as Record<string, string>)[z])}</option>`).join("");
  return `<section class="wall cal-convert" id="convert">`
    + `<div class="row"><label>${escapeHtml(c.ui.reckoning)} <select data-in="zone">${reck}</select></label></div>`
    + `<h3>${escapeHtml(c.ui.toLunar)}</h3><div class="row"><label>${escapeHtml(c.ui.solarDate)} <input type="date" data-in="solar" value="2027-02-06" min="1900-02-01" max="2100-12-31" data-fixed-date=""></label></div>`
    + `<p class="cal-out" data-out="lunar-result">${escapeHtml(lunarText(locale, sample, cfg.zone))}</p>`
    + `<h3>${escapeHtml(c.ui.toSolar)}</h3><div class="row">`
    + `<label>${escapeHtml(c.ui.lunarYear)} <input type="number" data-in="ly" value="2027" min="1900" max="2100" inputmode="numeric"></label>`
    + `<label>${escapeHtml(c.ui.lunarMonth)} <input type="number" data-in="lm" value="1" min="1" max="12" inputmode="numeric"></label>`
    + `<label>${escapeHtml(c.ui.lunarDay)} <input type="number" data-in="ld" value="1" min="1" max="30" inputmode="numeric"></label>`
    + `<label class="check"><input type="checkbox" data-in="leap"> ${escapeHtml(c.ui.leap)}</label></div>`
    + `<p class="cal-out" data-out="solar-result">${escapeHtml(longDate(locale, sample))}</p></section>`;
}

