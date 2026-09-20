import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { aspectOf } from "../../shared/aspect";

let widthEl: HTMLInputElement | null = null;
let heightEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountAspect(host: HTMLElement): void {
  widthEl = h("input", { type: "number", min: "1", step: "1", value: "1920", onInput: () => paint() });
  heightEl = h("input", { type: "number", min: "1", step: "1", value: "1080", onInput: () => paint() });
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("aspect.back")),
      h("h1", null, t("aspect.title")),
      h("p", { class: "lede" }, t("aspect.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("aspect.options")),
          labeled(t("aspect.width"), widthEl),
          labeled(t("aspect.height"), heightEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("aspect.copy")),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("aspect.result")), outEl),
    ),
  );
  paint();
}

export function unmountAspect(): void {
  widthEl = null;
  heightEl = null;
  outEl = null;
  copyBtn = null;
  last = "";
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function paint(): void {
  if (!widthEl || !heightEl || !outEl) return;
  const out = aspectOf(Number(widthEl.value), Number(heightEl.value));
  outEl.replaceChildren();
  if (!out) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("aspect.invalid")));
    return;
  }
  const rows = [
    [t("aspect.ratio"), out.ratio],
    [t("aspect.decimal"), out.decimal.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")],
  ];
  last = `${out.ratio}`;
  for (const [k, v] of rows) outEl.append(h("dt", null, k), h("dd", null, v));
}

async function copyOut(): Promise<void> {
  if (!last) return;
  try {
    await navigator.clipboard.writeText(last);
    if (copyBtn) copyBtn.textContent = t("aspect.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("aspect.copy");
    }, 1200);
  } catch { /* ignore */ }
}
