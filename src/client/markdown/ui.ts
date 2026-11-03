import { copyWithFlash } from "../copy";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { debounce } from "../session";
import { titleStem } from "../../shared/filename";
import { appHref } from "../../shared/path";
import { countText } from "../../shared/word-count";
import { MAX_MARKDOWN, docText, escapeHtml, parseMarkdown, plain, toHtml, type Block, type Inline } from "../../shared/markdown";

const STORE_KEY = "cvcm.markdown.v1";

let inputEl: HTMLTextAreaElement | null = null;
let previewEl: HTMLElement | null = null;
let statsEl: HTMLElement | null = null;
let copyHtmlBtn: HTMLButtonElement | null = null;
let copyMdBtn: HTMLButtonElement | null = null;
let doc: Block[] = [];
const schedule = debounce(() => {
  paint();
  save();
}, 120);

export function mountMarkdown(host: HTMLElement): void {
  inputEl = h("textarea", {
    class: "clip-input md-input",
    "data-field": "markdown",
    maxlength: String(MAX_MARKDOWN),
    spellcheck: "false",
    "aria-label": t("markdown.input"),
    placeholder: t("markdown.placeholder"),
    onInput: () => schedule(),
    onKeydown: (e: KeyboardEvent) => indentOnTab(e),
  });
  previewEl = h("div", { class: "md-preview", "data-out": "preview", "aria-live": "off" });
  statsEl = h("p", { class: "hint", "data-out": "stats" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("markdown.back")),
      h("h1", null, t("markdown.title")),
      h("p", { class: "lede" }, t("markdown.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("div", { class: "stage-actions md-actions" },
        copyHtmlBtn = h("button", { type: "button", class: "btn", "data-action": "copy-html", onClick: () => void copyHtml() }, t("markdown.copyHtml")),
        copyMdBtn = h("button", { type: "button", class: "btn ghost", "data-action": "copy-md", onClick: () => void copyMd() }, t("markdown.copyMarkdown")),
        h("button", { type: "button", class: "btn ghost", "data-action": "download-html", onClick: () => downloadHtml() }, t("markdown.downloadHtml")),
        h("button", { type: "button", class: "btn ghost", "data-action": "download-md", onClick: () => downloadMd() }, t("markdown.downloadMd")),
        h("button", { type: "button", class: "btn ghost", "data-action": "sample", onClick: () => loadSample() }, t("markdown.sample")),
      ),
      h("div", { class: "data-panes md-panes" },
        h("div", { class: "rail" }, h("h2", null, t("markdown.input")), inputEl, statsEl),
        h("div", { class: "rail" }, h("h2", null, t("markdown.preview")), previewEl),
      ),
      h("p", { class: "hint" }, t("markdown.hint")),
    ),
  );
  inputEl.value = load() ?? t("markdown.sampleText");
  paint();
  window.addEventListener("pagehide", save);
}

export function unmountMarkdown(): void {
  window.removeEventListener("pagehide", save);
  // A change typed within the last moment is saved before the tool goes away.
  if (inputEl) save();
  inputEl = previewEl = statsEl = null;
  copyHtmlBtn = copyMdBtn = null;
  doc = [];
}

function load(): string | null {
  try {
    const v = window.localStorage.getItem(STORE_KEY);
    return v == null ? null : v.slice(0, MAX_MARKDOWN);
  } catch {
    return null;
  }
}

function save(): void {
  if (!inputEl) return;
  try {
    // The sample is not saved, so a later visit in another language shows that language's sample.
    if (inputEl.value === t("markdown.sampleText")) window.localStorage.removeItem(STORE_KEY);
    else window.localStorage.setItem(STORE_KEY, inputEl.value);
  } catch { /* storage blocked: the text lasts for this visit */ }
}

function loadSample(): void {
  if (!inputEl) return;
  inputEl.value = t("markdown.sampleText");
  paint();
  save();
}

/** Tab indents (lists need it) instead of leaving the field; Esc then Tab still moves focus on. */
function indentOnTab(e: KeyboardEvent): void {
  if (!inputEl) return;
  if (e.key === "Escape") {
    inputEl.dataset.escaped = "1";
    return;
  }
  const escaped = inputEl.dataset.escaped === "1";
  delete inputEl.dataset.escaped;
  if (e.key !== "Tab" || e.ctrlKey || e.metaKey || e.altKey || escaped) return;
  e.preventDefault();
  const { selectionStart: s, selectionEnd: end, value } = inputEl;
  const lineStart = value.lastIndexOf("\n", s - 1) + 1;
  if (e.shiftKey) {
    const m = /^ {1,4}/.exec(value.slice(lineStart));
    if (!m) return;
    inputEl.setRangeText("", lineStart, lineStart + m[0].length, "preserve");
  } else {
    // Under a list item, indent to where its text starts ("1. " is 3, "10. " is 4), which nests the new line.
    const prevStart = value.lastIndexOf("\n", lineStart - 2) + 1;
    const prev = lineStart > 0 ? value.slice(prevStart, lineStart - 1) : "";
    const item = /^(\s*)([-*+]|\d{1,9}[.)])(\s+)/.exec(prev);
    const before = value.slice(lineStart, s);
    const width = item && /^ *$/.test(before) ? Math.max(2, item[0].length - before.length) : 2;
    inputEl.setRangeText(" ".repeat(width), s, end, "end");
  }
  schedule();
}

function paint(): void {
  if (!inputEl || !previewEl || !statsEl) return;
  doc = parseMarkdown(inputEl.value);
  previewEl.replaceChildren(...doc.map(blockEl));
  statsEl.textContent = t("markdown.stats", { words: countText(docText(doc)).words, chars: Array.from(inputEl.value).length });
}

// The preview is built from DOM nodes (no innerHTML), so nothing in the text can become markup.
function blockEl(b: Block): Node {
  switch (b.t) {
    case "h":
      return h(`h${b.level}` as "h1", null, ...b.kids.map(inlineEl));
    case "p":
      return h("p", null, ...b.kids.map(inlineEl));
    case "hr":
      return h("hr");
    case "code":
      return h("pre", null, h("code", b.lang ? { "data-lang": b.lang } : null, b.text));
    case "quote":
      return h("blockquote", null, ...b.kids.map(blockEl));
    case "list": {
      const items = b.items.map((it) => {
        const kids = it.kids.flatMap((k) => (b.tight && k.t === "p" ? k.kids.map(inlineEl) : [blockEl(k)]));
        const box = it.task == null ? null : h("input", { type: "checkbox", disabled: true, checked: it.task, "aria-label": it.task ? t("markdown.done") : t("markdown.todo") });
        return h("li", it.task == null ? null : { class: "task" }, box, ...kids);
      });
      return b.ordered ? h("ol", b.start !== 1 ? { start: String(b.start) } : null, ...items) : h("ul", null, ...items);
    }
    case "table":
      return h("div", { class: "md-table" },
        h("table", null,
          h("thead", null, h("tr", null, ...b.head.map((c, k) => h("th", cellProps(b.align[k]), ...c.map(inlineEl))))),
          b.rows.length ? h("tbody", null, ...b.rows.map((r) => h("tr", null, ...r.map((c, k) => h("td", cellProps(b.align[k]), ...c.map(inlineEl)))))) : null,
        ),
      );
  }
}

function cellProps(align: "left" | "center" | "right" | null): Record<string, unknown> | null {
  return align ? { style: { textAlign: align } } : null;
}

function inlineEl(n: Inline): Node {
  switch (n.t) {
    case "text":
      return document.createTextNode(n.v);
    case "br":
      return h("br");
    case "code":
      return h("code", null, n.v);
    case "strong":
    case "em":
    case "del":
      return h(n.t, null, ...n.kids.map(inlineEl));
    case "link":
      // Links open in a new tab, so a click in the preview does not leave the text being written.
      return h("a", { href: n.href, title: n.title || null, target: "_blank", rel: "noopener noreferrer nofollow" }, ...n.kids.map(inlineEl));
    case "img":
      return h("img", { src: n.src, alt: n.alt, title: n.title || null, loading: "lazy", referrerpolicy: "no-referrer" });
  }
}

async function copyHtml(): Promise<void> {
  // Export what is in the box now, not what the last (debounced) preview showed.
  paint();
  await copyWithFlash(copyHtmlBtn, toHtml(doc), { done: t("markdown.copied"), failed: t("markdown.copyFailed") });
}

async function copyMd(): Promise<void> {
  if (!inputEl) return;
  await copyWithFlash(copyMdBtn, inputEl.value, { done: t("markdown.copied"), failed: t("markdown.copyFailed") });
}

function baseName(): string {
  const first = doc.find((b) => b.t === "h");
  return titleStem(first && first.t === "h" ? plain(first.kids) : "") || "document";
}

function downloadHtml(): void {
  paint();
  const first = doc.find((b) => b.t === "h");
  const title = first && first.t === "h" ? plain(first.kids) : "Document";
  const page = `<!doctype html>
<html lang="${escapeHtml(locale())}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>body{max-width:46rem;margin:2rem auto;padding:0 1rem;font:16px/1.65 system-ui,sans-serif;color:#222}pre{background:#f6f6f6;padding:.8rem;overflow:auto;border-radius:6px}code{font-family:ui-monospace,monospace;font-size:.92em}table{border-collapse:collapse}th,td{border:1px solid #ddd;padding:.35rem .6rem}blockquote{margin:0;padding-left:1rem;border-left:3px solid #ddd;color:#555}img{max-width:100%}</style>
</head>
<body>
${toHtml(doc)}
</body>
</html>
`;
  downloadBlob(new Blob([page], { type: "text/html;charset=utf-8" }), `${baseName()}.html`);
}

function downloadMd(): void {
  if (!inputEl) return;
  paint();
  downloadBlob(new Blob([inputEl.value], { type: "text/markdown;charset=utf-8" }), `${baseName()}.md`);
}
