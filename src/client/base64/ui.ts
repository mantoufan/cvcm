import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { decodeBase64, encodeBase64 } from "../../shared/base64";
import { debounce } from "../session";

type Mode = "to" | "from";

let inputEl: HTMLTextAreaElement | null = null;
let outputEl: HTMLTextAreaElement | null = null;
let statusEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let mode: Mode = "to";
const schedule = debounce(() => paint(), 80);

export function mountBase64(host: HTMLElement): void {
  inputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    "aria-label": t("base64.input"),
    placeholder: t("base64.placeholder"),
    onInput: () => schedule(),
  });
  outputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    readonly: true,
    "aria-label": t("base64.output"),
  });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("base64.back")),
      h("h1", null, t("base64.title")),
      h("p", { class: "lede" }, t("base64.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("base64.options")),
          h("select", {
            onChange: (e: Event) => {
              mode = (e.target as HTMLSelectElement).value as Mode;
              paint();
            },
          },
            h("option", { value: "to", selected: true }, t("base64.to")),
            h("option", { value: "from" }, t("base64.from")),
          ),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("base64.copy")),
        ),
        statusEl,
      ),
      h("div", { class: "data-panes" },
        h("div", { class: "rail" }, h("h2", null, t("base64.input")), inputEl),
        h("div", { class: "rail" }, h("h2", null, t("base64.output")), outputEl),
      ),
    ),
  );
  inputEl.value = "cv.cm";
  paint();
  inputEl.focus();
}

export function unmountBase64(): void {
  inputEl = null;
  outputEl = null;
  statusEl = null;
  copyBtn = null;
}

function paint(): void {
  if (!inputEl || !outputEl || !statusEl) return;
  if (mode === "to") {
    outputEl.value = encodeBase64(inputEl.value);
    statusEl.textContent = "";
    return;
  }
  const text = decodeBase64(inputEl.value);
  if (text == null) {
    outputEl.value = "";
    statusEl.textContent = t("base64.invalid");
    return;
  }
  outputEl.value = text;
  statusEl.textContent = "";
}

async function copyOut(): Promise<void> {
  if (!outputEl?.value) return;
  try {
    await navigator.clipboard.writeText(outputEl.value);
    if (copyBtn) copyBtn.textContent = t("base64.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("base64.copy");
    }, 1200);
  } catch { /* ignore */ }
}
