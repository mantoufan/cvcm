import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { ageOn, todayIso } from "../../shared/age";

let birthEl: HTMLInputElement | null = null;
let onEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountAge(host: HTMLElement): void {
  birthEl = h("input", { type: "date", value: "2000-01-01", onInput: () => paint() });
  onEl = h("input", { type: "date", value: todayIso(), onInput: () => paint() });
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("age.back")),
      h("h1", null, t("age.title")),
      h("p", { class: "lede" }, t("age.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("age.options")),
          labeled(t("age.birth"), birthEl),
          labeled(t("age.on"), onEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("age.copy")),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("age.result")), outEl),
    ),
  );
  paint();
}

export function unmountAge(): void {
  birthEl = null;
  onEl = null;
  outEl = null;
  copyBtn = null;
  last = "";
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function paint(): void {
  if (!birthEl || !onEl || !outEl) return;
  const age = ageOn(birthEl.value, onEl.value);
  outEl.replaceChildren();
  if (!age) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("age.invalid")));
    return;
  }
  const rows = [
    [t("age.years"), String(age.years)],
    [t("age.months"), String(age.months)],
    [t("age.days"), String(age.days)],
    [t("age.total"), String(age.totalDays)],
  ];
  last = t("age.line", {
    years: String(age.years),
    months: String(age.months),
    days: String(age.days),
    total: String(age.totalDays),
  });
  for (const [label, value] of rows) outEl.append(h("dt", null, label), h("dd", null, value));
}

async function copyOut(): Promise<void> {
  if (!last) return;
  try {
    await navigator.clipboard.writeText(last);
    if (copyBtn) copyBtn.textContent = t("age.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("age.copy");
    }, 1200);
  } catch { /* ignore */ }
}
