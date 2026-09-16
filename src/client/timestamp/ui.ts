import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { parseStamp, toStamp, type Stamp } from "../../shared/timestamp";

let inputEl: HTMLInputElement | null = null;
let nowEl: HTMLElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let timer = 0;
let lastText = "";

export function mountTimestamp(host: HTMLElement): void {
  inputEl = h("input", {
    class: "regex-pattern",
    spellcheck: "false",
    autocapitalize: "off",
    autocomplete: "off",
    "aria-label": t("timestamp.input"),
    placeholder: t("timestamp.placeholder"),
    onInput: () => paint(),
  });
  nowEl = h("p", { class: "muted" });
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("timestamp.back")),
      h("h1", null, t("timestamp.title")),
      h("p", { class: "lede" }, t("timestamp.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("timestamp.options")),
          labeled(t("timestamp.input"), inputEl),
        ),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn ghost", onClick: () => useNow() }, t("timestamp.now")),
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("timestamp.copy")),
        ),
        nowEl,
      ),
      h("div", { class: "rail" },
        h("h2", null, t("timestamp.result")),
        outEl,
      ),
    ),
  );
  tickNow();
  timer = window.setInterval(tickNow, 1000);
  useNow();
  inputEl.focus();
}

export function unmountTimestamp(): void {
  window.clearInterval(timer);
  timer = 0;
  inputEl = null;
  nowEl = null;
  outEl = null;
  copyBtn = null;
  lastText = "";
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function tickNow(): void {
  if (!nowEl) return;
  const stamp = toStamp(Date.now());
  nowEl.textContent = t("timestamp.live", { seconds: stamp.seconds });
}

function useNow(): void {
  if (!inputEl) return;
  inputEl.value = String(Math.trunc(Date.now() / 1000));
  paint();
}

function paint(): void {
  if (!inputEl || !outEl) return;
  const result = parseStamp(inputEl.value);
  outEl.replaceChildren();
  lastText = "";
  if (!result.ok) {
    const key = result.error === "empty" ? "timestamp.empty" : result.error === "range" ? "timestamp.range" : "timestamp.invalid";
    outEl.append(h("p", { class: "muted" }, t(key)));
    return;
  }
  lastText = formatCopy(result.stamp);
  outEl.append(
    row(t("timestamp.seconds"), result.stamp.seconds),
    row(t("timestamp.milliseconds"), result.stamp.milliseconds),
    row(t("timestamp.iso"), result.stamp.iso),
    row(t("timestamp.utc"), result.stamp.utc),
    row(t("timestamp.local"), localTime(result.stamp.ms)),
  );
}

function row(label: string, value: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  frag.append(h("dt", null, label), h("dd", null, value));
  return frag;
}

function localTime(ms: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "full",
      timeStyle: "long",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toString();
  }
}

function formatCopy(stamp: Stamp): string {
  return [stamp.seconds, stamp.milliseconds, stamp.iso, stamp.utc].join("\n");
}

async function copyOut(): Promise<void> {
  if (!lastText) return;
  try {
    await navigator.clipboard.writeText(lastText);
    if (copyBtn) copyBtn.textContent = t("timestamp.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("timestamp.copy");
    }, 1200);
  } catch { /* ignore */ }
}
