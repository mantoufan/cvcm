import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { FORMULAS, healthyBmiRange, idealWeights } from "../../shared/ideal-weight";
import { CM_PER_IN, LB_PER_KG, feetInchesToCm, type Sex } from "../../shared/tdee";

type Units = "metric" | "imperial";

let unitsEl: HTMLSelectElement | null = null;
let sexEl: HTMLSelectElement | null = null;
let cmEl: HTMLInputElement | null = null;
let ftEl: HTMLInputElement | null = null;
let inEl: HTMLInputElement | null = null;
let metricBox: HTMLElement | null = null;
let imperialBox: HTMLElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";
/** Height in cm, kept unrounded across unit switches. */
let heightCm = 170;

export function mountIdealWeight(host: HTMLElement): void {
  unitsEl = h("select", { "data-field": "units", onChange: () => switchUnits() },
    h("option", { value: "metric", selected: true }, t("idealWeight.metric")),
    h("option", { value: "imperial" }, t("idealWeight.imperial")),
  );
  unitsEl.value = "metric";
  sexEl = h("select", { "data-field": "sex", onChange: () => paint() },
    h("option", { value: "male", selected: true }, t("idealWeight.male")),
    h("option", { value: "female" }, t("idealWeight.female")),
  );
  sexEl.value = "male";
  cmEl = h("input", { type: "number", min: "0", step: "0.1", inputmode: "decimal", value: "170", "data-field": "cm", onInput: () => { readHeight(); paint(); } });
  ftEl = h("input", { type: "number", min: "0", step: "1", inputmode: "numeric", value: "5", "data-field": "ft", onInput: () => { readHeight(); paint(); } });
  inEl = h("input", { type: "number", min: "0", step: "0.1", inputmode: "decimal", value: "7", "data-field": "in", onInput: () => { readHeight(); paint(); } });
  metricBox = h("div", null, h("label", { class: "field" }, h("span", null, t("idealWeight.cm")), cmEl));
  imperialBox = h("div", { class: "row", hidden: true },
    h("label", { class: "field" }, h("span", null, t("idealWeight.ft")), ftEl),
    h("label", { class: "field" }, h("span", null, t("idealWeight.in")), inEl),
  );
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("idealWeight.back")),
      h("h1", null, t("idealWeight.title")),
      h("p", { class: "lede" }, t("idealWeight.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("idealWeight.options")),
          h("label", { class: "field" }, h("span", null, t("idealWeight.units")), unitsEl),
          h("label", { class: "field" }, h("span", null, t("idealWeight.sex")), sexEl),
          metricBox,
          imperialBox,
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("idealWeight.copy")),
        ),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("idealWeight.result")),
        outEl,
        h("p", { class: "hint" }, t("idealWeight.formula")),
        h("p", { class: "hint" }, t("idealWeight.disclaimer")),
      ),
    ),
  );
  heightCm = 170;
  paint();
}

export function unmountIdealWeight(): void {
  unitsEl = sexEl = null;
  cmEl = ftEl = inEl = null;
  metricBox = imperialBox = outEl = null;
  copyBtn = null;
  last = "";
}

function units(): Units {
  return unitsEl?.value === "imperial" ? "imperial" : "metric";
}

function readHeight(): void {
  if (units() === "imperial") {
    const ft = ftEl?.value.trim() ?? "";
    const inch = inEl?.value.trim() ?? "";
    heightCm = ft === "" && inch === "" ? NaN : feetInchesToCm(Number(ft) || 0, Number(inch) || 0);
  } else {
    const raw = cmEl?.value.trim() ?? "";
    heightCm = raw === "" ? NaN : Number(raw);
  }
}

function switchUnits(): void {
  if (!cmEl || !ftEl || !inEl || !metricBox || !imperialBox) return;
  const imperial = units() === "imperial";
  if (Number.isFinite(heightCm) && heightCm > 0) {
    if (imperial) {
      const totalIn = heightCm / CM_PER_IN;
      let ft = Math.floor(totalIn / 12);
      let inch = Math.round((totalIn - ft * 12) * 10) / 10;
      if (inch >= 12) { ft += 1; inch = 0; }
      ftEl.value = String(ft);
      inEl.value = String(inch);
    } else {
      cmEl.value = String(Math.round(heightCm * 10) / 10);
    }
  } else {
    cmEl.value = ftEl.value = inEl.value = "";
  }
  metricBox.hidden = imperial;
  imperialBox.hidden = !imperial;
  paint();
}

function paint(): void {
  if (!outEl || !sexEl) return;
  const sex = sexEl.value as Sex;
  const ideal = idealWeights(sex, heightCm);
  const range = healthyBmiRange(heightCm);
  outEl.replaceChildren();
  if (!ideal || !range) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("idealWeight.invalid")));
    return;
  }
  const imperial = units() === "imperial";
  const fmt = new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 });
  const mass = (kg: number) => imperial ? `${fmt.format(kg * LB_PER_KG)} ${t("idealWeight.lb")}` : `${fmt.format(kg)} ${t("idealWeight.kg")}`;
  const rows: Array<[string, string]> = FORMULAS.map((f) => [t(`idealWeight.f_${f}`), mass(ideal[f])]);
  rows.push([t("idealWeight.bmiRange"), `${mass(range.low)} – ${mass(range.high)}`]);
  for (const [k, v] of rows) outEl.append(h("dt", null, k), h("dd", null, v));
  last = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
}

async function copyOut(): Promise<void> {
  await copyWithFlash(copyBtn, last, { done: t("idealWeight.copied"), failed: t("idealWeight.copyFailed") });
}
