import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import {
  COMMON_ZONES,
  convertWallTime,
  formatInZone,
  guessTimeZone,
  listTimeZones,
} from "../../shared/timezone";

const ZONES = listTimeZones();

let fromEl: HTMLSelectElement | null = null;
let toEl: HTMLSelectElement | null = null;
let whenEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let isoEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;

export function mountTimezone(host: HTMLElement): void {
  const local = guessTimeZone();
  fromEl = zoneSelect(local);
  toEl = zoneSelect("UTC");
  whenEl = h("input", {
    type: "datetime-local",
    step: "1",
    onInput: () => paint(),
  });
  fromEl.addEventListener("change", () => paint());
  toEl.addEventListener("change", () => paint());
  outEl = h("p", { class: "timezone-out" });
  isoEl = h("p", { class: "muted" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("timezone.back")),
      h("h1", null, t("timezone.title")),
      h("p", { class: "lede" }, t("timezone.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("timezone.options")),
          labeled(t("timezone.from"), fromEl),
          labeled(t("timezone.to"), toEl),
          labeled(t("timezone.when"), whenEl),
        ),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn ghost", onClick: () => useNow() }, t("timezone.now")),
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyIso() }, t("timezone.copy")),
        ),
      ),
      h("div", { class: "rail timezone-stage" },
        h("h2", null, t("timezone.result")),
        outEl,
        isoEl,
      ),
    ),
  );
  useNow();
}

export function unmountTimezone(): void {
  fromEl = null;
  toEl = null;
  whenEl = null;
  outEl = null;
  isoEl = null;
  copyBtn = null;
}

function zoneSelect(selected: string): HTMLSelectElement {
  const value = ZONES.includes(selected) ? selected : "UTC";
  const common = new Set<string>(COMMON_ZONES);
  const sel = h("select");
  const g1 = document.createElement("optgroup");
  g1.label = t("timezone.common");
  for (const z of COMMON_ZONES) {
    if (!ZONES.includes(z)) continue;
    g1.append(h("option", { value: z, selected: z === value }, z.replace(/_/g, " ")));
  }
  const g2 = document.createElement("optgroup");
  g2.label = t("timezone.all");
  for (const z of ZONES) {
    if (common.has(z)) continue;
    g2.append(h("option", { value: z, selected: z === value }, z.replace(/_/g, " ")));
  }
  sel.append(g1, g2);
  return sel;
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function useNow(): void {
  if (!whenEl || !fromEl) return;
  const now = new Date();
  const stamp = formatInZone(now, fromEl.value).replace(" ", "T");
  whenEl.value = stamp.slice(0, 19);
  paint();
}

function paint(): void {
  if (!fromEl || !toEl || !whenEl || !outEl || !isoEl) return;
  const raw = whenEl.value;
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) {
    outEl.textContent = t("timezone.needTime");
    isoEl.textContent = "";
    return;
  }
  const converted = convertWallTime(
    Number(m[1]), Number(m[2]), Number(m[3]),
    Number(m[4]), Number(m[5]), Number(m[6] || "0"),
    fromEl.value, toEl.value,
  );
  outEl.textContent = `${converted.formatted} (${converted.offset})`;
  isoEl.textContent = converted.iso;
}

async function copyIso(): Promise<void> {
  if (!isoEl?.textContent) return;
  try {
    await navigator.clipboard.writeText(isoEl.textContent);
    if (copyBtn) copyBtn.textContent = t("timezone.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("timezone.copy");
    }, 1200);
  } catch { /* ignore */ }
}
