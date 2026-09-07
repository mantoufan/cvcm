import { mimeForFormat, outputFilename } from "../../shared/filename";
import { appHref } from "../../shared/path";
import {
  ASPECTS,
  type AspectId,
  type FitMode,
  LAYOUTS,
  type LayoutId,
  cellsFor,
  renderCollage,
} from "../collage/engine";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { zipStore } from "../../shared/zip";
import {
  type Anchor,
  fitExportSize,
  type LogoSpec,
  renderWatermark,
  type TextSpec,
  type WatermarkSpec,
} from "./engine";

const FONTS = {
  sans: 'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif',
  serif: 'Georgia, "Iowan Old Style", "Songti SC", "Noto Serif SC", "SimSun", serif',
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
} as const;

type FontId = keyof typeof FONTS | "custom";

type Item = {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
  bitmap: ImageBitmap | null;
  error: string | null;
};

type Logo = {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  url: string;
  name: string;
};

type Format = "png" | "jpeg" | "webp";
type WmLayout = "single" | LayoutId;

const ANCHORS: Anchor[] = ["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br"];

const state = {
  items: [] as Item[],
  selected: null as string | null,
  text: "",
  font: "sans" as FontId,
  customFont: "",
  size: 0.06,
  color: "#ffffff",
  opacity: 0.55,
  rotate: 0,
  stroke: true,
  tiled: false,
  gap: 0.08,
  layout: "single" as WmLayout,
  collageGap: 16,
  collageRadius: 12,
  collageBg: "#eef1f4",
  collageFit: "cover" as FitMode,
  collageAspect: "square" as AspectId,
  anchor: "br" as Anchor,
  logo: null as Logo | null,
  logoScale: 0.18,
  logoOpacity: 0.7,
  logoRotate: 0,
  format: "png" as Format,
  quality: 0.92,
  working: false,
};

let root: HTMLElement | null = null;
let preview: HTMLCanvasElement | null = null;
let fileList: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let hintEl: HTMLElement | null = null;
let pagehideBound = false;

export function mountWatermark(host: HTMLElement): void {
  root = host;
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("watermark.back")),
      h("h1", null, t("watermark.title")),
      h("p", { class: "lede" }, t("watermark.privacyNote")),
    ),
    h("div", { class: "tool" },
      filesRail(),
      stagePane(),
      controlsRail(),
    ),
  );
  refreshList();
  redraw();
  bindGlobal();
  if (!pagehideBound) {
    pagehideBound = true;
    window.addEventListener("pagehide", () => {
      clearItems();
      clearLogo();
    });
  }
}

export function unmountWatermark(): void {
  window.removeEventListener("paste", onPaste);
  window.removeEventListener("keydown", onKey);
  root = null;
  preview = null;
  fileList = null;
  statusEl = null;
  hintEl = null;
}

function filesRail(): HTMLElement {
  const input = h("input", {
    type: "file",
    accept: "image/png,image/jpeg,image/webp,image/gif,image/*",
    multiple: true,
    class: "sr-only",
    id: "file-input",
    onChange: (e: Event) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) void addFiles(files);
      (e.target as HTMLInputElement).value = "";
    },
  });
  fileList = h("ul", { class: "file-list" });
  const drop = h("label", {
    class: "drop",
    for: "file-input",
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
    h("strong", null, t("watermark.dropTitle")),
    h("span", null, t("watermark.dropHint")),
    h("em", null, t("watermark.dropTypes")),
  );
  return h("aside", { class: "rail" },
    h("div", { class: "rail-h" },
      h("h2", null, t("watermark.filesTitle")),
      h("button", { type: "button", class: "link", onClick: () => clearItems() }, t("watermark.clear")),
    ),
    drop,
    fileList,
  );
}

function stagePane(): HTMLElement {
  preview = h("canvas", { class: "preview", width: 800, height: 600 });
  hintEl = h("p", { class: "hint" }, t("watermark.hintMark"));
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  return h("section", { class: "stage" },
    h("div", { class: "stage-frame" }, preview),
    hintEl,
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn", onClick: () => void downloadOne() }, t("watermark.download")),
      h("button", { type: "button", class: "btn ghost", id: "wm-download-all", onClick: () => void downloadAll() }, t("watermark.downloadAll")),
    ),
    statusEl,
  );
}

function controlsRail(): HTMLElement {
  return h("aside", { class: "rail controls" },
    h("fieldset", null,
      h("legend", null, t("watermark.collageTitle")),
      wmLayoutPicker(),
      collageOptions(),
    ),
    h("fieldset", null,
      h("legend", null, t("watermark.presetsTitle")),
      h("div", { class: "row wrap" },
        h("button", { type: "button", class: "chip", onClick: () => applyPreset("confidential") }, t("watermark.presetConfidential")),
        h("button", { type: "button", class: "chip", onClick: () => applyPreset("copyright") }, t("watermark.presetCopyright")),
        h("button", { type: "button", class: "chip", onClick: () => applyPreset("center") }, t("watermark.presetCenter")),
      ),
    ),
    h("fieldset", null,
      h("legend", null, t("watermark.textTitle")),
      labeled(t("watermark.textContent"),
        h("textarea", {
          id: "wm-text",
          rows: "3",
          placeholder: t("watermark.textPlaceholder"),
          value: state.text,
          onInput: (e: Event) => {
            state.text = (e.target as HTMLTextAreaElement).value;
            redraw();
          },
        }),
      ),
      labeled(t("watermark.font"),
        h("select", {
          onChange: (e: Event) => {
            state.font = (e.target as HTMLSelectElement).value as FontId;
            redraw();
          },
        },
          h("option", { value: "sans", selected: true }, t("watermark.fontSans")),
          h("option", { value: "serif" }, t("watermark.fontSerif")),
          h("option", { value: "mono" }, t("watermark.fontMono")),
          h("option", { value: "custom" }, t("watermark.fontCustom")),
        ),
      ),
      h("input", {
        type: "text",
        class: "custom-font",
        placeholder: t("watermark.fontCustom"),
        onInput: (e: Event) => {
          state.customFont = (e.target as HTMLInputElement).value;
          state.font = "custom";
          redraw();
        },
      }),
      slider("wm-size", t("watermark.size"), 0.02, 0.2, 0.005, state.size, (v) => { state.size = v; }),
      h("div", { class: "row" },
        labeled(t("watermark.color"),
          h("input", {
            type: "color",
            value: state.color,
            onInput: (e: Event) => {
              state.color = (e.target as HTMLInputElement).value;
              redraw();
            },
          }),
        ),
        h("label", { class: "check" },
          h("input", {
            type: "checkbox",
            checked: state.stroke,
            onChange: (e: Event) => {
              state.stroke = (e.target as HTMLInputElement).checked;
              redraw();
            },
          }),
          t("watermark.stroke"),
        ),
      ),
      slider("wm-opacity", t("watermark.opacity"), 0.05, 1, 0.01, state.opacity, (v) => { state.opacity = v; }),
      slider("wm-rotate", t("watermark.rotate"), -180, 180, 1, state.rotate, (v) => { state.rotate = v; }),
    ),
    h("fieldset", null,
      h("legend", null, t("watermark.logoTitle")),
      h("div", { class: "row wrap" },
        logoPicker(),
        h("button", { type: "button", class: "link", onClick: () => clearLogo() }, t("watermark.logoClear")),
      ),
      slider("wm-logo-scale", t("watermark.logoScale"), 0.04, 0.6, 0.01, state.logoScale, (v) => { state.logoScale = v; }),
      slider("wm-logo-opacity", t("watermark.opacity"), 0.05, 1, 0.01, state.logoOpacity, (v) => { state.logoOpacity = v; }),
      slider("wm-logo-rotate", t("watermark.rotate"), -180, 180, 1, state.logoRotate, (v) => { state.logoRotate = v; }),
    ),
    h("fieldset", null,
      h("legend", null, t("watermark.layoutTitle")),
      h("label", { class: "check" },
        h("input", {
          id: "wm-tiled",
          type: "checkbox",
          checked: state.tiled,
          onChange: (e: Event) => {
            state.tiled = (e.target as HTMLInputElement).checked;
            redraw();
          },
        }),
        t("watermark.tiled"),
      ),
      slider("wm-gap", t("watermark.gap"), 0, 0.5, 0.01, state.gap, (v) => { state.gap = v; }),
      positionPad(),
    ),
    h("fieldset", null,
      h("legend", null, t("watermark.exportTitle")),
      labeled(t("watermark.format"),
        h("select", {
          onChange: (e: Event) => {
            state.format = (e.target as HTMLSelectElement).value as Format;
          },
        },
          h("option", { value: "png", selected: true }, "PNG"),
          h("option", { value: "jpeg" }, "JPEG"),
          h("option", { value: "webp" }, "WebP"),
        ),
      ),
      slider("wm-quality", t("watermark.quality"), 0.4, 1, 0.01, state.quality, (v) => { state.quality = v; }),
    ),
  );
}

function wmLayoutPicker(): HTMLElement {
  const wrap = h("div", { class: "layout-grid" });
  const ids: WmLayout[] = ["single", ...LAYOUTS];
  for (const id of ids) {
    const count = id === "single" ? 1 : cellsFor(id).length;
    const marks = Array.from({ length: count }, () => h("i"));
    const btn = h("button", {
      type: "button",
      class: "layout-btn" + (id === state.layout ? " on" : ""),
      "aria-label": id === "single" ? t("watermark.layoutSingle") : t(`collage.layout.${id}`),
      "aria-pressed": String(id === state.layout),
      onClick: () => {
        state.layout = id;
        wrap.querySelectorAll(".layout-btn").forEach((el) => {
          el.classList.toggle("on", el === btn);
          el.setAttribute("aria-pressed", String(el === btn));
        });
        const opts = document.getElementById("wm-collage-opts");
        if (opts) opts.hidden = id === "single";
        const zip = document.getElementById("wm-download-all");
        if (zip) zip.hidden = id !== "single";
        refreshList();
        redraw();
      },
    }, h("span", { class: `mini g-${id}` }, ...marks));
    wrap.append(btn);
  }
  return wrap;
}

function collageOptions(): HTMLElement {
  const box = h("div", { id: "wm-collage-opts" });
  box.hidden = state.layout === "single";
  box.append(
    labeled(t("collage.aspect"),
      h("select", {
        onChange: (e: Event) => {
          state.collageAspect = (e.target as HTMLSelectElement).value as AspectId;
          redraw();
        },
      },
        h("option", { value: "square", selected: true }, t("collage.aspectSquare")),
        h("option", { value: "story" }, t("collage.aspectStory")),
        h("option", { value: "portrait" }, t("collage.aspectPortrait")),
        h("option", { value: "landscape" }, t("collage.aspectLandscape")),
      ),
    ),
    labeled(t("collage.fit"),
      h("select", {
        onChange: (e: Event) => {
          state.collageFit = (e.target as HTMLSelectElement).value as FitMode;
          redraw();
        },
      },
        h("option", { value: "cover", selected: true }, t("collage.fitCover")),
        h("option", { value: "contain" }, t("collage.fitContain")),
      ),
    ),
    labeled(t("collage.background"),
      h("input", {
        type: "color",
        value: state.collageBg,
        onInput: (e: Event) => {
          state.collageBg = (e.target as HTMLInputElement).value;
          redraw();
        },
      }),
    ),
    slider("wm-cg-gap", t("collage.gap"), 0, 48, 1, state.collageGap, (v) => { state.collageGap = v; }),
    slider("wm-cg-radius", t("collage.radius"), 0, 48, 1, state.collageRadius, (v) => { state.collageRadius = v; }),
  );
  return box;
}

function logoPicker(): HTMLElement {
  const input = h("input", {
    type: "file",
    accept: "image/png,image/webp,image/jpeg,image/svg+xml,image/*",
    class: "sr-only",
    id: "logo-input",
    onChange: (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void setLogo(file);
      (e.target as HTMLInputElement).value = "";
    },
  });
  return h("label", { class: "chip file-chip", for: "logo-input" }, input, t("watermark.logoChoose"));
}

function positionPad(): HTMLElement {
  const pad = h("div", { class: "pad", role: "radiogroup", "aria-label": t("watermark.layoutTitle") });
  for (const anchor of ANCHORS) {
    const btn = h("button", {
      type: "button",
      class: "pad-btn" + (anchor === state.anchor ? " on" : ""),
      role: "radio",
      "aria-checked": String(anchor === state.anchor),
      "aria-label": t(`watermark.pos${cap(anchor)}`),
      onClick: () => {
        state.anchor = anchor;
        state.tiled = false;
        const tiled = document.getElementById("wm-tiled");
        if (tiled instanceof HTMLInputElement) tiled.checked = false;
        syncPad();
        redraw();
      },
    });
    pad.append(btn);
  }
  return pad;
}

function cap(anchor: Anchor): string {
  return anchor[0].toUpperCase() + anchor[1];
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function slider(
  id: string,
  label: string,
  min: number,
  max: number,
  step: number,
  value: number,
  onValue: (n: number) => void,
): HTMLElement {
  const input = h("input", {
    id,
    type: "range",
    min: String(min),
    max: String(max),
    step: String(step),
    value: String(value),
    onInput: (e: Event) => {
      onValue(Number((e.target as HTMLInputElement).value));
      redraw();
    },
  });
  return labeled(label, input);
}

function setRange(id: string, value: number): void {
  const el = document.getElementById(id);
  if (el instanceof HTMLInputElement) el.value = String(value);
}

function bindGlobal(): void {
  window.addEventListener("paste", onPaste);
  window.addEventListener("keydown", onKey);
}

function onPaste(e: ClipboardEvent): void {
  const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith("image/"));
  if (files.length) {
    e.preventDefault();
    void addFiles(files);
  }
}

function onKey(e: KeyboardEvent): void {
  if (e.key === "Delete" || e.key === "Backspace") {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
    if (state.selected) removeItem(state.selected);
  }
}

async function addFiles(list: FileList | File[]): Promise<void> {
  const files = [...list].filter((f) => f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(f.name));
  for (const file of files) {
    const id = crypto.randomUUID();
    const url = URL.createObjectURL(file);
    const item: Item = {
      id,
      file,
      url,
      width: 0,
      height: 0,
      bitmap: null,
      error: null,
    };
    state.items.push(item);
    if (!state.selected) state.selected = id;
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      item.bitmap = bitmap;
      item.width = bitmap.width;
      item.height = bitmap.height;
    } catch {
      item.error = t("watermark.errorDecode");
    }
  }
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
  refreshList();
  redraw();
}

async function setLogo(file: File): Promise<void> {
  clearLogo();
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    state.logo = {
      bitmap,
      width: bitmap.width,
      height: bitmap.height,
      url: URL.createObjectURL(file),
      name: file.name,
    };
  } catch {
    setStatus(t("watermark.errorDecode"));
  }
  redraw();
}

function clearLogo(): void {
  if (!state.logo) return;
  state.logo.bitmap.close();
  URL.revokeObjectURL(state.logo.url);
  state.logo = null;
  redraw();
}

function moveItem(id: string, dir: -1 | 1): void {
  const idx = state.items.findIndex((it) => it.id === id);
  const next = idx + dir;
  if (idx < 0 || next < 0 || next >= state.items.length) return;
  const [item] = state.items.splice(idx, 1);
  state.items.splice(next, 0, item);
  refreshList();
  redraw();
}

function refreshList(): void {
  if (!fileList) return;
  fileList.replaceChildren();
  if (state.items.length === 0) {
    fileList.append(h("li", { class: "muted" }, t("watermark.filesEmpty")));
    return;
  }
  const collage = state.layout !== "single";
  const slots = state.layout === "single" ? 0 : cellsFor(state.layout).length;
  state.items.forEach((item, i) => {
    const ops = collage
      ? h("div", { class: "file-ops" },
          h("button", { type: "button", class: "icon", "aria-label": t("collage.up"), onClick: (e: Event) => { e.stopPropagation(); moveItem(item.id, -1); } }, "↑"),
          h("button", { type: "button", class: "icon", "aria-label": t("collage.down"), onClick: (e: Event) => { e.stopPropagation(); moveItem(item.id, 1); } }, "↓"),
          h("button", { type: "button", class: "icon", "aria-label": t("watermark.remove"), onClick: (e: Event) => { e.stopPropagation(); removeItem(item.id); } }, "×"),
        )
      : h("button", {
          type: "button",
          class: "icon",
          "aria-label": t("watermark.remove"),
          onClick: (e: Event) => {
            e.stopPropagation();
            removeItem(item.id);
          },
        }, "×");
    fileList!.append(
      h("li", {
        class: "file" + (collage ? (i < slots ? " on" : "") : item.id === state.selected ? " on" : ""),
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
        ops,
      ),
    );
  });
}

function specFor(): WatermarkSpec {
  const family =
    state.font === "custom" && state.customFont.trim()
      ? state.customFont.trim()
      : FONTS[state.font === "custom" ? "sans" : state.font];
  const text: TextSpec | null = state.text.trim()
    ? {
        text: state.text,
        fontFamily: family,
        fontWeight: "600",
        fontSizeRatio: state.size,
        color: state.color,
        opacity: state.opacity,
        rotate: state.rotate,
        stroke: state.stroke,
        strokeColor: "#1c1916",
      }
    : null;
  const logo: LogoSpec | null = state.logo
    ? {
        image: state.logo.bitmap,
        naturalWidth: state.logo.width,
        naturalHeight: state.logo.height,
        scale: state.logoScale,
        opacity: state.logoOpacity,
        rotate: state.logoRotate,
      }
    : null;
  return {
    text,
    logo,
    position: { mode: "anchor", anchor: state.anchor },
    tiled: state.tiled,
    tileGapRatio: state.gap,
  };
}

function currentItem(): Item | null {
  return state.items.find((it) => it.id === state.selected) ?? state.items[0] ?? null;
}

function collageSlots() {
  return state.items.map((item) =>
    item.bitmap
      ? { image: item.bitmap, naturalWidth: item.width, naturalHeight: item.height }
      : null,
  );
}

function composeSource(): { image: CanvasImageSource; width: number; height: number; name: string } | null {
  if (state.layout !== "single") {
    const ready = state.items.some((it) => it.bitmap);
    if (!ready) return null;
    const aspect = ASPECTS[state.collageAspect];
    const canvas = renderCollage(collageSlots(), state.layout, {
      width: aspect.w,
      height: aspect.h,
      gap: state.collageGap,
      radius: state.collageRadius,
      background: state.collageBg,
      fit: state.collageFit,
    });
    return { image: canvas, width: canvas.width, height: canvas.height, name: "collage.png" };
  }
  const item = currentItem();
  if (!item?.bitmap) return null;
  return { image: item.bitmap, width: item.width, height: item.height, name: item.file.name };
}

function redraw(): void {
  if (!preview) return;
  const zip = document.getElementById("wm-download-all");
  if (zip) zip.hidden = state.layout !== "single";
  const hasMark = Boolean(state.text.trim() || state.logo);
  if (hintEl) hintEl.hidden = hasMark;
  const source = composeSource();
  if (!source) {
    const ctx = preview.getContext("2d");
    if (!ctx) return;
    preview.width = 800;
    preview.height = 560;
    ctx.clearRect(0, 0, preview.width, preview.height);
    return;
  }
  const max = 1400;
  const scale = Math.min(1, max / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const rendered = renderWatermark(source.image, source.width, source.height, specFor(), w, h);
  preview.width = w;
  preview.height = h;
  const ctx = preview.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(rendered, 0, 0);
  if (source.width * source.height > 25_000_000) setStatus(t("watermark.errorHuge"));
}

function applyPreset(kind: "confidential" | "copyright" | "center"): void {
  if (kind === "confidential") {
    if (!state.text.trim()) state.text = "CONFIDENTIAL";
    state.tiled = true;
    state.rotate = -32;
    state.opacity = 0.28;
    state.size = 0.055;
    state.color = "#ffffff";
    state.stroke = true;
  } else if (kind === "copyright") {
    state.tiled = false;
    state.anchor = "br";
    state.rotate = 0;
    state.opacity = 0.7;
    state.size = 0.035;
    if (!state.text.trim()) state.text = "©";
  } else {
    state.tiled = false;
    state.anchor = "mc";
    state.rotate = 0;
    state.opacity = 0.22;
    state.size = 0.1;
  }
  const ta = document.getElementById("wm-text");
  if (ta instanceof HTMLTextAreaElement) ta.value = state.text;
  const tiled = document.getElementById("wm-tiled");
  if (tiled instanceof HTMLInputElement) tiled.checked = state.tiled;
  setRange("wm-size", state.size);
  setRange("wm-opacity", state.opacity);
  setRange("wm-rotate", state.rotate);
  syncPad();
  redraw();
}

function syncPad(): void {
  root?.querySelectorAll(".pad-btn").forEach((btn, i) => {
    const on = ANCHORS[i] === state.anchor;
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-checked", String(on));
  });
}

function setStatus(msg: string): void {
  if (statusEl) statusEl.textContent = msg;
}

async function blobForSource(source: { image: CanvasImageSource; width: number; height: number }): Promise<Blob> {
  const fit = fitExportSize(source.width, source.height);
  const canvas = renderWatermark(
    source.image,
    source.width,
    source.height,
    specFor(),
    fit.width,
    fit.height,
  );
  const mime = mimeForFormat(state.format);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), mime, state.quality);
  });
}

async function blobFor(item: Item): Promise<Blob> {
  if (!item.bitmap) throw new Error("decode");
  return blobForSource({ image: item.bitmap, width: item.width, height: item.height });
}

async function downloadOne(): Promise<void> {
  const source = composeSource();
  if (!source) {
    setStatus(t("watermark.emptyDownload"));
    return;
  }
  state.working = true;
  setStatus(t("watermark.working"));
  try {
    const blob = await blobForSource(source);
    downloadBlob(blob, outputFilename(source.name, blob.type));
    setStatus("");
  } catch {
    setStatus(t("watermark.errorDecode"));
  } finally {
    state.working = false;
  }
}

async function downloadAll(): Promise<void> {
  if (state.layout !== "single") {
    await downloadOne();
    return;
  }
  const ready = state.items.filter((it) => it.bitmap);
  if (ready.length === 0) {
    setStatus(t("watermark.emptyDownload"));
    return;
  }
  if (ready.length === 1) {
    await downloadOne();
    return;
  }
  state.working = true;
  setStatus(t("watermark.working"));
  try {
    const entries = [];
    const used = new Set<string>();
    for (const item of ready) {
      const blob = await blobFor(item);
      const buf = new Uint8Array(await blob.arrayBuffer());
      let name = outputFilename(item.file.name, blob.type);
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
    downloadBlob(new Blob([packed], { type: "application/zip" }), "cvcm-watermark.zip");
    setStatus("");
  } catch {
    setStatus(t("watermark.errorDecode"));
  } finally {
    state.working = false;
  }
}
