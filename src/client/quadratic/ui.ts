import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { equationText, num, solveQuadratic, type QuadraticResult } from "../../shared/quadratic";

const SVG = "http://www.w3.org/2000/svg";
const EXAMPLES: Array<[number, number, number]> = [[1, -3, 2], [2, 5, -3], [1, 2, 1], [1, -2, -1], [1, 2, 5]];

let aEl: HTMLInputElement | null = null;
let bEl: HTMLInputElement | null = null;
let cEl: HTMLInputElement | null = null;
let eqEl: HTMLElement | null = null;
let errorEl: HTMLElement | null = null;
let outEl: HTMLElement | null = null;
let stepsEl: HTMLElement | null = null;
let graphEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountQuadratic(host: HTMLElement): void {
  const input = (field: string, value: string) =>
    h("input", { type: "number", inputmode: "decimal", step: "any", value, "data-field": field, onInput: () => paint() });
  aEl = input("a", "1");
  bEl = input("b", "-3");
  cEl = input("c", "2");
  eqEl = h("p", { class: "timestamp-out", "data-out": "equation" });
  errorEl = h("p", { class: "hint", "aria-live": "polite", "data-out": "error" });
  outEl = h("dl", { class: "stats-grid", "data-out": "result" });
  stepsEl = h("ol", { class: "factor-steps", "data-out": "steps" });
  graphEl = h("div", { class: "quad-graph", "data-out": "graph" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("quadratic.back")),
      h("h1", null, t("quadratic.title")),
      h("p", { class: "lede" }, t("quadratic.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("quadratic.options")),
          h("p", { class: "hint" }, "ax² + bx + c = 0"),
          labeled("a", aEl),
          labeled("b", bEl),
          labeled("c", cEl),
        ),
        h("div", { class: "chip-row" }, ...EXAMPLES.map(([a, b, c]) => h("button", {
          type: "button",
          class: "chip",
          "data-example": `${a},${b},${c}`,
          onClick: () => {
            if (aEl && bEl && cEl) {
              aEl.value = String(a);
              bEl.value = String(b);
              cEl.value = String(c);
            }
            paint();
          },
        }, equationText(a, b, c)))),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn ghost", "data-action": "copy", onClick: () => void copyWithFlash(copyBtn, last, { done: t("quadratic.copied"), failed: t("quadratic.copyFailed") }) }, t("quadratic.copy")),
        ),
        h("p", { class: "hint" }, t("quadratic.hint")),
      ),
      h("div", { class: "rail" },
        eqEl,
        errorEl,
        outEl,
        h("h2", null, t("quadratic.steps")),
        stepsEl,
        h("h2", null, t("quadratic.graph")),
        graphEl,
      ),
    ),
  );
  paint();
}

export function unmountQuadratic(): void {
  aEl = bEl = cEl = null;
  eqEl = errorEl = outEl = stepsEl = graphEl = null;
  copyBtn = null;
  last = "";
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

/** Reads a coefficient; an empty box counts as 0 for b and c (x² − 4 = 0 has no b). */
function read(el: HTMLInputElement, emptyIsZero: boolean): number {
  if (el.value.trim() === "") return emptyIsZero ? 0 : NaN;
  return Number(el.value);
}

function paint(): void {
  if (!aEl || !bEl || !cEl || !eqEl || !errorEl || !outEl || !stepsEl || !graphEl) return;
  outEl.replaceChildren();
  stepsEl.replaceChildren();
  graphEl.replaceChildren();
  errorEl.textContent = "";
  eqEl.textContent = "";
  last = "";
  const a = read(aEl, false);
  const b = read(bEl, true);
  const c = read(cEl, true);
  if (![a, b, c].every(Number.isFinite)) {
    errorEl.textContent = t("quadratic.invalid");
    return;
  }
  if (a === 0) {
    errorEl.textContent = b === 0 ? t("quadratic.notEquation") : t("quadratic.linear", { x: num(-c / b) });
    return;
  }
  const r = solveQuadratic(a, b, c)!;
  eqEl.textContent = equationText(a, b, c);
  const rows: Array<[string, string]> = [];
  const exact = r.exact;
  if (r.roots.kind === "two") {
    rows.push([t("quadratic.roots"), t("quadratic.twoReal")]);
    // Rational roots come as two exact values; irrational ones as one "p ± q√m" line under the decimals.
    const pair = exact?.length === 2 ? exact : null;
    rows.push(["x₁", withExact(pair?.[0] ?? null, r.roots.x1)]);
    rows.push(["x₂", withExact(pair?.[1] ?? null, r.roots.x2)]);
    if (exact?.length === 1) rows.push([t("quadratic.exact"), `x = ${exact[0]}`]);
  } else if (r.roots.kind === "one") {
    rows.push([t("quadratic.roots"), t("quadratic.oneReal")]);
    rows.push(["x", withExact(exact?.[0] ?? null, r.roots.x)]);
  } else {
    rows.push([t("quadratic.roots"), t("quadratic.complex")]);
    const im = num(r.roots.im);
    const re = num(r.roots.re);
    rows.push(["x", `${re === "0" ? "" : `${re} `}± ${im === "1" ? "" : im}i`.trim()]);
    if (exact) rows.push([t("quadratic.exact"), `x = ${exact[0]}`]);
  }
  rows.push(
    [t("quadratic.discriminant"), `Δ = ${num(r.d)}`],
    [t("quadratic.vertex"), `(${num(r.vertex.x)}, ${num(r.vertex.y)})`],
    [t("quadratic.axis"), `x = ${num(r.vertex.x)}`],
    [t("quadratic.yIntercept"), `(0, ${num(c)})`],
  );
  if (r.factored) rows.push([t("quadratic.factored"), `${r.factored} = 0`]);
  outEl.append(...rows.flatMap(([k, v]) => [h("dt", null, k), h("dd", null, v)]));
  last = [equationText(a, b, c), ...rows.map(([k, v]) => `${k}: ${v}`)].join("\n");
  const steps = [
    t("quadratic.step1", { a: num(a), b: num(b), c: num(c) }),
    `Δ = b² − 4ac = (${num(b)})² − 4 × ${num(a)} × ${paren(c)} = ${num(r.d)}`,
    r.d > 0 ? t("quadratic.step3two") : r.d === 0 ? t("quadratic.step3one") : t("quadratic.step3complex"),
    `x = (−b ± √Δ) / 2a = (${num(-b)} ± √${paren(r.d)}) / ${num(2 * a)}`,
  ];
  if (exact) steps.push(`x = ${exact.join(t("quadratic.or"))}`);
  stepsEl.append(...steps.map((s) => h("li", null, s)));
  graphEl.append(plot(r));
}

function paren(n: number): string {
  return n < 0 ? `(${num(n)})` : num(n);
}

function withExact(exact: string | null, value: number): string {
  const dec = num(value);
  return exact && exact !== dec ? `${exact} ≈ ${dec}` : dec;
}

/** Parabola over a window that holds the vertex and the real roots, with axes when they fall inside. */
function plot(r: QuadraticResult): SVGSVGElement {
  const W = 320;
  const H = 220;
  const xs = [r.vertex.x];
  if (r.roots.kind === "two") xs.push(r.roots.x1, r.roots.x2);
  let lo = Math.min(...xs, 0);
  let hi = Math.max(...xs, 0);
  const span = Math.max(hi - lo, 2);
  lo -= span * 0.35;
  hi += span * 0.35;
  const f = (x: number) => r.a * x * x + r.b * x + r.c;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 80; i++) {
    const x = lo + ((hi - lo) * i) / 80;
    pts.push([x, f(x)]);
  }
  const ys = pts.map((p) => p[1]).concat(0);
  let ylo = Math.min(...ys);
  let yhi = Math.max(...ys);
  if (yhi - ylo < 1e-9) {
    ylo -= 1;
    yhi += 1;
  }
  const pad = (yhi - ylo) * 0.08;
  ylo -= pad;
  yhi += pad;
  const sx = (x: number) => ((x - lo) / (hi - lo)) * W;
  const sy = (y: number) => H - ((y - ylo) / (yhi - ylo)) * H;
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", t("quadratic.graphLabel", { eq: equationText(r.a, r.b, r.c) }));
  const line = (x1: number, y1: number, x2: number, y2: number, cls: string) => {
    const l = document.createElementNS(SVG, "line");
    l.setAttribute("x1", x1.toFixed(1));
    l.setAttribute("y1", y1.toFixed(1));
    l.setAttribute("x2", x2.toFixed(1));
    l.setAttribute("y2", y2.toFixed(1));
    l.setAttribute("class", cls);
    svg.append(l);
  };
  line(0, sy(0), W, sy(0), "quad-axis");
  if (lo <= 0 && hi >= 0) line(sx(0), 0, sx(0), H, "quad-axis");
  line(sx(r.vertex.x), 0, sx(r.vertex.x), H, "quad-sym");
  const path = document.createElementNS(SVG, "path");
  path.setAttribute("d", pts.map(([x, y], i) => `${i ? "L" : "M"}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`).join(""));
  path.setAttribute("class", "quad-curve");
  svg.append(path);
  const dot = (x: number, y: number, cls: string) => {
    const c = document.createElementNS(SVG, "circle");
    c.setAttribute("cx", sx(x).toFixed(1));
    c.setAttribute("cy", sy(y).toFixed(1));
    c.setAttribute("r", "4");
    c.setAttribute("class", cls);
    svg.append(c);
  };
  dot(r.vertex.x, r.vertex.y, "quad-vertex");
  if (r.roots.kind === "two") {
    dot(r.roots.x1, 0, "quad-root");
    dot(r.roots.x2, 0, "quad-root");
  }
  return svg;
}
