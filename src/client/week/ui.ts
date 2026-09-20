import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { todayIso } from "../../shared/age";
import { isoWeek, isoWeekLabel } from "../../shared/week";

let dateEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountWeek(host: HTMLElement): void {
  dateEl = h("input", { type: "date", value: todayIso(), onInput: () => paint() });
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("week.back")),
      h("h1", null, t("week.title")),
      h("p", { class: "lede" }, t("week.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("week.options")),
          labeled(t("week.date"), dateEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("week.copy")),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("week.result")), outEl),
    ),
  );
  paint();
}

export function unmountWeek(): void {
  dateEl = null;
  outEl = null;
  copyBtn = null;
  last = "";
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function paint(): void {
  if (!dateEl || !outEl) return;
  const info = isoWeek(dateEl.value);
  outEl.replaceChildren();
  if (!info) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("week.invalid")));
    return;
  }
  const label = isoWeekLabel(info);
  const rows = [
    [t("week.iso"), label],
    [t("week.year"), String(info.year)],
    [t("week.weekn"), String(info.week)],
    [t("week.weekday"), t(`week.d${info.weekday}`)],
  ];
  last = rows.map((r) => `${r[0]}: ${r[1]}`).join("\n");
  for (const [k, v] of rows) outEl.append(h("dt", null, k), h("dd", null, v));
}

async function copyOut(): Promise<void> {
  if (!last) return;
  try {
    await navigator.clipboard.writeText(last);
    if (copyBtn) copyBtn.textContent = t("week.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("week.copy");
    }, 1200);
  } catch { /* ignore */ }
}
