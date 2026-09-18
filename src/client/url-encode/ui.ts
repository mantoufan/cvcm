import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { decodeUrl, encodeUrl } from "../../shared/url-encode";
import { debounce } from "../session";

type Mode = "to" | "from";

let inputEl: HTMLTextAreaElement | null = null;
let outputEl: HTMLTextAreaElement | null = null;
let statusEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let mode: Mode = "to";
const schedule = debounce(() => paint(), 80);

export function mountUrlEncode(host: HTMLElement): void {
  inputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    "aria-label": t("url-encode.input"),
    placeholder: t("url-encode.placeholder"),
    onInput: () => schedule(),
  });
  outputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    readonly: true,
    "aria-label": t("url-encode.output"),
  });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("url-encode.back")),
      h("h1", null, t("url-encode.title")),
      h("p", { class: "lede" }, t("url-encode.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("url-encode.options")),
          h("select", {
            onChange: (e: Event) => {
              mode = (e.target as HTMLSelectElement).value as Mode;
              paint();
            },
          },
            h("option", { value: "to", selected: true }, t("url-encode.to")),
            h("option", { value: "from" }, t("url-encode.from")),
          ),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("url-encode.copy")),
        ),
        statusEl,
      ),
      h("div", { class: "data-panes" },
        h("div", { class: "rail" }, h("h2", null, t("url-encode.input")), inputEl),
        h("div", { class: "rail" }, h("h2", null, t("url-encode.output")), outputEl),
      ),
    ),
  );
  inputEl.value = "https://cv.cm/?q=hello world";
  paint();
  inputEl.focus();
}

export function unmountUrlEncode(): void {
  inputEl = null;
  outputEl = null;
  statusEl = null;
  copyBtn = null;
}

function paint(): void {
  if (!inputEl || !outputEl || !statusEl) return;
  if (mode === "to") {
    outputEl.value = encodeUrl(inputEl.value);
    statusEl.textContent = "";
    return;
  }
  const text = decodeUrl(inputEl.value);
  if (text == null) {
    outputEl.value = "";
    statusEl.textContent = t("url-encode.invalid");
    return;
  }
  outputEl.value = text;
  statusEl.textContent = "";
}

async function copyOut(): Promise<void> {
  if (!outputEl?.value) return;
  try {
    await navigator.clipboard.writeText(outputEl.value);
    if (copyBtn) copyBtn.textContent = t("url-encode.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("url-encode.copy");
    }, 1200);
  } catch { /* ignore */ }
}
