import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { jsonToXml, xmlToJson } from "../../shared/xml-json";
import { debounce } from "../session";

type Mode = "xml-json" | "json-xml";

let inputEl: HTMLTextAreaElement | null = null;
let outputEl: HTMLTextAreaElement | null = null;
let statusEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let mode: Mode = "xml-json";
const schedule = debounce(() => run(), 80);

export function mountXmlJson(host: HTMLElement): void {
  inputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    "aria-label": t("xmlJson.input"),
    placeholder: t("xmlJson.placeholder"),
    onInput: () => schedule(),
  });
  outputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    readonly: true,
    "aria-label": t("xmlJson.output"),
  });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("xmlJson.back")),
      h("h1", null, t("xmlJson.title")),
      h("p", { class: "lede" }, t("xmlJson.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("xmlJson.options")),
          h("select", {
            onChange: (e: Event) => {
              mode = (e.target as HTMLSelectElement).value as Mode;
              run();
            },
          },
            h("option", { value: "xml-json", selected: true }, t("xmlJson.xmlJson")),
            h("option", { value: "json-xml" }, t("xmlJson.jsonXml")),
          ),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("xmlJson.copy")),
        ),
        statusEl,
      ),
      h("div", { class: "data-panes" },
        h("div", { class: "rail" }, h("h2", null, t("xmlJson.input")), inputEl),
        h("div", { class: "rail" }, h("h2", null, t("xmlJson.output")), outputEl),
      ),
    ),
  );
  inputEl.value = `<note id="1">\n  <to>cv.cm</to>\n  <from>hex</from>\n</note>`;
  run();
  inputEl.focus();
}

export function unmountXmlJson(): void {
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
    statusEl.textContent = t("xmlJson.empty");
    return;
  }
  try {
    if (mode === "xml-json") {
      outputEl.value = JSON.stringify(xmlToJson(text), null, 2);
    } else {
      outputEl.value = jsonToXml(JSON.parse(text));
    }
    statusEl.textContent = "";
  } catch {
    outputEl.value = "";
    statusEl.textContent = t("xmlJson.invalid");
  }
}

async function copyOut(): Promise<void> {
  if (!outputEl?.value) return;
  try {
    await navigator.clipboard.writeText(outputEl.value);
    if (copyBtn) copyBtn.textContent = t("xmlJson.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("xmlJson.copy");
    }, 1200);
  } catch { /* ignore */ }
}
