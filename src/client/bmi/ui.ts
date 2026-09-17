import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { bmiBand, bmiFrom } from "../../shared/bmi";

let kgEl: HTMLInputElement | null = null;
let cmEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountBmi(host: HTMLElement): void {
  kgEl = h("input", { type: "number", min: "1", step: "0.1", value: "70", onInput: () => paint() });
  cmEl = h("input", { type: "number", min: "1", step: "0.1", value: "170", onInput: () => paint() });
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("bmi.back")),
      h("h1", null, t("bmi.title")),
      h("p", { class: "lede" }, t("bmi.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("bmi.options")),
          labeled(t("bmi.kg"), kgEl),
          labeled(t("bmi.cm"), cmEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("bmi.copy")),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("bmi.result")), outEl),
    ),
  );
  paint();
}

export function unmountBmi(): void {
  kgEl = null;
  cmEl = null;
  outEl = null;
  copyBtn = null;
  last = "";
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function paint(): void {
  if (!kgEl || !cmEl || !outEl) return;
  const value = bmiFrom(Number(kgEl.value), Number(cmEl.value));
  outEl.replaceChildren();
  if (value == null) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("bmi.invalid")));
    return;
  }
  const shown = value.toFixed(1);
  const band = t(`bmi.${bmiBand(value)}`);
  last = `${shown} · ${band}`;
  outEl.append(
    h("dt", null, t("bmi.value")),
    h("dd", null, shown),
    h("dt", null, t("bmi.band")),
    h("dd", null, band),
  );
}

async function copyOut(): Promise<void> {
  if (!last) return;
  try {
    await navigator.clipboard.writeText(last);
    if (copyBtn) copyBtn.textContent = t("bmi.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("bmi.copy");
    }, 1200);
  } catch { /* ignore */ }
}
