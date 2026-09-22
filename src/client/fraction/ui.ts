import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { decimalToFraction, simplifyFraction, type Fraction } from "../../shared/fraction";

let modeEl: HTMLSelectElement | null = null;
let numEl: HTMLInputElement | null = null;
let denEl: HTMLInputElement | null = null;
let decEl: HTMLInputElement | null = null;
let numWrap: HTMLElement | null = null;
let denWrap: HTMLElement | null = null;
let decWrap: HTMLElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountFraction(host: HTMLElement): void {
  modeEl = h("select", { "data-field": "mode", onChange: () => paint() },
    h("option", { value: "simplify", selected: true }, t("fraction.simplify")),
    h("option", { value: "decimal" }, t("fraction.fromDecimal")),
  );
  numEl = h("input", { type: "number", step: "1", "data-field": "num", value: "4", onInput: () => paint() });
  denEl = h("input", { type: "number", step: "1", "data-field": "den", value: "6", onInput: () => paint() });
  decEl = h("input", { type: "number", step: "any", "data-field": "decimal", value: "0.75", onInput: () => paint() });
  numWrap = labeled(t("fraction.numerator"), numEl);
  denWrap = labeled(t("fraction.denominator"), denEl);
  decWrap = labeled(t("fraction.decimal"), decEl);
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("fraction.back")),
      h("h1", null, t("fraction.title")),
      h("p", { class: "lede" }, t("fraction.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("fraction.options")),
          labeled(t("fraction.mode"), modeEl),
          numWrap,
          denWrap,
          decWrap,
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("fraction.copy")),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("fraction.result")), outEl),
    ),
  );
  paint();
}

export function unmountFraction(): void {
  modeEl = null;
  numEl = null;
  denEl = null;
  decEl = null;
  numWrap = null;
  denWrap = null;
  decWrap = null;
  outEl = null;
  copyBtn = null;
  last = "";
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function show(el: HTMLElement | null, on: boolean): void {
  if (el) el.style.display = on ? "" : "none";
}

function readInt(el: HTMLInputElement): number | null {
  if (el.value.trim() === "") return null;
  const n = Number(el.value);
  if (!Number.isInteger(n)) return null;
  return n;
}

function paint(): void {
  if (!modeEl || !numEl || !denEl || !decEl || !outEl) return;
  const decimal = modeEl.value === "decimal";
  show(numWrap, !decimal);
  show(denWrap, !decimal);
  show(decWrap, decimal);
  let out: Fraction | null = null;
  if (decimal) {
    out = decEl.value.trim() === "" ? null : decimalToFraction(Number(decEl.value));
  } else {
    const n = readInt(numEl);
    const d = readInt(denEl);
    out = n == null || d == null ? null : simplifyFraction(n, d);
  }
  outEl.replaceChildren();
  if (!out) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("fraction.invalid")));
    return;
  }
  const rows = [
    [t("fraction.simplified"), out.text],
    [t("fraction.decimalOut"), String(out.decimal)],
  ];
  last = out.text;
  for (const [label, value] of rows) outEl.append(h("dt", null, label), h("dd", null, value));
}

async function copyOut(): Promise<void> {
  if (!last) return;
  try {
    await navigator.clipboard.writeText(last);
    if (copyBtn) copyBtn.textContent = t("fraction.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("fraction.copy");
    }, 1200);
  } catch { /* ignore */ }
}
