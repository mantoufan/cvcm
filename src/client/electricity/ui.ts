import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { APPLIANCES, electricityCost } from "../../shared/electricity";

let presetEl: HTMLSelectElement | null = null;
let wattsEl: HTMLInputElement | null = null;
let hoursEl: HTMLInputElement | null = null;
let daysEl: HTMLInputElement | null = null;
let qtyEl: HTMLInputElement | null = null;
let priceEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountElectricity(host: HTMLElement): void {
  const num = (field: string, value: string, step = "any") =>
    h("input", { type: "number", min: "0", step, inputmode: "decimal", "data-field": field, value, onInput: () => { if (field === "watts") syncPreset(); paint(); } });
  presetEl = h("select", { "data-field": "preset", onChange: () => applyPreset() },
    h("option", { value: "custom" }, t("electricity.custom")),
    ...APPLIANCES.map((a) => h("option", { value: a.id, selected: a.id === "aircon" }, t("electricity.app_" + a.id, { w: a.watts }))),
  );
  wattsEl = num("watts", "1000");
  hoursEl = num("hours", "8");
  daysEl = num("days", "30", "1");
  qtyEl = num("quantity", "1", "1");
  priceEl = num("price", "0.15");
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("electricity.back")),
      h("h1", null, t("electricity.title")),
      h("p", { class: "lede" }, t("electricity.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("electricity.options")),
          h("label", { class: "field" }, h("span", null, t("electricity.preset")), presetEl),
          h("label", { class: "field" }, h("span", null, t("electricity.watts")), wattsEl),
          h("label", { class: "field" }, h("span", null, t("electricity.hours")), hoursEl),
          h("label", { class: "field" }, h("span", null, t("electricity.days")), daysEl),
          h("label", { class: "field" }, h("span", null, t("electricity.quantity")), qtyEl),
          h("label", { class: "field" }, h("span", null, t("electricity.price")), priceEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("electricity.copy")),
        ),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("electricity.result")),
        outEl,
        h("p", { class: "hint" }, t("electricity.hint")),
      ),
    ),
  );
  paint();
}

export function unmountElectricity(): void {
  presetEl = null;
  wattsEl = hoursEl = daysEl = qtyEl = priceEl = null;
  outEl = null;
  copyBtn = null;
  last = "";
}

/** Typed watts select the matching appliance, or Custom when none matches. */
function syncPreset(): void {
  if (!presetEl || !wattsEl) return;
  const w = Number(wattsEl.value);
  presetEl.value = APPLIANCES.find((a) => a.watts === w)?.id ?? "custom";
}

function applyPreset(): void {
  const a = APPLIANCES.find((x) => x.id === presetEl?.value);
  if (a && wattsEl) wattsEl.value = String(a.watts);
  paint();
}

function paint(): void {
  if (!outEl) return;
  const read = (el: HTMLInputElement | null) => (el == null || el.value.trim() === "" ? NaN : Number(el.value));
  // A blank "How many" means one appliance.
  const qty = qtyEl?.value.trim() === "" ? 1 : read(qtyEl);
  const out = electricityCost({ watts: read(wattsEl), hoursPerDay: read(hoursEl), days: read(daysEl), pricePerKwh: read(priceEl), quantity: qty });
  outEl.replaceChildren();
  if (!out) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("electricity.invalid")));
    return;
  }
  const price = read(priceEl);
  // Whole-number prices of 10 or more (yen, won, dong) give whole-number totals; 11.50 pesos keeps cents.
  const dp = Number.isInteger(price) && price >= 10 ? 0 : 2;
  const money = new Intl.NumberFormat(locale(), { minimumFractionDigits: dp, maximumFractionDigits: dp });
  // Small daily amounts get two more decimals than the totals (2.48 yen, 0.0015 dollars), so they never read as 0.
  const daily = new Intl.NumberFormat(locale(), { minimumFractionDigits: dp, maximumFractionDigits: dp + 2 });
  const num = new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 });
  const rows: Array<[string, string]> = [
    [t("electricity.cost"), money.format(out.cost)],
    [t("electricity.energy"), `${num.format(out.kwh)} kWh`],
    [t("electricity.perDay"), `${daily.format(out.costPerDay)} · ${num.format(out.kwhPerDay)} kWh`],
    [t("electricity.perYear"), money.format(out.costPerYear)],
  ];
  for (const [k, v] of rows) outEl.append(h("dt", null, k), h("dd", null, v));
  last = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
}

async function copyOut(): Promise<void> {
  await copyWithFlash(copyBtn, last, { done: t("electricity.copied"), failed: t("electricity.copyFailed") });
}
