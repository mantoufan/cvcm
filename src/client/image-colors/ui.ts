import { decodeImage } from "../decode";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { MAX_COLORS, MIN_COLORS, extractPalette, sampleSize, type PaletteColor } from "../../shared/image-colors";

const state = {
  bitmap: null as ImageBitmap | null,
  count: 6,
  palette: [] as PaletteColor[],
};

let preview: HTMLCanvasElement | null = null;
let listEl: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let countEl: HTMLInputElement | null = null;
let countOut: HTMLElement | null = null;
let copyAllBtn: HTMLButtonElement | null = null;

export function mountImageColors(host: HTMLElement): void {
  state.count = 6;
  state.palette = [];
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
  state.bitmap?.close();
  state.bitmap = null;
  state.palette = [];
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
      analyse();
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
  try {
    const decoded = await decodeImage(file);
    state.bitmap?.close();
    state.bitmap = decoded.bitmap;
    drawPreview();
    analyse();
  } catch {
    if (statusEl) statusEl.textContent = t("image-colors.errorDecode");
  }
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

function analyse(): void {
  const bmp = state.bitmap;
  if (!bmp) return;
  const size = sampleSize(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  ctx.drawImage(bmp, 0, 0, size.width, size.height);
  const data = ctx.getImageData(0, 0, size.width, size.height).data;
  state.palette = extractPalette(data, state.count);
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
    const btn = h("button", {
      type: "button",
      class: "palette-item",
      title: t("image-colors.copyOne"),
      onClick: () => void copy(color.hex, btn, color.hex),
    },
      h("span", { class: "palette-chip", style: { background: color.hex } }),
      h("code", null, color.hex),
      h("small", null, `${(color.share * 100).toFixed(1)}%`),
    );
    listEl.append(h("li", null, btn));
  }
}

async function copy(text: string, btn: HTMLElement | null, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    const code = btn?.querySelector("code");
    if (code) code.textContent = t("image-colors.copied");
    window.setTimeout(() => {
      if (code) code.textContent = label;
    }, 1000);
  } catch { /* ignore */ }
}

async function copyAll(): Promise<void> {
  if (!state.palette.length) return;
  try {
    await navigator.clipboard.writeText(state.palette.map((c) => c.hex).join("\n"));
    if (copyAllBtn) copyAllBtn.textContent = t("image-colors.copied");
    window.setTimeout(() => {
      if (copyAllBtn) copyAllBtn.textContent = t("image-colors.copyAll");
    }, 1200);
  } catch { /* ignore */ }
}
