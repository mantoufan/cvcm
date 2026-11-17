import type { Locale } from "../../shared/locale";
import { calendarCopy, lunarText } from "../../shared/calendar-i18n";
import { longDate } from "../../shared/calendar-page";
import { dayNumber, fromLunar, type LunarZone } from "../../shared/lunar";

/** Wires the converter markup from `converterHtml` (calendar-page.ts): solar → lunar and lunar → solar, per reckoning. */
export function wireConverter(host: HTMLElement, locale: Locale): void {
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
    if (!m) {
      lunarOut.textContent = "";
      return;
    }
    lunarOut.textContent = lunarText(locale, dayNumber(Number(m[1]), Number(m[2]), Number(m[3])), (zone?.value ?? "cn") as LunarZone);
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

