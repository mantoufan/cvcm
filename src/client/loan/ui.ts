import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { loanPayment } from "../../shared/loan";
import { money } from "../../shared/discount";

let principalEl: HTMLInputElement | null = null;
let rateEl: HTMLInputElement | null = null;
let yearsEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountLoan(host: HTMLElement): void {
  principalEl = h("input", { type: "number", min: "0", step: "100", value: "200000", onInput: () => paint() });
  rateEl = h("input", { type: "number", min: "0", step: "0.01", value: "5", onInput: () => paint() });
  yearsEl = h("input", { type: "number", min: "1", step: "1", value: "30", onInput: () => paint() });
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("loan.back")),
      h("h1", null, t("loan.title")),
      h("p", { class: "lede" }, t("loan.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("loan.options")),
          labeled(t("loan.principal"), principalEl),
          labeled(t("loan.rate"), rateEl),
          labeled(t("loan.years"), yearsEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("loan.copy")),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("loan.result")), outEl),
    ),
  );
  paint();
}

export function unmountLoan(): void {
  principalEl = null;
  rateEl = null;
  yearsEl = null;
  outEl = null;
  copyBtn = null;
  last = "";
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function paint(): void {
  if (!principalEl || !rateEl || !yearsEl || !outEl) return;
  const out = loanPayment(Number(principalEl.value), Number(rateEl.value), Number(yearsEl.value));
  outEl.replaceChildren();
  if (!out) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("loan.invalid")));
    return;
  }
  const rows = [
    [t("loan.payment"), money(out.payment)],
    [t("loan.interest"), money(out.interest)],
    [t("loan.total"), money(out.total)],
  ];
  last = rows.map((r) => `${r[0]}: ${r[1]}`).join("\n");
  for (const [label, value] of rows) outEl.append(h("dt", null, label), h("dd", null, value));
}

async function copyOut(): Promise<void> {
  if (!last) return;
  try {
    await navigator.clipboard.writeText(last);
    if (copyBtn) copyBtn.textContent = t("loan.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("loan.copy");
    }, 1200);
  } catch { /* ignore */ }
}
