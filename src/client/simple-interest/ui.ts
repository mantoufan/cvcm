import { h } from "../dom";
import { locale, t } from "../i18n";
import { numberFormat, plain } from "../../shared/number-format";
import { copyWithFlash } from "../copy";
import {
  FINDS, TIME_UNITS, fromYears, schedule, solve, toYears, type Basis, type Find, type TimeUnit,
} from "../../shared/simple-interest";

export function mountSimpleInterest(host: HTMLElement): void {
  let find: Find = "interest";
  let last = "";
  const money = (n: number) => plain(locale(), n, 2);
  const num = (n: number, max = 4) => numberFormat(locale(), { maximumFractionDigits: max }).format(n);

  const input = (field: string, value: string, step = "any") =>
    h("input", { type: "number", min: "0", step, inputmode: "decimal", value, "data-field": field, onInput: () => paint() });
  const principalEl = input("principal", "10000");
  const rateEl = input("rate", "5");
  /** The exact term behind a converted, rounded field, so switching units back and forth does not drift. */
  let exactYears: number | null = null;
  // Typing a time drops the exact term before the repaint reads it.
  const timeEl = h("input", { type: "number", min: "0", step: "any", inputmode: "decimal", value: "3", "data-field": "time", onInput: () => { exactYears = null; paint(); } });
  const interestEl = input("interest", "1500");
  let unitWas: TimeUnit = "years";
  // A new unit converts the typed time (3 years → 36 months), as other tools keep the quantity on a unit switch.
  const unitSel = h("select", { "data-field": "unit", "aria-label": t("simpleInterest.timeUnit"), onChange: () => {
    const unit = unitSel.value as TimeUnit;
    const basis = Number(basisSel.value) as Basis;
    const n = Number(timeEl.value);
    if (timeEl.value.trim() !== "" && Number.isFinite(n)) {
      exactYears ??= toYears(n, unitWas, basis);
      timeEl.value = String(Math.round(fromYears(exactYears, unit, basis) * 1e4) / 1e4);
    }
    unitWas = unit;
    syncBasis();
    paint();
  } },
    ...TIME_UNITS.map((u) => h("option", { value: u }, t(`simpleInterest.u_${u}`))));
  // A term converted from years or months keeps its length on a new basis (its day count is redrawn); days that
  // were typed stay those days, read on the new basis.
  const basisSel = h("select", { "data-field": "basis", onChange: () => {
    if (exactYears !== null && unitSel.value === "days") timeEl.value = String(Math.round(fromYears(exactYears, "days", Number(basisSel.value) as Basis) * 1e4) / 1e4);
    paint();
  } },
    h("option", { value: "365" }, t("simpleInterest.basis365")),
    h("option", { value: "360" }, t("simpleInterest.basis360")));
  const findSel = h("select", { "data-field": "find", onChange: () => { find = findSel.value as Find; sync(); paint(); } },
    ...FINDS.map((f) => h("option", { value: f }, t(`simpleInterest.f_${f}`))));

  const field = (label: string, ...control: HTMLElement[]) => h("label", { class: "field" }, h("span", null, label), ...control);
  const principalField = field(t("simpleInterest.principal"), principalEl);
  const rateField = field(t("simpleInterest.rate"), rateEl);
  const timeField = field(t("simpleInterest.time"), h("span", { class: "si-pair" }, timeEl, unitSel));
  const interestField = field(t("simpleInterest.interest"), interestEl);
  const basisField = field(t("simpleInterest.basis"), basisSel);

  const outEl = h("dl", { class: "stats-grid", "data-out": "result" });
  const formulaEl = h("p", { class: "si-formula", "data-out": "formula" });
  const tableWrap = h("div", { class: "table-wrap", "data-out": "table" });
  const copyBtn = h("button", { type: "button", class: "btn", "data-action": "copy", onClick: () => void copy() }, t("simpleInterest.copy"));

  const syncBasis = () => { basisField.hidden = unitSel.value !== "days"; };
  const sync = () => {
    principalField.hidden = find === "principal";
    rateField.hidden = find === "rate";
    interestField.hidden = find === "interest";
    // Finding the time keeps the unit menu: the answer is given in that unit.
    timeEl.hidden = find === "time";
    syncBasis();
  };

  const paint = () => {
    const unit = unitSel.value as TimeUnit;
    const basis = Number(basisSel.value) as Basis;
    const read = (el: HTMLInputElement) => (el.value.trim() === "" ? undefined : Number(el.value));
    const time = read(timeEl);
    const s = solve(find, {
      principal: read(principalEl),
      rate: read(rateEl),
      years: time === undefined ? undefined : exactYears ?? toYears(time, unit, basis),
      interest: read(interestEl),
    });
    outEl.replaceChildren();
    tableWrap.replaceChildren();
    if (!s) {
      last = "";
      copyBtn.disabled = true;
      formulaEl.textContent = t("simpleInterest.invalid");
      return;
    }
    const timeText = `${num(fromYears(s.years, unit, basis))} ${t(`simpleInterest.u_${unit}`)}`;
    const rows: [string, string, boolean][] = [
      [t("simpleInterest.interest"), money(s.interest), find === "interest"],
      [t("simpleInterest.total"), money(s.total), find === "interest"],
      [t("simpleInterest.principal"), money(s.principal), find === "principal"],
      [t("simpleInterest.rate"), `${num(s.rate)} %`, find === "rate"],
      [t("simpleInterest.time"), timeText, find === "time"],
    ];
    for (const [k, v, key] of rows) outEl.append(h("dt", null, k), h("dd", key ? { class: "si-key" } : null, v));
    const lines = rows.map(([k, v]) => `${k}: ${v}`);
    if (s.years > 0) {
      const monthly = money(s.interest / (s.years * 12));
      outEl.append(h("dt", null, t("simpleInterest.perMonth")), h("dd", null, monthly));
      lines.push(`${t("simpleInterest.perMonth")}: ${monthly}`);
    }
    formulaEl.textContent = t("simpleInterest.formula", {
      i: money(s.interest), p: money(s.principal), r: num(s.rate / 100, 6), t: num(s.years, 4),
    });
    // Copy what the panel shows: the rows, the monthly figure and the filled-in formula.
    last = [...lines, formulaEl.textContent].join("\n");
    copyBtn.disabled = false;
    const sched = schedule(s);
    if (sched.length) {
      tableWrap.append(h("table", { class: "si-table" },
        h("thead", null, h("tr", null,
          h("th", null, t("simpleInterest.time")),
          h("th", null, t("simpleInterest.interestTo")),
          h("th", null, t("simpleInterest.balance")),
          h("th", null, t("simpleInterest.compound")))),
        h("tbody", null, ...sched.map((r) => h("tr", null,
          h("td", null, `${num(fromYears(r.year, unit, basis), 2)} ${t(`simpleInterest.u_${unit}`)}`),
          h("td", null, money(r.interest)),
          h("td", null, money(r.balance)),
          h("td", null, r.compound === null ? "—" : money(r.compound)))))));
    }
  };

  const copy = () => copyWithFlash(copyBtn, last, { done: t("simpleInterest.copied"), failed: t("simpleInterest.copyFailed") });

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("simpleInterest.title")),
      h("p", { class: "lede" }, t("simpleInterest.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("simpleInterest.options")),
          field(t("simpleInterest.find"), findSel),
          principalField,
          rateField,
          timeField,
          basisField,
          interestField,
        ),
        h("div", { class: "stage-actions" }, copyBtn),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("simpleInterest.result")),
        outEl,
        formulaEl,
        h("h3", null, t("simpleInterest.tableTitle")),
        tableWrap,
      ),
    ),
  );
  sync();
  paint();
}

/** Nothing to tear down: no timers or page-wide listeners. */
export function unmountSimpleInterest(): void {}
