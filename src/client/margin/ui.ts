import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { money } from "../../shared/discount";
import { marginOf } from "../../shared/margin";

let costEl: HTMLInputElement | null = null;
let priceEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountMargin(host: HTMLElement): void {
  costEl = h("input", { type: "number", min: "0", step: "0.01", "data-field": "cost", value: "50", onInput: () => paint() });
  priceEl = h("input", { type: "number", min: "0", step: "0.01", "data-field": "price", value: "80", onInput: () => paint() });
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("margin.back")),
      h("h1", null, t("margin.title")),
      h("p", { class: "lede" }, t("margin.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("margin.options")),
          labeled(t("margin.cost"), costEl),
          labeled(t("margin.price"), priceEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("margin.copy")),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("margin.result")), outEl),
    ),
  );
  paint();
}

export function unmountMargin(): void {
  costEl = null;
  priceEl = null;
  outEl = null;
  copyBtn = null;
  last = "";
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function pct(value: number | null): string {
  return value == null ? t("margin.none") : `${value.toFixed(2)}%`;
}

function paint(): void {
  if (!costEl || !priceEl || !outEl) return;
  const blank = costEl.value.trim() === "" || priceEl.value.trim() === "";
  const out = blank ? null : marginOf(Number(costEl.value), Number(priceEl.value));
  outEl.replaceChildren();
  if (!out) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("margin.invalid")));
    return;
  }
  const rows = [
    [t("margin.profit"), money(out.profit)],
    [t("margin.margin"), pct(out.marginPct)],
    [t("margin.markup"), pct(out.markupPct)],
  ];
  last = rows.map((row) => `${row[0]}: ${row[1]}`).join("\n");
  for (const [label, value] of rows) outEl.append(h("dt", null, label), h("dd", null, value));
}

async function copyOut(): Promise<void> {
  if (!last) return;
  try {
    await navigator.clipboard.writeText(last);
    if (copyBtn) copyBtn.textContent = t("margin.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("margin.copy");
    }, 1200);
  } catch { /* ignore */ }
}
