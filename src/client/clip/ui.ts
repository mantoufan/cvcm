import { CLIP_MAX_BYTES, CLIP_MAX_VIEWS, remainingClock, utf8Bytes } from "../../shared/clip";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";

type Created = { id: string; url: string; expiresAt: number };
type Viewed = { body: string; views: number; expiresAt: number };

let textarea: HTMLTextAreaElement | null = null;
let statusEl: HTMLElement | null = null;
let resultEl: HTMLElement | null = null;
let bytesEl: HTMLElement | null = null;
let busy = false;

export async function mountClip(host: HTMLElement, clipId: string | null): Promise<void> {
  busy = false;
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
  else showCompose(page);
}

export function unmountClip(): void {
  textarea = null;
  statusEl = null;
  resultEl = null;
  bytesEl = null;
  busy = false;
}

function showCompose(page: HTMLElement, created?: Created): void {
  page.replaceChildren();
  textarea = h("textarea", {
    class: "clip-input",
    placeholder: t("clip.placeholder"),
    spellcheck: "false",
    "aria-label": t("clip.bodyLabel"),
    onInput: () => refreshBytes(),
  });
  statusEl = h("p", { class: "status" });
  resultEl = h("div", { class: "clip-result" });
  bytesEl = h("p", { class: "muted clip-bytes" });
  page.append(
    h("div", { class: "rail clip-compose" },
      h("h2", null, t("clip.bodyLabel")),
      textarea,
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
  if (created) renderCreated(created);
  textarea.focus();
}

async function showView(page: HTMLElement, id: string): Promise<void> {
  page.replaceChildren(
    h("div", { class: "rail clip-compose" },
      h("p", { class: "status" }, t("clip.working")),
    ),
  );
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
    renderViewed(page, {
      body: data.body,
      views: Number(data.views) || 0,
      expiresAt: Number(data.expiresAt) || 0,
    });
  } catch {
    page.replaceChildren(goneCard(t("clip.unavailable")));
  }
}

function renderViewed(page: HTMLElement, viewed: Viewed): void {
  const remaining = Math.max(0, CLIP_MAX_VIEWS - viewed.views);
  const meta = remaining === 0
    ? t("clip.lastView")
    : t("clip.viewsLeft", { n: remaining });
  page.replaceChildren(
    h("div", { class: "rail clip-compose" },
      h("h2", null, t("clip.bodyLabel")),
      h("pre", { class: "clip-pre" }, viewed.body),
      h("div", { class: "clip-meta" },
        h("span", { class: "pill" }, meta),
        h("span", { class: "pill" }, expireLabel(viewed.expiresAt)),
      ),
      h("div", { class: "stage-actions" },
        h("button", {
          type: "button",
          class: "btn",
          onClick: (e: Event) => void copyText(viewed.body, e.currentTarget as HTMLButtonElement, t("clip.copyText")),
        }, t("clip.copyText")),
        h("a", { class: "btn ghost", href: appHref(locale(), "clip"), "data-nav": "clip" }, t("clip.new")),
      ),
    ),
  );
}

function goneCard(message: string): HTMLElement {
  return h("div", { class: "rail clip-compose" },
    h("p", { class: "status" }, message),
    h("div", { class: "stage-actions" },
      h("a", { class: "btn", href: appHref(locale(), "clip"), "data-nav": "clip" }, t("clip.new")),
    ),
  );
}

function rules(): HTMLElement {
  return h("aside", { class: "rail clip-rules" },
    h("h2", null, t("clip.rulesTitle")),
    h("ul", null,
      h("li", null, t("clip.ruleViews")),
      h("li", null, t("clip.ruleDay")),
      h("li", null, t("clip.ruleLogin")),
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
  if (code === "rate") return t("clip.rate");
  if (code === "gone") return t("clip.gone");
  return t("clip.unavailable");
}

async function pasteInto(): Promise<void> {
  if (!textarea) return;
  try {
    const text = await navigator.clipboard.readText();
    if (!text) return;
    textarea.value = text;
    refreshBytes();
    textarea.focus();
  } catch {
    setStatus(t("clip.unavailable"));
  }
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
