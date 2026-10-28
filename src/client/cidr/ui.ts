import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { rangeToCidrs, subnetOf } from "../../shared/cidr";

let cidrEl: HTMLInputElement | null = null;
let startEl: HTMLInputElement | null = null;
let endEl: HTMLInputElement | null = null;
let subnetOut: HTMLElement | null = null;
let rangeOut: HTMLElement | null = null;
let copySubnetBtn: HTMLButtonElement | null = null;
let copyRangeBtn: HTMLButtonElement | null = null;
let lastSubnet = "";
let lastRange = "";

export function mountCidr(host: HTMLElement): void {
  const text = (field: string, value: string, onInput: () => void) =>
    // Plain text keyboard: a decimal pad has no "/" or space, and shows "," in some locales.
    h("input", { type: "text", spellcheck: "false", autocapitalize: "off", autocorrect: "off", autocomplete: "off", "data-field": field, value, onInput });
  cidrEl = text("cidr", "192.168.1.10/24", paintSubnet);
  startEl = text("start", "10.0.0.5", paintRange);
  endEl = text("end", "10.0.0.20", paintRange);
  subnetOut = h("dl", { class: "stats-grid timestamp-out" });
  rangeOut = h("ul", { class: "uuid-list" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("cidr.back")),
      h("h1", null, t("cidr.title")),
      h("p", { class: "lede" }, t("cidr.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("div", { class: "data-panes" },
        h("section", { class: "rail controls" },
          h("fieldset", null,
            h("legend", null, t("cidr.subnet")),
            labeled(t("cidr.input"), cidrEl),
            h("p", { class: "hint" }, t("cidr.inputHint")),
          ),
          subnetOut,
          h("div", { class: "stage-actions" },
            copySubnetBtn = h("button", { type: "button", class: "btn", onClick: () => void copy(lastSubnet, copySubnetBtn) }, t("cidr.copy")),
          ),
        ),
        h("section", { class: "rail controls" },
          h("fieldset", null,
            h("legend", null, t("cidr.range")),
            labeled(t("cidr.start"), startEl),
            labeled(t("cidr.end"), endEl),
          ),
          rangeOut,
          h("div", { class: "stage-actions" },
            copyRangeBtn = h("button", { type: "button", class: "btn", onClick: () => void copy(lastRange, copyRangeBtn) }, t("cidr.copy")),
          ),
        ),
      ),
    ),
  );
  paintSubnet();
  paintRange();
}

export function unmountCidr(): void {
  cidrEl = startEl = endEl = null;
  subnetOut = rangeOut = null;
  copySubnetBtn = copyRangeBtn = null;
  lastSubnet = lastRange = "";
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function paintSubnet(): void {
  if (!cidrEl || !subnetOut) return;
  const s = subnetOf(cidrEl.value);
  subnetOut.replaceChildren();
  if (!s) {
    lastSubnet = "";
    subnetOut.append(h("p", { class: "muted" }, t("cidr.invalid")));
    return;
  }
  const fmt = new Intl.NumberFormat(locale());
  const rows: Array<[string, string]> = [
    [t("cidr.block"), s.cidr],
    [t("cidr.network"), s.network],
    [t("cidr.broadcast"), s.broadcast],
    [t("cidr.mask"), s.mask],
    [t("cidr.wildcard"), s.wildcard],
    [t("cidr.first"), s.firstHost],
    [t("cidr.last"), s.lastHost],
    [t("cidr.total"), fmt.format(s.total)],
    [t("cidr.usable"), fmt.format(s.usable)],
  ];
  lastSubnet = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
  for (const [k, v] of rows) subnetOut.append(h("dt", null, k), h("dd", null, v));
}

function paintRange(): void {
  if (!startEl || !endEl || !rangeOut) return;
  const list = rangeToCidrs(startEl.value, endEl.value);
  rangeOut.replaceChildren();
  if (!list) {
    lastRange = "";
    rangeOut.append(h("li", { class: "muted" }, t("cidr.rangeInvalid")));
    return;
  }
  lastRange = list.join("\n");
  for (const block of list) rangeOut.append(h("li", null, block));
}

async function copy(text: string, btn: HTMLButtonElement | null): Promise<void> {
  await copyWithFlash(btn, text, { done: t("cidr.copied"), failed: t("cidr.copyFailed") });
}
