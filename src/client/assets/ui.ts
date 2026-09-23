import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import {
  OIL_UNITS,
  WEIGHT_UNITS,
  companyMarketCap,
  convertOil,
  convertWeight,
  dividendYield,
  metalPrices,
  peRatio,
  type OilUnit,
  type WeightUnit,
} from "../../shared/markets";

export const METAL_TOOLS = ["gold", "silver", "platinum", "palladium"] as const;
export type MetalTool = (typeof METAL_TOOLS)[number];

let weightEl: HTMLInputElement | null = null;
let unitEl: HTMLSelectElement | null = null;
let priceEl: HTMLInputElement | null = null;
let oilEl: HTMLInputElement | null = null;
let oilUnitEl: HTMLSelectElement | null = null;
let stockEls: HTMLInputElement[] = [];
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";
let copyKey = "stocks.copy";
let copiedKey = "stocks.copied";

export function unmountAssets(): void {
  weightEl = null;
  unitEl = null;
  priceEl = null;
  oilEl = null;
  oilUnitEl = null;
  stockEls = [];
  outEl = null;
  copyBtn = null;
  last = "";
  copyKey = "stocks.copy";
  copiedKey = "stocks.copied";
}

export function mountMetal(host: HTMLElement, id: MetalTool): void {
  weightEl = h("input", { type: "number", min: "0", step: "any", value: "1", "data-field": "weight", onInput: () => paintMetal(id) });
  unitEl = h("select", { "data-field": "unit", onChange: () => paintMetal(id) },
    ...WEIGHT_UNITS.map((unit) => h("option", { value: unit }, t(`${id}.${unit}`))),
  );
  priceEl = h("input", {
    type: "number",
    min: "0",
    step: "any",
    value: "",
    placeholder: t(`${id}.priceHint`),
    "data-field": "usdPerTroyOz",
    onInput: () => paintMetal(id),
  });
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  copyKey = `${id}.copy`;
  copiedKey = `${id}.copied`;
  const others = METAL_TOOLS.filter((other) => other !== id);
  host.append(
    head(id),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t(`${id}.options`)),
          labeled(t(`${id}.weight`), weightEl),
          labeled(t(`${id}.unit`), unitEl),
          labeled(t(`${id}.price`), priceEl),
          h("p", { class: "muted" }, t(`${id}.priceHint`)),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t(copyKey)),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t(`${id}.result`)), outEl),
    ),
    h("p", { class: "muted" }, t(`${id}.disclaimer`)),
    h("p", null,
      ...others.flatMap((other, index) => [
        index ? " · " : "",
        h("a", { href: appHref(locale(), other), "data-nav": other }, t(`${id}.to${cap(other)}`)),
      ]),
      " · ",
      h("a", { href: appHref(locale(), "units"), "data-nav": "units" }, t(`${id}.units`)),
    ),
  );
  paintMetal(id);
}

export function mountOil(host: HTMLElement): void {
  oilEl = h("input", { type: "number", min: "0", step: "any", value: "1", "data-field": "amount", onInput: paintOil });
  oilUnitEl = h("select", { "data-field": "unit", onChange: paintOil },
    ...OIL_UNITS.map((unit) => h("option", { value: unit }, t(`oil.${unit}`))),
  );
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  copyKey = "oil.copy";
  copiedKey = "oil.copied";
  host.append(
    head("oil"),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("oil.options")),
          labeled(t("oil.amount"), oilEl),
          labeled(t("oil.unit"), oilUnitEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t(copyKey)),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("oil.result")), outEl),
    ),
    h("p", { class: "muted" }, t("oil.note")),
    h("p", { class: "muted" }, t("oil.disclaimer")),
  );
  paintOil();
}

export function mountStocks(host: HTMLElement): void {
  const fields = ["price", "shares", "eps", "dividend"] as const;
  stockEls = fields.map((name) => h("input", {
    type: "number",
    min: "0",
    step: "any",
    value: "",
    "data-field": name,
    onInput: paintStocks,
  }));
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  copyKey = "stocks.copy";
  copiedKey = "stocks.copied";
  host.append(
    head("stocks"),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("stocks.options")),
          ...fields.map((name, i) => labeled(t(`stocks.${name}`), stockEls[i]!)),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t(copyKey)),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("stocks.result")), outEl),
    ),
    h("p", { class: "muted" }, t("stocks.note")),
    h("p", { class: "muted" }, t("stocks.disclaimer")),
    h("p", null,
      h("a", { href: appHref(locale(), "loan"), "data-nav": "loan" }, t("stocks.loan")),
      " · ",
      h("a", { href: appHref(locale(), "compound"), "data-nav": "compound" }, t("stocks.compound")),
      " · ",
      h("a", { href: appHref(locale(), "percent"), "data-nav": "percent" }, t("stocks.percent")),
    ),
  );
  paintStocks();
}

function cap(id: string): string {
  return id.slice(0, 1).toUpperCase() + id.slice(1);
}

function head(id: string): HTMLElement {
  return h("header", { class: "tool-head" },
    h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t(`${id}.back`)),
    h("h1", null, t(`${id}.title`)),
    h("p", { class: "lede" }, t(`${id}.privacyNote`)),
  );
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function trim(value: number): string {
  const abs = Math.abs(value);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
  return value.toFixed(digits).replace(/\.?0+$/, "");
}

function readNumber(el: HTMLInputElement): number | null {
  if (el.value.trim() === "") return null;
  const value = Number(el.value);
  return Number.isFinite(value) ? value : null;
}

function paintMetal(id: MetalTool): void {
  if (!weightEl || !unitEl || !priceEl || !outEl) return;
  const weight = readNumber(weightEl);
  const weights = weight == null ? null : convertWeight(weight, unitEl.value as WeightUnit);
  const typed = priceEl.value.trim() === "" ? null : readNumber(priceEl);
  const prices = typed == null ? null : metalPrices(typed);
  outEl.replaceChildren();
  if (!weights) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t(`${id}.invalid`)));
    return;
  }
  const rows: Array<[string, string]> = WEIGHT_UNITS.map((unit) => [t(`${id}.${unit}`), trim(weights[unit])]);
  if (prices) {
    rows.push(
      [t(`${id}.perGram`), trim(prices.perGram)],
      [t(`${id}.perTroyOz`), trim(prices.perTroyOz)],
      [t(`${id}.perHk`), trim(prices.perHkTael)],
      [t(`${id}.perMarket`), trim(prices.perMarketTael)],
      [t(`${id}.perTw`), trim(prices.perTwTael)],
    );
  }
  last = rows.map((row) => `${row[0]}: ${row[1]}`).join("\n");
  for (const [label, value] of rows) outEl.append(h("dt", null, label), h("dd", null, value));
}

function paintOil(): void {
  if (!oilEl || !oilUnitEl || !outEl) return;
  const amount = readNumber(oilEl);
  const volumes = amount == null ? null : convertOil(amount, oilUnitEl.value as OilUnit);
  outEl.replaceChildren();
  if (!volumes) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("oil.invalid")));
    return;
  }
  const rows = OIL_UNITS.map((unit) => [t(`oil.${unit}`), trim(volumes[unit])] as [string, string]);
  last = rows.map((row) => `${row[0]}: ${row[1]}`).join("\n");
  for (const [label, value] of rows) outEl.append(h("dt", null, label), h("dd", null, value));
}

function paintStocks(): void {
  if (!outEl || stockEls.length < 4) return;
  const [priceInput, sharesInput, epsInput, dividendInput] = stockEls;
  const price = readNumber(priceInput!);
  const shares = readNumber(sharesInput!);
  const eps = readNumber(epsInput!);
  const dividend = readNumber(dividendInput!);
  const any = stockEls.some((el) => el.value.trim() !== "");
  outEl.replaceChildren();
  if (!any) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("stocks.invalid")));
    return;
  }
  const cap = price != null && shares != null ? companyMarketCap(price, shares) : null;
  const pe = price != null && eps != null ? peRatio(price, eps) : null;
  const yieldPct = price != null && dividend != null ? dividendYield(price, dividend) : null;
  const rows: Array<[string, string]> = [
    [t("stocks.marketCap"), cap == null ? t("stocks.blank") : trim(cap)],
    [t("stocks.pe"), pe == null ? t("stocks.blank") : trim(pe)],
    [t("stocks.yield"), yieldPct == null ? t("stocks.blank") : `${trim(yieldPct)}%`],
  ];
  last = rows.map((row) => `${row[0]}: ${row[1]}`).join("\n");
  for (const [label, value] of rows) outEl.append(h("dt", null, label), h("dd", null, value));
}

async function copyOut(): Promise<void> {
  if (!last) return;
  try {
    await navigator.clipboard.writeText(last);
    if (copyBtn) copyBtn.textContent = t(copiedKey);
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t(copyKey);
    }, 1200);
  } catch { /* ignore */ }
}
