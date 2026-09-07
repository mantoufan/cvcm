import { blobFromBytes, encodeBmp, encodeGif, encodeIco } from "../../shared/image-encode";
import { lossyFormat, mimeForFormat, outputFilename, type ImageFormat } from "../../shared/filename";
import { zipStore } from "../../shared/zip";
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

type Format = ImageFormat;

const state = {
  items: [] as Item[],
  selected: null as string | null,
  format: "jpeg" as Format,
  quality: 0.92,
};

let preview: HTMLCanvasElement | null = null;
let fileList: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let qualityField: HTMLElement | null = null;
let pagehideBound = false;
let restoring = false;
let hydrated = false;
const scheduleSave = debounce(() => {
  void persist();
}, 400);

export async function mountConvert(host: HTMLElement): Promise<void> {
  restoring = true;
  if (!hydrated) {
    if (sessionLive()) await restore();
    else await clearDraft("convert");
    markSession();
    hydrated = true;
  }
  restoring = false;
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("convert.back")),
      h("h1", null, t("convert.title")),
      h("p", { class: "lede" }, t("convert.privacyNote")),
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

export function unmountConvert(): void {
  window.removeEventListener("paste", onPaste);
  preview = null;
  fileList = null;
  statusEl = null;
  qualityField = null;
}

function filesRail(): HTMLElement {
  const input = h("input", {
    type: "file",
    accept: "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/bmp,image/x-icon,image/avif,image/heic,image/heif,image/*",
    multiple: true,
    class: "sr-only",
    id: "convert-file-input",
    onChange: (e: Event) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) void addFiles(files);
      (e.target as HTMLInputElement).value = "";
    },
  });
  fileList = h("ul", { class: "file-list" });
  const drop = h("label", {
    class: "drop",
    for: "convert-file-input",
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
    h("strong", null, t("convert.dropTitle")),
    h("span", null, t("convert.dropHint")),
    h("em", null, t("convert.dropTypes")),
  );
  return h("aside", { class: "rail" },
    h("div", { class: "rail-h" },
      h("h2", null, t("convert.filesTitle")),
      h("button", { type: "button", class: "link", onClick: () => clearItems() }, t("convert.clear")),
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
    h("p", { class: "hint" }, t("convert.hint")),
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn", onClick: () => void downloadOne() }, t("convert.download")),
      h("button", { type: "button", class: "btn ghost", onClick: () => void downloadAll() }, t("convert.downloadAll")),
    ),
    statusEl,
  );
}

function controls(): HTMLElement {
  qualityField = labeled(t("convert.quality"),
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
  );
  qualityField.hidden = !lossyFormat(state.format);
  return h("aside", { class: "rail controls" },
    h("fieldset", null,
      h("legend", null, t("convert.exportTitle")),
      labeled(t("convert.format"),
        h("select", {
          onChange: (e: Event) => {
            state.format = (e.target as HTMLSelectElement).value as Format;
            if (qualityField) qualityField.hidden = !lossyFormat(state.format);
            scheduleSave();
            redraw();
          },
        },
          h("option", { value: "jpeg", selected: state.format === "jpeg" }, "JPG / JPEG"),
          h("option", { value: "png", selected: state.format === "png" }, "PNG"),
          h("option", { value: "webp", selected: state.format === "webp" }, "WebP"),
          h("option", { value: "avif", selected: state.format === "avif" }, "AVIF"),
          h("option", { value: "gif", selected: state.format === "gif" }, "GIF"),
          h("option", { value: "bmp", selected: state.format === "bmp" }, "BMP"),
          h("option", { value: "ico", selected: state.format === "ico" }, "ICO"),
        ),
      ),
      qualityField,
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
  if (!state.selected) state.selected = id;
  try {
    const decoded = await decodeImage(file);
    item.bitmap = decoded.bitmap;
    item.width = decoded.width;
    item.height = decoded.height;
  } catch {
    item.error = t("convert.errorDecode");
  }
}

async function addFiles(list: FileList | File[]): Promise<void> {
  const files = [...list].filter(
    (f) => f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg|bmp|ico|avif|heic|heif)$/i.test(f.name),
  );
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
  if (state.selected === id) state.selected = state.items[0]?.id ?? null;
  refreshList();
  redraw();
}

function clearItems(): void {
  for (const item of state.items) {
    item.bitmap?.close();
    URL.revokeObjectURL(item.url);
  }
  state.items = [];
  state.selected = null;
  void clearDraft("convert");
  refreshList();
  redraw();
}

function refreshList(): void {
  if (!fileList) return;
  fileList.replaceChildren();
  if (state.items.length === 0) {
    fileList.append(h("li", { class: "muted" }, t("convert.filesEmpty")));
    return;
  }
  for (const item of state.items) {
    fileList.append(
      h("li", {
        class: "file" + (item.id === state.selected ? " on" : ""),
        onClick: () => {
          state.selected = item.id;
          refreshList();
          redraw();
        },
      },
        h("img", { src: item.url, alt: item.file.name }),
        h("div", null,
          h("strong", null, item.file.name),
          h("span", null, item.error || `${item.width}×${item.height}`),
        ),
        h("button", {
          type: "button",
          class: "icon",
          "aria-label": t("convert.remove"),
          onClick: (e: Event) => {
            e.stopPropagation();
            removeItem(item.id);
          },
        }, "×"),
      ),
    );
  }
}

function current(): Item | null {
  return state.items.find((it) => it.id === state.selected) ?? state.items[0] ?? null;
}

function redraw(): void {
  if (!restoring) scheduleSave();
  if (!preview) return;
  const item = current();
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

async function blobFor(item: Item): Promise<Blob> {
  if (!item.bitmap) throw new Error("decode");
  let width = item.width;
  let height = item.height;
  if (state.format === "ico") {
    const scale = Math.min(1, 256 / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }
  const canvas = drawToCanvas(item.bitmap, width, height);
  if (state.format === "bmp" || state.format === "gif" || state.format === "ico") {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (state.format === "bmp") return blobFromBytes(encodeBmp(pixels), "image/bmp");
    if (state.format === "gif") return blobFromBytes(encodeGif(pixels), "image/gif");
    const png = await canvasToBlob(canvas, "image/png", 1);
    const ico = encodeIco(new Uint8Array(await png.arrayBuffer()), canvas.width, canvas.height);
    return blobFromBytes(ico, "image/x-icon");
  }
  return canvasToBlob(canvas, mimeForFormat(state.format), state.quality);
}

async function downloadOne(): Promise<void> {
  const item = current();
  if (!item) {
    if (statusEl) statusEl.textContent = t("convert.emptyDownload");
    return;
  }
  if (statusEl) statusEl.textContent = t("convert.working");
  try {
    const blob = await blobFor(item);
    downloadBlob(blob, outputFilename(item.file.name, blob.type, ""));
    if (statusEl) statusEl.textContent = "";
  } catch {
    if (statusEl) statusEl.textContent = t("convert.errorDecode");
  }
}

async function downloadAll(): Promise<void> {
  const ready = state.items.filter((it) => it.bitmap);
  if (ready.length === 0) {
    if (statusEl) statusEl.textContent = t("convert.emptyDownload");
    return;
  }
  if (ready.length === 1) {
    await downloadOne();
    return;
  }
  if (statusEl) statusEl.textContent = t("convert.working");
  try {
    const entries = [];
    const used = new Set<string>();
    for (const item of ready) {
      const blob = await blobFor(item);
      const buf = new Uint8Array(await blob.arrayBuffer());
      let name = outputFilename(item.file.name, blob.type, "");
      let n = 1;
      while (used.has(name)) {
        const dot = name.lastIndexOf(".");
        name = `${name.slice(0, dot)}-${n}${name.slice(dot)}`;
        n += 1;
      }
      used.add(name);
      entries.push({ name, data: buf });
    }
    const zip = zipStore(entries);
    const packed = new ArrayBuffer(zip.byteLength);
    new Uint8Array(packed).set(zip);
    downloadBlob(new Blob([packed], { type: "application/zip" }), "cvcm-convert.zip");
    if (statusEl) statusEl.textContent = "";
  } catch {
    if (statusEl) statusEl.textContent = t("convert.errorDecode");
  }
}

async function persist(): Promise<void> {
  await saveDraft("convert", {
    format: state.format,
    quality: state.quality,
    selected: Math.max(0, state.items.findIndex((it) => it.id === state.selected)),
    files: state.items.map((it) => ({ name: it.file.name, type: it.file.type || "image/png", blob: it.file })),
  });
}

async function restore(): Promise<void> {
  const draft = await loadDraft<{
    format: Format;
    quality: number;
    selected: number;
    files: { name: string; type: string; blob: Blob }[];
  }>("convert");
  if (!draft) return;
  if (draft.format) state.format = draft.format;
  if (draft.quality) state.quality = draft.quality;
  state.items = [];
  state.selected = null;
  for (const rec of draft.files || []) {
    await ingestFile(new File([rec.blob], rec.name, { type: rec.type || "image/png" }));
  }
  if (state.items[draft.selected]) state.selected = state.items[draft.selected].id;
}
