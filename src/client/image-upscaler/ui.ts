import { outputFilename } from "../../shared/filename";
import { appHref } from "../../shared/path";
import { AiClient } from "../ai/client";
import { deviceLabel, dropZone, formatSeconds, prewarm, runJob, statusPanel, type Status } from "../ai/kit";
import type { AiResponse } from "../ai/protocol";
import { canvasToBlob, decodeImage } from "../decode";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";

/** Output cap: Safari will not draw or encode a canvas over 16.7 MP. */
export const MAX_OUTPUT_PIXELS = 16_777_216;

type Source = { file: File; bitmap: ImageBitmap; width: number; height: number; hasAlpha: boolean };

const state = {
  source: null as Source | null,
  result: null as HTMLCanvasElement | null,
  resultScale: 4 as 2 | 4,
  scale: 4 as 2 | 4,
  style: "photo" as "photo" | "anime",
  format: "png" as "png" | "jpeg" | "webp",
  split: 0.5,
  /** Show output pixels 1:1 (the frame scrolls) instead of fitting the frame. */
  actual: false,
  running: false,
};

let client: AiClient | null = null;
let status: Status | null = null;
let preview: HTMLCanvasElement | null = null;
let hintEl: HTMLElement | null = null;
let splitEl: HTMLInputElement | null = null;
let scaleChips: HTMLButtonElement[] = [];
let styleChips: HTMLButtonElement[] = [];
let alive = false;

const model = (): "esrgan-photo" | "esrgan-anime" => (state.style === "anime" ? "esrgan-anime" : "esrgan-photo");

export async function mountImageUpscaler(host: HTMLElement): Promise<void> {
  alive = true;
  client = new AiClient();
  status = statusPanel("Real-ESRGAN", model());
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("upscaler.back")),
      h("h1", null, t("upscaler.title")),
      h("p", { class: "lede" }, t("upscaler.privacyNote")),
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

export function unmountImageUpscaler(): void {
  alive = false;
  window.removeEventListener("paste", onPaste);
  client?.dispose();
  client = null;
  state.source?.bitmap.close();
  state.source = null;
  state.result = null;
  state.running = false;
  state.actual = false;
  status = null;
  preview = null;
  hintEl = null;
  splitEl = null;
  scaleChips = [];
  styleChips = [];
}

function filesRail(): HTMLElement {
  return h("aside", { class: "rail" },
    h("div", { class: "rail-h" }, h("h2", null, t("upscaler.filesTitle"))),
    dropZone({
      id: "upscaler-file-input",
      accept: "image/png,image/jpeg,image/webp,image/avif,image/heic,image/heif,image/*",
      title: t("upscaler.dropTitle"),
      hint: t("upscaler.dropHint"),
      types: t("upscaler.dropTypes"),
      onFiles: (files) => void setFile(files[0]),
      onIntent: () => {
        if (client && status) void prewarm(client, model(), status);
      },
    }),
  );
}

function stagePane(): HTMLElement {
  preview = h("canvas", { class: "preview", width: 800, height: 560 });
  hintEl = h("p", { class: "hint" }, t("upscaler.hint"));
  splitEl = h("input", {
    type: "range",
    min: "0",
    max: "1",
    step: "0.01",
    value: String(state.split),
    "aria-label": t("upscaler.compare"),
    onInput: (e: Event) => {
      state.split = Number((e.target as HTMLInputElement).value);
      redraw();
    },
  });
  return h("section", { class: "stage" },
    h("div", { class: "stage-frame" }, preview),
    h("div", { class: "row wrap" },
      h("label", { class: "field grow" }, h("span", null, t("upscaler.compare")), splitEl),
      h("label", { class: "check" },
        h("input", {
          type: "checkbox",
          onChange: (e: Event) => {
            state.actual = (e.target as HTMLInputElement).checked;
            redraw();
          },
        }),
        t("upscaler.actual"),
      ),
    ),
    status!.el,
    hintEl,
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn", onClick: () => void run() }, t("upscaler.run")),
      h("button", { type: "button", class: "btn ghost", onClick: () => void download() }, t("upscaler.download")),
    ),
  );
}

function chipRow<T extends string | number>(values: T[], current: () => T, label: (v: T) => string, set: (v: T) => void): HTMLButtonElement[] {
  return values.map((v) =>
    h("button", {
      type: "button",
      class: "chip" + (current() === v ? " on" : ""),
      "aria-pressed": String(current() === v),
      dataset: { value: String(v) },
      onClick: () => set(v),
    }, label(v)),
  );
}

function syncChips(list: HTMLButtonElement[], value: string): void {
  for (const chip of list) {
    const on = chip.dataset.value === value;
    chip.classList.toggle("on", on);
    chip.setAttribute("aria-pressed", String(on));
  }
}

function controls(): HTMLElement {
  scaleChips = chipRow<2 | 4>([2, 4], () => state.scale, (v) => `${v}×`, (v) => {
    state.scale = v;
    syncChips(scaleChips, String(v));
    updateHint();
  });
  styleChips = chipRow<"photo" | "anime">(["photo", "anime"], () => state.style, (v) => t(`upscaler.style_${v}`), (v) => {
    state.style = v;
    syncChips(styleChips, v);
    status?.setModel(model());
  });
  return h("aside", { class: "rail controls" },
    h("fieldset", null,
      h("legend", null, t("upscaler.scale")),
      h("div", { class: "convert-chips" }, ...scaleChips),
    ),
    h("fieldset", null,
      h("legend", null, t("upscaler.style")),
      h("div", { class: "convert-chips" }, ...styleChips),
      h("p", { class: "muted" }, t("upscaler.styleNote")),
    ),
    h("fieldset", null,
      h("legend", null, t("upscaler.export")),
      h("label", { class: "field" },
        h("span", null, t("upscaler.format")),
        h("select", {
          onChange: (e: Event) => {
            state.format = (e.target as HTMLSelectElement).value as typeof state.format;
          },
        },
          h("option", { value: "png", selected: true }, "PNG"),
          h("option", { value: "jpeg" }, "JPG"),
          h("option", { value: "webp" }, "WebP"),
        ),
      ),
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

function detectAlpha(bitmap: ImageBitmap): boolean {
  const side = 256;
  const c = h("canvas", { width: side, height: side });
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, side, side);
  const data = ctx.getImageData(0, 0, side, side).data;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true;
  return false;
}

async function setFile(file: File | undefined): Promise<void> {
  if (!file) return;
  try {
    const decoded = await decodeImage(file);
    if (!alive) {
      decoded.bitmap.close();
      return;
    }
    state.source?.bitmap.close();
    state.source = { file, ...decoded, hasAlpha: detectAlpha(decoded.bitmap) };
    state.result = null;
    status?.idle();
    updateHint();
    redraw();
    void run();
  } catch {
    status?.error(t("upscaler.errorDecode"));
  }
}

/** Input size that keeps the output under the cap (shrinks the input if needed). */
function plan(src: Source, scale: number): { width: number; height: number; shrunk: boolean } {
  const fit = Math.min(1, Math.sqrt(MAX_OUTPUT_PIXELS / (src.width * src.height * scale * scale)));
  return {
    width: Math.max(1, Math.floor(src.width * fit)),
    height: Math.max(1, Math.floor(src.height * fit)),
    shrunk: fit < 1,
  };
}

function updateHint(): void {
  if (!hintEl) return;
  const src = state.source;
  if (!src) {
    hintEl.textContent = t("upscaler.hint");
    return;
  }
  const p = plan(src, state.scale);
  hintEl.textContent = t("upscaler.sizes", {
    from: `${src.width} × ${src.height}`,
    to: `${p.width * state.scale} × ${p.height * state.scale}`,
  }) + (p.shrunk ? ` ${t("upscaler.capped")}` : "");
}

async function run(): Promise<void> {
  const src = state.source;
  if (!src || !client || !status || state.running) {
    if (!src) status?.error(t("upscaler.empty"));
    return;
  }
  state.running = true;
  const scale = state.scale;
  const style = state.style;
  const p = plan(src, scale);
  try {
    const { result, backend, seconds } = await runJob<Extract<AiResponse, { type: "image" }>>(
      client,
      status,
      async () => {
        const bitmap = await createImageBitmap(src.bitmap, p.shrunk
          ? { resizeWidth: p.width, resizeHeight: p.height, resizeQuality: "high" }
          : {});
        return { body: { type: "upscale", bitmap, scale, style }, transfer: [bitmap] };
      },
    );
    if (!alive || state.source !== src) return;
    const out = h("canvas", { width: result.width, height: result.height });
    const ctx = out.getContext("2d")!;
    const img = new ImageData(result.data, result.width, result.height);
    if (src.hasAlpha) {
      // The network sees RGB only: carry the alpha channel over from a smooth resize of the original.
      const a = h("canvas", { width: result.width, height: result.height });
      const actx = a.getContext("2d", { willReadFrequently: true })!;
      actx.imageSmoothingQuality = "high";
      actx.drawImage(src.bitmap, 0, 0, result.width, result.height);
      const alpha = actx.getImageData(0, 0, result.width, result.height).data;
      for (let i = 3; i < img.data.length; i += 4) img.data[i] = alpha[i];
    }
    ctx.putImageData(img, 0, 0);
    state.result = out;
    state.resultScale = scale;
    status.done(t("ai.doneIn", { s: formatSeconds(seconds), device: deviceLabel(backend) }));
    redraw();
  } catch (err) {
    if (!alive) return;
    console.error(err);
    status.error(t("ai.errorRun"));
  } finally {
    state.running = false;
  }
}

/** Original (scaled up plainly) left of the split, the AI result right of it. "1:1" shows output pixels. */
function redraw(): void {
  if (!preview) return;
  const ctx = preview.getContext("2d");
  if (!ctx) return;
  const src = state.source;
  preview.classList.toggle("actual", state.actual);
  if (!src) {
    preview.width = 800;
    preview.height = 560;
    ctx.clearRect(0, 0, preview.width, preview.height);
    return;
  }
  const fit = state.actual && state.result
    ? state.result.width / src.width
    : Math.min(1400 / Math.max(src.width, src.height), 4);
  preview.width = Math.max(1, Math.round(src.width * fit));
  preview.height = Math.max(1, Math.round(src.height * fit));
  ctx.clearRect(0, 0, preview.width, preview.height);
  const cut = Math.round(preview.width * (state.result ? state.split : 1));
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, cut, preview.height);
  ctx.clip();
  ctx.imageSmoothingQuality = "low";
  ctx.drawImage(src.bitmap, 0, 0, preview.width, preview.height);
  ctx.restore();
  if (state.result) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(cut, 0, preview.width - cut, preview.height);
    ctx.clip();
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(state.result, 0, 0, preview.width, preview.height);
    ctx.restore();
    ctx.fillStyle = "#c2336c";
    ctx.fillRect(cut - 1, 0, 2, preview.height);
  }
}

async function download(): Promise<void> {
  if (!state.source || !state.result) {
    status?.error(t("upscaler.empty"));
    return;
  }
  const type = state.format === "jpeg" ? "image/jpeg" : state.format === "webp" ? "image/webp" : "image/png";
  const blob = await canvasToBlob(state.result, type, 0.95);
  downloadBlob(blob, outputFilename(state.source.file.name, blob.type, `-${state.resultScale}x`));
}
