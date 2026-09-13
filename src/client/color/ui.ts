import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import {
  contrastRatio,
  formatHsl,
  formatRgb,
  hexToRgb,
  parseColor,
  rgbToHex,
  rgbToHsl,
  type RGB,
} from "../../shared/color";

const WHITE: RGB = { r: 255, g: 255, b: 255 };
const BLACK: RGB = { r: 0, g: 0, b: 0 };

let hex = "#f7b6cb";
let swatch: HTMLElement | null = null;
let hexEl: HTMLInputElement | null = null;
let rgbEl: HTMLInputElement | null = null;
let hslEl: HTMLInputElement | null = null;
let nativeEl: HTMLInputElement | null = null;
let contrastEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;

export function mountColor(host: HTMLElement): void {
  swatch = h("div", { class: "color-swatch", style: { background: hex } });
  nativeEl = h("input", {
    type: "color",
    value: hex,
    "aria-label": t("color.native"),
    onInput: (e: Event) => applyHex((e.target as HTMLInputElement).value),
  });
  hexEl = field("hex");
  rgbEl = field("rgb");
  hslEl = field("hsl");
  contrastEl = h("p", { class: "hint" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("color.back")),
      h("h1", null, t("color.title")),
      h("p", { class: "lede" }, t("color.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("color.values")),
          labeled(t("color.hex"), hexEl),
          labeled(t("color.rgb"), rgbEl),
          labeled(t("color.hsl"), hslEl),
          labeled(t("color.native"), nativeEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copy("hex") }, t("color.copyHex")),
          h("button", { type: "button", class: "btn ghost", onClick: () => void copy("rgb") }, t("color.copyRgb")),
          eyedropperBtn(),
        ),
        contrastEl,
      ),
      h("div", { class: "rail color-stage" },
        h("h2", null, t("color.preview")),
        swatch,
      ),
    ),
  );
  paint();
}

export function unmountColor(): void {
  swatch = null;
  hexEl = null;
  rgbEl = null;
  hslEl = null;
  nativeEl = null;
  contrastEl = null;
  copyBtn = null;
}

function field(kind: "hex" | "rgb" | "hsl"): HTMLInputElement {
  return h("input", {
    class: "color-field",
    spellcheck: "false",
    "aria-label": t(`color.${kind}`),
    onChange: (e: Event) => {
      const rgb = parseColor((e.target as HTMLInputElement).value);
      if (rgb) applyHex(rgbToHex(rgb));
      else paint();
    },
  });
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function eyedropperBtn(): HTMLElement {
  const Ctor = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
  if (!Ctor) return h("span", { class: "muted" }, t("color.noDropper"));
  return h("button", {
    type: "button",
    class: "btn ghost",
    onClick: async () => {
      try {
        const result = await new Ctor().open();
        applyHex(result.sRGBHex);
      } catch { /* cancelled */ }
    },
  }, t("color.dropper"));
}

function applyHex(next: string): void {
  const rgb = hexToRgb(next);
  if (!rgb) return;
  hex = rgbToHex(rgb);
  paint();
}

function paint(): void {
  const rgb = hexToRgb(hex);
  if (!rgb) return;
  const hsl = rgbToHsl(rgb);
  if (swatch) swatch.style.background = hex;
  if (nativeEl) nativeEl.value = hex;
  if (hexEl) hexEl.value = hex;
  if (rgbEl) rgbEl.value = formatRgb(rgb);
  if (hslEl) hslEl.value = formatHsl(hsl);
  if (contrastEl) {
    const white = contrastRatio(rgb, WHITE);
    const black = contrastRatio(rgb, BLACK);
    contrastEl.textContent = t("color.contrast", {
      white: white.toFixed(2),
      black: black.toFixed(2),
    });
  }
}

async function copy(kind: "hex" | "rgb"): Promise<void> {
  const rgb = hexToRgb(hex);
  if (!rgb) return;
  const text = kind === "hex" ? hex : formatRgb(rgb);
  try {
    await navigator.clipboard.writeText(text);
    if (copyBtn) copyBtn.textContent = t("color.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("color.copyHex");
    }, 1200);
  } catch { /* ignore */ }
}
