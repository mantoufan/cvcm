import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { SPLITS, macros, type Goal, type MacroSplit } from "../../shared/macro";

let kcalEl: HTMLInputElement | null = null;
let goalEl: HTMLSelectElement | null = null;
let splitEl: HTMLSelectElement | null = null;
let kgEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountMacro(host: HTMLElement): void {
  kcalEl = h("input", { type: "number", min: "0", step: "10", inputmode: "numeric", value: "2500", "data-field": "kcal", onInput: () => paint() });
  goalEl = h("select", { "data-field": "goal", onChange: () => paint() },
    h("option", { value: "lose" }, t("macro.goal_lose")),
    h("option", { value: "maintain", selected: true }, t("macro.goal_maintain")),
    h("option", { value: "gain" }, t("macro.goal_gain")),
  );
  splitEl = h("select", { "data-field": "split", onChange: () => paint() },
    ...(Object.keys(SPLITS) as MacroSplit[]).map((s) => {
      const p = SPLITS[s];
      return h("option", { value: s, selected: s === "balanced" }, t(`macro.split_${s}`, { p: Math.round(p.protein * 100), f: Math.round(p.fat * 100), c: Math.round(p.carbs * 100) }));
    }),
  );
  kgEl = h("input", { type: "number", min: "0", step: "0.1", inputmode: "decimal", value: "70", "data-field": "kg", onInput: () => paint() });
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("macro.back")),
      h("h1", null, t("macro.title")),
      h("p", { class: "lede" }, t("macro.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("macro.options")),
          h("label", { class: "field" }, h("span", null, t("macro.kcal")), kcalEl),
          h("p", { class: "hint" }, t("macro.tdeeHint"), " ", h("a", { href: appHref(locale(), "tdee"), "data-nav": "tdee" }, t("macro.tdeeLink"))),
          h("label", { class: "field" }, h("span", null, t("macro.goal")), goalEl),
          h("label", { class: "field" }, h("span", null, t("macro.split")), splitEl),
          h("label", { class: "field" }, h("span", null, t("macro.kg")), kgEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("macro.copy")),
        ),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("macro.result")),
        outEl,
        h("p", { class: "hint" }, t("macro.formula")),
        h("p", { class: "hint" }, t("macro.disclaimer")),
      ),
    ),
  );
  paint();
}

export function unmountMacro(): void {
  kcalEl = kgEl = null;
  goalEl = splitEl = null;
  outEl = null;
  copyBtn = null;
  last = "";
}

function paint(): void {
  if (!outEl || !goalEl || !splitEl) return;
  const read = (el: HTMLInputElement | null) => (el == null || el.value.trim() === "" ? NaN : Number(el.value));
  const kg = read(kgEl);
  const out = macros(read(kcalEl), goalEl.value as Goal, splitEl.value as MacroSplit, Number.isFinite(kg) ? kg : undefined);
  outEl.replaceChildren();
  if (!out) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("macro.invalid")));
    return;
  }
  const g = new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 });
  const one = new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 });
  const rows: Array<[string, string]> = [
    [t("macro.target"), t("macro.kcalDay", { n: g.format(out.kcal) })],
    [t("macro.protein"), t("macro.grams", { n: g.format(out.protein) })],
    [t("macro.fat"), t("macro.grams", { n: g.format(out.fat) })],
    [t("macro.carbs"), t("macro.grams", { n: g.format(out.carbs) })],
  ];
  if (out.proteinPerKg != null) rows.push([t("macro.proteinPerKg"), `${one.format(out.proteinPerKg)} g/kg`]);
  for (const [k, v] of rows) outEl.append(h("dt", null, k), h("dd", null, v));
  last = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
}

async function copyOut(): Promise<void> {
  await copyWithFlash(copyBtn, last, { done: t("macro.copied"), failed: t("macro.copyFailed") });
}
