import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { binaryToText, textToBinary } from "../../shared/binary";
import { debounce } from "../session";

type Mode = "to" | "from";

let inputEl: HTMLTextAreaElement | null = null;
let outputEl: HTMLTextAreaElement | null = null;
let statusEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let mode: Mode = "to";
const schedule = debounce(() => paint(), 80);

export function mountBinary(host: HTMLElement): void {
  inputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    "aria-label": t("binary.input"),
    placeholder: t("binary.placeholder"),
    onInput: () => schedule(),
  });
  outputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    readonly: true,
    "aria-label": t("binary.output"),
  });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("binary.back")),
      h("h1", null, t("binary.title")),
      h("p", { class: "lede" }, t("binary.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("binary.options")),
          h("select", {
            onChange: (e: Event) => {
              mode = (e.target as HTMLSelectElement).value as Mode;
              paint();
            },
          },
            h("option", { value: "to", selected: true }, t("binary.to")),
            h("option", { value: "from" }, t("binary.from")),
          ),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("binary.copy")),
        ),
        statusEl,
      ),
      h("div", { class: "data-panes" },
        h("div", { class: "rail" }, h("h2", null, t("binary.input")), inputEl),
        h("div", { class: "rail" }, h("h2", null, t("binary.output")), outputEl),
      ),
    ),
  );
  inputEl.value = "cv.cm";
  paint();
  inputEl.focus();
}

export function unmountBinary(): void {
  inputEl = null;
  outputEl = null;
  statusEl = null;
  copyBtn = null;
}

function paint(): void {
  if (!inputEl || !outputEl || !statusEl) return;
  if (mode === "to") {
    outputEl.value = textToBinary(inputEl.value);
    statusEl.textContent = "";
    return;
  }
  const text = binaryToText(inputEl.value);
  if (text == null) {
    outputEl.value = "";
    statusEl.textContent = t("binary.invalid");
    return;
  }
  outputEl.value = text;
  statusEl.textContent = "";
}

async function copyOut(): Promise<void> {
  if (!outputEl?.value) return;
  try {
    await navigator.clipboard.writeText(outputEl.value);
    if (copyBtn) copyBtn.textContent = t("binary.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("binary.copy");
    }, 1200);
  } catch { /* ignore */ }
}
