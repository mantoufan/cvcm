import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { morseToText, textToMorse } from "../../shared/morse";
import { debounce } from "../session";

type Mode = "to" | "from";

let inputEl: HTMLTextAreaElement | null = null;
let outputEl: HTMLTextAreaElement | null = null;
let statusEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let mode: Mode = "to";
const schedule = debounce(() => paint(), 80);

export function mountMorse(host: HTMLElement): void {
  inputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    "aria-label": t("morse.input"),
    placeholder: t("morse.placeholder"),
    onInput: () => schedule(),
  });
  outputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    readonly: true,
    "aria-label": t("morse.output"),
  });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("morse.back")),
      h("h1", null, t("morse.title")),
      h("p", { class: "lede" }, t("morse.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("morse.options")),
          h("select", {
            onChange: (e: Event) => {
              mode = (e.target as HTMLSelectElement).value as Mode;
              paint();
            },
          },
            h("option", { value: "to", selected: true }, t("morse.to")),
            h("option", { value: "from" }, t("morse.from")),
          ),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("morse.copy")),
        ),
        statusEl,
      ),
      h("div", { class: "data-panes" },
        h("div", { class: "rail" }, h("h2", null, t("morse.input")), inputEl),
        h("div", { class: "rail" }, h("h2", null, t("morse.output")), outputEl),
      ),
    ),
  );
  inputEl.value = "cv.cm";
  paint();
  inputEl.focus();
}

export function unmountMorse(): void {
  inputEl = null;
  outputEl = null;
  statusEl = null;
  copyBtn = null;
}

function paint(): void {
  if (!inputEl || !outputEl || !statusEl) return;
  if (mode === "to") {
    outputEl.value = textToMorse(inputEl.value);
    statusEl.textContent = "";
    return;
  }
  const text = morseToText(inputEl.value);
  if (text == null) {
    outputEl.value = "";
    statusEl.textContent = t("morse.invalid");
    return;
  }
  outputEl.value = text;
  statusEl.textContent = "";
}

async function copyOut(): Promise<void> {
  if (!outputEl?.value) return;
  try {
    await navigator.clipboard.writeText(outputEl.value);
    if (copyBtn) copyBtn.textContent = t("morse.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("morse.copy");
    }, 1200);
  } catch { /* ignore */ }
}
