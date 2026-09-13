import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { generateNames, type NameKind } from "../../shared/names";

const state = {
  kind: "person" as NameKind,
  count: 10,
  items: [] as string[],
};

let listEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;

export function mountNames(host: HTMLElement): void {
  listEl = h("ol", { class: "name-list" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("names.back")),
      h("h1", null, t("names.title")),
      h("p", { class: "lede" }, t("names.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("names.options")),
          labeled(t("names.kind"),
            h("select", {
              onChange: (e: Event) => {
                state.kind = (e.target as HTMLSelectElement).value as NameKind;
                refresh();
              },
            },
              h("option", { value: "person", selected: true }, t("names.kindPerson")),
              h("option", { value: "username" }, t("names.kindUser")),
            ),
          ),
          labeled(t("names.count"),
            h("input", {
              type: "range",
              min: "5",
              max: "20",
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
          h("button", { type: "button", class: "btn", onClick: () => refresh() }, t("names.generate")),
          copyBtn = h("button", { type: "button", class: "btn ghost", onClick: () => void copyAll() }, t("names.copy")),
        ),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("names.output")),
        listEl,
      ),
    ),
  );
  refresh();
}

export function unmountNames(): void {
  listEl = null;
  copyBtn = null;
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function refresh(): void {
  state.items = generateNames(state.kind, state.count);
  if (!listEl) return;
  listEl.replaceChildren(...state.items.map((name) => h("li", null, name)));
}

async function copyAll(): Promise<void> {
  if (!state.items.length) refresh();
  try {
    await navigator.clipboard.writeText(state.items.join("\n"));
    if (copyBtn) copyBtn.textContent = t("names.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("names.copy");
    }, 1200);
  } catch { /* ignore */ }
}
