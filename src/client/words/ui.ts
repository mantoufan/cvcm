import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { numberToWords } from "../../shared/words";

let numEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountWords(host: HTMLElement): void {
  numEl = h("input", { type: "number", min: "0", step: "1", value: "2026", onInput: () => paint() });
  outEl = h("p", { class: "timestamp-out", "aria-live": "polite" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("words.back")),
      h("h1", null, t("words.title")),
      h("p", { class: "lede" }, t("words.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("words.options")),
          labeled(t("words.number"), numEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("words.copy")),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("words.result")), outEl),
    ),
  );
  paint();
}

export function unmountWords(): void {
  numEl = null;
  outEl = null;
  copyBtn = null;
  last = "";
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function paint(): void {
  if (!numEl || !outEl) return;
  const words = numberToWords(Number(numEl.value));
  if (!words) {
    last = "";
    outEl.textContent = t("words.invalid");
    return;
  }
  last = words;
  outEl.textContent = words;
}

async function copyOut(): Promise<void> {
  if (!last) return;
  try {
    await navigator.clipboard.writeText(last);
    if (copyBtn) copyBtn.textContent = t("words.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("words.copy");
    }, 1200);
  } catch { /* ignore */ }
}
