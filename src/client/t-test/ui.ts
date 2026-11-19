import { h } from "../dom";
import { locale, t } from "../i18n";
import { MAX_VALUES, parseNumbers, type DecimalMark } from "../../shared/average";
import { T_TEST_KINDS, apa2, apaDf, apaP, tTest, type TTestKind } from "../../shared/academic-stats";
import { TAILS, type Tail } from "../../shared/stat-dist";
import { copyButton, curve, decimalSelect, field, fmt, fmtP, layout, numInput, readNum, listSep, rowsTo, select, table, tDensity, tailShade } from "../academic/common";

const S = "tTest";
const ALPHAS = ["0.01", "0.05", "0.1"] as const;
/** The two example groups the page opens with (the t-test tutorial works through them). */
export const EXAMPLE_A = "5.1 4.9 6.2 5.8 6.0 5.5 5.3 6.1";
export const EXAMPLE_B = "4.8 4.7 5.9 5.0 5.6 5.2 4.9 5.4";

let timer = 0;

export function mountTTest(host: HTMLElement): void {
  let last = "";
  const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(paint, 150); };
  const kindSel = select<TTestKind>("kind", T_TEST_KINDS, (k) => t(`${S}.k_${k}`), () => { sync(); paint(); }, "independent");
  const area = (name: string, value: string) => {
    const el = h("textarea", { class: "average-input", rows: "4", "data-field": name, spellcheck: "false", onInput: schedule });
    el.value = value;
    return el;
  };
  const commaOf = (s: string) => s.replace(/\./g, ",");
  // The example follows the decimal mark (es, id and vi open with 5,1); an untouched example is rewritten when the
  // mark changes, so "5,1 4,9" is never re-read as comma-separated integers.
  const decimal = decimalSelect(() => {
    for (const [el, ex] of [[aEl, EXAMPLE_A], [bEl, EXAMPLE_B]] as const) {
      if (el.value === ex || el.value === commaOf(ex)) el.value = decimal.value === "," ? commaOf(ex) : ex;
    }
    paint();
  });
  const ex = (s: string) => (decimal.value === "," ? commaOf(s) : s);
  const aEl = area("a", ex(EXAMPLE_A));
  const bEl = area("b", ex(EXAMPLE_B));
  const muEl = numInput("mu", "5", () => paint(), { inputmode: "text" });
  const welchSel = select("variance", ["welch", "pooled"], (v) => t(`${S}.v_${v}`), () => paint(), "welch");
  const tailSel = select<Tail>("tail", TAILS, (x) => t(`${S}.tail_${x}`), () => paint(), "two");
  const alphaSel = select("alpha", ALPHAS, (a) => fmt(Number(a), 2), () => paint(), "0.05");
  const aLabel = h("span", null, "");
  const bLabel = h("span", null, "");
  const aField = h("label", { class: "field" }, aLabel, aEl);
  const bField = h("label", { class: "field" }, bLabel, bEl);
  const muField = field(t(`${S}.mu`), muEl);
  const welchField = field(t(`${S}.variance`), welchSel);
  const out = h("dl", { class: "stats-grid", "data-out": "result" });
  const verdict = h("p", { class: "si-formula", "data-out": "verdict" });
  const note = h("p", { class: "hint", "data-out": "note" });
  const apa = h("p", { class: "si-formula", "data-out": "apa" });
  const groups = h("div", { class: "table-wrap", "data-out": "groups" });
  const plot = h("div", { class: "ac-plot", "data-out": "plot" });
  const copy = copyButton(S, () => { window.clearTimeout(timer); paint(); return last; });

  function sync(): void {
    const k = kindSel.value as TTestKind;
    bField.hidden = k === "one";
    muField.hidden = k !== "one";
    welchField.hidden = k !== "independent";
    aLabel.textContent = t(k === "one" ? `${S}.sample` : k === "paired" ? `${S}.before` : `${S}.groupA`);
    bLabel.textContent = t(k === "paired" ? `${S}.after` : `${S}.groupB`);
  }

  function paint(): void {
    const k = kindSel.value as TTestKind;
    const dm = decimal.value as DecimalMark;
    const pa = parseNumbers(aEl.value, dm);
    const pb = parseNumbers(bEl.value, dm);
    const a = pa.values;
    const b = pb.values;
    const skipped = [...pa.skipped, ...(k === "one" ? [] : pb.skipped)];
    const truncated = pa.truncated > 0 || (k !== "one" && pb.truncated > 0);
    note.textContent = [
      skipped.length ? t(`${S}.skipped`, { n: skipped.length, list: skipped.slice(0, 5).join(" ") + (skipped.length > 5 ? " …" : "") }) : "",
      truncated ? t(`${S}.truncated`, { max: new Intl.NumberFormat(locale()).format(MAX_VALUES) }) : "",
    ].filter(Boolean).join(" ");
    // An empty test value is missing, not 0: no confident result against a value nobody typed.
    const mu = readNum(muEl, false, dm) ?? NaN;
    const tail = tailSel.value as Tail;
    const alpha = Number(alphaSel.value);
    // The interval matches the test: 1 − α two-sided (90 % at α = 0.1), or a one-sided bound at 1 − α.
    const confidence = (1 - alpha) * 100;
    // Dropping a non-number from one list of a paired test would shift every later pair: refuse instead.
    const misaligned = k === "paired" && (pa.skipped.length > 0 || pb.skipped.length > 0);
    // Past the value limit both lists are cut to the same length: compare the lengths as pasted.
    const lenA = a.length + pa.truncated;
    const lenB = b.length + pb.truncated;
    const cutUneven = k === "paired" && lenA !== lenB;
    const r = misaligned || cutUneven ? null : tTest(k, a, b, { mu, welch: welchSel.value === "welch", tail, confidence });
    groups.replaceChildren();
    plot.replaceChildren();
    if (!r) {
      const why = k === "one" && !Number.isFinite(mu) ? t(`${S}.needMu`) : misaligned ? t(`${S}.pairSkipped`) : cutUneven ? t(`${S}.pairMismatch`, { a: lenA, b: lenB }) : t(`${S}.invalid`);
      out.replaceChildren(h("p", { class: "muted" }, why));
      verdict.textContent = apa.textContent = "";
      last = "";
      copy.disabled = true;
      return;
    }
    copy.disabled = false;
    const ci = `[${fmt(r.ciLow, 4)}${listSep()}${fmt(r.ciHigh, 4)}]`;
    const lines = rowsTo(out, [
      [t(`${S}.t`), fmt(r.t, 4), true],
      [t(`${S}.df`), fmt(r.df, 2)],
      [t(`${S}.p`, { tail: t(`${S}.tail_${tail}`) }), fmtP(r.p), true],
      [t(k === "paired" ? `${S}.meanDiffPaired` : `${S}.meanDiff`), fmt(r.diff, 4)],
      [t(`${S}.se`), fmt(r.se, 4)],
      [t(`${S}.ci`, { conf: fmt(confidence, 1) }), ci],
      // Paired: the mean difference over the SD of the differences is d_z, labelled so it is not read as Cohen's d.
      [k === "paired" ? `${t(`${S}.d`)} (d_z)` : t(`${S}.d`), fmt(r.d, 3)],
    ]);
    verdict.textContent = t(r.p < alpha ? `${S}.significant` : `${S}.notSignificant`, { alpha: fmt(alpha, 2) });
    // A one-sided p is labelled, so the pasted line is never read as the usual two-tailed result.
    const sided = tail === "two" ? "" : ` (${t(`${S}.tail_${tail}`)})`;
    apa.textContent = `${t(`${S}.apaLabel`)} t(${apaDf(r.df)}) = ${apa2(r.t)}, ${apaP(r.p)}${sided}, ${k === "paired" ? "d_z" : "d"} = ${apa2(r.d)}`;
    last = [lines, verdict.textContent, apa.textContent].join("\n");
    const names = k === "one" ? [t(`${S}.sample`)] : k === "paired" ? [t(`${S}.before`), t(`${S}.after`), t(`${S}.differences`)] : [t(`${S}.groupA`), t(`${S}.groupB`)];
    groups.append(table([t(`${S}.group`), "n", t(`${S}.mean`), t(`${S}.sd`)], r.groups.map((g, i) => [names[i]!, String(g.n), fmt(g.mean, 4), fmt(g.sd, 4)])));
    // The t curve with the p-value area shaded (clipped to ±4 for drawing).
    plot.append(curve(tailShade(r.t, tail), t(`${S}.curveLabel`, { t: fmt(r.t, 3), p: fmtP(r.p) }), tDensity(r.df)));
  }

  layout(host, S, [
    field(t(`${S}.kind`), kindSel),
    aField,
    bField,
    muField,
    welchField,
    field(t(`${S}.tail`), tailSel),
    field(t(`${S}.alpha`), alphaSel),
    field(t(`${S}.decimal`), decimal),
    h("p", { class: "hint" }, t(`${S}.inputHint`)),
  ], [copy], [out, note, verdict, apa, plot, groups]);
  sync();
  paint();
}

export function unmountTTest(): void {
  window.clearTimeout(timer);
}
