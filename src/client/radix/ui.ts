import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { convertRadix } from "../../shared/radix";

let valueEl: HTMLInputElement | null = null;
let fromEl: HTMLInputElement | null = null;
let toEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountRadix(host: HTMLElement): void {
  valueEl = h("input", {
    type: "text",
    spellcheck: "false",
    autocapitalize: "off",
    "data-field": "value",
    value: "255",
    onInput: () => paint(),
  });
  fromEl = h("input", { type: "number", min: "2", max: "36", step: "1", "data-field": "from", value: "10", onInput: () => paint() });
  toEl = h("input", { type: "number", min: "2", max: "36", step: "1", "data-field": "to", value: "16", onInput: () => paint() });
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("radix.back")),
      h("h1", null, t("radix.title")),
      h("p", { class: "lede" }, t("radix.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("radix.options")),
          labeled(t("radix.value"), valueEl),
          labeled(t("radix.from"), fromEl),
          labeled(t("radix.to"), toEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("radix.copy")),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("radix.result")), outEl),
    ),
  );
  paint();
}

export function unmountRadix(): void {
  valueEl = null;
  fromEl = null;
  toEl = null;
  outEl = null;
  copyBtn = null;
  last = "";
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function paint(): void {
  if (!valueEl || !fromEl || !toEl || !outEl) return;
  const blank = [valueEl, fromEl, toEl].some((el) => el.value.trim() === "");
  const out = blank ? null : convertRadix(valueEl.value, Number(fromEl.value), Number(toEl.value));
  outEl.replaceChildren();
  if (!out) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("radix.invalid")));
    return;
  }
  last = out;
  outEl.append(h("dt", null, t("radix.out")), h("dd", null, out));
}

async function copyOut(): Promise<void> {
  if (!last) return;
  try {
    await navigator.clipboard.writeText(last);
    if (copyBtn) copyBtn.textContent = t("radix.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("radix.copy");
    }, 1200);
  } catch { /* ignore */ }
}
