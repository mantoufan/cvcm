import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { formatTime, parseTime, solvePace, type DistanceUnit, type Solve } from "../../shared/pace";

let solveEl: HTMLSelectElement | null = null;
let unitEl: HTMLSelectElement | null = null;
let distanceEl: HTMLInputElement | null = null;
let timeEl: HTMLInputElement | null = null;
let paceEl: HTMLInputElement | null = null;
let distanceBox: HTMLElement | null = null;
let timeBox: HTMLElement | null = null;
let paceBox: HTMLElement | null = null;
let paceLabel: HTMLElement | null = null;
let outEl: HTMLElement | null = null;
let racesEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountPace(host: HTMLElement): void {
  solveEl = h("select", { "data-field": "solve", onChange: () => paint() },
    h("option", { value: "pace", selected: true }, t("pace.solvePace")),
    h("option", { value: "time" }, t("pace.solveTime")),
    h("option", { value: "distance" }, t("pace.solveDistance")),
  );
  solveEl.value = "pace";
  unitEl = h("select", { "data-field": "unit", onChange: () => paint() },
    h("option", { value: "km", selected: true }, t("pace.km")),
    h("option", { value: "mi" }, t("pace.mi")),
  );
  unitEl.value = "km";
  distanceEl = h("input", { type: "number", min: "0", step: "0.01", inputmode: "decimal", value: "10", "data-field": "distance", onInput: () => paint() });
  timeEl = h("input", { type: "text", value: "55:00", placeholder: "h:mm:ss", inputmode: "numeric", "data-field": "time", onInput: () => paint() });
  paceEl = h("input", { type: "text", value: "5:30", placeholder: "m:ss", inputmode: "numeric", "data-field": "pace", onInput: () => paint() });
  paceLabel = h("span", null, t("pace.pacePerKm"));
  distanceBox = h("label", { class: "field" }, h("span", null, t("pace.distance")), distanceEl);
  timeBox = h("label", { class: "field" }, h("span", null, t("pace.time")), timeEl);
  paceBox = h("label", { class: "field" }, paceLabel, paceEl);
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  racesEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("pace.back")),
      h("h1", null, t("pace.title")),
      h("p", { class: "lede" }, t("pace.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("pace.options")),
          h("label", { class: "field" }, h("span", null, t("pace.solve")), solveEl),
          h("label", { class: "field" }, h("span", null, t("pace.unit")), unitEl),
          distanceBox,
          timeBox,
          paceBox,
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("pace.copy")),
        ),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("pace.result")),
        outEl,
        h("h2", null, t("pace.races")),
        racesEl,
        h("p", { class: "hint" }, t("pace.hint")),
      ),
    ),
  );
  paint();
}

export function unmountPace(): void {
  solveEl = unitEl = null;
  distanceEl = timeEl = paceEl = null;
  distanceBox = timeBox = paceBox = paceLabel = outEl = racesEl = null;
  copyBtn = null;
  last = "";
}

function paint(): void {
  if (!outEl || !racesEl || !solveEl || !unitEl || !distanceBox || !timeBox || !paceBox || !paceLabel) return;
  const solve = solveEl.value as Solve;
  const unit = unitEl.value as DistanceUnit;
  distanceBox.hidden = solve === "distance";
  timeBox.hidden = solve === "time";
  paceBox.hidden = solve === "pace";
  paceLabel.textContent = unit === "km" ? t("pace.pacePerKm") : t("pace.pacePerMi");
  const out = solvePace({
    solve,
    unit,
    distance: distanceEl?.value.trim() === "" ? NaN : Number(distanceEl?.value),
    timeSec: parseTime(timeEl?.value ?? "") ?? NaN,
    paceSec: parseTime(paceEl?.value ?? "") ?? NaN,
  });
  outEl.replaceChildren();
  racesEl.replaceChildren();
  if (!out) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("pace.invalid")));
    return;
  }
  const fmt = new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 });
  const unitName = unit === "km" ? t("pace.km") : t("pace.mi");
  const otherName = unit === "km" ? t("pace.mi") : t("pace.km");
  const rows: Array<[string, string]> = [
    [t("pace.distance"), `${fmt.format(out.distance)} ${unitName}`],
    [t("pace.time"), formatTime(out.timeSec)],
    [t("pace.pacePer", { unit: unitName }), formatTime(out.paceSec)],
    [t("pace.pacePer", { unit: otherName }), formatTime(out.paceOtherSec)],
    [t("pace.speed"), `${fmt.format(out.speed)} ${unitName}/h`],
  ];
  for (const [k, v] of rows) outEl.append(h("dt", null, k), h("dd", null, v));
  const races = out.races.map((r) => [t(`pace.race_${r.id}`), formatTime(r.timeSec)] as [string, string]);
  for (const [k, v] of races) racesEl.append(h("dt", null, k), h("dd", null, v));
  last = [...rows, ...races].map(([k, v]) => `${k}: ${v}`).join("\n");
}

async function copyOut(): Promise<void> {
  await copyWithFlash(copyBtn, last, { done: t("pace.copied"), failed: t("pace.copyFailed") });
}
