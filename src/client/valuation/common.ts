import { h } from "../dom";
import type { Locale } from "../../shared/locale";
import { numberFormat } from "../../shared/number-format";

/** A whole amount in a currency: ¥15,000, 35.000.000.000 ₫, £1,200. */
export function currency(loc: Locale, code: string, n: number): string {
  return numberFormat(loc, { style: "currency", currency: code, maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(n);
}

/** The short form beside large amounts (35 tỷ, 1200万, 1.2M), or "" when it would just repeat the number. */
export function compactCurrency(loc: Locale, code: string, n: number): string {
  if (n < 10_000) return "";
  return numberFormat(loc, { style: "currency", currency: code, notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** A 0–100 bar with its number, for "how sought after" scores. */
export function gauge(label: string, score: number): HTMLElement {
  const fill = h("span", { class: "val-gauge-fill" });
  fill.style.width = `${Math.max(2, Math.min(100, score))}%`;
  return h("div", { class: "val-gauge", "data-out": "score", role: "meter", "aria-label": label, "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(score) },
    h("span", { class: "val-gauge-label" }, label),
    h("span", { class: "val-gauge-track" }, fill),
    h("span", { class: "val-gauge-num" }, String(score)),
  );
}

export function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

/** A number field read with the page's decimal mark, empty → undefined. */
export function numField(field: string, value: string, onInput: () => void): HTMLInputElement {
  return h("input", { type: "text", inputmode: "decimal", autocomplete: "off", "data-field": field, value, onInput });
}
