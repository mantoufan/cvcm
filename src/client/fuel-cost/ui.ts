import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { KM_PER_MI, L_PER_US_GAL, fuelCost, toL100km, type EconomyUnit } from "../../shared/fuel-cost";

let distanceEl: HTMLInputElement | null = null;
let distanceUnitEl: HTMLSelectElement | null = null;
let economyEl: HTMLInputElement | null = null;
let economyUnitEl: HTMLSelectElement | null = null;
let priceEl: HTMLInputElement | null = null;
let priceUnitEl: HTMLSelectElement | null = null;
let roundTripEl: HTMLInputElement | null = null;
let peopleEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";
let prevDistanceUnit = "km";
let prevEconomyUnit: EconomyUnit = "l100km";
let prevPriceUnit = "l";

export function mountFuelCost(host: HTMLElement): void {
  const num = (field: string, value: string, step = "0.1") =>
    h("input", { type: "number", min: "0", step, inputmode: "decimal", "data-field": field, value, onInput: () => paint() });
  distanceEl = num("distance", "300");
  distanceUnitEl = h("select", { "data-field": "distanceUnit", "aria-label": t("fuelCost.distanceUnit"), onChange: () => convertDistance() },
    h("option", { value: "km", selected: true }, "km"),
    h("option", { value: "mi" }, "mi"),
  );
  distanceUnitEl.value = "km";
  economyEl = num("economy", "7");
  economyUnitEl = h("select", { "data-field": "economyUnit", "aria-label": t("fuelCost.economyUnit"), onChange: () => convertEconomy() },
    h("option", { value: "l100km", selected: true }, t("fuelCost.l100km")),
    h("option", { value: "kml" }, t("fuelCost.kml")),
    h("option", { value: "mpg" }, t("fuelCost.mpg")),
  );
  economyUnitEl.value = "l100km";
  priceEl = num("price", "1.60", "0.01");
  priceUnitEl = h("select", { "data-field": "priceUnit", "aria-label": t("fuelCost.priceUnit"), onChange: () => convertPrice() },
    h("option", { value: "l", selected: true }, t("fuelCost.perLitre")),
    h("option", { value: "gal" }, t("fuelCost.perGallon")),
  );
  priceUnitEl.value = "l";
  prevDistanceUnit = "km";
  prevEconomyUnit = "l100km";
  prevPriceUnit = "l";
  roundTripEl = h("input", { type: "checkbox", "data-field": "roundTrip", onChange: () => paint() });
  peopleEl = num("people", "1", "1");
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("fuelCost.back")),
      h("h1", null, t("fuelCost.title")),
      h("p", { class: "lede" }, t("fuelCost.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("fuelCost.options")),
          h("div", { class: "field" }, h("span", null, t("fuelCost.distance")), h("div", { class: "row fuel-row" }, distanceEl, distanceUnitEl)),
          h("div", { class: "field" }, h("span", null, t("fuelCost.economy")), h("div", { class: "row fuel-row" }, economyEl, economyUnitEl)),
          h("div", { class: "field" }, h("span", null, t("fuelCost.price")), h("div", { class: "row fuel-row" }, priceEl, priceUnitEl)),
          h("label", { class: "gpa-check" }, roundTripEl, h("span", null, t("fuelCost.roundTrip"))),
          h("label", { class: "field" }, h("span", null, t("fuelCost.people")), peopleEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("fuelCost.copy")),
        ),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("fuelCost.result")),
        outEl,
        h("p", { class: "hint" }, t("fuelCost.hint")),
      ),
    ),
  );
  paint();
}

export function unmountFuelCost(): void {
  distanceEl = economyEl = priceEl = roundTripEl = peopleEl = null;
  distanceUnitEl = economyUnitEl = priceUnitEl = null;
  outEl = null;
  copyBtn = null;
  last = "";
}

const round = (n: number, dp: number) => String(Math.round(n * 10 ** dp) / 10 ** dp);

/** Unit switches convert the typed number so the trip stays the same. */
function convertDistance(): void {
  if (!distanceEl || !distanceUnitEl) return;
  const n = Number(distanceEl.value);
  const next = distanceUnitEl.value;
  if (distanceEl.value.trim() !== "" && n > 0 && next !== prevDistanceUnit) {
    distanceEl.value = round(next === "mi" ? n / KM_PER_MI : n * KM_PER_MI, 1);
  }
  prevDistanceUnit = next;
  paint();
}

function convertEconomy(): void {
  if (!economyEl || !economyUnitEl) return;
  const n = Number(economyEl.value);
  const next = economyUnitEl.value as EconomyUnit;
  if (economyEl.value.trim() !== "" && n > 0 && next !== prevEconomyUnit) {
    const l100 = toL100km(n, prevEconomyUnit);
    // toL100km is its own inverse for km/L and mpg: both are distance per volume.
    economyEl.value = round(next === "l100km" ? l100 : toL100km(l100, next), 1);
  }
  prevEconomyUnit = next;
  paint();
}

function convertPrice(): void {
  if (!priceEl || !priceUnitEl) return;
  const n = Number(priceEl.value);
  const next = priceUnitEl.value;
  if (priceEl.value.trim() !== "" && n >= 0 && next !== prevPriceUnit) {
    priceEl.value = round(next === "gal" ? n * L_PER_US_GAL : n / L_PER_US_GAL, 2);
  }
  prevPriceUnit = next;
  paint();
}

function paint(): void {
  if (!outEl || !distanceUnitEl || !economyUnitEl || !priceUnitEl) return;
  const read = (el: HTMLInputElement | null) => (el?.value.trim() === "" ? NaN : Number(el?.value));
  const distanceUnit = distanceUnitEl.value === "mi" ? "mi" : "km";
  const out = fuelCost({
    distance: read(distanceEl),
    distanceUnit,
    economy: read(economyEl),
    economyUnit: economyUnitEl.value as EconomyUnit,
    price: read(priceEl),
    pricePerGallon: priceUnitEl.value === "gal",
    roundTrip: Boolean(roundTripEl?.checked),
    people: peopleEl?.value.trim() === "" ? undefined : read(peopleEl),
  });
  outEl.replaceChildren();
  if (!out) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("fuelCost.invalid")));
    return;
  }
  const money = new Intl.NumberFormat(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 });
  const usVolume = economyUnitEl.value === "mpg" || priceUnitEl.value === "gal";
  const rows: Array<[string, string]> = [
    [t("fuelCost.cost"), money.format(out.cost)],
    [t("fuelCost.fuel"), usVolume ? t("fuelCost.gallonsUsed", { n: num.format(out.litres / L_PER_US_GAL) }) : t("fuelCost.litresUsed", { n: num.format(out.litres) })],
    [t("fuelCost.perPerson"), money.format(out.perPerson)],
    distanceUnit === "mi"
      ? [t("fuelCost.per100mi"), money.format(out.costPer100km * KM_PER_MI)]
      : [t("fuelCost.per100km"), money.format(out.costPer100km)],
    [t("fuelCost.totalDistance"), `${num.format(distanceUnit === "mi" ? out.km / KM_PER_MI : out.km)} ${distanceUnit}`],
  ];
  for (const [k, v] of rows) outEl.append(h("dt", null, k), h("dd", null, v));
  last = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
}

async function copyOut(): Promise<void> {
  await copyWithFlash(copyBtn, last, { done: t("fuelCost.copied"), failed: t("fuelCost.copyFailed") });
}
