import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { slugify } from "../../shared/slug";
import { debounce } from "../session";

let inputEl: HTMLTextAreaElement | null = null;
let outputEl: HTMLInputElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
const schedule = debounce(() => paint(), 80);

export function mountSlug(host: HTMLElement): void {
  inputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    "aria-label": t("slug.input"),
    placeholder: t("slug.placeholder"),
    onInput: () => schedule(),
  });
  outputEl = h("input", {
    class: "regex-pattern",
    readonly: true,
    spellcheck: "false",
    "aria-label": t("slug.output"),
  });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("slug.back")),
      h("h1", null, t("slug.title")),
      h("p", { class: "lede" }, t("slug.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("slug.copy")),
        ),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("slug.input")),
        inputEl,
        labeled(t("slug.output"), outputEl),
      ),
    ),
  );
  inputEl.value = "Hello, cv.cm — YAML to JSON";
  paint();
  inputEl.focus();
}

export function unmountSlug(): void {
  inputEl = null;
  outputEl = null;
  copyBtn = null;
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function paint(): void {
  if (!inputEl || !outputEl) return;
  outputEl.value = slugify(inputEl.value);
}

async function copyOut(): Promise<void> {
  if (!outputEl?.value) return;
  try {
    await navigator.clipboard.writeText(outputEl.value);
    if (copyBtn) copyBtn.textContent = t("slug.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("slug.copy");
    }, 1200);
  } catch { /* ignore */ }
}
