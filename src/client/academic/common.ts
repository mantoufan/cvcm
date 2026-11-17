/** Shared pieces of the academic statistics tools: number formatting, form fields, the decimal-mark menu and copy. */
import { h } from "../dom";
import { locale, t } from "../i18n";
import { copyWithFlash } from "../copy";
import { parseDecimalInput, parseMoneyInput } from "../../shared/decimal-input";
import { decimalMarkOf } from "../../shared/calculator";

const FORMATTERS = new Map<string, Intl.NumberFormat>();
/** One Intl.NumberFormat per locale and options: the tables format hundreds of cells on every keystroke. */
function nf(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale()}|${JSON.stringify(options)}`;
  let f = FORMATTERS.get(key);
  if (!f) FORMATTERS.set(key, (f = new Intl.NumberFormat(locale(), options)));
  return f;
}

/** A number to `max` decimals (no grouping, so it pastes back as one number); tiny or huge values go scientific. */
export function fmt(x: number, max = 4): string {
  if (!Number.isFinite(x)) return x === Infinity ? "∞" : x === -Infinity ? "−∞" : "—";
  const a = Math.abs(x);
  if (x !== 0 && (a >= 1e15 || a < 10 ** -max)) {
    return nf({ notation: "scientific", maximumSignificantDigits: 4 }).format(x);
  }
  // Under 0.01 keep four significant digits, so an SE of 0.000149 is not shown as 0.0001.
  if (x !== 0 && a < 0.01) return nf({ maximumSignificantDigits: 4, useGrouping: false }).format(x);
  return nf({ maximumFractionDigits: max, useGrouping: false }).format(x);
}

/** A p-value: four decimals, or scientific below 0.0001 (3.21E-7), never rounded to 0. */
export function fmtP(p: number): string {
  if (!Number.isFinite(p)) return "—";
  if (p === 0) return `< ${nf({ notation: "scientific" }).format(1e-300)}`;
  if (p < 1e-4) return nf({ notation: "scientific", maximumSignificantDigits: 3 }).format(p);
  // Never round up onto a usual cut-off (0.049996 is not "0.0500" next to "significant at 0.05"): show more digits.
  if ([0.001, 0.01, 0.05, 0.1, 1].some((cut) => p < cut && Number(p.toFixed(4)) >= cut)) {
    return nf({ maximumSignificantDigits: 6, useGrouping: false }).format(p);
  }
  return nf({ minimumFractionDigits: 4, maximumFractionDigits: 4, useGrouping: false }).format(p);
}

/** A share 0–1 as a percentage with up to `max` decimals. */
export function pct(x: number, max = 2): string {
  if (!Number.isFinite(x)) return "—";
  if (x > 0 && x < 10 ** -(max + 2)) return `${fmt(x * 100, max + 4)} %`;
  // Near 1 keep enough digits that 0.99997 never reads as a certain 100 %.
  if (x < 1 && x > 1 - 10 ** -(max + 2)) {
    const digits = Math.min(12, Math.ceil(-Math.log10(1 - x)) + 1);
    return `${nf({ maximumFractionDigits: digits, useGrouping: false }).format(x * 100)} %`;
  }
  return `${nf({ maximumFractionDigits: max, useGrouping: false }).format(x * 100)} %`;
}

export const field = (label: string, ...control: HTMLElement[]): HTMLLabelElement =>
  h("label", { class: "field" }, h("span", null, label), ...control);

/** A number field. Fields that can be negative pass `inputmode: "text"`: the iOS decimal keypad has no minus key. */
export function numInput(name: string, value: string, onInput: () => void, attrs: Record<string, string> = {}): HTMLInputElement {
  // Start values are written with the page's decimal mark (1,96 in es/id/vi); readNum takes either.
  const shown = localeMark() === "," ? value.replace(".", ",") : value;
  return h("input", { type: "text", inputmode: "decimal", autocomplete: "off", spellcheck: "false", value: shown, "data-field": name, onInput, ...attrs });
}

/** The decimal mark a page writes by default: es, id and vi write 3,5. */
export function localeMark(): "." | "," {
  return decimalMarkOf(locale());
}

/**
 * Reads a typed number with the site's shared rules (src/shared/decimal-input.ts): a lone dot is always a decimal
 * point, a lone comma is a decimal comma in es/id/vi. `count` fields (a population) also read 10.000 as ten thousand in
 * those languages. Empty → undefined, not a number → NaN.
 */
export function readNum(el: HTMLInputElement, count = false, mark?: "." | ","): number | undefined {
  // A page-level decimal menu (`mark`) overrides the language's own mark: parse as a dot or a comma language would.
  const loc = mark === undefined ? locale() : mark === "," ? "es" : "en";
  return (count ? parseMoneyInput : parseDecimalInput)(el.value, loc);
}

/** List separator next to formatted numbers: "; " where the decimal mark is a comma, so "[0,12; 0,56]" reads as two. */
export function listSep(): string {
  return localeMark() === "," ? "; " : ", ";
}

export function select<T extends string>(name: string, options: readonly T[], label: (v: T) => string, onChange: () => void, value?: T): HTMLSelectElement {
  return h("select", { "data-field": name, onChange },
    ...options.map((o) => h("option", { value: o, selected: o === value }, label(o))));
}

/** The decimal-mark menu: languages that write 3,5 default to a comma. */
export function decimalSelect(onChange: () => void): HTMLSelectElement {
  const comma = localeMark() === ",";
  return h("select", { "data-field": "decimal", onChange },
    h("option", { value: ".", selected: !comma }, "3.5"),
    h("option", { value: ",", selected: comma }, "3,5"));
}

export function rowsTo(dl: HTMLElement, rows: readonly (readonly [string, string, boolean?])[]): string {
  dl.replaceChildren();
  for (const [k, v, key] of rows) dl.append(h("dt", null, k), h("dd", key ? { class: "si-key" } : null, v));
  return rows.map(([k, v]) => `${k}: ${v}`).join("\n");
}

export function table(head: readonly string[], body: readonly (readonly string[])[]): HTMLTableElement {
  return h("table", { class: "si-table" },
    h("thead", null, h("tr", null, ...head.map((c) => h("th", null, c)))),
    h("tbody", null, ...body.map((r) => h("tr", null, ...r.map((c) => h("td", null, c))))));
}

export function copyButton(section: string, text: () => string): HTMLButtonElement {
  const btn: HTMLButtonElement = h("button", { type: "button", class: "btn", "data-action": "copy", onClick: () => void copyWithFlash(btn, text(), { done: t(`${section}.copied`), failed: t(`${section}.copyFailed`) }) }, t(`${section}.copy`));
  return btn;
}

/** The two-column tool layout used by the calculators: options on the left, result on the right. */
export function layout(host: HTMLElement, section: string, controls: HTMLElement[], actions: HTMLElement[], result: HTMLElement[]): void {
  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t(`${section}.title`)),
      h("p", { class: "lede" }, t(`${section}.privacyNote`)),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null, h("legend", null, t(`${section}.options`)), ...controls),
        h("div", { class: "stage-actions" }, ...actions),
      ),
      h("div", { class: "rail" }, h("h2", null, t(`${section}.result`)), ...result),
    ),
  );
}

/** The ranges of a z or t curve that make up a p-value for a tail. */
export function tailShade(stat: number, tail: "two" | "left" | "right"): [number, number][] {
  if (tail === "right") return [[stat, Infinity]];
  if (tail === "left") return [[-Infinity, stat]];
  return [[-Infinity, -Math.abs(stat)], [Math.abs(stat), Infinity]];
}

/** Student's t density up to a constant (the curve is scaled to its peak). */
export function tDensity(df: number): (x: number) => number {
  return (x) => Math.pow(1 + (x * x) / df, -(df + 1) / 2);
}

const SVG = "http://www.w3.org/2000/svg";

/**
 * A standard normal (or t) curve from −4 to 4 with the area of interest shaded: `shade` lists [from, to] ranges in
 * z units (±Infinity allowed). Purely a reading aid next to the numbers; `label` is its accessible name.
 */
export function curve(shade: readonly (readonly [number, number])[], label: string, density: (x: number) => number = (x) => Math.exp(-(x * x) / 2)): SVGSVGElement {
  const W = 320;
  const H = 120;
  const top = density(0);
  const X = (z: number) => ((Math.max(-4, Math.min(4, z)) + 4) / 8) * W;
  const Y = (z: number) => H - 8 - (density(z) / top) * (H - 18);
  const path = (a: number, b: number, closed: boolean) => {
    const lo = Math.max(-4, a);
    const hi = Math.min(4, b);
    if (!(hi > lo)) return "";
    const n = Math.max(2, Math.ceil(((hi - lo) / 8) * 160));
    let d = closed ? `M${X(lo).toFixed(1)},${H - 8}` : "";
    for (let i = 0; i <= n; i++) {
      const z = lo + ((hi - lo) * i) / n;
      d += `${!closed && i === 0 ? "M" : "L"}${X(z).toFixed(1)},${Y(z).toFixed(1)}`;
    }
    return closed ? `${d}L${X(hi).toFixed(1)},${H - 8}Z` : d;
  };
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("class", "ac-curve");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", label);
  for (const [a, b] of shade) {
    const d = path(a, b, true);
    if (!d) continue;
    const p = document.createElementNS(SVG, "path");
    p.setAttribute("d", d);
    p.setAttribute("class", "ac-area");
    svg.append(p);
  }
  const line = document.createElementNS(SVG, "path");
  line.setAttribute("d", path(-4, 4, false));
  line.setAttribute("class", "ac-line");
  const axis = document.createElementNS(SVG, "path");
  axis.setAttribute("d", `M0,${H - 8}H${W}`);
  axis.setAttribute("class", "ac-axis");
  svg.append(line, axis);
  for (const z of [-3, -2, -1, 0, 1, 2, 3]) {
    const tx = document.createElementNS(SVG, "text");
    tx.setAttribute("x", X(z).toFixed(1));
    tx.setAttribute("y", String(H));
    tx.setAttribute("class", "ac-tick");
    tx.textContent = String(z);
    svg.append(tx);
  }
  return svg;
}
