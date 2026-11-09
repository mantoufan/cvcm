import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { fmt, layout, solveTriangle, type TriangleDetails, type TriangleInput, type TriangleResult } from "../../shared/triangle";

const SVG = "http://www.w3.org/2000/svg";
const FIELDS = ["a", "b", "c", "A", "B", "C"] as const;
type Field = (typeof FIELDS)[number];

/** Worked examples: the values to fill in, and whether C is a right angle. */
const EXAMPLES: Array<{ id: string; right: boolean; values: Partial<Record<Field, number>> }> = [
  { id: "right345", right: true, values: { a: 3, b: 4 } },
  { id: "sss", right: false, values: { a: 5, b: 6, c: 7 } },
  { id: "sas", right: false, values: { a: 5, b: 7, C: 60 } },
  { id: "asa", right: false, values: { A: 50, B: 60, c: 10 } },
  { id: "ssa", right: false, values: { a: 6, b: 8, A: 30 } },
];

const inputs: Partial<Record<Field, HTMLInputElement>> = {};
let rightEl: HTMLInputElement | null = null;
let errorEl: HTMLElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountTriangle(host: HTMLElement): void {
  for (const f of FIELDS) {
    inputs[f] = h("input", { type: "number", inputmode: "decimal", step: "any", min: "0", "data-field": f, onInput: () => paint() });
  }
  inputs.a!.value = "3";
  inputs.b!.value = "4";
  rightEl = h("input", { type: "checkbox", checked: true, "data-field": "right", onChange: () => paint() });
  errorEl = h("p", { class: "hint", "aria-live": "polite", "data-out": "error" });
  outEl = h("div", { "data-out": "result" });
  const field = (f: Field, label: string) => h("label", { class: "field" }, h("span", null, label), inputs[f]!);
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("triangle.back")),
      h("h1", null, t("triangle.title")),
      h("p", { class: "lede" }, t("triangle.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("triangle.options")),
          h("label", { class: "check" }, rightEl, h("span", null, t("triangle.right"))),
          h("p", { class: "hint", "data-out": "need" }),
          h("div", { class: "tri-fields" },
            field("a", t("triangle.sideA")),
            field("A", t("triangle.angleA")),
            field("b", t("triangle.sideB")),
            field("B", t("triangle.angleB")),
            field("c", t("triangle.sideC")),
            field("C", t("triangle.angleC")),
          ),
        ),
        h("div", { class: "chip-row" }, ...EXAMPLES.map((ex) => h("button", {
          type: "button",
          class: "chip",
          "data-example": ex.id,
          onClick: () => {
            for (const f of FIELDS) if (inputs[f]) inputs[f]!.value = ex.values[f] !== undefined ? String(ex.values[f]) : "";
            if (rightEl) rightEl.checked = ex.right;
            paint();
          },
        }, t(`triangle.ex_${ex.id}`)))),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn ghost", "data-action": "clear", onClick: () => { for (const f of FIELDS) inputs[f]!.value = ""; paint(); } }, t("triangle.clear")),
          copyBtn = h("button", { type: "button", class: "btn ghost", "data-action": "copy", onClick: () => void copyWithFlash(copyBtn, last, { done: t("triangle.copied"), failed: t("triangle.copyFailed") }) }, t("triangle.copy")),
        ),
        h("p", { class: "hint" }, t("triangle.hint")),
      ),
      h("div", { class: "rail" },
        errorEl,
        outEl,
      ),
    ),
  );
  paint();
}

export function unmountTriangle(): void {
  for (const f of FIELDS) delete inputs[f];
  rightEl = null;
  errorEl = outEl = null;
  copyBtn = null;
  last = "";
}

function read(): TriangleInput {
  const out: TriangleInput = {};
  for (const f of FIELDS) {
    const raw = inputs[f]?.value.trim() ?? "";
    // A decimal comma (es, id, vi keyboards) is read as a point.
    if (raw !== "") out[f] = Number(raw.replace(",", "."));
  }
  return out;
}

function paint(): void {
  if (!errorEl || !outEl || !rightEl) return;
  const right = rightEl.checked;
  const cEl = inputs.C!;
  cEl.disabled = right;
  if (right) cEl.value = "90";
  else if (cEl.value === "90" && cEl.dataset.auto === "1") cEl.value = "";
  cEl.dataset.auto = right ? "1" : "";
  const need = outEl.closest(".data-tool")?.querySelector<HTMLElement>("[data-out=need]");
  if (need) need.textContent = right ? t("triangle.needRight") : t("triangle.needThree");
  const input = read();
  if (right) delete input.C;
  const r = solveTriangle(input, right);
  outEl.replaceChildren();
  last = "";
  for (const f of FIELDS) inputs[f]!.classList.remove("tri-given");
  if (!r.ok) {
    errorEl.textContent = t(`triangle.err_${r.error}`);
    return;
  }
  errorEl.textContent = r.solutions.length > 1 ? t("triangle.twoSolutions") : "";
  for (const f of FIELDS) if (input[f] !== undefined) inputs[f]!.classList.add("tri-given");
  const blocks = r.solutions.map((s, i) => solutionBlock(s, i, r));
  outEl.append(...blocks.map((b) => b.el));
  last = blocks.map((b) => b.text).join("\n\n");
}

function solutionBlock(s: TriangleDetails, index: number, r: Extract<TriangleResult, { ok: true }>): { el: HTMLElement; text: string } {
  const rows: Array<[string, string]> = [
    ["a", fmt(s.a)], ["b", fmt(s.b)], ["c", fmt(s.c)],
    ["A", `${fmt(s.A)}°`], ["B", `${fmt(s.B)}°`], ["C", `${fmt(s.C)}°`],
    [t("triangle.area"), fmt(s.area)],
    [t("triangle.perimeter"), fmt(s.perimeter)],
    [t("triangle.heightTo", { side: "a" }), fmt(s.ha)],
    [t("triangle.heightTo", { side: "b" }), fmt(s.hb)],
    [t("triangle.heightTo", { side: "c" }), fmt(s.hc)],
    [t("triangle.inradius"), fmt(s.inradius)],
    [t("triangle.circumradius"), fmt(s.circumradius)],
    [t("triangle.type"), `${t(`triangle.sides_${s.bySides}`)}, ${t(`triangle.angles_${s.byAngles}`)}`],
  ];
  const steps = stepsFor(s, r);
  const title = r.solutions.length > 1 ? t("triangle.solutionN", { n: index + 1 }) : t("triangle.result");
  const el = h("section", { class: "tri-solution", "data-solution": String(index + 1) },
    h("h2", null, title),
    drawing(s),
    h("dl", { class: "stats-grid" }, ...rows.flatMap(([k, v]) => [h("dt", null, k), h("dd", null, v)])),
    h("h3", null, t("triangle.steps")),
    h("ol", { class: "factor-steps" }, ...steps.map((x) => h("li", null, x))),
  );
  const text = [title, ...rows.map(([k, v]) => `${k}: ${v}`), "", t("triangle.steps"), ...steps.map((x, i) => `${i + 1}. ${x}`)].join("\n");
  return { el, text };
}

/** The working, in the order the solver used. */
function stepsFor(s: TriangleDetails, r: Extract<TriangleResult, { ok: true }>): string[] {
  const out = [t(`triangle.case_${r.case}`)];
  if (r.case === "right") {
    if (r.method === "pythagoras") out.push(`a² + b² = c² → ${fmt(s.a)}² + ${fmt(s.b)}² = ${fmt(s.c)}²`);
    else out.push(`a = c · sin A = ${fmt(s.c)} · sin ${fmt(s.A)}° = ${fmt(s.a)}`, `b = c · cos A = ${fmt(s.c)} · cos ${fmt(s.A)}° = ${fmt(s.b)}`);
    out.push(`A = arcsin(a / c) = ${fmt(s.A)}°`, `B = 90° − A = ${fmt(s.B)}°`);
  } else if (r.case === "sss") {
    out.push(`cos A = (b² + c² − a²) / 2bc → A = ${fmt(s.A)}°`, `cos B = (a² + c² − b²) / 2ac → B = ${fmt(s.B)}°`, `C = 180° − A − B = ${fmt(s.C)}°`);
  } else if (r.case === "sas") {
    out.push(t("triangle.stepCosines"), `a / sin A = b / sin B = c / sin C = ${fmt(s.a / Math.sin((s.A * Math.PI) / 180))}`);
  } else {
    if (r.case === "asa" || r.case === "aas") out.push(t("triangle.stepAngleSum"));
    out.push(`a / sin A = b / sin B = c / sin C = ${fmt(s.a / Math.sin((s.A * Math.PI) / 180))}`);
    if (r.case === "ssa" && r.solutions.length > 1) out.push(t("triangle.stepAmbiguous"));
  }
  out.push(`${t("triangle.area")} = ½ · b · c · sin A = ${fmt(s.area)}`);
  return out;
}

function drawing(s: TriangleDetails): SVGSVGElement {
  const W = 320;
  const H = 200;
  const p = layout(s, W, H, 28);
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", t("triangle.drawingLabel", { a: fmt(s.a), b: fmt(s.b), c: fmt(s.c) }));
  svg.setAttribute("class", "tri-svg");
  const poly = document.createElementNS(SVG, "polygon");
  poly.setAttribute("points", [p.A, p.B, p.C].map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" "));
  poly.setAttribute("class", "tri-shape");
  svg.append(poly);
  const cx = (p.A[0] + p.B[0] + p.C[0]) / 3;
  const cy = (p.A[1] + p.B[1] + p.C[1]) / 3;
  const label = (text: string, [x, y]: [number, number], push: number, cls: string) => {
    // Vertex labels sit outside the corner; side labels outside the middle of the side.
    const dx = x - cx;
    const dy = y - cy;
    const len = Math.hypot(dx, dy) || 1;
    const el = document.createElementNS(SVG, "text");
    el.setAttribute("x", (x + (dx / len) * push).toFixed(1));
    el.setAttribute("y", (y + (dy / len) * push + 4).toFixed(1));
    el.setAttribute("text-anchor", "middle");
    el.setAttribute("class", cls);
    el.textContent = text;
    svg.append(el);
  };
  const mid = (u: [number, number], v: [number, number]): [number, number] => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2];
  label("A", p.A, 14, "tri-vertex");
  label("B", p.B, 14, "tri-vertex");
  label("C", p.C, 14, "tri-vertex");
  label("a", mid(p.B, p.C), 12, "tri-side");
  label("b", mid(p.A, p.C), 12, "tri-side");
  label("c", mid(p.A, p.B), 12, "tri-side");
  return svg;
}
