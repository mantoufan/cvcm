import { h } from "../dom";
import { locale, t } from "../i18n";
import { numberFormat, plain } from "../../shared/number-format";
import { LB_PER_KG, lbToKg } from "../../shared/tdee";
import {
  DRINKS, LEVELS, ML_PER_US_FL_OZ, US_STANDARD_DRINK_G, WIDMARK_R, alcoholGrams, bacAfter, bacUnits, band,
  hoursUntil, peakBac, type DrinkId, type Sex,
} from "../../shared/bac";

type VolUnit = "ml" | "oz";
/** `ml` is the exact size behind a rounded field (a preset, or a unit switch); null once the size is typed. */
type Row = { count: HTMLInputElement; size: HTMLInputElement; abv: HTMLInputElement; el: HTMLElement; ml: number | null };

export function mountBac(host: HTMLElement): void {
  // Pounds and US fluid ounces on the English page (its biggest audience is American), metric elsewhere. Keyed on
  // the locale only, like the height calculator, so the prerendered page and the client mount agree (rule 8).
  const imperial = locale() === "en";
  let vol: VolUnit = imperial ? "oz" : "ml";
  const rows: Row[] = [];
  const fmt = (n: number, max: number) => numberFormat(locale(), { maximumFractionDigits: max }).format(n);
  const toUnit = (ml: number) => (vol === "oz" ? ml / ML_PER_US_FL_OZ : ml);
  const toMl = (n: number) => (vol === "oz" ? n * ML_PER_US_FL_OZ : n);
  const round1 = (n: number) => Math.round(n * 10) / 10;

  const sexSel = h("select", { "data-field": "sex", onChange: () => paint() },
    ...(Object.keys(WIDMARK_R) as Sex[]).map((s) => h("option", { value: s }, t(`bac.sex_${s}`))));
  /** The exact weight behind a converted, rounded field, so switching units back and forth does not drift. */
  let exactKg: number | null = null;
  const weightEl = h("input", { type: "number", min: "1", step: "any", inputmode: "decimal", value: imperial ? "160" : "70", "data-field": "weight", onInput: () => { exactKg = null; paint(); } });
  let weightWas = imperial ? "lb" : "kg";
  const weightUnit = h("select", { "data-field": "weight-unit", onChange: () => {
    // Keep the same body weight in the other unit.
    const n = Number(weightEl.value);
    if (n > 0) {
      exactKg ??= weightWas === "lb" ? lbToKg(n) : n;
      weightEl.value = String(round1(weightUnit.value === "kg" ? exactKg : exactKg * LB_PER_KG));
    }
    weightWas = weightUnit.value;
    paint();
  } },
    h("option", { value: "kg", selected: !imperial }, "kg"),
    h("option", { value: "lb", selected: imperial }, "lb"));
  const hoursEl = h("input", { type: "number", min: "0", step: "0.25", inputmode: "decimal", value: "1", "data-field": "hours", onInput: () => paint() });
  const volSel = h("select", { "data-field": "vol-unit", onChange: () => {
    for (const r of rows) {
      const n = Number(r.size.value);
      if (n > 0) r.ml ??= toMl(n); // vol is still the old unit here
    }
    vol = volSel.value as VolUnit;
    for (const r of rows) if (r.ml !== null) r.size.value = String(round1(toUnit(r.ml)));
    paint();
  } },
    h("option", { value: "ml", selected: vol === "ml" }, "mL"),
    h("option", { value: "oz", selected: vol === "oz" }, t("bac.flOz")));
  const listEl = h("div", { class: "bac-drinks", "data-out": "drinks" });
  const outEl = h("dl", { class: "stats-grid", "data-out": "result" });
  const levelEl = h("p", { class: "bac-band", "aria-live": "polite", "data-out": "band" });
  const timesEl = h("ul", { class: "bac-times", "data-out": "times" });

  const addRow = (kind: DrinkId | "custom", count = 1) => {
    const preset = DRINKS.find((d) => d.id === kind) ?? DRINKS[0];
    const kindSel = h("select", { "aria-label": t("bac.drink"), "data-field": "kind" },
      ...DRINKS.map((d) => h("option", { value: d.id, selected: d.id === kind }, t(`bac.d_${d.id}`))),
      h("option", { value: "custom", selected: kind === "custom" }, t("bac.d_custom")));
    const countEl = h("input", { type: "number", min: "0", step: "1", inputmode: "numeric", value: String(count), "aria-label": t("bac.count"), "data-field": "count", onInput: () => paint() });
    const sizeEl = h("input", { type: "number", min: "0", step: "any", inputmode: "decimal", value: String(round1(toUnit(preset.ml))), "aria-label": t("bac.size"), "data-field": "size", onInput: () => { row.ml = null; kindSel.value = "custom"; paint(); } });
    const abvEl = h("input", { type: "number", min: "0", max: "100", step: "0.1", inputmode: "decimal", value: String(preset.abv), "aria-label": t("bac.abv"), "data-field": "abv", onInput: () => { kindSel.value = "custom"; paint(); } });
    kindSel.addEventListener("change", () => {
      const d = DRINKS.find((x) => x.id === kindSel.value);
      if (d) {
        row.ml = d.ml;
        sizeEl.value = String(round1(toUnit(d.ml)));
        abvEl.value = String(d.abv);
      }
      paint();
    });
    const el = h("div", { class: "bac-row" },
      kindSel,
      h("label", { class: "bac-mini" }, h("span", null, "×"), countEl),
      h("label", { class: "bac-mini" }, sizeEl, h("span", { class: "bac-unit" }, vol === "oz" ? "oz" : "mL")),
      h("label", { class: "bac-mini" }, abvEl, h("span", null, "%")),
      h("button", { type: "button", class: "btn ghost bac-remove", "aria-label": t("bac.remove"), "data-action": "remove", onClick: () => {
        const i = rows.indexOf(row);
        if (i >= 0) rows.splice(i, 1);
        el.remove();
        paint();
      } }, "×"),
    );
    const row: Row = { count: countEl, size: sizeEl, abv: abvEl, el, ml: preset.ml };
    rows.push(row);
    listEl.append(el);
  };

  const duration = (hours: number) => {
    const mins = Math.ceil(hours * 60);
    return t("bac.hm", { h: Math.floor(mins / 60), m: mins % 60 });
  };

  const paint = () => {
    for (const u of listEl.querySelectorAll<HTMLElement>(".bac-unit")) u.textContent = vol === "oz" ? "oz" : "mL";
    const w = Number(weightEl.value);
    const kg = exactKg ?? (weightUnit.value === "lb" ? lbToKg(w) : w);
    // An empty field is missing input, not 0 hours (which would show the highest estimate).
    const hours = hoursEl.value.trim() === "" ? NaN : Number(hoursEl.value);
    const grams = alcoholGrams(rows.map((r) => ({ ml: r.ml ?? toMl(Number(r.size.value)), abv: Number(r.abv.value), count: Number(r.count.value) })));
    outEl.replaceChildren();
    timesEl.replaceChildren();
    // The bounds in the unit shown: 20–400 kg, or 44–880 lb (44 lb is 19.96 kg).
    const inLb = weightUnit.value === "lb";
    const shown = inLb ? kg * LB_PER_KG : kg;
    if (!(inLb ? shown >= 43.995 && shown <= 880.005 : kg >= 20 && kg <= 400) || !(hours >= 0) || !Number.isFinite(grams)) {
      levelEl.className = "bac-band";
      levelEl.textContent = t("bac.invalid");
      return;
    }
    // Rounded to the 3 decimals shown, so the band and the countdowns agree with the figure (0.000 % is "about zero").
    const now = Math.round(bacAfter(peakBac(grams, kg, sexSel.value as Sex), hours) * 1000) / 1000;
    const u = bacUnits(now);
    const rowsOut: [string, string][] = [
      [t("bac.bac"), `${plain(locale(), u.pct, 3)} %`],
      [t("bac.permille"), `${plain(locale(), u.permille, 2)} ‰`],
      [t("bac.mg100"), `${fmt(u.mg100, 0)} mg/100 mL`],
      [t("bac.grams"), `${fmt(grams, 1)} g`],
      [t("bac.standard"), fmt(grams / US_STANDARD_DRINK_G, 1)],
    ];
    for (const [k, v] of rowsOut) outEl.append(h("dt", null, k), h("dd", null, v));
    const b = band(now);
    levelEl.className = `bac-band ${b}`;
    levelEl.textContent = t(`bac.b_${b}`);
    for (const level of LEVELS) {
      const left = hoursUntil(now, level);
      const label = level === 0 ? t("bac.toZero") : t("bac.toLevel", { level: plain(locale(), level, 2) });
      timesEl.append(h("li", null, `${label}: `, h("strong", null, left > 0 ? duration(left) : t("bac.already"))));
    }
  };

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("bac.title")),
      h("p", { class: "lede" }, t("bac.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("bac.you")),
          h("label", { class: "field" }, h("span", null, t("bac.sex")), sexSel),
          h("label", { class: "field" }, h("span", null, t("bac.weight")), h("span", { class: "bac-pair" }, weightEl, weightUnit)),
          h("label", { class: "field" }, h("span", null, t("bac.hours")), hoursEl),
        ),
        h("fieldset", null,
          h("legend", null, t("bac.drinks")),
          h("label", { class: "field" }, h("span", null, t("bac.volUnit")), volSel),
          listEl,
          h("button", { type: "button", class: "btn ghost", "data-action": "add", onClick: () => { addRow("beer"); paint(); } }, t("bac.add")),
        ),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("bac.result")),
        levelEl,
        outEl,
        h("h3", { class: "bac-times-title" }, t("bac.timesTitle")),
        timesEl,
        h("p", { class: "bac-warn" }, t("bac.warning")),
      ),
    ),
  );
  addRow("beer", 2);
  paint();
}

/** Nothing to tear down: no timers or page-wide listeners. */
export function unmountBac(): void {}
