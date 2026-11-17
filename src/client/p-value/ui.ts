import { h } from "../dom";
import { t } from "../i18n";
import { DISTS, criticalValue, pValue, tailsFor, type Dist } from "../../shared/academic-stats";
import type { Tail } from "../../shared/stat-dist";
import { copyButton, curve, field, fmt, fmtP, layout, numInput, readNum, listSep, rowsTo, select, tDensity, tailShade } from "../academic/common";

const S = "pValue";
type Mode = "p" | "critical";

export function mountPValue(host: HTMLElement): void {
  let last = "";
  const paint = () => draw();
  const modeSel = select<Mode>("mode", ["p", "critical"], (m) => t(`${S}.m_${m}`), () => { sync(); paint(); }, "p");
  const distSel = select<Dist>("dist", DISTS, (d) => t(`${S}.d_${d}`), () => { sync(); paint(); }, "z");
  /** The tail picked for z or t: chi-square and F force the right tail, and switching back restores this choice. */
  let symTail: Tail = "two";
  const tailSel = h("select", { "data-field": "tail", onChange: () => { if (tailsFor(distSel.value as Dist).length > 1) symTail = tailSel.value as Tail; paint(); } });
  const statEl = numInput("stat", "1.96", paint, { inputmode: "text" });
  const alphaEl = numInput("alpha", "0.05", paint);
  const df1El = numInput("df1", "10", paint);
  const df2El = numInput("df2", "20", paint);
  const statField = field(t(`${S}.stat`), statEl);
  const alphaField = field(t(`${S}.alpha`), alphaEl);
  const df1Label = h("span", null, "");
  const df1Field = h("label", { class: "field" }, df1Label, df1El);
  const df2Field = field(t(`${S}.df2`), df2El);
  const out = h("dl", { class: "stats-grid", "data-out": "result" });
  const verdict = h("p", { class: "si-formula", "data-out": "verdict" });
  const plot = h("div", { class: "ac-plot", "data-out": "plot" });
  const copy = copyButton(S, () => last);

  function sync(): void {
    const mode = modeSel.value as Mode;
    const dist = distSel.value as Dist;
    statField.hidden = mode !== "p";
    alphaField.hidden = mode !== "critical";
    df1Field.hidden = dist === "z";
    df2Field.hidden = dist !== "f";
    df1Label.textContent = t(dist === "f" ? `${S}.df1` : `${S}.df`);
    const tails = tailsFor(dist);
    tailSel.replaceChildren(...tails.map((x) => h("option", { value: x }, t(`${S}.tail_${x}`))));
    // Set the value directly: a `selected` attribute on options added later is not honoured everywhere (happy-dom).
    tailSel.value = tails.includes(symTail) ? symTail : tails[0]!;
    tailSel.disabled = tails.length === 1;
  }

  function draw(): void {
    const mode = modeSel.value as Mode;
    const dist = distSel.value as Dist;
    const tail = tailSel.value as Tail;
    // A lone dot is a decimal point here too: Welch's df is printed "13.705" by R, SPSS and JASP in every language.
    const df1 = dist === "z" ? undefined : readNum(df1El);
    const df2 = dist === "f" ? readNum(df2El) : undefined;
    plot.replaceChildren();
    const symbol = { z: "z", t: "t", chi2: "χ²", f: "F" }[dist];
    if (mode === "p") {
      const stat = readNum(statEl);
      const p = stat === undefined ? null : pValue(dist, stat, tail, df1, df2);
      if (p === null || stat === undefined) return fail();
      copy.disabled = false;
      // The percentage row only while it has digits to show (p ≥ 0.0001); below that the scientific p says it all.
      const lines = rowsTo(out, p >= 1e-4 ? [[t(`${S}.p`), fmtP(p), true], [t(`${S}.pPct`), `${fmt(p * 100, 4)} %`]] : [[t(`${S}.p`), fmtP(p), true]]);
      verdict.textContent = [0.1, 0.05, 0.01, 0.001].map((a) => t(p < a ? `${S}.below` : `${S}.notBelow`, { a: fmt(a, 3) })).join(" · ");
      last = `${symbol} = ${fmt(stat, 6)}${df1 !== undefined ? `, df = ${fmt(df1, 4)}${df2 !== undefined ? `${listSep()}${fmt(df2, 4)}` : ""}` : ""} (${t(`${S}.tail_${tail}`)})\n${lines}\n${verdict.textContent}`;
      if (dist === "z" || dist === "t") {
        plot.append(curve(tailShade(stat, tail), t(`${S}.curveLabel`, { p: fmtP(p) }), dist === "t" ? tDensity(df1 ?? 1) : undefined));
      }
      return;
    }
    const alpha = readNum(alphaEl);
    const c = alpha === undefined ? null : criticalValue(dist, alpha, tail, df1, df2);
    if (c === null || alpha === undefined || !Number.isFinite(c)) return fail();
    copy.disabled = false;
    const crit = tail === "two" ? `± ${fmt(c, 4)}` : fmt(c, 4);
    const lines = rowsTo(out, [[t(`${S}.critical`), crit, true]]);
    verdict.textContent = t(tail === "two" ? `${S}.rejectTwo` : tail === "left" ? `${S}.rejectLeft` : `${S}.rejectRight`, { sym: symbol, c: fmt(Math.abs(c), 4), cs: fmt(c, 4) });
    last = `α = ${fmt(alpha, 4)}, ${t(`${S}.d_${dist}`)}${df1 !== undefined ? `, df = ${fmt(df1, 4)}${df2 !== undefined ? `${listSep()}${fmt(df2, 4)}` : ""}` : ""} (${t(`${S}.tail_${tail}`)})\n${lines}\n${verdict.textContent}`;
  }

  function fail(): void {
    out.replaceChildren(h("p", { class: "muted" }, t(`${S}.invalid`)));
    verdict.textContent = "";
    last = "";
    copy.disabled = true;
  }

  layout(host, S, [
    field(t(`${S}.mode`), modeSel),
    field(t(`${S}.dist`), distSel),
    statField,
    alphaField,
    df1Field,
    df2Field,
    field(t(`${S}.tail`), tailSel),
    h("p", { class: "hint" }, t(`${S}.hint`)),
  ], [copy], [out, verdict, plot]);
  sync();
  draw();
}

export function unmountPValue(): void {}
