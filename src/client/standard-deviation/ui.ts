import { h } from "../dom";
import { locale, t } from "../i18n";
import { MAX_VALUES, parseNumbers, type DecimalMark } from "../../shared/average";
import { standardDeviation, type SdKind } from "../../shared/academic-stats";
import { copyButton, decimalSelect, field, fmt, layout, rowsTo, select, table } from "../academic/common";

const S = "stdDev";
/** The step-by-step table lists at most this many values (the totals always cover all of them). */
const STEP_ROWS = 50;
/** The example numbers the page opens with (the standard deviation tutorial works through them). */
export const EXAMPLE = "2 4 4 4 5 5 7 9";

let timer = 0;

export function mountStandardDeviation(host: HTMLElement): void {
  let last = "";
  const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(paint, 150); };
  const input = h("textarea", { class: "average-input", rows: "7", "data-field": "numbers", spellcheck: "false", "aria-label": t(`${S}.numbers`), onInput: schedule });
  input.value = EXAMPLE;
  const kindSel = select<SdKind>("kind", ["sample", "population"], (k) => t(`${S}.k_${k}`), () => paint(), "sample");
  const decimal = decimalSelect(() => paint());
  const out = h("dl", { class: "stats-grid", "data-out": "result" });
  const note = h("p", { class: "hint", "data-out": "note" });
  const formula = h("p", { class: "si-formula", "data-out": "formula" });
  const steps = h("div", { class: "table-wrap", "data-out": "steps" });
  const copy = copyButton(S, () => { window.clearTimeout(timer); paint(); return last; });

  function paint(): void {
    const { values, skipped, truncated } = parseNumbers(input.value, decimal.value as DecimalMark);
    const kind = kindSel.value as SdKind;
    const r = standardDeviation(values, kind);
    note.textContent = [
      skipped.length ? t(`${S}.skipped`, { n: skipped.length, list: skipped.slice(0, 5).join(" ") + (skipped.length > 5 ? " …" : "") }) : "",
      truncated ? t(`${S}.truncated`, { max: new Intl.NumberFormat(locale()).format(MAX_VALUES) }) : "",
    ].filter(Boolean).join(" ");
    steps.replaceChildren();
    if (!r) {
      out.replaceChildren(h("p", { class: "muted" }, t(kind === "sample" && values.length === 1 ? `${S}.needTwo` : `${S}.empty`)));
      formula.textContent = "";
      last = "";
      copy.disabled = true;
      return;
    }
    copy.disabled = false;
    const sym = kind === "sample" ? "s" : "σ";
    const rows: [string, string, boolean?][] = [
      [t(`${S}.sd`, { sym }), fmt(r.sd, 6), true],
      [t(`${S}.variance`, { sym }), fmt(r.variance, 6)],
      [t(`${S}.mean`), fmt(r.mean, 6)],
      [t(`${S}.count`), String(r.n)],
      [t(`${S}.sum`), fmt(r.sum, 6)],
      [t(`${S}.ss`), fmt(r.ss, 6)],
      [t(`${S}.se`), fmt(r.se, 6)],
      [t(`${S}.cv`), r.cv === null ? "—" : `${fmt(r.cv * 100, 2)} %`],
      [t(`${S}.range`), `${fmt(r.min, 6)} – ${fmt(r.max, 6)}`],
    ];
    const lines = rowsTo(out, rows);
    const div = kind === "sample" ? "n − 1" : "n";
    formula.textContent = t(`${S}.formula`, { sym, div, ss: fmt(r.ss, 6), d: String(r.divisor), v: fmt(r.variance, 6), sd: fmt(r.sd, 6) });
    last = `${lines}\n${formula.textContent}`;
    const shown = values.slice(0, STEP_ROWS);
    steps.append(
      h("h3", null, t(`${S}.stepsTitle`)),
      table(["x", "x − x̄", "(x − x̄)²"], shown.map((x) => [fmt(x, 6), fmt(x - r.mean, 6), fmt((x - r.mean) ** 2, 6)])),
      values.length > STEP_ROWS ? h("p", { class: "hint" }, t(`${S}.stepsMore`, { n: STEP_ROWS, total: values.length })) : h("span"),
    );
  }

  layout(host, S, [
    field(t(`${S}.numbers`), input),
    field(t(`${S}.kind`), kindSel),
    field(t(`${S}.decimal`), decimal),
    h("p", { class: "hint" }, t(`${S}.inputHint`)),
  ], [copy, h("button", { type: "button", class: "btn ghost", "data-action": "clear", onClick: () => { input.value = ""; paint(); input.focus(); } }, t(`${S}.clear`))],
  [out, note, formula, steps]);
  paint();
}

export function unmountStandardDeviation(): void {
  window.clearTimeout(timer);
}
