import { h } from "../dom";
import { locale as currentLocale } from "../i18n";
import { MARKET_COVER } from "../covers";
import { appHref, marketsHref } from "../../shared/path";
import {
  WEIGHT_UNITS,
  companyMarketCap,
  convertWeight,
  dividendYield,
  metalPrices,
  peRatio,
  type MarketId,
  type WeightUnit,
} from "../../shared/markets";
import {
  marketCopy,
  marketFaqItems,
  marketHub,
  marketHubFaqItems,
  marketUi,
  type MarketFaq,
} from "../../shared/markets-i18n";
import type { Locale } from "../../shared/locale";

let weightEl: HTMLInputElement | null = null;
let unitEl: HTMLSelectElement | null = null;
let priceEl: HTMLInputElement | null = null;
let stockEls: HTMLInputElement[] = [];
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function marketTile(loc: Locale, id: MarketId): HTMLElement {
  const copy = marketCopy(loc, id);
  return h("a", {
    class: "tile",
    href: marketsHref(loc, id),
    "data-nav": `markets-${id}`,
  },
    h("div", { class: "tile-cover" },
      h("img", {
        src: MARKET_COVER[id],
        alt: copy.name,
        width: "640",
        height: "360",
        loading: "lazy",
      }),
    ),
    h("div", { class: "tile-body" },
      h("h3", null, copy.name),
      h("p", null, copy.blurb),
    ),
  );
}

export function mountMarketsHub(host: HTMLElement): void {
  const loc = currentLocale();
  const hub = marketHub(loc);
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(loc, null), "data-nav": "home" }, marketUi(loc).home),
      h("h1", null, hub.h1),
      h("p", { class: "lede" }, hub.lead),
    ),
    h("div", { class: "tiles" },
      ...(["gold", "silver", "stocks"] as const).map((id) => marketTile(loc, id)),
    ),
    h("p", { class: "muted" }, hub.disclaimer),
    faqBlock(marketHubFaqItems(loc)),
  );
}

export function mountMarket(host: HTMLElement, id: MarketId): void {
  if (id === "stocks") mountStocks(host);
  else mountMetal(host, id);
}

export function unmountMarket(): void {
  weightEl = null;
  unitEl = null;
  priceEl = null;
  stockEls = [];
  outEl = null;
  copyBtn = null;
  last = "";
}

function mountMetal(host: HTMLElement, id: "gold" | "silver"): void {
  const loc = currentLocale();
  const copy = marketCopy(loc, id);
  const ui = marketUi(loc);
  const hub = marketHub(loc);
  weightEl = h("input", { type: "number", min: "0", step: "any", value: "1", "data-field": "weight", onInput: paintMetal });
  unitEl = h("select", { "data-field": "unit", onChange: paintMetal },
    ...WEIGHT_UNITS.map((unit) => h("option", { value: unit }, ui[unit])),
  );
  priceEl = h("input", {
    type: "number",
    min: "0",
    step: "any",
    value: "",
    placeholder: ui.priceHint,
    "data-field": "usdPerTroyOz",
    onInput: paintMetal,
  });
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  const other = id === "gold" ? "silver" : "gold";
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: marketsHref(loc, null), "data-nav": "markets" }, ui.back),
      h("h1", null, copy.h1),
      h("p", { class: "lede" }, copy.lead),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, copy.name),
          labeled(ui.weight, weightEl),
          labeled(ui.unit, unitEl),
          labeled(ui.price, priceEl),
          h("p", { class: "muted" }, ui.priceHint),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut(ui) }, ui.copy),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, ui.result), outEl),
    ),
    h("p", { class: "muted" }, hub.disclaimer),
    h("p", null,
      h("a", { href: marketsHref(loc, other), "data-nav": `markets-${other}` }, ui[other === "gold" ? "toGold" : "toSilver"]),
      " · ",
      h("a", { href: appHref(loc, "units"), "data-nav": "units" }, ui.units),
    ),
    faqBlock(marketFaqItems(loc, id)),
  );
  paintMetal();
}

function mountStocks(host: HTMLElement): void {
  const loc = currentLocale();
  const copy = marketCopy(loc, "stocks");
  const ui = marketUi(loc);
  const hub = marketHub(loc);
  const fields: Array<[keyof typeof ui, string]> = [
    ["price", "price"],
    ["shares", "shares"],
    ["eps", "eps"],
    ["dividend", "dividend"],
  ];
  stockEls = fields.map(([, name]) => h("input", {
    type: "number",
    min: "0",
    step: "any",
    value: "",
    "data-field": name,
    onInput: paintStocks,
  }));
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: marketsHref(loc, null), "data-nav": "markets" }, ui.back),
      h("h1", null, copy.h1),
      h("p", { class: "lede" }, copy.lead),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, copy.name),
          ...fields.map(([label], i) => labeled(ui[label], stockEls[i]!)),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut(ui) }, ui.copy),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, ui.result), outEl),
    ),
    h("p", { class: "muted" }, ui.note),
    h("p", { class: "muted" }, hub.disclaimer),
    h("p", null,
      h("a", { href: appHref(loc, "loan"), "data-nav": "loan" }, ui.loan),
      " · ",
      h("a", { href: appHref(loc, "compound"), "data-nav": "compound" }, ui.compound),
      " · ",
      h("a", { href: appHref(loc, "percent"), "data-nav": "percent" }, ui.percent),
    ),
    faqBlock(marketFaqItems(loc, "stocks")),
  );
  paintStocks();
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function faqBlock(items: MarketFaq[]): HTMLElement {
  return h("section", { class: "faq" },
    ...items.map((item, i) =>
      h("details", i === 0 ? { open: true } : null,
        h("summary", null, item.q),
        h("p", null, item.a),
      ),
    ),
  );
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

function paintMetal(): void {
  if (!weightEl || !unitEl || !priceEl || !outEl) return;
  const ui = marketUi(currentLocale());
  const weight = readNumber(weightEl);
  const weights = weight == null ? null : convertWeight(weight, unitEl.value as WeightUnit);
  const typed = priceEl.value.trim() === "" ? null : readNumber(priceEl);
  const prices = typed == null ? null : metalPrices(typed);
  outEl.replaceChildren();
  if (!weights) {
    last = "";
    outEl.append(h("p", { class: "muted" }, ui.invalid));
    return;
  }
  const rows: Array<[string, string]> = WEIGHT_UNITS.map((unit) => [ui[unit], trim(weights[unit])]);
  if (prices) {
    rows.push(
      [ui.perGram, trim(prices.perGram)],
      [ui.perTroyOz, trim(prices.perTroyOz)],
      [ui.perHk, trim(prices.perHkTael)],
      [ui.perMarket, trim(prices.perMarketTael)],
      [ui.perTw, trim(prices.perTwTael)],
    );
  }
  last = rows.map((row) => `${row[0]}: ${row[1]}`).join("\n");
  for (const [label, value] of rows) outEl.append(h("dt", null, label), h("dd", null, value));
}

function paintStocks(): void {
  if (!outEl || stockEls.length < 4) return;
  const ui = marketUi(currentLocale());
  const [priceEl, sharesEl, epsEl, dividendEl] = stockEls;
  const price = readNumber(priceEl!);
  const shares = readNumber(sharesEl!);
  const eps = readNumber(epsEl!);
  const dividend = readNumber(dividendEl!);
  const any = [priceEl!, sharesEl!, epsEl!, dividendEl!].some((el) => el.value.trim() !== "");
  outEl.replaceChildren();
  if (!any) {
    last = "";
    outEl.append(h("p", { class: "muted" }, ui.stockInvalid));
    return;
  }
  const cap = price != null && shares != null ? companyMarketCap(price, shares) : null;
  const pe = price != null && eps != null ? peRatio(price, eps) : null;
  const yieldPct = price != null && dividend != null ? dividendYield(price, dividend) : null;
  const rows: Array<[string, string]> = [
    [ui.marketCap, cap == null ? ui.blank : trim(cap)],
    [ui.pe, pe == null ? ui.blank : trim(pe)],
    [ui.yield, yieldPct == null ? ui.blank : `${trim(yieldPct)}%`],
  ];
  last = rows.map((row) => `${row[0]}: ${row[1]}`).join("\n");
  for (const [label, value] of rows) outEl.append(h("dt", null, label), h("dd", null, value));
}

async function copyOut(ui: { copy: string; copied: string }): Promise<void> {
  if (!last) return;
  try {
    await navigator.clipboard.writeText(last);
    if (copyBtn) copyBtn.textContent = ui.copied;
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = ui.copy;
    }, 1200);
  } catch { /* ignore */ }
}
