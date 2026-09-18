import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { minifyJson, prettyJson } from "../../shared/json";
import { debounce } from "../session";

type Mode = "pretty" | "minify";

let inputEl: HTMLTextAreaElement | null = null;
let outputEl: HTMLTextAreaElement | null = null;
let statusEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let mode: Mode = "pretty";
const schedule = debounce(() => paint(), 80);

export function mountJson(host: HTMLElement): void {
  inputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    "aria-label": t("json.input"),
    placeholder: t("json.placeholder"),
    onInput: () => schedule(),
  });
  outputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    readonly: true,
    "aria-label": t("json.output"),
  });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("json.back")),
      h("h1", null, t("json.title")),
      h("p", { class: "lede" }, t("json.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("json.options")),
          h("select", {
            onChange: (e: Event) => {
              mode = (e.target as HTMLSelectElement).value as Mode;
              paint();
            },
          },
            h("option", { value: "pretty", selected: true }, t("json.pretty")),
            h("option", { value: "minify" }, t("json.minify")),
          ),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("json.copy")),
        ),
        statusEl,
      ),
      h("div", { class: "data-panes" },
        h("div", { class: "rail" }, h("h2", null, t("json.input")), inputEl),
        h("div", { class: "rail" }, h("h2", null, t("json.output")), outputEl),
      ),
    ),
  );
  inputEl.value = '{\n  "site": "cv.cm",\n  "ok": true\n}';
  paint();
  inputEl.focus();
}

export function unmountJson(): void {
  inputEl = null;
  outputEl = null;
  statusEl = null;
  copyBtn = null;
}

function paint(): void {
  if (!inputEl || !outputEl || !statusEl) return;
  const out = mode === "pretty" ? prettyJson(inputEl.value) : minifyJson(inputEl.value);
  if (out == null) {
    outputEl.value = "";
    statusEl.textContent = t("json.invalid");
    return;
  }
  outputEl.value = out;
  statusEl.textContent = "";
}

async function copyOut(): Promise<void> {
  if (!outputEl?.value) return;
  try {
    await navigator.clipboard.writeText(outputEl.value);
    if (copyBtn) copyBtn.textContent = t("json.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("json.copy");
    }, 1200);
  } catch { /* ignore */ }
}
