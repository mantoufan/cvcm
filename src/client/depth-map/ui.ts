import { outputFilename } from "../../shared/filename";
import { appHref } from "../../shared/path";
import { AiClient } from "../ai/client";
import { deviceLabel, dropZone, formatSeconds, prewarm, runJob, statusPanel, type Status } from "../ai/kit";
import type { AiResponse } from "../ai/protocol";
import { canvasToBlob, decodeImage } from "../decode";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";

type Palette = "gray" | "turbo" | "magma";

const state = {
  file: null as File | null,
  bitmap: null as ImageBitmap | null,
  width: 0,
  height: 0,
  /** Model output, 0 = far … 255 = near, at the model's resolution. */
  depth: null as { data: Uint8ClampedArray; width: number; height: number } | null,
  palette: "gray" as Palette,
  invert: false,
  side: false,
  running: false,
  again: false,
};

let client: AiClient | null = null;
let status: Status | null = null;
let preview: HTMLCanvasElement | null = null;
let hintEl: HTMLElement | null = null;
let paletteChips: HTMLButtonElement[] = [];
let alive = false;
let retired: ImageBitmap[] = [];

function closeRetired(): void {
  for (const bitmap of retired) bitmap.close();
  retired = [];
}

export async function mountDepthMap(host: HTMLElement): Promise<void> {
  alive = true;
  client = new AiClient();
  status = statusPanel("Depth Anything V2", "depth");
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("depthMap.back")),
      h("h1", null, t("depthMap.title")),
      h("p", { class: "lede" }, t("depthMap.privacyNote")),
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

export function unmountDepthMap(): void {
  alive = false;
  window.removeEventListener("paste", onPaste);
  client?.dispose();
  client = null;
  state.bitmap?.close();
  state.bitmap = null;
  closeRetired();
  state.file = null;
  state.depth = null;
  state.running = false;
  status = null;
  preview = null;
  hintEl = null;
  paletteChips = [];
}

function filesRail(): HTMLElement {
  return h("aside", { class: "rail" },
    h("div", { class: "rail-h" }, h("h2", null, t("depthMap.filesTitle"))),
    dropZone({
      id: "depth-file-input",
      accept: "image/png,image/jpeg,image/webp,image/avif,image/heic,image/heif,image/*",
      title: t("depthMap.dropTitle"),
      hint: t("depthMap.dropHint"),
      types: t("depthMap.dropTypes"),
      onFiles: (files) => void setFile(files[0]),
      onIntent: () => {
        if (client && status) void prewarm(client, "depth", status);
      },
    }),
  );
}

function stagePane(): HTMLElement {
  preview = h("canvas", { class: "preview", width: 800, height: 560 });
  hintEl = h("p", { class: "hint" }, t("depthMap.hint"));
  return h("section", { class: "stage" },
    h("div", { class: "stage-frame" }, preview),
    status!.el,
    hintEl,
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn", onClick: () => void download() }, t("depthMap.download")),
    ),
  );
}

function controls(): HTMLElement {
  const palettes: Palette[] = ["gray", "turbo", "magma"];
  paletteChips = palettes.map((p) =>
    h("button", {
      type: "button",
      class: "chip" + (state.palette === p ? " on" : ""),
      "aria-pressed": String(state.palette === p),
      dataset: { palette: p },
      onClick: () => {
        state.palette = p;
        for (const chip of paletteChips) {
          const on = chip.dataset.palette === p;
          chip.classList.toggle("on", on);
          chip.setAttribute("aria-pressed", String(on));
        }
        redraw();
      },
    }, t(`depthMap.palette_${p}`)),
  );
  const check = (label: string, key: "invert" | "side"): HTMLElement =>
    h("label", { class: "check" },
      h("input", {
        type: "checkbox",
        onChange: (e: Event) => {
          state[key] = (e.target as HTMLInputElement).checked;
          redraw();
        },
      }),
      label,
    );
  return h("aside", { class: "rail controls" },
    h("fieldset", null,
      h("legend", null, t("depthMap.style")),
      h("div", { class: "convert-chips" }, ...paletteChips),
      check(t("depthMap.invert"), "invert"),
      check(t("depthMap.side"), "side"),
      h("p", { class: "muted" }, t("depthMap.note")),
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

async function setFile(file: File | undefined): Promise<void> {
  if (!file || !status) return;
  let decoded;
  try {
    decoded = await decodeImage(file);
  } catch {
    status.error(t("depthMap.errorDecode"));
    return;
  }
  if (!alive) {
    decoded.bitmap.close();
    return;
  }
  // A run may still be reading the old bitmap: free it once that run ends.
  if (state.bitmap) retired.push(state.bitmap);
  if (!state.running) closeRetired();
  Object.assign(state, { file, depth: null, ...decoded });
  redraw();
  void run();
}

async function run(): Promise<void> {
  const source = state.bitmap;
  if (!source || !client || !status) return;
  if (state.running) {
    // A new photo arrived mid-run: estimate it when the current run ends.
    state.again = true;
    return;
  }
  state.running = true;
  try {
    const { result, backend, seconds } = await runJob<Extract<AiResponse, { type: "mask" }>>(
      client,
      status,
      async () => {
        const bitmap = await createImageBitmap(source);
        return { body: { type: "depth", bitmap }, transfer: [bitmap] };
      },
    );
    if (!alive || state.bitmap !== source) return;
    state.depth = { data: result.mask, width: result.width, height: result.height };
    status.done(t("ai.doneIn", { s: formatSeconds(seconds), device: deviceLabel(backend) }));
    redraw();
  } catch (err) {
    if (!alive || state.bitmap !== source) return;
    console.error(err);
    status.error(t("ai.errorRun"));
  } finally {
    state.running = false;
    closeRetired();
    if (state.again && alive) {
      state.again = false;
      void run();
    }
  }
}

/** Piecewise-linear color ramps (approximations of Turbo and Magma), 0 → 1. */
const RAMPS: Record<Exclude<Palette, "gray">, [number, number, number][]> = {
  turbo: [[48, 18, 59], [70, 107, 227], [41, 187, 236], [49, 242, 153], [164, 252, 60], [237, 208, 58], [251, 128, 34], [210, 49, 5], [122, 4, 3]],
  magma: [[0, 0, 4], [28, 16, 68], [79, 18, 123], [129, 37, 129], [181, 54, 122], [229, 80, 100], [251, 135, 97], [254, 194, 135], [252, 253, 191]],
};

function lut(palette: Palette): Uint8ClampedArray {
  const out = new Uint8ClampedArray(256 * 3);
  for (let v = 0; v < 256; v++) {
    if (palette === "gray") {
      out.set([v, v, v], v * 3);
      continue;
    }
    const ramp = RAMPS[palette];
    const x = (v / 255) * (ramp.length - 1);
    const i = Math.min(ramp.length - 2, Math.floor(x));
    const f = x - i;
    for (let c = 0; c < 3; c++) out[v * 3 + c] = ramp[i][c] + (ramp[i + 1][c] - ramp[i][c]) * f;
  }
  return out;
}

/** The depth map at the photo's full size, in the chosen palette. */
function depthCanvas(): HTMLCanvasElement | null {
  const d = state.depth;
  if (!d) return null;
  const small = h("canvas", { width: d.width, height: d.height });
  const sctx = small.getContext("2d")!;
  const img = sctx.createImageData(d.width, d.height);
  const table = lut(state.palette);
  for (let i = 0; i < d.data.length; i++) {
    const v = state.invert ? 255 - d.data[i] : d.data[i];
    img.data[i * 4] = table[v * 3];
    img.data[i * 4 + 1] = table[v * 3 + 1];
    img.data[i * 4 + 2] = table[v * 3 + 2];
    img.data[i * 4 + 3] = 255;
  }
  sctx.putImageData(img, 0, 0);
  const full = h("canvas", { width: state.width, height: state.height });
  const fctx = full.getContext("2d")!;
  fctx.imageSmoothingQuality = "high";
  fctx.drawImage(small, 0, 0, state.width, state.height);
  return full;
}

function redraw(): void {
  if (!preview) return;
  const ctx = preview.getContext("2d");
  if (!ctx) return;
  if (!state.bitmap) {
    preview.width = 800;
    preview.height = 560;
    ctx.clearRect(0, 0, preview.width, preview.height);
    if (hintEl) hintEl.textContent = t("depthMap.hint");
    return;
  }
  const depth = depthCanvas();
  const panes = state.side && depth ? 2 : 1;
  const scale = Math.min(1, 1400 / (Math.max(state.width * panes, state.height)));
  const w = Math.max(1, Math.round(state.width * scale));
  const hgt = Math.max(1, Math.round(state.height * scale));
  preview.width = w * panes;
  preview.height = hgt;
  ctx.imageSmoothingQuality = "high";
  if (panes === 2) {
    ctx.drawImage(state.bitmap, 0, 0, w, hgt);
    ctx.drawImage(depth!, w, 0, w, hgt);
  } else {
    ctx.drawImage(depth ?? state.bitmap, 0, 0, w, hgt);
  }
  if (hintEl) hintEl.textContent = `${state.width} × ${state.height}`;
}

async function download(): Promise<void> {
  const canvas = depthCanvas();
  if (!canvas || !state.file) {
    status?.error(t("depthMap.empty"));
    return;
  }
  const blob = await canvasToBlob(canvas, "image/png", 1);
  downloadBlob(blob, outputFilename(state.file.name, blob.type, "-depth"));
}
