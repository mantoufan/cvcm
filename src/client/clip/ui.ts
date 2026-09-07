import {
  CLIP_MAX_BYTES,
  CLIP_MAX_FILE_BYTES,
  CLIP_MAX_VIEWS,
  remainingClock,
  utf8Bytes,
} from "../../shared/clip";
import { renderClip } from "../../shared/md";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";

type Created = { id: string; url: string; expiresAt: number };

let textarea: HTMLTextAreaElement | null = null;
let statusEl: HTMLElement | null = null;
let resultEl: HTMLElement | null = null;
let bytesEl: HTMLElement | null = null;
let previewEl: HTMLElement | null = null;
let previewing = false;
let busy = false;

export async function mountClip(host: HTMLElement, clipId: string | null): Promise<void> {
  busy = false;
  previewing = false;
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("clip.back")),
      h("h1", null, t("clip.title")),
      h("p", { class: "lede" }, t("clip.privacyNote")),
    ),
  );
  const page = h("div", { class: "clip" });
  host.append(page);
  if (clipId) await showView(page, clipId);
  else {
    showCompose(page);
    window.addEventListener("paste", onPaste);
  }
}

export function unmountClip(): void {
  window.removeEventListener("paste", onPaste);
  textarea = null;
  statusEl = null;
  resultEl = null;
  bytesEl = null;
  previewEl = null;
  busy = false;
  previewing = false;
}

function showCompose(page: HTMLElement): void {
  page.replaceChildren();
  textarea = h("textarea", {
    class: "clip-input",
    placeholder: t("clip.placeholder"),
    spellcheck: "false",
    "aria-label": t("clip.bodyLabel"),
    onInput: () => refreshBytes(),
  });
  previewEl = h("div", { class: "clip-md clip-preview", hidden: true });
  statusEl = h("p", { class: "status" });
  resultEl = h("div", { class: "clip-result" });
  bytesEl = h("p", { class: "muted clip-bytes" });
  const imageInput = fileInput("image/*", (files) => void uploadFiles(files, "image"));
  const videoInput = fileInput("video/*", (files) => void uploadFiles(files, "video"));
  const filePick = fileInput("*/*", (files) => void uploadFiles(files, "file"));
  page.append(
    h("div", {
      class: "rail clip-compose",
      onDragover: (e: Event) => { e.preventDefault(); (e.currentTarget as HTMLElement).classList.add("over"); },
      onDragleave: (e: Event) => { (e.currentTarget as HTMLElement).classList.remove("over"); },
      onDrop: (e: Event) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).classList.remove("over");
        const files = [...((e as DragEvent).dataTransfer?.files || [])];
        if (files.length) void uploadFiles(files);
      },
    },
      toolbar(imageInput, videoInput, filePick),
      textarea,
      previewEl,
      bytesEl,
      h("div", { class: "stage-actions" },
        h("button", { type: "button", class: "btn", onClick: () => void createNote() }, t("clip.submit")),
        h("button", { type: "button", class: "btn ghost", onClick: () => void pasteInto() }, t("clip.paste")),
      ),
      statusEl,
      resultEl,
    ),
    rules(),
  );
  refreshBytes();
  textarea.focus();
}

function toolbar(
  imageInput: HTMLInputElement,
  videoInput: HTMLInputElement,
  filePick: HTMLInputElement,
): HTMLElement {
  return h("div", { class: "clip-bar" },
    imageInput,
    videoInput,
    filePick,
    h("button", { type: "button", class: "chip", onClick: () => imageInput.click() }, t("clip.imageBtn")),
    h("button", { type: "button", class: "chip", onClick: () => videoInput.click() }, t("clip.videoBtn")),
    h("button", { type: "button", class: "chip", onClick: () => filePick.click() }, t("clip.attachBtn")),
    h("button", {
      type: "button",
      class: "chip",
      onClick: () => togglePreview(),
    }, previewing ? t("clip.edit") : t("clip.preview")),
  );
}

function fileInput(accept: string, onFiles: (files: File[]) => void): HTMLInputElement {
  return h("input", {
    type: "file",
    class: "sr-only",
    accept,
    multiple: true,
    onChange: (e: Event) => {
      const input = e.currentTarget as HTMLInputElement;
      onFiles([...(input.files || [])]);
      input.value = "";
    },
  });
}

function togglePreview(): void {
  if (!textarea || !previewEl) return;
  previewing = !previewing;
  textarea.hidden = previewing;
  previewEl.hidden = !previewing;
  if (previewing) previewEl.innerHTML = renderClip(textarea.value || " ");
  const btn = document.querySelector(".clip-bar .chip:last-child");
  if (btn) btn.textContent = previewing ? t("clip.edit") : t("clip.preview");
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
            onClick: (e: Event) => void copyText(body, e.currentTarget as HTMLButtonElement, t("clip.copySource")),
          }, t("clip.copySource")),
          h("a", { class: "btn ghost", href: appHref(locale(), "clip"), "data-nav": "clip" }, t("clip.new")),
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
      h("a", { class: "btn", href: appHref(locale(), "clip"), "data-nav": "clip" }, t("clip.new")),
    ),
  );
}

function refreshBytes(): void {
  if (!bytesEl || !textarea) return;
  bytesEl.textContent = t("clip.bytes", { used: formatUsed(utf8Bytes(textarea.value)) });
}

function formatUsed(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

function expireLabel(expiresAt: number): string {
  const clock = remainingClock(expiresAt - Date.now());
  if (!clock) return t("clip.expired");
  if (clock.h > 0) return t("clip.expiresH", { h: clock.h, m: clock.m });
  return t("clip.expiresM", { m: clock.m });
}

function setStatus(text: string): void {
  if (statusEl) statusEl.textContent = text;
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

function insertAtCursor(snippet: string): void {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  textarea.value = `${value.slice(0, start)}${snippet}${value.slice(end)}`;
  const pos = start + snippet.length;
  textarea.selectionStart = textarea.selectionEnd = pos;
  refreshBytes();
}

function markdownFor(kind: string, name: string, url: string): string {
  if (kind === "image") return `![${name}](${url})\n`;
  if (kind === "video") return `![${name}](${url})\n`;
  return `[${name}](${url})\n`;
}

async function uploadFiles(files: File[], prefer?: "image" | "video" | "file"): Promise<void> {
  if (!files.length || busy) return;
  busy = true;
  setStatus(t("clip.uploading"));
  try {
    for (const file of files) {
      if (file.size > CLIP_MAX_FILE_BYTES) {
        setStatus(t("clip.fileTooLarge"));
        continue;
      }
      const res = await fetch("/api/clip/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: file.name, type: file.type, size: file.size }),
      });
      const data = (await res.json()) as {
        putUrl?: string;
        url?: string;
        kind?: string;
        error?: string;
      };
      if (!res.ok || !data.putUrl || !data.url) {
        setStatus(errorMessage(data.error));
        continue;
      }
      const put = await fetch(data.putUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) {
        setStatus(t("clip.unavailable"));
        continue;
      }
      insertAtCursor(markdownFor(prefer || data.kind || "file", file.name, data.url));
    }
    setStatus("");
    if (previewing && previewEl && textarea) previewEl.innerHTML = renderClip(textarea.value);
  } catch {
    setStatus(t("clip.unavailable"));
  } finally {
    busy = false;
  }
}

async function pasteInto(): Promise<void> {
  if (!textarea) return;
  try {
    const text = await navigator.clipboard.readText();
    if (text) insertAtCursor(text);
  } catch {
    setStatus(t("clip.unavailable"));
  }
}

function onPaste(e: ClipboardEvent): void {
  const files = [...(e.clipboardData?.files || [])];
  if (!files.length) return;
  e.preventDefault();
  void uploadFiles(files);
}

async function createNote(): Promise<void> {
  if (busy || !textarea) return;
  const body = textarea.value;
  if (!body.trim()) {
    setStatus(t("clip.empty"));
    return;
  }
  if (utf8Bytes(body) > CLIP_MAX_BYTES) {
    setStatus(t("clip.tooLarge"));
    return;
  }
  busy = true;
  setStatus(t("clip.working"));
  try {
    const res = await fetch("/api/clip", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const data = (await res.json()) as {
      id?: string;
      url?: string;
      expiresAt?: number;
      error?: string;
    };
    if (!res.ok || !data.id || !data.url || !data.expiresAt) {
      setStatus(errorMessage(data.error));
      return;
    }
    setStatus("");
    renderCreated({ id: data.id, url: data.url, expiresAt: data.expiresAt });
  } catch {
    setStatus(t("clip.unavailable"));
  } finally {
    busy = false;
  }
}

function renderCreated(created: Created): void {
  if (!resultEl) return;
  const urlInput = h("input", {
    type: "text",
    class: "clip-url",
    value: created.url,
    readOnly: true,
    "aria-label": t("clip.copyLink"),
  });
  resultEl.replaceChildren(
    h("h2", null, t("clip.created")),
    h("div", { class: "clip-url-row" },
      urlInput,
      h("button", {
        type: "button",
        class: "btn",
        onClick: (e: Event) => void copyText(created.url, e.currentTarget as HTMLButtonElement, t("clip.copyLink")),
      }, t("clip.copyLink")),
    ),
    h("div", { class: "clip-meta" },
      h("span", { class: "pill" }, t("clip.viewsLeft", { n: CLIP_MAX_VIEWS })),
      h("span", { class: "pill" }, expireLabel(created.expiresAt)),
    ),
  );
  urlInput.focus();
  urlInput.select();
}

async function copyText(value: string, button: HTMLButtonElement, restore: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const probe = h("textarea", { class: "sr-only", value });
    document.body.append(probe);
    probe.select();
    document.execCommand("copy");
    probe.remove();
  }
  button.textContent = t("clip.copied");
  window.setTimeout(() => {
    button.textContent = restore;
  }, 1600);
}
