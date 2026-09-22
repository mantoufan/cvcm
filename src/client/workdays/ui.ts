import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { workdaysBetween } from "../../shared/workdays";

let fromEl: HTMLInputElement | null = null;
let toEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountWorkdays(host: HTMLElement): void {
  fromEl = h("input", { type: "date", "data-field": "from", value: "2026-01-05", onInput: () => paint() });
  toEl = h("input", { type: "date", "data-field": "to", value: "2026-01-09", onInput: () => paint() });
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("workdays.back")),
      h("h1", null, t("workdays.title")),
      h("p", { class: "lede" }, t("workdays.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("workdays.options")),
          labeled(t("workdays.from"), fromEl),
          labeled(t("workdays.to"), toEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("workdays.copy")),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("workdays.result")), outEl),
    ),
  );
  paint();
}

export function unmountWorkdays(): void {
  fromEl = null;
  toEl = null;
  outEl = null;
  copyBtn = null;
  last = "";
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function paint(): void {
  if (!fromEl || !toEl || !outEl) return;
  const out = workdaysBetween(fromEl.value, toEl.value);
  outEl.replaceChildren();
  if (!out) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("workdays.invalid")));
    return;
  }
  const rows = [
    [t("workdays.business"), String(out.business)],
    [t("workdays.weekends"), String(out.weekends)],
  ];
  last = rows.map((r) => `${r[0]}: ${r[1]}`).join("\n");
  for (const [label, value] of rows) outEl.append(h("dt", null, label), h("dd", null, value));
}

async function copyOut(): Promise<void> {
  if (!last) return;
  try {
    await navigator.clipboard.writeText(last);
    if (copyBtn) copyBtn.textContent = t("workdays.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("workdays.copy");
    }, 1200);
  } catch { /* ignore */ }
}
