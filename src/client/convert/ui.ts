import { blobFromBytes, encodeBmp, encodeGif, encodeIco, releaseGifScratch } from "../../shared/image-encode";
import { lossyFormat, mimeForFormat, outputFilename, type ImageFormat } from "../../shared/filename";
import { zipStore } from "../../shared/zip";
import { canvasToBlob, decodeImage, drawSvg, drawToCanvas, readSvgFile, type SvgSource } from "../decode";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { CONVERT_JOB_FORMAT, appHref, parseAppPath, type ConvertJobId } from "../../shared/path";
import { clearDraft, debounce, loadDraft, markSession, saveDraft, sessionLive } from "../session";
import { isSvgFile } from "../../shared/svg-size";

type Item = {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
  bitmap: ImageBitmap | null;
  error: string | null;
  /** SVG source, kept so a new scale redraws it sharp instead of stretching the bitmap. */
  svg: SvgSource | null;
  /** Still being read in: a scale change is picked up by the ingest itself, not redrawn twice. */
  ingesting: boolean;
};

type Format = ImageFormat;

const MAX_EDGES = [0, 2048, 1920, 1280, 800] as const;
type MaxEdge = (typeof MAX_EDGES)[number];

/** How many pixels an SVG gets per CSS pixel of its own size. */
const SVG_SCALES = [1, 2, 3, 4] as const;
type SvgScale = (typeof SVG_SCALES)[number];

const CHIPS: { format: Format; key: string }[] = [
  { format: "jpeg", key: "convert.chipHeicJpg" },
  { format: "png", key: "convert.chipWebpPng" },
  { format: "jpeg", key: "convert.chipPngJpg" },
  { format: "png", key: "convert.chipJpgPng" },
  { format: "png", key: "convert.chipSvgPng" },
  { format: "ico", key: "convert.chipIco" },
];

const state = {
  items: [] as Item[],
  selected: null as string | null,
  format: "jpeg" as Format,
  quality: 0.92,
  maxEdge: 0 as MaxEdge,
  svgScale: 1 as SvgScale,
};

let preview: HTMLCanvasElement | null = null;
let fileList: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let sizeEl: HTMLElement | null = null;
let qualityField: HTMLElement | null = null;
let svgField: HTMLElement | null = null;
let pagehideBound = false;
let restoring = false;
let hydrated = false;
const scheduleSave = debounce(() => {
  void persist();
}, 400);
const scheduleSize = debounce(() => {
  void refreshSize();
}, 280);

export async function mountConvert(host: HTMLElement): Promise<void> {
  restoring = true;
  if (!hydrated) {
    if (sessionLive()) await restore();
    else await clearDraft("convert");
    markSession();
    hydrated = true;
  }
  const job = currentJob();
  if (job) state.format = CONVERT_JOB_FORMAT[job];
  restoring = false;
  const loc = locale();
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(loc, null), "data-nav": "home" }, t("convert.back")),
      h("h1", null, job ? t(`convert.jobs.${job}.title`) : t("convert.title")),
      h("p", { class: "lede" }, job ? t(`convert.jobs.${job}.lede`) : t("convert.privacyNote")),
      jobNav(loc, job),
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

function currentJob(): ConvertJobId | null {
  const parsed = parseAppPath(location.pathname);
  return parsed.kind === "app" || parsed.kind === "bare" ? parsed.convertJob ?? null : null;
}

function jobNav(loc: ReturnType<typeof locale>, current: ConvertJobId | null): HTMLElement {
  const ids = Object.keys(CONVERT_JOB_FORMAT) as ConvertJobId[];
  return h("nav", { class: "convert-jobs", "aria-label": t("convert.jobsLabel") },
    ...ids.map((id) =>
      h("a", {
        href: appHref(loc, "convert", null, id),
        "data-nav": "convert",
        "aria-current": current === id ? "page" : undefined,
      }, t(`convert.jobs.${id}.title`)),
    ),
  );
}

export function unmountConvert(): void {
  window.removeEventListener("paste", onPaste);
  preview = null;
  fileList = null;
  statusEl = null;
  sizeEl = null;
  qualityField = null;
  svgField = null;
  releaseGifScratch();
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
    sizeEl = h("p", { class: "muted convert-size" }),
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
        scheduleSize();
      },
    }),
  );
  qualityField.hidden = !lossyFormat(state.format);
  svgField = labeled(t("convert.svgScale"),
    h("select", {
      "data-field": "svg-scale",
      onChange: (e: Event) => {
        state.svgScale = Number((e.target as HTMLSelectElement).value) as SvgScale;
        scheduleSave();
        void rerasterSvgs();
      },
    },
      ...SVG_SCALES.map((n) => h("option", { value: String(n), selected: state.svgScale === n }, `${n}×`)),
    ),
  );
  syncSvgField();
  const formatSelect = h("select", {
    onChange: (e: Event) => {
      state.format = (e.target as HTMLSelectElement).value as Format;
      if (qualityField) qualityField.hidden = !lossyFormat(state.format);
      scheduleSave();
      redraw();
      void refreshSize();
    },
  },
    h("option", { value: "jpeg", selected: state.format === "jpeg" }, "JPG / JPEG"),
    h("option", { value: "png", selected: state.format === "png" }, "PNG"),
    h("option", { value: "webp", selected: state.format === "webp" }, "WebP"),
    h("option", { value: "avif", selected: state.format === "avif" }, "AVIF"),
    h("option", { value: "gif", selected: state.format === "gif" }, "GIF"),
    h("option", { value: "bmp", selected: state.format === "bmp" }, "BMP"),
    h("option", { value: "ico", selected: state.format === "ico" }, "ICO"),
  );
  return h("aside", { class: "rail controls" },
    h("fieldset", null,
      h("legend", null, t("convert.exportTitle")),
      h("div", { class: "chips convert-chips" },
        ...CHIPS.map((chip) =>
          h("button", {
            type: "button",
            class: "chip" + (state.format === chip.format ? " on" : ""),
            onClick: () => {
              state.format = chip.format;
              formatSelect.value = chip.format;
              if (qualityField) qualityField.hidden = !lossyFormat(state.format);
              scheduleSave();
              redraw();
              void refreshSize();
            },
          }, t(chip.key)),
        ),
      ),
      labeled(t("convert.format"), formatSelect),
      labeled(t("convert.maxEdge"),
        h("select", {
          onChange: (e: Event) => {
            state.maxEdge = Number((e.target as HTMLSelectElement).value) as MaxEdge;
            scheduleSave();
            void refreshSize();
          },
        },
          ...MAX_EDGES.map((n) =>
            h("option", {
              value: String(n),
              selected: state.maxEdge === n,
            }, n === 0 ? t("convert.maxOriginal") : `${n} px`),
          ),
        ),
      ),
      svgField,
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
  const item: Item = { id, file, url, width: 0, height: 0, bitmap: null, error: null, svg: null, ingesting: true };
  state.items.push(item);
  if (!state.selected) state.selected = id;
  try {
    if (isSvgFile(file) && (await ingestSvg(item))) return;
    // Not an SVG, or one we cannot redraw from source (a prefixed svg:svg root, say): the browser's own decoding.
    item.svg = null;
    const decoded = await decodeImage(file);
    if (!state.items.includes(item)) {
      decoded.bitmap.close();
      return;
    }
    item.bitmap = decoded.bitmap;
    item.width = decoded.width;
    item.height = decoded.height;
  } catch {
    item.error = t("convert.errorDecode");
  } finally {
    item.ingesting = false;
  }
}

/** Draws an SVG from its source at the SVG scale; false when its root cannot be read or drawn that way. */
async function ingestSvg(item: Item): Promise<boolean> {
  const svg = await readSvgFile(item.file);
  if (!svg) return false;
  item.svg = svg;
  try {
    // If the scale changes while this draws, draw again at the new one.
    let scale = state.svgScale;
    let r = await rasterSvg(item, scale);
    while (scale !== state.svgScale && state.items.includes(item)) {
      r.bitmap.close();
      scale = state.svgScale;
      r = await rasterSvg(item, scale);
    }
    // Removed or cleared while it drew: nothing holds this bitmap.
    if (!state.items.includes(item)) r.bitmap.close();
    else applyRaster(item, r);
    return true;
  } catch {
    return false;
  }
}


/** Draws an SVG item at its own size × `scale` from the vector source, so 2×–4× stay sharp. */
async function rasterSvg(item: Item, scale: SvgScale): Promise<{ bitmap: ImageBitmap; width: number; height: number }> {
  if (!item.svg) throw new Error("svg");
  return drawSvg(item.svg, scale);
}

function applyRaster(item: Item, r: { bitmap: ImageBitmap; width: number; height: number }): void {
  item.bitmap?.close();
  item.bitmap = r.bitmap;
  item.width = r.width;
  item.height = r.height;
  item.error = null;
}

/** Bumped on every scale change, so a slower earlier redraw cannot land after a newer one. */
let rasterRun = 0;

async function rerasterSvgs(): Promise<void> {
  const run = ++rasterRun;
  const scale = state.svgScale;
  for (const item of [...state.items]) {
    // Items still being read in pick up the new scale themselves.
    if (!item.svg || item.ingesting) continue;
    try {
      const r = await rasterSvg(item, scale);
      // A newer scale or a removed item: drop this one.
      if (run !== rasterRun || !state.items.includes(item)) {
        r.bitmap.close();
        if (run !== rasterRun) return;
        continue;
      }
      applyRaster(item, r);
    } catch {
      if (run !== rasterRun) return;
      // The old size must not be exported as if it were the new one.
      item.bitmap?.close();
      item.bitmap = null;
      item.error = t("convert.errorDecode");
    }
  }
  refreshList();
  redraw();
}

/** The SVG scale is shown on the SVG to PNG page and whenever an SVG is in the list. */
function syncSvgField(): void {
  if (svgField) svgField.hidden = currentJob() !== "svg-to-png" && !state.items.some((it) => it.svg);
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
  syncSvgField();
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
  if (!restoring) {
    scheduleSave();
    scheduleSize();
  }
  document.querySelectorAll(".convert-chips .chip").forEach((el, i) => {
    const chip = CHIPS[i];
    el.classList.toggle("on", Boolean(chip && state.format === chip.format));
  });
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

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

async function refreshSize(): Promise<void> {
  if (!sizeEl) return;
  const item = current();
  if (!item?.bitmap) {
    sizeEl.textContent = "";
    return;
  }
  try {
    const blob = await blobFor(item);
    sizeEl.textContent = t("convert.sizeLabel", { size: formatBytes(blob.size) });
  } catch {
    sizeEl.textContent = "";
  }
}

async function blobFor(item: Item): Promise<Blob> {
  if (!item.bitmap) throw new Error("decode");
  let width = item.width;
  let height = item.height;
  if (state.maxEdge > 0) {
    const scale = Math.min(1, state.maxEdge / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }
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
    maxEdge: state.maxEdge,
    svgScale: state.svgScale,
    selected: Math.max(0, state.items.findIndex((it) => it.id === state.selected)),
    files: state.items.map((it) => ({ name: it.file.name, type: it.file.type || "image/png", blob: it.file })),
  });
}

async function restore(): Promise<void> {
  const draft = await loadDraft<{
    format: Format;
    quality: number;
    maxEdge?: number;
    svgScale?: number;
    selected: number;
    files: { name: string; type: string; blob: Blob }[];
  }>("convert");
  if (!draft) return;
  if (draft.format) state.format = draft.format;
  if (draft.quality) state.quality = draft.quality;
  if (MAX_EDGES.includes((draft.maxEdge ?? 0) as MaxEdge)) state.maxEdge = (draft.maxEdge ?? 0) as MaxEdge;
  if (SVG_SCALES.includes((draft.svgScale ?? 1) as SvgScale)) state.svgScale = (draft.svgScale ?? 1) as SvgScale;
  state.items = [];
  state.selected = null;
  for (const rec of draft.files || []) {
    await ingestFile(new File([rec.blob], rec.name, { type: rec.type || "image/png" }));
  }
  if (state.items[draft.selected]) state.selected = state.items[draft.selected].id;
}
