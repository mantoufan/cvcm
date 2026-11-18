import { h } from "../dom";
import { t } from "../i18n";
import { between, fromPercentile, zScore } from "../../shared/academic-stats";
import { copyButton, curve, field, fmt, fmtP, layout, numInput, pct, readNum, rowsTo, select } from "../academic/common";

const S = "zScore";
type Mode = "value" | "percentile" | "between";

/** The example the page opens with: a score of 130 on a scale with mean 100 and SD 15 (used by the z-score tutorial). */
export const EXAMPLE = { x: "130", mu: "100", sigma: "15" } as const;

export function mountZScore(host: HTMLElement): void {
  let last = "";
  const paint = () => draw();
  const modeSel = select<Mode>("mode", ["value", "percentile", "between"], (m) => t(`${S}.m_${m}`), () => { sync(); paint(); }, "value");
  const xEl = numInput("x", EXAMPLE.x, paint, { inputmode: "text" });
  const muEl = numInput("mu", EXAMPLE.mu, paint, { inputmode: "text" });
  const sigmaEl = numInput("sigma", EXAMPLE.sigma, paint);
  const pctEl = numInput("percentile", "90", paint);
  const aEl = numInput("a", "85", paint, { inputmode: "text" });
  const bEl = numInput("b", "115", paint, { inputmode: "text" });
  const xField = field(t(`${S}.x`), xEl);
  const pctField = field(t(`${S}.percentile`), pctEl);
  const aField = field(t(`${S}.a`), aEl);
  const bField = field(t(`${S}.b`), bEl);
  const out = h("dl", { class: "stats-grid", "data-out": "result" });
  const formula = h("p", { class: "si-formula", "data-out": "formula" });
  const plot = h("div", { class: "ac-plot", "data-out": "plot" });
  const copy = copyButton(S, () => last);

  function sync(): void {
    const m = modeSel.value as Mode;
    xField.hidden = m !== "value";
    pctField.hidden = m !== "percentile";
    aField.hidden = bField.hidden = m !== "between";
  }

  function draw(): void {
    const m = modeSel.value as Mode;
    const mu = readNum(muEl) ?? NaN;
    const sigma = readNum(sigmaEl) ?? NaN;
    plot.replaceChildren();
    let lines = "";
    if (m === "value") {
      const x = readNum(xEl) ?? NaN;
      const r = zScore(x, mu, sigma);
      if (!r) return fail();
      lines = rowsTo(out, [
        [t(`${S}.z`), fmt(r.z, 4), true],
        [t(`${S}.below`), pct(r.below, 2)],
        [t(`${S}.above`), pct(r.above, 2)],
        [t(`${S}.inside`, { z: fmt(Math.abs(r.z), 2) }), pct(r.between, 2)],
        [t(`${S}.outside`, { z: fmt(Math.abs(r.z), 2) }), `${pct(r.outside, 2)} (p = ${fmtP(r.outside)})`],
      ]);
      formula.textContent = t(`${S}.formula`, { x: fmt(x, 6), mu: fmt(mu, 6), s: fmt(sigma, 6), z: fmt(r.z, 4) });
      plot.append(curve([[-Infinity, r.z]], t(`${S}.curveBelow`, { z: fmt(r.z, 2), p: pct(r.below, 2) })));
    } else if (m === "percentile") {
      const p = readNum(pctEl) ?? NaN;
      const r = fromPercentile(p, mu, sigma);
      if (!r) return fail();
      lines = rowsTo(out, [[t(`${S}.z`), fmt(r.z, 4), true], [t(`${S}.xAt`), fmt(r.x, 4), true]]);
      formula.textContent = t(`${S}.formulaInverse`, { mu: fmt(mu, 6), z: fmt(r.z, 4), s: fmt(sigma, 6), x: fmt(r.x, 4) });
      plot.append(curve([[-Infinity, r.z]], t(`${S}.curveBelow`, { z: fmt(r.z, 2), p: `${fmt(p, 4)} %` })));
    } else {
      const a = readNum(aEl) ?? NaN;
      const b = readNum(bEl) ?? NaN;
      const r = between(a, b, mu, sigma);
      if (!r) return fail();
      lines = rowsTo(out, [
        [t(`${S}.between`), pct(r.p, 2), true],
        [t(`${S}.za`), fmt(r.za, 4)],
        [t(`${S}.zb`), fmt(r.zb, 4)],
      ]);
      formula.textContent = t(`${S}.formulaBetween`, { za: fmt(Math.min(r.za, r.zb), 4), zb: fmt(Math.max(r.za, r.zb), 4), p: fmtP(r.p) });
      plot.append(curve([[Math.min(r.za, r.zb), Math.max(r.za, r.zb)]], t(`${S}.curveBetween`, { p: pct(r.p, 2) })));
    }
    copy.disabled = false;
    last = `${lines}\n${formula.textContent}`;
  }

  function fail(): void {
    out.replaceChildren(h("p", { class: "muted" }, t(`${S}.invalid`)));
    formula.textContent = "";
    last = "";
    copy.disabled = true;
  }

  layout(host, S, [
    field(t(`${S}.mode`), modeSel),
    xField,
    pctField,
    aField,
    bField,
    field(t(`${S}.mu`), muEl),
    field(t(`${S}.sigma`), sigmaEl),
    h("p", { class: "hint" }, t(`${S}.hint`)),
  ], [copy], [out, formula, plot]);
  sync();
  draw();
}

export function unmountZScore(): void {}
