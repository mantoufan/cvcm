import { outputFilename } from "../../shared/filename";
import { blobFromBytes } from "../../shared/image-encode";
import { appHref } from "../../shared/path";
import { zipStore } from "../../shared/zip";
import { AiClient } from "../ai/client";
import { dropZone, formatSeconds, deviceLabel, prewarm, runJob, statusPanel, type Status } from "../ai/kit";
import type { AiResponse } from "../ai/protocol";
import { canvasToBlob, decodeImage } from "../decode";
import { clear, downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";

type Item = {
  file: File;
  thumb: string;
  bitmap: ImageBitmap;
  width: number;
  height: number;
  /** The model's mask (alpha only), at the model's resolution. */
  mask: HTMLCanvasElement | null;
  state: "queued" | "running" | "done" | "error";
};

type Backdrop = "transparent" | "white" | "color" | "blur";

const state = {
  items: [] as Item[],
  active: -1,
  backdrop: "transparent" as Backdrop,
  color: "#ffffff",
  format: "png" as "png" | "jpeg" | "webp",
  showOriginal: false,
  busy: false,
};

let client: AiClient | null = null;
let status: Status | null = null;
let listEl: HTMLElement | null = null;
let preview: HTMLCanvasElement | null = null;
let hintEl: HTMLElement | null = null;
let chips: HTMLButtonElement[] = [];
let colorInput: HTMLInputElement | null = null;
let alive = false;

export async function mountRemoveBackground(host: HTMLElement): Promise<void> {
  alive = true;
  client = new AiClient();
  status = statusPanel("BiRefNet lite", "birefnet");
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("removeBg.back")),
      h("h1", null, t("removeBg.title")),
      h("p", { class: "lede" }, t("removeBg.privacyNote")),
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

export function unmountRemoveBackground(): void {
  alive = false;
  window.removeEventListener("paste", onPaste);
  client?.dispose();
  client = null;
  for (const item of state.items) {
    item.bitmap.close();
    URL.revokeObjectURL(item.thumb);
  }
  state.items = [];
  state.active = -1;
  state.busy = false;
  status = null;
  listEl = null;
  preview = null;
  hintEl = null;
  chips = [];
  colorInput = null;
}

function filesRail(): HTMLElement {
  listEl = h("ul", { class: "file-list" });
  return h("aside", { class: "rail" },
    h("div", { class: "rail-h" }, h("h2", null, t("removeBg.filesTitle"))),
    dropZone({
      id: "remove-bg-file-input",
      accept: "image/png,image/jpeg,image/webp,image/avif,image/heic,image/heif,image/*",
      multiple: true,
      title: t("removeBg.dropTitle"),
      hint: t("removeBg.dropHint"),
      types: t("removeBg.dropTypes"),
      onFiles: (files) => void addFiles(files),
      onIntent: () => {
        if (client && status) void prewarm(client, "birefnet", status);
      },
    }),
    listEl,
  );
}

function stagePane(): HTMLElement {
  preview = h("canvas", { class: "preview", width: 800, height: 560 });
  hintEl = h("p", { class: "hint" }, t("removeBg.hint"));
  const compare = h("button", {
    type: "button",
    class: "btn ghost",
    onPointerdown: () => setOriginal(true),
    onPointerup: () => setOriginal(false),
    onPointerleave: () => setOriginal(false),
    onKeydown: (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") setOriginal(true);
    },
    onKeyup: () => setOriginal(false),
  }, t("removeBg.compare"));
  return h("section", { class: "stage" },
    h("div", { class: "stage-frame" }, preview),
    status!.el,
    hintEl,
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn", onClick: () => void downloadActive() }, t("removeBg.download")),
      h("button", { type: "button", class: "btn ghost", onClick: () => void downloadAll() }, t("removeBg.downloadAll")),
      compare,
    ),
  );
}

function controls(): HTMLElement {
  const backdrops: Backdrop[] = ["transparent", "white", "color", "blur"];
  chips = backdrops.map((b) =>
    h("button", {
      type: "button",
      class: "chip" + (state.backdrop === b ? " on" : ""),
      "aria-pressed": String(state.backdrop === b),
      dataset: { backdrop: b },
      onClick: () => {
        state.backdrop = b;
        if (b !== "transparent" && state.format === "png") state.format = "jpeg";
        syncControls();
        redraw();
      },
    }, t(`removeBg.bg_${b}`)),
  );
  colorInput = h("input", {
    type: "color",
    value: state.color,
    "aria-label": t("removeBg.bg_color"),
    onInput: (e: Event) => {
      state.color = (e.target as HTMLInputElement).value;
      state.backdrop = "color";
      syncControls();
      redraw();
    },
  });
  const format = h("select", {
    class: "remove-bg-format",
    onChange: (e: Event) => {
      state.format = (e.target as HTMLSelectElement).value as typeof state.format;
    },
  },
    h("option", { value: "png", selected: state.format === "png" }, "PNG"),
    h("option", { value: "jpeg", selected: state.format === "jpeg" }, "JPG"),
    h("option", { value: "webp", selected: state.format === "webp" }, "WebP"),
  );
  return h("aside", { class: "rail controls" },
    h("fieldset", null,
      h("legend", null, t("removeBg.background")),
      h("div", { class: "convert-chips" }, ...chips),
      h("label", { class: "field" }, h("span", null, t("removeBg.bg_color")), colorInput),
    ),
    h("fieldset", null,
      h("legend", null, t("removeBg.export")),
      h("label", { class: "field" }, h("span", null, t("removeBg.format")), format),
      h("p", { class: "muted" }, t("removeBg.formatNote")),
    ),
  );
}

function syncControls(): void {
  for (const chip of chips) {
    const on = chip.dataset.backdrop === state.backdrop;
    chip.classList.toggle("on", on);
    chip.setAttribute("aria-pressed", String(on));
  }
  const select = document.querySelector<HTMLSelectElement>(".remove-bg-format");
  if (select) select.value = state.format;
}

function setOriginal(on: boolean): void {
  if (state.showOriginal === on) return;
  state.showOriginal = on;
  redraw();
}

function onPaste(e: ClipboardEvent): void {
  const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith("image/"));
  if (files.length) {
    e.preventDefault();
    void addFiles(files);
  }
}

async function addFiles(files: File[]): Promise<void> {
  const images = files.filter((f) => f.type.startsWith("image/") || /\.(png|jpe?g|webp|avif|heic|heif|gif|bmp)$/i.test(f.name));
  for (const file of images) {
    try {
      const decoded = await decodeImage(file);
      if (!alive) {
        decoded.bitmap.close();
        return;
      }
      state.items.push({ file, thumb: URL.createObjectURL(file), mask: null, state: "queued", ...decoded });
      if (state.active < 0) state.active = state.items.length - 1;
    } catch {
      status?.error(t("removeBg.errorDecode"));
    }
  }
  renderList();
  redraw();
  void processQueue();
}

async function processQueue(): Promise<void> {
  if (state.busy) return;
  state.busy = true;
  try {
    for (;;) {
      const item = state.items.find((it) => it.state === "queued");
      if (!item || !alive || !client || !status) break;
      item.state = "running";
      renderList();
      try {
        const { result, backend, seconds } = await runJob<Extract<AiResponse, { type: "mask" }>>(
          client,
          status,
          async () => {
            const bitmap = await createImageBitmap(item.bitmap);
            return { body: { type: "remove-background", bitmap }, transfer: [bitmap] };
          },
        );
        item.mask = maskCanvas(result.mask, result.width, result.height);
        item.state = "done";
        status.done(t("ai.doneIn", { s: formatSeconds(seconds), device: deviceLabel(backend) }));
      } catch (err) {
        if (!alive) return;
        item.state = "error";
        status.error(t("ai.errorRun"));
        console.error(err);
      }
      renderList();
      if (state.items[state.active] === item) redraw();
    }
  } finally {
    state.busy = false;
  }
}

function maskCanvas(mask: Uint8ClampedArray, width: number, height: number): HTMLCanvasElement {
  const canvas = h("canvas", { width, height });
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(width, height);
  for (let i = 0; i < mask.length; i++) img.data[i * 4 + 3] = mask[i];
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** The finished picture at full size: the cut-out over the chosen background. */
function compose(item: Item, original = false): HTMLCanvasElement {
  const { width, height } = item;
  const out = h("canvas", { width, height });
  const ctx = out.getContext("2d")!;
  if (original || !item.mask) {
    ctx.drawImage(item.bitmap, 0, 0);
    return out;
  }
  const cut = h("canvas", { width, height });
  const cctx = cut.getContext("2d")!;
  cctx.drawImage(item.bitmap, 0, 0);
  cctx.globalCompositeOperation = "destination-in";
  cctx.imageSmoothingQuality = "high";
  cctx.drawImage(item.mask, 0, 0, width, height);
  if (state.backdrop === "white" || state.backdrop === "color") {
    ctx.fillStyle = state.backdrop === "white" ? "#ffffff" : state.color;
    ctx.fillRect(0, 0, width, height);
  } else if (state.backdrop === "blur") {
    ctx.filter = `blur(${Math.max(4, Math.round(Math.max(width, height) / 90))}px)`;
    ctx.drawImage(item.bitmap, 0, 0);
    ctx.filter = "none";
  }
  ctx.drawImage(cut, 0, 0);
  return out;
}

function renderList(): void {
  if (!listEl) return;
  clear(listEl);
  state.items.forEach((item, i) => {
    listEl!.append(
      h("li", {
        class: "file" + (i === state.active ? " on" : ""),
        tabindex: "0",
        onClick: () => select(i),
        onKeydown: (e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") select(i);
        },
      },
        h("img", { src: item.thumb, alt: "", loading: "lazy" }),
        h("div", null,
          h("strong", null, item.file.name),
          h("span", null, t(`removeBg.state_${item.state}`)),
        ),
        h("div", { class: "file-ops" },
          h("button", {
            type: "button",
            class: "icon",
            "aria-label": t("removeBg.remove"),
            onClick: (e: Event) => {
              e.stopPropagation();
              removeItem(i);
            },
          }, "×"),
        ),
      ),
    );
  });
}

function select(i: number): void {
  state.active = i;
  renderList();
  redraw();
}

function removeItem(i: number): void {
  const [item] = state.items.splice(i, 1);
  if (!item) return;
  item.state = "error";
  item.bitmap.close();
  URL.revokeObjectURL(item.thumb);
  // Keep the same photo selected when one before it goes.
  if (i < state.active || state.active >= state.items.length) state.active -= 1;
  renderList();
  redraw();
}

function redraw(): void {
  if (!preview) return;
  const ctx = preview.getContext("2d");
  if (!ctx) return;
  const item = state.items[state.active];
  if (!item) {
    preview.width = 800;
    preview.height = 560;
    ctx.clearRect(0, 0, preview.width, preview.height);
    if (hintEl) hintEl.textContent = t("removeBg.hint");
    return;
  }
  const full = compose(item, state.showOriginal);
  const scale = Math.min(1, 1400 / Math.max(item.width, item.height));
  preview.width = Math.max(1, Math.round(item.width * scale));
  preview.height = Math.max(1, Math.round(item.height * scale));
  ctx.clearRect(0, 0, preview.width, preview.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(full, 0, 0, preview.width, preview.height);
  if (hintEl) hintEl.textContent = `${item.width} × ${item.height}`;
}

function mime(): string {
  // A transparent background needs an alpha channel: JPG falls back to white.
  return state.format === "jpeg" ? "image/jpeg" : state.format === "webp" ? "image/webp" : "image/png";
}

async function encode(item: Item): Promise<Blob> {
  const canvas = compose(item);
  if (state.format === "jpeg" && state.backdrop === "transparent") {
    const flat = h("canvas", { width: canvas.width, height: canvas.height });
    const ctx = flat.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, flat.width, flat.height);
    ctx.drawImage(canvas, 0, 0);
    return canvasToBlob(flat, mime(), 0.92);
  }
  return canvasToBlob(canvas, mime(), 0.92);
}

async function downloadActive(): Promise<void> {
  const item = state.items[state.active];
  if (!item?.mask) {
    status?.error(t("removeBg.emptyDownload"));
    return;
  }
  const blob = await encode(item);
  downloadBlob(blob, outputFilename(item.file.name, blob.type, "-no-bg"));
}

async function downloadAll(): Promise<void> {
  const done = state.items.filter((it) => it.mask);
  if (done.length === 0) {
    status?.error(t("removeBg.emptyDownload"));
    return;
  }
  if (done.length === 1) {
    const blob = await encode(done[0]);
    downloadBlob(blob, outputFilename(done[0].file.name, blob.type, "-no-bg"));
    return;
  }
  const used = new Set<string>();
  const entries = [];
  for (const item of done) {
    const blob = await encode(item);
    let name = outputFilename(item.file.name, blob.type, "-no-bg");
    for (let n = 2; used.has(name); n++) name = outputFilename(item.file.name, blob.type, `-no-bg-${n}`);
    used.add(name);
    entries.push({ name, data: new Uint8Array(await blob.arrayBuffer()) });
  }
  downloadBlob(blobFromBytes(zipStore(entries), "application/zip"), "cvcm-no-bg.zip");
}
