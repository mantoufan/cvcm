import { h } from "../dom";
import { t } from "../i18n";
import type { Locale } from "../../shared/locale";
import { compactCurrency, currency, gauge } from "./common";

/** Feature lines shared by the phone, plate and domain valuers, as message keys under `valuation.f_*`. */
export type FeatureLine = { key: string } & Record<string, string | number>;

export function featureText(f: FeatureLine): string {
  const vars: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(f)) if (k !== "key") vars[k] = v;
  return t(`valuation.f_${f.key}`, vars);
}

/**
 * The estimate block: the amount (with its short form), the range, the 0–100 gauge, the tier and what moved the price.
 * Returns the plain-text summary for Copy.
 */
export function paintEstimate(
  out: HTMLElement,
  loc: Locale,
  r: { estimate: number; low: number; high: number; currency: string; score: number; tierLabel: string; lines: string[]; title: string },
): string {
  const amount = r.estimate > 0 ? currency(loc, r.currency, r.estimate) : t("valuation.noPremium");
  const short = r.estimate > 0 ? compactCurrency(loc, r.currency, r.estimate) : "";
  const range = r.estimate > 0 ? t("valuation.range", { low: currency(loc, r.currency, r.low), high: currency(loc, r.currency, r.high) }) : "";
  const parts: Array<HTMLElement | null> = [
    h("p", { class: "hint" }, r.title),
    h("p", { class: "shape-main", "data-out": "estimate" }, amount),
    short && short !== amount ? h("p", { class: "val-short", "data-out": "short" }, short) : null,
    range ? h("p", { class: "val-range", "data-out": "range" }, range) : null,
    gauge(t("valuation.score"), r.score),
    h("p", { class: "val-tier", "data-out": "tier" }, r.tierLabel),
    h("h2", null, t("valuation.why")),
    h("ul", { class: "val-features", "data-out": "features" }, ...r.lines.map((l) => h("li", null, l))),
  ];
  out.replaceChildren(...parts.filter((p): p is HTMLElement => p !== null));
  return [r.title, amount + (short && short !== amount ? ` (${short})` : ""), range, `${t("valuation.score")}: ${r.score}/100`, r.tierLabel, ...r.lines.map((l) => `- ${l}`)]
    .filter(Boolean)
    .join("\n");
}
