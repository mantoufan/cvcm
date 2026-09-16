import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { randomInts } from "../../shared/random";

let minEl: HTMLInputElement | null = null;
let maxEl: HTMLInputElement | null = null;
let countEl: HTMLInputElement | null = null;
let outEl: HTMLTextAreaElement | null = null;
let copyBtn: HTMLButtonElement | null = null;

export function mountRandom(host: HTMLElement): void {
  minEl = h("input", { type: "number", step: "1", value: "1" });
  maxEl = h("input", { type: "number", step: "1", value: "100" });
  countEl = h("input", { type: "number", min: "1", max: "200", step: "1", value: "1" });
  outEl = h("textarea", { class: "clip-input", readonly: true, spellcheck: "false", "aria-label": t("random.result") });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("random.back")),
      h("h1", null, t("random.title")),
      h("p", { class: "lede" }, t("random.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("random.options")),
          labeled(t("random.min"), minEl),
          labeled(t("random.max"), maxEl),
          labeled(t("random.count"), countEl),
        ),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn ghost", onClick: () => roll() }, t("random.roll")),
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("random.copy")),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("random.result")), outEl),
    ),
  );
  roll();
}

export function unmountRandom(): void {
  minEl = null;
  maxEl = null;
  countEl = null;
  outEl = null;
  copyBtn = null;
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function roll(): void {
  if (!minEl || !maxEl || !countEl || !outEl) return;
  const nums = randomInts(Number(minEl.value), Number(maxEl.value), Number(countEl.value));
  outEl.value = nums.join("\n");
}

async function copyOut(): Promise<void> {
  if (!outEl?.value) return;
  try {
    await navigator.clipboard.writeText(outEl.value);
    if (copyBtn) copyBtn.textContent = t("random.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("random.copy");
    }, 1200);
  } catch { /* ignore */ }
}
