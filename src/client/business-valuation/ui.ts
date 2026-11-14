import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { labeled, numField } from "../valuation/common";
import { INDUSTRIES, INDUSTRY_MULTIPLES, dcf, multipleRange, type Industry } from "../../shared/business-valuation";
import { parseDecimalInput } from "../../shared/decimal-input";
import { plain } from "../../shared/number-format";

let mounted: { cleanup: () => void } | null = null;

export function mountBusinessValuation(host: HTMLElement): void {
  unmountBusinessValuation();
  const loc = locale();
  let last = "";
  let copyBtn: HTMLButtonElement | null = null;
  const num = (n: number, digits = 0) => plain(loc, n, digits);

  const industry = h("select", { "data-field": "industry", onChange: () => { applyPreset(); paint(); } },
    ...INDUSTRIES.map((i) => h("option", { value: i, selected: i === "services" }, t(`businessValuation.i_${i}`))));
  industry.value = "services";
  const revenue = numField("revenue", "500000", () => paint());
  const profit = numField("profit", "120000", () => paint());
  const eLo = numField("earningsLow", "", () => markCustom());
  const eHi = numField("earningsHigh", "", () => markCustom());
  const rLo = numField("revenueLow", "", () => markCustom());
  const rHi = numField("revenueHigh", "", () => markCustom());
  const cash = numField("cashFlow", "100000", () => paint());
  const growth = numField("growth", "8", () => paint());
  const discount = numField("discount", "18", () => paint());
  const terminal = numField("terminalGrowth", "2", () => paint());
  const years = numField("years", "5", () => paint());

  function applyPreset(): void {
    const id = industry.value as Industry;
    if (id === "custom") return;
    const m = INDUSTRY_MULTIPLES[id];
    eLo.value = num(m.earnings[0], 1);
    eHi.value = num(m.earnings[1], 1);
    rLo.value = num(m.revenue[0], 1);
    rHi.value = num(m.revenue[1], 1);
  }
  function markCustom(): void {
    industry.value = "custom";
    paint();
  }

  const errorEl = h("p", { class: "hint", "aria-live": "polite", "data-out": "error" });
  const mainEl = h("p", { class: "shape-main", "data-out": "range" });
  const rows = h("dl", { class: "stats-grid", "data-out": "rows" });
  const dcfRows = h("tbody", null);

  const paint = () => {
    const v = (el: HTMLInputElement) => parseDecimalInput(el.value, loc) ?? NaN;
    const earn = multipleRange(v(profit), [v(eLo), v(eHi)]);
    const rev = multipleRange(v(revenue), [v(rLo), v(rHi)]);
    const d = dcf({ cashFlow: v(cash), growth: v(growth) / 100, discount: v(discount) / 100, terminalGrowth: v(terminal) / 100, years: v(years) });
    rows.replaceChildren();
    dcfRows.replaceChildren();
    const list: Array<[string, string]> = [];
    const span = (r: [number, number]) => `${num(r[0])} – ${num(r[1])}`;
    if (earn) list.push([t("businessValuation.byEarnings"), span(earn)]);
    if (rev) list.push([t("businessValuation.byRevenue"), span(rev)]);
    if (d.ok) list.push([t("businessValuation.byDcf"), num(d.result.value)]);
    errorEl.textContent = d.ok ? "" : t(`businessValuation.err_${d.error}`);
    const points = [...(earn ?? []), ...(rev ?? []), ...(d.ok ? [d.result.value] : [])].filter((x) => x > 0);
    if (!points.length) {
      mainEl.textContent = "";
      last = "";
      if (!errorEl.textContent) errorEl.textContent = t("businessValuation.err_invalid");
      return;
    }
    // The middle half of the methods' figures: the earnings range is usually the one buyers use for small firms.
    const sorted = [...points].sort((a, b) => a - b);
    const mid = (sorted[Math.floor((sorted.length - 1) / 2)]! + sorted[Math.ceil((sorted.length - 1) / 2)]!) / 2;
    mainEl.textContent = num(mid);
    rows.append(...list.flatMap(([k, val]) => [h("dt", null, k), h("dd", null, val)]));
    if (d.ok) {
      dcfRows.append(...d.result.rows.map((r) => h("tr", null, h("td", null, String(r.year)), h("td", null, num(r.cashFlow)), h("td", null, num(r.pv)))));
      dcfRows.append(h("tr", null, h("td", null, t("businessValuation.terminal")), h("td", null, ""), h("td", null, num(d.result.terminalPv))));
    }
    last = [[t("businessValuation.middle"), num(mid)], ...list].map(([k, val]) => `${k}: ${val}`).join("\n");
  };

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("businessValuation.title")),
      h("p", { class: "lede" }, t("businessValuation.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        labeled(t("businessValuation.industry"), industry),
        h("fieldset", null, h("legend", null, t("businessValuation.multiples")),
          labeled(t("businessValuation.revenue"), revenue),
          labeled(t("businessValuation.profit"), profit),
          h("p", { class: "hint" }, t("businessValuation.profitHint")),
          labeled(t("businessValuation.earningsLow"), eLo),
          labeled(t("businessValuation.earningsHigh"), eHi),
          labeled(t("businessValuation.revenueLow"), rLo),
          labeled(t("businessValuation.revenueHigh"), rHi),
        ),
        h("fieldset", null, h("legend", null, t("businessValuation.dcf")),
          labeled(t("businessValuation.cashFlow"), cash),
          labeled(t("businessValuation.growth"), growth),
          labeled(t("businessValuation.discount"), discount),
          labeled(t("businessValuation.terminalGrowth"), terminal),
          labeled(t("businessValuation.years"), years),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn ghost", "data-action": "copy", onClick: () => void copyWithFlash(copyBtn, last, { done: t("valuation.copied"), failed: t("valuation.copyFailed") }) }, t("valuation.copy")),
        ),
      ),
      h("div", { class: "rail" },
        errorEl,
        h("p", { class: "hint" }, t("businessValuation.middle")),
        mainEl,
        rows,
        h("h2", null, t("businessValuation.dcf")),
        h("div", { class: "table-wrap" },
          h("table", { class: "mil-chart", "data-out": "dcf" },
            h("thead", null, h("tr", null,
              h("th", { scope: "col" }, t("businessValuation.year")),
              h("th", { scope: "col" }, t("businessValuation.cashFlow")),
              h("th", { scope: "col" }, t("businessValuation.pv")),
            )),
            dcfRows,
          ),
        ),
        h("p", { class: "hint" }, t("businessValuation.disclaimer")),
      ),
    ),
  );
  applyPreset();
  paint();
  mounted = { cleanup: () => { copyBtn = null; } };
}

export function unmountBusinessValuation(): void {
  mounted?.cleanup();
  mounted = null;
}
