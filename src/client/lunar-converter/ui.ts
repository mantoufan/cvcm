import { h } from "../dom";
import { locale as currentLocale, t } from "../i18n";
import { calendarHref } from "../../shared/path";
import { CALENDAR_YEARS } from "../../shared/calendar";
import { converterHtml } from "../../shared/calendar-page";
import { wireConverter } from "../calendar/converter";

/**
 * Solar ↔ lunar date converter: the calendar's own lunar tables (1900–2100, Chinese UTC+8, Vietnamese UTC+7, Korean /
 * Japanese UTC+9) and the calendar pack's lunar month names, which this tool page loads (main.ts `calendar`).
 */
export function mountLunarConverter(host: HTMLElement): void {
  const locale = currentLocale();
  const box = h("div");
  box.innerHTML = converterHtml(locale);
  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("tools.lunar-converter.name")),
      h("p", { class: "lede" }, t("lunarConverter.lede")),
    ),
    box,
    h("p", { class: "slang-jump" },
      h("a", { href: calendarHref(locale), "data-nav": "calendar" }, t("nav.calendar")),
      ...CALENDAR_YEARS.flatMap((y) => [" · ", h("a", { href: calendarHref(locale, `${y}`), "data-nav": `calendar-${y}` }, String(y))]),
    ),
  );
  wireConverter(box, locale);
}

export function unmountLunarConverter(): void {
  /* listeners go with the page */
}
