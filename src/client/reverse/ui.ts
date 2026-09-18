import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { isPalindrome, reverseText } from "../../shared/reverse";
import { debounce } from "../session";

let inputEl: HTMLTextAreaElement | null = null;
let outputEl: HTMLTextAreaElement | null = null;
let statusEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
const schedule = debounce(() => paint(), 80);

export function mountReverse(host: HTMLElement): void {
  inputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    "aria-label": t("reverse.input"),
    placeholder: t("reverse.placeholder"),
    onInput: () => schedule(),
  });
  outputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    readonly: true,
    "aria-label": t("reverse.output"),
  });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("reverse.back")),
      h("h1", null, t("reverse.title")),
      h("p", { class: "lede" }, t("reverse.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null, h("legend", null, t("reverse.options"))),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("reverse.copy")),
        ),
        statusEl,
      ),
      h("div", { class: "data-panes" },
        h("div", { class: "rail" }, h("h2", null, t("reverse.input")), inputEl),
        h("div", { class: "rail" }, h("h2", null, t("reverse.output")), outputEl),
      ),
    ),
  );
  inputEl.value = "Hello cv.cm";
  paint();
  inputEl.focus();
}

export function unmountReverse(): void {
  inputEl = null;
  outputEl = null;
  statusEl = null;
  copyBtn = null;
}

function paint(): void {
  if (!inputEl || !outputEl || !statusEl) return;
  const text = inputEl.value;
  outputEl.value = reverseText(text);
  statusEl.textContent = text.trim()
    ? (isPalindrome(text) ? t("reverse.yes") : t("reverse.no"))
    : "";
}

async function copyOut(): Promise<void> {
  if (!outputEl?.value) return;
  try {
    await navigator.clipboard.writeText(outputEl.value);
    if (copyBtn) copyBtn.textContent = t("reverse.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("reverse.copy");
    }, 1200);
  } catch { /* ignore */ }
}
