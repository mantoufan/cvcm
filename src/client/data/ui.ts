import { convertData, extForMode, type DataMode } from "../../shared/data-convert";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";

const MODES: DataMode[] = [
  "json-pretty",
  "json-minify",
  "csv-json",
  "json-csv",
  "base64-encode",
  "base64-decode",
  "url-encode",
  "url-decode",
  "md-html",
  "html-md",
];

let inputEl: HTMLTextAreaElement | null = null;
let outputEl: HTMLTextAreaElement | null = null;
let statusEl: HTMLElement | null = null;
let mode: DataMode = "json-pretty";

export function mountData(host: HTMLElement): void {
  inputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    "aria-label": t("data.input"),
    placeholder: t("data.placeholder"),
  });
  outputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    readonly: true,
    "aria-label": t("data.output"),
  });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  const input = h("input", {
    type: "file",
    class: "sr-only",
    id: "data-file-input",
    accept: ".json,.csv,.txt,.md,.html,.htm,.xml",
    onChange: (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void loadFile(file);
      (e.target as HTMLInputElement).value = "";
    },
  });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("data.back")),
      h("h1", null, t("data.title")),
      h("p", { class: "lede" }, t("data.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("data.mode")),
          h("select", {
            onChange: (e: Event) => {
              mode = (e.target as HTMLSelectElement).value as DataMode;
            },
          },
            ...MODES.map((id) => h("option", { value: id, selected: id === mode }, t(`data.modes.${id}`))),
          ),
        ),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", onClick: () => run() }, t("data.run")),
          h("button", { type: "button", class: "btn ghost", onClick: () => download() }, t("data.download")),
          h("label", { class: "btn ghost", for: "data-file-input" }, t("data.openFile"), input),
        ),
        statusEl,
      ),
      h("div", { class: "data-panes" },
        h("div", { class: "rail" }, h("h2", null, t("data.input")), inputEl),
        h("div", { class: "rail" }, h("h2", null, t("data.output")), outputEl),
      ),
    ),
  );
  inputEl.focus();
}

export function unmountData(): void {
  inputEl = null;
  outputEl = null;
  statusEl = null;
}

function run(): void {
  if (!inputEl || !outputEl) return;
  try {
    outputEl.value = convertData(mode, inputEl.value);
    if (statusEl) statusEl.textContent = "";
  } catch {
    if (statusEl) statusEl.textContent = t("data.error");
  }
}

function download(): void {
  if (!outputEl) return;
  if (!outputEl.value) {
    run();
    if (!outputEl.value) return;
  }
  const mime = extForMode(mode) === "json"
    ? "application/json"
    : extForMode(mode) === "html"
      ? "text/html"
      : "text/plain";
  downloadBlob(new Blob([outputEl.value], { type: `${mime};charset=utf-8` }), `cvcm-data.${extForMode(mode)}`);
}

async function loadFile(file: File): Promise<void> {
  if (!inputEl) return;
  inputEl.value = await file.text();
  if (statusEl) statusEl.textContent = "";
}
