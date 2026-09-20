import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { todayIso } from "../../shared/age";
import { addDays } from "../../shared/add-days";

let dateEl: HTMLInputElement | null = null;
let daysEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountAddDays(host: HTMLElement): void {
  dateEl = h("input", { type: "date", value: todayIso(), onInput: () => paint() });
  daysEl = h("input", { type: "number", step: "1", value: "30", onInput: () => paint() });
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("add-days.back")),
      h("h1", null, t("add-days.title")),
      h("p", { class: "lede" }, t("add-days.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("add-days.options")),
          labeled(t("add-days.date"), dateEl),
          labeled(t("add-days.days"), daysEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("add-days.copy")),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("add-days.result")), outEl),
    ),
  );
  paint();
}

export function unmountAddDays(): void {
  dateEl = null;
  daysEl = null;
  outEl = null;
  copyBtn = null;
  last = "";
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function paint(): void {
  if (!dateEl || !daysEl || !outEl) return;
  const next = addDays(dateEl.value, Number(daysEl.value));
  outEl.replaceChildren();
  if (!next) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("add-days.invalid")));
    return;
  }
  last = next;
  outEl.append(h("dt", null, t("add-days.next")), h("dd", null, next));
}

async function copyOut(): Promise<void> {
  if (!last) return;
  try {
    await navigator.clipboard.writeText(last);
    if (copyBtn) copyBtn.textContent = t("add-days.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("add-days.copy");
    }, 1200);
  } catch { /* ignore */ }
}
