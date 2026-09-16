import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { describeCron } from "../../shared/cron";
import { debounce } from "../session";

let inputEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";
const schedule = debounce(() => paint(), 80);

export function mountCron(host: HTMLElement): void {
  inputEl = h("input", {
    class: "regex-pattern",
    spellcheck: "false",
    autocapitalize: "off",
    autocomplete: "off",
    "aria-label": t("cron.input"),
    placeholder: t("cron.placeholder"),
    value: "*/15 9-17 * * 1-5",
    onInput: () => schedule(),
  });
  outEl = h("p", { class: "timestamp-out", "aria-live": "polite" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("cron.back")),
      h("h1", null, t("cron.title")),
      h("p", { class: "lede" }, t("cron.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("cron.options")),
          labeled(t("cron.input"), inputEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("cron.copy")),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("cron.result")), outEl),
    ),
  );
  paint();
  inputEl.focus();
}

export function unmountCron(): void {
  inputEl = null;
  outEl = null;
  copyBtn = null;
  last = "";
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function paint(): void {
  if (!inputEl || !outEl) return;
  const result = describeCron(inputEl.value);
  if (!result.ok) {
    last = "";
    outEl.textContent = t(`cron.${result.error}`);
    return;
  }
  last = result.summary;
  outEl.textContent = result.summary;
}

async function copyOut(): Promise<void> {
  if (!last) return;
  try {
    await navigator.clipboard.writeText(last);
    if (copyBtn) copyBtn.textContent = t("cron.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("cron.copy");
    }, 1200);
  } catch { /* ignore */ }
}
