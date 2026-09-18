import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { compoundGrowth } from "../../shared/compound";
import { money } from "../../shared/discount";

let principalEl: HTMLInputElement | null = null;
let rateEl: HTMLInputElement | null = null;
let yearsEl: HTMLInputElement | null = null;
let freqEl: HTMLSelectElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountCompound(host: HTMLElement): void {
  principalEl = h("input", { type: "number", min: "0", step: "100", value: "1000", onInput: () => paint() });
  rateEl = h("input", { type: "number", step: "0.01", value: "5", onInput: () => paint() });
  yearsEl = h("input", { type: "number", min: "0", step: "1", value: "10", onInput: () => paint() });
  freqEl = h("select", { onChange: () => paint() },
    h("option", { value: "1" }, t("compound.yearly")),
    h("option", { value: "4" }, t("compound.quarterly")),
    h("option", { value: "12", selected: true }, t("compound.monthly")),
    h("option", { value: "365" }, t("compound.daily")),
  );
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("compound.back")),
      h("h1", null, t("compound.title")),
      h("p", { class: "lede" }, t("compound.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("compound.options")),
          labeled(t("compound.principal"), principalEl),
          labeled(t("compound.rate"), rateEl),
          labeled(t("compound.years"), yearsEl),
          labeled(t("compound.freq"), freqEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("compound.copy")),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("compound.result")), outEl),
    ),
  );
  paint();
}

export function unmountCompound(): void {
  principalEl = null;
  rateEl = null;
  yearsEl = null;
  freqEl = null;
  outEl = null;
  copyBtn = null;
  last = "";
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function paint(): void {
  if (!principalEl || !rateEl || !yearsEl || !freqEl || !outEl) return;
  const out = compoundGrowth(
    Number(principalEl.value),
    Number(rateEl.value),
    Number(yearsEl.value),
    Number(freqEl.value),
  );
  outEl.replaceChildren();
  if (!out) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("compound.invalid")));
    return;
  }
  const rows = [
    [t("compound.future"), money(out.future)],
    [t("compound.interest"), money(out.interest)],
  ];
  last = rows.map((r) => `${r[0]}: ${r[1]}`).join("\n");
  for (const [label, value] of rows) outEl.append(h("dt", null, label), h("dd", null, value));
}

async function copyOut(): Promise<void> {
  if (!last) return;
  try {
    await navigator.clipboard.writeText(last);
    if (copyBtn) copyBtn.textContent = t("compound.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("compound.copy");
    }, 1200);
  } catch { /* ignore */ }
}
