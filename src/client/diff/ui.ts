import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { debounce } from "../session";
import { diffCounts, diffLines, unifiedDiff } from "../../shared/diff";

let leftEl: HTMLTextAreaElement | null = null;
let rightEl: HTMLTextAreaElement | null = null;
let outEl: HTMLElement | null = null;
let metaEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let ignoreSpace = false;
const schedule = debounce(() => paint(), 120);

export function mountDiff(host: HTMLElement): void {
  leftEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    "aria-label": t("diff.left"),
    placeholder: t("diff.leftPlaceholder"),
    onInput: () => schedule(),
  });
  rightEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    "aria-label": t("diff.right"),
    placeholder: t("diff.rightPlaceholder"),
    onInput: () => schedule(),
  });
  outEl = h("pre", { class: "diff-out", "aria-live": "polite" });
  metaEl = h("p", { class: "muted" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("diff.back")),
      h("h1", null, t("diff.title")),
      h("p", { class: "lede" }, t("diff.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("diff.options")),
          h("label", { class: "check" },
            h("input", {
              type: "checkbox",
              onChange: (e: Event) => {
                ignoreSpace = (e.target as HTMLInputElement).checked;
                paint();
              },
            }),
            h("span", null, t("diff.ignoreSpace")),
          ),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("diff.copy")),
        ),
        metaEl,
      ),
      h("div", { class: "data-panes" },
        h("div", { class: "rail" }, h("h2", null, t("diff.left")), leftEl),
        h("div", { class: "rail" }, h("h2", null, t("diff.right")), rightEl),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("diff.result")),
        outEl,
      ),
    ),
  );
  paint();
}

export function unmountDiff(): void {
  leftEl = null;
  rightEl = null;
  outEl = null;
  metaEl = null;
  copyBtn = null;
}

function paint(): void {
  if (!leftEl || !rightEl || !outEl || !metaEl) return;
  const lines = diffLines(leftEl.value, rightEl.value, ignoreSpace);
  const counts = diffCounts(lines);
  outEl.replaceChildren();
  if (!leftEl.value && !rightEl.value) {
    outEl.textContent = t("diff.empty");
    metaEl.textContent = "";
    return;
  }
  for (const line of lines) {
    const row = h("div", { class: `diff-line is-${line.kind}` }, line.text.length ? line.text : " ");
    outEl.append(row);
  }
  metaEl.textContent = t("diff.meta")
    .replace("{added}", String(counts.added))
    .replace("{removed}", String(counts.removed))
    .replace("{same}", String(counts.same));
}

async function copyOut(): Promise<void> {
  if (!leftEl || !rightEl) return;
  const text = unifiedDiff(diffLines(leftEl.value, rightEl.value, ignoreSpace));
  try {
    await navigator.clipboard.writeText(text);
    if (copyBtn) copyBtn.textContent = t("diff.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("diff.copy");
    }, 1200);
  } catch { /* ignore */ }
}
