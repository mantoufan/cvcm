import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { CASE_IDS, convertCase, type CaseId } from "../../shared/case";
import { debounce } from "../session";

let inputEl: HTMLTextAreaElement | null = null;
let outputEl: HTMLTextAreaElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let mode: CaseId = "title";
const schedule = debounce(() => paint(), 80);

export function mountCase(host: HTMLElement): void {
  inputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    "aria-label": t("caseTool.input"),
    placeholder: t("caseTool.placeholder"),
    onInput: () => schedule(),
  });
  outputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    readonly: true,
    "aria-label": t("caseTool.output"),
  });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("caseTool.back")),
      h("h1", null, t("caseTool.title")),
      h("p", { class: "lede" }, t("caseTool.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("caseTool.options")),
          h("select", {
            onChange: (e: Event) => {
              mode = (e.target as HTMLSelectElement).value as CaseId;
              paint();
            },
          },
            ...CASE_IDS.map((id) => h("option", { value: id, selected: id === mode }, t(`caseTool.${id}`))),
          ),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("caseTool.copy")),
        ),
      ),
      h("div", { class: "data-panes" },
        h("div", { class: "rail" }, h("h2", null, t("caseTool.input")), inputEl),
        h("div", { class: "rail" }, h("h2", null, t("caseTool.output")), outputEl),
      ),
    ),
  );
  inputEl.value = "hello cv.cm case converter";
  paint();
  inputEl.focus();
}

export function unmountCase(): void {
  inputEl = null;
  outputEl = null;
  copyBtn = null;
}

function paint(): void {
  if (!inputEl || !outputEl) return;
  outputEl.value = convertCase(inputEl.value, mode);
}

async function copyOut(): Promise<void> {
  if (!outputEl?.value) return;
  try {
    await navigator.clipboard.writeText(outputEl.value);
    if (copyBtn) copyBtn.textContent = t("caseTool.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("caseTool.copy");
    }, 1200);
  } catch { /* ignore */ }
}
