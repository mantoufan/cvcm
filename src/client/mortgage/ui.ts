import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { MAX_PRICE, MAX_YEARS, mortgage, type MortgageMethod } from "../../shared/mortgage";

let priceEl: HTMLInputElement | null = null;
let downEl: HTMLInputElement | null = null;
let rateEl: HTMLInputElement | null = null;
let yearsEl: HTMLInputElement | null = null;
let methodEl: HTMLSelectElement | null = null;
let errorEl: HTMLElement | null = null;
let outEl: HTMLElement | null = null;
let tableEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountMortgage(host: HTMLElement): void {
  const input = (field: string, value: string, step: string, min = "0", max?: string) =>
    h("input", { type: "number", inputmode: "decimal", min, max, step, value, "data-field": field, onInput: () => paint() });
  priceEl = input("price", "400000", "1000", "0", String(MAX_PRICE));
  downEl = input("down", "20", "1", "0", "99.99");
  rateEl = input("rate", "6.5", "0.01", "0", "100");
  yearsEl = input("years", "30", "1", "1", String(MAX_YEARS));
  methodEl = h("select", { "data-field": "method", onChange: () => paint() },
    h("option", { value: "annuity", selected: true }, t("mortgage.annuity")),
    h("option", { value: "principal" }, t("mortgage.equalPrincipal")),
  );
  errorEl = h("p", { class: "hint", "aria-live": "polite", "data-out": "error" });
  outEl = h("dl", { class: "stats-grid", "data-out": "result" });
  tableEl = h("div", { class: "kb-table", "data-out": "schedule" });
  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("mortgage.title")),
      h("p", { class: "lede" }, t("mortgage.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("mortgage.options")),
          labeled(t("mortgage.price"), priceEl),
          labeled(t("mortgage.down"), downEl),
          labeled(t("mortgage.rate"), rateEl),
          labeled(t("mortgage.years"), yearsEl),
          labeled(t("mortgage.method"), methodEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn ghost", "data-action": "copy", onClick: () => void copyWithFlash(copyBtn, last, { done: t("mortgage.copied"), failed: t("mortgage.copyFailed") }) }, t("mortgage.copy")),
        ),
        h("p", { class: "hint" }, t("mortgage.hint")),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("mortgage.result")),
        errorEl,
        outEl,
        h("h2", null, t("mortgage.schedule")),
        tableEl,
      ),
    ),
  );
  paint();
}

export function unmountMortgage(): void {
  priceEl = downEl = rateEl = yearsEl = null;
  methodEl = null;
  errorEl = outEl = tableEl = null;
  copyBtn = null;
  last = "";
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

/** Decimals for this result: 2, or 0 when the total reaches 10^13, where a double no longer holds cents. */
let decimals = 2;

function fmt(n: number): string {
  return new Intl.NumberFormat(locale(), { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
}

function fmtWhole(n: number): string {
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(n);
}

function paint(): void {
  if (!priceEl || !downEl || !rateEl || !yearsEl || !methodEl || !errorEl || !outEl || !tableEl) return;
  const method = methodEl.value as MortgageMethod;
  const input = {
    price: priceEl.value === "" ? NaN : Number(priceEl.value),
    downPct: downEl.value === "" ? 0 : Number(downEl.value),
    rate: rateEl.value === "" ? NaN : Number(rateEl.value),
    years: yearsEl.value === "" ? NaN : Number(yearsEl.value),
    method,
  };
  const res = mortgage(input);
  outEl.replaceChildren();
  tableEl.replaceChildren();
  errorEl.textContent = "";
  last = "";
  if (!res) {
    const tooBig = input.price > MAX_PRICE;
    // Over the limit, still say whether the other fields are fine.
    const othersBad = !tooBig || !mortgage({ ...input, price: 1 });
    errorEl.textContent = [tooBig ? t("mortgage.tooBig", { max: fmtWhole(MAX_PRICE) }) : "", othersBad ? t("mortgage.invalid", { n: MAX_YEARS }) : ""].filter(Boolean).join(" ");
    return;
  }
  // One precision for the whole result and table, so columns line up.
  decimals = res.total >= 1e13 ? 0 : 2;
  const rows: Array<[string, string]> = [[t("mortgage.loan"), fmt(res.loan)]];
  if (method === "annuity") rows.push([t("mortgage.monthly"), fmt(res.firstPayment)]);
  else {
    rows.push([t("mortgage.firstMonth"), fmt(res.firstPayment)]);
    rows.push([t("mortgage.lastMonth"), fmt(res.lastPayment)]);
    rows.push([t("mortgage.drop"), fmt(res.monthlyDrop)]);
  }
  rows.push(
    [t("mortgage.downAmount"), fmt(res.down)],
    [t("mortgage.interest"), fmt(res.interest)],
    [t("mortgage.total"), fmt(res.total)],
    [t("mortgage.payments"), String(res.months)],
  );
  outEl.append(...rows.flatMap(([k, v]) => [h("dt", null, k), h("dd", null, v)]));
  // The inputs go first, so a pasted summary can be read and redone on its own.
  const inputs: Array<[string, string]> = [
    [t("mortgage.price"), priceEl.value],
    [t("mortgage.down"), downEl.value || "0"],
    [t("mortgage.rate"), rateEl.value],
    [t("mortgage.years"), yearsEl.value],
    [t("mortgage.method"), methodEl.selectedOptions[0]?.textContent ?? ""],
  ];
  last = [...inputs, ...rows].map(([k, v]) => `${k}: ${v}`).join("\n");
  tableEl.append(
    h("table", null,
      h("thead", null, h("tr", null, ...["year", "principalPaid", "interestPaid", "balance"].map((k) => h("th", { scope: "col" }, t(`mortgage.${k}`))))),
      h("tbody", null, ...res.schedule.map((y) => h("tr", null,
        h("th", { scope: "row" }, String(y.year)),
        h("td", null, fmt(y.principal)),
        h("td", null, fmt(y.interest)),
        h("td", null, fmt(y.balance)),
      ))),
    ),
  );
}
