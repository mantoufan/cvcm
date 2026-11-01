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
 * The photo is kept at most this size on its long side (a WebGL texture every GPU accepts). A 9:16 crop of a
 * 4K landscape still has the 1215 px it needs for a sharp 1080 × 1920 clip.
 */
const PHOTO_MAX = 4096;
/** Preview canvas long side, in CSS-independent pixels. */
const PREVIEW_MAX = 960;

const state = {
  file: null as File | null,
  photo: null as ImageBitmap | null,
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
let hintEl: HTMLElement | null = null;
let playBtn: HTMLButtonElement | null = null;
let downloadBtn: HTMLButtonElement | null = null;
let frame = 0;
let clock = 0;
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
  Object.assign(state, { file: null, photo: null, depth: null, running: false, again: false, depthFailed: false, exporting: false, queued: null, playing: true });
  status = null;
  preview = null;
  hintEl = null;
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
  hintEl = h("p", { class: "hint" }, t("v.hint"));
  playBtn = h("button", { type: "button", class: "btn ghost", onClick: togglePlay }, t("v.pause"));
  downloadBtn = h("button", { type: "button", class: "btn", onClick: () => void download() }, t("v.download"));
  return h("section", { class: "stage" },
    h("div", { class: "stage-frame" }, preview),
    status!.el,
    hintEl,
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
      chips(STRENGTH_IDS, () => state.strength, (s) => t(`v.strength_${s}`), (s) => (state.strength = s), redrawPaused),
    ),
    group(t("v.duration"),
      chips(DURATIONS, () => state.duration, (d) => t("v.seconds", { n: d }), (d) => (state.duration = d), () => {
        layout();
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
  if (!alive || !preview || !state.photo) return;
  try {
    renderer = new ParallaxRenderer(preview);
  } catch {
    renderer = null;
    status?.error(t("v.errorGl"));
    return;
  }
  renderer.setPhoto(state.photo);
  renderer.setDepth(state.depth);
  layout();
  restart();
}

async function setFile(file: File | undefined): Promise<void> {
  if (!file || !status) return;
  if (state.exporting) {
    state.queued = file;
    return;
  }
  const ticket = ++pick;
  let decoded;
  try {
    decoded = await decodeImage(file);
  } catch {
    status.error(t("v.errorDecode"));
    return;
  }
  // Unmounted or a newer file was picked while this one decoded. An export that started meanwhile gets it next.
  if (!alive || ticket !== pick || state.exporting) {
    decoded.bitmap.close();
    if (alive && ticket === pick) state.queued = file;
    return;
  }
  const scale = Math.min(1, PHOTO_MAX / Math.max(decoded.width, decoded.height));
  let photo = decoded.bitmap;
  if (scale < 1) {
    photo = await createImageBitmap(decoded.bitmap, {
      resizeWidth: Math.round(decoded.width * scale),
      resizeHeight: Math.round(decoded.height * scale),
      resizeQuality: "high",
    });
    decoded.bitmap.close();
  }
  if (!alive || ticket !== pick || state.exporting) {
    photo.close();
    if (alive && ticket === pick) state.queued = file;
    return;
  }
  try {
    renderer ??= new ParallaxRenderer(preview!);
  } catch {
    photo.close();
    status.error(t("v.errorGl"));
    return;
  }
  state.photo?.close();
  Object.assign(state, { file, photo, width: photo.width, height: photo.height, depth: null, depthFailed: false });
  renderer.setPhoto(photo);
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
  const mine = mountId;
  try {
    const { result, backend, seconds } = await runJob<Extract<AiResponse, { type: "mask" }>>(
      client,
      status,
      async () => {
        const bitmap = await createImageBitmap(source);
        return { body: { type: "depth", bitmap }, transfer: [bitmap] };
      },
    );
    if (!alive || state.photo !== source) return;
    state.depth = { data: prepareDepth(result.mask, result.width, result.height), width: result.width, height: result.height };
    renderer?.setDepth(state.depth);
    redrawPaused();
    status.done(t("v.ready", { s: formatSeconds(seconds), device: deviceLabel(backend) }));
  } catch (err) {
    if (!alive || state.photo !== source) return;
    console.error(err);
    state.depthFailed = true;
    status.error(t("ai.errorRun"));
  } finally {
    if (mine !== mountId) return;
    state.running = false;
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
  if (hintEl) hintEl.textContent = t("v.output", { w: out.width, h: out.height, s: state.duration });
  redrawPaused();
}

/** While paused the preview shows the first frame; redraw it after a setting or the depth changes. */
function redrawPaused(): void {
  if (!state.playing) drawAt(0);
}

function drawAt(t01: number): void {
  renderer?.draw(cameraAt(state.motion, STRENGTHS[state.strength], t01, state.loop));
}

function restart(): void {
  clock = performance.now();
  if (state.playing) loop();
  else drawAt(0);
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
  if (state.playing && state.photo) restart();
  else cancelAnimationFrame(frame);
}

async function download(): Promise<void> {
  if (!status || state.exporting) return;
  if (!state.photo || !state.file) {
    status.error(t("v.empty"));
    return;
  }
  if (!state.depth && !state.depthFailed) {
    status.error(t("v.waitDepth"));
    return;
  }
  if (!canEncode()) {
    status.error(t("v.errorEncode"));
    return;
  }
  const source = state.photo;
  const out = outputSize(state.width, state.height, state.aspect, state.size);
  const canvas = h("canvas", { width: out.width, height: out.height });
  let exporter: ParallaxRenderer;
  try {
    exporter = new ParallaxRenderer(canvas, { keepFrame: true });
  } catch {
    status.error(t("v.errorGl"));
    return;
  }
  exporter.setPhoto(source);
  exporter.setDepth(state.depth);
  exporter.setCrop(cropRect(state.width, state.height, state.aspect));
  const { motion, loop: looped } = state;
  const strength = STRENGTHS[state.strength];
  const frames = frameCount(state.duration);
  state.exporting = true;
  if (downloadBtn) downloadBtn.disabled = true;
  const started = performance.now();
  try {
    const blob = await encodeMp4({
      canvas,
      frames,
      fps: FPS,
      // The clip ends on the frame before the start, so a looped clip repeats without a stutter.
      draw: (i) => exporter.draw(cameraAt(motion, strength, looped ? i / frames : i / (frames - 1), looped)),
      onProgress: (f) => status?.working(t("v.exporting", { pct: Math.floor(f * 100) }), f),
      cancelled: () => !alive || state.photo !== source,
    });
    if (!alive) return;
    downloadBlob(blob, outputFilename(state.file.name, blob.type, `-${motion}`));
    status.done(t("v.exported", { s: formatSeconds((performance.now() - started) / 1000), w: out.width, h: out.height }));
  } catch (err) {
    if (!alive) return;
    if (err instanceof Error && err.message === "cancelled") {
      status.idle();
      return;
    }
    console.error(err);
    status.error(t("v.errorEncode"));
  } finally {
    exporter.dispose();
    state.exporting = false;
    if (downloadBtn) downloadBtn.disabled = false;
    if (alive && state.playing) restart();
    const next = state.queued;
    state.queued = null;
    if (alive && next) void setFile(next);
  }
}
