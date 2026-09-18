import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { money } from "../../shared/discount";
import { vatOf } from "../../shared/vat";

let amountEl: HTMLInputElement | null = null;
let rateEl: HTMLInputElement | null = null;
let modeEl: HTMLSelectElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountVat(host: HTMLElement): void {
  amountEl = h("input", { type: "number", min: "0", step: "0.01", value: "100", onInput: () => paint() });
  rateEl = h("input", { type: "number", min: "0", step: "0.1", value: "20", onInput: () => paint() });
  modeEl = h("select", { onChange: () => paint() },
    h("option", { value: "exclusive", selected: true }, t("vat.exclusive")),
    h("option", { value: "inclusive" }, t("vat.inclusive")),
  );
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("vat.back")),
      h("h1", null, t("vat.title")),
      h("p", { class: "lede" }, t("vat.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("vat.options")),
          labeled(t("vat.amount"), amountEl),
          labeled(t("vat.rate"), rateEl),
          labeled(t("vat.mode"), modeEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("vat.copy")),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("vat.result")), outEl),
    ),
  );
  paint();
}

export function unmountVat(): void {
  amountEl = null;
  rateEl = null;
  modeEl = null;
  outEl = null;
  copyBtn = null;
  last = "";
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function paint(): void {
  if (!amountEl || !rateEl || !modeEl || !outEl) return;
  const out = vatOf(Number(amountEl.value), Number(rateEl.value), modeEl.value === "inclusive");
  outEl.replaceChildren();
  if (!out) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("vat.invalid")));
    return;
  }
  const rows = [
    [t("vat.net"), money(out.net)],
    [t("vat.tax"), money(out.tax)],
    [t("vat.gross"), money(out.gross)],
  ];
  last = rows.map((r) => `${r[0]}: ${r[1]}`).join("\n");
  for (const [label, value] of rows) outEl.append(h("dt", null, label), h("dd", null, value));
}

async function copyOut(): Promise<void> {
  if (!last) return;
  try {
    await navigator.clipboard.writeText(last);
    if (copyBtn) copyBtn.textContent = t("vat.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("vat.copy");
    }, 1200);
  } catch { /* ignore */ }
}
