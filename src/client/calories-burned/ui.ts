import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { ACTIVITIES, caloriesBurned, type ActivityId } from "../../shared/calories-burned";
import { LB_PER_KG, lbToKg } from "../../shared/tdee";

let activityEl: HTMLSelectElement | null = null;
let unitEl: HTMLSelectElement | null = null;
let weightEl: HTMLInputElement | null = null;
let minutesEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let compareEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";
/** Body weight in kg, unrounded across unit switches. */
let kg = 70;

export function mountCaloriesBurned(host: HTMLElement): void {
  activityEl = h("select", { "data-field": "activity", onChange: () => paint() },
    ...ACTIVITIES.map((a) => h("option", { value: a.id, selected: a.id === "walkBrisk" }, t(`caloriesBurned.act_${a.id}`))),
  );
  unitEl = h("select", { "data-field": "unit", onChange: () => switchUnit() },
    h("option", { value: "kg", selected: true }, "kg"),
    h("option", { value: "lb" }, "lb"),
  );
  weightEl = h("input", { type: "number", min: "0", step: "0.1", inputmode: "decimal", value: "70", "data-field": "weight", onInput: () => { readWeight(); paint(); } });
  minutesEl = h("input", { type: "number", min: "0", step: "5", inputmode: "numeric", value: "30", "data-field": "minutes", onInput: () => paint() });
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  compareEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("caloriesBurned.back")),
      h("h1", null, t("caloriesBurned.title")),
      h("p", { class: "lede" }, t("caloriesBurned.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("caloriesBurned.options")),
          h("label", { class: "field" }, h("span", null, t("caloriesBurned.activity")), activityEl),
          h("div", { class: "field" }, h("span", null, t("caloriesBurned.weight")), h("div", { class: "row fuel-row" }, weightEl, unitEl)),
          h("label", { class: "field" }, h("span", null, t("caloriesBurned.minutes")), minutesEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("caloriesBurned.copy")),
        ),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("caloriesBurned.result")),
        outEl,
        h("h2", null, t("caloriesBurned.compare")),
        compareEl,
        h("p", { class: "hint" }, t("caloriesBurned.formula")),
      ),
    ),
  );
  kg = 70;
  paint();
}

export function unmountCaloriesBurned(): void {
  activityEl = unitEl = null;
  weightEl = minutesEl = null;
  outEl = compareEl = null;
  copyBtn = null;
  last = "";
}

function lbMode(): boolean {
  return unitEl?.value === "lb";
}

function readWeight(): void {
  const raw = weightEl?.value.trim() ?? "";
  kg = raw === "" ? NaN : lbMode() ? lbToKg(Number(raw)) : Number(raw);
}

function switchUnit(): void {
  if (weightEl && Number.isFinite(kg) && kg > 0) weightEl.value = String(Math.round((lbMode() ? kg * LB_PER_KG : kg) * 10) / 10);
  paint();
}

function paint(): void {
  if (!outEl || !compareEl || !activityEl || !minutesEl) return;
  const minutes = minutesEl.value.trim() === "" ? NaN : Number(minutesEl.value);
  const id = activityEl.value as ActivityId;
  const out = caloriesBurned(id, kg, minutes);
  outEl.replaceChildren();
  compareEl.replaceChildren();
  if (!out) {
    last = "";
    outEl.append(h("p", { class: "muted" }, lbMode() ? t("caloriesBurned.invalidLb") : t("caloriesBurned.invalid")));
    return;
  }
  const n0 = new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 });
  const n1 = new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 });
  const rows: Array<[string, string]> = [
    [t("caloriesBurned.kcal"), `${n0.format(out.kcal)} kcal`],
    [t("caloriesBurned.perMinute"), `${n1.format(out.perMinute)} kcal`],
    [t("caloriesBurned.met"), n1.format(out.met)],
    [t("caloriesBurned.fat"), `${n0.format(out.fatGrams)} g`],
  ];
  for (const [k, v] of rows) outEl.append(h("dt", null, k), h("dd", null, v));
  // Same weight and minutes for every activity, highest first.
  const others = ACTIVITIES.map((a) => ({ id: a.id, kcal: caloriesBurned(a.id, kg, minutes)?.kcal ?? 0 })).sort((a, b) => b.kcal - a.kcal);
  for (const o of others) compareEl.append(h("dt", null, t(`caloriesBurned.act_${o.id}`)), h("dd", o.id === id ? { class: "sleep-best" } : null, `${n0.format(o.kcal)} kcal`));
  last = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
}

async function copyOut(): Promise<void> {
  await copyWithFlash(copyBtn, last, { done: t("caloriesBurned.copied"), failed: t("caloriesBurned.copyFailed") });
}
