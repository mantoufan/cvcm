import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { decodeJwt } from "../../shared/jwt";
import { debounce } from "../session";

let inputEl: HTMLTextAreaElement | null = null;
let headerEl: HTMLTextAreaElement | null = null;
let payloadEl: HTMLTextAreaElement | null = null;
let statusEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
const schedule = debounce(() => paint(), 80);

export function mountJwt(host: HTMLElement): void {
  inputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    "aria-label": t("jwt.input"),
    placeholder: t("jwt.placeholder"),
    onInput: () => schedule(),
  });
  headerEl = h("textarea", { class: "clip-input", spellcheck: "false", readonly: true, "aria-label": t("jwt.header") });
  payloadEl = h("textarea", { class: "clip-input", spellcheck: "false", readonly: true, "aria-label": t("jwt.payload") });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("jwt.back")),
      h("h1", null, t("jwt.title")),
      h("p", { class: "lede" }, t("jwt.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("jwt.options")),
          h("p", { class: "muted" }, t("jwt.note")),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("jwt.copy")),
        ),
        statusEl,
      ),
      h("div", { class: "data-panes" },
        h("div", { class: "rail" }, h("h2", null, t("jwt.input")), inputEl),
        h("div", { class: "rail" }, h("h2", null, t("jwt.header")), headerEl, h("h2", null, t("jwt.payload")), payloadEl),
      ),
    ),
  );
  paint();
  inputEl.focus();
}

export function unmountJwt(): void {
  inputEl = null;
  headerEl = null;
  payloadEl = null;
  statusEl = null;
  copyBtn = null;
}

function paint(): void {
  if (!inputEl || !headerEl || !payloadEl || !statusEl) return;
  const result = decodeJwt(inputEl.value);
  if (!result.ok) {
    headerEl.value = "";
    payloadEl.value = "";
    statusEl.textContent = t(`jwt.${result.error}`);
    return;
  }
  headerEl.value = JSON.stringify(result.header, null, 2);
  payloadEl.value = JSON.stringify(result.payload, null, 2);
  statusEl.textContent = result.expired === true
    ? t("jwt.expired", { alg: result.alg || "—" })
    : t("jwt.meta", { alg: result.alg || "—" });
}

async function copyOut(): Promise<void> {
  if (!payloadEl?.value) return;
  try {
    await navigator.clipboard.writeText(payloadEl.value);
    if (copyBtn) copyBtn.textContent = t("jwt.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("jwt.copy");
    }, 1200);
  } catch { /* ignore */ }
}
