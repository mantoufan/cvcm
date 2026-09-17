import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { money, tipSplit } from "../../shared/tip";

let billEl: HTMLInputElement | null = null;
let pctEl: HTMLInputElement | null = null;
let peopleEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountTip(host: HTMLElement): void {
  billEl = h("input", { type: "number", min: "0", step: "0.01", value: "48.50", onInput: () => paint() });
  pctEl = h("input", { type: "number", min: "0", step: "0.5", value: "15", onInput: () => paint() });
  peopleEl = h("input", { type: "number", min: "1", step: "1", value: "2", onInput: () => paint() });
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("tip.back")),
      h("h1", null, t("tip.title")),
      h("p", { class: "lede" }, t("tip.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("tip.options")),
          labeled(t("tip.bill"), billEl),
          labeled(t("tip.pct"), pctEl),
          labeled(t("tip.people"), peopleEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("tip.copy")),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("tip.result")), outEl),
    ),
  );
  paint();
}

export function unmountTip(): void {
  billEl = null;
  pctEl = null;
  peopleEl = null;
  outEl = null;
  copyBtn = null;
  last = "";
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function paint(): void {
  if (!billEl || !pctEl || !peopleEl || !outEl) return;
  const split = tipSplit(Number(billEl.value), Number(pctEl.value), Number(peopleEl.value));
  outEl.replaceChildren();
  if (!split) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("tip.invalid")));
    return;
  }
  const rows = [
    [t("tip.tip"), money(split.tip)],
    [t("tip.total"), money(split.total)],
    [t("tip.each"), money(split.perPerson)],
  ];
  last = rows.map((r) => `${r[0]}: ${r[1]}`).join("\n");
  for (const [label, value] of rows) outEl.append(h("dt", null, label), h("dd", null, value));
}

async function copyOut(): Promise<void> {
  if (!last) return;
  try {
    await navigator.clipboard.writeText(last);
    if (copyBtn) copyBtn.textContent = t("tip.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("tip.copy");
    }, 1200);
  } catch { /* ignore */ }
}
