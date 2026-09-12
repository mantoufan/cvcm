import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { charsetFor, entropyBits, generatePassword, type PasswordOpts } from "../../shared/password";

const state: PasswordOpts = {
  length: 16,
  lower: true,
  upper: true,
  digits: true,
  symbols: true,
  excludeSimilar: true,
};

let outputEl: HTMLInputElement | null = null;
let metaEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;

export function mountPassword(host: HTMLElement): void {
  outputEl = h("input", {
    class: "password-out",
    readonly: true,
    spellcheck: "false",
    "aria-label": t("password.output"),
  });
  metaEl = h("p", { class: "hint" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("password.back")),
      h("h1", null, t("password.title")),
      h("p", { class: "lede" }, t("password.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("password.options")),
          labeled(t("password.length"),
            h("input", {
              type: "range",
              min: "8",
              max: "64",
              step: "1",
              value: String(state.length),
              onInput: (e: Event) => {
                state.length = Number((e.target as HTMLInputElement).value);
                refresh();
              },
            }),
          ),
          check("lower", t("password.lower")),
          check("upper", t("password.upper")),
          check("digits", t("password.digits")),
          check("symbols", t("password.symbols")),
          check("excludeSimilar", t("password.excludeSimilar")),
        ),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", onClick: () => refresh(true) }, t("password.generate")),
          copyBtn = h("button", { type: "button", class: "btn ghost", onClick: () => void copyOut() }, t("password.copy")),
        ),
      ),
      h("div", { class: "rail password-stage" },
        h("h2", null, t("password.output")),
        outputEl,
        metaEl,
      ),
    ),
  );
  refresh(true);
}

export function unmountPassword(): void {
  outputEl = null;
  metaEl = null;
  copyBtn = null;
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function check(key: keyof Omit<PasswordOpts, "length">, label: string): HTMLElement {
  return h("label", { class: "check" },
    h("input", {
      type: "checkbox",
      checked: state[key],
      onChange: (e: Event) => {
        const checked = (e.target as HTMLInputElement).checked;
        const next = { ...state, [key]: checked };
        if (!charsetFor(next)) {
          (e.target as HTMLInputElement).checked = true;
          return;
        }
        state[key] = checked;
        refresh(true);
      },
    }),
    label,
  );
}

function refresh(regen = false): void {
  if (!outputEl) return;
  if (regen || !outputEl.value) outputEl.value = generatePassword(state);
  const set = charsetFor(state);
  const bits = entropyBits(state.length, set.length);
  if (metaEl) {
    metaEl.textContent = t("password.meta", {
      length: state.length,
      bits: bits.toFixed(0),
    });
  }
}

async function copyOut(): Promise<void> {
  if (!outputEl?.value) refresh(true);
  if (!outputEl?.value) return;
  try {
    await navigator.clipboard.writeText(outputEl.value);
    if (copyBtn) copyBtn.textContent = t("password.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("password.copy");
    }, 1200);
  } catch { /* ignore */ }
}
