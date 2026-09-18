import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { replaceText } from "../../shared/replace";
import { debounce } from "../session";

let inputEl: HTMLTextAreaElement | null = null;
let findEl: HTMLInputElement | null = null;
let replEl: HTMLInputElement | null = null;
let outputEl: HTMLTextAreaElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let all = true;
const schedule = debounce(() => paint(), 80);

export function mountReplace(host: HTMLElement): void {
  findEl = h("input", { type: "text", value: "cv.cm", onInput: () => schedule() });
  replEl = h("input", { type: "text", value: "cv.cm tools", onInput: () => schedule() });
  inputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    "aria-label": t("replace.input"),
    placeholder: t("replace.placeholder"),
    onInput: () => schedule(),
  });
  outputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    readonly: true,
    "aria-label": t("replace.output"),
  });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("replace.back")),
      h("h1", null, t("replace.title")),
      h("p", { class: "lede" }, t("replace.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("replace.options")),
          labeled(t("replace.find"), findEl),
          labeled(t("replace.repl"), replEl),
          h("select", {
            onChange: (e: Event) => {
              all = (e.target as HTMLSelectElement).value === "all";
              paint();
            },
          },
            h("option", { value: "all", selected: true }, t("replace.all")),
            h("option", { value: "first" }, t("replace.first")),
          ),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("replace.copy")),
        ),
      ),
      h("div", { class: "data-panes" },
        h("div", { class: "rail" }, h("h2", null, t("replace.input")), inputEl),
        h("div", { class: "rail" }, h("h2", null, t("replace.output")), outputEl),
      ),
    ),
  );
  inputEl.value = "Hello cv.cm\nVisit cv.cm";
  paint();
  inputEl.focus();
}

export function unmountReplace(): void {
  inputEl = null;
  findEl = null;
  replEl = null;
  outputEl = null;
  copyBtn = null;
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function paint(): void {
  if (!inputEl || !findEl || !replEl || !outputEl) return;
  outputEl.value = replaceText(inputEl.value, findEl.value, replEl.value, all);
}

async function copyOut(): Promise<void> {
  if (!outputEl) return;
  try {
    await navigator.clipboard.writeText(outputEl.value);
    if (copyBtn) copyBtn.textContent = t("replace.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("replace.copy");
    }, 1200);
  } catch { /* ignore */ }
}
