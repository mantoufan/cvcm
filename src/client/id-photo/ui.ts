/**
 * ID photo maker: crop a photo to a passport, visa or ID size with head guides, optionally swap the background with
 * the on-device background model (BiRefNet lite, the remove-background worker job), and download the photo or a
 * print sheet. Nothing is uploaded; the model downloads only when the background is replaced or Auto fit is pressed.
 */
import { blobFromBytes } from "../../shared/image-encode";
import { pdfFromJpegs } from "../../shared/pdf";
import { BACKGROUNDS, specById, specsFor, type IdPhotoSpec } from "../../shared/id-photo-specs";
import {
  DPI,
  defaultCrop,
  estimateHead,
  fitToBytes,
  guides,
  mmToPx,
  moveCrop,
  placeCrop,
  reshapeCrop,
  setJpegDpi,
  sheetLayout,
  specPixels,
  zoomCrop,
  type Rect,
  type SheetPaper,
} from "../../shared/id-photo";
import { AiClient } from "../ai/client";
import { deviceLabel, dropZone, formatSeconds, prewarm, runJob, statusPanel, type Status } from "../ai/kit";
import type { AiResponse } from "../ai/protocol";
import { canvasToBlob, decodeImage } from "../decode";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";

const S = "idPhoto";
/** Longest side kept in memory: a 300 DPI photo needs a few hundred pixels, the sheet reuses that photo. */
const WORK_MAX = 2400;
const PREVIEW_W = 480;
const PAPERS: readonly SheetPaper[] = ["4x6", "a4", "letter"];

type BgMode = "keep" | "replace";

const state = {
  spec: null as IdPhotoSpec | null,
  bgMode: "replace" as BgMode,
  /** The visitor picked keep / replace themselves: a new size no longer changes it. */
  bgChosen: false,
  color: "#ffffff",
  paper: "4x6" as SheetPaper,
  photo: null as HTMLCanvasElement | null,
  cut: null as HTMLCanvasElement | null,
  /** The mask's head estimate in photo pixels, once the model has run. */
  head: null as { top: number; chin: number; cx: number } | null,
  crop: null as Rect | null,
  busy: false,
  /** Bumped per photo, so a mask for an earlier photo is dropped. */
  gen: 0,
};

let client: AiClient | null = null;
let status: Status | null = null;
let alive = false;
let canvas: HTMLCanvasElement | null = null;
let frame: HTMLElement | null = null;
let guideTop: HTMLElement | null = null;
let guideChin: HTMLElement | null = null;
let hintEl: HTMLElement | null = null;
let infoEl: HTMLElement | null = null;
let headEl: HTMLElement | null = null;
let sourceEl: HTMLAnchorElement | null = null;
let warnEl: HTMLElement | null = null;
let zoomEl: HTMLInputElement | null = null;
let pxW: HTMLInputElement | null = null;
let pxH: HTMLInputElement | null = null;
let maxKb: HTMLInputElement | null = null;
let resultEl: HTMLElement | null = null;
let sheetEl: HTMLElement | null = null;
let modeChips: HTMLButtonElement[] = [];
let colorChips: HTMLButtonElement[] = [];
let colorInput: HTMLInputElement | null = null;
let drag: { id: number; x: number; y: number } | null = null;

export function mountIdPhoto(host: HTMLElement): void {
  alive = true;
  client = new AiClient();
  status = statusPanel("BiRefNet lite", "birefnet");
  const specs = specsFor(locale());
  state.spec = specs[0];
  state.color = state.spec.bg;
  state.bgMode = state.spec.noEdits ? "keep" : "replace";
  state.bgChosen = false;
  state.paper = locale() === "en" ? "4x6" : "a4";
  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t(`${S}.title`)),
      h("p", { class: "lede" }, t(`${S}.privacyNote`)),
    ),
    h("div", { class: "tool" }, leftRail(specs), stagePane(), controls()),
  );
  syncSpec();
  window.addEventListener("paste", onPaste);
}

/** One number per model job: a job that is no longer the latest (or outlived the page) changes nothing. */
let jobSeq = 0;
/** A request that arrived while a job ran: run once more for the current photo (true: also place the crop). */
let queued: boolean | null = null;

export function unmountIdPhoto(): void {
  alive = false;
  jobSeq++;
  queued = null;
  window.removeEventListener("paste", onPaste);
  client?.dispose();
  client = null;
  state.photo = null;
  state.cut = null;
  state.head = null;
  state.crop = null;
  state.busy = false;
  state.gen++;
  status = canvas = frame = guideTop = guideChin = hintEl = infoEl = headEl = warnEl = resultEl = sheetEl = null;
  sourceEl = null;
  zoomEl = pxW = pxH = maxKb = colorInput = null;
  modeChips = [];
  colorChips = [];
  drag = null;
}

function specLabel(spec: IdPhotoSpec): string {
  return t(`${S}.p_${spec.id}`);
}

function leftRail(specs: IdPhotoSpec[]): HTMLElement {
  const select = h("select", {
    "data-field": "size",
    onChange: (e: Event) => setSpec((e.target as HTMLSelectElement).value),
  },
    h("optgroup", { label: t(`${S}.official`) },
      ...specs.filter((s) => s.kind === "official").map((s) => h("option", { value: s.id, selected: s === state.spec }, specLabel(s)))),
    h("optgroup", { label: t(`${S}.common`) },
      ...specs.filter((s) => s.kind === "common").map((s) => h("option", { value: s.id, selected: s === state.spec }, specLabel(s)))),
  );
  infoEl = h("p", { class: "hint", "data-out": "size" });
  headEl = h("p", { class: "hint", "data-out": "head" });
  sourceEl = h("a", { href: "#", target: "_blank", rel: "noopener noreferrer", "data-out": "source" }, t(`${S}.sourceLink`));
  return h("aside", { class: "rail" },
    dropZone({
      id: "id-photo-file-input",
      accept: "image/png,image/jpeg,image/webp,image/avif,image/heic,image/heif,image/*",
      title: t(`${S}.dropTitle`),
      hint: t(`${S}.dropHint`),
      types: t(`${S}.dropTypes`),
      onFiles: (files) => void addFile(files[0]),
      onIntent: () => {
        if (client && status && state.bgMode === "replace") void prewarm(client, "birefnet", status);
      },
    }),
    h("label", { class: "field" }, h("span", null, t(`${S}.size`)), select),
    infoEl,
    headEl,
    h("p", { class: "hint" }, sourceEl),
  );
}

function stagePane(): HTMLElement {
  canvas = h("canvas", { class: "idp-canvas", width: PREVIEW_W, height: PREVIEW_W });
  guideTop = h("div", { class: "idp-guide idp-top", "aria-hidden": "true" });
  guideChin = h("div", { class: "idp-guide idp-chin", "aria-hidden": "true" });
  frame = h("div", {
    class: "idp-frame",
    tabindex: "0",
    role: "application",
    "aria-label": t(`${S}.frameLabel`),
    onPointerdown: onPointerDown,
    onPointermove: onPointerMove,
    onPointerup: onPointerUp,
    onPointercancel: onPointerUp,
    onKeydown: onKey,
    onWheel: onWheel,
  }, canvas, guideTop, guideChin, h("div", { class: "idp-guide idp-mid", "aria-hidden": "true" }));
  zoomEl = h("input", {
    type: "range", min: "-300", max: "500", step: "1", value: "0", "data-field": "zoom",
    "aria-label": t(`${S}.zoom`),
    onInput: () => setZoom(Number(zoomEl!.value)),
  });
  hintEl = h("p", { class: "hint", "data-out": "hint" }, t(`${S}.hint`));
  return h("section", { class: "stage" },
    h("div", { class: "idp-stage" }, frame),
    h("label", { class: "field" }, h("span", null, t(`${S}.zoom`)), zoomEl),
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn ghost", "data-action": "autofit", onClick: () => void autoFit() }, t(`${S}.autoFit`)),
      h("button", { type: "button", class: "btn ghost", "data-action": "reset", onClick: () => resetCrop() }, t(`${S}.reset`)),
    ),
    status!.el,
    hintEl,
    h("p", { class: "hint" }, t(`${S}.guideHint`)),
  );
}

function controls(): HTMLElement {
  modeChips = (["keep", "replace"] as const).map((m) => h("button", {
    type: "button", class: "chip", "data-mode": m,
    onClick: () => {
      state.bgMode = m;
      state.bgChosen = true;
      syncBg();
      if (m === "replace") void ensureMask();
      redraw();
    },
  }, t(`${S}.bg_${m}`)));
  colorChips = BACKGROUNDS.map((b) => h("button", {
    type: "button", class: "chip idp-swatch", "data-color": b.color,
    onClick: () => setColor(b.color),
  }, h("span", { class: "idp-dot", style: { background: b.color } }), t(`${S}.c_${b.id}`)));
  colorInput = h("input", {
    type: "color", value: state.color, "aria-label": t(`${S}.c_custom`),
    onInput: (e: Event) => setColor((e.target as HTMLInputElement).value),
  });
  warnEl = h("p", { class: "status idp-warn", "data-out": "warning", hidden: true }, t(`${S}.noEdits`));
  pxW = h("input", { type: "number", min: "50", max: "4000", step: "1", inputmode: "numeric", "data-field": "px-w", "aria-label": t(`${S}.width`) });
  pxH = h("input", { type: "number", min: "50", max: "4000", step: "1", inputmode: "numeric", "data-field": "px-h", "aria-label": t(`${S}.height`) });
  maxKb = h("input", { type: "number", min: "5", max: "10000", step: "1", inputmode: "numeric", "data-field": "max-kb", placeholder: t(`${S}.noLimit`) });
  resultEl = h("p", { class: "status", "aria-live": "polite", "data-out": "result" });
  sheetEl = h("p", { class: "hint", "data-out": "sheet" });
  const paper = h("select", {
    "data-field": "paper",
    onChange: (e: Event) => {
      state.paper = (e.target as HTMLSelectElement).value as SheetPaper;
      syncSheet();
    },
  }, ...PAPERS.map((p) => h("option", { value: p, selected: p === state.paper }, t(`${S}.paper_${p}`))));
  return h("aside", { class: "rail controls" },
    h("fieldset", null,
      h("legend", null, t(`${S}.background`)),
      h("div", { class: "convert-chips" }, ...modeChips),
      h("div", { class: "convert-chips idp-colors" }, ...colorChips),
      h("label", { class: "field" }, h("span", null, t(`${S}.c_custom`)), colorInput),
      warnEl,
      h("p", { class: "muted" }, t(`${S}.bgNote`)),
    ),
    h("fieldset", null,
      h("legend", null, t(`${S}.photoOut`)),
      h("div", { class: "idp-px" },
        h("label", { class: "field" }, h("span", null, t(`${S}.width`)), pxW),
        h("span", { "aria-hidden": "true" }, "×"),
        h("label", { class: "field" }, h("span", null, t(`${S}.height`)), pxH),
      ),
      h("label", { class: "field" }, h("span", null, t(`${S}.maxKb`)), maxKb),
      h("p", { class: "muted" }, t(`${S}.maxKbHint`)),
      h("button", { type: "button", class: "btn", "data-action": "download", onClick: () => void downloadPhoto() }, t(`${S}.download`)),
      resultEl,
    ),
    h("fieldset", null,
      h("legend", null, t(`${S}.sheet`)),
      h("label", { class: "field" }, h("span", null, t(`${S}.paper`)), paper),
      sheetEl,
      h("button", { type: "button", class: "btn ghost", "data-action": "sheet", onClick: () => void downloadSheet() }, t(`${S}.downloadSheet`)),
    ),
  );
}

function setSpec(id: string): void {
  const next = specById(id);
  const prev = state.spec;
  if (!next || !prev) return;
  state.spec = next;
  if (state.crop) state.crop = state.head ? placeCrop(next, state.head) : reshapeCrop(state.crop, prev, next);
  if (!state.bgChosen) {
    state.bgMode = next.noEdits ? "keep" : "replace";
    if (state.bgMode === "replace" && state.photo) void ensureMask();
  }
  if (state.color === prev.bg) state.color = next.bg;
  syncSpec();
}

function setColor(color: string): void {
  state.color = color;
  if (state.bgMode !== "replace") {
    state.bgMode = "replace";
    state.bgChosen = true;
    void ensureMask();
  }
  syncBg();
  redraw();
}

function syncSpec(): void {
  const spec = state.spec!;
  const px = specPixels(spec);
  if (frame) frame.style.aspectRatio = `${spec.w} / ${spec.h}`;
  if (canvas) {
    canvas.width = PREVIEW_W;
    canvas.height = Math.round((PREVIEW_W * spec.h) / spec.w);
  }
  const g = guides(spec);
  if (guideTop) guideTop.style.top = `${(g.top / spec.h) * 100}%`;
  if (guideChin) {
    guideChin.hidden = !g.chin;
    if (g.chin) {
      guideChin.style.top = `${(g.chin[0] / spec.h) * 100}%`;
      guideChin.style.height = `${((g.chin[1] - g.chin[0]) / spec.h) * 100}%`;
    }
  }
  if (infoEl) infoEl.textContent = t(`${S}.sizeInfo`, { w: spec.w, h: spec.h, pw: px.w, ph: px.h, dpi: DPI });
  if (headEl) headEl.textContent = spec.head ? t(`${S}.headRule`, { a: spec.head[0], b: spec.head[1] }) : t(spec.kind === "common" ? `${S}.commonNote` : `${S}.noHeadRule`);
  if (sourceEl) {
    sourceEl.hidden = !spec.source;
    if (spec.source) sourceEl.href = spec.source;
  }
  if (pxW) pxW.value = String(spec.px?.[0] ?? px.w);
  if (pxH) pxH.value = String(spec.px?.[1] ?? px.h);
  syncBg();
  syncSheet();
  syncZoom();
  redraw();
}

function syncBg(): void {
  for (const chip of modeChips) {
    const on = chip.dataset.mode === state.bgMode;
    chip.classList.toggle("on", on);
    chip.setAttribute("aria-pressed", String(on));
  }
  for (const chip of colorChips) {
    const on = state.bgMode === "replace" && chip.dataset.color === state.color;
    chip.classList.toggle("on", on);
    chip.setAttribute("aria-pressed", String(on));
  }
  if (colorInput) colorInput.value = state.color;
  if (warnEl) warnEl.hidden = !(state.spec?.noEdits && state.bgMode === "replace");
}

function syncSheet(): void {
  const spec = state.spec!;
  const layout = sheetLayout(state.paper, spec);
  if (sheetEl) sheetEl.textContent = t(`${S}.sheetCount`, { n: layout.cells.length, paper: t(`${S}.paper_${state.paper}`) });
}

function onPaste(e: ClipboardEvent): void {
  const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith("image/"));
  if (file) {
    e.preventDefault();
    void addFile(file);
  }
}

async function addFile(file: File | undefined): Promise<void> {
  if (!file) return;
  const gen = ++state.gen;
  try {
    const { bitmap, width, height } = await decodeImage(file);
    if (!alive || gen !== state.gen) {
      bitmap.close();
      return;
    }
    const scale = Math.min(1, WORK_MAX / Math.max(width, height));
    const photo = h("canvas", { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) });
    const ctx = photo.getContext("2d");
    ctx?.drawImage(bitmap, 0, 0, photo.width, photo.height);
    bitmap.close();
    state.photo = photo;
    state.cut = null;
    state.head = null;
    state.crop = defaultCrop(state.spec!, photo.width, photo.height);
    if (resultEl) resultEl.textContent = "";
    if (hintEl) hintEl.textContent = t(`${S}.photoSize`, { w: photo.width, h: photo.height });
    syncZoom();
    redraw();
    if (state.bgMode === "replace") await ensureMask(true);
  } catch {
    status?.error(t(`${S}.errorDecode`));
  }
}

/** Runs the background model on the current photo once; `place` moves the crop onto the head it finds. */
async function ensureMask(place = false): Promise<void> {
  const photo = state.photo;
  if (!photo || !client || !status) return;
  if (state.busy) {
    // A newer photo (or Replace pressed again) while the model runs: run again for it when this job ends.
    queued = place || Boolean(queued);
    return;
  }
  if (state.cut) {
    if (place && state.head) state.crop = placeCrop(state.spec!, state.head);
    syncZoom();
    redraw();
    return;
  }
  const gen = state.gen;
  const job = ++jobSeq;
  state.busy = true;
  try {
    const { result, backend, seconds } = await runJob<Extract<AiResponse, { type: "mask" }>>(client, status, async () => {
      const bitmap = await createImageBitmap(photo);
      return { body: { type: "remove-background", bitmap }, transfer: [bitmap] };
    });
    if (!alive || gen !== state.gen) return;
    const mask = maskCanvas(result.mask, result.width, result.height);
    state.cut = cutOut(photo, mask);
    const est = estimateHead(result.mask, result.width, result.height, (photo.width / result.width) / (photo.height / result.height));
    state.head = est && {
      top: (est.top * photo.height) / result.height,
      chin: (est.chin * photo.height) / result.height,
      cx: (est.cx * photo.width) / result.width,
    };
    if (state.head) state.crop = placeCrop(state.spec!, state.head);
    status.done(t("ai.doneIn", { s: formatSeconds(seconds), device: deviceLabel(backend) }));
    if (hintEl) hintEl.textContent = t(state.head ? `${S}.placed` : `${S}.notFound`);
    syncZoom();
    redraw();
  } catch (err) {
    // A failure for a photo that has since been replaced is not news to the visitor.
    if (!alive || job !== jobSeq || gen !== state.gen) return;
    status.error(t("ai.errorRun"));
    console.error(err);
  } finally {
    if (job === jobSeq) {
      state.busy = false;
      const again = queued;
      queued = null;
      if (alive && again !== null && state.photo && !state.cut) void ensureMask(again);
    }
  }
}

async function autoFit(): Promise<void> {
  if (!state.photo) {
    status?.error(t(`${S}.emptyDownload`));
    return;
  }
  if (state.head) {
    state.crop = placeCrop(state.spec!, state.head);
    syncZoom();
    redraw();
    return;
  }
  await ensureMask(true);
}

function resetCrop(): void {
  if (!state.photo) return;
  state.crop = state.head ? placeCrop(state.spec!, state.head) : defaultCrop(state.spec!, state.photo.width, state.photo.height);
  syncZoom();
  redraw();
}

function maskCanvas(mask: Uint8ClampedArray, width: number, height: number): HTMLCanvasElement {
  const c = h("canvas", { width, height });
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(width, height);
  for (let i = 0; i < mask.length; i++) img.data[i * 4 + 3] = mask[i];
  ctx.putImageData(img, 0, 0);
  return c;
}

function cutOut(photo: HTMLCanvasElement, mask: HTMLCanvasElement): HTMLCanvasElement {
  const cut = h("canvas", { width: photo.width, height: photo.height });
  const ctx = cut.getContext("2d")!;
  ctx.drawImage(photo, 0, 0);
  ctx.globalCompositeOperation = "destination-in";
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(mask, 0, 0, photo.width, photo.height);
  return cut;
}

/** Draws the crop into a `w × h` box: the new background and the cut-out, or the photo as it is. */
function paint(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, crop = state.crop): void {
  const replace = state.bgMode === "replace" && state.cut;
  ctx.fillStyle = replace ? state.color : "#ffffff";
  ctx.fillRect(x, y, w, h);
  if (!crop) return;
  const src = replace ? state.cut! : state.photo;
  if (!src) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.imageSmoothingQuality = "high";
  // Map the crop rectangle onto the box; parts of the crop outside the photo stay background.
  const sx = w / crop.w;
  const sy = h / crop.h;
  ctx.drawImage(src, x - crop.x * sx, y - crop.y * sy, src.width * sx, src.height * sy);
  ctx.restore();
}

function redraw(): void {
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return;
  if (!state.photo) {
    ctx.fillStyle = state.bgMode === "replace" ? state.color : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  paint(ctx, 0, 0, canvas.width, canvas.height);
}

/** The zoom slider is log2 of how much of the photo's height the crop covers, in hundredths. */
function syncZoom(): void {
  if (!zoomEl || !state.crop || !state.photo) return;
  zoomEl.value = String(Math.round(Math.log2(state.photo.height / state.crop.h) * 100));
}

function setZoom(v: number): void {
  if (!state.crop || !state.photo) return;
  const targetH = state.photo.height / 2 ** (v / 100);
  state.crop = zoomCrop(state.crop, state.crop.h / targetH, state.photo.width, state.photo.height);
  redraw();
}

function zoomBy(factor: number): void {
  if (!state.crop || !state.photo) return;
  state.crop = zoomCrop(state.crop, factor, state.photo.width, state.photo.height);
  syncZoom();
  redraw();
}

function nudge(fx: number, fy: number): void {
  if (!state.crop || !state.photo) return;
  state.crop = moveCrop(state.crop, state.crop.w * fx, state.crop.h * fy, state.photo.width, state.photo.height);
  redraw();
}

function onPointerDown(e: PointerEvent): void {
  if (!state.crop || !frame) return;
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  frame.setPointerCapture?.(e.pointerId);
  frame.classList.add("dragging");
}

function onPointerMove(e: PointerEvent): void {
  if (!drag || drag.id !== e.pointerId || !state.crop || !state.photo || !frame) return;
  const box = frame.getBoundingClientRect();
  if (!box.width) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  drag.x = e.clientX;
  drag.y = e.clientY;
  // Dragging the picture right moves the crop left over it.
  state.crop = moveCrop(state.crop, (-dx * state.crop.w) / box.width, (-dy * state.crop.h) / box.height, state.photo.width, state.photo.height);
  // Pointer events can outnumber frames; repaint the full-size photo once per frame.
  if (!frameQueued) {
    frameQueued = true;
    requestAnimationFrame(() => { frameQueued = false; redraw(); });
  }
}

let frameQueued = false;

function onPointerUp(e: PointerEvent): void {
  if (drag?.id !== e.pointerId) return;
  drag = null;
  frame?.classList.remove("dragging");
}

function onWheel(e: WheelEvent): void {
  if (!state.crop) return;
  e.preventDefault();
  zoomBy(e.deltaY < 0 ? 1.05 : 1 / 1.05);
}

function onKey(e: KeyboardEvent): void {
  const step = e.shiftKey ? 0.05 : 0.01;
  const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
  if (moves[e.key]) {
    e.preventDefault();
    nudge(...moves[e.key]);
  } else if (e.key === "+" || e.key === "=") {
    e.preventDefault();
    zoomBy(1.03);
  } else if (e.key === "-" || e.key === "_") {
    e.preventDefault();
    zoomBy(1 / 1.03);
  }
}

function readPx(el: HTMLInputElement | null, fallback: number): number {
  const v = Math.round(Number(el?.value));
  return Number.isFinite(v) && v >= 50 && v <= 4000 ? v : fallback;
}

/** The photo at `w × h` pixels. */
function render(w: number, hgt: number): HTMLCanvasElement {
  const out = h("canvas", { width: w, height: hgt });
  const ctx = out.getContext("2d")!;
  const crop = state.crop!;
  const aspect = w / hgt;
  const cropAspect = crop.w / crop.h;
  // Another shape than the preset keeps the head size: the crop widens or grows taller around the same centre.
  const fitted = Math.abs(aspect - cropAspect) <= 0.01 ? crop
    : aspect > cropAspect
      ? { ...crop, x: crop.x - (crop.h * aspect - crop.w) / 2, w: crop.h * aspect }
      : { ...crop, y: crop.y - (crop.w / aspect - crop.h) / 2, h: crop.w / aspect };
  paint(ctx, 0, 0, w, hgt, fitted);
  return out;
}

async function jpegBytes(c: HTMLCanvasElement, quality: number, dpi: number): Promise<Uint8Array> {
  const blob = await canvasToBlob(c, "image/jpeg", quality);
  return setJpegDpi(new Uint8Array(await blob.arrayBuffer()), dpi);
}

/**
 * In Replace mode the file must have the new background: wait for the cut-out (running the model if needed) rather
 * than quietly saving the original background while Replace is shown as selected.
 */
async function cutReady(): Promise<boolean> {
  if (state.bgMode !== "replace" || state.cut) return true;
  if (!state.busy) await ensureMask();
  while (alive && state.busy) await new Promise((r) => setTimeout(r, 150));
  if (alive && !state.cut) status?.error(t("ai.errorRun"));
  return alive && Boolean(state.cut);
}

async function downloadPhoto(): Promise<void> {
  const spec = state.spec!;
  if (!state.photo || !state.crop) {
    status?.error(t(`${S}.emptyDownload`));
    return;
  }
  if (!(await cutReady())) return;
  const base = specPixels(spec);
  const w = readPx(pxW, spec.px?.[0] ?? base.w);
  const hgt = readPx(pxH, spec.px?.[1] ?? base.h);
  const dpi = Math.round((w / spec.w) * 25.4);
  const limitKb = Number(maxKb?.value);
  let bytes: Uint8Array;
  let outW = w;
  let outH = hgt;
  if (Number.isFinite(limitKb) && limitKb > 0) {
    // Draw once per scale; the quality search re-encodes the same canvas.
    let drawn: { scale: number; canvas: HTMLCanvasElement } | null = null;
    const fit = await fitToBytes(async (q, scale) => {
      if (drawn?.scale !== scale) drawn = { scale, canvas: render(Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(hgt * scale))) };
      const c = drawn.canvas;
      const out = await jpegBytes(c, q, dpi * scale);
      return { out: { bytes: out, w: c.width, h: c.height }, bytes: out.byteLength };
    }, limitKb * 1024);
    if (!fit) {
      if (resultEl) resultEl.textContent = t(`${S}.tooBig`, { kb: limitKb });
      return;
    }
    bytes = fit.out.bytes;
    outW = fit.out.w;
    outH = fit.out.h;
  } else {
    bytes = await jpegBytes(render(w, hgt), 0.95, dpi);
  }
  if (!alive) return;
  const kb = Math.max(1, Math.round(bytes.byteLength / 1024));
  if (resultEl) {
    resultEl.textContent = outW === w ? t(`${S}.saved`, { w: outW, h: outH, kb }) : t(`${S}.savedSmaller`, { w: outW, h: outH, kb });
  }
  downloadBlob(blobFromBytes(bytes, "image/jpeg"), `id-photo-${spec.id}-${outW}x${outH}.jpg`);
}

async function downloadSheet(): Promise<void> {
  const spec = state.spec!;
  if (!state.photo || !state.crop) {
    status?.error(t(`${S}.emptyDownload`));
    return;
  }
  if (!(await cutReady())) return;
  const layout = sheetLayout(state.paper, spec);
  if (!layout.cells.length) return;
  const sheet = h("canvas", { width: mmToPx(layout.w), height: mmToPx(layout.h) });
  const ctx = sheet.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  const pw = mmToPx(spec.w);
  const ph = mmToPx(spec.h);
  const one = render(pw, ph);
  ctx.strokeStyle = "#b8b8b8";
  ctx.lineWidth = 1;
  for (const cell of layout.cells) {
    const x = Math.round((cell.x / 25.4) * DPI);
    const y = Math.round((cell.y / 25.4) * DPI);
    ctx.drawImage(one, x, y, pw, ph);
    // A hairline just outside each photo to cut along.
    ctx.strokeRect(x - 1.5, y - 1.5, pw + 3, ph + 3);
  }
  const jpeg = await jpegBytes(sheet, 0.95, DPI);
  if (!alive) return;
  if (state.paper === "4x6") {
    downloadBlob(blobFromBytes(jpeg, "image/jpeg"), `id-photo-${spec.id}-4x6.jpg`);
    return;
  }
  const pt = (mm: number) => (mm / 25.4) * 72;
  const pdf = pdfFromJpegs([{ jpeg, width: sheet.width, height: sheet.height, page: { w: pt(layout.w), h: pt(layout.h) } }]);
  downloadBlob(blobFromBytes(pdf, "application/pdf"), `id-photo-${spec.id}-${state.paper}.pdf`);
}

/** Test hook: the current crop and settings. */
export function idPhotoState(): Readonly<typeof state> {
  return state;
}
