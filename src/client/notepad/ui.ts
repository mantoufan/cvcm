import { copyWithFlash } from "../copy";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { countText } from "../../shared/word-count";
import { MAX_NOTE, noteFileName, parseNote } from "../../shared/notepad";

const STORE_KEY = "cvcm.notepad.v1";
const PREFS_KEY = "cvcm.notepad.prefs.v1";
const SAVE_MS = 400;
const UNDO_MS = 8000;
/** Biggest file Open reads (bytes): even plain ASCII then fits the note's character limit, so nothing is cut off. */
const MAX_FILE = 1_000_000;

let textEl: HTMLTextAreaElement | null = null;
let statsEl: HTMLElement | null = null;
let savedEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let undoBtn: HTMLButtonElement | null = null;
let fileEl: HTMLInputElement | null = null;
let wrapEl: HTMLInputElement | null = null;
let monoEl: HTMLInputElement | null = null;
let saveTimer = 0;
let undoTimer = 0;
/** The note before Clear, offered back for a few seconds. */
let undoText: string | null = null;
let storageOk = true;

export function mountNotepad(host: HTMLElement): void {
  storageOk = true;
  undoText = null;
  const prefs = loadPrefs();
  textEl = h("textarea", {
    class: "clip-input note-text",
    "data-field": "note",
    maxlength: String(MAX_NOTE),
    "aria-label": t("notepad.title"),
    placeholder: t("notepad.placeholder"),
    onInput: () => {
      dropUndo();
      paintStats();
      scheduleSave();
    },
  });
  statsEl = h("p", { class: "hint", "data-out": "stats", "aria-live": "off" });
  // Empty in the prerendered page; the saved note is filled in on the reader's own device.
  savedEl = h("p", { class: "hint", "data-out": "saved", "data-volatile": "" });
  wrapEl = h("input", { type: "checkbox", checked: prefs.wrap, "data-field": "wrap", onChange: () => applyPrefs(true) });
  monoEl = h("input", { type: "checkbox", checked: prefs.mono, "data-field": "mono", onChange: () => applyPrefs(true) });
  fileEl = h("input", { type: "file", accept: ".txt,.md,.markdown,.csv,.json,.log,text/*", hidden: true, onChange: () => void openFile() });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("notepad.back")),
      h("h1", null, t("notepad.title")),
      h("p", { class: "lede" }, t("notepad.privacyNote")),
    ),
    h("div", { class: "data-tool note-tool" },
      h("div", { class: "rail" }, textEl, statsEl, savedEl),
      h("aside", { class: "rail controls" },
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", "data-action": "copy", onClick: () => void copyNote() }, t("notepad.copy")),
          h("button", { type: "button", class: "btn ghost", "data-action": "download", onClick: () => download() }, t("notepad.download")),
          h("button", { type: "button", class: "btn ghost", "data-action": "open", onClick: () => fileEl?.click() }, t("notepad.open")),
          h("button", { type: "button", class: "btn ghost", "data-action": "clear", onClick: () => clearNote() }, t("notepad.clear")),
          undoBtn = h("button", { type: "button", class: "btn ghost", "data-action": "undo", hidden: true, onClick: () => undo() }, t("notepad.undo")),
        ),
        fileEl,
        h("fieldset", null,
          h("legend", null, t("notepad.options")),
          h("label", { class: "check" }, wrapEl, h("span", null, t("notepad.wrap"))),
          h("label", { class: "check" }, monoEl, h("span", null, t("notepad.mono"))),
        ),
        h("p", { class: "hint" }, t("notepad.hint")),
      ),
    ),
  );
  const note = load();
  if (note) textEl.value = note.text;
  applyPrefs(false);
  paintStats();
  paintSaved(note?.savedAt ?? 0);
  window.addEventListener("storage", onStorage);
  window.addEventListener("pagehide", flush);
}

export function unmountNotepad(): void {
  flush();
  window.removeEventListener("storage", onStorage);
  window.removeEventListener("pagehide", flush);
  window.clearTimeout(undoTimer);
  textEl = statsEl = savedEl = null;
  copyBtn = undoBtn = null;
  fileEl = wrapEl = monoEl = null;
  undoText = null;
}

function load(): ReturnType<typeof parseNote> {
  try {
    return parseNote(window.localStorage.getItem(STORE_KEY));
  } catch {
    storageOk = false;
    return null;
  }
}

function loadPrefs(): { wrap: boolean; mono: boolean } {
  try {
    const p = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "{}") as { wrap?: unknown; mono?: unknown };
    return { wrap: p.wrap !== false, mono: p.mono === true };
  } catch {
    return { wrap: true, mono: false };
  }
}

function applyPrefs(store: boolean): void {
  if (!textEl || !wrapEl || !monoEl) return;
  textEl.classList.toggle("nowrap", !wrapEl.checked);
  textEl.classList.toggle("mono", monoEl.checked);
  if (!store) return;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify({ wrap: wrapEl.checked, mono: monoEl.checked }));
  } catch { /* storage blocked */ }
}

function scheduleSave(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(save, SAVE_MS);
}

/** Saves now if a save is waiting (leaving the page or the tool must not lose the last keystrokes). */
function flush(): void {
  if (!saveTimer) return;
  save();
}

function save(): void {
  window.clearTimeout(saveTimer);
  saveTimer = 0;
  if (!textEl) return;
  const savedAt = Date.now();
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify({ text: textEl.value, savedAt }));
    storageOk = true;
  } catch {
    storageOk = false;
  }
  paintSaved(savedAt);
}

/** Another tab saved the note: show it here too, unless this tab has unsaved typing (then this tab's save wins). */
function onStorage(e: StorageEvent): void {
  if (e.key !== STORE_KEY || !textEl || saveTimer) return;
  const note = parseNote(e.newValue);
  if (!note || note.text === textEl.value) return;
  const focused = document.activeElement === textEl;
  const { selectionStart, selectionEnd } = textEl;
  textEl.value = note.text;
  if (focused) textEl.setSelectionRange(Math.min(selectionStart, note.text.length), Math.min(selectionEnd, note.text.length));
  dropUndo();
  paintStats();
  paintSaved(note.savedAt);
}

function paintStats(): void {
  if (!textEl || !statsEl) return;
  const s = countText(textEl.value);
  statsEl.textContent = t("notepad.stats", { words: s.words, chars: s.chars, lines: s.lines });
}

function paintSaved(at: number): void {
  if (!savedEl) return;
  if (!storageOk) {
    savedEl.textContent = t("notepad.notSaved");
    savedEl.classList.add("error");
    return;
  }
  savedEl.classList.remove("error");
  savedEl.textContent = at
    ? t("notepad.savedAt", { time: new Date(at).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" }) })
    : t("notepad.autosave");
}

function clearNote(): void {
  if (!textEl || !textEl.value) return;
  undoText = textEl.value;
  textEl.value = "";
  if (undoBtn) undoBtn.hidden = false;
  window.clearTimeout(undoTimer);
  undoTimer = window.setTimeout(dropUndo, UNDO_MS);
  paintStats();
  save();
  textEl.focus();
}

function undo(): void {
  if (!textEl || undoText === null) return;
  textEl.value = undoText;
  dropUndo();
  paintStats();
  save();
}

function dropUndo(): void {
  window.clearTimeout(undoTimer);
  undoText = null;
  if (undoBtn) undoBtn.hidden = true;
}

function today(): string {
  const d = new Date();
  return `note-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function download(): void {
  if (!textEl) return;
  // Windows line ends are not needed: every current editor reads \n.
  downloadBlob(new Blob([textEl.value], { type: "text/plain;charset=utf-8" }), noteFileName(textEl.value, today()));
}

async function openFile(): Promise<void> {
  const file = fileEl?.files?.[0];
  if (fileEl) fileEl.value = "";
  if (!file || !textEl || !savedEl) return;
  if (file.size > MAX_FILE) {
    savedEl.textContent = t("notepad.tooBig");
    savedEl.classList.add("error");
    return;
  }
  const text = (await file.text()).replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  if (!textEl || !savedEl) return;
  if (text.length > MAX_NOTE) {
    savedEl.textContent = t("notepad.tooBig");
    savedEl.classList.add("error");
    return;
  }
  // Opening replaces the note; the old one can come back with Undo.
  if (textEl.value) {
    undoText = textEl.value;
    if (undoBtn) undoBtn.hidden = false;
    window.clearTimeout(undoTimer);
    undoTimer = window.setTimeout(dropUndo, UNDO_MS);
  }
  textEl.value = text;
  paintStats();
  save();
}

async function copyNote(): Promise<void> {
  if (!textEl?.value) return;
  await copyWithFlash(copyBtn, textEl.value, { done: t("notepad.copied"), failed: t("notepad.copyFailed") });
}
