import {
  IMAGE_COUNTS,
  IMAGE_SIZES,
  IMAGE_STYLES,
  IMAGE_STYLE_SUFFIX,
  PROMPT_MAX,
  promptLanguage,
  type PromptLang,
  type ImageCount,
  type ImageSize,
  type ImageStyle,
} from "../../shared/image-gen";
import { appHref } from "../../shared/path";
import { AiClient, guessBackend } from "../ai/client";
import { chipGroup, deviceLabel, formatSeconds, prewarm, runJob, statusPanel, type Status } from "../ai/kit";
import type { AiResponse } from "../ai/protocol";
import { canvasToBlob } from "../decode";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";

const EXAMPLES = 6;
/** Results kept on the page; older ones are dropped (and their object URLs freed). */
const KEEP = 12;

type Result = { url: string; blob: Blob; prompt: string; size: number; n: number };

const state = {
  style: "none" as ImageStyle,
  count: 1 as ImageCount,
  size: 768 as ImageSize,
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
let warmed = false;
/** Numbers results for their file names; never reused within a mount. */
let serial = 0;
/** The last prompt's English, so generating again from the same words does not translate them again. */
let lastEnglish: { text: string; english: string } | null = null;
/** Bumped on unmount, so a run from an earlier mount stops at its next step. */
let mountId = 0;

export async function mountImageGenerator(host: HTMLElement): Promise<void> {
  alive = true;
  warmed = false;
  serial = 0;
  lastEnglish = null;
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
    onFocusin: () => void warm(),
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
      chipGroup(IMAGE_STYLES, () => state.style, (s) => t(`imageGen.style_${s}`), (s) => (state.style = s), () => {}),
    ),
    h("fieldset", null,
      h("legend", null, t("imageGen.count")),
      chipGroup(IMAGE_COUNTS, () => state.count, (n) => String(n), (n) => (state.count = n), () => {}),
    ),
    h("fieldset", null,
      h("legend", null, t("imageGen.size")),
      chipGroup(IMAGE_SIZES, () => state.size, (s) => t(`imageGen.size_${s}`), (s) => (state.size = s), () => {}),
      h("p", { class: "muted" }, t("imageGen.note")),
    ),
  );
}

/**
 * Start loading the model while the visitor types: only if it is already cached (it is a large download), once per
 * mount, and only with a GPU (the page never runs Janus on the CPU, so it should not load it there).
 */
async function warm(): Promise<void> {
  if (warmed || !client || !status) return;
  warmed = true;
  if ((await guessBackend()) === "cpu" || !client || !status) return;
  void prewarm(client, "janus", status);
}

async function generate(): Promise<void> {
  if (!client || !status || !promptEl || state.running) return;
  // Chat-template control tags typed or pasted into a prompt would break the model's input: drop them.
  const text = promptEl.value
    .replace(/<[|｜][^<>|｜]{1,40}[|｜]>|<(?:image_placeholder|begin_of_image|end_of_image)>/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, PROMPT_MAX);
  if (!text) {
    status.error(t("imageGen.empty"));
    promptEl.focus();
    return;
  }
  // Claimed before the first await, so a double click or a repeated Ctrl+Enter cannot start a second run.
  state.running = true;
  if (generateBtn) generateBtn.disabled = true;
  if (englishEl) englishEl.hidden = true;
  const panel = status;
  const runner = client;
  const mine = mountId;
  const stale = (): boolean => !alive || mine !== mountId;
  if ((await guessBackend()) === "cpu") {
    if (!stale()) {
      panel.error(t("imageGen.needsGpu"));
      state.running = false;
      if (generateBtn) generateBtn.disabled = false;
    }
    return;
  }
  const suffix = IMAGE_STYLE_SUFFIX[state.style];
  // Translated once, by the first picture's job; the rest reuse the English it sends back.
  let prompt = text;
  let from: PromptLang = promptLanguage(text, locale());
  if (from !== "en" && lastEnglish?.text === text) {
    prompt = lastEnglish.english;
    from = "en";
    showEnglish(prompt);
  }
  // Anime pictures are enlarged with the anime model, like the image upscaler does for line art.
  const upscaleStyle = state.style === "anime" ? "anime" : "photo";
  const { count, size } = state;
  const started = performance.now();
  let device = "";
  try {
    for (let i = 0; i < count; i++) {
      // Left the page: stop here, or the next job would start a new worker on the disposed client.
      if (stale()) return;
      const label = count > 1 ? ` (${i + 1}/${count})` : "";
      const { result, backend } = await runJob<Extract<AiResponse, { type: "image" }>>(
        runner,
        panel,
        async () => ({ body: { type: "text-to-image", prompt, from, suffix } }),
        {
          // 576 sequential steps of a 1B model are not a job for the CPU: a GPU failure is reported, not retried there.
          gpuOnly: true,
          onTiles: (done, total) => panel.working(t("imageGen.drawing", { pct: Math.floor((done / total) * 100) }) + label, done / total),
          onText: (english) => {
            prompt = english;
            from = "en";
            lastEnglish = { text, english };
            if (!stale()) showEnglish(english);
          },
        },
      );
      if (stale()) return;
      device = deviceLabel(backend);
      let image = result;
      if (size > result.width) {
        image = await upscale(runner, panel, result, size / result.width === 4 ? 4 : 2, upscaleStyle, label);
        if (stale()) return;
      }
      await addResult(image, text, size, stale);
    }
    if (stale()) return;
    panel.done(t("ai.doneIn", { s: formatSeconds((performance.now() - started) / 1000), device }));
  } catch (err) {
    if (stale() || (err instanceof Error && err.message === "cancelled")) return;
    console.error(err);
    // A lost or exhausted GPU device belongs to the worker: start the next run in a fresh one.
    if (client === runner) {
      runner.dispose();
      client = new AiClient();
      // Let the jobs dispose() cancelled (a warm-up) settle first: their handlers reset the status line.
      await new Promise((r) => setTimeout(r, 0));
      if (stale()) return;
    }
    // "webgpu": the worker found no GPU adapter even though the page did.
    panel.error(t(err instanceof Error && err.message === "webgpu" ? "imageGen.needsGpu" : "imageGen.errorRun"));
  } finally {
    if (!stale()) {
      state.running = false;
      if (generateBtn) generateBtn.disabled = false;
    }
  }
}

/** Real-ESRGAN on the drawn image: the image upscaler's models, run on the same worker. */
async function upscale(
  runner: AiClient,
  panel: Status,
  image: Extract<AiResponse, { type: "image" }>,
  scale: 2 | 4,
  style: "photo" | "anime",
  label: string,
): Promise<Extract<AiResponse, { type: "image" }>> {
  const { result } = await runJob<Extract<AiResponse, { type: "image" }>>(
    runner,
    panel,
    async () => {
      // The drawn image is not used again, so its buffer goes straight in.
      const bitmap = await createImageBitmap(new ImageData(image.data, image.width, image.height));
      return { body: { type: "upscale", bitmap, scale, style }, transfer: [bitmap] };
    },
    {
      // Same worker as Janus: a GPU failure here means the device is gone, not a reason to grind on the CPU.
      gpuOnly: true,
      onTiles: (done, total) => panel.working(t("imageGen.upscaling", { pct: Math.floor((done / total) * 100) }) + label, done / total),
    },
  );
  return result;
}

async function addResult(image: Extract<AiResponse, { type: "image" }>, prompt: string, size: number, stale: () => boolean): Promise<void> {
  const canvas = h("canvas", { width: image.width, height: image.height });
  canvas.getContext("2d")!.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
  const blob = await canvasToBlob(canvas, "image/png", 1);
  if (stale() || !gallery || !mainImg) return;
  const result: Result = { url: URL.createObjectURL(blob), blob, prompt, size, n: ++serial };
  results.unshift(result);
  for (const old of results.splice(KEEP)) URL.revokeObjectURL(old.url);
  show(result);
  renderGallery();
}

function showEnglish(english: string): void {
  if (!englishEl) return;
  englishEl.textContent = t("imageGen.translated", { text: english });
  englishEl.hidden = false;
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
  gallery.replaceChildren(...results.map((r) =>
    h("figure", null,
      h("button", { type: "button", class: "gen-thumb", "aria-label": t("imageGen.show"), onClick: () => show(r) },
        h("img", { src: r.url, alt: r.prompt, loading: "lazy" }),
      ),
      h("figcaption", null,
        h("button", { type: "button", class: "btn ghost", onClick: () => downloadBlob(r.blob, fileName(r)) }, t("imageGen.download")),
      ),
    ),
  ));
}

function fileName(r: Result): string {
  const slug = r.prompt.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
  // Cut by code points, so an emoji or rare CJK character is never split in half.
  const words = [...slug].slice(0, 40).join("").replace(/-+$/, "") || "image";
  return `${words}-${r.size}px-${r.n}.png`;
}
