import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { decodeHtml, encodeHtml } from "../../shared/html";
import { debounce } from "../session";

type Mode = "encode" | "decode";

let inputEl: HTMLTextAreaElement | null = null;
let outputEl: HTMLTextAreaElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let mode: Mode = "encode";
const schedule = debounce(() => paint(), 80);

export function mountHtml(host: HTMLElement): void {
  inputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    "aria-label": t("html.input"),
    placeholder: t("html.placeholder"),
    onInput: () => schedule(),
  });
  outputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    readonly: true,
    "aria-label": t("html.output"),
  });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("html.back")),
      h("h1", null, t("html.title")),
      h("p", { class: "lede" }, t("html.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("html.options")),
          h("select", {
            onChange: (e: Event) => {
              mode = (e.target as HTMLSelectElement).value as Mode;
              paint();
            },
          },
            h("option", { value: "encode", selected: true }, t("html.encode")),
            h("option", { value: "decode" }, t("html.decode")),
          ),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("html.copy")),
        ),
      ),
      h("div", { class: "data-panes" },
        h("div", { class: "rail" }, h("h2", null, t("html.input")), inputEl),
        h("div", { class: "rail" }, h("h2", null, t("html.output")), outputEl),
      ),
    ),
  );
  inputEl.value = `<a href="https://cv.cm">cv.cm</a>`;
  paint();
  inputEl.focus();
}

export function unmountHtml(): void {
  inputEl = null;
  outputEl = null;
  copyBtn = null;
}

function paint(): void {
  if (!inputEl || !outputEl) return;
  outputEl.value = mode === "encode" ? encodeHtml(inputEl.value) : decodeHtml(inputEl.value);
}

async function copyOut(): Promise<void> {
  if (!outputEl?.value) return;
  try {
    await navigator.clipboard.writeText(outputEl.value);
    if (copyBtn) copyBtn.textContent = t("html.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("html.copy");
    }, 1200);
  } catch { /* ignore */ }
}
