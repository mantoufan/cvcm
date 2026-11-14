import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { labeled, numField } from "../valuation/common";
import { AVERAGE_YEARLY, CAR_CONDITIONS, CAR_SEGMENTS, carValue, type CarCondition, type CarSegment } from "../../shared/car-depreciation";
import { parseDecimalInput, parseMoneyInput } from "../../shared/decimal-input";
import { plain } from "../../shared/number-format";

let mounted: { cleanup: () => void } | null = null;

const SVG = "http://www.w3.org/2000/svg";

export function mountCarDepreciation(host: HTMLElement): void {
  unmountCarDepreciation();
  const loc = locale();
  let last = "";
  let copyBtn: HTMLButtonElement | null = null;
  const unit0: "mi" | "km" = loc === "en" ? "mi" : "km";

  const price = numField("price", "30000", () => paint());
  const years = numField("years", "5", () => paint());
  const distance = numField("distance", String(Math.round(AVERAGE_YEARLY[unit0])), () => paint());
  let unit: "mi" | "km" = unit0;
  // Switching units converts the typed distance, so the car itself does not change.
  const unitSel = h("select", { "data-field": "unit", onChange: () => {
    const next = unitSel.value as "mi" | "km";
    const d = parseMoneyInput(distance.value, loc);
    if (d !== undefined && Number.isFinite(d) && next !== unit) {
      distance.value = String(Math.round(next === "km" ? d * 1.609344 : d / 1.609344));
    }
    unit = next;
    paint();
  } },
    h("option", { value: "mi", selected: unit0 === "mi" }, t("carDepreciation.mi")),
    h("option", { value: "km", selected: unit0 === "km" }, t("carDepreciation.km")),
  );
  unitSel.value = unit0;
  const segmentSel = h("select", { "data-field": "segment", onChange: () => paint() },
    ...CAR_SEGMENTS.map((s) => h("option", { value: s }, t(`carDepreciation.s_${s}`))));
  const conditionSel = h("select", { "data-field": "condition", onChange: () => paint() },
    ...CAR_CONDITIONS.map((c) => h("option", { value: c, selected: c === "good" }, t(`carDepreciation.c_${c}`))));
  conditionSel.value = "good";

  const errorEl = h("p", { class: "hint", "aria-live": "polite", "data-out": "error" });
  const mainEl = h("p", { class: "shape-main", "data-out": "value" });
  const rows = h("dl", { class: "stats-grid", "data-out": "rows" });
  const chart = h("div", { class: "val-chart", "data-out": "chart" });
  const table = h("tbody", null);

  const money = (n: number) => plain(loc, Math.round(n));
  const pct = (n: number) => `${plain(loc, n, 1)}%`;

  const paint = () => {
    const p = parseMoneyInput(price.value, loc);
    const y = parseDecimalInput(years.value, loc);
    const d = parseMoneyInput(distance.value, loc);
    const r = carValue({
      price: p ?? NaN,
      years: y ?? NaN,
      segment: segmentSel.value as CarSegment,
      condition: conditionSel.value as CarCondition,
      yearlyDistance: d ?? NaN,
      unit: unitSel.value as "mi" | "km",
    });
    rows.replaceChildren();
    table.replaceChildren();
    chart.replaceChildren();
    if (r && (d === undefined || Number.isNaN(d) || d < 0)) {
      mainEl.textContent = "";
      last = "";
      errorEl.textContent = t("carDepreciation.err_distance");
      return;
    }
    if (!r) {
      mainEl.textContent = "";
      last = "";
      errorEl.textContent = t("carDepreciation.err_invalid");
      return;
    }
    errorEl.textContent = "";
    mainEl.textContent = money(r.value);
    const list: Array<[string, string]> = [
      [t("carDepreciation.value"), money(r.value)],
      [t("carDepreciation.lost"), money(r.lost)],
      [t("carDepreciation.lostPct"), pct(r.lostPct)],
      [t("carDepreciation.left"), pct(100 - r.lostPct)],
    ];
    rows.append(...list.flatMap(([k, v]) => [h("dt", null, k), h("dd", null, v)]));
    last = list.map(([k, v]) => `${k}: ${v}`).join("\n");
    table.append(...r.schedule.map((s) => h("tr", null, h("td", null, String(s.year)), h("td", null, money(s.value)), h("td", null, pct(s.lostPct)))));
    // One bar per year, value at average distance and in good condition.
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", "0 0 330 120");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", t("carDepreciation.chart"));
    const max = r.schedule[0]!.value;
    r.schedule.forEach((s, i) => {
      const bh = (s.value / max) * 96;
      const rect = document.createElementNS(SVG, "rect");
      rect.setAttribute("x", String(6 + i * 29.5));
      rect.setAttribute("y", String(100 - bh));
      rect.setAttribute("width", "22");
      rect.setAttribute("height", String(bh));
      rect.setAttribute("rx", "3");
      rect.setAttribute("class", "val-bar");
      const label = document.createElementNS(SVG, "text");
      label.setAttribute("x", String(17 + i * 29.5));
      label.setAttribute("y", "114");
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("class", "val-axis");
      label.textContent = String(s.year);
      svg.append(rect, label);
    });
    chart.append(svg);
  };

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("carDepreciation.title")),
      h("p", { class: "lede" }, t("carDepreciation.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        labeled(t("carDepreciation.price"), price),
        labeled(t("carDepreciation.years"), years),
        labeled(t("carDepreciation.segment"), segmentSel),
        labeled(t("carDepreciation.condition"), conditionSel),
        labeled(t("carDepreciation.distance"), distance),
        labeled(t("carDepreciation.unit"), unitSel),
        h("p", { class: "hint" }, t("carDepreciation.hint")),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn ghost", "data-action": "copy", onClick: () => void copyWithFlash(copyBtn, last, { done: t("valuation.copied"), failed: t("valuation.copyFailed") }) }, t("valuation.copy")),
        ),
      ),
      h("div", { class: "rail" },
        errorEl,
        mainEl,
        rows,
        h("h2", null, t("carDepreciation.chart")),
        chart,
        h("div", { class: "table-wrap" },
          h("table", { class: "mil-chart", "data-out": "schedule" },
            h("thead", null, h("tr", null,
              h("th", { scope: "col" }, t("carDepreciation.year")),
              h("th", { scope: "col" }, t("carDepreciation.value")),
              h("th", { scope: "col" }, t("carDepreciation.lostPct")),
            )),
            table,
          ),
        ),
        h("p", { class: "hint" }, t("carDepreciation.disclaimer")),
      ),
    ),
  );
  paint();
  mounted = { cleanup: () => { copyBtn = null; } };
}

export function unmountCarDepreciation(): void {
  mounted?.cleanup();
  mounted = null;
}
