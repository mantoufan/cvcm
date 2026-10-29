import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { hexToRgb, rgbToHex } from "../../shared/color";
import { AAA_LARGE, AAA_NORMAL, AA_LARGE, AA_NORMAL, UI_MIN, contrastLevels, suggestForeground } from "../../shared/contrast";

let fgText: HTMLInputElement | null = null;
let bgText: HTMLInputElement | null = null;
let fgPick: HTMLInputElement | null = null;
let bgPick: HTMLInputElement | null = null;
let sample: HTMLElement | null = null;
let ratioEl: HTMLElement | null = null;
let outEl: HTMLElement | null = null;
let fixEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountContrast(host: HTMLElement): void {
  fgText = h("input", { type: "text", value: "#a13f6c", maxlength: "9", spellcheck: "false", autocomplete: "off", "aria-label": t("contrast.fg"), "data-field": "fg", onInput: () => sync(fgText, fgPick) });
  bgText = h("input", { type: "text", value: "#fff7fb", maxlength: "9", spellcheck: "false", autocomplete: "off", "aria-label": t("contrast.bg"), "data-field": "bg", onInput: () => sync(bgText, bgPick) });
  fgPick = h("input", { type: "color", value: "#a13f6c", "aria-label": t("contrast.fg"), onInput: () => sync(fgPick, fgText) });
  bgPick = h("input", { type: "color", value: "#fff7fb", "aria-label": t("contrast.bg"), onInput: () => sync(bgPick, bgText) });
  sample = h("div", { class: "contrast-sample" },
    h("p", { class: "contrast-sample-normal" }, t("contrast.sampleNormal")),
    h("p", { class: "contrast-sample-large" }, t("contrast.sampleLarge")),
  );
  ratioEl = h("p", { class: "contrast-ratio", "aria-live": "polite" });
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  fixEl = h("p", { class: "hint" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("contrast.back")),
      h("h1", null, t("contrast.title")),
      h("p", { class: "lede" }, t("contrast.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("contrast.options")),
          h("div", { class: "field" }, h("span", null, t("contrast.fg")), h("div", { class: "row contrast-row" }, fgPick, fgText)),
          h("div", { class: "field" }, h("span", null, t("contrast.bg")), h("div", { class: "row contrast-row" }, bgPick, bgText)),
        ),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn ghost", "data-action": "swap", onClick: () => swap() }, t("contrast.swap")),
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("contrast.copy")),
        ),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("contrast.result")),
        sample,
        ratioEl,
        outEl,
        fixEl,
        h("p", { class: "hint" }, t("contrast.rules", { aa: AA_NORMAL, aaLarge: AA_LARGE, aaa: AAA_NORMAL, aaaLarge: AAA_LARGE, ui: UI_MIN })),
      ),
    ),
  );
  paint();
}

export function unmountContrast(): void {
  fgText = bgText = fgPick = bgPick = null;
  sample = ratioEl = outEl = fixEl = null;
  copyBtn = null;
  last = "";
}

function sync(from: HTMLInputElement | null, to: HTMLInputElement | null): void {
  if (from && to) {
    const rgb = hexToRgb(from.value);
    if (rgb) to.value = rgbToHex(rgb);
  }
  paint();
}

function swap(): void {
  if (!fgText || !bgText || !fgPick || !bgPick) return;
  [fgText.value, bgText.value] = [bgText.value, fgText.value];
  [fgPick.value, bgPick.value] = [bgPick.value, fgPick.value];
  paint();
}

function paint(): void {
  if (!outEl || !ratioEl || !sample || !fixEl || !fgText || !bgText) return;
  const fg = hexToRgb(fgText.value);
  const bg = hexToRgb(bgText.value);
  outEl.replaceChildren();
  fixEl.textContent = "";
  if (!fg || !bg) {
    last = "";
    ratioEl.textContent = "";
    outEl.append(h("p", { class: "muted" }, t("contrast.invalid")));
    return;
  }
  sample.style.color = rgbToHex(fg);
  sample.style.background = rgbToHex(bg);
  const lv = contrastLevels(fg, bg);
  const ratio = `${(Math.floor(lv.ratio * 100) / 100).toFixed(2)}:1`;
  ratioEl.textContent = ratio;
  const pass = t("contrast.pass");
  const fail = t("contrast.fail");
  const rows: Array<[string, string]> = [
    [t("contrast.aaNormal"), lv.aaNormal ? pass : fail],
    [t("contrast.aaLarge"), lv.aaLarge ? pass : fail],
    [t("contrast.aaaNormal"), lv.aaaNormal ? pass : fail],
    [t("contrast.aaaLarge"), lv.aaaLarge ? pass : fail],
    [t("contrast.ui"), lv.ui ? pass : fail],
  ];
  for (const [k, v] of rows) outEl.append(h("dt", null, k), h("dd", { class: v === pass ? "contrast-pass" : "contrast-fail" }, v));
  let fixLine = "";
  if (!lv.aaNormal) {
    const better = suggestForeground(fg, bg, AA_NORMAL);
    fixLine = better ? t("contrast.suggest", { hex: rgbToHex(better) }) : t("contrast.noFix");
    fixEl.textContent = fixLine;
  }
  last = [`${rgbToHex(fg)} on ${rgbToHex(bg)}: ${ratio}`, ...rows.map(([k, v]) => `${k}: ${v}`), fixLine].filter(Boolean).join("\n");
}

async function copyOut(): Promise<void> {
  await copyWithFlash(copyBtn, last, { done: t("contrast.copied"), failed: t("contrast.copyFailed") });
}
