import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { chmodCommand, parseOctal, parseSymbolic, safeRecursiveCommand, toOctal, toSymbolic } from "../../shared/chmod";

const WHO = ["owner", "group", "others"] as const;
const PERMS = [["read", 4], ["write", 2], ["exec", 1]] as const;
const SPECIAL = [["setuid", 0o4000], ["setgid", 0o2000], ["sticky", 0o1000]] as const;

let mode = 0o755;
let boxes: Array<{ el: HTMLInputElement; bit: number }> = [];
let octalEl: HTMLInputElement | null = null;
let symbolicEl: HTMLInputElement | null = null;
let fileEl: HTMLInputElement | null = null;
let recursiveEl: HTMLInputElement | null = null;
let directoryEl: HTMLInputElement | null = null;
/** Special bits were on earlier in this session; once they go off, the command spells the 0 out to clear them. */
let hadSpecial = false;
let cmdEl: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let safeBox: HTMLElement | null = null;
let safeEl: HTMLElement | null = null;
let safeBtn: HTMLButtonElement | null = null;

export function mountChmod(host: HTMLElement): void {
  mode = 0o755;
  hadSpecial = false;
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
  directoryEl = h("input", { type: "checkbox", onChange: () => paintCommand() });
  cmdEl = h("code", { class: "chmod-cmd" });
  safeEl = h("code", { class: "chmod-safe" });
  safeBox = h("div", { class: "chmod-safe-box", hidden: true },
    h("p", { class: "status" }, t("chmod.recursiveWarn")),
    h("pre", { class: "regex-out chmod-out" }, safeEl),
    h("div", { class: "stage-actions" },
      safeBtn = h("button", { type: "button", class: "btn ghost", onClick: () => void copyWithFlash(safeBtn, safeEl?.textContent ?? "", { done: t("chmod.copied"), failed: t("chmod.copyFailed") }) }, t("chmod.copySafe")),
    ),
  );
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
            h("div", { class: "regex-flags" },
              h("label", { class: "check" }, directoryEl, t("chmod.directory")),
              h("label", { class: "check" }, recursiveEl, t("chmod.recursive")),
            ),
            h("pre", { class: "regex-out chmod-out" }, cmdEl),
            safeBox,
            h("p", { class: "hint" }, t("chmod.dirHint")),
            h("p", { class: "hint" }, t("chmod.quoteHint")),
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
  octalEl = symbolicEl = fileEl = recursiveEl = directoryEl = null;
  hadSpecial = false;
  cmdEl = statusEl = safeBox = safeEl = null;
  safeBtn = null;
  copyBtn = null;
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

/** Paint every view from `mode`, except the field the user is typing in. */
function sync(skip?: HTMLInputElement): void {
  if (mode > 0o777) hadSpecial = true;
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
  cmdEl.textContent = chmodCommand(mode, fileEl?.value ?? "", {
    recursive: recursiveEl?.checked ?? false,
    directory: directoryEl?.checked ?? false,
    clearSpecial: hadSpecial && mode <= 0o777,
  });
  const recursive = recursiveEl?.checked ?? false;
  if (safeBox) safeBox.hidden = !recursive;
  if (safeEl) safeEl.textContent = recursive ? safeRecursiveCommand(mode, fileEl?.value ?? "") : "";
}

async function copyOut(): Promise<void> {
  await copyWithFlash(copyBtn, cmdEl?.textContent ?? "", { done: t("chmod.copied"), failed: t("chmod.copyFailed") });
}
