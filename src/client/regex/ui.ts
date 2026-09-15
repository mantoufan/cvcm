import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { FLAG_ORDER, MAX_TEXT, runRegex, type FlagChar, type RegexFlags, type RegexMatch } from "../../shared/regex";
import { debounce } from "../session";

const flags: RegexFlags = { g: true, i: false, m: false, s: false, u: false };
const schedule = debounce(() => paint(), 80);

let patternEl: HTMLInputElement | null = null;
let textEl: HTMLTextAreaElement | null = null;
let replaceEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let replaceOutEl: HTMLElement | null = null;
let listEl: HTMLElement | null = null;
let metaEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let lastMatches: string[] = [];

export function mountRegex(host: HTMLElement): void {
  patternEl = h("input", {
    class: "regex-pattern",
    spellcheck: "false",
    autocapitalize: "off",
    autocomplete: "off",
    "aria-label": t("regex.pattern"),
    placeholder: t("regex.patternPlaceholder"),
    onInput: () => schedule(),
  });
  textEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    "aria-label": t("regex.text"),
    placeholder: t("regex.textPlaceholder"),
    onInput: () => schedule(),
  });
  replaceEl = h("input", {
    class: "regex-pattern",
    spellcheck: "false",
    autocapitalize: "off",
    autocomplete: "off",
    "aria-label": t("regex.replace"),
    placeholder: t("regex.replacePlaceholder"),
    onInput: () => schedule(),
  });
  outEl = h("div", { class: "regex-out", "aria-live": "polite" });
  replaceOutEl = h("div", { class: "regex-replace-out", hidden: true });
  listEl = h("ol", { class: "regex-list" });
  metaEl = h("p", { class: "muted" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("regex.back")),
      h("h1", null, t("regex.title")),
      h("p", { class: "lede" }, t("regex.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("regex.options")),
          labeled(t("regex.pattern"), patternEl),
          h("div", { class: "regex-flags" },
            ...FLAG_ORDER.map((flag) => flagBox(flag)),
          ),
          labeled(t("regex.replace"), replaceEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("regex.copy")),
        ),
        metaEl,
      ),
      h("div", { class: "data-panes" },
        h("div", { class: "rail" }, h("h2", null, t("regex.text")), textEl),
        h("div", { class: "rail" }, h("h2", null, t("regex.result")), outEl, replaceOutEl, listEl),
      ),
    ),
  );
  paint();
  patternEl.focus();
}

export function unmountRegex(): void {
  patternEl = null;
  textEl = null;
  replaceEl = null;
  outEl = null;
  replaceOutEl = null;
  listEl = null;
  metaEl = null;
  copyBtn = null;
  lastMatches = [];
}

function flagBox(flag: FlagChar): HTMLElement {
  return h("label", { class: "check" },
    h("input", {
      type: "checkbox",
      checked: flags[flag],
      onChange: (e: Event) => {
        flags[flag] = (e.target as HTMLInputElement).checked;
        paint();
      },
    }),
    h("span", null, flag),
  );
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function paint(): void {
  if (!patternEl || !textEl || !replaceEl || !outEl || !replaceOutEl || !listEl || !metaEl) return;
  const pattern = patternEl.value;
  const text = textEl.value;
  const replacement = replaceEl.value;
  lastMatches = [];
  outEl.replaceChildren();
  replaceOutEl.replaceChildren();
  replaceOutEl.hidden = true;
  listEl.replaceChildren();
  if (!pattern) {
    outEl.textContent = t("regex.empty");
    metaEl.textContent = "";
    return;
  }
  const result = runRegex(pattern, flags, text, replacement.length ? replacement : null);
  if (!result.ok) {
    outEl.textContent = result.error === "empty-pattern" ? t("regex.empty") : result.error;
    metaEl.textContent = t("regex.invalid");
    return;
  }
  lastMatches = result.matches.map((m) => m.text);
  const body = text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text;
  outEl.append(...highlight(body, result.matches));
  if (result.replaced !== null) {
    replaceOutEl.hidden = false;
    replaceOutEl.append(
      h("strong", null, t("regex.replaced")),
      h("div", null, result.replaced),
    );
  }
  listEl.replaceChildren(
    ...result.matches.map((m, i) =>
      h("li", null, `${i + 1}. [${m.index}] ${preview(m.text)}${groupSuffix(m)}`),
    ),
  );
  metaEl.textContent = t("regex.meta")
    .replace("{count}", String(result.matches.length))
    .replace("{flags}", result.flags || "—");
  if (result.truncated) metaEl.textContent += ` ${t("regex.truncated")}`;
}

function highlight(text: string, matches: RegexMatch[]): Array<Node | string> {
  if (!text) return [t("regex.noText")];
  if (matches.length === 0) return [text];
  const nodes: Array<Node | string> = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.index < cursor) continue;
    if (m.index > cursor) nodes.push(text.slice(cursor, m.index));
    if (m.text.length) nodes.push(h("mark", { class: "regex-hit" }, m.text));
    cursor = m.index + m.text.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes.length ? nodes : [text];
}

function preview(text: string): string {
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

function groupSuffix(match: RegexMatch): string {
  const groups = match.groups.filter((g) => g != null && g !== "");
  if (groups.length === 0) return "";
  return ` (${groups.map(preview).join(", ")})`;
}

async function copyOut(): Promise<void> {
  try {
    await navigator.clipboard.writeText(lastMatches.join("\n"));
    if (copyBtn) copyBtn.textContent = t("regex.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("regex.copy");
    }, 1200);
  } catch { /* ignore */ }
}
