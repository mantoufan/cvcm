import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { t } from "../i18n";
import { debounce } from "../session";
import { FANCY_STYLES, MAX_FANCY, fancy } from "../../shared/fancy-text";

let inputEl: HTMLTextAreaElement | null = null;
let listEl: HTMLElement | null = null;
const schedule = debounce(() => paint(), 60);

export function mountFancyText(host: HTMLElement): void {
  inputEl = h("textarea", {
    class: "clip-input fancy-input",
    "data-field": "text",
    rows: "3",
    maxlength: String(MAX_FANCY),
    spellcheck: "false",
    "aria-label": t("fancyText.input"),
    placeholder: t("fancyText.placeholder"),
    onInput: () => schedule(),
  });
  inputEl.value = t("fancyText.sample");
  listEl = h("div", { class: "fancy-list", "data-out": "styles" });
  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("fancyText.title")),
      h("p", { class: "lede" }, t("fancyText.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("div", { class: "rail" },
        h("h2", null, t("fancyText.input")),
        inputEl,
        h("p", { class: "hint" }, t("fancyText.hint")),
      ),
      h("div", { class: "rail" }, listEl),
    ),
  );
  paint();
}

export function unmountFancyText(): void {
  inputEl = listEl = null;
}

function paint(): void {
  if (!inputEl || !listEl) return;
  // An empty box previews the sample so every style still shows what it looks like.
  const text = inputEl.value || t("fancyText.sample");
  listEl.replaceChildren(
    ...FANCY_STYLES.map((style) => {
      const out = fancy(text, style);
      const copyBtn: HTMLButtonElement = h("button", {
        type: "button",
        class: "chip",
        "data-action": "copy",
        "aria-label": t("fancyText.copyStyle", { style: t(`fancyText.style_${style}`) }),
        onClick: () => void copyWithFlash(copyBtn, out, { done: t("fancyText.copied"), failed: t("fancyText.copyFailed") }),
      }, t("fancyText.copy"));
      return h("div", { class: "fancy-row", "data-style": style },
        h("div", { class: "fancy-meta" }, h("span", { class: "muted" }, t(`fancyText.style_${style}`)), copyBtn),
        h("p", { class: "fancy-out", lang: "und" }, out),
      );
    }),
  );
}
