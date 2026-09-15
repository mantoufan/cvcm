import { canvasToBlob, decodeImage } from "../decode";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { outputFilename } from "../../shared/filename";
import {
  memeFontSize,
  memeStrokeWidth,
  normalizeMemeText,
  wrapByWidth,
} from "../../shared/meme";

type Item = { file: File; url: string; width: number; height: number; bitmap: ImageBitmap };

const state = {
  item: null as Item | null,
  top: "",
  bottom: "",
  caps: true,
  scale: 1,
};

let preview: HTMLCanvasElement | null = null;
let statusEl: HTMLElement | null = null;
let topEl: HTMLTextAreaElement | null = null;
let bottomEl: HTMLTextAreaElement | null = null;

export async function mountMeme(host: HTMLElement): Promise<void> {
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("meme.back")),
      h("h1", null, t("meme.title")),
      h("p", { class: "lede" }, t("meme.privacyNote")),
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

export function unmountMeme(): void {
  window.removeEventListener("paste", onPaste);
  state.item?.bitmap.close();
  if (state.item) URL.revokeObjectURL(state.item.url);
  state.item = null;
  preview = null;
  statusEl = null;
  topEl = null;
  bottomEl = null;
}

function filesRail(): HTMLElement {
  const input = h("input", {
    type: "file",
    accept: "image/png,image/jpeg,image/webp,image/gif,image/avif,image/heic,image/heif,image/*",
    class: "sr-only",
    id: "meme-file-input",
    onChange: (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void setFile(file);
      (e.target as HTMLInputElement).value = "";
    },
  });
  const drop = h("label", {
    class: "drop",
    for: "meme-file-input",
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
    h("strong", null, t("meme.dropTitle")),
    h("span", null, t("meme.dropHint")),
    h("em", null, t("meme.dropTypes")),
  );
  return h("aside", { class: "rail" },
    h("div", { class: "rail-h" }, h("h2", null, t("meme.filesTitle"))),
    drop,
  );
}

function stagePane(): HTMLElement {
  preview = h("canvas", { class: "preview", width: 800, height: 560 });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  return h("section", { class: "stage" },
    h("div", { class: "stage-frame" }, preview),
    h("p", { class: "hint" }, t("meme.hint")),
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn", onClick: () => void download() }, t("meme.download")),
    ),
    statusEl,
  );
}

function controls(): HTMLElement {
  topEl = h("textarea", {
    class: "meme-caption",
    rows: 2,
    spellcheck: "false",
    placeholder: t("meme.topPlaceholder"),
    onInput: (e: Event) => {
      state.top = (e.target as HTMLTextAreaElement).value;
      redraw();
    },
  });
  bottomEl = h("textarea", {
    class: "meme-caption",
    rows: 2,
    spellcheck: "false",
    placeholder: t("meme.bottomPlaceholder"),
    onInput: (e: Event) => {
      state.bottom = (e.target as HTMLTextAreaElement).value;
      redraw();
    },
  });
  return h("aside", { class: "rail controls" },
    h("fieldset", null,
      h("legend", null, t("meme.captions")),
      labeled(t("meme.top"), topEl),
      labeled(t("meme.bottom"), bottomEl),
      h("label", { class: "check" },
        h("input", {
          type: "checkbox",
          checked: true,
          onChange: (e: Event) => {
            state.caps = (e.target as HTMLInputElement).checked;
            redraw();
          },
        }),
        h("span", null, t("meme.caps")),
      ),
      labeled(t("meme.size"),
        h("input", {
          type: "range",
          min: "0.6",
          max: "1.6",
          step: "0.05",
          value: "1",
          onInput: (e: Event) => {
            state.scale = Number((e.target as HTMLInputElement).value);
            redraw();
          },
        }),
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
    if (statusEl) statusEl.textContent = "";
    redraw();
  } catch {
    if (statusEl) statusEl.textContent = t("meme.errorDecode");
  }
}

function paint(canvas: HTMLCanvasElement, width: number, height: number): void {
  const ctx = canvas.getContext("2d");
  const item = state.item;
  if (!ctx || !item) return;
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(item.bitmap, 0, 0, width, height);
  const fontSize = memeFontSize(width, height, state.scale);
  const stroke = memeStrokeWidth(fontSize);
  const maxWidth = width * 0.92;
  ctx.font = `900 ${fontSize}px Impact, Haettenschweiler, "Arial Black", sans-serif`;
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = stroke;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#111111";
  const measure = (s: string) => ctx.measureText(s).width;
  const top = wrapByWidth(normalizeMemeText(state.top, state.caps), maxWidth, measure);
  const bottom = wrapByWidth(normalizeMemeText(state.bottom, state.caps), maxWidth, measure);
  const lineH = fontSize * 1.05;
  const x = width / 2;
  const pad = Math.round(height * 0.045);
  top.forEach((line, i) => {
    const y = pad + fontSize + i * lineH;
    ctx.strokeText(line, x, y);
    ctx.fillText(line, x, y);
  });
  bottom.forEach((line, i) => {
    const y = height - pad - (bottom.length - 1 - i) * lineH;
    ctx.strokeText(line, x, y);
    ctx.fillText(line, x, y);
  });
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
  paint(preview, Math.max(1, Math.round(item.width * scale)), Math.max(1, Math.round(item.height * scale)));
}

async function download(): Promise<void> {
  const item = state.item;
  if (!item) {
    if (statusEl) statusEl.textContent = t("meme.emptyDownload");
    return;
  }
  if (statusEl) statusEl.textContent = t("meme.working");
  try {
    const canvas = document.createElement("canvas");
    const max = 2400;
    const scale = Math.min(1, max / Math.max(item.width, item.height));
    paint(canvas, Math.max(1, Math.round(item.width * scale)), Math.max(1, Math.round(item.height * scale)));
    const blob = await canvasToBlob(canvas, "image/png", 1);
    downloadBlob(blob, outputFilename(item.file.name, blob.type, "-meme"));
    if (statusEl) statusEl.textContent = "";
  } catch {
    if (statusEl) statusEl.textContent = t("meme.errorDecode");
  }
}
