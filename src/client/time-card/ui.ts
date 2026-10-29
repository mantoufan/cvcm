import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { MAX_MULTIPLIER, MIN_MULTIPLIER, hhmm, timeCard, type ShiftRow } from "../../shared/time-card";

type RowEls = { wrap: HTMLElement; start: HTMLInputElement; end: HTMLInputElement; brk: HTMLInputElement; out: HTMLElement };

const DAYS = 5;
const DEFAULT: ShiftRow = { start: "09:00", end: "17:30", breakMin: 30 };

let rowsEl: HTMLElement | null = null;
let rateEl: HTMLInputElement | null = null;
let otEl: HTMLInputElement | null = null;
let multEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let rows: RowEls[] = [];
let last = "";

export function mountTimeCard(host: HTMLElement): void {
  rowsEl = h("div", { class: "gpa-rows" });
  const num = (field: string, value: string, step = "0.01") =>
    h("input", { type: "number", min: "0", step, inputmode: "decimal", "data-field": field, value, onInput: () => paint() });
  rateEl = num("rate", "");
  rateEl.placeholder = "20";
  otEl = num("overtime", "40", "0.5");
  multEl = num("multiplier", "1.5", "0.1");
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("timeCard.back")),
      h("h1", null, t("timeCard.title")),
      h("p", { class: "lede" }, t("timeCard.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("timeCard.options")),
          h("div", { class: "row gpa-head time-head" },
            h("span", null, t("timeCard.start")), h("span", null, t("timeCard.end")), h("span", null, t("timeCard.break")), h("span", null, t("timeCard.hours")),
          ),
          rowsEl,
        ),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn ghost", "data-action": "add", onClick: () => { addRow({ start: "", end: "", breakMin: 0 }); paint(); } }, t("timeCard.add")),
        ),
        h("fieldset", null,
          h("legend", null, t("timeCard.payOptions")),
          h("label", { class: "field" }, h("span", null, t("timeCard.rate")), rateEl),
          h("label", { class: "field" }, h("span", null, t("timeCard.overtimeAfter")), otEl),
          h("label", { class: "field" }, h("span", null, t("timeCard.multiplier")), multEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("timeCard.copy")),
        ),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("timeCard.result")),
        outEl,
        h("p", { class: "hint" }, t("timeCard.hint")),
      ),
    ),
  );
  for (let i = 0; i < DAYS; i++) addRow(DEFAULT);
  paint();
}

export function unmountTimeCard(): void {
  rowsEl = rateEl = otEl = multEl = null;
  outEl = null;
  copyBtn = null;
  rows = [];
  last = "";
}

function addRow(initial: ShiftRow): void {
  if (!rowsEl) return;
  // Time inputs are emptied in the prerendered HTML, so their per-row results are marked volatile too.
  const start = h("input", { type: "time", value: initial.start, "data-field": "start", onInput: () => paint(), onChange: () => paint() });
  const end = h("input", { type: "time", value: initial.end, "data-field": "end", onInput: () => paint(), onChange: () => paint() });
  const brk = h("input", { type: "number", min: "0", step: "5", inputmode: "numeric", value: String(initial.breakMin), "data-field": "break", onInput: () => paint() });
  const out = h("span", { class: "time-row-out", "data-volatile": "" });
  const row: RowEls = { wrap: h("div", { class: "row gpa-row time-row" }), start, end, brk, out };
  const remove = h("button", { type: "button", class: "chip", "aria-label": t("timeCard.remove"), onClick: () => removeRow(row) }, "×");
  row.wrap.append(start, end, brk, out, remove);
  rows.push(row);
  rowsEl.append(row.wrap);
  labelRows();
}

/** Number the rows' accessible names in order, so removing one never leaves duplicates. */
function labelRows(): void {
  rows.forEach((r, i) => {
    r.start.setAttribute("aria-label", `${t("timeCard.start")} ${i + 1}`);
    r.end.setAttribute("aria-label", `${t("timeCard.end")} ${i + 1}`);
    r.brk.setAttribute("aria-label", `${t("timeCard.break")} ${i + 1}`);
  });
}

function removeRow(row: RowEls): void {
  rows = rows.filter((r) => r !== row);
  row.wrap.remove();
  labelRows();
  paint();
}

function paint(): void {
  if (!outEl) return;
  const read = (el: HTMLInputElement | null) => (el == null || el.value.trim() === "" ? NaN : Number(el.value));
  const input: ShiftRow[] = rows.map((r) => ({ start: r.start.value, end: r.end.value, breakMin: r.brk.value.trim() === "" ? 0 : Number(r.brk.value) }));
  const rate = rateEl?.value.trim() === "" ? null : read(rateEl);
  const mult = read(multEl);
  const out = timeCard(input, rate, read(otEl), mult);
  rows.forEach((r, i) => {
    const s = out.shifts[i];
    const blank = input[i].start.trim() === "" && input[i].end.trim() === "";
    r.out.textContent = blank ? "" : s ? hhmm(s.minutes) + (s.overnight ? " ☾" : "") : "!";
    r.out.classList.toggle("contrast-fail", !blank && !s);
  });
  outEl.replaceChildren();
  const bad = out.shifts.some((s, i) => s == null && !(input[i].start.trim() === "" && input[i].end.trim() === ""));
  const fmt = new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 });
  const money = new Intl.NumberFormat(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rowsOut: Array<[string, string]> = [
    [t("timeCard.total"), `${hhmm(out.totalMin)} (${fmt.format(out.totalMin / 60)} h)`],
    [t("timeCard.regular"), `${hhmm(out.regularMin)} (${fmt.format(out.regularMin / 60)} h)`],
    [t("timeCard.overtime"), `${hhmm(out.overtimeMin)} (${fmt.format(out.overtimeMin / 60)} h)`],
  ];
  if (out.pay != null) rowsOut.push([t("timeCard.pay"), money.format(out.pay)]);
  for (const [k, v] of rowsOut) outEl.append(h("dt", null, k), h("dd", { "data-volatile": "" }, v));
  if (bad) outEl.append(h("p", { class: "hint" }, t("timeCard.invalidRow")));
  if (rate != null && !(mult >= MIN_MULTIPLIER && mult <= MAX_MULTIPLIER)) outEl.append(h("p", { class: "hint" }, t("timeCard.invalidMultiplier")));
  last = rowsOut.map(([k, v]) => `${k}: ${v}`).join("\n");
}

async function copyOut(): Promise<void> {
  await copyWithFlash(copyBtn, last, { done: t("timeCard.copied"), failed: t("timeCard.copyFailed") });
}
