import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { bodyFat } from "../../shared/body-fat";
import { CM_PER_IN, LB_PER_KG, type Sex } from "../../shared/tdee";

type Units = "metric" | "imperial";

let unitsEl: HTMLSelectElement | null = null;
let sexEl: HTMLSelectElement | null = null;
let heightEl: HTMLInputElement | null = null;
let neckEl: HTMLInputElement | null = null;
let waistEl: HTMLInputElement | null = null;
let hipEl: HTMLInputElement | null = null;
let weightEl: HTMLInputElement | null = null;
let hipBox: HTMLElement | null = null;
let unitSpans: HTMLElement[] = [];
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountBodyFat(host: HTMLElement): void {
  const num = (field: string, value: string) =>
    h("input", { type: "number", min: "0", step: "0.1", inputmode: "decimal", "data-field": field, value, onInput: () => paint() });
  unitsEl = h("select", { "data-field": "units", onChange: () => switchUnits() },
    h("option", { value: "metric", selected: true }, t("bodyFat.metric")),
    h("option", { value: "imperial" }, t("bodyFat.imperial")),
  );
  unitsEl.value = "metric";
  sexEl = h("select", { "data-field": "sex", onChange: () => paint() },
    h("option", { value: "male", selected: true }, t("bodyFat.male")),
    h("option", { value: "female" }, t("bodyFat.female")),
  );
  sexEl.value = "male";
  heightEl = num("height", "175");
  neckEl = num("neck", "38");
  waistEl = num("waist", "85");
  hipEl = num("hip", "95");
  weightEl = num("weight", "70");
  hipBox = h("div", { hidden: true }, field(t("bodyFat.hip"), hipEl));
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("bodyFat.back")),
      h("h1", null, t("bodyFat.title")),
      h("p", { class: "lede" }, t("bodyFat.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("bodyFat.options")),
          h("label", { class: "field" }, h("span", null, t("bodyFat.units")), unitsEl),
          h("label", { class: "field" }, h("span", null, t("bodyFat.sex")), sexEl),
          field(t("bodyFat.height"), heightEl),
          field(t("bodyFat.neck"), neckEl),
          field(t("bodyFat.waist"), waistEl),
          hipBox,
          field(t("bodyFat.weight"), weightEl, true),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("bodyFat.copy")),
        ),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("bodyFat.result")),
        outEl,
        h("p", { class: "hint" }, t("bodyFat.formula")),
        h("p", { class: "hint" }, t("bodyFat.disclaimer")),
      ),
    ),
  );
  paint();
}

export function unmountBodyFat(): void {
  unitsEl = sexEl = null;
  heightEl = neckEl = waistEl = hipEl = weightEl = null;
  hipBox = outEl = null;
  unitSpans = [];
  copyBtn = null;
  last = "";
}

function field(label: string, control: HTMLElement, mass = false): HTMLElement {
  const unit = h("span", { class: "muted" }, mass ? t("bodyFat.kg") : t("bodyFat.cm"));
  unit.dataset.mass = mass ? "1" : "";
  unitSpans.push(unit);
  return h("label", { class: "field" }, h("span", null, `${label} `, unit), control);
}

function units(): Units {
  return unitsEl?.value === "imperial" ? "imperial" : "metric";
}

const round1 = (n: number) => String(Math.round(n * 10) / 10);

/** Carry the numbers across when the unit system changes; an empty field stays empty. */
function switchUnits(): void {
  const imperial = units() === "imperial";
  for (const el of [heightEl, neckEl, waistEl, hipEl]) {
    if (!el) continue;
    const n = Number(el.value);
    el.value = el.value.trim() !== "" && n > 0 ? round1(imperial ? n / CM_PER_IN : n * CM_PER_IN) : "";
  }
  if (weightEl) {
    const n = Number(weightEl.value);
    weightEl.value = weightEl.value.trim() !== "" && n > 0 ? round1(imperial ? n * LB_PER_KG : n / LB_PER_KG) : "";
  }
  for (const span of unitSpans) {
    const mass = span.dataset.mass === "1";
    span.textContent = imperial ? (mass ? t("bodyFat.lb") : t("bodyFat.in")) : (mass ? t("bodyFat.kg") : t("bodyFat.cm"));
  }
  paint();
}

function cmOf(el: HTMLInputElement | null): number {
  const raw = el?.value.trim() ?? "";
  if (raw === "") return NaN;
  const n = Number(raw);
  return units() === "imperial" ? n * CM_PER_IN : n;
}

function paint(): void {
  if (!outEl || !sexEl || !hipBox) return;
  const sex = sexEl.value as Sex;
  hipBox.hidden = sex !== "female";
  const weightRaw = weightEl?.value.trim() ?? "";
  const kg = weightRaw === "" ? undefined : units() === "imperial" ? Number(weightRaw) / LB_PER_KG : Number(weightRaw);
  const out = bodyFat({ sex, cm: cmOf(heightEl), neck: cmOf(neckEl), waist: cmOf(waistEl), hip: sex === "female" ? cmOf(hipEl) : undefined, kg });
  outEl.replaceChildren();
  if (!out) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("bodyFat.invalid")));
    return;
  }
  const fmt = new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 });
  const mass = (n: number) => units() === "imperial" ? `${fmt.format(n * LB_PER_KG)} ${t("bodyFat.lb")}` : `${fmt.format(n)} ${t("bodyFat.kg")}`;
  const rows: Array<[string, string]> = [
    [t("bodyFat.percent"), `${fmt.format(out.percent)}%`],
    [t("bodyFat.category"), t(`bodyFat.cat_${out.category}`)],
  ];
  if (out.fatKg != null && out.leanKg != null) {
    rows.push([t("bodyFat.fatMass"), mass(out.fatKg)], [t("bodyFat.leanMass"), mass(out.leanKg)]);
  }
  last = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
  for (const [k, v] of rows) outEl.append(h("dt", null, k), h("dd", null, v));
}

async function copyOut(): Promise<void> {
  await copyWithFlash(copyBtn, last, { done: t("bodyFat.copied"), failed: t("bodyFat.copyFailed") });
}
