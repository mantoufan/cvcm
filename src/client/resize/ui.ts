import { mimeForFormat, outputFilename, type ImageFormat } from "../../shared/filename";
import { formatBytes, targetSize } from "../../shared/resize";
import { canvasToBlob, decodeImage, drawToCanvas } from "../decode";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { debounce } from "../session";

type Item = { file: File; url: string; width: number; height: number; bitmap: ImageBitmap };

const state = {
  item: null as Item | null,
  width: 1920,
  height: 1080,
  lock: true,
  format: "jpeg" as ImageFormat,
  quality: 0.82,
  working: false,
};

let preview: HTMLCanvasElement | null = null;
let statusEl: HTMLElement | null = null;
let sizeEl: HTMLElement | null = null;
let widthEl: HTMLInputElement | null = null;
let heightEl: HTMLInputElement | null = null;
let qualityField: HTMLElement | null = null;
const scheduleSize = debounce(() => {
  void refreshSize();
}, 280);

export async function mountResize(host: HTMLElement): Promise<void> {
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("resize.back")),
      h("h1", null, t("resize.title")),
      h("p", { class: "lede" }, t("resize.privacyNote")),
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

export function unmountResize(): void {
  window.removeEventListener("paste", onPaste);
  preview = null;
  statusEl = null;
  sizeEl = null;
  widthEl = null;
  heightEl = null;
  qualityField = null;
}

function filesRail(): HTMLElement {
  const input = h("input", {
    type: "file",
    accept: "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif,image/heic,image/heif,image/*",
    class: "sr-only",
    id: "resize-file-input",
    onChange: (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void setFile(file);
      (e.target as HTMLInputElement).value = "";
    },
  });
  const drop = h("label", {
    class: "drop",
    for: "resize-file-input",
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
    h("strong", null, t("resize.dropTitle")),
    h("span", null, t("resize.dropHint")),
    h("em", null, t("resize.dropTypes")),
  );
  return h("aside", { class: "rail" },
    h("div", { class: "rail-h" }, h("h2", null, t("resize.filesTitle"))),
    drop,
  );
}

function stagePane(): HTMLElement {
  preview = h("canvas", { class: "preview", width: 800, height: 560 });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  sizeEl = h("p", { class: "muted convert-size" });
  return h("section", { class: "stage" },
    h("div", { class: "stage-frame" }, preview),
    h("p", { class: "hint" }, t("resize.hint")),
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn", onClick: () => void download() }, t("resize.download")),
    ),
    sizeEl,
    statusEl,
  );
}

function controls(): HTMLElement {
  widthEl = h("input", {
    type: "number",
    min: "1",
    step: "1",
    value: String(state.width),
    onInput: (e: Event) => {
      const w = Math.max(1, Number((e.target as HTMLInputElement).value) || 1);
      state.width = w;
      if (state.lock && state.item) {
        state.height = Math.max(1, Math.round(w * state.item.height / state.item.width));
        if (heightEl) heightEl.value = String(state.height);
      }
      scheduleSize();
    },
  });
  heightEl = h("input", {
    type: "number",
    min: "1",
    step: "1",
    value: String(state.height),
    onInput: (e: Event) => {
      const hgt = Math.max(1, Number((e.target as HTMLInputElement).value) || 1);
      state.height = hgt;
      if (state.lock && state.item) {
        state.width = Math.max(1, Math.round(hgt * state.item.width / state.item.height));
        if (widthEl) widthEl.value = String(state.width);
      }
      scheduleSize();
    },
  });
  qualityField = labeled(t("resize.quality"),
    h("input", {
      type: "range",
      min: "0.4",
      max: "1",
      step: "0.01",
      value: String(state.quality),
      onInput: (e: Event) => {
        state.quality = Number((e.target as HTMLInputElement).value);
        scheduleSize();
      },
    }),
  );
  qualityField.hidden = state.format === "png";
  return h("aside", { class: "rail controls" },
    h("fieldset", null,
      h("legend", null, t("resize.exportTitle")),
      labeled(t("resize.width"), widthEl),
      labeled(t("resize.height"), heightEl),
      h("label", { class: "check" },
        h("input", {
          type: "checkbox",
          checked: state.lock,
          onChange: (e: Event) => {
            state.lock = (e.target as HTMLInputElement).checked;
          },
        }),
        t("resize.lock"),
      ),
      h("div", { class: "chips convert-chips" },
        preset("1920", () => applyMax(1920)),
        preset("1280", () => applyMax(1280)),
        preset("800", () => applyMax(800)),
        preset("50%", () => applyPercent(50)),
        preset(t("resize.original"), () => applyOriginal()),
      ),
      labeled(t("resize.format"),
        h("select", {
          onChange: (e: Event) => {
            state.format = (e.target as HTMLSelectElement).value as ImageFormat;
            if (qualityField) qualityField.hidden = state.format === "png";
            scheduleSize();
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

function preset(label: string, fn: () => void): HTMLElement {
  return h("button", { type: "button", class: "chip", onClick: fn }, label);
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function applyMax(edge: number): void {
  if (!state.item) return;
  const size = targetSize(state.item.width, state.item.height, { kind: "max-edge", edge });
  setSize(size.width, size.height);
}

function applyPercent(pct: number): void {
  if (!state.item) return;
  const size = targetSize(state.item.width, state.item.height, { kind: "percent", pct });
  setSize(size.width, size.height);
}

function applyOriginal(): void {
  if (!state.item) return;
  setSize(state.item.width, state.item.height);
}

function setSize(width: number, height: number): void {
  state.width = width;
  state.height = height;
  if (widthEl) widthEl.value = String(width);
  if (heightEl) heightEl.value = String(height);
  scheduleSize();
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
    applyMax(1920);
    redraw();
  } catch {
    if (statusEl) statusEl.textContent = t("resize.errorDecode");
  }
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
    return;
  }
  const max = 1400;
  const scale = Math.min(1, max / Math.max(item.width, item.height));
  preview.width = Math.max(1, Math.round(item.width * scale));
  preview.height = Math.max(1, Math.round(item.height * scale));
  ctx.clearRect(0, 0, preview.width, preview.height);
  ctx.drawImage(item.bitmap, 0, 0, preview.width, preview.height);
}

async function encode(): Promise<Blob> {
  const item = state.item;
  if (!item) throw new Error("empty");
  const size = targetSize(item.width, item.height, {
    kind: "exact",
    width: state.width,
    height: state.height,
    lock: false,
  });
  const canvas = drawToCanvas(item.bitmap, size.width, size.height);
  return canvasToBlob(canvas, mimeForFormat(state.format === "png" ? "png" : state.format), state.quality);
}

async function refreshSize(): Promise<void> {
  if (!sizeEl) return;
  if (!state.item) {
    sizeEl.textContent = "";
    return;
  }
  try {
    const blob = await encode();
    sizeEl.textContent = t("resize.sizeLabel", {
      src: `${state.item.width}×${state.item.height} · ${formatBytes(state.item.file.size)}`,
      out: `${state.width}×${state.height} · ${formatBytes(blob.size)}`,
    });
  } catch {
    sizeEl.textContent = "";
  }
}

async function download(): Promise<void> {
  if (!state.item) {
    if (statusEl) statusEl.textContent = t("resize.emptyDownload");
    return;
  }
  if (statusEl) statusEl.textContent = t("resize.working");
  try {
    const blob = await encode();
    downloadBlob(blob, outputFilename(state.item.file.name, blob.type, "-resize"));
    if (statusEl) statusEl.textContent = "";
  } catch {
    if (statusEl) statusEl.textContent = t("resize.errorDecode");
  }
}
