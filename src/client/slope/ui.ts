import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { formatter } from "../shape-calc";
import { formatQ, isZero, mul, parseCoord, q, solveSlope, toNumber, type Q } from "../../shared/slope";

const SVG = "http://www.w3.org/2000/svg";
const FIELDS = ["x1", "y1", "x2", "y2"] as const;
type Field = (typeof FIELDS)[number];

let mounted: { cleanup: () => void } | null = null;

export function mountSlope(host: HTMLElement): void {
  unmountSlope();
  const loc = locale();
  const f = formatter(loc);
  let last = "";
  let copyBtn: HTMLButtonElement | null = null;
  const start: Record<Field, string> = { x1: "1", y1: "2", x2: "4", y2: "8" };
  const inputs = Object.fromEntries(FIELDS.map((id) => [id, h("input", {
    type: "text",
    inputmode: "decimal",
    autocomplete: "off",
    "data-field": id,
    value: start[id],
    "aria-label": t(`slope.f_${id}`),
    onInput: () => paint(),
  })])) as Record<Field, HTMLInputElement>;
  const errorEl = h("p", { class: "hint", "aria-live": "polite", "data-out": "error" });
  const outEl = h("div", { "data-out": "result" });
  const graph = document.createElementNS(SVG, "svg");
  graph.setAttribute("class", "slope-graph");
  graph.setAttribute("viewBox", "0 0 320 320");
  graph.setAttribute("role", "img");
  graph.setAttribute("aria-label", t("slope.graph"));

  /** A fraction with its decimal: "3/4 = 0.75", or "2/3 ≈ 0.66666667" when the decimal does not end. */
  const show = (v: Q) => (v.d === 1n ? formatQ(v) : `${formatQ(v)} ${terminates(v.d) ? "=" : "≈"} ${f(toNumber(v))}`);
  /** A coefficient written before x or a bracket: "", "−", "3", "(3/4)" (1x is x; a fraction is bracketed so 3/4x is not 3/(4x)). */
  const coef = (v: Q) => (v.n === 1n && v.d === 1n ? "" : v.n === -1n && v.d === 1n ? "−" : v.d === 1n ? formatQ(v) : `(${formatQ(v)})`);
  /** "+ 3", "− 1/2", or nothing for zero. */
  const term = (v: Q) => (isZero(v) ? "" : v.n < 0n ? ` − ${formatQ(q(-v.n, v.d))}` : ` + ${formatQ(v)}`);
  const pt = (x: Q, y: Q) => `(${formatQ(x)}, ${formatQ(y)})`;

  const paint = () => {
    outEl.replaceChildren();
    graph.replaceChildren();
    last = "";
    const vals = {} as Record<Field, Q>;
    for (const id of FIELDS) {
      const v = parseCoord(inputs[id].value, loc);
      if (v === undefined) {
        errorEl.textContent = t("slope.err_missing");
        return;
      }
      if (v === null) {
        errorEl.textContent = t("slope.err_invalid", { field: t(`slope.f_${id}`) });
        return;
      }
      vals[id] = v;
    }
    const res = solveSlope(vals.x1, vals.y1, vals.x2, vals.y2);
    if (!res.ok) {
      errorEl.textContent = t("slope.err_same");
      return;
    }
    errorEl.textContent = "";
    const r = res.r;
    const rows: Array<[string, string]> = [];
    let main: string;
    let equation: string;
    if (r.line.kind === "vertical") {
      main = t("slope.undefined");
      equation = `x = ${formatQ(r.line.x)}`;
      rows.push([t("slope.equation"), equation]);
    } else {
      const { m, b } = r.line;
      main = `m = ${show(m)}`;
      equation = isZero(m) ? `y = ${formatQ(b)}` : `y = ${coef(m)}x${term(b)}`;
      rows.push([t("slope.equation"), equation]);
      // x − 0 is just x: no brackets then ("y − 2 = 2x", not "2(x)").
      const xPart = isZero(vals.x1) ? `${coef(m)}x` : `${coef(m)}(x${term(q(-vals.x1.n, vals.x1.d))})`;
      rows.push([t("slope.pointSlope"), isZero(m) ? `y${term(q(-vals.y1.n, vals.y1.d))} = 0` : `y${term(q(-vals.y1.n, vals.y1.d))} = ${xPart}`]);
      rows.push([t("slope.yIntercept"), pt(q(0n), b)]);
    }
    rows.push([t("slope.standard"), standardForm(r.standard.a, r.standard.b, r.standard.c)]);
    // A horizontal line has no x-intercept, unless it is y = 0, the x-axis itself, where every point is one.
    const onAxis = r.line.kind === "sloped" && isZero(r.line.m) && isZero(r.line.b);
    rows.push([t("slope.xIntercept"), r.xIntercept ? pt(r.xIntercept, q(0n)) : onAxis ? t("slope.allXIntercepts") : t("slope.noXIntercept")]);
    rows.push([t("slope.angle"), `${f(r.angle)}°`]);
    if (r.line.kind === "sloped") rows.push([t("slope.grade"), `${f(toNumber(r.line.m) * 100)}%`]);
    rows.push([t("slope.distance"), r.radical && r.radical.r !== 1n ? `${r.radical.k === 1n ? "" : r.radical.k}√${r.radical.r} ≈ ${f(r.distance)}` : f(r.distance)]);
    rows.push([t("slope.midpoint"), pt(r.midpoint[0], r.midpoint[1])]);
    const working = [
      `Δx = ${formatQ(vals.x2)} − ${paren(vals.x1)} = ${formatQ(r.dx)}`,
      `Δy = ${formatQ(vals.y2)} − ${paren(vals.y1)} = ${formatQ(r.dy)}`,
      r.line.kind === "vertical" ? t("slope.verticalStep") : `m = Δy / Δx = ${formatQ(r.dy)} / ${paren(r.dx)} = ${formatQ(r.line.m)}`,
      ...(r.line.kind === "sloped" ? [`b = y₁ − m·x₁ = ${formatQ(vals.y1)} − ${paren(r.line.m)}·${paren(vals.x1)} = ${formatQ(r.line.b)}`] : []),
      `d = √(Δx² + Δy²) = √(${formatQ(mul(r.dx, r.dx))} + ${formatQ(mul(r.dy, r.dy))})`,
    ];
    outEl.append(
      h("p", { class: "shape-main", "data-out": "main" }, main),
      h("dl", { class: "stats-grid", "data-out": "rows" }, ...rows.flatMap(([k, v]) => [h("dt", null, k), h("dd", null, v)])),
      h("h3", null, t("slope.steps")),
      h("ol", { class: "factor-steps", "data-out": "working" }, ...working.map((x) => h("li", null, x))),
    );
    drawGraph(graph, vals, r.line.kind === "vertical" ? null : r.line);
    last = [
      `${t("slope.points")}: ${pt(vals.x1, vals.y1)}, ${pt(vals.x2, vals.y2)}`,
      `${t("slope.slope")}: ${main}`,
      ...rows.map(([k, v]) => `${k}: ${v}`),
      ...working,
    ].join("\n");
  };

  const pair = (n: 1 | 2) => h("div", { class: "slope-point" },
    h("span", { class: "slope-point-name" }, t(`slope.point${n}`)),
    h("label", { class: "field" }, h("span", null, `x${n === 1 ? "₁" : "₂"}`), inputs[`x${n}`]),
    h("label", { class: "field" }, h("span", null, `y${n === 1 ? "₁" : "₂"}`), inputs[`y${n}`]),
  );

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("slope.title")),
      h("p", { class: "lede" }, t("slope.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("slope.points")),
          pair(1),
          pair(2),
        ),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn ghost", "data-action": "swap", onClick: () => {
            const [x1, y1] = [inputs.x1.value, inputs.y1.value];
            inputs.x1.value = inputs.x2.value;
            inputs.y1.value = inputs.y2.value;
            inputs.x2.value = x1;
            inputs.y2.value = y1;
            paint();
          } }, t("slope.swap")),
          copyBtn = h("button", { type: "button", class: "btn ghost", "data-action": "copy", onClick: () => void copyWithFlash(copyBtn, last, { done: t("slope.copied"), failed: t("slope.copyFailed") }) }, t("slope.copy")),
        ),
        h("p", { class: "hint" }, t("slope.hint")),
        graph,
      ),
      h("div", { class: "rail" }, errorEl, outEl),
    ),
  );
  paint();
  mounted = { cleanup: () => { copyBtn = null; last = ""; } };
}

/** Whether n/d has a finite decimal: d has no prime factors but 2 and 5. */
function terminates(d: bigint): boolean {
  while (d % 2n === 0n) d /= 2n;
  while (d % 5n === 0n) d /= 5n;
  return d === 1n;
}

/** "3x − 2y = 6", "y = 4", "x = −1": whole coefficients, 1 not written, minus signs as U+2212. */
export function standardForm(a: bigint, b: bigint, c: bigint): string {
  const num = (v: bigint) => (v < 0n ? `−${-v}` : String(v));
  const times = (v: bigint, name: string) => (v === 1n ? name : v === -1n ? `−${name}` : `${num(v)}${name}`);
  let left = a !== 0n ? times(a, "x") : "";
  if (b !== 0n) left = left ? `${left} ${b < 0n ? "−" : "+"} ${times(b < 0n ? -b : b, "y")}` : times(b, "y");
  return `${left} = ${num(c)}`;
}

/** A negative number in brackets, as it is written after a minus sign. */
function paren(v: Q): string {
  return v.n < 0n ? `(${formatQ(v)})` : formatQ(v);
}

/** The two points and the line through them on a square grid that fits both with a margin. */
function drawGraph(svg: SVGSVGElement, v: Record<Field, Q>, line: { m: Q; b: Q } | null): void {
  const xs = [toNumber(v.x1), toNumber(v.x2)];
  const ys = [toNumber(v.y1), toNumber(v.y2)];
  const cx = (xs[0] + xs[1]) / 2;
  const cy = (ys[0] + ys[1]) / 2;
  const half = Math.max(Math.abs(xs[1] - xs[0]), Math.abs(ys[1] - ys[0]), 1) * 0.75;
  const view = { x0: cx - half, x1: cx + half, y0: cy - half, y1: cy + half };
  const W = 320;
  const px = (x: number) => ((x - view.x0) / (view.x1 - view.x0)) * W;
  const py = (y: number) => W - ((y - view.y0) / (view.y1 - view.y0)) * W;
  const el = (tag: string, attrs: Record<string, string | number>) => {
    const e = document.createElementNS(SVG, tag);
    for (const [k, val] of Object.entries(attrs)) e.setAttribute(k, String(val));
    svg.append(e);
    return e;
  };
  el("rect", { x: 0, y: 0, width: W, height: W, class: "slope-bg" });
  // Axes where they fall inside the view.
  if (view.x0 < 0 && view.x1 > 0) el("line", { x1: px(0), y1: 0, x2: px(0), y2: W, class: "slope-axis" });
  if (view.y0 < 0 && view.y1 > 0) el("line", { x1: 0, y1: py(0), x2: W, y2: py(0), class: "slope-axis" });
  if (line) {
    const m = toNumber(line.m);
    const b = toNumber(line.b);
    el("line", { x1: px(view.x0), y1: py(m * view.x0 + b), x2: px(view.x1), y2: py(m * view.x1 + b), class: "slope-line" });
  } else {
    el("line", { x1: px(xs[0]), y1: 0, x2: px(xs[0]), y2: W, class: "slope-line" });
  }
  // The rise and run as a right triangle between the points.
  el("path", { d: `M${px(xs[0])},${py(ys[0])} H${px(xs[1])} V${py(ys[1])}`, class: "slope-run" });
  for (const [i, [x, y]] of [[xs[0], ys[0]], [xs[1], ys[1]]].entries()) {
    el("circle", { cx: px(x), cy: py(y), r: 6, class: "slope-dot" });
    const label = el("text", { x: px(x) + 9, y: py(y) - 9, class: "slope-text" });
    label.textContent = i === 0 ? "P₁" : "P₂";
  }
}

export function unmountSlope(): void {
  mounted?.cleanup();
  mounted = null;
}
