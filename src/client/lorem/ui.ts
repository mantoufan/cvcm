import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { generateLorem, type LoremKind } from "../../shared/lorem";

const state = {
  kind: "paragraphs" as LoremKind,
  count: 3,
};

let outputEl: HTMLTextAreaElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let countEl: HTMLInputElement | null = null;

export function mountLorem(host: HTMLElement): void {
  outputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    readonly: true,
    "aria-label": t("lorem.output"),
  });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("lorem.back")),
      h("h1", null, t("lorem.title")),
      h("p", { class: "lede" }, t("lorem.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("lorem.options")),
          labeled(t("lorem.kind"),
            h("select", {
              onChange: (e: Event) => {
                state.kind = (e.target as HTMLSelectElement).value as LoremKind;
                if (state.kind === "paragraphs") {
                  state.count = 3;
                  if (countEl) { countEl.max = "12"; countEl.value = "3"; }
                } else if (state.kind === "sentences") {
                  state.count = 8;
                  if (countEl) { countEl.max = "30"; countEl.value = "8"; }
                } else {
                  state.count = 50;
                  if (countEl) { countEl.max = "200"; countEl.value = "50"; }
                }
                refresh();
              },
            },
              h("option", { value: "paragraphs", selected: true }, t("lorem.kindParagraphs")),
              h("option", { value: "sentences" }, t("lorem.kindSentences")),
              h("option", { value: "words" }, t("lorem.kindWords")),
            ),
          ),
          labeled(t("lorem.count"),
            countEl = h("input", {
              type: "range",
              min: "1",
              max: "12",
              step: "1",
              value: String(state.count),
              onInput: (e: Event) => {
                state.count = Number((e.target as HTMLInputElement).value);
                refresh();
              },
            }),
          ),
        ),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", onClick: () => refresh() }, t("lorem.generate")),
          copyBtn = h("button", { type: "button", class: "btn ghost", onClick: () => void copyOut() }, t("lorem.copy")),
        ),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("lorem.output")),
        outputEl,
      ),
    ),
  );
  refresh();
}

export function unmountLorem(): void {
  outputEl = null;
  copyBtn = null;
  countEl = null;
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function refresh(): void {
  if (!outputEl) return;
  outputEl.value = generateLorem(state.kind, state.count);
}

async function copyOut(): Promise<void> {
  if (!outputEl) return;
  try {
    await navigator.clipboard.writeText(outputEl.value);
    if (copyBtn) copyBtn.textContent = t("lorem.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("lorem.copy");
    }, 1200);
  } catch { /* ignore */ }
}
