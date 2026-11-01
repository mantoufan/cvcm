import { outputFilename } from "../../shared/filename";
import {
  ASPECTS,
  DURATIONS,
  FPS,
  MOTIONS,
  SIZES,
  STRENGTHS,
  STRENGTH_IDS,
  cameraAt,
  cropRect,
  frameCount,
  outputSize,
  type Aspect,
  type Duration,
  type Motion,
  type Size,
  type Strength,
} from "../../shared/parallax";
import { appHref } from "../../shared/path";
import { AiClient } from "../ai/client";
import { chipRow, deviceLabel, dropZone, formatSeconds, prewarm, runJob, statusPanel, syncChips, type Status } from "../ai/kit";
import type { AiResponse } from "../ai/protocol";
import { decodeImage } from "../decode";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { canEncode, encodeMp4 } from "./encode";
import { ParallaxRenderer, prepareDepth } from "./render";

/**
 * The photo is kept at most this size on its long side (lower if the GPU's texture limit is lower). A 9:16 crop
 * of a 4K landscape still has the 1215 px it needs for a sharp 1080 × 1920 clip.
 */
const PHOTO_MAX = 4096;
/** The depth worker scales its input to this long side (bitmapToRaw in ai/worker.ts). */
const DEPTH_INPUT_MAX = 1536;
/** Preview canvas long side, in CSS-independent pixels. */
const PREVIEW_MAX = 960;
/** The preview's texture: twice the canvas is plenty, and it keeps a second full-size copy off the GPU. */
const PREVIEW_PHOTO_MAX = 2 * PREVIEW_MAX;

const state = {
  file: null as File | null,
  /** Full photo (premultiplied alpha), drawn by the export. */
  photo: null as ImageBitmap | null,
  /** Smaller copy drawn by the preview. */
  small: null as ImageBitmap | null,
  width: 0,
  height: 0,
  depth: null as { data: Uint8Array; width: number; height: number } | null,
  motion: "push" as Motion,
  strength: "normal" as Strength,
  duration: 5 as Duration,
  aspect: "original" as Aspect,
  size: 1080 as Size,
  loop: false,
  playing: true,
  running: false,
  again: false,
  /** Depth failed for this photo: export a zoom-only clip instead of waiting forever. */
  depthFailed: false,
  exporting: false,
  /** A photo dropped during an export, loaded when it ends. */
  queued: null as File | null,
};

let client: AiClient | null = null;
let status: Status | null = null;
let preview: HTMLCanvasElement | null = null;
let renderer: ParallaxRenderer | null = null;
let sizeEl: HTMLElement | null = null;
let playBtn: HTMLButtonElement | null = null;
let downloadBtn: HTMLButtonElement | null = null;
let frame = 0;
let clock = 0;
/** Where on the camera path (0–1) the preview last drew: a paused or mid-export preview redraws there. */
let shownT = 0;
let alive = false;
/** Bumped per picked file and on unmount, so a slow decode never replaces a newer file or lands in a later mount. */
let pick = 0;
/** Bumped per mount, so a depth run from an earlier mount leaves the current one's flags alone. */
let mountId = 0;

export async function mountV(host: HTMLElement): Promise<void> {
  alive = true;
  mountId++;
  client = new AiClient();
  status = statusPanel("Depth Anything V2", "depth");
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("v.back")),
      h("h1", null, t("v.title")),
      h("p", { class: "lede" }, t("v.privacyNote")),
    ),
    h("div", { class: "tool" },
      filesRail(),
      stagePane(),
      controls(),
    ),
  );
  window.addEventListener("paste", onPaste);
}

export function unmountV(): void {
  alive = false;
  pick++;
  window.removeEventListener("paste", onPaste);
  cancelAnimationFrame(frame);
  client?.dispose();
  client = null;
  renderer?.dispose();
  renderer = null;
  state.photo?.close();
  state.small?.close();
  Object.assign(state, { file: null, photo: null, small: null, depth: null, running: false, again: false, depthFailed: false, exporting: false, queued: null, playing: true });
  status = null;
  preview = null;
  sizeEl = null;
  playBtn = null;
  downloadBtn = null;
}

function filesRail(): HTMLElement {
  return h("aside", { class: "rail" },
    h("div", { class: "rail-h" }, h("h2", null, t("v.filesTitle"))),
    dropZone({
      id: "v-file-input",
      accept: "image/png,image/jpeg,image/webp,image/avif,image/heic,image/heif,image/*",
      title: t("v.dropTitle"),
      hint: t("v.dropHint"),
      types: t("v.dropTypes"),
      onFiles: (files) => void setFile(files[0]),
      onIntent: () => {
        if (client && status) void prewarm(client, "depth", status);
      },
    }),
  );
}

function stagePane(): HTMLElement {
  preview = h("canvas", { class: "preview", width: 800, height: 560 });
  // Phones drop GPU contexts under memory pressure or in the background: rebuild the preview when it comes back.
  preview.addEventListener("webglcontextlost", (e) => e.preventDefault());
  preview.addEventListener("webglcontextrestored", rebuildPreview);
  sizeEl = h("p", { class: "hint" });
  playBtn = h("button", { type: "button", class: "btn ghost", onClick: togglePlay }, t("v.pause"));
  downloadBtn = h("button", { type: "button", class: "btn", onClick: () => void download() }, t("v.download"));
  return h("section", { class: "stage" },
    h("div", { class: "stage-frame" }, preview),
    status!.el,
    h("p", { class: "hint" }, t("v.hint")),
    sizeEl,
    h("div", { class: "stage-actions" }, playBtn, downloadBtn),
  );
}

/** A chip row wired to one setting: highlight follows the click, then `after` runs. */
function chips<T extends string | number>(values: readonly T[], current: () => T, label: (v: T) => string, set: (v: T) => void, after: () => void): HTMLElement {
  const els: HTMLButtonElement[] = chipRow(values, current, label, (v) => {
    set(v);
    syncChips(els, String(v));
    after();
  });
  return h("div", { class: "convert-chips" }, ...els);
}

function controls(): HTMLElement {
  const group = (legend: string, ...body: (HTMLElement | null)[]): HTMLElement =>
    h("fieldset", null, h("legend", null, legend), ...body);
  return h("aside", { class: "rail controls" },
    group(t("v.motion"),
      chips(MOTIONS, () => state.motion, (m) => t(`v.motion_${m}`), (m) => (state.motion = m), restart),
    ),
    group(t("v.strength"),
      chips(STRENGTH_IDS, () => state.strength, (s) => t(`v.strength_${s}`), (s) => (state.strength = s), redrawStill),
    ),
    group(t("v.duration"),
      chips(DURATIONS, () => state.duration, (d) => t("v.seconds", { n: d }), (d) => (state.duration = d), () => {
        updateHint();
        restart();
      }),
    ),
    group(t("v.aspect"),
      chips(ASPECTS, () => state.aspect, (a) => (a === "original" ? t("v.aspect_original") : a), (a) => (state.aspect = a), layout),
    ),
    group(t("v.size"),
      chips(SIZES, () => state.size, (s) => `${s}p`, (s) => (state.size = s), layout),
      h("label", { class: "check" },
        h("input", {
          type: "checkbox",
          checked: state.loop,
          onChange: (e: Event) => {
            state.loop = (e.target as HTMLInputElement).checked;
            restart();
          },
        }),
        t("v.loop"),
      ),
      h("p", { class: "muted" }, t("v.note")),
    ),
  );
}

function onPaste(e: ClipboardEvent): void {
  const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith("image/"));
  if (file) {
    e.preventDefault();
    void setFile(file);
  }
}

function rebuildPreview(): void {
  if (!alive || !preview) return;
  renderer = null;
  if (state.photo) {
    try {
      renderer = new ParallaxRenderer(preview);
    } catch {
      status?.error(t("v.errorGl"));
      return;
    }
    renderer.setPhoto(state.small ?? state.photo);
    renderer.setDepth(state.depth);
    layout();
    restart();
    status?.idle();
  }
  // A photo picked while the context was gone loads now.
  const next = state.queued;
  if (next && !state.exporting) {
    state.queued = null;
    void setFile(next);
  }
}

/**
 * A copy at most `max` px on its long side, with premultiplied alpha set explicitly: the shader composites
 * transparent areas over white as premultiplied color, and filtering premultiplied texels leaves no dark fringe.
 */
function fitted(source: ImageBitmap, max: number): Promise<ImageBitmap> {
  const scale = Math.min(1, max / Math.max(source.width, source.height));
  return createImageBitmap(source, {
    resizeWidth: Math.max(1, Math.floor(source.width * scale)),
    resizeHeight: Math.max(1, Math.floor(source.height * scale)),
    resizeQuality: "high",
    premultiplyAlpha: "premultiply",
  });
}

async function setFile(file: File | undefined): Promise<void> {
  if (!file || !status) return;
  // A newer pick also makes any decode still in flight stale.
  const ticket = ++pick;
  // Mid-export, or the GPU context is gone until the browser restores it: load this photo after that.
  if (state.exporting || renderer?.lost()) {
    state.queued = file;
    if (!state.exporting) status.working(t("v.gpuLost"));
    return;
  }
  let decoded;
  try {
    decoded = await decodeImage(file);
  } catch {
    if (alive && ticket === pick) status.error(t("v.errorDecode"));
    return;
  }
  // Unmounted or a newer file was picked while this one decoded. An export that started meanwhile gets it next.
  if (!alive || ticket !== pick || state.exporting) {
    decoded.bitmap.close();
    if (alive && ticket === pick) state.queued = file;
    return;
  }
  try {
    if (!renderer || renderer.lost()) renderer = new ParallaxRenderer(preview!);
  } catch {
    renderer = null;
    decoded.bitmap.close();
    status.error(t("v.errorGl"));
    return;
  }
  let photo: ImageBitmap;
  let small: ImageBitmap;
  try {
    photo = await fitted(decoded.bitmap, Math.min(PHOTO_MAX, renderer.maxTexture));
    small = await fitted(photo, PREVIEW_PHOTO_MAX);
  } catch {
    if (alive && ticket === pick) status.error(t("v.errorDecode"));
    return;
  } finally {
    decoded.bitmap.close();
  }
  if (!alive || ticket !== pick || state.exporting || !renderer) {
    photo.close();
    small.close();
    if (alive && ticket === pick && state.exporting) state.queued = file;
    return;
  }
  state.photo?.close();
  state.small?.close();
  Object.assign(state, { file, photo, small, width: photo.width, height: photo.height, depth: null, depthFailed: false });
  renderer.setPhoto(small);
  renderer.setDepth(null);
  layout();
  restart();
  void run();
}

async function run(): Promise<void> {
  const source = state.photo;
  if (!source || !client || !status) return;
  if (state.running) {
    state.again = true;
    return;
  }
  state.running = true;
  syncDownload();
  const mine = mountId;
  try {
    const { result, backend, seconds } = await runJob<Extract<AiResponse, { type: "mask" }>>(
      client,
      status,
      async () => {
        // The worker reads at most 1536 px; send that, not a full 4096 px copy.
        const fit = Math.min(1, DEPTH_INPUT_MAX / Math.max(source.width, source.height));
        const bitmap = await createImageBitmap(source, {
          resizeWidth: Math.max(1, Math.round(source.width * fit)),
          resizeHeight: Math.max(1, Math.round(source.height * fit)),
          resizeQuality: "high",
        });
        return { body: { type: "depth", bitmap }, transfer: [bitmap] };
      },
    );
    if (!alive || state.photo !== source) return;
    state.depth = { data: prepareDepth(result.mask, result.width, result.height), width: result.width, height: result.height };
    renderer?.setDepth(state.depth);
    redrawStill();
    status.done(t("v.ready", { s: formatSeconds(seconds), device: deviceLabel(backend) }));
  } catch (err) {
    if (!alive || state.photo !== source) return;
    console.error(err);
    state.depthFailed = true;
    status.error(t("v.depthFailed"));
  } finally {
    if (mine !== mountId) return;
    state.running = false;
    syncDownload();
    if (state.again && alive) {
      state.again = false;
      void run();
    }
  }
}

/** Size the preview to the output's shape and point the renderer at the crop. */
function layout(): void {
  if (!preview || !renderer || !state.photo) return;
  const out = outputSize(state.width, state.height, state.aspect, state.size);
  const scale = Math.min(1, PREVIEW_MAX / Math.max(out.width, out.height));
  preview.width = Math.round(out.width * scale);
  preview.height = Math.round(out.height * scale);
  renderer.setCrop(cropRect(state.width, state.height, state.aspect));
  updateHint();
  // Resizing cleared the canvas; the animation loop repaints on its own, a still preview does not.
  redrawStill();
}

function updateHint(): void {
  if (!sizeEl || !state.photo) return;
  const out = outputSize(state.width, state.height, state.aspect, state.size);
  sizeEl.textContent = t("v.output", { w: out.width, h: out.height, s: state.duration, fps: FPS });
}

/** A paused preview, or one frozen during an export, stays on its frame; redraw it after a setting or the depth changes. */
function redrawStill(): void {
  if (!state.playing || state.exporting) drawAt(shownT);
}

function drawAt(t01: number): void {
  shownT = t01;
  renderer?.draw(cameraAt(state.motion, STRENGTHS[state.strength], t01, state.loop));
}

/** Back to the start of the path (a new photo, move, length or loop setting). */
function restart(): void {
  shownT = 0;
  play();
}

/** Run the animation from `shownT`, or just draw it when paused. */
function play(): void {
  clock = performance.now() - shownT * state.duration * 1000;
  if (state.playing && !state.exporting) loop();
  else drawAt(shownT);
}

function loop(): void {
  cancelAnimationFrame(frame);
  const tick = (now: number): void => {
    if (!alive || !state.playing || state.exporting) return;
    const period = state.duration * 1000;
    drawAt(((now - clock) % period) / period);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}

function togglePlay(): void {
  state.playing = !state.playing;
  if (playBtn) playBtn.textContent = state.playing ? t("v.pause") : t("v.play");
  if (state.playing && state.photo) play();
  else cancelAnimationFrame(frame);
}

/** Download waits for the depth run and for the export in progress. */
function syncDownload(): void {
  if (downloadBtn) downloadBtn.disabled = state.running || state.exporting;
}

async function download(): Promise<void> {
  if (!status || state.exporting) return;
  if (!state.photo || !state.file) {
    status.error(t("v.empty"));
    return;
  }
  if (!state.depth && !state.depthFailed) {
    // The button is disabled while depth runs; this covers a click that raced it.
    if (!state.running) status.error(t("v.waitDepth"));
    return;
  }
  if (!canEncode()) {
    status.error(t("v.errorEncode"));
    return;
  }
  const source = state.photo;
  const file = state.file;
  const panel = status;
  const mine = mountId;
  const out = outputSize(state.width, state.height, state.aspect, state.size);
  const canvas = h("canvas", { width: out.width, height: out.height });
  // A lost GPU context draws nothing: fail the export rather than encode blank frames.
  let lost = false;
  canvas.addEventListener("webglcontextlost", () => (lost = true));
  let exporter: ParallaxRenderer;
  try {
    exporter = new ParallaxRenderer(canvas, { keepFrame: true });
  } catch {
    panel.error(t("v.errorGl"));
    return;
  }
  exporter.setPhoto(source);
  exporter.setDepth(state.depth);
  exporter.setCrop(cropRect(state.width, state.height, state.aspect));
  const { motion, loop: looped } = state;
  const strength = STRENGTHS[state.strength];
  const frames = frameCount(state.duration);
  state.exporting = true;
  // Busy keeps a background model warm-up (hovering the drop zone) from clearing the export's progress line.
  panel.busy = true;
  syncDownload();
  const started = performance.now();
  try {
    const blob = await encodeMp4({
      canvas,
      frames,
      fps: FPS,
      // The clip ends on the frame before the start, so a looped clip repeats without a stutter.
      draw: (i) => {
        if (lost || exporter.lost()) throw new Error("webgl context lost");
        exporter.draw(cameraAt(motion, strength, looped ? i / frames : i / (frames - 1), looped));
      },
      onProgress: (f) => panel.working(t("v.exporting", { pct: Math.floor(f * 100) }), f),
      cancelled: () => !alive || mine !== mountId || state.photo !== source,
    });
    if (!alive || mine !== mountId) return;
    downloadBlob(blob, outputFilename(file.name, blob.type, `-${motion}`));
    panel.done(t("v.exported", { s: formatSeconds((performance.now() - started) / 1000), w: out.width, h: out.height }));
  } catch (err) {
    if (!alive || mine !== mountId) return;
    if (err instanceof Error && err.message === "cancelled") {
      panel.idle();
      return;
    }
    console.error(err);
    panel.error(t("v.errorEncode"));
  } finally {
    exporter.dispose();
    panel.busy = false;
    // An export from an earlier mount must not touch this mount's flags, button or queue.
    if (mine !== mountId) return;
    state.exporting = false;
    syncDownload();
    if (alive) play();
    const next = state.queued;
    state.queued = null;
    if (alive && next) void setFile(next);
  }
}
