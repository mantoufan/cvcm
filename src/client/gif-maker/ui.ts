import { GifWriter } from "../../shared/gif";
import { outputFilename } from "../../shared/filename";
import { fitFrame, frameCount, frameTimes, gifSize, MAX_FRAMES, type Fit } from "../../shared/gif-frames";
import { decodeImage } from "../decode";
import { downloadBlob, h } from "../dom";
import { formatBytes } from "../../shared/resize";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";

/** A picture frame: its original size (for the GIF's shape), and a bitmap no bigger than the GIF can use. */
type Still = { id: string; file: File; bitmap: ImageBitmap; width: number; height: number };
type Clip = { file: File; url: string; video: HTMLVideoElement; duration: number; width: number; height: number };
type LoopId = "forever" | "once" | "three";

const WIDTHS = [240, 320, 480, 640, 800] as const;
const COLORS = [256, 128, 64, 32] as const;
/** Loop block value per choice: null = no block (plays once), 0 = forever, 2 = two more times after the first. */
const LOOPS: Record<LoopId, number | null> = { forever: 0, once: null, three: 2 };

const state = {
  mode: "images" as "images" | "video",
  stills: [] as Still[],
  clip: null as Clip | null,
  delayMs: 500,
  fps: 10,
  start: 0,
  end: 3,
  width: 480 as (typeof WIDTHS)[number],
  fit: "contain" as Fit,
  background: "#ffffff",
  loop: "forever" as LoopId,
  colors: 256 as (typeof COLORS)[number],
  dither: true,
  result: null as { blob: Blob; url: string; frames: number; width: number; height: number } | null,
  /** Bumped by every change and by unmount, so a running encode stops and its result is dropped. */
  run: 0,
  /** Bumped when new files start loading or the list is cleared, so a slower earlier load drops its result. */
  load: 0,
  busy: false,
};

let els: {
  list: HTMLOListElement;
  preview: HTMLCanvasElement;
  videoBox: HTMLElement;
  status: HTMLElement;
  result: HTMLElement;
  imageOpts: HTMLElement;
  videoOpts: HTMLElement;
  start: HTMLInputElement;
  end: HTMLInputElement;
  make: HTMLButtonElement;
} | null = null;
let timer = 0;

export function mountGifMaker(host: HTMLElement): void {
  const input = h("input", {
    type: "file",
    accept: "image/*,video/*,.gif,.mp4,.webm,.mov",
    multiple: true,
    class: "sr-only",
    id: "gif-file-input",
    "data-field": "file",
    onChange: (e: Event) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) void addFiles([...files]);
      (e.target as HTMLInputElement).value = "";
    },
  });
  const drop = h("label", {
    class: "drop",
    for: "gif-file-input",
    onDragover: (e: DragEvent) => {
      e.preventDefault();
      drop.classList.add("over");
    },
    onDragleave: () => drop.classList.remove("over"),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      drop.classList.remove("over");
      if (e.dataTransfer?.files) void addFiles([...e.dataTransfer.files]);
    },
  },
    input,
    h("strong", null, t("gifMaker.dropTitle")),
    h("span", null, t("gifMaker.dropHint")),
    h("em", null, t("gifMaker.dropTypes")),
  );
  const list = h("ol", { class: "file-list gif-frames", "data-out": "frames" });
  const preview = h("canvas", { class: "preview", width: 480, height: 320, "data-out": "preview" });
  const videoBox = h("div", { class: "gif-video", hidden: true });
  const status = h("p", { class: "status", "aria-live": "polite", "data-out": "status" });
  const result = h("div", { class: "gif-result", "data-out": "result" });
  const make = h("button", { type: "button", class: "btn", "data-action": "make", onClick: () => void makeGif() }, t("gifMaker.make"));
  const num = (field: string, value: number, min: number, max: number, step: number, set: (n: number) => void, get: () => number) => {
    const el = h("input", {
      type: "number",
      min: String(min),
      max: String(max),
      step: String(step),
      value: String(value),
      inputmode: "decimal",
      "data-field": field,
      onInput: () => {
        const n = Number(el.value);
        // A half-typed box keeps the last good value.
        if (el.value.trim() === "" || !Number.isFinite(n)) return;
        set(Math.min(max, Math.max(min, n)));
        changed();
      },
      // Leaving the box shows the value in use: clamped, or the last good one for a blank or broken entry.
      onChange: () => { el.value = String(get()); },
    });
    return el;
  };
  const select = <T extends string | number>(field: string, options: Array<[T, string]>, value: T, set: (v: T) => void) => {
    const el: HTMLSelectElement = h("select", {
      "data-field": field,
      onChange: () => {
        const picked = options.find(([v]) => String(v) === el.value);
        if (picked) set(picked[0]);
        changed();
      },
    }, ...options.map(([v, label]) => h("option", { value: String(v), selected: v === value }, label)));
    return el;
  };
  const start = num("start", state.start, 0, 36000, 0.1, (n) => { state.start = n; }, () => state.start);
  const end = num("end", state.end, 0, 36000, 0.1, (n) => { state.end = n; }, () => state.end);
  const imageOpts = h("div", null,
    labeled(t("gifMaker.delay"), num("delay", state.delayMs, 20, 10000, 10, (n) => { state.delayMs = n; }, () => state.delayMs)),
    labeled(t("gifMaker.fit"), select<Fit>("fit", [["contain", t("gifMaker.fitContain")], ["cover", t("gifMaker.fitCover")]], state.fit, (v) => { state.fit = v; })),
  );
  const videoOpts = h("div", { hidden: true },
    labeled(t("gifMaker.start"), start),
    labeled(t("gifMaker.end"), end),
    labeled(t("gifMaker.fps"), num("fps", state.fps, 1, 25, 1, (n) => { state.fps = Math.round(n); }, () => state.fps)),
  );
  const dither = h("input", { type: "checkbox", checked: state.dither, "data-field": "dither", onChange: () => { state.dither = dither.checked; changed(); } });
  const background = h("input", { type: "color", value: state.background, "data-field": "background", onInput: () => { state.background = background.value; changed(); } });
  els = { list, preview, videoBox, status, result, imageOpts, videoOpts, start, end, make };
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("gifMaker.back")),
      h("h1", null, t("gifMaker.title")),
      h("p", { class: "lede" }, t("gifMaker.privacyNote")),
    ),
    h("div", { class: "tool" },
      h("aside", { class: "rail" },
        h("div", { class: "rail-h" },
          h("h2", null, t("gifMaker.filesTitle")),
          h("button", { type: "button", class: "link", "data-action": "clear", onClick: () => clearAll() }, t("gifMaker.clear")),
        ),
        drop,
        list,
      ),
      h("section", { class: "stage" },
        h("div", { class: "stage-frame" }, preview, videoBox),
        h("p", { class: "hint" }, t("gifMaker.hint")),
        h("div", { class: "stage-actions" }, make),
        status,
        result,
      ),
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("gifMaker.options")),
          imageOpts,
          videoOpts,
          labeled(t("gifMaker.width"), select("width", WIDTHS.map((w) => [w, `${w} px`] as [number, string]), state.width as number, (v) => { state.width = v as (typeof WIDTHS)[number]; })),
          labeled(t("gifMaker.loop"), select<LoopId>("loop", [["forever", t("gifMaker.loopForever")], ["once", t("gifMaker.loopOnce")], ["three", t("gifMaker.loopThree")]], state.loop, (v) => { state.loop = v; })),
          labeled(t("gifMaker.colors"), select("colors", COLORS.map((c) => [c, String(c)] as [number, string]), state.colors as number, (v) => { state.colors = v as (typeof COLORS)[number]; })),
          h("label", { class: "check" }, dither, h("span", null, t("gifMaker.dither"))),
          labeled(t("gifMaker.background"), background),
        ),
      ),
    ),
  );
  window.addEventListener("paste", onPaste);
  refresh();
}

export function unmountGifMaker(): void {
  window.removeEventListener("paste", onPaste);
  state.run++;
  state.busy = false;
  window.clearTimeout(timer);
  clearAll(false);
  els = null;
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

const isVideo = (f: File) => f.type.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogv)$/i.test(f.name);
const isImage = (f: File) => f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|avif|heic|heif|svg)$/i.test(f.name);

function onPaste(e: ClipboardEvent): void {
  const files = [...(e.clipboardData?.files ?? [])].filter((f) => isImage(f) || isVideo(f));
  if (!files.length) return;
  e.preventDefault();
  void addFiles(files);
}

/** Pictures add frames; a video replaces everything (one clip at a time). */
async function addFiles(files: File[]): Promise<void> {
  const video = files.find(isVideo);
  if (video) {
    await setClip(video);
    return;
  }
  const images = files.filter(isImage);
  if (!images.length) return;
  if (state.mode === "video") clearAll();
  state.mode = "images";
  // Another drop of pictures adds to this one; only a video or Clear replaces it.
  const load = state.load;
  let failed = 0;
  for (const file of images) {
    if (state.stills.length >= MAX_FRAMES) {
      setStatus(t("gifMaker.tooMany", { max: MAX_FRAMES }));
      break;
    }
    try {
      const d = await decodeImage(file);
      // Unmounted, cleared, or a video took over while this picture decoded.
      if (!els || load !== state.load) {
        d.bitmap.close();
        return;
      }
      const bitmap = await shrink(d.bitmap);
      if (!els || load !== state.load) {
        bitmap.close();
        return;
      }
      state.stills.push({ id: crypto.randomUUID(), file, bitmap, width: d.width, height: d.height });
    } catch {
      failed++;
    }
  }
  if (failed) setStatus(t("gifMaker.errorDecode"));
  changed();
}

async function setClip(file: File): Promise<void> {
  clearAll();
  state.mode = "video";
  const load = ++state.load;
  const url = URL.createObjectURL(file);
  const video = h("video", { src: url, muted: true, playsinline: true, controls: true, preload: "auto", class: "gif-clip" });
  video.muted = true;
  setStatus(t("gifMaker.loading"));
  // On the page from the start (some mobile browsers load nothing for a detached video), and only the metadata is
  // awaited: iOS Safari may not load frame data before a gesture, and seeking for each frame loads what is needed.
  els?.videoBox.replaceChildren(video);
  if (els) els.videoBox.hidden = false;
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("timeout")), LOAD_TIMEOUT_MS);
      video.addEventListener("loadedmetadata", () => { window.clearTimeout(timer); resolve(); }, { once: true });
      video.addEventListener("error", () => { window.clearTimeout(timer); reject(new Error("video")); }, { once: true });
    });
  } catch {
    video.removeAttribute("src");
    video.load();
    video.remove();
    URL.revokeObjectURL(url);
    if (load !== state.load) return;
    state.mode = "images";
    setStatus(t("gifMaker.errorVideo"));
    refresh();
    return;
  }
  // Unmounted, cleared, or another file dropped while this one loaded.
  if (!els || load !== state.load) {
    video.removeAttribute("src");
    video.load();
    video.remove();
    URL.revokeObjectURL(url);
    return;
  }
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  state.clip = { file, url, video, duration, width: video.videoWidth, height: video.videoHeight };
  state.start = 0;
  state.end = Math.min(duration || 3, 3);
  els.start.value = String(state.start);
  els.end.value = String(Math.round(state.end * 10) / 10);
  els.videoBox.replaceChildren(video);
  setStatus("");
  changed();
}

function clearAll(paint = true): void {
  state.load++;
  for (const s of state.stills) {
    s.bitmap.close();
  }
  state.stills = [];
  if (state.clip) {
    state.clip.video.removeAttribute("src");
    state.clip.video.load();
    URL.revokeObjectURL(state.clip.url);
  }
  state.clip = null;
  state.mode = "images";
  dropResult();
  if (paint) changed();
}

function dropResult(): void {
  if (state.result) URL.revokeObjectURL(state.result.url);
  state.result = null;
  els?.result.replaceChildren();
}

/** A setting or the frames changed: any made GIF is out of date, and a running encode stops. */
function changed(): void {
  state.run++;
  if (state.busy) setStatus(t("gifMaker.stopped"));
  state.busy = false;
  dropResult();
  refresh();
}

function setStatus(text: string): void {
  if (els) els.status.textContent = text;
}

function outputSize(): { width: number; height: number } | null {
  const first = state.mode === "video" ? state.clip : state.stills[0];
  return first ? gifSize(first.width, first.height, state.width) : null;
}

function refresh(): void {
  if (!els) return;
  const video = state.mode === "video";
  els.imageOpts.hidden = video;
  els.videoOpts.hidden = !video;
  els.videoBox.hidden = !video;
  els.preview.hidden = video;
  els.make.textContent = state.busy ? t("gifMaker.stop") : t("gifMaker.make");
  renderList();
  animate();
}

function renderList(): void {
  if (!els) return;
  if (state.mode === "video" && state.clip) {
    const n = frameCount(state.start, state.end, state.fps, state.clip.duration);
    els.list.replaceChildren(h("li", { class: "file" },
      h("div", null, h("strong", null, state.clip.file.name), h("span", null, t("gifMaker.clipInfo", { s: Math.round(state.clip.duration * 10) / 10, n }))),
    ));
    return;
  }
  if (!state.stills.length) {
    els.list.replaceChildren(h("li", { class: "muted" }, t("gifMaker.empty")));
    return;
  }
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= state.stills.length) return;
    [state.stills[i], state.stills[j]] = [state.stills[j]!, state.stills[i]!];
    changed();
  };
  els.list.replaceChildren(...state.stills.map((s, i) => h("li", { class: "file", "data-frame": String(i + 1) },
    thumb(s.bitmap),
    h("div", null, h("strong", null, `${i + 1}. ${s.file.name}`), h("span", null, `${s.width}×${s.height}`)),
    h("span", { class: "gif-move" },
      h("button", { type: "button", class: "icon", "aria-label": t("gifMaker.moveUp"), "data-action": "up", disabled: i === 0, onClick: () => move(i, -1) }, "↑"),
      h("button", { type: "button", class: "icon", "aria-label": t("gifMaker.moveDown"), "data-action": "down", disabled: i === state.stills.length - 1, onClick: () => move(i, 1) }, "↓"),
      h("button", {
        type: "button",
        class: "icon",
        "aria-label": t("gifMaker.remove"),
        "data-action": "remove",
        onClick: () => {
          const [gone] = state.stills.splice(i, 1);
          gone?.bitmap.close();
          changed();
        },
      }, "×"),
    ),
  )));
}

/** Plays the picture frames on the preview canvas at the chosen delay (the video shows in its own player). */
function animate(): void {
  window.clearTimeout(timer);
  if (!els || state.mode !== "images") return;
  const size = outputSize();
  const ctx = els.preview.getContext("2d");
  if (!ctx) return;
  if (!size) {
    ctx.clearRect(0, 0, els.preview.width, els.preview.height);
    return;
  }
  els.preview.width = size.width;
  els.preview.height = size.height;
  let i = 0;
  const step = () => {
    if (!els || state.mode !== "images" || !state.stills.length) return;
    drawFrame(ctx, state.stills[i % state.stills.length]!.bitmap, size.width, size.height);
    i++;
    if (state.stills.length > 1) timer = window.setTimeout(step, Math.max(20, state.delayMs));
  };
  step();
}

function drawFrame(ctx: CanvasRenderingContext2D, source: ImageBitmap | HTMLVideoElement, w: number, hgt: number): void {
  const sw = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const sh = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
  ctx.fillStyle = state.background;
  ctx.fillRect(0, 0, w, hgt);
  const r = fitFrame(sw, sh, w, hgt, state.mode === "video" ? "cover" : state.fit);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
}

/**
 * A frame never needs more than twice the widest GIF (800 px) on its long edge, even filled into a frame of another
 * shape, so phone photos are kept small instead of as 12-megapixel bitmaps.
 */
const KEEP_EDGE = 1600;

async function shrink(bitmap: ImageBitmap): Promise<ImageBitmap> {
  const scale = KEEP_EDGE / Math.max(bitmap.width, bitmap.height);
  if (scale >= 1) return bitmap;
  try {
    const small = await createImageBitmap(bitmap, { resizeWidth: Math.round(bitmap.width * scale), resizeHeight: Math.round(bitmap.height * scale), resizeQuality: "high" });
    bitmap.close();
    return small;
  } catch {
    return bitmap;
  }
}

/** A 42 px list thumbnail drawn from the kept bitmap (no second full-size decode). */
function thumb(bitmap: ImageBitmap): HTMLCanvasElement {
  const c = h("canvas", { class: "gif-thumb", width: 84, height: 84 });
  const ctx = c.getContext("2d");
  if (ctx) {
    const r = fitFrame(bitmap.width, bitmap.height, 84, 84, "cover");
    ctx.drawImage(bitmap, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
  }
  return c;
}

const yieldFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** How long a video may take to report its size, or one seek to land, before the page says it cannot read it. */
const LOAD_TIMEOUT_MS = 20000;

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => fail(), LOAD_TIMEOUT_MS);
    const done = () => {
      window.clearTimeout(timer);
      video.removeEventListener("seeked", done);
      video.removeEventListener("error", fail);
      resolve();
    };
    const fail = () => {
      window.clearTimeout(timer);
      video.removeEventListener("seeked", done);
      video.removeEventListener("error", fail);
      reject(new Error("seek"));
    };
    video.addEventListener("seeked", done);
    video.addEventListener("error", fail, { once: true });
    video.currentTime = time;
  });
}

async function makeGif(): Promise<void> {
  if (!els) return;
  if (state.busy) {
    changed();
    return;
  }
  const size = outputSize();
  if (!size) {
    setStatus(t("gifMaker.needFrames"));
    return;
  }
  const clip = state.mode === "video" ? state.clip : null;
  const times = clip ? frameTimes(state.start, state.end, state.fps, clip.duration) : [];
  const count = clip ? times.length : state.stills.length;
  if (clip && count === 0) {
    setStatus(t("gifMaker.errorRange"));
    return;
  }
  if (count > MAX_FRAMES) {
    setStatus(t("gifMaker.tooMany", { max: MAX_FRAMES }));
    return;
  }
  dropResult();
  const run = ++state.run;
  state.busy = true;
  refresh();
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    state.busy = false;
    setStatus(t("gifMaker.errorDecode"));
    refresh();
    return;
  }
  const writer = new GifWriter({ ...size, loop: LOOPS[state.loop] });
  // Video frames show for exactly the time between their samples, so the GIF plays at the clip's own speed.
  const delayMs = clip ? (times.length > 1 ? (times[1]! - times[0]!) * 1000 : 1000 / state.fps) : state.delayMs;
  try {
    if (clip) clip.video.pause();
    for (let i = 0; i < count; i++) {
      if (run !== state.run) return;
      setStatus(t("gifMaker.encoding", { i: i + 1, n: count }));
      if (clip) {
        await seek(clip.video, times[i]!);
        if (run !== state.run) return;
        drawFrame(ctx, clip.video, size.width, size.height);
      } else {
        drawFrame(ctx, state.stills[i]!.bitmap, size.width, size.height);
      }
      writer.addFrame(ctx.getImageData(0, 0, size.width, size.height).data, { colors: state.colors, dither: state.dither, delayMs });
      await yieldFrame();
    }
  } catch {
    if (run === state.run) {
      state.busy = false;
      setStatus(t(clip ? "gifMaker.errorVideo" : "gifMaker.errorDecode"));
      refresh();
    }
    return;
  }
  if (run !== state.run || !els) return;
  const bytes = writer.finish();
  const packed = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(packed).set(bytes);
  const blob = new Blob([packed], { type: "image/gif" });
  state.result = { blob, url: URL.createObjectURL(blob), frames: count, ...size };
  state.busy = false;
  setStatus(t("gifMaker.done", { n: count, size: formatBytes(blob.size), w: size.width, h: size.height }));
  const first = clip ? clip.file : state.stills[0]!.file;
  const name = outputFilename(first.name, "image/gif", "");
  els.result.replaceChildren(
    h("img", { src: state.result.url, alt: t("gifMaker.resultAlt"), width: size.width, height: size.height, class: "gif-out" }),
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn", "data-action": "download", onClick: () => state.result && downloadBlob(state.result.blob, name) }, t("gifMaker.download")),
    ),
  );
  refresh();
}
