import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { GLASS_ML, HOT_EXTRA_ML, MAX_EXERCISE_MIN, ML_PER_EXERCISE_MIN, ML_PER_KG, waterIntake, type Climate } from "../../shared/water-intake";
import { LB_PER_KG } from "../../shared/tdee";

let unitsEl: HTMLSelectElement | null = null;
let weightEl: HTMLInputElement | null = null;
let weightLabel: HTMLElement | null = null;
let exerciseEl: HTMLInputElement | null = null;
let climateEl: HTMLSelectElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";
/** Weight in kg, unrounded across unit switches. */
let kg = 70;

export function mountWaterIntake(host: HTMLElement): void {
  unitsEl = h("select", { "data-field": "units", onChange: () => switchUnits() },
    h("option", { value: "kg", selected: true }, t("waterIntake.kg")),
    h("option", { value: "lb" }, t("waterIntake.lb")),
  );
  unitsEl.value = "kg";
  weightEl = h("input", { type: "number", min: "0", step: "0.1", inputmode: "decimal", value: "70", "data-field": "weight", onInput: () => { readWeight(); paint(); } });
  weightLabel = h("span", null, t("waterIntake.weight"));
  exerciseEl = h("input", { type: "number", min: "0", max: String(MAX_EXERCISE_MIN), step: "5", inputmode: "numeric", value: "30", "data-field": "exercise", onInput: () => paint() });
  climateEl = h("select", { "data-field": "climate", onChange: () => paint() },
    h("option", { value: "temperate", selected: true }, t("waterIntake.temperate")),
    h("option", { value: "hot" }, t("waterIntake.hot")),
  );
  climateEl.value = "temperate";
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("waterIntake.back")),
      h("h1", null, t("waterIntake.title")),
      h("p", { class: "lede" }, t("waterIntake.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("waterIntake.options")),
          h("label", { class: "field" }, h("span", null, t("waterIntake.units")), unitsEl),
          h("label", { class: "field" }, weightLabel, weightEl),
          h("label", { class: "field" }, h("span", null, t("waterIntake.exercise")), exerciseEl),
          h("label", { class: "field" }, h("span", null, t("waterIntake.climate")), climateEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("waterIntake.copy")),
        ),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("waterIntake.result")),
        outEl,
        h("p", { class: "hint" }, t("waterIntake.formula", { kg: ML_PER_KG, min: ML_PER_EXERCISE_MIN, hot: HOT_EXTRA_ML, glass: GLASS_ML })),
        h("p", { class: "hint" }, t("waterIntake.disclaimer")),
      ),
    ),
  );
  kg = 70;
  paint();
}

export function unmountWaterIntake(): void {
  unitsEl = climateEl = null;
  weightEl = exerciseEl = null;
  weightLabel = outEl = null;
  copyBtn = null;
  last = "";
}

function lbMode(): boolean {
  return unitsEl?.value === "lb";
}

function readWeight(): void {
  const raw = weightEl?.value.trim() ?? "";
  kg = raw === "" ? NaN : lbMode() ? Number(raw) / LB_PER_KG : Number(raw);
}

function switchUnits(): void {
  if (!weightEl) return;
  weightEl.value = Number.isFinite(kg) && kg > 0 ? String(Math.round((lbMode() ? kg * LB_PER_KG : kg) * 10) / 10) : "";
  paint();
}

function paint(): void {
  if (!outEl || !climateEl || !exerciseEl) return;
  const exRaw = exerciseEl.value.trim();
  const out = waterIntake(kg, exRaw === "" ? 0 : Number(exRaw), climateEl.value as Climate);
  outEl.replaceChildren();
  if (!out) {
    last = "";
    outEl.append(h("p", { class: "muted" }, lbMode() ? t("waterIntake.invalidLb") : t("waterIntake.invalid")));
    return;
  }
  const fmt = new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 });
  const ml = new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 });
  const rows: Array<[string, string]> = [
    [t("waterIntake.total"), t("waterIntake.litres", { n: fmt.format(out.litres) })],
    [t("waterIntake.glasses"), t("waterIntake.glassCount", { n: out.glasses, ml: GLASS_ML })],
    [t("waterIntake.base"), `${ml.format(out.base)} ml`],
    [t("waterIntake.fromExercise"), `${ml.format(out.exercise)} ml`],
    [t("waterIntake.fromClimate"), `${ml.format(out.climate)} ml`],
  ];
  for (const [k, v] of rows) outEl.append(h("dt", null, k), h("dd", null, v));
  last = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
}

async function copyOut(): Promise<void> {
  await copyWithFlash(copyBtn, last, { done: t("waterIntake.copied"), failed: t("waterIntake.copyFailed") });
}
