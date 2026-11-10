/** Shared page for the area and volume calculators: pick a shape and unit, type its sizes, read the answer and working. */
import { copyWithFlash } from "./copy";
import { h } from "./dom";
import { locale, t } from "./i18n";
import { LENGTH_UNITS, type Formatter, type LengthUnit, type ShapeField } from "../shared/area";
import { parseDecimalInput } from "../shared/decimal-input";
import { appHref } from "../shared/path";

export type ShapeAnswer =
  | { ok: true; main: number; second: number | null; secondApprox: boolean; working: string[] }
  | { ok: false; error: string };

export type ShapeCalcConfig<S extends string> = {
  /** Locale section: "area" or "volume". */
  ns: string;
  shapes: readonly S[];
  fields: Record<S, readonly ShapeField[]>;
  formula: Record<S, string>;
  solve: (shape: S, values: Record<string, number | undefined>, f: Formatter) => ShapeAnswer;
  /** Superscript for the main result's unit: "²" or "³". */
  power: string;
  /** Unit conversions of the main result, as [label, value] rows. */
  conversions: (main: number, unit: LengthUnit) => Array<[string, number]>;
  /** First values shown, so the page has an answer before anything is typed. */
  start: { shape: S; unit: LengthUnit; values: Record<string, string> };
};

type Mounted = { cleanup: () => void };
let mounted: Mounted | null = null;

/** Locale-aware number: up to 8 significant digits, exponent form for the very large and very small. */
export function formatter(loc: string): Formatter {
  const nf = new Intl.NumberFormat(loc, { maximumSignificantDigits: 8 });
  return (n: number) => {
    if (!Number.isFinite(n)) return "—";
    const abs = Math.abs(n);
    if (abs !== 0 && (abs >= 1e15 || abs < 1e-6)) return n.toExponential(6).replace(/\.?0+e/, "e").replace("e+", "e");
    return nf.format(n);
  };
}

export function mountShapeCalc<S extends string>(host: HTMLElement, cfg: ShapeCalcConfig<S>): void {
  unmountShapeCalc();
  const ns = cfg.ns;
  const f = formatter(locale());
  // Typed values by field id, kept across shapes so a radius typed for a circle is still there for a sector.
  const typed: Record<string, string> = { ...cfg.start.values };
  let shape = cfg.start.shape;
  let unit = cfg.start.unit;
  let last = "";
  const shapeSel = h("select", { "data-field": "shape", onChange: () => { shape = shapeSel.value as S; buildFields(); paint(); } },
    ...cfg.shapes.map((s) => h("option", { value: s, selected: s === shape }, t(`${ns}.s_${s}`))),
  );
  const unitSel = h("select", { "data-field": "unit", onChange: () => { unit = unitSel.value as LengthUnit; paint(); } },
    ...LENGTH_UNITS.map((u) => h("option", { value: u, selected: u === unit }, u)),
  );
  const fieldsEl = h("div", { class: "shape-fields" });
  const formulaEl = h("p", { class: "shape-formula", "data-out": "formula" });
  const errorEl = h("p", { class: "hint", "aria-live": "polite", "data-out": "error" });
  const outEl = h("div", { "data-out": "result" });
  let copyBtn: HTMLButtonElement | null = null;

  const buildFields = () => {
    fieldsEl.replaceChildren(...cfg.fields[shape].map((field) => {
      const input = h("input", {
        type: "text",
        // A count is whole; lengths and angles take a decimal keypad (and a decimal comma in es/id/vi).
        inputmode: field.kind === "count" ? "numeric" : "decimal",
        autocomplete: "off",
        "data-field": field.id,
        value: typed[field.id] ?? "",
        onInput: () => { typed[field.id] = input.value; paint(); },
      });
      const unitText = field.kind === "length" ? unit : field.kind === "angle" ? "°" : "";
      return h("label", { class: "field" },
        h("span", null, `${t(`${ns}.f_${field.id}`)} (${field.symbol})`, h("span", { class: "muted", "data-unit": field.kind }, unitText ? ` ${unitText}` : "")),
        input,
      );
    }));
    formulaEl.textContent = cfg.formula[shape];
  };

  const paint = () => {
    for (const el of fieldsEl.querySelectorAll<HTMLElement>("[data-unit=length]")) el.textContent = ` ${unit}`;
    const values: Record<string, number | undefined> = {};
    for (const field of cfg.fields[shape]) values[field.id] = parseDecimalInput(typed[field.id] ?? "", locale());
    const r = cfg.solve(shape, values, f);
    outEl.replaceChildren();
    last = "";
    if (!r.ok) {
      errorEl.textContent = t(`${ns}.err_${r.error}`);
      return;
    }
    errorEl.textContent = "";
    const mainText = `${f(r.main)} ${unit}${cfg.power}`;
    const rows: Array<[string, string]> = [[t(`${ns}.main`), mainText]];
    if (r.second !== null) rows.push([t(`${ns}.second`), `${r.secondApprox ? "≈ " : ""}${f(r.second)} ${unit}${cfg.power === "³" ? "²" : ""}`]);
    const conv = cfg.conversions(r.main, unit);
    outEl.append(
      h("p", { class: "shape-main", "data-out": "main" }, mainText),
      h("dl", { class: "stats-grid" }, ...rows.flatMap(([k, v]) => [h("dt", null, k), h("dd", null, v)])),
      ...(r.second === null && cfg.power === "²" ? [h("p", { class: "hint", "data-out": "no-second" }, t(`${ns}.noSecond`))] : []),
      ...(r.secondApprox ? [h("p", { class: "hint" }, t(`${ns}.approx`))] : []),
      h("h3", null, t(`${ns}.steps`)),
      h("ol", { class: "factor-steps" }, ...r.working.map((x) => h("li", null, x))),
      h("h3", null, t(`${ns}.conversions`)),
      h("dl", { class: "stats-grid", "data-out": "conversions" }, ...conv.flatMap(([k, v]) => [h("dt", null, k), h("dd", null, f(v))])),
    );
    last = [
      `${t(`${ns}.s_${shape}`)}: ${cfg.fields[shape].map((fl) => `${fl.symbol} = ${typed[fl.id]}`).join(", ")}`,
      ...rows.map(([k, v]) => `${k}: ${v}`),
      cfg.formula[shape],
      ...r.working,
    ].join("\n");
  };

  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t(`${ns}.back`)),
      h("h1", null, t(`${ns}.title`)),
      h("p", { class: "lede" }, t(`${ns}.privacyNote`)),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t(`${ns}.options`)),
          h("label", { class: "field" }, h("span", null, t(`${ns}.shape`)), shapeSel),
          h("label", { class: "field" }, h("span", null, t(`${ns}.unit`)), unitSel),
          formulaEl,
          fieldsEl,
        ),
        h("div", { class: "stage-actions" },
          h("button", {
            type: "button",
            class: "btn ghost",
            "data-action": "clear",
            onClick: () => {
              for (const field of cfg.fields[shape]) typed[field.id] = "";
              buildFields();
              paint();
            },
          }, t(`${ns}.clear`)),
          copyBtn = h("button", { type: "button", class: "btn ghost", "data-action": "copy", onClick: () => void copyWithFlash(copyBtn, last, { done: t(`${ns}.copied`), failed: t(`${ns}.copyFailed`) }) }, t(`${ns}.copy`)),
        ),
        h("p", { class: "hint" }, t(`${ns}.hint`)),
      ),
      h("div", { class: "rail" }, errorEl, outEl),
    ),
  );
  buildFields();
  paint();
  mounted = { cleanup: () => { copyBtn = null; last = ""; } };
}

export function unmountShapeCalc(): void {
  mounted?.cleanup();
  mounted = null;
}
