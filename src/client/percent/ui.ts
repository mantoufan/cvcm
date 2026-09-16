import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { changeByPercent, formatNum, isWhatPercent, percentChange, percentOf } from "../../shared/percent";

let aEl: HTMLInputElement | null = null;
let bEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountPercent(host: HTMLElement): void {
  aEl = num();
  bEl = num();
  aEl.value = "25";
  bEl.value = "200";
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("percent.back")),
      h("h1", null, t("percent.title")),
      h("p", { class: "lede" }, t("percent.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("percent.options")),
          labeled(t("percent.a"), aEl),
          labeled(t("percent.b"), bEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("percent.copy")),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("percent.result")), outEl),
    ),
  );
  paint();
  aEl.focus();
}

export function unmountPercent(): void {
  aEl = null;
  bEl = null;
  outEl = null;
  copyBtn = null;
  last = "";
}

function num(): HTMLInputElement {
  return h("input", {
    type: "number",
    step: "any",
    onInput: () => paint(),
  });
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function paint(): void {
  if (!aEl || !bEl || !outEl) return;
  const a = Number(aEl.value);
  const b = Number(bEl.value);
  const of = percentOf(b, a);
  const what = isWhatPercent(a, b);
  const up = changeByPercent(b, a);
  const delta = percentChange(b, a);
  const rows = [
    [t("percent.of"), `${formatNum(a)}% ${t("percent.ofWord")} ${formatNum(b)} = ${formatNum(of)}`],
    [t("percent.what"), `${formatNum(a)} ${t("percent.is")} ${what == null ? "—" : `${formatNum(what)}%`} ${t("percent.ofWord")} ${formatNum(b)}`],
    [t("percent.plus"), `${formatNum(b)} + ${formatNum(a)}% = ${formatNum(up)}`],
    [t("percent.delta"), `${formatNum(b)} → ${formatNum(a)} = ${delta == null ? "—" : `${formatNum(delta)}%`}`],
  ];
  last = rows.map((r) => r[1]).join("\n");
  outEl.replaceChildren();
  for (const [label, value] of rows) {
    outEl.append(h("dt", null, label), h("dd", null, value));
  }
}

async function copyOut(): Promise<void> {
  if (!last) return;
  try {
    await navigator.clipboard.writeText(last);
    if (copyBtn) copyBtn.textContent = t("percent.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("percent.copy");
    }, 1200);
  } catch { /* ignore */ }
}
