import { h } from "../dom";
import { t } from "../i18n";
import { CONFIDENCE_LEVELS, SAMPLE_METHODS, sampleSize, type SampleMethod, type SampleSizeInput } from "../../shared/academic-stats";
import { copyButton, field, fmt, layout, numInput, readNum, rowsTo, select, table } from "../academic/common";

const S = "sampleSize";
/** Margins (%) and confidence levels in the quick-reference table. */
const TABLE_MARGINS = [1, 2, 3, 4, 5, 10];
const TABLE_LEVELS = [90, 95, 99];

export function mountSampleSize(host: HTMLElement): void {
  let last = "";
  const paint = () => draw();
  const methodSel = select<SampleMethod>("method", SAMPLE_METHODS, (m) => t(`${S}.m_${m}`), () => { sync(); paint(); }, "proportion");
  const confSel = select("confidence", CONFIDENCE_LEVELS.map(String), (c) => `${fmt(Number(c), 1)} %`, paint, "95");
  const marginEl = numInput("margin", "5", paint);
  const propEl = numInput("proportion", "50", paint);
  const sigmaEl = numInput("sigma", "10", paint);
  const popEl = numInput("population", "", paint, { placeholder: t(`${S}.popPlaceholder`) });
  const rateEl = numInput("response", "100", paint);
  const confField = field(t(`${S}.confidence`), confSel);
  const marginLabel = h("span", null, "");
  const marginField = h("label", { class: "field" }, marginLabel, marginEl);
  const propField = field(t(`${S}.proportion`), propEl);
  const sigmaField = field(t(`${S}.sigma`), sigmaEl);
  const popLabel = h("span", null, "");
  const popField = h("label", { class: "field" }, popLabel, popEl);
  const out = h("dl", { class: "stats-grid", "data-out": "result" });
  const formula = h("p", { class: "si-formula", "data-out": "formula" });
  const ref = h("div", { class: "table-wrap", "data-out": "table" });
  const copy = copyButton(S, () => last);

  function sync(): void {
    const m = methodSel.value as SampleMethod;
    confField.hidden = m === "slovin";
    propField.hidden = m !== "proportion";
    sigmaField.hidden = m !== "mean";
    marginLabel.textContent = t(m === "mean" ? `${S}.marginUnits` : `${S}.margin`);
    popLabel.textContent = t(m === "slovin" ? `${S}.populationRequired` : `${S}.population`);
  }

  function input(): SampleSizeInput {
    return {
      method: methodSel.value as SampleMethod,
      confidence: Number(confSel.value),
      margin: readNum(marginEl) ?? NaN,
      proportion: readNum(propEl),
      sigma: readNum(sigmaEl),
      population: readNum(popEl, true),
      responseRate: readNum(rateEl),
    };
  }

  function draw(): void {
    const i = input();
    // A typo in an optional field (population "1o00") is an error, not "no population".
    // Only the fields shown for this method count: a stale typo in a hidden one must not block the answer.
    const shown = [i.population, i.responseRate, i.method === "proportion" ? i.proportion : 0, i.method === "mean" ? i.sigma : 0];
    const typo = shown.some((v) => Number.isNaN(v)) || (i.population !== undefined && i.population <= 0);
    const r = typo ? null : sampleSize(i);
    ref.replaceChildren();
    if (!r) {
      out.replaceChildren(h("p", { class: "muted" }, t(i.method === "slovin" && i.population === undefined ? `${S}.needPopulation` : `${S}.invalid`)));
      formula.textContent = "";
      last = "";
      copy.disabled = true;
      return;
    }
    copy.disabled = false;
    const rows: [string, string, boolean?][] = [[t(`${S}.n`), String(r.n), true]];
    if (r.invite !== null) rows.push([t(`${S}.invite`, { rate: fmt(i.responseRate!, 2) }), String(r.invite)]);
    if (r.z !== null) rows.push([t(`${S}.z`), fmt(r.z, 4)]);
    if (r.corrected) rows.push([t(`${S}.n0`), fmt(r.n0, 2)], [t(`${S}.exact`), fmt(r.exact, 2)]);
    else rows.push([t(`${S}.exact`), fmt(r.exact, 2)]);
    const lines = rowsTo(out, rows);
    const z = r.z === null ? "" : fmt(r.z, 4);
    if (i.method === "slovin") {
      formula.textContent = t(`${S}.fSlovin`, { N: String(i.population), e: fmt(i.margin / 100, 4), n: fmt(r.exact, 2) });
    } else if (i.method === "proportion") {
      formula.textContent = t(`${S}.fProportion`, { z, p: fmt(i.proportion! / 100, 4), e: fmt(i.margin / 100, 4), n0: fmt(r.n0, 2) });
    } else {
      formula.textContent = t(`${S}.fMean`, { z, s: fmt(i.sigma!, 4), e: fmt(i.margin, 4), n0: fmt(r.n0, 2) });
    }
    if (r.corrected) formula.textContent += ` ${t(`${S}.fFinite`, { n0: fmt(r.n0, 2), N: String(i.population), n: fmt(r.exact, 2) })}`;
    last = `${lines}\n${formula.textContent}`;
    if (i.method === "mean") return;
    // Quick reference: the same population and proportion at common margins and confidence levels.
    const levels = i.method === "slovin" ? [null] : TABLE_LEVELS;
    const body = TABLE_MARGINS.map((e) => [`± ${e} %`, ...levels.map((c) => {
      const x = sampleSize({ ...i, margin: e, confidence: c ?? i.confidence, responseRate: undefined });
      return x ? String(x.n) : "—";
    })]);
    ref.append(
      h("h3", null, t(`${S}.tableTitle`)),
      table([t(`${S}.margin`), ...levels.map((c) => (c === null ? t(`${S}.n`) : `${c} %`))], body),
    );
  }

  layout(host, S, [
    field(t(`${S}.method`), methodSel),
    confField,
    marginField,
    propField,
    sigmaField,
    popField,
    field(t(`${S}.response`), rateEl),
    h("p", { class: "hint" }, t(`${S}.hint`)),
  ], [copy], [out, formula, ref]);
  sync();
  draw();
}

export function unmountSampleSize(): void {}
