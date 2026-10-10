import {
  CLIP_MAX_BYTES,
  CLIP_MAX_FILE_BYTES,
  CLIP_MAX_VIEWS,
  remainingClock,
  utf8Bytes,
} from "../../shared/clip";
import { escapeHtml, renderClip, sanitizeHtml } from "../../shared/md";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";

type Created = { id: string; url: string; expiresAt: number };
type Mode = "rich" | "md";
type Upload = { id: string; name: string; type: string; size: number; pct: number; state: "up" | "done" | "fail" };

const DRAFT_KEY = "cvcm.clip.draft";

let mode: Mode = "rich";
let editor: HTMLDivElement | null = null;
let mdArea: HTMLTextAreaElement | null = null;
let statusEl: HTMLElement | null = null;
let resultEl: HTMLElement | null = null;
let bytesEl: HTMLElement | null = null;
let pillsEl: HTMLElement | null = null;
let shareBtn: HTMLButtonElement | null = null;
let modeBtns: HTMLButtonElement[] = [];
let savedRange: Range | null = null;
let uploads: Upload[] = [];
/** Bumped by Clear and unmount so in-flight uploads from an old note are dropped. */
let uploadGen = 0;
let uploadSeq = 0;
let busy = false;
/** Only write the draft back when the user changed something since the last save/share. */
let draftDirty = false;
/** Bumped on every edit, so a share that resolves later knows whether the note changed meanwhile. */
let editGen = 0;
const activeXhrs = new Set<XMLHttpRequest>();
/** A drag that started inside the editor is a native move; leave it to the browser. */
let internalDrag = false;
let statusTimer = 0;
let draftTimer = 0;

export async function mountClip(host: HTMLElement, clipId: string | null): Promise<void> {
  busy = false;
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("clip.back")),
      h("h1", null, t("clip.title")),
      h("p", { class: "lede" }, t("clip.privacyNote")),
    ),
  );
  if (clipId) {
    const page = h("div", { class: "clip" });
    host.append(page);
    await showView(page, clipId);
  } else mountClipCompose(host, { rules: true });
}

/** Compose box only (no tool header). Used on /clip/ and on the home page. */
export function mountClipCompose(host: HTMLElement, opts: { rules?: boolean } = {}): void {
  busy = false;
  uploads = [];
  uploadGen++;
  savedRange = null;
  draftDirty = false;
  const page = h("div", { class: "clip" + (opts.rules ? "" : " solo") });
  host.append(page);
  showCompose(page, Boolean(opts.rules));
  window.addEventListener("paste", onWindowPaste);
  window.addEventListener("pagehide", onPageHide);
  document.addEventListener("selectionchange", rememberRange);
}

/** A full page unload skips unmountClip; save the pending (debounced) draft now. */
function onPageHide(): void {
  flushDraft();
}

function abortUploads(): void {
  uploadGen++;
  for (const xhr of activeXhrs) xhr.abort();
  activeXhrs.clear();
}

export function unmountClip(): void {
  window.removeEventListener("paste", onWindowPaste);
  window.removeEventListener("pagehide", onPageHide);
  document.removeEventListener("selectionchange", rememberRange);
  window.clearTimeout(statusTimer);
  flushDraft();
  abortUploads();
  editor = null;
  mdArea = null;
  statusEl = null;
  resultEl = null;
  bytesEl = null;
  pillsEl = null;
  shareBtn = null;
  modeBtns = [];
  savedRange = null;
  uploads = [];
  busy = false;
}

function showCompose(page: HTMLElement, withRules: boolean): void {
  page.replaceChildren();
  const draft = readDraft();
  mode = draft?.mode === "md" ? "md" : "rich";
  editor = h("div", {
    class: "clip-rich clip-md",
    contenteditable: "true",
    role: "textbox",
    "aria-multiline": "true",
    "aria-label": t("clip.bodyLabel"),
    "data-placeholder": t("clip.placeholder"),
    spellcheck: "false",
    onInput: () => changed(),
    onPaste: (e: Event) => onEditorPaste(e as ClipboardEvent),
    onKeydown: (e: Event) => onEditorKey(e as KeyboardEvent),
    onDragstart: () => { internalDrag = true; },
    onDragend: () => { internalDrag = false; },
  });
  mdArea = h("textarea", {
    class: "clip-input",
    placeholder: t("clip.mdPlaceholder"),
    spellcheck: "false",
    "aria-label": t("clip.bodyLabel"),
    onInput: () => changed(),
    onPaste: (e: Event) => onMdPaste(e as ClipboardEvent),
    onKeydown: (e: Event) => {
      const k = e as KeyboardEvent;
      if ((k.metaKey || k.ctrlKey) && k.key === "Enter") {
        k.preventDefault();
        void createNote();
      }
    },
  });
  if (draft?.body) {
    if (mode === "rich") editor.innerHTML = sanitizeHtml(draft.body);
    else mdArea.value = draft.body;
  }
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  resultEl = h("div", { class: "clip-result" });
  bytesEl = h("span", { class: "muted clip-bytes" });
  pillsEl = h("div", { class: "clip-pills" });
  shareBtn = h("button", { type: "button", class: "btn", onClick: () => void createNote() }, t("clip.copyLink"));
  const filePick = h("input", {
    type: "file",
    class: "sr-only",
    multiple: true,
    onChange: (e: Event) => {
      const input = e.currentTarget as HTMLInputElement;
      void uploadFiles([...(input.files || [])]);
      input.value = "";
    },
  });
  page.append(
    h("div", {
      class: "rail clip-compose",
      onDragover: (e: Event) => { e.preventDefault(); (e.currentTarget as HTMLElement).classList.add("over"); },
      onDragleave: (e: Event) => { (e.currentTarget as HTMLElement).classList.remove("over"); },
      onDrop: (e: Event) => {
        const dt = (e as DragEvent).dataTransfer;
        const files = [...(dt?.files || [])];
        (e.currentTarget as HTMLElement).classList.remove("over");
        if (internalDrag && !files.length) {
          internalDrag = false;
          window.setTimeout(changed, 0);
          return;
        }
        if (mode === "md") {
          // The textarea takes dropped text natively; only files need us.
          if (!files.length) return;
          e.preventDefault();
          void uploadFiles(files);
          return;
        }
        e.preventDefault();
        if (dt) incoming(dt, caretAtPoint(e as DragEvent));
      },
    },
      toolbar(filePick),
      h("div", { class: "clip-sheet" }, editor, mdArea),
      pillsEl,
      h("div", { class: "clip-actions" },
        shareBtn,
        h("button", { type: "button", class: "btn ghost", onClick: () => clearAll() }, t("clip.clear")),
        bytesEl,
      ),
      statusEl,
      resultEl,
    ),
    ...(withRules ? [rules()] : []),
  );
  applyMode();
  refreshState();
  refreshBytes();
}

function toolbar(filePick: HTMLInputElement): HTMLElement {
  modeBtns = [
    h("button", { type: "button", class: "seg", "data-mode": "rich", onClick: () => switchMode("rich") }, t("clip.modeRich")),
    h("button", { type: "button", class: "seg", "data-mode": "md", onClick: () => switchMode("md") }, t("clip.modeMd")),
  ];
  return h("div", { class: "clip-bar" },
    filePick,
    h("div", { class: "clip-seg", role: "group" }, ...modeBtns),
    fmt("B", "clip.bold", "clip-biu", () => cmd("bold"), () => wrapMd("**")),
    fmt("I", "clip.italic", "clip-biu i", () => cmd("italic"), () => wrapMd("*")),
    fmt("U", "clip.underline", "clip-biu u", () => cmd("underline"), () => wrapMd("++")),
    fmt("S", "clip.strike", "clip-biu s", () => cmd("strikeThrough"), () => wrapMd("~~")),
    fmt("H1", "clip.h1", "clip-biu", () => block("h1"), () => prefixMd("# ")),
    fmt("H2", "clip.h2", "clip-biu", () => block("h2"), () => prefixMd("## ")),
    fmt("•", "clip.bullet", "clip-biu", () => cmd("insertUnorderedList"), () => prefixMd("- ")),
    fmt("1.", "clip.numbered", "clip-biu", () => cmd("insertOrderedList"), () => prefixMd("1. ")),
    fmt("</>", "clip.code", "clip-biu", () => block("pre"), () => fenceMd()),
    fmt("❝", "clip.quote", "clip-biu", () => block("blockquote"), () => prefixMd("> ")),
    h("button", {
      type: "button",
      class: "chip clip-attach",
      onClick: () => filePick.click(),
    }, `📎 ${t("clip.attachBtn")}`),
  );
}

function fmt(label: string, titleKey: string, cls: string, rich: () => void, md: () => void): HTMLButtonElement {
  return h("button", {
    type: "button",
    class: `chip ${cls}`,
    title: t(titleKey),
    "aria-label": t(titleKey),
    // Keep the editor selection: a mousedown on the button would blur it.
    onMousedown: (e: Event) => e.preventDefault(),
    onClick: () => {
      if (mode === "rich") rich();
      else md();
      changed();
    },
  }, label);
}

function cmd(name: string): void {
  editor?.focus();
  restoreRange();
  document.execCommand(name, false);
}

function block(tag: "h1" | "h2" | "pre" | "blockquote"): void {
  editor?.focus();
  restoreRange();
  const current = String(document.queryCommandValue("formatBlock") || "").toLowerCase();
  document.execCommand("formatBlock", false, current === tag ? "p" : tag);
}

function wrapMd(mark: string): void {
  if (!mdArea) return;
  const { selectionStart: start, selectionEnd: end, value } = mdArea;
  const selected = value.slice(start, end);
  mdArea.value = `${value.slice(0, start)}${mark}${selected}${mark}${value.slice(end)}`;
  mdArea.selectionStart = start + mark.length;
  mdArea.selectionEnd = start + mark.length + selected.length;
  mdArea.focus();
}

function prefixMd(prefix: string): void {
  if (!mdArea) return;
  const { selectionStart: start, value } = mdArea;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  mdArea.value = `${value.slice(0, lineStart)}${prefix}${value.slice(lineStart)}`;
  mdArea.selectionStart = mdArea.selectionEnd = start + prefix.length;
  mdArea.focus();
}

function fenceMd(): void {
  if (!mdArea) return;
  const { selectionStart: start, selectionEnd: end, value } = mdArea;
  const selected = value.slice(start, end);
  const lead = start > 0 && value[start - 1] !== "\n" ? "\n" : "";
  const snippet = `${lead}\`\`\`\n${selected}\n\`\`\`\n`;
  mdArea.value = `${value.slice(0, start)}${snippet}${value.slice(end)}`;
  mdArea.selectionStart = mdArea.selectionEnd = start + lead.length + 4 + selected.length;
  mdArea.focus();
}

function onEditorKey(e: KeyboardEvent): void {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    void createNote();
    return;
  }
  // "```" or "```js" on its own line + Enter turns the line into a code block.
  if (e.key !== "Enter" || e.shiftKey || !editor) return;
  const sel = window.getSelection();
  const node = sel?.anchorNode;
  if (!node) return;
  const blockEl = (node.nodeType === Node.TEXT_NODE ? node.parentElement : node as Element)?.closest("p, div");
  const line = (blockEl && blockEl !== editor ? blockEl.textContent : node.textContent) || "";
  if (!/^```\w*$/.test(line.trim())) return;
  e.preventDefault();
  if (blockEl && blockEl !== editor) blockEl.textContent = "";
  else node.textContent = "";
  document.execCommand("formatBlock", false, "pre");
}

function switchMode(next: Mode): void {
  if (next === mode || !editor || !mdArea) return;
  // Placeholders for in-flight uploads live in the current editor; finish those first.
  if (pendingUploads()) {
    setStatus(t("clip.uploading"));
    return;
  }
  if (next === "md") mdArea.value = domToMarkdown(editor).trim();
  else editor.innerHTML = mdArea.value.trim() ? renderClip(mdArea.value) : "";
  mode = next;
  applyMode();
  changed();
  flushDraft();
}

function applyMode(): void {
  if (!editor || !mdArea) return;
  editor.hidden = mode !== "rich";
  mdArea.hidden = mode !== "md";
  for (const btn of modeBtns) btn.classList.toggle("on", btn.dataset.mode === mode);
  (mode === "rich" ? editor : mdArea).focus();
}

/** Escape text so the Markdown renderer shows it literally. */
function mdEscape(text: string): string {
  return text
    .replace(/([\\`*_~[\]<>#+|!])/g, "\\$1")
    .replace(/^(\s*)([-])(\s)/gm, "$1\\$2$3")
    .replace(/^(\s*\d+)([.)])(\s)/gm, "$1\\$2$3");
}

function longestRun(text: string, ch: string): number {
  let best = 0;
  let run = 0;
  for (const c of text) {
    run = c === ch ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** Inline code with a backtick run longer than any inside it (CommonMark style). */
function codeSpan(text: string): string {
  const ticks = "`".repeat(longestRun(text, "`") + 1);
  const pad = text.startsWith("`") || text.endsWith("`") ? " " : "";
  return `${ticks}${pad}${text}${pad}${ticks}`;
}

function mdUrl(url: string): string {
  return url.replace(/[()\s]/g, (c) => encodeURIComponent(c).replace("(", "%28").replace(")", "%29"));
}

function tableToMd(table: Element, walk: (n: Node) => string): string {
  const rows = [...table.querySelectorAll("tr")].map((tr) =>
    [...tr.children].map((cell) => walk(cell).replace(/\n+/g, " ").trim()));
  if (!rows.length) return "";
  const width = Math.max(...rows.map((r) => r.length));
  const line = (r: string[]) => `| ${Array.from({ length: width }, (_, i) => r[i] ?? "").join(" | ")} |`;
  return [line(rows[0]), `|${" --- |".repeat(width)}`, ...rows.slice(1).map(line)].join("\n");
}

/** Text of a <pre>, keeping <br> and block children as line breaks. */
function preText(node: Node): string {
  let out = "";
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) out += child.textContent || "";
    else if (child instanceof Element) {
      const tag = child.tagName.toLowerCase();
      if (tag === "br") out += "\n";
      else if (tag === "div" || tag === "p") out += `${out && !out.endsWith("\n") ? "\n" : ""}${preText(child)}\n`;
      else out += preText(child);
    }
  }
  return out;
}

/** Serialize the rich editor back to Markdown for the MD tab. */
function domToMarkdown(root: Node): string {
  const blocks: string[] = [];
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return mdEscape((node.textContent || "").replace(/ /g, " "));
    if (!(node instanceof Element)) return "";
    const tag = node.tagName.toLowerCase();
    const inner = () => [...node.childNodes].map(walk).join("");
    switch (tag) {
      case "br": return "\n";
      case "b": case "strong": return `**${inner()}**`;
      case "i": case "em": return `*${inner()}*`;
      case "u": return `++${inner()}++`;
      case "s": case "strike": case "del": return `~~${inner()}~~`;
      case "code": return node.closest("pre") ? preText(node) : codeSpan(node.textContent || "");
      // Held as a token so the blank-line cleanup below never touches code.
      case "pre": return `\n\u0001p${blocks.push(preText(node).replace(/\n$/, "")) - 1}\u0002\n\n`;
      case "h1": return `\n# ${inner()}\n\n`;
      case "h2": return `\n## ${inner()}\n\n`;
      case "h3": return `\n### ${inner()}\n\n`;
      case "h4": return `\n#### ${inner()}\n\n`;
      case "blockquote": return `\n${inner().split("\n").filter(Boolean).map((l) => `> ${l}`).join("\n")}\n\n`;
      case "ul": return `\n${[...node.children].map((li) => `- ${walk(li).trim()}`).join("\n")}\n\n`;
      case "ol": {
        const n = parseInt(node.getAttribute("start") || "", 10);
        const start = Number.isFinite(n) ? n : 1;
        return `\n${[...node.children].map((li, i) => `${start + i}. ${walk(li).trim()}`).join("\n")}\n\n`;
      }
      case "li": return inner();
      case "a": return node.getAttribute("href") ? `[${inner()}](${mdUrl(node.getAttribute("href") || "")})` : inner();
      case "img": return node.getAttribute("src") ? `![${mdEscape(node.getAttribute("alt") || "")}](${mdUrl(node.getAttribute("src") || "")})\n` : "";
      case "video": return node.getAttribute("src") ? `![video](${mdUrl(node.getAttribute("src") || "")})\n` : "";
      // contenteditable puts each new line in a <div>: one line break, not a paragraph.
      case "div": return `\u0001d\u0002${inner()}\u0001d\u0002`;
      case "p": return `\n${inner()}\n\n`;
      case "table": return `\n${tableToMd(node, walk)}\n\n`;
      default: return inner();
    }
  };
  return walk(root)
    // Neighbouring line <div>s share one break: "a<div>b</div><div>c</div>" is three lines.
    .replace(/\n*(?:\u0001d\u0002\n*)+/g, (m) => (m.includes("\n\n") ? "\n\n" : "\n"))
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\u0001p(\d+)\u0002/g, (_m, i: string) => {
      const code = blocks[Number(i)];
      const fence = "`".repeat(Math.max(3, longestRun(code, "`") + 1));
      return `${fence}\n${code}\n${fence}`;
    });
}

function richIsEmpty(): boolean {
  if (!editor) return true;
  return !editor.querySelector("img, video, [data-up]") && !(editor.textContent || "").trim();
}

function currentBody(): string {
  if (mode === "md") return (mdArea?.value || "").replace(/⟦⏳u\d+⟧/g, "");
  if (!editor || richIsEmpty()) return "";
  const copy = editor.cloneNode(true) as HTMLElement;
  copy.querySelectorAll("[data-up]").forEach((el) => el.remove());
  // Wrap so the viewer always treats it as HTML.
  return `<div>${sanitizeHtml(copy.innerHTML)}</div>`;
}

function pendingUploads(): boolean {
  return uploads.some((u) => u.state === "up");
}

function changed(): void {
  draftDirty = true;
  editGen++;
  refreshState();
  window.clearTimeout(draftTimer);
  draftTimer = window.setTimeout(() => {
    const body = currentBody();
    flushDraft(body);
    refreshBytes(body);
  }, 400);
}

/** Cheap per-keystroke state; the byte count is debounced in changed(). */
function refreshState(): void {
  const empty = mode === "rich" ? richIsEmpty() : !(mdArea?.value || "").trim();
  editor?.classList.toggle("is-empty", mode === "rich" && empty);
  if (shareBtn) shareBtn.disabled = busy || empty || pendingUploads();
}

function refreshBytes(body = currentBody()): void {
  if (bytesEl) bytesEl.textContent = t("clip.bytes", { used: formatUsed(utf8Bytes(body)) });
}

function readDraft(): { mode: Mode; body: string } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { mode?: string; body?: string };
    if (typeof data.body !== "string") return null;
    return { mode: data.mode === "md" ? "md" : "rich", body: data.body };
  } catch {
    return null;
  }
}

function flushDraft(body?: string): void {
  window.clearTimeout(draftTimer);
  if (!draftDirty || !editor || !mdArea) return;
  draftDirty = false;
  try {
    const raw = body ?? currentBody();
    const draft = mode === "rich" ? raw.replace(/^<div>|<\/div>$/g, "") : raw;
    if (draft.trim()) localStorage.setItem(DRAFT_KEY, JSON.stringify({ mode, body: draft }));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage blocked */
  }
}

function clearDraft(): void {
  window.clearTimeout(draftTimer);
  draftDirty = false;
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage blocked */
  }
}

function clearAll(): void {
  abortUploads();
  editGen++;
  if (editor) editor.innerHTML = "";
  if (mdArea) mdArea.value = "";
  uploads = [];
  renderPills();
  resultEl?.replaceChildren();
  setStatus("");
  clearDraft();
  refreshState();
  refreshBytes();
  (mode === "rich" ? editor : mdArea)?.focus();
}

function rules(): HTMLElement {
  return h("aside", { class: "rail clip-rules" },
    h("h2", null, t("clip.rulesTitle")),
    h("ul", null,
      h("li", null, t("clip.ruleViews")),
      h("li", null, t("clip.ruleDay")),
      h("li", null, t("clip.ruleLogin")),
      h("li", null, t("clip.ruleFiles")),
    ),
  );
}

// ---- selection helpers -------------------------------------------------

function rememberRange(): void {
  if (!editor || mode !== "rich") return;
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  if (editor.contains(range.commonAncestorContainer)) savedRange = range.cloneRange();
}

function restoreRange(): void {
  if (!editor || !savedRange) return;
  const sel = window.getSelection();
  if (!sel) return;
  if (sel.rangeCount && editor.contains(sel.getRangeAt(0).commonAncestorContainer)) return;
  sel.removeAllRanges();
  sel.addRange(savedRange);
}

function caretAtPoint(e: DragEvent): Range | null {
  if (mode !== "rich" || !editor) return null;
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  let range: Range | null = null;
  if (doc.caretRangeFromPoint) range = doc.caretRangeFromPoint(e.clientX, e.clientY);
  else if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(e.clientX, e.clientY);
    if (pos) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
    }
  }
  return range && editor.contains(range.startContainer) ? range : null;
}

/** Put the selection at `at` (e.g. a drop point), else the caret, else the end of the editor. */
function selectInsertPoint(at?: Range | null): Selection | null {
  if (!editor) return null;
  editor.focus();
  const sel = window.getSelection();
  if (at) {
    sel?.removeAllRanges();
    sel?.addRange(at);
  } else restoreRange();
  if (!sel || !sel.rangeCount || !editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
    const end = document.createRange();
    end.selectNodeContents(editor);
    end.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(end);
  }
  return sel;
}

function insertRich(html: string, at?: Range | null): void {
  if (!selectInsertPoint(at)) return;
  document.execCommand("insertHTML", false, html);
  rememberRange();
}

/** Insert a node with DOM ranges (insertHTML drops non-editable spans) and move the caret after it. */
function insertNodeRich(node: Node, at?: Range | null): void {
  const sel = selectInsertPoint(at);
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  rememberRange();
}

function insertMd(snippet: string): void {
  if (!mdArea) return;
  const { selectionStart: start, selectionEnd: end, value } = mdArea;
  mdArea.value = `${value.slice(0, start)}${snippet}${value.slice(end)}`;
  mdArea.selectionStart = mdArea.selectionEnd = start + snippet.length;
}

// ---- paste --------------------------------------------------------------

/** Sanitize pasted HTML and drop media whose src did not survive (file:, data:, blob:). */
function cleanPastedHtml(html: string): string {
  // Map inline-style formatting (Google Docs, Notion…) to tags before styles are stripped.
  const raw = document.createElement("template");
  raw.innerHTML = html.replace(/<!--[\s\S]*?-->/g, "");
  raw.content.querySelectorAll("script, style").forEach((el) => el.remove());
  raw.content.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    const st = el.style;
    const weight = st.fontWeight;
    if (/^(b|strong)$/i.test(el.tagName) && (weight === "normal" || weight === "400")) {
      el.replaceWith(...el.childNodes);
      return;
    }
    let inner: HTMLElement = el;
    const wrap = (tag: string) => {
      const w = document.createElement(tag);
      w.append(...inner.childNodes);
      inner.append(w);
      inner = w;
    };
    if (weight === "bold" || Number(weight) >= 600) wrap("b");
    if (st.fontStyle === "italic") wrap("i");
    if (st.textDecorationLine?.includes("line-through") || st.textDecoration?.includes("line-through")) wrap("s");
  });
  const safe = sanitizeHtml(raw.innerHTML);
  const tpl = document.createElement("template");
  tpl.innerHTML = safe;
  tpl.content.querySelectorAll("img:not([src]), video:not([src])").forEach((el) => el.remove());
  return tpl.innerHTML;
}

function looksLikeMarkdown(text: string): boolean {
  if (/^```/m.test(text)) return true;
  const signals = [/^#{1,4}\s+\S/m, /^[-*]\s+\S/m, /^\d+[.)]\s+\S/m, /^>\s?\S/m, /\*\*[^*\n]+\*\*/, /\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)/];
  return signals.filter((re) => re.test(text)).length >= 2;
}

function onEditorPaste(e: ClipboardEvent): void {
  e.preventDefault();
  if (e.clipboardData) incoming(e.clipboardData, null);
}

/** Shared by paste and drop in rich mode. */
function incoming(dt: DataTransfer, at: Range | null): void {
  const files = [...(dt.files || [])];
  const html = dt.getData("text/html") || "";
  const text = dt.getData("text/plain") || "";
  if (html) {
    const clean = cleanPastedHtml(html);
    const keptMedia = /<(img|video)\b/i.test(clean);
    const hasText = Boolean(clean.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim());
    // Office / Feishu / screenshot tools send the image as a file plus HTML with a local src.
    if (files.length && !keptMedia) {
      if (hasText) insertRich(clean, at);
      void uploadFiles(files, hasText ? null : at);
    } else insertRich(clean, at);
  } else if (files.length) {
    void uploadFiles(files, at);
    return;
  } else if (text) {
    // Plain-text Markdown or HTML source renders, as it did in the old textarea.
    // HTML/XML source pasted as plain text is code: keep it verbatim.
    if (/^\s*</.test(text) && /<\/?[a-zA-Z]/.test(text)) insertRich(`<pre>${escapeHtml(text)}</pre><p><br></p>`, at);
    else if (looksLikeMarkdown(text)) insertRich(renderClip(text), at);
    else {
      selectInsertPoint(at);
      document.execCommand("insertText", false, text);
    }
  }
  changed();
}

function onMdPaste(e: ClipboardEvent): void {
  const files = [...(e.clipboardData?.files || [])];
  if (!files.length) return;
  e.preventDefault();
  // Finder puts the file name in text/plain; only keep text that is more than the names.
  const text = (e.clipboardData?.getData("text/plain") || "").trim();
  const names = new Set(files.map((f) => f.name));
  if (text && !text.split(/\r?\n/).every((l) => names.has(l.trim()))) insertMd(text + "\n");
  void uploadFiles(files);
}

function onWindowPaste(e: ClipboardEvent): void {
  if (e.defaultPrevented) return;
  const target = e.target as HTMLElement | null;
  if (target?.closest?.("input, textarea, [contenteditable]")) return;
  const files = [...(e.clipboardData?.files || [])];
  if (!files.length) return;
  e.preventDefault();
  void uploadFiles(files);
}

// ---- uploads ------------------------------------------------------------

function fileEmoji(type: string): string {
  if (type.startsWith("image/")) return "🖼️";
  if (type.startsWith("video/")) return "🎬";
  if (type.startsWith("audio/")) return "🎵";
  if (type === "application/pdf") return "📕";
  if (type.includes("zip")) return "🗜️";
  return "📄";
}

function renderPills(): void {
  if (!pillsEl) return;
  pillsEl.replaceChildren(...uploads.map((u) =>
    h("span", { class: `clip-pill ${u.state}` },
      `${fileEmoji(u.type)} `,
      h("span", { class: "clip-pill-name" }, u.name),
      h("span", { class: "clip-pill-meta" },
        u.state === "up" ? `${u.pct}%` : u.state === "fail" ? "✕" : formatUsed(u.size)),
    ),
  ));
}

function putWithProgress(url: string, file: File, onPct: (pct: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    activeXhrs.add(xhr);
    const done = (ok: boolean) => {
      activeXhrs.delete(xhr);
      resolve(ok);
    };
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onPct(Math.min(99, Math.round((ev.loaded / ev.total) * 100)));
    };
    xhr.onload = () => done(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => done(false);
    xhr.onabort = () => done(false);
    xhr.send(file);
  });
}

function embedFor(kind: string, name: string, url: string): { rich: string; md: string } {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(url);
  const mdName = mdEscape(name);
  if (kind === "image") return { rich: `<img src="${safeUrl}" alt="${safeName}">`, md: `![${mdName}](${url})\n` };
  if (kind === "video") return { rich: `<video controls src="${safeUrl}"></video>`, md: `![${mdName}](${url})\n` };
  return { rich: `<a href="${safeUrl}">📎 ${safeName}</a>`, md: `[${mdName}](${url})\n` };
}

function mdToken(id: string): string {
  return `⟦⏳${id}⟧`;
}

/** Drop a placeholder where the file goes now, so the final embed lands there even if the caret moves. */
function placeholder(u: Upload, at?: Range | null): void {
  if (mode === "rich") {
    insertNodeRich(h("span", { class: "clip-up", "data-up": u.id, contenteditable: "false" }, `⏳ ${u.name}`), at);
  } else insertMd(mdToken(u.id));
}

function resolvePlaceholder(u: Upload, embed: { rich: string; md: string } | null): void {
  if (editor) {
    const el = editor.querySelector(`[data-up="${u.id}"]`);
    if (el) {
      if (embed) {
        const tpl = document.createElement("template");
        tpl.innerHTML = `${embed.rich}<br>`;
        el.replaceWith(tpl.content);
      } else el.remove();
    }
  }
  const tok = mdToken(u.id);
  const at = mdArea ? mdArea.value.indexOf(tok) : -1;
  // setRangeText keeps the caret where the user is typing (assigning .value would jump to the end).
  if (mdArea && at >= 0) mdArea.setRangeText(embed ? embed.md : "", at, at + tok.length, "preserve");
}

async function uploadFiles(files: File[], at?: Range | null): Promise<void> {
  if (!files.length) return;
  const gen = uploadGen;
  resultEl?.replaceChildren();
  const batch = files.map((file) => {
    const u: Upload = { id: `u${++uploadSeq}`, name: file.name || "file", type: file.type, size: file.size, pct: 0, state: "up" };
    uploads.push(u);
    return { file, u };
  });
  // Placeholders in file order; later ones go after earlier ones at the same point.
  for (const { u } of batch) placeholder(u, at && batch[0].u === u ? at : null);
  renderPills();
  changed();
  const one = async ({ file, u }: { file: File; u: Upload }) => {
    if (gen !== uploadGen) return;
    let embed: { rich: string; md: string } | null = null;
    try {
      if (file.size > CLIP_MAX_FILE_BYTES) {
        u.state = "fail";
        setStatus(t("clip.fileTooLarge"));
        return;
      }
      const res = await fetch("/api/clip/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: file.name, type: file.type, size: file.size }),
      });
      const data = (await res.json()) as { putUrl?: string; url?: string; kind?: string; error?: string };
      if (gen !== uploadGen) return;
      if (!res.ok || !data.putUrl || !data.url) {
        u.state = "fail";
        setStatus(errorMessage(data.error));
        return;
      }
      const ok = await putWithProgress(data.putUrl, file, (pct) => {
        if (gen !== uploadGen) return;
        u.pct = pct;
        renderPills();
      });
      if (gen !== uploadGen) return;
      if (!ok) {
        u.state = "fail";
        setStatus(t("clip.unavailable"));
        return;
      }
      u.state = "done";
      embed = embedFor(data.kind || "file", file.name || "file", data.url);
    } catch {
      u.state = "fail";
      setStatus(t("clip.unavailable"));
    } finally {
      if (gen === uploadGen) {
        resolvePlaceholder(u, embed);
        renderPills();
        changed();
      }
    }
  };
  // Up to three at a time; placeholders already fix each file's position.
  const queue = [...batch];
  await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
    for (let job = queue.shift(); job; job = queue.shift()) await one(job);
  }));
}

// ---- create -------------------------------------------------------------

async function createNote(): Promise<void> {
  if (busy) return;
  if (pendingUploads()) {
    setStatus(t("clip.uploading"));
    return;
  }
  const body = currentBody();
  if (!body.trim()) {
    setStatus(t("clip.empty"));
    return;
  }
  if (utf8Bytes(body) > CLIP_MAX_BYTES) {
    setStatus(t("clip.tooLarge"));
    return;
  }
  busy = true;
  const sentGen = editGen;
  refreshState();
  setStatus(t("clip.generating"));
  const request = fetch("/api/clip", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ body }),
  }).then(async (res) => {
    const data = (await res.json()) as { id?: string; url?: string; expiresAt?: number; error?: string };
    if (!res.ok || !data.id || !data.url || !data.expiresAt) throw new Error(data.error || "unavailable");
    return data as Created;
  });
  // Start the clipboard write inside the click (Safari drops user activation after an await);
  // the promise-valued ClipboardItem resolves once the link exists.
  const early = startClipboardWrite(request.then((c) => c.url));
  try {
    const created = await request;
    const copied = (await early) || (await writeClipboard(created.url));
    setStatus(copied ? t("clip.linkCopied") : t("clip.created"), copied ? 3000 : 0);
    renderCreated(created, !copied);
    if (editGen === sentGen) clearDraft();
  } catch (err) {
    setStatus(errorMessage(err instanceof Error ? err.message : undefined));
  } finally {
    busy = false;
    refreshState();
  }
}

function startClipboardWrite(text: Promise<string>): Promise<boolean> {
  try {
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return Promise.resolve(false);
    const item = new ClipboardItem({ "text/plain": text.then((s) => new Blob([s], { type: "text/plain" })) });
    return navigator.clipboard.write([item]).then(() => true, () => false);
  } catch {
    return Promise.resolve(false);
  }
}

function renderCreated(created: Created, focusCopy: boolean): void {
  if (!resultEl) return;
  const copyBtn = h("button", {
    type: "button",
    class: "btn ghost",
    onClick: (e: Event) => void copyText(created.url, e.currentTarget as HTMLButtonElement, t("clip.copyLink")),
  }, t("clip.copyLink"));
  resultEl.replaceChildren(
    h("div", { class: "clip-url-row" },
      h("a", { class: "clip-link", href: created.url, target: "_blank", rel: "noopener" }, created.url.replace(/^https?:\/\//, "")),
      copyBtn,
    ),
    h("div", { class: "clip-meta" },
      h("span", { class: "pill" }, t("clip.viewsLeft", { n: CLIP_MAX_VIEWS })),
      h("span", { class: "pill" }, expireLabel(created.expiresAt)),
    ),
  );
  if (focusCopy) copyBtn.focus();
}

// ---- view ---------------------------------------------------------------

async function showView(page: HTMLElement, id: string): Promise<void> {
  page.replaceChildren(h("div", { class: "rail clip-compose" }, h("p", { class: "status" }, t("clip.working"))));
  try {
    const res = await fetch(`/api/clip/${id}`, { headers: { Accept: "application/json" } });
    const data = (await res.json()) as {
      body?: string;
      views?: number;
      expiresAt?: number;
      error?: string;
    };
    if (!res.ok || typeof data.body !== "string") {
      page.replaceChildren(goneCard(data.error === "gone" ? t("clip.expired") : errorMessage(data.error)));
      return;
    }
    const remaining = Math.max(0, CLIP_MAX_VIEWS - (Number(data.views) || 0));
    const body = data.body;
    const view = h("div", { class: "clip-md" });
    view.innerHTML = renderClip(body);
    page.replaceChildren(
      h("div", { class: "rail clip-compose" },
        view,
        h("div", { class: "clip-meta" },
          h("span", { class: "pill" }, remaining === 0 ? t("clip.lastView") : t("clip.viewsLeft", { n: remaining })),
          h("span", { class: "pill" }, expireLabel(Number(data.expiresAt) || 0)),
        ),
        h("div", { class: "stage-actions" },
          h("button", {
            type: "button",
            class: "btn",
            onClick: (e: Event) => void copyRich(view, e.currentTarget as HTMLButtonElement, t("clip.copyRich")),
          }, t("clip.copyRich")),
          h("button", {
            type: "button",
            class: "btn ghost",
            onClick: (e: Event) => void copyText(body, e.currentTarget as HTMLButtonElement, t("clip.copySource")),
          }, t("clip.copySource")),
          h("button", {
            type: "button",
            class: "btn ghost",
            onClick: (e: Event) => void copyText(location.href, e.currentTarget as HTMLButtonElement, t("clip.share")),
          }, t("clip.share")),
          h("a", { class: "btn ghost", href: appHref(locale(), null), "data-nav": "home" }, t("clip.new")),
        ),
      ),
    );
  } catch {
    page.replaceChildren(goneCard(t("clip.unavailable")));
  }
}

function goneCard(message: string): HTMLElement {
  return h("div", { class: "rail clip-compose" },
    h("p", { class: "status" }, message),
    h("div", { class: "stage-actions" },
      h("a", { class: "btn", href: appHref(locale(), null), "data-nav": "home" }, t("clip.new")),
    ),
  );
}

// ---- misc ---------------------------------------------------------------

function formatUsed(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function expireLabel(expiresAt: number): string {
  const clock = remainingClock(expiresAt - Date.now());
  if (!clock) return t("clip.expired");
  if (clock.h > 0) return t("clip.expiresH", { h: clock.h, m: clock.m });
  return t("clip.expiresM", { m: clock.m });
}

function setStatus(text: string, clearAfter = 0): void {
  window.clearTimeout(statusTimer);
  if (statusEl) statusEl.textContent = text;
  if (clearAfter) statusTimer = window.setTimeout(() => { if (statusEl) statusEl.textContent = ""; }, clearAfter);
}

function errorMessage(code: string | undefined): string {
  if (code === "empty") return t("clip.empty");
  if (code === "too_large") return t("clip.tooLarge");
  if (code === "file_too_large") return t("clip.fileTooLarge");
  if (code === "file_type") return t("clip.fileType");
  if (code === "rate") return t("clip.rate");
  if (code === "gone") return t("clip.gone");
  return t("clip.unavailable");
}

async function writeClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const probe = h("textarea", { class: "sr-only", value });
    document.body.append(probe);
    probe.select();
    const ok = document.execCommand("copy");
    probe.remove();
    return ok;
  }
}

async function copyText(value: string, button: HTMLButtonElement, restore: string): Promise<void> {
  await writeClipboard(value);
  flash(button, restore);
}

/** Copy rendered content as rich text (HTML + plain), falling back to plain text. */
async function copyRich(view: HTMLElement, button: HTMLButtonElement, restore: string): Promise<void> {
  const html = view.innerHTML;
  const plain = view.innerText;
  try {
    if (typeof ClipboardItem === "undefined") throw new Error("no ClipboardItem");
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      }),
    ]);
  } catch {
    await writeClipboard(plain);
  }
  flash(button, restore);
}

function flash(button: HTMLButtonElement, restore: string): void {
  button.textContent = t("clip.copied");
  window.setTimeout(() => {
    button.textContent = restore;
  }, 1600);
}
