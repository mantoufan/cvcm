import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { money } from "../../shared/discount";
import { payFromAnnual, payFromHourly } from "../../shared/hourly";

let modeEl: HTMLSelectElement | null = null;
let amountEl: HTMLInputElement | null = null;
let hoursEl: HTMLInputElement | null = null;
let weeksEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountHourly(host: HTMLElement): void {
  modeEl = h("select", { "data-field": "mode", onChange: () => paint() },
    h("option", { value: "hourly", selected: true }, t("hourly.fromHourly")),
    h("option", { value: "annual" }, t("hourly.fromAnnual")),
  );
  amountEl = h("input", { type: "number", min: "0", step: "0.01", "data-field": "amount", value: "20", onInput: () => paint() });
  hoursEl = h("input", { type: "number", min: "0", step: "0.5", "data-field": "hours", value: "40", onInput: () => paint() });
  weeksEl = h("input", { type: "number", min: "0", step: "1", "data-field": "weeks", value: "52", onInput: () => paint() });
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("hourly.back")),
      h("h1", null, t("hourly.title")),
      h("p", { class: "lede" }, t("hourly.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("hourly.options")),
          labeled(t("hourly.mode"), modeEl),
          labeled(t("hourly.amount"), amountEl),
          labeled(t("hourly.hours"), hoursEl),
          labeled(t("hourly.weeks"), weeksEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("hourly.copy")),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("hourly.result")), outEl),
    ),
  );
  paint();
}

export function unmountHourly(): void {
  modeEl = null;
  amountEl = null;
  hoursEl = null;
  weeksEl = null;
  outEl = null;
  copyBtn = null;
  last = "";
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function paint(): void {
  if (!modeEl || !amountEl || !hoursEl || !weeksEl || !outEl) return;
  const amount = Number(amountEl.value);
  const hours = Number(hoursEl.value);
  const weeks = Number(weeksEl.value);
  const blank = [amountEl, hoursEl, weeksEl].some((el) => el.value.trim() === "");
  const out = blank
    ? null
    : modeEl.value === "annual"
      ? payFromAnnual(amount, hours, weeks)
      : payFromHourly(amount, hours, weeks);
  outEl.replaceChildren();
  if (!out) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("hourly.invalid")));
    return;
  }
  const rows = [
    [t("hourly.hourly"), money(out.hourly)],
    [t("hourly.weekly"), money(out.weekly)],
    [t("hourly.annual"), money(out.annual)],
  ];
  last = rows.map((r) => `${r[0]}: ${r[1]}`).join("\n");
  for (const [label, value] of rows) outEl.append(h("dt", null, label), h("dd", null, value));
}

async function copyOut(): Promise<void> {
  if (!last) return;
  try {
    await navigator.clipboard.writeText(last);
    if (copyBtn) copyBtn.textContent = t("hourly.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("hourly.copy");
    }, 1200);
  } catch { /* ignore */ }
}
