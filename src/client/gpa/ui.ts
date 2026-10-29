import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { GRADES, MAX_CREDITS, gpaOf, isGrade, type Grade, type GpaRow } from "../../shared/gpa";

type RowEls = { wrap: HTMLElement; grade: HTMLSelectElement; credits: HTMLInputElement };

const DEFAULT_ROWS: GpaRow[] = [
  { grade: "A", credits: 3 },
  { grade: "B+", credits: 3 },
  { grade: "A-", credits: 4 },
  { grade: "B", credits: 3 },
];

let rowsEl: HTMLElement | null = null;
let plusEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let rows: RowEls[] = [];
let last = "";

export function mountGpa(host: HTMLElement): void {
  rowsEl = h("div", { class: "gpa-rows" });
  plusEl = h("input", { type: "checkbox", "data-field": "plus", onChange: () => paint() });
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("gpa.back")),
      h("h1", null, t("gpa.title")),
      h("p", { class: "lede" }, t("gpa.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("gpa.options")),
          h("div", { class: "row gpa-head" }, h("span", null, t("gpa.grade")), h("span", null, t("gpa.credits"))),
          rowsEl,
          h("label", { class: "gpa-check" }, plusEl, h("span", null, t("gpa.plusAbove4"))),
        ),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn ghost", "data-action": "add", onClick: () => { addRow({ grade: "A", credits: 3 }); paint(); } }, t("gpa.add")),
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("gpa.copy")),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("gpa.result")), outEl),
    ),
  );
  for (const row of DEFAULT_ROWS) addRow(row);
  paint();
}

export function unmountGpa(): void {
  rowsEl = null;
  plusEl = null;
  outEl = null;
  copyBtn = null;
  rows = [];
  last = "";
}

function addRow(initial: GpaRow): void {
  if (!rowsEl) return;
  const grade = h("select", { "data-field": "grade", "aria-label": t("gpa.grade"), onChange: () => paint() },
    ...GRADES.map((g) => h("option", { value: g, selected: g === initial.grade }, g)),
  );
  const credits = h("input", {
    type: "number", min: "0", max: String(MAX_CREDITS), step: "0.5", value: String(initial.credits),
    "data-field": "credits", "aria-label": t("gpa.credits"), onInput: () => paint(),
  });
  const row: RowEls = { wrap: h("div", { class: "row gpa-row" }), grade, credits };
  const remove = h("button", { type: "button", class: "chip", "aria-label": t("gpa.remove"), onClick: () => removeRow(row) }, "×");
  row.wrap.append(grade, credits, remove);
  rows.push(row);
  rowsEl.append(row.wrap);
}

function removeRow(row: RowEls): void {
  rows = rows.filter((r) => r !== row);
  row.wrap.remove();
  paint();
}

function readRows(): GpaRow[] {
  return rows.map((row) => ({
    grade: (isGrade(row.grade.value) ? row.grade.value : "F") as Grade,
    credits: row.credits.value.trim() === "" ? NaN : Number(row.credits.value),
  }));
}

function paint(): void {
  if (!outEl) return;
  const out = gpaOf(readRows(), Boolean(plusEl?.checked));
  outEl.replaceChildren();
  if (!out) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("gpa.invalid")));
    return;
  }
  const lines: Array<[string, string]> = [
    [t("gpa.gpa"), out.gpa.toFixed(2)],
    [t("gpa.totalCredits"), trim(out.credits)],
    [t("gpa.points"), trim(out.points)],
    [t("gpa.courses"), String(out.courses)],
  ];
  last = lines.map((row) => `${row[0]}: ${row[1]}`).join("\n");
  for (const [label, value] of lines) outEl.append(h("dt", null, label), h("dd", null, value));
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

async function copyOut(): Promise<void> {
  if (!last) return;
  try {
    await navigator.clipboard.writeText(last);
    if (copyBtn) copyBtn.textContent = t("gpa.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("gpa.copy");
    }, 1200);
  } catch { /* ignore */ }
}
