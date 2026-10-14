import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { chmodCommand, parseOctal, parseSymbolic, toOctal, toSymbolic } from "../../shared/chmod";

const WHO = ["owner", "group", "others"] as const;
const PERMS = [["read", 4], ["write", 2], ["exec", 1]] as const;
const SPECIAL = [["setuid", 0o4000], ["setgid", 0o2000], ["sticky", 0o1000]] as const;

let mode = 0o755;
let boxes: Array<{ el: HTMLInputElement; bit: number }> = [];
let octalEl: HTMLInputElement | null = null;
let symbolicEl: HTMLInputElement | null = null;
let fileEl: HTMLInputElement | null = null;
let recursiveEl: HTMLInputElement | null = null;
let cmdEl: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;

export function mountChmod(host: HTMLElement): void {
  mode = 0o755;
  boxes = [];
  const box = (bit: number, label: string) => {
    const el = h("input", { type: "checkbox", "aria-label": label, "data-bit": bit.toString(8), onChange: () => fromBoxes() });
    boxes.push({ el, bit });
    return el;
  };
  const table = h("table", { class: "perm-grid" },
    h("thead", null,
      h("tr", null, h("th", null, ""), ...PERMS.map(([p]) => h("th", { scope: "col" }, t(`chmod.${p}`)))),
    ),
    h("tbody", null,
      ...WHO.map((who, row) =>
        h("tr", null,
          h("th", { scope: "row" }, t(`chmod.${who}`)),
          ...PERMS.map(([p, v]) => h("td", null, box(v << (6 - row * 3), `${t(`chmod.${who}`)} · ${t(`chmod.${p}`)}`))),
        ),
      ),
    ),
  );
  const specials = h("div", { class: "regex-flags" },
    ...SPECIAL.map(([s, bit]) => h("label", { class: "check" }, box(bit, t(`chmod.${s}`)), t(`chmod.${s}`))),
  );
  const text = (field: string, onInput: () => void) =>
    h("input", { type: "text", spellcheck: "false", autocapitalize: "off", autocomplete: "off", "data-field": field, class: "regex-pattern", onInput });
  octalEl = text("octal", fromOctal);
  octalEl.inputMode = "numeric";
  symbolicEl = text("symbolic", fromSymbolic);
  fileEl = h("input", { type: "text", spellcheck: "false", autocapitalize: "off", "data-field": "file", value: "script.sh", onInput: () => paintCommand() });
  recursiveEl = h("input", { type: "checkbox", onChange: () => paintCommand() });
  cmdEl = h("code", { class: "chmod-cmd" });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("chmod.back")),
      h("h1", null, t("chmod.title")),
      h("p", { class: "lede" }, t("chmod.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("div", { class: "data-panes" },
        h("section", { class: "rail controls" },
          h("fieldset", null, h("legend", null, t("chmod.permissions")), table),
          h("fieldset", null, h("legend", null, t("chmod.special")), specials),
        ),
        h("section", { class: "rail controls" },
          h("fieldset", null,
            h("legend", null, t("chmod.notation")),
            labeled(t("chmod.octal"), octalEl),
            labeled(t("chmod.symbolic"), symbolicEl),
            statusEl,
          ),
          h("fieldset", null,
            h("legend", null, t("chmod.command")),
            labeled(t("chmod.file"), fileEl),
            h("label", { class: "check" }, recursiveEl, t("chmod.recursive")),
            h("pre", { class: "regex-out chmod-out" }, cmdEl),
          ),
          h("div", { class: "stage-actions" },
            copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("chmod.copy")),
          ),
        ),
      ),
    ),
  );
  sync();
}

export function unmountChmod(): void {
  boxes = [];
  octalEl = symbolicEl = fileEl = recursiveEl = null;
  cmdEl = statusEl = null;
  copyBtn = null;
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

/** Paint every view from `mode`, except the field the user is typing in. */
function sync(skip?: HTMLInputElement): void {
  for (const { el, bit } of boxes) el.checked = (mode & bit) !== 0;
  if (octalEl && skip !== octalEl) octalEl.value = toOctal(mode);
  if (symbolicEl && skip !== symbolicEl) symbolicEl.value = toSymbolic(mode);
  if (statusEl) statusEl.textContent = "";
  paintCommand();
}

function fromBoxes(): void {
  mode = boxes.reduce((m, { el, bit }) => (el.checked ? m | bit : m), 0);
  sync();
}

function fromOctal(): void {
  if (!octalEl) return;
  const next = parseOctal(octalEl.value);
  if (next == null) {
    if (statusEl) statusEl.textContent = t("chmod.badOctal");
    return;
  }
  mode = next;
  sync(octalEl);
}

function fromSymbolic(): void {
  if (!symbolicEl) return;
  const next = parseSymbolic(symbolicEl.value);
  if (next == null) {
    if (statusEl) statusEl.textContent = t("chmod.badSymbolic");
    return;
  }
  mode = next;
  sync(symbolicEl);
}

function paintCommand(): void {
  if (!cmdEl) return;
  cmdEl.textContent = chmodCommand(mode, fileEl?.value ?? "", recursiveEl?.checked ?? false);
}

async function copyOut(): Promise<void> {
  const text = cmdEl?.textContent ?? "";
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    if (copyBtn) copyBtn.textContent = t("chmod.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("chmod.copy");
    }, 1200);
  } catch { /* ignore */ }
}
