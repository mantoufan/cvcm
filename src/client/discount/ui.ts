import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { discountOf, money } from "../../shared/discount";

let priceEl: HTMLInputElement | null = null;
let pctEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountDiscount(host: HTMLElement): void {
  priceEl = h("input", { type: "number", min: "0", step: "0.01", value: "80", onInput: () => paint() });
  pctEl = h("input", { type: "number", step: "0.5", value: "25", onInput: () => paint() });
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("discount.back")),
      h("h1", null, t("discount.title")),
      h("p", { class: "lede" }, t("discount.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("discount.options")),
          labeled(t("discount.price"), priceEl),
          labeled(t("discount.pct"), pctEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("discount.copy")),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("discount.result")), outEl),
    ),
  );
  paint();
}

export function unmountDiscount(): void {
  priceEl = null;
  pctEl = null;
  outEl = null;
  copyBtn = null;
  last = "";
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function paint(): void {
  if (!priceEl || !pctEl || !outEl) return;
  const out = discountOf(Number(priceEl.value), Number(pctEl.value));
  outEl.replaceChildren();
  if (!out) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("discount.invalid")));
    return;
  }
  const rows = [
    [t("discount.sale"), money(out.sale)],
    [t("discount.saved"), money(out.saved)],
  ];
  last = rows.map((r) => `${r[0]}: ${r[1]}`).join("\n");
  for (const [label, value] of rows) outEl.append(h("dt", null, label), h("dd", null, value));
}

async function copyOut(): Promise<void> {
  if (!last) return;
  try {
    await navigator.clipboard.writeText(last);
    if (copyBtn) copyBtn.textContent = t("discount.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("discount.copy");
    }, 1200);
  } catch { /* ignore */ }
}
