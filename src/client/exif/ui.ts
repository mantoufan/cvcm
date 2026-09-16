import { mimeForFormat, outputFilename, type ImageFormat } from "../../shared/filename";
import { detectMetadata } from "../../shared/exif";
import { canvasToBlob, decodeImage, drawToCanvas } from "../decode";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";

type Item = { file: File; url: string; width: number; height: number; bitmap: ImageBitmap; tagged: boolean };

const state = {
  item: null as Item | null,
  format: "jpeg" as ImageFormat,
  quality: 0.92,
};

let preview: HTMLCanvasElement | null = null;
let statusEl: HTMLElement | null = null;
let metaEl: HTMLElement | null = null;
let qualityField: HTMLElement | null = null;

export async function mountExif(host: HTMLElement): Promise<void> {
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("exif.back")),
      h("h1", null, t("exif.title")),
      h("p", { class: "lede" }, t("exif.privacyNote")),
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

export function unmountExif(): void {
  window.removeEventListener("paste", onPaste);
  state.item?.bitmap.close();
  if (state.item) URL.revokeObjectURL(state.item.url);
  state.item = null;
  preview = null;
  statusEl = null;
  metaEl = null;
  qualityField = null;
}

function filesRail(): HTMLElement {
  const input = h("input", {
    type: "file",
    accept: "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif,image/heic,image/heif,image/*",
    class: "sr-only",
    id: "exif-file-input",
    onChange: (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void setFile(file);
      (e.target as HTMLInputElement).value = "";
    },
  });
  const drop = h("label", {
    class: "drop",
    for: "exif-file-input",
    onDragover: (e: Event) => {
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
    h("strong", null, t("exif.dropTitle")),
    h("span", null, t("exif.dropHint")),
    h("em", null, t("exif.dropTypes")),
  );
  return h("aside", { class: "rail" },
    h("div", { class: "rail-h" }, h("h2", null, t("exif.filesTitle"))),
    drop,
  );
}

function stagePane(): HTMLElement {
  preview = h("canvas", { class: "preview", width: 800, height: 560 });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  metaEl = h("p", { class: "hint" }, t("exif.hint"));
  return h("section", { class: "stage" },
    h("div", { class: "stage-frame" }, preview),
    metaEl,
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn", onClick: () => void download() }, t("exif.download")),
    ),
    statusEl,
  );
}

function controls(): HTMLElement {
  qualityField = labeled(t("exif.quality"),
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
      h("legend", null, t("exif.options")),
      labeled(t("exif.format"),
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
    const tagged = detectMetadata(new Uint8Array(await file.arrayBuffer()));
    state.item?.bitmap.close();
    if (state.item) URL.revokeObjectURL(state.item.url);
    state.item = { file, url: URL.createObjectURL(file), tagged, ...decoded };
    if (statusEl) statusEl.textContent = "";
    redraw();
  } catch {
    if (statusEl) statusEl.textContent = t("exif.errorDecode");
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
    if (metaEl) metaEl.textContent = t("exif.hint");
    return;
  }
  const max = 1400;
  const scale = Math.min(1, max / Math.max(item.width, item.height));
  preview.width = Math.max(1, Math.round(item.width * scale));
  preview.height = Math.max(1, Math.round(item.height * scale));
  ctx.clearRect(0, 0, preview.width, preview.height);
  ctx.drawImage(item.bitmap, 0, 0, preview.width, preview.height);
  if (metaEl) metaEl.textContent = item.tagged ? t("exif.found") : t("exif.none");
}

async function download(): Promise<void> {
  if (!state.item) {
    if (statusEl) statusEl.textContent = t("exif.emptyDownload");
    return;
  }
  if (statusEl) statusEl.textContent = t("exif.working");
  try {
    const canvas = drawToCanvas(state.item.bitmap, state.item.width, state.item.height);
    const mime = mimeForFormat(state.format === "png" ? "png" : state.format);
    const blob = await canvasToBlob(canvas, mime, state.quality);
    downloadBlob(blob, outputFilename(state.item.file.name, blob.type, "-clean"));
    if (statusEl) statusEl.textContent = "";
  } catch {
    if (statusEl) statusEl.textContent = t("exif.errorEncode");
  }
}
