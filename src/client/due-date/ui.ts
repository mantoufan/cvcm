import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { todayIso } from "../../shared/age";
import { DEFAULT_CYCLE, MAX_CYCLE, MIN_CYCLE, dueDate, isoOf, type DueDateMode } from "../../shared/due-date";

let modeEl: HTMLSelectElement | null = null;
let dateEl: HTMLInputElement | null = null;
let dateLabel: HTMLElement | null = null;
let cycleEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountDueDate(host: HTMLElement): void {
  modeEl = h("select", { "data-field": "mode", onChange: () => paint() },
    h("option", { value: "lmp", selected: true }, t("dueDate.modeLmp")),
    h("option", { value: "conception" }, t("dueDate.modeConception")),
    h("option", { value: "due" }, t("dueDate.modeDue")),
  );
  modeEl.value = "lmp";
  // Sample: a period that started 10 weeks ago, so the page shows a mid-first-trimester example.
  const sample = new Date(Date.now() - 70 * 86400000);
  dateEl = h("input", { type: "date", value: todayIso(sample), "data-field": "date", onInput: () => paint(), onChange: () => paint() });
  dateLabel = h("span", null, t("dueDate.lmp"));
  cycleEl = h("input", { type: "number", min: String(MIN_CYCLE), max: String(MAX_CYCLE), step: "1", value: String(DEFAULT_CYCLE), "data-field": "cycle", onInput: () => paint() });
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("dueDate.back")),
      h("h1", null, t("dueDate.title")),
      h("p", { class: "lede" }, t("dueDate.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("dueDate.options")),
          h("label", { class: "field" }, h("span", null, t("dueDate.mode")), modeEl),
          h("label", { class: "field" }, dateLabel, dateEl),
          h("label", { class: "field" }, h("span", null, t("dueDate.cycle")), cycleEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("dueDate.copy")),
        ),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("dueDate.result")),
        outEl,
        h("p", { class: "hint" }, t("dueDate.formula")),
        h("p", { class: "hint" }, t("dueDate.disclaimer")),
      ),
    ),
  );
  paint();
}

export function unmountDueDate(): void {
  modeEl = dateEl = cycleEl = null;
  dateLabel = outEl = null;
  copyBtn = null;
  last = "";
}

function mode(): DueDateMode {
  const v = modeEl?.value;
  return v === "conception" || v === "due" ? v : "lmp";
}

function paint(): void {
  if (!outEl || !dateEl || !cycleEl || !dateLabel) return;
  const m = mode();
  dateLabel.textContent = m === "lmp" ? t("dueDate.lmp") : m === "conception" ? t("dueDate.conception") : t("dueDate.due");
  const cycleRaw = cycleEl.value.trim();
  const out = dueDate(m, dateEl.value, cycleRaw === "" ? NaN : Number(cycleRaw));
  outEl.replaceChildren();
  if (!out) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("dueDate.invalid")));
    return;
  }
  const fmt = new Intl.DateTimeFormat(locale(), { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  const day = (d: Date) => fmt.format(d);
  const rows: Array<[string, string, boolean]> = [
    [t("dueDate.due"), day(out.due), false],
    [t("dueDate.along"), out.trimester ? t("dueDate.weeksDays", { w: out.weeks, d: out.days }) : t("dueDate.notYet"), true],
    [t("dueDate.trimesterNow"), out.trimester ? String(out.trimester) : "—", true],
    [t("dueDate.daysLeft"), String(out.daysLeft), true],
    [t("dueDate.conception"), day(out.conception), false],
    [t("dueDate.lmp"), day(out.lmp), false],
    [t("dueDate.t2"), day(out.trimester2), false],
    [t("dueDate.t3"), day(out.trimester3), false],
  ];
  for (const [k, v, volatile] of rows) outEl.append(h("dt", null, k), h("dd", volatile ? { "data-volatile": "" } : null, v));
  last = rows.map(([k, v]) => `${k}: ${v}`).join("\n") + `\n${t("dueDate.due")}: ${isoOf(out.due)}`;
}

async function copyOut(): Promise<void> {
  await copyWithFlash(copyBtn, last, { done: t("dueDate.copied"), failed: t("dueDate.copyFailed") });
}
