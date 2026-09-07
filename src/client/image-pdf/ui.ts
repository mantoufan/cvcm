import { outputFilename } from "../../shared/filename";
import { pdfFromJpegs } from "../../shared/pdf";
import { canvasToBlob, decodeImage, drawToCanvas } from "../decode";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { clearDraft, debounce, loadDraft, markSession, saveDraft, sessionLive } from "../session";

type Item = {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
  bitmap: ImageBitmap | null;
  error: string | null;
};

const state = {
  items: [] as Item[],
  quality: 0.92,
};

let preview: HTMLCanvasElement | null = null;
let fileList: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let pagehideBound = false;
let restoring = false;
let hydrated = false;
const scheduleSave = debounce(() => {
  void persist();
}, 400);

export async function mountImagePdf(host: HTMLElement): Promise<void> {
  restoring = true;
  if (!hydrated) {
    if (sessionLive()) await restore();
    else await clearDraft("image-pdf");
    markSession();
    hydrated = true;
  }
  restoring = false;
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("imagePdf.back")),
      h("h1", null, t("imagePdf.title")),
      h("p", { class: "lede" }, t("imagePdf.privacyNote")),
    ),
    h("div", { class: "tool" },
      filesRail(),
      stagePane(),
      controls(),
    ),
  );
  refreshList();
  redraw();
  window.addEventListener("paste", onPaste);
  if (!pagehideBound) {
    pagehideBound = true;
    window.addEventListener("pagehide", () => {
      void persist();
    });
  }
}

export function unmountImagePdf(): void {
  window.removeEventListener("paste", onPaste);
  preview = null;
  fileList = null;
  statusEl = null;
}

function filesRail(): HTMLElement {
  const input = h("input", {
    type: "file",
    accept: "image/png,image/jpeg,image/webp,image/gif,image/*",
    multiple: true,
    class: "sr-only",
    id: "pdf-file-input",
    onChange: (e: Event) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) void addFiles(files);
      (e.target as HTMLInputElement).value = "";
    },
  });
  fileList = h("ul", { class: "file-list" });
  const drop = h("label", {
    class: "drop",
    for: "pdf-file-input",
    onDragover: (e: DragEvent) => {
      e.preventDefault();
      drop.classList.add("over");
    },
    onDragleave: () => drop.classList.remove("over"),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      drop.classList.remove("over");
      if (e.dataTransfer?.files) void addFiles(e.dataTransfer.files);
    },
  },
    input,
    h("strong", null, t("imagePdf.dropTitle")),
    h("span", null, t("imagePdf.dropHint")),
    h("em", null, t("imagePdf.dropTypes")),
  );
  return h("aside", { class: "rail" },
    h("div", { class: "rail-h" },
      h("h2", null, t("imagePdf.filesTitle")),
      h("button", { type: "button", class: "link", onClick: () => clearItems() }, t("imagePdf.clear")),
    ),
    drop,
    fileList,
  );
}

function stagePane(): HTMLElement {
  preview = h("canvas", { class: "preview", width: 800, height: 560 });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  return h("section", { class: "stage" },
    h("div", { class: "stage-frame" }, preview),
    h("p", { class: "hint" }, t("imagePdf.hint")),
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn", onClick: () => void download() }, t("imagePdf.download")),
    ),
    statusEl,
  );
}

function controls(): HTMLElement {
  return h("aside", { class: "rail controls" },
    h("fieldset", null,
      h("legend", null, t("imagePdf.exportTitle")),
      h("p", { class: "hint" }, t("imagePdf.pageNote")),
      labeled(t("imagePdf.quality"),
        h("input", {
          type: "range",
          min: "0.4",
          max: "1",
          step: "0.01",
          value: String(state.quality),
          onInput: (e: Event) => {
            state.quality = Number((e.target as HTMLInputElement).value);
            scheduleSave();
          },
        }),
      ),
    ),
  );
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function onPaste(e: ClipboardEvent): void {
  const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith("image/"));
  if (files.length) {
    e.preventDefault();
    void addFiles(files);
  }
}

async function ingestFile(file: File): Promise<void> {
  const id = crypto.randomUUID();
  const url = URL.createObjectURL(file);
  const item: Item = { id, file, url, width: 0, height: 0, bitmap: null, error: null };
  state.items.push(item);
  try {
    const decoded = await decodeImage(file);
    item.bitmap = decoded.bitmap;
    item.width = decoded.width;
    item.height = decoded.height;
  } catch {
    item.error = t("imagePdf.errorDecode");
  }
}

async function addFiles(list: FileList | File[]): Promise<void> {
  const files = [...list].filter((f) => f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(f.name));
  for (const file of files) await ingestFile(file);
  refreshList();
  redraw();
}

function removeItem(id: string): void {
  const idx = state.items.findIndex((it) => it.id === id);
  if (idx < 0) return;
  const [item] = state.items.splice(idx, 1);
  item.bitmap?.close();
  URL.revokeObjectURL(item.url);
  refreshList();
  redraw();
}

function moveItem(id: string, dir: -1 | 1): void {
  const idx = state.items.findIndex((it) => it.id === id);
  const next = idx + dir;
  if (idx < 0 || next < 0 || next >= state.items.length) return;
  const [item] = state.items.splice(idx, 1);
  state.items.splice(next, 0, item);
  refreshList();
  redraw();
}

function clearItems(): void {
  for (const item of state.items) {
    item.bitmap?.close();
    URL.revokeObjectURL(item.url);
  }
  state.items = [];
  void clearDraft("image-pdf");
  refreshList();
  redraw();
}

function refreshList(): void {
  if (!fileList) return;
  fileList.replaceChildren();
  if (state.items.length === 0) {
    fileList.append(h("li", { class: "muted" }, t("imagePdf.filesEmpty")));
    return;
  }
  state.items.forEach((item) => {
    fileList!.append(
      h("li", { class: "file on" },
        h("img", { src: item.url, alt: item.file.name }),
        h("div", null,
          h("strong", null, item.file.name),
          h("span", null, item.error || `${item.width}×${item.height}`),
        ),
        h("div", { class: "file-ops" },
          h("button", { type: "button", class: "icon", "aria-label": t("imagePdf.up"), onClick: () => moveItem(item.id, -1) }, "↑"),
          h("button", { type: "button", class: "icon", "aria-label": t("imagePdf.down"), onClick: () => moveItem(item.id, 1) }, "↓"),
          h("button", { type: "button", class: "icon", "aria-label": t("imagePdf.remove"), onClick: () => removeItem(item.id) }, "×"),
        ),
      ),
    );
  });
}

function redraw(): void {
  if (!restoring) scheduleSave();
  if (!preview) return;
  const item = state.items.find((it) => it.bitmap) ?? null;
  const ctx = preview.getContext("2d");
  if (!ctx) return;
  if (!item?.bitmap) {
    preview.width = 800;
    preview.height = 560;
    ctx.clearRect(0, 0, preview.width, preview.height);
    return;
  }
  const max = 1400;
  const scale = Math.min(1, max / Math.max(item.width, item.height));
  const w = Math.max(1, Math.round(item.width * scale));
  const h = Math.max(1, Math.round(item.height * scale));
  preview.width = w;
  preview.height = h;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(item.bitmap, 0, 0, w, h);
}

async function download(): Promise<void> {
  const ready = state.items.filter((it) => it.bitmap);
  if (ready.length === 0) {
    if (statusEl) statusEl.textContent = t("imagePdf.emptyDownload");
    return;
  }
  if (statusEl) statusEl.textContent = t("imagePdf.working");
  try {
    const pages = [];
    for (const item of ready) {
      const canvas = drawToCanvas(item.bitmap!, item.width, item.height);
      const blob = await canvasToBlob(canvas, "image/jpeg", state.quality);
      pages.push({
        jpeg: new Uint8Array(await blob.arrayBuffer()),
        width: item.width,
        height: item.height,
      });
    }
    const pdf = pdfFromJpegs(pages);
    const packed = new ArrayBuffer(pdf.byteLength);
    new Uint8Array(packed).set(pdf);
    downloadBlob(
      new Blob([packed], { type: "application/pdf" }),
      outputFilename(ready[0].file.name, "application/pdf", ""),
    );
    if (statusEl) statusEl.textContent = "";
  } catch {
    if (statusEl) statusEl.textContent = t("imagePdf.errorDecode");
  }
}

async function persist(): Promise<void> {
  await saveDraft("image-pdf", {
    quality: state.quality,
    files: state.items.map((it) => ({ name: it.file.name, type: it.file.type || "image/png", blob: it.file })),
  });
}

async function restore(): Promise<void> {
  const draft = await loadDraft<{
    quality: number;
    files: { name: string; type: string; blob: Blob }[];
  }>("image-pdf");
  if (!draft) return;
  if (draft.quality) state.quality = draft.quality;
  state.items = [];
  for (const rec of draft.files || []) {
    await ingestFile(new File([rec.blob], rec.name, { type: rec.type || "image/png" }));
  }
}
