import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { todayIso } from "../../shared/age";
import { daysBetween } from "../../shared/days";

let fromEl: HTMLInputElement | null = null;
let toEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountDays(host: HTMLElement): void {
  fromEl = h("input", { type: "date", value: "2026-01-01", onInput: () => paint() });
  toEl = h("input", { type: "date", value: todayIso(), onInput: () => paint() });
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("days.back")),
      h("h1", null, t("days.title")),
      h("p", { class: "lede" }, t("days.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("days.options")),
          labeled(t("days.from"), fromEl),
          labeled(t("days.to"), toEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("days.copy")),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("days.result")), outEl),
    ),
  );
  paint();
}

export function unmountDays(): void {
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
  const days = daysBetween(fromEl.value, toEl.value);
  outEl.replaceChildren();
  if (days == null) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("days.invalid")));
    return;
  }
  const abs = Math.abs(days);
  const rows = [
    [t("days.diff"), String(days)],
    [t("days.abs"), String(abs)],
    [t("days.weeks"), String(Math.trunc(abs / 7))],
  ];
  last = rows.map((r) => `${r[0]}: ${r[1]}`).join("\n");
  for (const [label, value] of rows) outEl.append(h("dt", null, label), h("dd", null, value));
}

async function copyOut(): Promise<void> {
  if (!last) return;
  try {
    await navigator.clipboard.writeText(last);
    if (copyBtn) copyBtn.textContent = t("days.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("days.copy");
    }, 1200);
  } catch { /* ignore */ }
}
