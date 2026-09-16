import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import {
  formatCmyk,
  formatHsl,
  formatRgb,
  parseColor,
  rgbToCmyk,
  rgbToHex,
  rgbToHsl,
  type RGB,
} from "../../shared/color";

let inputEl: HTMLInputElement | null = null;
let swatch: HTMLElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let lastCopy = "";

export function mountHexRgb(host: HTMLElement): void {
  inputEl = h("input", {
    class: "regex-pattern",
    spellcheck: "false",
    autocapitalize: "off",
    autocomplete: "off",
    "aria-label": t("hexRgb.input"),
    placeholder: t("hexRgb.placeholder"),
    value: "#f7b6cb",
    onInput: () => paint(),
  });
  swatch = h("div", { class: "color-swatch" });
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("hexRgb.back")),
      h("h1", null, t("hexRgb.title")),
      h("p", { class: "lede" }, t("hexRgb.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("hexRgb.options")),
          labeled(t("hexRgb.input"), inputEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("hexRgb.copy")),
        ),
      ),
      h("div", { class: "rail color-stage" },
        h("h2", null, t("hexRgb.result")),
        swatch,
        outEl,
      ),
    ),
  );
  paint();
  inputEl.focus();
}

export function unmountHexRgb(): void {
  inputEl = null;
  swatch = null;
  outEl = null;
  copyBtn = null;
  lastCopy = "";
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function paint(): void {
  if (!inputEl || !outEl || !swatch) return;
  const rgb = parseColor(inputEl.value);
  outEl.replaceChildren();
  lastCopy = "";
  if (!rgb) {
    swatch.style.background = "#fff7fb";
    outEl.append(h("p", { class: "muted" }, t("hexRgb.invalid")));
    return;
  }
  const rows = formatRows(rgb);
  lastCopy = rows.map((r) => r.value).join("\n");
  swatch.style.background = rgbToHex(rgb);
  for (const row of rows) {
    outEl.append(h("dt", null, row.label), h("dd", null, row.value));
  }
}

function formatRows(rgb: RGB): Array<{ label: string; value: string }> {
  return [
    { label: t("hexRgb.hex"), value: rgbToHex(rgb) },
    { label: t("hexRgb.rgb"), value: formatRgb(rgb) },
    { label: t("hexRgb.hsl"), value: formatHsl(rgbToHsl(rgb)) },
    { label: t("hexRgb.cmyk"), value: formatCmyk(rgbToCmyk(rgb)) },
  ];
}

async function copyOut(): Promise<void> {
  if (!lastCopy) return;
  try {
    await navigator.clipboard.writeText(lastCopy);
    if (copyBtn) copyBtn.textContent = t("hexRgb.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("hexRgb.copy");
    }, 1200);
  } catch { /* ignore */ }
}
