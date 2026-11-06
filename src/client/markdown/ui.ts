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
let undoBtn: HTMLButtonElement | null = null;
let doc: Block[] = [];
/** What the Sample button replaced, for a few seconds. */
let undoText: string | null = null;
let undoTimer = 0;
const UNDO_MS = 8000;
/** True from an edit until it is saved: an idle tab must not overwrite what another tab saved. */
let dirty = false;
const schedule = debounce(() => {
  // Saved first, so the edit is kept even if drawing it fails.
  save();
  paint();
}, 120);

export function mountMarkdown(host: HTMLElement): void {
  inputEl = h("textarea", {
    class: "clip-input md-input",
    "data-field": "markdown",
    maxlength: String(MAX_MARKDOWN),
    spellcheck: "false",
    "aria-label": t("markdown.input"),
    placeholder: t("markdown.placeholder"),
    onInput: () => {
      dropUndo();
      dirty = true;
      schedule();
    },
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
        undoBtn = h("button", { type: "button", class: "btn ghost", "data-action": "undo", hidden: true, onClick: () => undoSample() }, t("markdown.undo")),
      ),
      h("div", { class: "data-panes md-panes" },
        h("div", { class: "rail" }, h("h2", null, t("markdown.input")), inputEl, statsEl),
        h("div", { class: "rail" }, h("h2", null, t("markdown.preview")), previewEl),
      ),
      h("p", { class: "hint" }, t("markdown.hint")),
    ),
  );
  inputEl.value = load() ?? t("markdown.sampleText");
  dirty = false;
  paint();
  window.addEventListener("pagehide", save);
  window.addEventListener("storage", onStorage);
}

/** Another tab saved: show its text, unless this tab has an unsaved edit of its own. */
function onStorage(e: StorageEvent): void {
  if (e.key !== STORE_KEY || !inputEl || dirty) return;
  const next = e.newValue?.slice(0, MAX_MARKDOWN) ?? t("markdown.sampleText");
  if (next === inputEl.value) return;
  inputEl.value = next;
  paint();
}

export function unmountMarkdown(): void {
  window.removeEventListener("pagehide", save);
  window.removeEventListener("storage", onStorage);
  // A change typed within the last moment is saved before the tool goes away.
  if (inputEl) save();
  dropUndo();
  inputEl = previewEl = statsEl = null;
  copyHtmlBtn = copyMdBtn = undoBtn = null;
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
  if (!inputEl || !dirty) return;
  dirty = false;
  try {
    // The sample is not saved, so a later visit in another language shows that language's sample.
    if (inputEl.value === t("markdown.sampleText")) window.localStorage.removeItem(STORE_KEY);
    else window.localStorage.setItem(STORE_KEY, inputEl.value);
  } catch { /* storage blocked: the text lasts for this visit */ }
}

function loadSample(): void {
  if (!inputEl) return;
  const sample = t("markdown.sampleText");
  if (inputEl.value === sample) return;
  // The sample replaces the document, and setting a value clears the box's own undo history.
  if (inputEl.value) {
    undoText = inputEl.value;
    if (undoBtn) undoBtn.hidden = false;
    window.clearTimeout(undoTimer);
    undoTimer = window.setTimeout(dropUndo, UNDO_MS);
  }
  inputEl.value = sample;
  dirty = true;
  paint();
  save();
}

function undoSample(): void {
  if (!inputEl || undoText === null) return;
  inputEl.value = undoText;
  dropUndo();
  dirty = true;
  paint();
  save();
}

function dropUndo(): void {
  window.clearTimeout(undoTimer);
  undoText = null;
  if (undoBtn) undoBtn.hidden = true;
}

/** Tab indents (lists need it) instead of leaving the field; Esc then Tab still moves focus on. */
function indentOnTab(e: KeyboardEvent): void {
  // Tab and Esc belong to the IME while it is composing.
  if (!inputEl || e.isComposing) return;
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
  if (e.shiftKey || end > s) {
    // Whole lines: a selection is indented, never replaced. A selection ending at a line start leaves that line alone.
    const stop = end > s && value[end - 1] === "\n" ? end - 1 : end;
    const next = value.indexOf("\n", stop);
    const blockEnd = next < 0 ? value.length : next;
    const lines = value.slice(lineStart, blockEnd).split("\n");
    const changed = lines.map((l) => (e.shiftKey ? l.replace(/^ {1,4}/, "") : l && `  ${l}`));
    const block = changed.join("\n");
    if (block === value.slice(lineStart, blockEnd)) return;
    replaceRange(lineStart, blockEnd, block);
    if (end > s) inputEl.setSelectionRange(lineStart, lineStart + block.length);
    else {
      const caret = Math.max(lineStart, s - (lines[0].length - changed[0].length));
      inputEl.setSelectionRange(caret, caret);
    }
  } else {
    // Under a list item, indent to where its text starts ("1. " is 3, "10. " is 4), which nests the new line.
    const prevStart = value.lastIndexOf("\n", lineStart - 2) + 1;
    const prev = lineStart > 0 ? value.slice(prevStart, lineStart - 1) : "";
    const item = /^(\s*)([-*+]|\d{1,9}[.)])(\s+)/.exec(prev);
    const before = value.slice(lineStart, s);
    const width = item && /^ *$/.test(before) ? Math.max(2, item[0].length - before.length) : 2;
    replaceRange(s, end, " ".repeat(width));
  }
  dirty = true;
  schedule();
}

/** Edits through the browser's own command where it can, so Ctrl+Z still brings the text back. */
function replaceRange(start: number, end: number, text: string): void {
  if (!inputEl) return;
  inputEl.setSelectionRange(start, end);
  let done = false;
  try {
    done = document.execCommand(text ? "insertText" : "delete", false, text);
  } catch { /* not supported: fall through */ }
  if (!done) inputEl.setRangeText(text, start, end, "end");
}

/** Re-reads the box (for exports right after typing), without redrawing the preview. */
function refresh(): void {
  if (inputEl) doc = parseMarkdown(inputEl.value);
}

/** Images from the last preview, by address: redrawing reuses them, so they do not flicker or load again on each key. */
let imgPool = new Map<string, HTMLImageElement[]>();

function paint(): void {
  if (!inputEl || !previewEl || !statsEl) return;
  doc = parseMarkdown(inputEl.value);
  imgPool = new Map();
  for (const img of previewEl.querySelectorAll("img")) {
    const src = img.getAttribute("src") ?? "";
    const same = imgPool.get(src);
    if (same) same.push(img);
    else imgPool.set(src, [img]);
  }
  previewEl.replaceChildren(fill(document.createDocumentFragment(), doc.map(blockEl)));
  imgPool = new Map();
  statsEl.textContent = t("markdown.stats", { words: countText(docText(doc)).words, chars: Array.from(inputEl.value).length });
}

/** Appends one at a time: a document can hold more children than a function call can take as arguments. */
function fill<T extends Node>(parent: T, kids: readonly Node[]): T {
  for (const kid of kids) parent.appendChild(kid);
  return parent;
}

// The preview is built from DOM nodes (no innerHTML), so nothing in the text can become markup.
function blockEl(b: Block): Node {
  switch (b.t) {
    case "h":
      // One level down, so a document's "# Title" is not a second top heading of this page (the sample is in the prerendered HTML too).
      return fill(h(`h${Math.min(b.level + 1, 6)}` as "h2", { class: `md-h${b.level}` }), b.kids.map(inlineEl));
    case "p":
      return fill(h("p"), b.kids.map(inlineEl));
    case "hr":
      return h("hr");
    case "code":
      return h("pre", null, h("code", b.lang ? { "data-lang": b.lang } : null, b.text));
    case "quote":
      return fill(h("blockquote"), b.kids.map(blockEl));
    case "list": {
      const items = b.items.map((it) => {
        const kids = it.kids.flatMap((k) => (b.tight && k.t === "p" ? k.kids.map(inlineEl) : [blockEl(k)]));
        const box = it.task == null ? null : h("input", { type: "checkbox", disabled: true, checked: it.task, "aria-label": it.task ? t("markdown.done") : t("markdown.todo") });
        // In a loose list the box goes inside the first paragraph, so it stays on the text's line.
        const first = kids[0];
        if (box && first instanceof HTMLParagraphElement) first.prepend(box);
        return fill(h("li", it.task == null ? null : { class: "task" }, first instanceof HTMLParagraphElement ? null : box), kids);
      });
      return fill(b.ordered ? h("ol", b.start !== 1 ? { start: String(b.start) } : null) : h("ul"), items);
    }
    case "table":
      return h("div", { class: "md-table" },
        h("table", null,
          h("thead", null, fill(h("tr"), b.head.map((c, k) => fill(h("th", cellProps(b.align[k])), c.map(inlineEl))))),
          b.rows.length ? fill(h("tbody"), b.rows.map((r) => fill(h("tr"), r.map((c, k) => fill(h("td", cellProps(b.align[k])), c.map(inlineEl)))))) : null,
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
      return fill(h(n.t), n.kids.map(inlineEl));
    case "link":
      // Links open in a new tab, so a click in the preview does not leave the text being written.
      return fill(h("a", { href: n.href, title: n.title || null, target: "_blank", rel: "noopener noreferrer nofollow" }), n.kids.map(inlineEl));
    case "img": {
      const reused = imgPool.get(n.src)?.shift();
      if (reused) {
        reused.alt = n.alt;
        if (n.title) reused.title = n.title;
        else reused.removeAttribute("title");
        return reused;
      }
      return h("img", { src: n.src, alt: n.alt, title: n.title || null, loading: "lazy", referrerpolicy: "no-referrer" });
    }
  }
}

async function copyHtml(): Promise<void> {
  // Export what is in the box now, not what the last (debounced) preview showed.
  refresh();
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
  refresh();
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
  refresh();
  downloadBlob(new Blob([inputEl.value], { type: "text/markdown;charset=utf-8" }), `${baseName()}.md`);
}
