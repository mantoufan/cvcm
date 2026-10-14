import { copyWithFlash } from "../copy";
import { decodeImage } from "../decode";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { MAX_COLORS, MIN_COLORS, extractPalette, sampleSize, type PaletteColor } from "../../shared/image-colors";

const state = {
  bitmap: null as ImageBitmap | null,
  /** Downscaled RGBA of the current bitmap, so moving the slider only reruns extractPalette. */
  pixels: null as Uint8ClampedArray | null,
  count: 6,
  palette: [] as PaletteColor[],
  /** Bumped on every new file and on mount/unmount; a decode that finishes for an older value is dropped. */
  gen: 0,
};

function resetState(): void {
  state.gen += 1;
  state.bitmap?.close();
  state.bitmap = null;
  state.pixels = null;
  state.palette = [];
  state.count = 6;
}

let preview: HTMLCanvasElement | null = null;
let listEl: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let countEl: HTMLInputElement | null = null;
let countOut: HTMLElement | null = null;
let copyAllBtn: HTMLButtonElement | null = null;

export function mountImageColors(host: HTMLElement): void {
  resetState();
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("image-colors.back")),
      h("h1", null, t("image-colors.title")),
      h("p", { class: "lede" }, t("image-colors.privacyNote")),
    ),
    h("div", { class: "tool" },
      filesRail(),
      stagePane(),
      controls(),
    ),
  );
  paintList();
  window.addEventListener("paste", onPaste);
}

export function unmountImageColors(): void {
  window.removeEventListener("paste", onPaste);
  resetState();
  preview = listEl = statusEl = countOut = null;
  countEl = null;
  copyAllBtn = null;
}

function filesRail(): HTMLElement {
  const input = h("input", {
    type: "file",
    accept: "image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp,image/*",
    class: "sr-only",
    id: "image-colors-file-input",
    onChange: (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void setFile(file);
      (e.target as HTMLInputElement).value = "";
    },
  });
  const drop = h("label", {
    class: "drop",
    for: "image-colors-file-input",
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
    h("strong", null, t("image-colors.dropTitle")),
    h("span", null, t("image-colors.dropHint")),
    h("em", null, t("image-colors.dropTypes")),
  );
  return h("aside", { class: "rail" },
    h("div", { class: "rail-h" }, h("h2", null, t("image-colors.filesTitle"))),
    drop,
  );
}

function stagePane(): HTMLElement {
  preview = h("canvas", { class: "preview", width: 800, height: 560 });
  statusEl = h("p", { class: "status", "aria-live": "polite" }, t("image-colors.hint"));
  return h("section", { class: "stage" },
    h("div", { class: "stage-frame" }, preview),
    statusEl,
  );
}

function controls(): HTMLElement {
  countOut = h("output", null, String(state.count));
  countEl = h("input", {
    type: "range",
    min: String(MIN_COLORS),
    max: String(MAX_COLORS),
    step: "1",
    value: String(state.count),
    "data-field": "count",
    onInput: (e: Event) => {
      state.count = Number((e.target as HTMLInputElement).value);
      if (countOut) countOut.textContent = String(state.count);
      paintPalette();
    },
  });
  listEl = h("ul", { class: "palette-list" });
  return h("aside", { class: "rail controls" },
    h("fieldset", null,
      h("legend", null, t("image-colors.options")),
      h("label", { class: "field" }, h("span", null, t("image-colors.count"), " ", countOut), countEl),
    ),
    h("div", null, h("h2", null, t("image-colors.palette")), listEl),
    h("div", { class: "stage-actions" },
      copyAllBtn = h("button", { type: "button", class: "btn", onClick: () => void copyAll() }, t("image-colors.copyAll")),
    ),
  );
}

function imageFromList(list?: FileList | null): File | null {
  return [...(list || [])].find((f) => f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(f.name)) || null;
}

function onPaste(e: ClipboardEvent): void {
  const file = imageFromList(e.clipboardData?.files);
  if (file) {
    e.preventDefault();
    void setFile(file);
  }
}

async function setFile(file: File): Promise<void> {
  const gen = ++state.gen;
  let bitmap: ImageBitmap;
  try {
    ({ bitmap } = await decodeImage(file));
  } catch {
    if (gen === state.gen && statusEl) statusEl.textContent = t("image-colors.errorDecode");
    return;
  }
  // A newer file, or leaving the page, won the race: drop this bitmap instead of keeping it.
  if (gen !== state.gen) {
    bitmap.close();
    return;
  }
  state.bitmap?.close();
  state.bitmap = bitmap;
  state.pixels = samplePixels(bitmap);
  drawPreview();
  paintPalette();
}

function drawPreview(): void {
  const bmp = state.bitmap;
  if (!preview || !bmp) return;
  const max = 1200;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  preview.width = Math.max(1, Math.round(bmp.width * scale));
  preview.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = preview.getContext("2d");
  ctx?.clearRect(0, 0, preview.width, preview.height);
  ctx?.drawImage(bmp, 0, 0, preview.width, preview.height);
}

function samplePixels(bmp: ImageBitmap): Uint8ClampedArray | null {
  const size = sampleSize(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bmp, 0, 0, size.width, size.height);
  return ctx.getImageData(0, 0, size.width, size.height).data;
}

function paintPalette(): void {
  if (!state.pixels) return;
  state.palette = extractPalette(state.pixels, state.count);
  if (statusEl) statusEl.textContent = state.palette.length ? t("image-colors.done") : t("image-colors.empty");
  paintList();
}

function paintList(): void {
  if (!listEl) return;
  listEl.replaceChildren();
  if (!state.palette.length) {
    listEl.append(h("li", { class: "muted" }, t("image-colors.none")));
    return;
  }
  for (const color of state.palette) {
    const code = h("code", null, color.hex);
    const btn = h("button", {
      type: "button",
      class: "palette-item",
      title: t("image-colors.copyOne"),
      onClick: () => void copyWithFlash(code, color.hex, { done: t("image-colors.copied"), failed: t("image-colors.copyFailed") }),
    },
      h("span", { class: "palette-chip", style: { background: color.hex } }),
      code,
      h("small", null, `${(color.share * 100).toFixed(1)}%`),
    );
    listEl.append(h("li", null, btn));
  }
}

async function copyAll(): Promise<void> {
  await copyWithFlash(copyAllBtn, state.palette.map((c) => c.hex).join("\n"), {
    done: t("image-colors.copied"),
    failed: t("image-colors.copyFailed"),
  });
}
