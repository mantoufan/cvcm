import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { generateUuids } from "../../shared/uuid";

const state = {
  count: 5,
  hyphens: true,
  upper: false,
  items: [] as string[],
};

let listEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;

export function mountUuid(host: HTMLElement): void {
  listEl = h("ol", { class: "name-list uuid-list" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("uuid.back")),
      h("h1", null, t("uuid.title")),
      h("p", { class: "lede" }, t("uuid.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("uuid.options")),
          labeled(t("uuid.count"),
            h("input", {
              type: "range",
              min: "1",
              max: "20",
              step: "1",
              value: String(state.count),
              onInput: (e: Event) => {
                state.count = Number((e.target as HTMLInputElement).value);
                refresh();
              },
            }),
          ),
          h("label", { class: "check" },
            h("input", {
              type: "checkbox",
              checked: true,
              onChange: (e: Event) => {
                state.hyphens = (e.target as HTMLInputElement).checked;
                refresh();
              },
            }),
            h("span", null, t("uuid.hyphens")),
          ),
          h("label", { class: "check" },
            h("input", {
              type: "checkbox",
              onChange: (e: Event) => {
                state.upper = (e.target as HTMLInputElement).checked;
                refresh();
              },
            }),
            h("span", null, t("uuid.upper")),
          ),
        ),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", onClick: () => refresh() }, t("uuid.generate")),
          copyBtn = h("button", { type: "button", class: "btn ghost", onClick: () => void copyAll() }, t("uuid.copy")),
        ),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("uuid.output")),
        listEl,
      ),
    ),
  );
  refresh();
}

export function unmountUuid(): void {
  listEl = null;
  copyBtn = null;
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function refresh(): void {
  state.items = generateUuids(state.count, state.hyphens, state.upper);
  if (!listEl) return;
  listEl.replaceChildren(...state.items.map((id) => h("li", null, id)));
}

async function copyAll(): Promise<void> {
  try {
    await navigator.clipboard.writeText(state.items.join("\n"));
    if (copyBtn) copyBtn.textContent = t("uuid.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("uuid.copy");
    }, 1200);
  } catch { /* ignore */ }
}
