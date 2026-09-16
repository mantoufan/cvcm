import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { HASH_ALGOS, digest, encodeUtf8, toB64, toHex, type HashAlgo } from "../../shared/hash";
import { debounce } from "../session";

let inputEl: HTMLTextAreaElement | null = null;
let hexEl: HTMLInputElement | null = null;
let b64El: HTMLInputElement | null = null;
let statusEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let algo: HashAlgo = "SHA-256";
const schedule = debounce(() => { void run(); }, 80);

export function mountHash(host: HTMLElement): void {
  inputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    "aria-label": t("hash.input"),
    placeholder: t("hash.placeholder"),
    onInput: () => schedule(),
  });
  hexEl = h("input", { class: "regex-pattern", readonly: true, spellcheck: "false", "aria-label": t("hash.hex") });
  b64El = h("input", { class: "regex-pattern", readonly: true, spellcheck: "false", "aria-label": t("hash.b64") });
  statusEl = h("p", { class: "muted" });
  const file = h("input", {
    type: "file",
    class: "sr-only",
    id: "hash-file-input",
    onChange: (e: Event) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) void loadFile(f);
      (e.target as HTMLInputElement).value = "";
    },
  });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("hash.back")),
      h("h1", null, t("hash.title")),
      h("p", { class: "lede" }, t("hash.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("hash.options")),
          labeled(t("hash.algo"),
            h("select", {
              onChange: (e: Event) => {
                algo = (e.target as HTMLSelectElement).value as HashAlgo;
                void run();
              },
            },
              ...HASH_ALGOS.map((id) => h("option", { value: id, selected: id === algo }, id)),
            ),
          ),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("hash.copy")),
          h("label", { class: "btn ghost", for: "hash-file-input" }, t("hash.openFile"), file),
        ),
        statusEl,
      ),
      h("div", { class: "rail" },
        h("h2", null, t("hash.input")),
        inputEl,
        labeled(t("hash.hex"), hexEl),
        labeled(t("hash.b64"), b64El),
      ),
    ),
  );
  void run();
  inputEl.focus();
}

export function unmountHash(): void {
  inputEl = null;
  hexEl = null;
  b64El = null;
  statusEl = null;
  copyBtn = null;
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

async function loadFile(file: File): Promise<void> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (statusEl) statusEl.textContent = t("hash.fileMeta", { name: file.name });
  await writeDigest(bytes);
}

async function run(): Promise<void> {
  if (!inputEl) return;
  if (statusEl) statusEl.textContent = "";
  await writeDigest(encodeUtf8(inputEl.value));
}

async function writeDigest(bytes: Uint8Array): Promise<void> {
  if (!hexEl || !b64El) return;
  try {
    const out = await digest(algo, bytes);
    hexEl.value = toHex(out);
    b64El.value = toB64(out);
  } catch {
    hexEl.value = "";
    b64El.value = "";
    if (statusEl) statusEl.textContent = t("hash.error");
  }
}

async function copyOut(): Promise<void> {
  if (!hexEl?.value) return;
  try {
    await navigator.clipboard.writeText(hexEl.value);
    if (copyBtn) copyBtn.textContent = t("hash.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("hash.copy");
    }, 1200);
  } catch { /* ignore */ }
}
