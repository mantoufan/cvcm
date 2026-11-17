import { h } from "../dom";
import { locale, t } from "../i18n";
import { HEADER_MODES, MAX_ITEMS, MAX_RESPONDENTS, alphaBand, apaUnit, cronbachAlpha, parseMatrix, type HeaderMode } from "../../shared/academic-stats";
import { copyButton, decimalSelect, field, fmt, layout, rowsTo, select, table } from "../academic/common";

const S = "cronbach";
let timer = 0;

/** Ten respondents answering five 1–5 items: the example the page opens with (rule 8: fixed, no storage). */
export const SAMPLE = "Q1\tQ2\tQ3\tQ4\tQ5\n4\t5\t4\t3\t4\n3\t4\t3\t3\t3\n5\t5\t4\t5\t5\n2\t3\t2\t2\t3\n4\t4\t5\t4\t4\n3\t3\t3\t4\t3\n5\t4\t5\t5\t4\n2\t2\t3\t2\t2\n4\t5\t4\t4\t5\n3\t3\t4\t3\t3";

export function mountCronbach(host: HTMLElement): void {
  let last = "";
  const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(paint, 150); };
  const input = h("textarea", { class: "average-input ac-matrix", rows: "10", "data-field": "matrix", spellcheck: "false", wrap: "off", "aria-label": t(`${S}.data`), onInput: schedule });
  input.value = SAMPLE;
  const decimal = decimalSelect(() => paint());
  const headerSel = select<HeaderMode>("header", HEADER_MODES, (m) => t(`${S}.h_${m}`), () => paint(), "auto");
  const out = h("dl", { class: "stats-grid", "data-out": "result" });
  const band = h("p", { class: "si-formula", "data-out": "band" });
  const apa = h("p", { class: "si-formula", "data-out": "apa" });
  const items = h("div", { class: "table-wrap", "data-out": "items" });
  const copy = copyButton(S, () => { window.clearTimeout(timer); paint(); return last; });

  function paint(): void {
    const m = parseMatrix(input.value, decimal.value === "," ? "," : ".", headerSel.value as HeaderMode);
    const r = m ? cronbachAlpha(m) : null;
    items.replaceChildren();
    apa.textContent = "";
    if (!m || !r) {
      // Say how many pasted rows were dropped, so "paste data" is not the only answer when every row was skipped.
      const why = t(m && m.rows.length >= 2 ? `${S}.noVariance` : `${S}.empty`);
      out.replaceChildren(h("p", { class: "muted" }, m && m.skipped ? `${why} ${t(`${S}.skipped`)}: ${m.skipped}` : why));
      band.textContent = "";
      last = "";
      copy.disabled = true;
      return;
    }
    copy.disabled = false;
    const rows: [string, string, boolean?][] = [
      [t(`${S}.alpha`), fmt(r.alpha, 4), true],
      [t(`${S}.standardized`), fmt(r.standardized, 4)],
      [t(`${S}.k`), String(r.k)],
      [t(`${S}.n`), String(r.n)],
      [t(`${S}.meanR`), fmt(r.meanInterItem, 4)],
      [t(`${S}.sumVar`), fmt(r.sumItemVariance, 4)],
      [t(`${S}.totalVar`), fmt(r.totalVariance, 4)],
    ];
    if (m.skipped) rows.push([t(`${S}.skipped`), String(m.skipped)]);
    const lines = rowsTo(out, rows);
    band.textContent = r.alpha < 0 ? t(`${S}.negative`) : t(`${S}.band`, { band: t(`${S}.b_${alphaBand(r.alpha)}`) });
    if (m.truncated) band.textContent += ` ${t(`${S}.truncated`, { rows: new Intl.NumberFormat(locale()).format(MAX_RESPONDENTS), items: MAX_ITEMS })}`;
    apa.textContent = t(`${S}.apa`, { k: r.k, n: r.n, a: apaUnit(r.alpha) });
    last = [lines, band.textContent, apa.textContent].join("\n");
    // Items whose removal would raise alpha are worth a second look (often reverse-worded items not yet recoded).
    items.append(
      h("h3", null, t(`${S}.itemsTitle`)),
      table([t(`${S}.item`), t(`${S}.itemMean`), t(`${S}.itemVar`), t(`${S}.itemTotal`), t(`${S}.ifDeleted`)],
        r.items.map((it) => [
          it.name,
          fmt(it.mean, 3),
          fmt(it.variance, 3),
          fmt(it.itemTotal, 3),
          it.alphaIfDeleted === null ? "—" : `${fmt(it.alphaIfDeleted, 3)}${it.alphaIfDeleted > r.alpha + 1e-9 ? " ↑" : ""}`,
        ])),
      h("p", { class: "hint" }, t(`${S}.itemsHint`)),
    );
  }

  layout(host, S, [
    field(t(`${S}.data`), input),
    field(t(`${S}.header`), headerSel),
    field(t(`${S}.decimal`), decimal),
    h("p", { class: "hint" }, t(`${S}.inputHint`)),
  ], [copy, h("button", { type: "button", class: "btn ghost", "data-action": "clear", onClick: () => { input.value = ""; paint(); input.focus(); } }, t(`${S}.clear`))],
  [out, band, apa, items]);
  paint();
}

export function unmountCronbach(): void {
  window.clearTimeout(timer);
}
