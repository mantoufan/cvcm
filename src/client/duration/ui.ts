import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { durationBetween } from "../../shared/duration";

let aEl: HTMLInputElement | null = null;
let bEl: HTMLInputElement | null = null;
let modeEl: HTMLSelectElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountDuration(host: HTMLElement): void {
  aEl = h("input", { type: "text", spellcheck: "false", "data-field": "a", value: "1:30:00", onInput: () => paint() });
  bEl = h("input", { type: "text", spellcheck: "false", "data-field": "b", value: "0:45:00", onInput: () => paint() });
  modeEl = h("select", { "data-field": "mode", onChange: () => paint() },
    h("option", { value: "add", selected: true }, t("duration.add")),
    h("option", { value: "subtract" }, t("duration.subtract")),
  );
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("duration.back")),
      h("h1", null, t("duration.title")),
      h("p", { class: "lede" }, t("duration.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("duration.options")),
          labeled(t("duration.a"), aEl),
          labeled(t("duration.b"), bEl),
          labeled(t("duration.mode"), modeEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("duration.copy")),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("duration.result")), outEl),
    ),
  );
  paint();
}

export function unmountDuration(): void {
  aEl = null;
  bEl = null;
  modeEl = null;
  outEl = null;
  copyBtn = null;
  last = "";
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function paint(): void {
  if (!aEl || !bEl || !modeEl || !outEl) return;
  const out = durationBetween(aEl.value, bEl.value, modeEl.value === "subtract");
  outEl.replaceChildren();
  if (!out) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("duration.invalid")));
    return;
  }
  const rows = [
    [t("duration.clock"), out.text],
    [t("duration.total"), String(out.totalSeconds)],
  ];
  last = rows.map((row) => `${row[0]}: ${row[1]}`).join("\n");
  for (const [label, value] of rows) outEl.append(h("dt", null, label), h("dd", null, value));
}

async function copyOut(): Promise<void> {
  if (!last) return;
  try {
    await navigator.clipboard.writeText(last);
    if (copyBtn) copyBtn.textContent = t("duration.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("duration.copy");
    }, 1200);
  } catch { /* ignore */ }
}
