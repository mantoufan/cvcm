import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { jsonToYaml, yamlToJson } from "../../shared/yaml-json";
import { debounce } from "../session";

type Mode = "yaml-json" | "json-yaml";

let inputEl: HTMLTextAreaElement | null = null;
let outputEl: HTMLTextAreaElement | null = null;
let statusEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let mode: Mode = "yaml-json";
const schedule = debounce(() => run(), 80);

export function mountYamlJson(host: HTMLElement): void {
  inputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    "aria-label": t("yamlJson.input"),
    placeholder: t("yamlJson.placeholder"),
    onInput: () => schedule(),
  });
  outputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    readonly: true,
    "aria-label": t("yamlJson.output"),
  });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("yamlJson.back")),
      h("h1", null, t("yamlJson.title")),
      h("p", { class: "lede" }, t("yamlJson.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("yamlJson.options")),
          h("select", {
            onChange: (e: Event) => {
              mode = (e.target as HTMLSelectElement).value as Mode;
              run();
            },
          },
            h("option", { value: "yaml-json", selected: true }, t("yamlJson.yamlJson")),
            h("option", { value: "json-yaml" }, t("yamlJson.jsonYaml")),
          ),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("yamlJson.copy")),
        ),
        statusEl,
      ),
      h("div", { class: "data-panes" },
        h("div", { class: "rail" }, h("h2", null, t("yamlJson.input")), inputEl),
        h("div", { class: "rail" }, h("h2", null, t("yamlJson.output")), outputEl),
      ),
    ),
  );
  inputEl.value = "note:\n  to: cv.cm\n  n: 2\n";
  run();
  inputEl.focus();
}

export function unmountYamlJson(): void {
  inputEl = null;
  outputEl = null;
  statusEl = null;
  copyBtn = null;
}

function run(): void {
  if (!inputEl || !outputEl || !statusEl) return;
  const text = inputEl.value;
  if (!text.trim()) {
    outputEl.value = "";
    statusEl.textContent = t("yamlJson.empty");
    return;
  }
  try {
    if (mode === "yaml-json") outputEl.value = JSON.stringify(yamlToJson(text), null, 2);
    else outputEl.value = jsonToYaml(JSON.parse(text));
    statusEl.textContent = "";
  } catch {
    outputEl.value = "";
    statusEl.textContent = t("yamlJson.invalid");
  }
}

async function copyOut(): Promise<void> {
  if (!outputEl?.value) return;
  try {
    await navigator.clipboard.writeText(outputEl.value);
    if (copyBtn) copyBtn.textContent = t("yamlJson.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("yamlJson.copy");
    }, 1200);
  } catch { /* ignore */ }
}
