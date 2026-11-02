import { appHref } from "../../shared/path";
import { AiClient, guessBackend } from "../ai/client";
import { chipGroup, deviceLabel, formatSeconds, prewarm, runJob, statusPanel, type Status } from "../ai/kit";
import type { AiResponse } from "../ai/protocol";
import { canvasToBlob } from "../decode";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";

const STYLES = ["none", "photo", "anime", "watercolor", "3d"] as const;
type Style = (typeof STYLES)[number];

/** Appended to the prompt in English: the model follows English style words most reliably. */
const STYLE_SUFFIX: Record<Style, string> = {
  none: "",
  photo: ", realistic photo, natural light, high detail",
  anime: ", anime illustration, clean line art, soft colors",
  watercolor: ", watercolor painting, soft edges, paper texture",
  "3d": ", 3D render, soft studio lighting, clay style",
};

/** Letters outside basic Latin: Chinese, Japanese, Korean, Vietnamese, accented Spanish… */
const NON_ASCII = /[^\x00-\x7F]/;

const COUNTS = [1, 2, 4] as const;
type Count = (typeof COUNTS)[number];

/** Output long side: the model draws 384 px; 768 and 1536 run Real-ESRGAN on the result. */
const SIZES = [384, 768, 1536] as const;
type Size = (typeof SIZES)[number];

const EXAMPLES = 6;
const PROMPT_MAX = 500;
/** Results kept on the page; older ones are dropped (and their object URLs freed). */
const KEEP = 12;

type Result = { url: string; blob: Blob; prompt: string; size: number };

const state = {
  style: "none" as Style,
  count: 1 as Count,
  size: 768 as Size,
  running: false,
};

let client: AiClient | null = null;
let status: Status | null = null;
let promptEl: HTMLTextAreaElement | null = null;
let generateBtn: HTMLButtonElement | null = null;
let mainImg: HTMLImageElement | null = null;
let hintEl: HTMLElement | null = null;
/** The English the model drew from, when the prompt was in another language. */
let englishEl: HTMLElement | null = null;
let gallery: HTMLElement | null = null;
let results: Result[] = [];
let alive = false;
/** Bumped on unmount, so a run from an earlier mount stops at its next step. */
let mountId = 0;

export async function mountImageGenerator(host: HTMLElement): Promise<void> {
  alive = true;
  mountId++;
  client = new AiClient();
  status = statusPanel("Janus-Pro-1B", "janus");
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("imageGen.back")),
      h("h1", null, t("imageGen.title")),
      h("p", { class: "lede" }, t("imageGen.privacyNote")),
    ),
    h("div", { class: "tool" },
      promptRail(),
      stagePane(),
      controls(),
    ),
  );
}

export function unmountImageGenerator(): void {
  alive = false;
  mountId++;
  client?.dispose();
  client = null;
  for (const r of results) URL.revokeObjectURL(r.url);
  results = [];
  state.running = false;
  status = null;
  promptEl = null;
  generateBtn = null;
  mainImg = null;
  hintEl = null;
  englishEl = null;
  gallery = null;
}

function promptRail(): HTMLElement {
  promptEl = h("textarea", {
    id: "image-prompt",
    rows: "6",
    maxlength: String(PROMPT_MAX),
    placeholder: t("imageGen.promptPlaceholder"),
    "data-field": "prompt",
    onFocusin: warm,
    onKeydown: (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void generate();
      }
    },
  });
  const examples = Array.from({ length: EXAMPLES }, (_, i) => {
    const text = t(`imageGen.example${i + 1}`);
    return h("button", {
      type: "button",
      class: "chip",
      onClick: () => {
        if (!promptEl) return;
        promptEl.value = text;
        promptEl.focus();
      },
    }, text);
  });
  generateBtn = h("button", { type: "button", class: "btn", onClick: () => void generate() }, t("imageGen.generate"));
  return h("aside", { class: "rail" },
    h("div", { class: "rail-h" }, h("h2", null, h("label", { for: "image-prompt" }, t("imageGen.promptLabel")))),
    promptEl,
    h("div", { class: "stage-actions" }, generateBtn),
    h("p", { class: "muted" }, t("imageGen.examplesLabel")),
    h("div", { class: "convert-chips" }, ...examples),
  );
}

function stagePane(): HTMLElement {
  mainImg = h("img", { class: "preview gen-main", alt: "", hidden: true });
  hintEl = h("p", { class: "hint" }, t("imageGen.hint"));
  englishEl = h("p", { class: "muted", hidden: true, "data-volatile": "" });
  gallery = h("div", { class: "gen-grid" });
  return h("section", { class: "stage" },
    h("div", { class: "stage-frame" }, mainImg, hintEl),
    status!.el,
    englishEl,
    h("h2", { class: "gen-title" }, t("imageGen.resultsTitle")),
    gallery,
  );
}

function controls(): HTMLElement {
  return h("aside", { class: "rail controls" },
    h("fieldset", null,
      h("legend", null, t("imageGen.style")),
      chipGroup(STYLES, () => state.style, (s) => t(`imageGen.style_${s}`), (s) => (state.style = s), () => {}),
    ),
    h("fieldset", null,
      h("legend", null, t("imageGen.count")),
      chipGroup(COUNTS, () => state.count, (n) => String(n), (n) => (state.count = n), () => {}),
    ),
    h("fieldset", null,
      h("legend", null, t("imageGen.size")),
      chipGroup(SIZES, () => state.size, (s) => t(`imageGen.size_${s}`), (s) => (state.size = s), () => {}),
      h("p", { class: "muted" }, t("imageGen.note")),
    ),
  );
}

/** Start loading the model while the visitor types (only if it is already cached: it is a large download). */
function warm(): void {
  if (client && status) void prewarm(client, "janus", status);
}

async function generate(): Promise<void> {
  if (!client || !status || !promptEl || state.running) return;
  const text = promptEl.value.trim().slice(0, PROMPT_MAX);
  if (!text) {
    status.error(t("imageGen.empty"));
    promptEl.focus();
    return;
  }
  if ((await guessBackend()) === "cpu") {
    status.error(t("imageGen.needsGpu"));
    return;
  }
  const suffix = STYLE_SUFFIX[state.style];
  // The model draws from English. Indonesian or unaccented Spanish is plain ASCII, so the page language decides too.
  const translate = locale() !== "en" || NON_ASCII.test(text);
  const { count, size } = state;
  const panel = status;
  const runner = client;
  const mine = mountId;
  const stale = (): boolean => !alive || mine !== mountId;
  state.running = true;
  if (generateBtn) generateBtn.disabled = true;
  if (englishEl) englishEl.hidden = true;
  const started = performance.now();
  let device = "";
  try {
    for (let i = 0; i < count; i++) {
      const label = count > 1 ? ` (${i + 1}/${count})` : "";
      const { result, backend } = await runJob<Extract<AiResponse, { type: "image" }>>(
        runner,
        panel,
        async () => ({ body: { type: "text-to-image", prompt: text, translate, suffix } }),
        {
          onTiles: (done, total) => panel.working(t("imageGen.drawing", { pct: Math.floor((done / total) * 100) }) + label, done / total),
          onText: (english) => {
            if (!stale() && englishEl) {
              englishEl.textContent = t("imageGen.translated", { text: english });
              englishEl.hidden = false;
            }
          },
        },
      );
      if (stale()) return;
      device = deviceLabel(backend);
      let image = result;
      if (size > result.width) {
        image = await upscale(runner, panel, result, size / result.width === 4 ? 4 : 2, label);
        if (stale()) return;
      }
      await addResult(image, text, size);
    }
    if (stale()) return;
    panel.done(t("ai.doneIn", { s: formatSeconds((performance.now() - started) / 1000), device }));
  } catch (err) {
    if (stale() || (err instanceof Error && err.message === "cancelled")) return;
    console.error(err);
    panel.error(t("imageGen.errorRun"));
  } finally {
    if (!stale()) {
      state.running = false;
      if (generateBtn) generateBtn.disabled = false;
    }
  }
}

/** Real-ESRGAN (photo model) on the drawn image: the AI tool next door, run on the same worker. */
async function upscale(
  runner: AiClient,
  panel: Status,
  image: Extract<AiResponse, { type: "image" }>,
  scale: 2 | 4,
  label: string,
): Promise<Extract<AiResponse, { type: "image" }>> {
  const { result } = await runJob<Extract<AiResponse, { type: "image" }>>(
    runner,
    panel,
    async () => {
      const bitmap = await createImageBitmap(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height));
      return { body: { type: "upscale", bitmap, scale, style: "photo" }, transfer: [bitmap] };
    },
    { onTiles: (done, total) => panel.working(t("imageGen.upscaling", { pct: Math.floor((done / total) * 100) }) + label, done / total) },
  );
  return result;
}

async function addResult(image: Extract<AiResponse, { type: "image" }>, prompt: string, size: number): Promise<void> {
  const canvas = h("canvas", { width: image.width, height: image.height });
  canvas.getContext("2d")!.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
  const blob = await canvasToBlob(canvas, "image/png", 1);
  if (!alive || !gallery || !mainImg) return;
  const result: Result = { url: URL.createObjectURL(blob), blob, prompt, size };
  results.unshift(result);
  for (const old of results.splice(KEEP)) URL.revokeObjectURL(old.url);
  show(result);
  renderGallery();
}

function show(result: Result): void {
  if (!mainImg) return;
  mainImg.src = result.url;
  mainImg.alt = result.prompt;
  mainImg.hidden = false;
  if (hintEl) hintEl.hidden = true;
}

function renderGallery(): void {
  if (!gallery) return;
  gallery.replaceChildren(...results.map((r, i) =>
    h("figure", null,
      h("button", { type: "button", class: "gen-thumb", "aria-label": t("imageGen.show"), onClick: () => show(r) },
        h("img", { src: r.url, alt: r.prompt, loading: "lazy" }),
      ),
      h("figcaption", null,
        h("button", { type: "button", class: "btn ghost", onClick: () => downloadBlob(r.blob, fileName(r, i)) }, t("imageGen.download")),
      ),
    ),
  ));
}

function fileName(r: Result, i: number): string {
  const words = r.prompt.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "image";
  return `${words}-${r.size}px-${results.length - i}.png`;
}
