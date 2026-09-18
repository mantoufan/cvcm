import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { sortLines, type SortMode } from "../../shared/sort";
import { debounce } from "../session";

let inputEl: HTMLTextAreaElement | null = null;
let outputEl: HTMLTextAreaElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let mode: SortMode = "az";
const schedule = debounce(() => paint(), 80);

export function mountSort(host: HTMLElement): void {
  inputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    "aria-label": t("sort.input"),
    placeholder: t("sort.placeholder"),
    onInput: () => schedule(),
  });
  outputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    readonly: true,
    "aria-label": t("sort.output"),
  });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("sort.back")),
      h("h1", null, t("sort.title")),
      h("p", { class: "lede" }, t("sort.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("sort.options")),
          h("select", {
            onChange: (e: Event) => {
              mode = (e.target as HTMLSelectElement).value as SortMode;
              paint();
            },
          },
            h("option", { value: "az", selected: true }, t("sort.az")),
            h("option", { value: "za" }, t("sort.za")),
            h("option", { value: "unique" }, t("sort.unique")),
          ),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("sort.copy")),
        ),
      ),
      h("div", { class: "data-panes" },
        h("div", { class: "rail" }, h("h2", null, t("sort.input")), inputEl),
        h("div", { class: "rail" }, h("h2", null, t("sort.output")), outputEl),
      ),
    ),
  );
  inputEl.value = "banana\napple\napple\ncherry";
  paint();
  inputEl.focus();
}

export function unmountSort(): void {
  inputEl = null;
  outputEl = null;
  copyBtn = null;
}

function paint(): void {
  if (!inputEl || !outputEl) return;
  outputEl.value = sortLines(inputEl.value, mode);
}

async function copyOut(): Promise<void> {
  if (!outputEl?.value) return;
  try {
    await navigator.clipboard.writeText(outputEl.value);
    if (copyBtn) copyBtn.textContent = t("sort.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("sort.copy");
    }, 1200);
  } catch { /* ignore */ }
}
