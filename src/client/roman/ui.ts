import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { fromRoman, toRoman } from "../../shared/roman";
import { debounce } from "../session";

type Mode = "to" | "from";

let inputEl: HTMLInputElement | null = null;
let outputEl: HTMLInputElement | null = null;
let statusEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let mode: Mode = "to";
const schedule = debounce(() => paint(), 80);

export function mountRoman(host: HTMLElement): void {
  inputEl = h("input", {
    class: "regex-pattern",
    spellcheck: "false",
    autocapitalize: "off",
    autocomplete: "off",
    "aria-label": t("roman.input"),
    placeholder: t("roman.placeholder"),
    onInput: () => schedule(),
  });
  outputEl = h("input", {
    class: "regex-pattern",
    readonly: true,
    spellcheck: "false",
    "aria-label": t("roman.output"),
  });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("roman.back")),
      h("h1", null, t("roman.title")),
      h("p", { class: "lede" }, t("roman.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("roman.options")),
          h("select", {
            onChange: (e: Event) => {
              mode = (e.target as HTMLSelectElement).value as Mode;
              paint();
            },
          },
            h("option", { value: "to", selected: true }, t("roman.to")),
            h("option", { value: "from" }, t("roman.from")),
          ),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("roman.copy")),
        ),
        statusEl,
      ),
      h("div", { class: "rail" },
        labeled(t("roman.input"), inputEl),
        labeled(t("roman.output"), outputEl),
      ),
    ),
  );
  inputEl.value = "2026";
  paint();
  inputEl.focus();
}

export function unmountRoman(): void {
  inputEl = null;
  outputEl = null;
  statusEl = null;
  copyBtn = null;
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function paint(): void {
  if (!inputEl || !outputEl || !statusEl) return;
  if (mode === "to") {
    const n = Number(inputEl.value.trim());
    const out = toRoman(n);
    if (!out) {
      outputEl.value = "";
      statusEl.textContent = t("roman.invalidTo");
      return;
    }
    outputEl.value = out;
    statusEl.textContent = "";
    return;
  }
  const n = fromRoman(inputEl.value);
  if (n == null) {
    outputEl.value = "";
    statusEl.textContent = t("roman.invalidFrom");
    return;
  }
  outputEl.value = String(n);
  statusEl.textContent = "";
}

async function copyOut(): Promise<void> {
  if (!outputEl?.value) return;
  try {
    await navigator.clipboard.writeText(outputEl.value);
    if (copyBtn) copyBtn.textContent = t("roman.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("roman.copy");
    }, 1200);
  } catch { /* ignore */ }
}
