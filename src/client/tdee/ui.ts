import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import {
  ACTIVITIES,
  BULK_KCAL,
  cmToFeetInches,
  CUT_KCAL,
  LB_PER_KG,
  feetInchesToCm,
  lbToKg,
  tdeeFrom,
  type Activity,
  type Sex,
} from "../../shared/tdee";

type Units = "metric" | "imperial";

let unitsEl: HTMLSelectElement | null = null;
let sexEl: HTMLSelectElement | null = null;
let ageEl: HTMLInputElement | null = null;
let kgEl: HTMLInputElement | null = null;
let cmEl: HTMLInputElement | null = null;
let lbEl: HTMLInputElement | null = null;
let ftEl: HTMLInputElement | null = null;
let inEl: HTMLInputElement | null = null;
let activityEl: HTMLSelectElement | null = null;
let metricBox: HTMLElement | null = null;
let imperialBox: HTMLElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountTdee(host: HTMLElement): void {
  const num = (field: string, value: string, step = "1") =>
    h("input", { type: "number", min: "0", step, inputmode: "decimal", "data-field": field, value, onInput: () => paint() });
  unitsEl = h("select", { "data-field": "units", onChange: () => switchUnits() },
    h("option", { value: "metric", selected: true }, t("tdee.metric")),
    h("option", { value: "imperial" }, t("tdee.imperial")),
  );
  sexEl = h("select", { "data-field": "sex", onChange: () => paint() },
    h("option", { value: "male", selected: true }, t("tdee.male")),
    h("option", { value: "female" }, t("tdee.female")),
  );
  ageEl = num("age", "30");
  kgEl = num("kg", "70", "0.1");
  cmEl = num("cm", "175", "0.1");
  lbEl = num("lb", "154", "0.1");
  ftEl = num("ft", "5");
  inEl = num("in", "9", "0.1");
  activityEl = h("select", { "data-field": "activity", onChange: () => paint() },
    ...ACTIVITIES.map((a) => h("option", { value: a, selected: a === "moderate" }, t(`tdee.act_${a}`))),
  );
  // happy-dom (prerender) ignores `selected` on options added before the select is built; set the value explicitly.
  activityEl.value = "moderate";
  metricBox = h("div", null, labeled(t("tdee.kg"), kgEl), labeled(t("tdee.cm"), cmEl));
  imperialBox = h("div", { hidden: true },
    labeled(t("tdee.lb"), lbEl),
    h("div", { class: "row" }, labeled(t("tdee.ft"), ftEl), labeled(t("tdee.in"), inEl)),
  );
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("tdee.back")),
      h("h1", null, t("tdee.title")),
      h("p", { class: "lede" }, t("tdee.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("tdee.options")),
          labeled(t("tdee.units"), unitsEl),
          labeled(t("tdee.sex"), sexEl),
          labeled(t("tdee.age"), ageEl),
          metricBox,
          imperialBox,
          labeled(t("tdee.activity"), activityEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("tdee.copy")),
        ),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("tdee.result")),
        outEl,
        h("p", { class: "hint" }, t("tdee.formula")),
        h("p", { class: "hint" }, t("tdee.disclaimer")),
      ),
    ),
  );
  paint();
}

export function unmountTdee(): void {
  unitsEl = sexEl = activityEl = null;
  ageEl = kgEl = cmEl = lbEl = ftEl = inEl = null;
  metricBox = imperialBox = outEl = null;
  copyBtn = null;
  last = "";
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function units(): Units {
  return unitsEl?.value === "imperial" ? "imperial" : "metric";
}

const round1 = (n: number) => String(Math.round(n * 10) / 10);

/** Carry the current body numbers across when the unit system changes. */
function switchUnits(): void {
  if (!kgEl || !cmEl || !lbEl || !ftEl || !inEl || !metricBox || !imperialBox) return;
  if (units() === "imperial") {
    const kg = Number(kgEl.value);
    const cm = Number(cmEl.value);
    // An empty or invalid source clears the target, so the result stays invalid instead of using a stale value.
    lbEl.value = kgEl.value.trim() !== "" && kg > 0 ? round1(kg * LB_PER_KG) : "";
    if (cmEl.value.trim() !== "" && cm > 0) {
      const { ft, inch } = cmToFeetInches(cm);
      ftEl.value = String(ft);
      inEl.value = String(inch);
    } else {
      ftEl.value = "";
      inEl.value = "";
    }
  } else {
    const lb = Number(lbEl.value);
    const noHeight = ftEl.value.trim() === "" && inEl.value.trim() === "";
    const cm = feetInchesToCm(Number(ftEl.value) || 0, Number(inEl.value) || 0);
    kgEl.value = lbEl.value.trim() !== "" && lb > 0 ? round1(lbToKg(lb)) : "";
    cmEl.value = !noHeight && cm > 0 ? round1(cm) : "";
  }
  metricBox.hidden = units() !== "metric";
  imperialBox.hidden = units() !== "imperial";
  paint();
}

function body(): { kg: number; cm: number } {
  if (units() === "imperial") {
    const ftRaw = ftEl?.value.trim() ?? "";
    const inRaw = inEl?.value.trim() ?? "";
    const cm = ftRaw === "" && inRaw === "" ? NaN : feetInchesToCm(Number(ftRaw) || 0, Number(inRaw) || 0);
    return { kg: lbToKg(Number(lbEl?.value || NaN)), cm };
  }
  return { kg: Number(kgEl?.value || NaN), cm: Number(cmEl?.value || NaN) };
}

function paint(): void {
  if (!outEl || !sexEl || !ageEl || !activityEl) return;
  const { kg, cm } = body();
  const result = tdeeFrom(sexEl.value as Sex, kg, cm, Number(ageEl.value || NaN), activityEl.value as Activity);
  outEl.replaceChildren();
  if (!result) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("tdee.invalid")));
    return;
  }
  const fmt = new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 });
  const kcal = (n: number) => t("tdee.kcalDay", { n: fmt.format(Math.round(n)) });
  const rows: Array<[string, string]> = [
    [t("tdee.bmr"), kcal(result.bmr)],
    [t("tdee.maintain"), kcal(result.tdee)],
    [t("tdee.cut", { n: fmt.format(CUT_KCAL) }), result.cut == null ? "—" : kcal(result.cut)],
    [t("tdee.bulk", { n: fmt.format(BULK_KCAL) }), kcal(result.bulk)],
  ];
  const note = result.cutFloor == null
    ? ""
    : result.cut == null
      ? t("tdee.noCut", { n: fmt.format(Math.round(result.cutFloor)) })
      : t("tdee.cutClamped", { n: fmt.format(Math.round(result.cut)) });
  last = rows.map(([k, v]) => `${k}: ${v}`).join("\n") + (note ? `\n${note}` : "");
  for (const [k, v] of rows) outEl.append(h("dt", null, k), h("dd", null, v));
  if (note) outEl.append(h("p", { class: "hint tdee-floor" }, note));
}

async function copyOut(): Promise<void> {
  await copyWithFlash(copyBtn, last, { done: t("tdee.copied"), failed: t("tdee.copyFailed") });
}
