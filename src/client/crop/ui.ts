import { mimeForFormat, outputFilename, type ImageFormat } from "../../shared/filename";
import { applyAspect, clampRect, fitContain, mapPoint, type Rect } from "../../shared/crop";
import { canvasToBlob, decodeImage } from "../decode";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";

type Item = { file: File; url: string; width: number; height: number; bitmap: ImageBitmap };
type AspectId = "free" | "1" | "4-5" | "16-9" | "9-16";

const ASPECT: Record<AspectId, number | null> = {
  free: null,
  "1": 1,
  "4-5": 4 / 5,
  "16-9": 16 / 9,
  "9-16": 9 / 16,
};

const state = {
  item: null as Item | null,
  crop: { x: 0, y: 0, w: 1, h: 1 } as Rect,
  aspect: "free" as AspectId,
  format: "jpeg" as ImageFormat,
  quality: 0.92,
  drag: null as null | { kind: "move" | "se" | "nw"; sx: number; sy: number; start: Rect },
};

let preview: HTMLCanvasElement | null = null;
let boxEl: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let wrapEl: HTMLElement | null = null;

export async function mountCrop(host: HTMLElement): Promise<void> {
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("crop.back")),
      h("h1", null, t("crop.title")),
      h("p", { class: "lede" }, t("crop.privacyNote")),
    ),
    h("div", { class: "tool" },
      filesRail(),
      stagePane(),
      controls(),
    ),
  );
  redraw();
  window.addEventListener("paste", onPaste);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

export function unmountCrop(): void {
  window.removeEventListener("paste", onPaste);
  window.removeEventListener("pointermove", onMove);
  window.removeEventListener("pointerup", onUp);
  preview = null;
  boxEl = null;
  statusEl = null;
  wrapEl = null;
}

function filesRail(): HTMLElement {
  const input = h("input", {
    type: "file",
    accept: "image/png,image/jpeg,image/webp,image/gif,image/avif,image/heic,image/heif,image/*",
    class: "sr-only",
    id: "crop-file-input",
    onChange: (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void setFile(file);
      (e.target as HTMLInputElement).value = "";
    },
  });
  const drop = h("label", {
    class: "drop",
    for: "crop-file-input",
    onDragover: (e: DragEvent) => {
      e.preventDefault();
      drop.classList.add("over");
    },
    onDragleave: () => drop.classList.remove("over"),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      drop.classList.remove("over");
      const file = imageFromList(e.dataTransfer?.files);
      if (file) void setFile(file);
    },
  },
    input,
    h("strong", null, t("crop.dropTitle")),
    h("span", null, t("crop.dropHint")),
    h("em", null, t("crop.dropTypes")),
  );
  return h("aside", { class: "rail" },
    h("div", { class: "rail-h" }, h("h2", null, t("crop.filesTitle"))),
    drop,
  );
}

function stagePane(): HTMLElement {
  preview = h("canvas", { class: "preview", width: 800, height: 560 });
  boxEl = h("div", {
    class: "crop-box",
    onPointerdown: (e: PointerEvent) => beginDrag(e, "move"),
  },
    h("span", { class: "crop-handle nw", onPointerdown: (e: PointerEvent) => beginDrag(e, "nw") }),
    h("span", { class: "crop-handle se", onPointerdown: (e: PointerEvent) => beginDrag(e, "se") }),
  );
  wrapEl = h("div", { class: "crop-wrap" }, preview, boxEl);
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  return h("section", { class: "stage" },
    h("div", { class: "stage-frame" }, wrapEl),
    h("p", { class: "hint" }, t("crop.hint")),
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn", onClick: () => void download() }, t("crop.download")),
    ),
    statusEl,
  );
}

function controls(): HTMLElement {
  return h("aside", { class: "rail controls" },
    h("fieldset", null,
      h("legend", null, t("crop.exportTitle")),
      labeled(t("crop.aspect"),
        h("select", {
          onChange: (e: Event) => {
            state.aspect = (e.target as HTMLSelectElement).value as AspectId;
            fitCrop();
          },
        },
          h("option", { value: "free" }, t("crop.aspectFree")),
          h("option", { value: "1" }, "1:1"),
          h("option", { value: "4-5" }, "4:5"),
          h("option", { value: "16-9" }, "16:9"),
          h("option", { value: "9-16" }, "9:16"),
        ),
      ),
      labeled(t("crop.format"),
        h("select", {
          onChange: (e: Event) => {
            state.format = (e.target as HTMLSelectElement).value as ImageFormat;
          },
        },
          h("option", { value: "jpeg", selected: true }, "JPG"),
          h("option", { value: "png" }, "PNG"),
          h("option", { value: "webp" }, "WebP"),
        ),
      ),
    ),
  );
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function imageFromList(list?: FileList | null): File | null {
  return [...(list || [])].find((f) => f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|avif|heic|heif)$/i.test(f.name)) || null;
}

function onPaste(e: ClipboardEvent): void {
  const file = imageFromList(e.clipboardData?.files);
  if (file) {
    e.preventDefault();
    void setFile(file);
  }
}

async function setFile(file: File): Promise<void> {
  try {
    const decoded = await decodeImage(file);
    state.item?.bitmap.close();
    if (state.item) URL.revokeObjectURL(state.item.url);
    state.item = { file, url: URL.createObjectURL(file), ...decoded };
    const insetX = decoded.width * 0.1;
    const insetY = decoded.height * 0.1;
    state.crop = clampRect({
      x: insetX,
      y: insetY,
      w: decoded.width - insetX * 2,
      h: decoded.height - insetY * 2,
    }, decoded.width, decoded.height);
    fitCrop();
    redraw();
  } catch {
    if (statusEl) statusEl.textContent = t("crop.errorDecode");
  }
}

function fitCrop(): void {
  const item = state.item;
  if (!item) return;
  state.crop = applyAspect(state.crop, ASPECT[state.aspect], item.width, item.height);
  layoutBox();
}

function display(boxW: number, boxH: number): { x: number; y: number; w: number; h: number } | null {
  if (!state.item) return null;
  return fitContain(state.item.width, state.item.height, boxW, boxH);
}

function layoutBox(): void {
  if (!boxEl || !preview || !state.item) {
    if (boxEl) boxEl.style.display = "none";
    return;
  }
  const d = display(preview.clientWidth || preview.width, preview.clientHeight || preview.height);
  if (!d) return;
  const { crop } = state;
  boxEl.style.display = "block";
  boxEl.style.left = `${d.x + (crop.x / state.item.width) * d.w}px`;
  boxEl.style.top = `${d.y + (crop.y / state.item.height) * d.h}px`;
  boxEl.style.width = `${(crop.w / state.item.width) * d.w}px`;
  boxEl.style.height = `${(crop.h / state.item.height) * d.h}px`;
}

function beginDrag(e: PointerEvent, kind: "move" | "se" | "nw"): void {
  e.preventDefault();
  e.stopPropagation();
  if (!state.item) return;
  state.drag = { kind, sx: e.clientX, sy: e.clientY, start: { ...state.crop } };
}

function onMove(e: PointerEvent): void {
  if (!state.drag || !state.item || !preview) return;
  const rect = preview.getBoundingClientRect();
  const d = display(rect.width, rect.height);
  if (!d) return;
  const from = mapPoint(state.drag.sx - rect.left, state.drag.sy - rect.top, d, state.item.width, state.item.height);
  const to = mapPoint(e.clientX - rect.left, e.clientY - rect.top, d, state.item.width, state.item.height);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const s = state.drag.start;
  let next = { ...s };
  if (state.drag.kind === "move") {
    next = { ...s, x: s.x + dx, y: s.y + dy };
  } else if (state.drag.kind === "se") {
    next = { ...s, w: s.w + dx, h: s.h + dy };
  } else {
    next = { x: s.x + dx, y: s.y + dy, w: s.w - dx, h: s.h - dy };
  }
  state.crop = applyAspect(next, ASPECT[state.aspect], state.item.width, state.item.height);
  layoutBox();
}

function onUp(): void {
  state.drag = null;
}

function redraw(): void {
  if (!preview) return;
  const ctx = preview.getContext("2d");
  if (!ctx) return;
  const item = state.item;
  if (!item) {
    preview.width = 800;
    preview.height = 560;
    ctx.clearRect(0, 0, preview.width, preview.height);
    layoutBox();
    return;
  }
  const max = 1400;
  const scale = Math.min(1, max / Math.max(item.width, item.height));
  preview.width = Math.max(1, Math.round(item.width * scale));
  preview.height = Math.max(1, Math.round(item.height * scale));
  ctx.clearRect(0, 0, preview.width, preview.height);
  ctx.drawImage(item.bitmap, 0, 0, preview.width, preview.height);
  layoutBox();
}

async function download(): Promise<void> {
  const item = state.item;
  if (!item) {
    if (statusEl) statusEl.textContent = t("crop.emptyDownload");
    return;
  }
  if (statusEl) statusEl.textContent = t("crop.working");
  try {
    const { x, y, w, h } = clampRect(state.crop, item.width, item.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w));
    canvas.height = Math.max(1, Math.round(h));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(item.bitmap, x, y, w, h, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas, mimeForFormat(state.format), state.quality);
    downloadBlob(blob, outputFilename(item.file.name, blob.type, "-crop"));
    if (statusEl) statusEl.textContent = "";
  } catch {
    if (statusEl) statusEl.textContent = t("crop.errorDecode");
  }
}
