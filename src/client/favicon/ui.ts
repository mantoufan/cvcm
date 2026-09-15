import { canvasToBlob, decodeImage } from "../decode";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { ICO_SIZES, PNG_SIZES, packIco, squareDest, squareSource, type FitMode } from "../../shared/favicon";
import { blobFromBytes } from "../../shared/image-encode";
import { zipStore } from "../../shared/zip";

type Item = { file: File; width: number; height: number; bitmap: ImageBitmap };

const state = {
  item: null as Item | null,
  fit: "cover" as FitMode,
  whiteBg: true,
};

let preview: HTMLCanvasElement | null = null;
let statusEl: HTMLElement | null = null;

export async function mountFavicon(host: HTMLElement): Promise<void> {
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("favicon.back")),
      h("h1", null, t("favicon.title")),
      h("p", { class: "lede" }, t("favicon.privacyNote")),
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

export function unmountFavicon(): void {
  window.removeEventListener("paste", onPaste);
  state.item?.bitmap.close();
  state.item = null;
  preview = null;
  statusEl = null;
}

function filesRail(): HTMLElement {
  const input = h("input", {
    type: "file",
    accept: "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif,image/heic,image/heif,image/*",
    class: "sr-only",
    id: "favicon-file-input",
    onChange: (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void setFile(file);
      (e.target as HTMLInputElement).value = "";
    },
  });
  const drop = h("label", {
    class: "drop",
    for: "favicon-file-input",
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
    h("strong", null, t("favicon.dropTitle")),
    h("span", null, t("favicon.dropHint")),
    h("em", null, t("favicon.dropTypes")),
  );
  return h("aside", { class: "rail" },
    h("div", { class: "rail-h" }, h("h2", null, t("favicon.filesTitle"))),
    drop,
  );
}

function stagePane(): HTMLElement {
  preview = h("canvas", { class: "preview favicon-preview", width: 256, height: 256 });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  return h("section", { class: "stage" },
    h("div", { class: "stage-frame favicon-frame" }, preview),
    h("p", { class: "hint" }, t("favicon.hint")),
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn", onClick: () => void downloadIco() }, t("favicon.downloadIco")),
      h("button", { type: "button", class: "btn ghost", onClick: () => void downloadZip() }, t("favicon.downloadPng")),
    ),
    statusEl,
  );
}

function controls(): HTMLElement {
  return h("aside", { class: "rail controls" },
    h("fieldset", null,
      h("legend", null, t("favicon.options")),
      labeled(t("favicon.fit"),
        h("select", {
          onChange: (e: Event) => {
            state.fit = (e.target as HTMLSelectElement).value as FitMode;
            redraw();
          },
        },
          h("option", { value: "cover", selected: true }, t("favicon.fitCover")),
          h("option", { value: "contain" }, t("favicon.fitContain")),
        ),
      ),
      h("label", { class: "check" },
        h("input", {
          type: "checkbox",
          checked: true,
          onChange: (e: Event) => {
            state.whiteBg = (e.target as HTMLInputElement).checked;
            redraw();
          },
        }),
        h("span", null, t("favicon.whiteBg")),
      ),
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
    state.item?.bitmap.close();
    state.item = { file, ...decoded };
    if (statusEl) statusEl.textContent = "";
    redraw();
  } catch {
    if (statusEl) statusEl.textContent = t("favicon.errorDecode");
  }
}

function redraw(): void {
  if (!preview) return;
  const ctx = preview.getContext("2d");
  if (!ctx) return;
  const size = 256;
  preview.width = size;
  preview.height = size;
  ctx.clearRect(0, 0, size, size);
  const item = state.item;
  if (!item) return;
  const square = drawSquare(item.bitmap, item.width, item.height, size, state.fit, state.whiteBg);
  ctx.drawImage(square, 0, 0);
}

function drawSquare(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  size: number,
  mode: FitMode,
  whiteBg: boolean,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  if (whiteBg) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
  } else {
    ctx.clearRect(0, 0, size, size);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (mode === "cover") {
    const src = squareSource(srcW, srcH, "cover");
    ctx.drawImage(source, src.sx, src.sy, src.sw, src.sh, 0, 0, size, size);
  } else {
    const dest = squareDest(srcW, srcH, size, "contain");
    ctx.drawImage(source, 0, 0, srcW, srcH, dest.dx, dest.dy, dest.dw, dest.dh);
  }
  return canvas;
}

async function pngAt(size: number): Promise<Uint8Array> {
  const item = state.item;
  if (!item) throw new Error("empty");
  const canvas = drawSquare(item.bitmap, item.width, item.height, size, state.fit, state.whiteBg);
  const blob = await canvasToBlob(canvas, "image/png", 1);
  return new Uint8Array(await blob.arrayBuffer());
}

async function downloadIco(): Promise<void> {
  if (!state.item) {
    if (statusEl) statusEl.textContent = t("favicon.emptyDownload");
    return;
  }
  if (statusEl) statusEl.textContent = t("favicon.working");
  try {
    const images = [];
    for (const size of ICO_SIZES) {
      images.push({ width: size, height: size, png: await pngAt(size) });
    }
    const ico = packIco(images);
    downloadBlob(blobFromBytes(ico, "image/x-icon"), "favicon.ico");
    if (statusEl) statusEl.textContent = "";
  } catch {
    if (statusEl) statusEl.textContent = t("favicon.errorEncode");
  }
}

async function downloadZip(): Promise<void> {
  if (!state.item) {
    if (statusEl) statusEl.textContent = t("favicon.emptyDownload");
    return;
  }
  if (statusEl) statusEl.textContent = t("favicon.working");
  try {
    const entries = [];
    for (const size of PNG_SIZES) {
      entries.push({ name: `favicon-${size}.png`, data: await pngAt(size) });
    }
    downloadBlob(blobFromBytes(zipStore(entries), "application/zip"), "favicon-png.zip");
    if (statusEl) statusEl.textContent = "";
  } catch {
    if (statusEl) statusEl.textContent = t("favicon.errorEncode");
  }
}
