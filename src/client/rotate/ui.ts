import { mimeForFormat, outputFilename, type ImageFormat } from "../../shared/filename";
import { formatBytes } from "../../shared/resize";
import { normalizeDegrees, rotatedSize } from "../../shared/rotate";
import { canvasToBlob, decodeImage } from "../decode";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";

type Item = { file: File; url: string; width: number; height: number; bitmap: ImageBitmap };

const state = {
  item: null as Item | null,
  degrees: 0,
  flipH: false,
  flipV: false,
  format: "jpeg" as ImageFormat,
  quality: 0.92,
};

let preview: HTMLCanvasElement | null = null;
let statusEl: HTMLElement | null = null;
let sizeEl: HTMLElement | null = null;
let angleEl: HTMLInputElement | null = null;
let flipHEl: HTMLInputElement | null = null;
let flipVEl: HTMLInputElement | null = null;
let qualityField: HTMLElement | null = null;

export async function mountRotate(host: HTMLElement): Promise<void> {
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("rotateTool.back")),
      h("h1", null, t("rotateTool.title")),
      h("p", { class: "lede" }, t("rotateTool.privacyNote")),
    ),
    h("div", { class: "tool" },
      filesRail(),
      stagePane(),
      controls(),
    ),
  );
  redraw();
  window.addEventListener("paste", onPaste);
}

export function unmountRotate(): void {
  window.removeEventListener("paste", onPaste);
  state.item?.bitmap.close();
  if (state.item) URL.revokeObjectURL(state.item.url);
  state.item = null;
  preview = null;
  statusEl = null;
  sizeEl = null;
  angleEl = null;
  flipHEl = null;
  flipVEl = null;
  qualityField = null;
}

function filesRail(): HTMLElement {
  const input = h("input", {
    type: "file",
    accept: "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif,image/heic,image/heif,image/*",
    class: "sr-only",
    id: "rotate-file-input",
    onChange: (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void setFile(file);
      (e.target as HTMLInputElement).value = "";
    },
  });
  const drop = h("label", {
    class: "drop",
    for: "rotate-file-input",
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
    h("strong", null, t("rotateTool.dropTitle")),
    h("span", null, t("rotateTool.dropHint")),
    h("em", null, t("rotateTool.dropTypes")),
  );
  return h("aside", { class: "rail" },
    h("div", { class: "rail-h" }, h("h2", null, t("rotateTool.filesTitle"))),
    drop,
  );
}

function stagePane(): HTMLElement {
  preview = h("canvas", { class: "preview", width: 800, height: 560 });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  sizeEl = h("p", { class: "muted convert-size" });
  return h("section", { class: "stage" },
    h("div", { class: "stage-frame" }, preview),
    h("p", { class: "hint" }, t("rotateTool.hint")),
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn", onClick: () => void download() }, t("rotateTool.download")),
    ),
    sizeEl,
    statusEl,
  );
}

function controls(): HTMLElement {
  angleEl = h("input", {
    type: "range",
    min: "0",
    max: "359",
    step: "1",
    value: "0",
    onInput: (e: Event) => {
      state.degrees = Number((e.target as HTMLInputElement).value);
      redraw();
    },
  });
  qualityField = labeled(t("rotateTool.quality"),
    h("input", {
      type: "range",
      min: "0.4",
      max: "1",
      step: "0.01",
      value: String(state.quality),
      onInput: (e: Event) => {
        state.quality = Number((e.target as HTMLInputElement).value);
      },
    }),
  );
  qualityField.hidden = state.format === "png";
  return h("aside", { class: "rail controls" },
    h("fieldset", null,
      h("legend", null, t("rotateTool.options")),
      h("div", { class: "chips convert-chips" },
        preset(t("rotateTool.left"), () => turn(-90)),
        preset(t("rotateTool.right"), () => turn(90)),
        preset("180°", () => turn(180)),
        preset(t("rotateTool.reset"), () => resetPose()),
      ),
      labeled(t("rotateTool.angle"), angleEl),
      h("label", { class: "check" },
        flipHEl = h("input", {
          type: "checkbox",
          onChange: (e: Event) => {
            state.flipH = (e.target as HTMLInputElement).checked;
            redraw();
          },
        }),
        h("span", null, t("rotateTool.flipH")),
      ),
      h("label", { class: "check" },
        flipVEl = h("input", {
          type: "checkbox",
          onChange: (e: Event) => {
            state.flipV = (e.target as HTMLInputElement).checked;
            redraw();
          },
        }),
        h("span", null, t("rotateTool.flipV")),
      ),
      labeled(t("rotateTool.format"),
        h("select", {
          onChange: (e: Event) => {
            state.format = (e.target as HTMLSelectElement).value as ImageFormat;
            if (qualityField) qualityField.hidden = state.format === "png";
          },
        },
          h("option", { value: "jpeg", selected: true }, "JPG"),
          h("option", { value: "webp" }, "WebP"),
          h("option", { value: "png" }, "PNG"),
        ),
      ),
      qualityField,
    ),
  );
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function preset(label: string, fn: () => void): HTMLButtonElement {
  return h("button", { type: "button", class: "chip", onClick: fn }, label);
}

function turn(delta: number): void {
  state.degrees = normalizeDegrees(state.degrees + delta);
  if (angleEl) angleEl.value = String(Math.round(state.degrees));
  redraw();
}

function resetPose(): void {
  state.degrees = 0;
  state.flipH = false;
  state.flipV = false;
  if (angleEl) angleEl.value = "0";
  if (flipHEl) flipHEl.checked = false;
  if (flipVEl) flipVEl.checked = false;
  redraw();
}

function imageFromList(list?: FileList | null): File | null {
  return [...(list || [])].find((f) => f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg|avif|heic|heif)$/i.test(f.name)) || null;
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
    if (statusEl) statusEl.textContent = "";
    redraw();
  } catch {
    if (statusEl) statusEl.textContent = t("rotateTool.errorDecode");
  }
}

function drawPose(source: CanvasImageSource, srcW: number, srcH: number): HTMLCanvasElement {
  const deg = normalizeDegrees(state.degrees);
  const size = rotatedSize(srcW, srcH, deg);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.translate(size.width / 2, size.height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
  ctx.drawImage(source, -srcW / 2, -srcH / 2);
  return canvas;
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
    if (sizeEl) sizeEl.textContent = "";
    return;
  }
  const posed = drawPose(item.bitmap, item.width, item.height);
  const max = 1400;
  const scale = Math.min(1, max / Math.max(posed.width, posed.height));
  preview.width = Math.max(1, Math.round(posed.width * scale));
  preview.height = Math.max(1, Math.round(posed.height * scale));
  ctx.clearRect(0, 0, preview.width, preview.height);
  ctx.drawImage(posed, 0, 0, preview.width, preview.height);
  if (sizeEl) {
    sizeEl.textContent = t("rotateTool.sizeLabel", {
      src: `${item.width}×${item.height}`,
      out: `${posed.width}×${posed.height}`,
      bytes: formatBytes(item.file.size),
    });
  }
}

async function download(): Promise<void> {
  if (!state.item) {
    if (statusEl) statusEl.textContent = t("rotateTool.emptyDownload");
    return;
  }
  if (statusEl) statusEl.textContent = t("rotateTool.working");
  try {
    const posed = drawPose(state.item.bitmap, state.item.width, state.item.height);
    const mime = mimeForFormat(state.format === "png" ? "png" : state.format);
    const blob = await canvasToBlob(posed, mime, state.quality);
    downloadBlob(blob, outputFilename(state.item.file.name, blob.type, "-rotate"));
    if (statusEl) statusEl.textContent = "";
  } catch {
    if (statusEl) statusEl.textContent = t("rotateTool.errorEncode");
  }
}
