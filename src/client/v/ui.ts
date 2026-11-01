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
import { DEPTH_INPUT_MAX } from "../../shared/ai-models";
import { appHref } from "../../shared/path";
import { AiClient } from "../ai/client";
import { chipGroup, deviceLabel, dropZone, formatSeconds, prewarm, runJob, statusPanel, type Status } from "../ai/kit";
import type { AiResponse } from "../ai/protocol";
import { decodeImage } from "../decode";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { ParallaxRenderer, prepareDepth } from "./render";

/**
 * The photo is kept at most this size on its long side (lower if the GPU's texture limit is lower). A 9:16 crop
 * of a 4K landscape still has the 1215 px it needs for a sharp 1080 × 1920 clip.
 */
const PHOTO_MAX = 4096;
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
  preview = previewCanvas();
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

function controls(): HTMLElement {
  const group = (legend: string, ...body: (HTMLElement | null)[]): HTMLElement =>
    h("fieldset", null, h("legend", null, legend), ...body);
  return h("aside", { class: "rail controls" },
    group(t("v.motion"),
      chipGroup(MOTIONS, () => state.motion, (m) => t(`v.motion_${m}`), (m) => (state.motion = m), restart),
    ),
    group(t("v.strength"),
      chipGroup(STRENGTH_IDS, () => state.strength, (s) => t(`v.strength_${s}`), (s) => (state.strength = s), redrawStill),
    ),
    group(t("v.duration"),
      chipGroup(DURATIONS, () => state.duration, (d) => t("v.seconds", { n: d }), (d) => (state.duration = d), () => {
        updateHint();
        restart();
      }),
    ),
    group(t("v.aspect"),
      chipGroup(ASPECTS, () => state.aspect, (a) => (a === "original" ? t("v.aspect_original") : a), (a) => (state.aspect = a), layout),
    ),
    group(t("v.size"),
      chipGroup(SIZES, () => state.size, (s) => `${s}p`, (s) => (state.size = s), layout),
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

/** Phones drop GPU contexts under memory pressure or in the background: the preview rebuilds when it comes back. */
function previewCanvas(): HTMLCanvasElement {
  const canvas = h("canvas", { class: "preview", width: 800, height: 560 });
  canvas.addEventListener("webglcontextlost", (e) => e.preventDefault());
  canvas.addEventListener("webglcontextrestored", () => {
    // A photo picked meanwhile may already have rebuilt it on this context.
    if (canvas === preview && (!renderer || renderer.lost())) rebuildPreview();
  });
  return canvas;
}

/**
 * A renderer that can draw now. A renderer from before a context loss is never reused (its GL objects are gone);
 * if the canvas has no usable context (lost and not restored, maybe never), a new canvas gets a new one.
 */
function liveRenderer(): ParallaxRenderer {
  if (renderer && !renderer.lost()) return renderer;
  renderer = null;
  try {
    renderer = new ParallaxRenderer(preview!);
  } catch {
    const fresh = previewCanvas();
    preview!.replaceWith(fresh);
    preview = fresh;
    renderer = new ParallaxRenderer(fresh);
  }
  return renderer;
}

/** `resume`: restart the animation afterwards (not when called from inside a frame, which keeps its own loop). */
function rebuildPreview(resume = true): void {
  if (!alive || !state.small) return;
  renderer = null;
  try {
    liveRenderer();
  } catch {
    status?.error(t("v.errorGl"));
    return;
  }
  renderer!.setPhoto(state.small);
  renderer!.setDepth(state.depth);
  layout();
  if (resume) play();
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
  if (state.exporting) {
    state.queued = file;
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
  let gl: ParallaxRenderer;
  try {
    gl = liveRenderer();
  } catch {
    renderer = null;
    decoded.bitmap.close();
    status.error(t("v.errorGl"));
    return;
  }
  let photo: ImageBitmap | null = null;
  let small: ImageBitmap;
  try {
    photo = await fitted(decoded.bitmap, Math.min(PHOTO_MAX, gl.maxTexture));
    small = await fitted(photo, PREVIEW_PHOTO_MAX);
  } catch {
    photo?.close();
    if (alive && ticket === pick) status.error(t("v.errorDecode"));
    return;
  } finally {
    decoded.bitmap.close();
  }
  if (!alive || ticket !== pick || state.exporting) {
    photo.close();
    small.close();
    if (alive && ticket === pick && state.exporting) state.queued = file;
    return;
  }
  // The context may have been lost or restored while this photo decoded.
  try {
    gl = liveRenderer();
  } catch {
    photo.close();
    small.close();
    status.error(t("v.errorGl"));
    return;
  }
  // Depth for the previous photo is now wasted work: stop it, so this photo's run starts right away
  // (the stopped run sees a different photo and stays quiet; its finally starts the new run).
  if (state.running && client) {
    state.again = true;
    client.dispose();
  }
  state.photo?.close();
  state.small?.close();
  Object.assign(state, { file, photo, small, width: photo.width, height: photo.height, depth: null, depthFailed: false });
  gl.setPhoto(small);
  gl.setDepth(null);
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
        // The worker reads at most DEPTH_INPUT_MAX px; send that, not a full 4096 px copy.
        const bitmap = await fitted(source, DEPTH_INPUT_MAX);
        // A newer photo arrived while this copy was made: do not start a job nobody will see.
        if (state.photo !== source) {
          bitmap.close();
          throw new Error("cancelled");
        }
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
  // The context went away and no restore event came (iOS after backgrounding): rebuild on a new canvas.
  if (renderer?.lost()) {
    rebuildPreview(false);
    if (!renderer || renderer.lost()) return;
  }
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
  if (!state.photo) return;
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
  // Everything the clip needs, read now: settings may change while it renders.
  const source = state.photo;
  const file = state.file;
  const depth = state.depth;
  const panel = status;
  const mine = mountId;
  const out = outputSize(state.width, state.height, state.aspect, state.size);
  const crop = cropRect(state.width, state.height, state.aspect);
  // Enough photo for the output at the deepest zoom (about 1.3×) and no more: a 720p clip of a 4096 px photo
  // uploads a texture a fraction of the size.
  const need = Math.ceil(Math.max(state.width, state.height) * 1.5 * Math.max(out.width / (state.width * crop.w), out.height / (state.height * crop.h)));
  const { motion, loop: looped } = state;
  const strength = STRENGTHS[state.strength];
  const frames = frameCount(state.duration);
  state.exporting = true;
  // Busy keeps a background model warm-up (hovering the drop zone) from clearing the export's progress line.
  panel.busy = true;
  syncDownload();
  const canvas = h("canvas", { width: out.width, height: out.height });
  // A lost GPU context draws nothing: fail the export rather than encode blank frames.
  let lost = false;
  canvas.addEventListener("webglcontextlost", () => (lost = true));
  let exporter: ParallaxRenderer | null = null;
  const started = performance.now();
  try {
    // Loaded on first export: most visits only preview.
    const { canEncode, encodeMp4 } = await import("./encode");
    if (!canEncode()) throw new Error("codec");
    const texture = await fitted(source, need);
    try {
      exporter = new ParallaxRenderer(canvas, { keepFrame: true });
      exporter.setPhoto(texture);
    } finally {
      texture.close();
    }
    exporter.setDepth(depth);
    exporter.setCrop(crop);
    const gl = exporter;
    const blob = await encodeMp4({
      canvas,
      frames,
      fps: FPS,
      // The clip ends on the frame before the start, so a looped clip repeats without a stutter.
      draw: (i) => {
        if (lost || gl.lost()) throw new Error("webgl context lost");
        gl.draw(cameraAt(motion, strength, looped ? i / frames : i / (frames - 1), looped));
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
    const message = err instanceof Error ? err.message : "";
    // "webgl2": no WebGL 2 context to give; "webgl context lost": the GPU dropped it mid-export (try again).
    panel.error(t(message === "webgl2" ? "v.errorGl" : message === "webgl context lost" ? "v.errorGpuReset" : "v.errorEncode"));
  } finally {
    exporter?.dispose();
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
