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
type Upload = { name: string; type: string; size: number; pct: number; state: "up" | "done" | "fail" };

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
let busy = false;
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
  savedRange = null;
  const page = h("div", { class: "clip" + (opts.rules ? "" : " solo") });
  host.append(page);
  showCompose(page, Boolean(opts.rules));
  window.addEventListener("paste", onWindowPaste);
  document.addEventListener("selectionchange", rememberRange);
}

export function unmountClip(): void {
  window.removeEventListener("paste", onWindowPaste);
  document.removeEventListener("selectionchange", rememberRange);
  window.clearTimeout(statusTimer);
  flushDraft();
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
  });
  mdArea = h("textarea", {
    class: "clip-input",
    placeholder: t("clip.mdPlaceholder"),
    spellcheck: "false",
    "aria-label": t("clip.bodyLabel"),
    onInput: () => changed(),
    onPaste: (e: Event) => onMdPaste(e as ClipboardEvent),
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
        const files = [...((e as DragEvent).dataTransfer?.files || [])];
        (e.currentTarget as HTMLElement).classList.remove("over");
        if (!files.length) return;
        e.preventDefault();
        placeCaretAtPoint(e as DragEvent);
        void uploadFiles(files);
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
  if (next === "md") mdArea.value = domToMarkdown(editor).trim();
  else editor.innerHTML = mdArea.value.trim() ? renderClip(mdArea.value) : "";
  mode = next;
  applyMode();
  changed();
}

function applyMode(): void {
  if (!editor || !mdArea) return;
  editor.hidden = mode !== "rich";
  mdArea.hidden = mode !== "md";
  for (const btn of modeBtns) btn.classList.toggle("on", btn.dataset.mode === mode);
  (mode === "rich" ? editor : mdArea).focus();
}

/** Serialize the rich editor back to Markdown for the MD tab. */
function domToMarkdown(root: Node): string {
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent || "").replace(/ /g, " ");
    if (!(node instanceof Element)) return "";
    const tag = node.tagName.toLowerCase();
    const inner = () => [...node.childNodes].map(walk).join("");
    switch (tag) {
      case "br": return "\n";
      case "b": case "strong": return `**${inner()}**`;
      case "i": case "em": return `*${inner()}*`;
      case "u": return `++${inner()}++`;
      case "s": case "strike": case "del": return `~~${inner()}~~`;
      case "code": return node.closest("pre") ? inner() : `\`${inner()}\``;
      case "pre": return `\n\`\`\`\n${node.textContent || ""}\n\`\`\`\n\n`;
      case "h1": return `\n# ${inner()}\n\n`;
      case "h2": return `\n## ${inner()}\n\n`;
      case "h3": return `\n### ${inner()}\n\n`;
      case "h4": return `\n#### ${inner()}\n\n`;
      case "blockquote": return `\n${inner().split("\n").filter(Boolean).map((l) => `> ${l}`).join("\n")}\n\n`;
      case "ul": return `\n${[...node.children].map((li) => `- ${walk(li).trim()}`).join("\n")}\n\n`;
      case "ol": return `\n${[...node.children].map((li, i) => `${i + 1}. ${walk(li).trim()}`).join("\n")}\n\n`;
      case "li": return inner();
      case "a": return `[${inner()}](${node.getAttribute("href") || ""})`;
      case "img": return node.getAttribute("src") ? `![${node.getAttribute("alt") || ""}](${node.getAttribute("src")})\n` : "";
      case "video": return node.getAttribute("src") ? `![video](${node.getAttribute("src")})\n` : "";
      case "p": case "div": return `${inner()}\n\n`;
      default: return inner();
    }
  };
  return walk(root).replace(/\n{3,}/g, "\n\n");
}

function currentBody(): string {
  if (mode === "md") return mdArea?.value || "";
  if (!editor) return "";
  const hasMedia = editor.querySelector("img, video");
  if (!hasMedia && !(editor.textContent || "").trim()) return "";
  // Wrap so the viewer always treats it as HTML.
  return `<div>${sanitizeHtml(editor.innerHTML)}</div>`;
}

function changed(): void {
  refreshState();
  window.clearTimeout(draftTimer);
  draftTimer = window.setTimeout(flushDraft, 400);
}

function refreshState(): void {
  const body = currentBody();
  editor?.classList.toggle("is-empty", mode === "rich" && !body);
  if (bytesEl) bytesEl.textContent = t("clip.bytes", { used: formatUsed(utf8Bytes(body)) });
  if (shareBtn) shareBtn.disabled = busy || !body.trim() || uploads.some((u) => u.state === "up");
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

function flushDraft(): void {
  window.clearTimeout(draftTimer);
  if (!editor || !mdArea) return;
  try {
    const body = mode === "rich" ? editor.innerHTML : mdArea.value;
    if (body.trim()) localStorage.setItem(DRAFT_KEY, JSON.stringify({ mode, body }));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage blocked */
  }
}

function clearDraft(): void {
  window.clearTimeout(draftTimer);
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage blocked */
  }
}

function clearAll(): void {
  if (editor) editor.innerHTML = "";
  if (mdArea) mdArea.value = "";
  uploads = [];
  renderPills();
  resultEl?.replaceChildren();
  setStatus("");
  clearDraft();
  refreshState();
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

function placeCaretAtPoint(e: DragEvent): void {
  if (mode !== "rich" || !editor) return;
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
  if (range && editor.contains(range.startContainer)) savedRange = range;
}

function insertRich(html: string): void {
  if (!editor) return;
  editor.focus();
  restoreRange();
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
    const end = document.createRange();
    end.selectNodeContents(editor);
    end.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(end);
  }
  document.execCommand("insertHTML", false, html);
  rememberRange();
}

function insertMd(snippet: string): void {
  if (!mdArea) return;
  const { selectionStart: start, selectionEnd: end, value } = mdArea;
  mdArea.value = `${value.slice(0, start)}${snippet}${value.slice(end)}`;
  mdArea.selectionStart = mdArea.selectionEnd = start + snippet.length;
}

// ---- paste --------------------------------------------------------------

function onEditorPaste(e: ClipboardEvent): void {
  const files = [...(e.clipboardData?.files || [])];
  const html = e.clipboardData?.getData("text/html") || "";
  e.preventDefault();
  if (files.length && !html) {
    void uploadFiles(files);
    return;
  }
  if (html) {
    // Media whose src was unsafe comes back as a bare <img>/<video>; drop those.
    const clean = sanitizeHtml(html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(style|script)[\s\S]*?<\/\1>/gi, ""))
      .replace(/<img\s*\/?>|<video>\s*<\/video>/gi, "");
    insertRich(clean);
  } else {
    const text = e.clipboardData?.getData("text/plain") || "";
    if (text) document.execCommand("insertText", false, text);
  }
  changed();
}

function onMdPaste(e: ClipboardEvent): void {
  const files = [...(e.clipboardData?.files || [])];
  if (!files.length) return;
  e.preventDefault();
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
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onPct(Math.min(99, Math.round((ev.loaded / ev.total) * 100)));
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.send(file);
  });
}

function embedFor(kind: string, name: string, url: string): { rich: string; md: string } {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(url);
  if (kind === "image") return { rich: `<img src="${safeUrl}" alt="${safeName}"><br>`, md: `![${name}](${url})\n` };
  if (kind === "video") return { rich: `<video controls src="${safeUrl}"></video><br>`, md: `![${name}](${url})\n` };
  return { rich: `<a href="${safeUrl}">📎 ${safeName}</a><br>`, md: `[${name}](${url})\n` };
}

async function uploadFiles(files: File[]): Promise<void> {
  if (!files.length) return;
  resultEl?.replaceChildren();
  const batch = files.map((file) => {
    const u: Upload = { name: file.name || "file", type: file.type, size: file.size, pct: 0, state: "up" };
    uploads.push(u);
    return { file, u };
  });
  renderPills();
  refreshState();
  for (const { file, u } of batch) {
    try {
      if (file.size > CLIP_MAX_FILE_BYTES) {
        u.state = "fail";
        setStatus(t("clip.fileTooLarge"));
        continue;
      }
      const res = await fetch("/api/clip/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: file.name, type: file.type, size: file.size }),
      });
      const data = (await res.json()) as { putUrl?: string; url?: string; kind?: string; error?: string };
      if (!res.ok || !data.putUrl || !data.url) {
        u.state = "fail";
        setStatus(errorMessage(data.error));
        continue;
      }
      const ok = await putWithProgress(data.putUrl, file, (pct) => { u.pct = pct; renderPills(); });
      if (!ok) {
        u.state = "fail";
        setStatus(t("clip.unavailable"));
        continue;
      }
      u.state = "done";
      if (!editor) return;
      const embed = embedFor(data.kind || "file", file.name || "file", data.url);
      if (mode === "rich") insertRich(embed.rich);
      else insertMd(embed.md);
    } catch {
      u.state = "fail";
      setStatus(t("clip.unavailable"));
    } finally {
      renderPills();
      changed();
    }
  }
}

// ---- create -------------------------------------------------------------

async function createNote(): Promise<void> {
  if (busy) return;
  if (uploads.some((u) => u.state === "up")) {
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
  refreshState();
  setStatus(t("clip.generating"));
  try {
    const res = await fetch("/api/clip", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const data = (await res.json()) as { id?: string; url?: string; expiresAt?: number; error?: string };
    if (!res.ok || !data.id || !data.url || !data.expiresAt) {
      setStatus(errorMessage(data.error));
      return;
    }
    const copied = await writeClipboard(data.url);
    setStatus(copied ? t("clip.linkCopied") : "", 3000);
    renderCreated({ id: data.id, url: data.url, expiresAt: data.expiresAt });
    clearDraft();
  } catch {
    setStatus(t("clip.unavailable"));
  } finally {
    busy = false;
    refreshState();
  }
}

function renderCreated(created: Created): void {
  if (!resultEl) return;
  resultEl.replaceChildren(
    h("div", { class: "clip-url-row" },
      h("a", { class: "clip-link", href: created.url, target: "_blank", rel: "noopener" }, created.url.replace(/^https?:\/\//, "")),
      h("button", {
        type: "button",
        class: "btn ghost",
        onClick: (e: Event) => void copyText(created.url, e.currentTarget as HTMLButtonElement, t("clip.copyLink")),
      }, t("clip.copyLink")),
    ),
    h("div", { class: "clip-meta" },
      h("span", { class: "pill" }, t("clip.viewsLeft", { n: CLIP_MAX_VIEWS })),
      h("span", { class: "pill" }, expireLabel(created.expiresAt)),
    ),
  );
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
