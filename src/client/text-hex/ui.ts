import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { hexToText, textToHex } from "../../shared/text-hex";
import { debounce } from "../session";

type Mode = "to" | "from";

let inputEl: HTMLTextAreaElement | null = null;
let outputEl: HTMLTextAreaElement | null = null;
let statusEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let mode: Mode = "to";
const schedule = debounce(() => paint(), 80);

export function mountTextHex(host: HTMLElement): void {
  inputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    "aria-label": t("text-hex.input"),
    placeholder: t("text-hex.placeholder"),
    onInput: () => schedule(),
  });
  outputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    readonly: true,
    "aria-label": t("text-hex.output"),
  });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("text-hex.back")),
      h("h1", null, t("text-hex.title")),
      h("p", { class: "lede" }, t("text-hex.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("text-hex.options")),
          h("select", {
            onChange: (e: Event) => {
              mode = (e.target as HTMLSelectElement).value as Mode;
              paint();
            },
          },
            h("option", { value: "to", selected: true }, t("text-hex.to")),
            h("option", { value: "from" }, t("text-hex.from")),
          ),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("text-hex.copy")),
        ),
        statusEl,
      ),
      h("div", { class: "data-panes" },
        h("div", { class: "rail" }, h("h2", null, t("text-hex.input")), inputEl),
        h("div", { class: "rail" }, h("h2", null, t("text-hex.output")), outputEl),
      ),
    ),
  );
  inputEl.value = "cv.cm";
  paint();
  inputEl.focus();
}

export function unmountTextHex(): void {
  inputEl = null;
  outputEl = null;
  statusEl = null;
  copyBtn = null;
}

function paint(): void {
  if (!inputEl || !outputEl || !statusEl) return;
  if (mode === "to") {
    outputEl.value = textToHex(inputEl.value);
    statusEl.textContent = "";
    return;
  }
  const text = hexToText(inputEl.value);
  if (text == null) {
    outputEl.value = "";
    statusEl.textContent = t("text-hex.invalid");
    return;
  }
  outputEl.value = text;
  statusEl.textContent = "";
}

async function copyOut(): Promise<void> {
  if (!outputEl?.value) return;
  try {
    await navigator.clipboard.writeText(outputEl.value);
    if (copyBtn) copyBtn.textContent = t("text-hex.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("text-hex.copy");
    }, 1200);
  } catch { /* ignore */ }
}
