import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import {
  DEFAULT_PAIR,
  UNIT_IDS,
  UNIT_KINDS,
  convertUnits,
  isUnitKind,
  unitLabel,
  type UnitKind,
} from "../../shared/units";

let kindEl: HTMLSelectElement | null = null;
let fromEl: HTMLSelectElement | null = null;
let toEl: HTMLSelectElement | null = null;
let valueEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let formulaEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let lastText = "";

export function mountUnits(host: HTMLElement): void {
  kindEl = h("select", { onChange: () => onKind() },
    ...UNIT_KINDS.map((kind) =>
      h("option", { value: kind, selected: kind === "length" }, t(`units.kind.${kind}`)),
    ),
  );
  fromEl = h("select", { onChange: () => paint() });
  toEl = h("select", { onChange: () => paint() });
  valueEl = h("input", {
    type: "text",
    inputmode: "decimal",
    value: "1",
    "aria-label": t("units.value"),
    onInput: () => paint(),
  });
  outEl = h("p", { class: "timezone-out" });
  formulaEl = h("p", { class: "muted" });
  fillUnits("length");
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("units.back")),
      h("h1", null, t("units.title")),
      h("p", { class: "lede" }, t("units.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("units.options")),
          labeled(t("units.kindLabel"), kindEl),
          labeled(t("units.value"), valueEl),
          labeled(t("units.from"), fromEl),
          labeled(t("units.to"), toEl),
        ),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn ghost", onClick: () => swap() }, t("units.swap")),
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("units.copy")),
        ),
      ),
      h("div", { class: "rail timezone-stage" },
        h("h2", null, t("units.result")),
        outEl,
        formulaEl,
      ),
    ),
  );
  paint();
}

export function unmountUnits(): void {
  kindEl = null;
  fromEl = null;
  toEl = null;
  valueEl = null;
  outEl = null;
  formulaEl = null;
  copyBtn = null;
  lastText = "";
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function currentKind(): UnitKind {
  const raw = kindEl?.value ?? "length";
  return isUnitKind(raw) ? raw : "length";
}

function fillUnits(kind: UnitKind): void {
  if (!fromEl || !toEl) return;
  fromEl.replaceChildren();
  toEl.replaceChildren();
  const ids = UNIT_IDS[kind];
  const [from, to] = DEFAULT_PAIR[kind];
  for (const id of ids) {
    fromEl.append(h("option", { value: id, selected: id === from }, unitLabel(id)));
    toEl.append(h("option", { value: id, selected: id === to }, unitLabel(id)));
  }
}

function onKind(): void {
  fillUnits(currentKind());
  if (valueEl) valueEl.value = "1";
  paint();
}

function swap(): void {
  if (!fromEl || !toEl || !valueEl || !outEl) return;
  const previous = lastText;
  const from = fromEl.value;
  fromEl.value = toEl.value;
  toEl.value = from;
  if (previous) valueEl.value = previous;
  paint();
}

function parseValue(raw: string): number {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return NaN;
  return Number(trimmed);
}

function paint(): void {
  if (!fromEl || !toEl || !valueEl || !outEl || !formulaEl) return;
  const value = parseValue(valueEl.value);
  const converted = convertUnits(currentKind(), value, fromEl.value, toEl.value);
  if (!Number.isFinite(converted.value)) {
    outEl.textContent = t("units.invalid");
    formulaEl.textContent = "";
    lastText = "";
    return;
  }
  lastText = converted.formatted;
  outEl.textContent = `${converted.formatted} ${converted.label}`;
  formulaEl.textContent = converted.formula;
}

async function copyOut(): Promise<void> {
  if (!outEl?.textContent) return;
  try {
    await navigator.clipboard.writeText(outEl.textContent);
    if (copyBtn) copyBtn.textContent = t("units.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("units.copy");
    }, 1200);
  } catch { /* ignore */ }
}
