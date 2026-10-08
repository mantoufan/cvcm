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
import { clearDraft, debounce, loadDraft, markSession, saveDraft, sessionLive } from "../session";
import { zipStore } from "../../shared/zip";
import {
  type Anchor,
  fitExportSize,
  type LogoSpec,
  type Redaction,
  type RedactMode,
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
  redactions: Redaction[];
};

type Logo = {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  url: string;
  name: string;
  file: File;
};

type Format = "png" | "jpeg" | "webp";
type WmLayout = "single" | LayoutId;
type WmPreset = "identity" | "confidential" | "copyright" | "center";
export type WmMode = "watermark" | "mosaic";

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
  collageFit: "contain" as FitMode,
  preset: null as WmPreset | null,
  collageAspect: "square" as AspectId,
  anchor: "br" as Anchor,
  logo: null as Logo | null,
  logoScale: 0.18,
  logoOpacity: 0.7,
  logoRotate: 0,
  format: "png" as Format,
  quality: 0.92,
  redactMode: "mosaic" as RedactMode,
  mosaicRatio: 0.03,
  drawing: false,
  working: false,
};

let root: HTMLElement | null = null;
let preview: HTMLCanvasElement | null = null;
let fileList: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let hintEl: HTMLElement | null = null;
let pagehideBound = false;
let mode: WmMode = "watermark";
let lastRender: HTMLCanvasElement | null = null;
let dragStart: { x: number; y: number } | null = null;
let restoring = false;
let hydrated = false;

const scheduleSave = debounce(() => {
  void persistWatermark();
}, 400);

export async function mountWatermark(host: HTMLElement, toolMode: WmMode = "watermark"): Promise<void> {
  mode = toolMode;
  state.drawing = toolMode === "mosaic";
  restoring = true;
  if (!hydrated) {
    if (sessionLive()) await restoreWatermark();
    else await clearDraft("watermark");
    markSession();
    hydrated = true;
  }
  restoring = false;
  root = host;
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("watermark.back")),
      h("p", { class: "wm-brand" },
        h("img", { src: "/brand/safemark.svg", alt: "", width: "28", height: "28" }),
        h("strong", null, t("watermark.brand")),
        h("span", null, t("watermark.brandTagline")),
      ),
      h("h1", null, t(mode === "mosaic" ? "mosaic.title" : "watermark.title")),
      h("p", { class: "lede" }, t(mode === "mosaic" ? "mosaic.privacyNote" : "watermark.privacyNote")),
      h("nav", { class: "wm-switch", "aria-label": t("watermark.brand") },
        h("a", { href: appHref(locale(), "watermark"), class: mode === "watermark" ? "on" : "", "aria-current": mode === "watermark" ? "page" : undefined }, t("watermark.switchWatermark")),
        h("a", { href: appHref(locale(), "mosaic"), class: mode === "mosaic" ? "on" : "", "aria-current": mode === "mosaic" ? "page" : undefined }, t("watermark.switchMosaic")),
      ),
    ),
    h("div", { class: "tool" },
      filesRail(),
      stagePane(),
      controlsRail(),
    ),
  );
  refreshList();
  redraw();
  syncRedact();
  syncLogoOpts();
  syncPresetChips();
  bindGlobal();
  if (!pagehideBound) {
    pagehideBound = true;
    window.addEventListener("pagehide", () => {
      void persistWatermark();
    });
  }
}

export function unmountWatermark(): void {
  window.removeEventListener("paste", onPaste);
  window.removeEventListener("keydown", onKey);
  root = null;
  preview = null;
  lastRender = null;
  dragStart = null;
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
    h("button", { type: "button", class: "chip wm-sample", onClick: () => void addSample() }, t("watermark.sample")),
    fileList,
  );
}

function stagePane(): HTMLElement {
  preview = h("canvas", {
    class: "preview",
    width: 800,
    height: 600,
    onPointerdown: onDrawStart,
    onPointermove: onDrawMove,
    onPointerup: onDrawEnd,
    onPointercancel: onDrawCancel,
  });
  hintEl = h("p", { class: "hint" }, t("watermark.hintMark"));
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  return h("section", { class: "stage" },
    h("div", { class: "stage-frame", id: "wm-frame" },
      preview,
      h("label", { class: "wm-empty", for: "file-input", id: "wm-empty" },
        h("strong", null, t("watermark.dropTitle")),
        h("span", null, t("watermark.dropHint")),
      ),
    ),
    hintEl,
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn", id: "wm-download", onClick: () => void downloadOne() }, t("watermark.download")),
      h("button", { type: "button", class: "btn ghost", id: "wm-download-all", onClick: () => void downloadAll() }, t("watermark.downloadAll")),
    ),
    statusEl,
  );
}

function redactFieldset(): HTMLElement {
  return h("fieldset", { class: "wm-redact" },
    h("legend", null, t("watermark.redactTitle")),
    h("button", {
      type: "button",
      class: "chip wm-draw",
      id: "wm-draw",
      "aria-pressed": String(state.drawing),
      onClick: () => {
        state.drawing = !state.drawing;
        syncRedact();
      },
    }, t("watermark.redactDraw")),
    h("div", { class: "row wrap", role: "radiogroup", "aria-label": t("watermark.redactTitle") },
      redactChip("mosaic", t("watermark.redactMosaic")),
      redactChip("black", t("watermark.redactBlack")),
    ),
    slider("wm-mosaic", t("watermark.redactStrength"), 0.01, 0.08, 0.005, state.mosaicRatio, (v) => { state.mosaicRatio = v; }),
    h("div", { class: "row wrap" },
      h("span", { class: "muted", id: "wm-redact-count" }),
      h("button", { type: "button", class: "link", id: "wm-redact-undo", onClick: () => undoRedaction() }, t("watermark.redactUndo")),
      h("button", { type: "button", class: "link", id: "wm-redact-clear", onClick: () => clearRedactions() }, t("watermark.redactClear")),
    ),
    h("p", { class: "muted small", id: "wm-redact-collage", hidden: true }, t("watermark.redactCollage")),
    h("p", { class: "muted small" }, t("watermark.redactTip")),
  );
}

function redactChip(id: RedactMode, label: string): HTMLElement {
  return h("button", {
    type: "button",
    class: "chip" + (state.redactMode === id ? " on" : ""),
    role: "radio",
    "aria-checked": String(state.redactMode === id),
    "data-redact": id,
    onClick: () => {
      state.redactMode = id;
      state.drawing = true;
      syncRedact();
    },
  }, label);
}

function controlsRail(): HTMLElement {
  const presets = h("fieldset", null,
      h("legend", null, t("watermark.presetsTitle")),
      h("div", { class: "row wrap" },
        presetChip("identity", t("watermark.presetIdentity")),
        presetChip("confidential", t("watermark.presetConfidential")),
        presetChip("copyright", t("watermark.presetCopyright")),
        presetChip("center", t("watermark.presetCenter")),
      ),
    );
  return h("aside", { class: "rail controls" },
    ...(mode === "mosaic" ? [redactFieldset(), presets] : [presets, redactFieldset()]),
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
          h("option", { value: "sans", selected: state.font === "sans" }, t("watermark.fontSans")),
          h("option", { value: "serif", selected: state.font === "serif" }, t("watermark.fontSerif")),
          h("option", { value: "mono", selected: state.font === "mono" }, t("watermark.fontMono")),
          h("option", { value: "custom", selected: state.font === "custom" }, t("watermark.fontCustom")),
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
        h("button", { type: "button", class: "link", id: "wm-logo-clear", hidden: !state.logo, onClick: () => clearLogo() }, t("watermark.logoClear")),
      ),
      h("div", { id: "wm-logo-opts", hidden: !state.logo },
        slider("wm-logo-scale", t("watermark.logoScale"), 0.04, 0.6, 0.01, state.logoScale, (v) => { state.logoScale = v; }),
        slider("wm-logo-opacity", t("watermark.opacity"), 0.05, 1, 0.01, state.logoOpacity, (v) => { state.logoOpacity = v; }),
        slider("wm-logo-rotate", t("watermark.rotate"), -180, 180, 1, state.logoRotate, (v) => { state.logoRotate = v; }),
      ),
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
            scheduleSave();
          },
        },
          h("option", { value: "png", selected: state.format === "png" }, "PNG"),
          h("option", { value: "jpeg", selected: state.format === "jpeg" }, "JPEG"),
          h("option", { value: "webp", selected: state.format === "webp" }, "WebP"),
        ),
      ),
      slider("wm-quality", t("watermark.quality"), 0.4, 1, 0.01, state.quality, (v) => { state.quality = v; }),
    ),
    h("details", { class: "wm-collage", open: state.layout !== "single" },
      h("summary", null, t("watermark.collageOptional")),
      wmLayoutPicker(),
      collageOptions(),
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
        syncRedact();
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
        h("option", { value: "square", selected: state.collageAspect === "square" }, t("collage.aspectSquare")),
        h("option", { value: "story", selected: state.collageAspect === "story" }, t("collage.aspectStory")),
        h("option", { value: "portrait", selected: state.collageAspect === "portrait" }, t("collage.aspectPortrait")),
        h("option", { value: "landscape", selected: state.collageAspect === "landscape" }, t("collage.aspectLandscape")),
      ),
    ),
    labeled(t("collage.fit"),
      h("select", {
        onChange: (e: Event) => {
          state.collageFit = (e.target as HTMLSelectElement).value as FitMode;
          redraw();
        },
      },
        h("option", { value: "cover", selected: state.collageFit === "cover" }, t("collage.fitCover")),
        h("option", { value: "contain", selected: state.collageFit === "contain" }, t("collage.fitContain")),
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

function presetChip(id: WmPreset, label: string): HTMLElement {
  return h("button", {
    type: "button",
    class: "chip" + (state.preset === id ? " on" : ""),
    "data-preset": id,
    onClick: () => applyPreset(id),
  }, label);
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
      title: t(`watermark.pos${cap(anchor)}`),
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

async function ingestFile(file: File): Promise<void> {
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
    redactions: [],
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

async function addFiles(list: FileList | File[]): Promise<void> {
  const files = [...list].filter((f) => f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(f.name));
  if (files.length === 0) return;
  const first = state.items.length === 0;
  const before = state.items.length;
  for (const file of files) await ingestFile(file);
  // Show what was just added, not whatever was selected before.
  if (state.items[before]) state.selected = state.items[before].id;
  // First image with no mark yet: start from the for-use-only preset so the preview shows a result.
  if (first && mode === "watermark" && !state.preset && !state.text.trim() && !state.logo) {
    applyPreset("identity");
  }
  refreshList();
  syncRedact();
  redraw();
}

/** A clearly fake ID card drawn in the page, so people can try the tool without their own document. */
async function addSample(): Promise<void> {
  const c = document.createElement("canvas");
  c.width = 1200;
  c.height = 760;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  const g = ctx.createLinearGradient(0, 0, 1200, 760);
  g.addColorStop(0, "#dfeefa");
  g.addColorStop(1, "#f6e4ee");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(0, 0, 1200, 760, 48);
  ctx.fill();
  ctx.fillStyle = "#c9d6e3";
  ctx.beginPath();
  ctx.roundRect(820, 150, 300, 380, 24);
  ctx.fill();
  ctx.fillStyle = "#9fb3c8";
  ctx.beginPath();
  ctx.arc(970, 285, 80, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(970, 500, 130, 110, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#33475b";
  ctx.font = `700 54px ${FONTS.sans}`;
  ctx.fillText("SAMPLE ID", 80, 130);
  ctx.font = `500 36px ${FONTS.sans}`;
  const rows: [string, string][] = [
    ["NAME", "ALEX SAMPLE"],
    ["BORN", "2000-01-01"],
    ["ADDR", "1 Example Road"],
  ];
  rows.forEach(([k, v], i) => {
    ctx.fillStyle = "#7a8a9a";
    ctx.fillText(k, 80, 250 + i * 80);
    ctx.fillStyle = "#1f2d3a";
    ctx.fillText(v, 240, 250 + i * 80);
  });
  ctx.fillStyle = "#7a8a9a";
  ctx.fillText("No.", 80, 650);
  ctx.fillStyle = "#1f2d3a";
  ctx.font = `600 52px ${FONTS.mono}`;
  ctx.fillText("0000 1111 2222 3333", 200, 652);
  const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, "image/png"));
  if (!blob) return;
  await addFiles([new File([blob], "sample-id.png", { type: "image/png" })]);
}

function removeItem(id: string): void {
  const idx = state.items.findIndex((it) => it.id === id);
  if (idx < 0) return;
  const [item] = state.items.splice(idx, 1);
  item.bitmap?.close();
  URL.revokeObjectURL(item.url);
  if (state.selected === id) state.selected = state.items[0]?.id ?? null;
  refreshList();
  syncRedact();
  redraw();
}

function clearItems(): void {
  for (const item of state.items) {
    item.bitmap?.close();
    URL.revokeObjectURL(item.url);
  }
  state.items = [];
  state.selected = null;
  void clearDraft("watermark");
  refreshList();
  syncRedact();
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
      file,
    };
  } catch {
    setStatus(t("watermark.errorDecode"));
  }
  syncLogoOpts();
  redraw();
}

function clearLogo(): void {
  if (!state.logo) return;
  state.logo.bitmap.close();
  URL.revokeObjectURL(state.logo.url);
  state.logo = null;
  syncLogoOpts();
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
          syncRedact();
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

function specFor(redactions: Redaction[] = currentRedactions()): WatermarkSpec {
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
    redactions,
    mosaicRatio: state.mosaicRatio,
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

/**
 * Boxes drawn on the selected photo. A collage has none of its own: each photo's boxes
 * are baked in before layout, so changing the grid can never shift a box off a number.
 */
function currentRedactions(): Redaction[] {
  if (state.layout !== "single") return [];
  return currentItem()?.redactions ?? [];
}

function pushRedaction(r: Redaction): void {
  if (state.layout !== "single") return;
  currentItem()?.redactions.push(r);
}

function undoRedaction(): void {
  currentRedactions().pop();
  syncRedact();
  redraw();
}

function clearRedactions(): void {
  currentRedactions().length = 0;
  syncRedact();
  redraw();
}

function syncRedact(): void {
  const collage = state.layout !== "single";
  const draw = document.getElementById("wm-draw");
  if (draw instanceof HTMLButtonElement) {
    draw.disabled = collage;
    draw.classList.toggle("on", state.drawing && !collage);
    draw.setAttribute("aria-pressed", String(state.drawing && !collage));
  }
  const note = document.getElementById("wm-redact-collage");
  if (note) note.hidden = !collage;
  root?.querySelectorAll("[data-redact]").forEach((btn) => {
    const on = (btn as HTMLElement).dataset.redact === state.redactMode;
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-checked", String(on));
  });
  preview?.classList.toggle("drawing", state.drawing && !collage);
  const n = currentRedactions().length;
  const count = document.getElementById("wm-redact-count");
  if (count) count.textContent = n ? t("watermark.redactCount", { n: String(n) }) : t("watermark.redactNone");
  const undo = document.getElementById("wm-redact-undo");
  if (undo) undo.hidden = n === 0;
  const clear = document.getElementById("wm-redact-clear");
  if (clear) clear.hidden = n === 0;
  if (hintEl && state.drawing && !collage && composeSource()) {
    hintEl.hidden = false;
    hintEl.textContent = t("watermark.redactOn");
  }
}

function canvasPoint(e: PointerEvent): { x: number; y: number } | null {
  if (!preview) return null;
  const rect = preview.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return {
    x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
  };
}

function onDrawStart(e: PointerEvent): void {
  if (!state.drawing || state.layout !== "single" || !preview || !composeSource()) return;
  const p = canvasPoint(e);
  if (!p) return;
  e.preventDefault();
  dragStart = p;
  try {
    preview.setPointerCapture(e.pointerId);
  } catch {
    // No active pointer to capture (synthetic events); the drag still works inside the canvas.
  }
}

function onDrawMove(e: PointerEvent): void {
  if (!dragStart || !preview || !lastRender) return;
  const p = canvasPoint(e);
  if (!p) return;
  const ctx = preview.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(lastRender, 0, 0);
  const x = Math.min(dragStart.x, p.x) * preview.width;
  const y = Math.min(dragStart.y, p.y) * preview.height;
  const w = Math.abs(p.x - dragStart.x) * preview.width;
  const hgt = Math.abs(p.y - dragStart.y) * preview.height;
  ctx.save();
  ctx.fillStyle = state.redactMode === "black" ? "rgba(0,0,0,0.55)" : "rgba(200,63,121,0.18)";
  ctx.fillRect(x, y, w, hgt);
  ctx.setLineDash([10, 6]);
  ctx.lineWidth = Math.max(2, preview.width / 400);
  ctx.strokeStyle = "#c83f79";
  ctx.strokeRect(x, y, w, hgt);
  ctx.restore();
}

function onDrawEnd(e: PointerEvent): void {
  if (!dragStart) return;
  const start = dragStart;
  dragStart = null;
  const p = canvasPoint(e);
  if (!p) return;
  const w = p.x - start.x;
  const hgt = p.y - start.y;
  // Judge taps in on-screen pixels, not image ratios: one text line on a long
  // screenshot can be well under 1% of the image height and must still count.
  const rect = preview?.getBoundingClientRect();
  const dx = Math.abs(w) * (rect?.width ?? 0);
  const dy = Math.abs(hgt) * (rect?.height ?? 0);
  if (Math.max(dx, dy) >= 6 && Math.min(dx, dy) >= 2) {
    pushRedaction({
      x: Math.min(start.x, p.x),
      y: Math.min(start.y, p.y),
      w: Math.abs(w),
      h: Math.abs(hgt),
      mode: state.redactMode,
    });
  }
  syncRedact();
  redraw();
}

function onDrawCancel(): void {
  dragStart = null;
  redraw();
}

function collageSlots() {
  if (state.layout === "single") return [];
  // Only the photos the layout shows, and never larger than the collage itself.
  const slots = cellsFor(state.layout).length;
  const aspect = ASPECTS[state.collageAspect];
  const maxSide = Math.max(aspect.w, aspect.h);
  return state.items.slice(0, slots).map((item) => {
    if (!item.bitmap) return null;
    // Bound by the short side: a "cover" cell can fill the whole collage with it, so it must not be upscaled.
    const scale = Math.min(1, maxSide / Math.min(item.width, item.height));
    const image = item.redactions.length
      ? renderWatermark(item.bitmap, item.width, item.height, {
          redactions: item.redactions,
          mosaicRatio: state.mosaicRatio,
          text: null,
          logo: null,
          position: { mode: "anchor", anchor: "br" },
          tiled: false,
          tileGapRatio: 0,
        }, Math.round(item.width * scale), Math.round(item.height * scale))
      : item.bitmap;
    return { image, naturalWidth: item.width, naturalHeight: item.height };
  });
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
  if (!restoring) scheduleSave();
  if (!preview) return;
  const zip = document.getElementById("wm-download-all");
  if (zip) zip.hidden = state.layout !== "single";
  const hasMark = Boolean(state.text.trim() || state.logo || currentRedactions().length);
  const source = composeSource();
  if (hintEl) {
    hintEl.textContent = t(state.drawing && state.layout === "single" ? "watermark.redactOn" : "watermark.hintMark");
    hintEl.hidden = !source || (hasMark && !state.drawing);
  }
  const empty = document.getElementById("wm-empty");
  if (empty) empty.hidden = Boolean(source);
  preview.hidden = !source;
  for (const id of ["wm-download", "wm-download-all"]) {
    const btn = document.getElementById(id);
    if (btn instanceof HTMLButtonElement) btn.disabled = !source;
  }
  if (!source) {
    lastRender = null;
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
  lastRender = rendered;
  if (source.width * source.height > 25_000_000) setStatus(t("watermark.errorHuge"));
}

function todayStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function applyPreset(kind: WmPreset): void {
  state.preset = kind;
  if (kind === "identity") {
    state.text = t("watermark.presetIdentityText", { date: todayStamp() });
    state.tiled = true;
    state.rotate = -32;
    state.opacity = 0.34;
    state.size = 0.048;
    state.color = "#ffffff";
    state.stroke = true;
  } else if (kind === "confidential") {
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
  syncPresetChips();
  redraw();
  if (kind === "identity" && ta instanceof HTMLTextAreaElement && matchMedia("(pointer: fine)").matches) {
    const at = ta.value.search(/XX|\[ORG\]/);
    if (at >= 0) {
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(at, at + (ta.value.startsWith("[ORG]", at) ? 5 : 2));
    }
  }
}

function syncPresetChips(): void {
  root?.querySelectorAll("[data-preset]").forEach((btn) => {
    const on = (btn as HTMLElement).dataset.preset === state.preset;
    btn.classList.toggle("on", on);
  });
}

function syncLogoOpts(): void {
  const opts = document.getElementById("wm-logo-opts");
  if (opts) opts.hidden = !state.logo;
  const clear = document.getElementById("wm-logo-clear");
  if (clear) clear.hidden = !state.logo;
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

async function blobForSource(
  source: { image: CanvasImageSource; width: number; height: number },
  redactions: Redaction[] = currentRedactions(),
): Promise<Blob> {
  const fit = fitExportSize(source.width, source.height);
  const canvas = renderWatermark(
    source.image,
    source.width,
    source.height,
    specFor(redactions),
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
  return blobForSource({ image: item.bitmap, width: item.width, height: item.height }, item.redactions);
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

type WmDraft = {
  config: {
    selected: number;
    text: string;
    font: FontId;
    customFont: string;
    size: number;
    color: string;
    opacity: number;
    rotate: number;
    stroke: boolean;
    tiled: boolean;
    gap: number;
    layout: WmLayout;
    collageGap: number;
    collageRadius: number;
    collageBg: string;
    collageFit: FitMode;
    collageAspect: AspectId;
    anchor: Anchor;
    logoScale: number;
    logoOpacity: number;
    logoRotate: number;
    format: Format;
    quality: number;
    preset: WmPreset | null;
    redactMode?: RedactMode;
    mosaicRatio?: number;
  };
  files: { name: string; type: string; blob: Blob; redactions?: Redaction[] }[];
  logo: { name: string; type: string; blob: Blob } | null;
};

async function persistWatermark(): Promise<void> {
  const selected = Math.max(0, state.items.findIndex((it) => it.id === state.selected));
  await saveDraft("watermark", {
    config: {
      selected,
      text: state.text,
      font: state.font,
      customFont: state.customFont,
      size: state.size,
      color: state.color,
      opacity: state.opacity,
      rotate: state.rotate,
      stroke: state.stroke,
      tiled: state.tiled,
      gap: state.gap,
      layout: state.layout,
      collageGap: state.collageGap,
      collageRadius: state.collageRadius,
      collageBg: state.collageBg,
      collageFit: state.collageFit,
      collageAspect: state.collageAspect,
      anchor: state.anchor,
      logoScale: state.logoScale,
      logoOpacity: state.logoOpacity,
      logoRotate: state.logoRotate,
      format: state.format,
      quality: state.quality,
      preset: state.preset,
      redactMode: state.redactMode,
      mosaicRatio: state.mosaicRatio,
    },
    files: state.items.map((it) => ({ name: it.file.name, type: it.file.type || "image/png", blob: it.file, redactions: it.redactions })),
    logo: state.logo
      ? { name: state.logo.file.name, type: state.logo.file.type || "image/png", blob: state.logo.file }
      : null,
  } satisfies WmDraft);
}

async function restoreWatermark(): Promise<void> {
  const draft = await loadDraft<WmDraft>("watermark");
  if (!draft?.config) return;
  const { selected, ...cfg } = draft.config;
  Object.assign(state, cfg);
  state.items = [];
  state.selected = null;
  state.logo = null;
  for (const rec of draft.files || []) {
    const file = new File([rec.blob], rec.name, { type: rec.type || "image/png" });
    await ingestFile(file);
    const item = state.items[state.items.length - 1];
    if (item && Array.isArray(rec.redactions)) item.redactions = rec.redactions;
  }
  // Drafts from before collage boxes were dropped may still carry them; ignore.
  delete (state as Record<string, unknown>).collageRedactions;
  if (state.items[selected]) state.selected = state.items[selected].id;
  if (draft.logo) {
    const file = new File([draft.logo.blob], draft.logo.name, { type: draft.logo.type || "image/png" });
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      state.logo = {
        bitmap,
        width: bitmap.width,
        height: bitmap.height,
        url: URL.createObjectURL(file),
        name: file.name,
        file,
      };
    } catch {
      state.logo = null;
    }
  }
}
