import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { formatter } from "../shape-calc";
import { appHref } from "../../shared/path";
import { parseDecimalInput } from "../../shared/decimal-input";
import { decimalMarkOf } from "../../shared/calculator";
import {
  CONCRETE_FIELDS,
  CONCRETE_SHAPES,
  CONCRETE_UNITS,
  CUBIC_FOOT,
  CUBIC_YARD,
  OPTIONAL_FIELDS,
  solveConcrete,
  toMetres,
  type ConcreteShape,
  type ConcreteUnit,
} from "../../shared/concrete";

type System = "metric" | "imperial";

/** Starting sizes for every shape, so each one shows a worked answer before anything is typed. */
const START: Record<System, Record<ConcreteShape, Record<string, string>>> = {
  imperial: {
    slab: { length: "10", width: "10", thickness: "4", quantity: "1" },
    footing: { length: "20", width: "12", depth: "12", quantity: "1" },
    wall: { length: "10", height: "4", thickness: "8", quantity: "1" },
    column: { diameter: "12", height: "4", quantity: "4" },
    tube: { outer: "12", inner: "8", height: "4", quantity: "1" },
    stairs: { width: "3", rise: "7", run: "11", steps: "4", platform: "" },
  },
  metric: {
    slab: { length: "3", width: "3", thickness: "10", quantity: "1" },
    footing: { length: "6", width: "30", depth: "30", quantity: "1" },
    wall: { length: "3", height: "1.2", thickness: "20", quantity: "1" },
    column: { diameter: "30", height: "1.2", quantity: "4" },
    tube: { outer: "30", inner: "20", height: "1.2", quantity: "1" },
    stairs: { width: "1", rise: "18", run: "28", steps: "4", platform: "" },
  },
};

let mounted: { cleanup: () => void } | null = null;

export function mountConcrete(host: HTMLElement): void {
  unmountConcrete();
  const loc = locale();
  const f = formatter(loc);
  // Builders in the US (and on the en pages, most of whom search from there) work in feet and inches.
  let system: System = loc === "en" ? "imperial" : "metric";
  let shape: ConcreteShape = "slab";
  // Typed sizes and chosen units are kept per shape: a footing's width is in inches where a slab's is in feet, so a
  // number carried across shapes would silently change meaning.
  const typed = Object.fromEntries(CONCRETE_SHAPES.map((sh) => [sh, { ...START[system][sh] }])) as Record<ConcreteShape, Record<string, string>>;
  const units = Object.fromEntries(CONCRETE_SHAPES.map((sh) => [sh, {}])) as Record<ConcreteShape, Record<string, ConcreteUnit>>;
  let last = "";
  let copyBtn: HTMLButtonElement | null = null;

  const unitOf = (id: string, sh: ConcreteShape = shape): ConcreteUnit => {
    const field = CONCRETE_FIELDS[sh].find((x) => x.id === id);
    return units[sh][id] ?? (system === "metric" ? field?.metric : field?.imperial) ?? "m";
  };

  const shapeSel = h("select", { "data-field": "shape", onChange: () => { shape = shapeSel.value as ConcreteShape; buildFields(); paint(); } },
    ...CONCRETE_SHAPES.map((sh) => h("option", { value: sh, selected: sh === shape }, t(`concrete.s_${sh}`))),
  );
  const systemSel = h("select", {
    "data-field": "system",
    onChange: () => {
      // A new system moves every size to that system's usual unit, converting what was typed (10 ft becomes 3.048 m).
      const next = systemSel.value as System;
      for (const sh of CONCRETE_SHAPES) {
        for (const field of CONCRETE_FIELDS[sh]) {
          if (field.kind !== "length") continue;
          const from = unitOf(field.id, sh);
          const to = (next === "metric" ? field.metric : field.imperial) ?? "m";
          const v = parseDecimalInput(typed[sh][field.id] ?? "", loc);
          // Written back in the page's decimal mark (9,84252 in es/id/vi), like every other number on it.
          if (v !== undefined && !Number.isNaN(v)) typed[sh][field.id] = String(Number((toMetres(v, from) / toMetres(1, to)).toPrecision(6))).replace(".", decimalMarkOf(loc));
        }
        units[sh] = {};
      }
      system = next;
      buildFields();
      paint();
    },
  },
    h("option", { value: "imperial", selected: system === "imperial" }, t("concrete.imperial")),
    h("option", { value: "metric", selected: system === "metric" }, t("concrete.metric")),
  );
  const waste = h("input", { type: "text", inputmode: "decimal", autocomplete: "off", value: "10", "data-field": "waste", onInput: () => paint() });
  const fieldsEl = h("div", { class: "shape-fields" });
  const errorEl = h("p", { class: "hint", "aria-live": "polite", "data-out": "error" });
  const outEl = h("div", { "data-out": "result" });

  const buildFields = () => {
    fieldsEl.replaceChildren(...CONCRETE_FIELDS[shape].map((field) => {
      const input = h("input", {
        type: "text",
        inputmode: field.kind === "count" ? "numeric" : "decimal",
        autocomplete: "off",
        "data-field": field.id,
        value: typed[shape][field.id] ?? "",
        placeholder: OPTIONAL_FIELDS.has(field.id) ? (field.id === "quantity" ? "1" : "0") : "",
        onInput: () => { typed[shape][field.id] = input.value; paint(); },
      });
      const label = h("span", null, t(`concrete.f_${field.id}`));
      if (field.kind === "count") return h("label", { class: "field" }, label, input);
      const sel = h("select", {
        "data-unit": field.id,
        "aria-label": `${t(`concrete.f_${field.id}`)} — ${t("concrete.unit")}`,
        onChange: () => { units[shape][field.id] = sel.value as ConcreteUnit; paint(); },
      }, ...CONCRETE_UNITS.map((u) => h("option", { value: u, selected: u === unitOf(field.id) }, u)));
      return h("label", { class: "field" }, label, h("span", { class: "concrete-size" }, input, sel));
    }));
  };

  const paint = () => {
    outEl.replaceChildren();
    last = "";
    const values: Record<string, number | undefined> = {};
    for (const field of CONCRETE_FIELDS[shape]) {
      const v = parseDecimalInput(typed[shape][field.id] ?? "", loc);
      values[field.id] = v === undefined || Number.isNaN(v) || field.kind === "count" ? v : toMetres(v, unitOf(field.id));
    }
    const w = parseDecimalInput(waste.value, loc);
    const r = solveConcrete({ shape, values, waste: w === undefined ? 0 : w });
    if (!r.ok) {
      errorEl.textContent = t(`concrete.err_${r.error}`, { field: r.field ? t(`concrete.f_${r.field}`) : "" });
      return;
    }
    errorEl.textContent = "";
    const yd = r.total / CUBIC_YARD;
    const ft = r.total / CUBIC_FOOT;
    const main = system === "imperial" ? `${f(yd)} yd³` : `${f(r.total)} m³`;
    const rows: Array<[string, string]> = [
      [t("concrete.cubicMetres"), `${f(r.total)} m³`],
      [t("concrete.cubicYards"), `${f(yd)} yd³`],
      [t("concrete.cubicFeet"), `${f(ft)} ft³`],
      [t("concrete.litres"), `${f(r.total * 1000)} L`],
      [t("concrete.net"), system === "imperial" ? `${f(r.net / CUBIC_YARD)} yd³` : `${f(r.net)} m³`],
    ];
    const bagRows = r.bags.filter((b) => (system === "imperial" ? b.id.startsWith("lb") : b.id.startsWith("kg")));
    outEl.append(
      h("p", { class: "hint" }, t("concrete.total")),
      h("p", { class: "shape-main", "data-out": "main" }, main),
      h("dl", { class: "stats-grid", "data-out": "volumes" }, ...rows.flatMap(([k, v]) => [h("dt", null, k), h("dd", null, v)])),
      h("h3", null, t("concrete.bags")),
      h("dl", { class: "stats-grid", "data-out": "bags" }, ...bagRows.flatMap((b) => [h("dt", null, t("concrete.bagOf", { size: b.label })), h("dd", null, f(b.count))])),
      h("p", { class: "hint" }, t("concrete.bagNote")),
    );
    last = [
      `${t(`concrete.s_${shape}`)}: ${CONCRETE_FIELDS[shape].filter((fl) => (typed[shape][fl.id] ?? "").trim()).map((fl) => `${t(`concrete.f_${fl.id}`)} ${typed[shape][fl.id]}${fl.kind === "length" ? ` ${unitOf(fl.id)}` : ""}`).join(", ")}`,
      `${t("concrete.waste")}: ${waste.value || "0"}%`,
      `${t("concrete.total")}: ${main}`,
      ...rows.map(([k, v]) => `${k}: ${v}`),
      ...bagRows.map((b) => `${t("concrete.bagOf", { size: b.label })}: ${b.count}`),
    ].join("\n");
  };

  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(loc, null), "data-nav": "home" }, t("concrete.back")),
      h("h1", null, t("concrete.title")),
      h("p", { class: "lede" }, t("concrete.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("concrete.options")),
          h("label", { class: "field" }, h("span", null, t("concrete.shape")), shapeSel),
          h("label", { class: "field" }, h("span", null, t("concrete.system")), systemSel),
          fieldsEl,
          h("label", { class: "field" }, h("span", null, t("concrete.waste")), waste),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn ghost", "data-action": "copy", onClick: () => void copyWithFlash(copyBtn, last, { done: t("concrete.copied"), failed: t("concrete.copyFailed") }) }, t("concrete.copy")),
        ),
        h("p", { class: "hint", "data-out": "shape-hint" }, t("concrete.hint")),
      ),
      h("div", { class: "rail" }, errorEl, outEl),
    ),
  );
  buildFields();
  paint();
  mounted = { cleanup: () => { copyBtn = null; last = ""; } };
}

export function unmountConcrete(): void {
  mounted?.cleanup();
  mounted = null;
}
