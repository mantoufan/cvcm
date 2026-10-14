/// <reference lib="webworker" />
/**
 * Runs every AI tool's model off the main thread. Transformers.js and ONNX Runtime load here only, the first time
 * a visitor starts a tool; a loaded model stays warm until the page terminates the worker.
 */
import {
  AutoModel,
  AutoProcessor,
  AutoTokenizer,
  AutomaticSpeechRecognitionPipeline,
  RawImage,
  Tensor,
  WhisperForConditionalGeneration,
  WhisperTextStreamer,
  env,
  type PreTrainedModel,
  type Processor,
  type ProgressInfo,
} from "@huggingface/transformers";
import * as ort from "onnxruntime-web/webgpu";
import { AI_MODELS, AI_ORT_PREFIX, modelFileUrl, type AiBackend, type AiModelId } from "../../shared/ai-models";
import { detectBackend } from "./gpu";
import { CACHE_NAME, MODEL_HOST } from "./host";
import type { AiRequest, AiResponse, AsrChunk } from "./protocol";

declare const self: DedicatedWorkerGlobalScope;

const origin = self.location.origin;
env.allowLocalModels = false;
if (MODEL_HOST) {
  const host = new URL(MODEL_HOST, origin).href;
  env.remoteHost = host;
  // Mirrored per revision, so every file URL is immutable.
  env.remotePathTemplate = "{model}/{revision}/";
  // Some lookups (tokenizer and pipeline file probes) ignore `revision` and ask for main: pin those too.
  const pinned = new Map(Object.values(AI_MODELS).map((m) => [`${host}${m.repo}/main/`, `${host}${m.repo}/${m.revision}/`]));
  const fetchFile = env.fetch;
  env.fetch = (input, init) => {
    if (typeof input === "string") {
      for (const [from, to] of pinned) {
        if (input.startsWith(from)) return fetchFile(to + input.slice(from.length), init);
      }
    }
    return fetchFile(input, init);
  };
}
const onnxEnv = env.backends.onnx;
if (!import.meta.env.DEV && onnxEnv.wasm && onnxEnv.versions?.web) {
  const base = `${origin}${AI_ORT_PREFIX}${onnxEnv.versions.web}/`;
  onnxEnv.wasm.wasmPaths = {
    mjs: `${base}ort-wasm-simd-threaded.asyncify.mjs`,
    wasm: `${base}ort-wasm-simd-threaded.asyncify.wasm`,
  };
}
if (onnxEnv.wasm) {
  // Threads need cross-origin isolation (AI pages are served with COOP/COEP); leave a core or two for the page.
  const cores = self.navigator.hardwareConcurrency || 4;
  onnxEnv.wasm.numThreads = self.crossOriginIsolated ? Math.max(1, Math.min(8, cores - 2)) : 1;
}

let autoBackend: Promise<AiBackend> | null = null;

function pickBackend(force?: AiBackend): Promise<AiBackend> {
  if (force) return Promise.resolve(force);
  autoBackend ??= detectBackend(self.navigator);
  return autoBackend;
}

type Loaded = {
  backend: AiBackend;
  model?: PreTrainedModel;
  processor?: Processor;
  asr?: AutomaticSpeechRecognitionPipeline;
  session?: ort.InferenceSession;
};

const loaded = new Map<string, Promise<Loaded>>();

function post(msg: AiResponse, transfer: Transferable[] = []): void {
  self.postMessage(msg, transfer);
}

/** Jobs waiting on each model that is still loading: download progress goes to all of them. */
const watchers = new Map<string, Set<number>>();

function postProgress(key: string, loaded: number, total: number): void {
  for (const id of watchers.get(key) ?? []) post({ type: "progress", id, loaded, total });
}

/** Byte progress across a model's files, against the catalog's total (Transformers.js reports per file). */
function progressFor(key: string, total: number): (info: ProgressInfo) => void {
  const files = new Map<string, number>();
  return (info) => {
    if (info.status !== "progress" || !info.file.endsWith(".onnx")) return;
    files.set(info.file, info.loaded);
    let loaded = 0;
    for (const n of files.values()) loaded += n;
    postProgress(key, Math.min(loaded, total), total);
  };
}

/** One file through the shared cache, with byte progress. For models Transformers.js has no class for. */
async function fetchCached(url: string, expected: number, key: string): Promise<Uint8Array> {
  let cache: Cache | null = null;
  try {
    cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(url);
    if (hit) return new Uint8Array(await hit.arrayBuffer());
  } catch {
    cache = null;
  }
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${res.status} ${url}`);
  const total = Number(res.headers.get("content-length")) || expected;
  const parts: Uint8Array[] = [];
  let got = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    postProgress(key, got, total);
  }
  const bytes = new Uint8Array(got);
  let at = 0;
  for (const part of parts) {
    bytes.set(part, at);
    at += part.length;
  }
  try {
    await cache?.put(url, new Response(bytes, { headers: { "Content-Type": "application/octet-stream", "Content-Length": String(got) } }));
  } catch {
    /* quota: run without caching */
  }
  return bytes;
}

async function load(model: AiModelId, id: number, force?: AiBackend): Promise<Loaded> {
  const backend = await pickBackend(force);
  const key = `${model}:${backend}`;
  let entry = loaded.get(key);
  if (watchers.has(key) || !entry) {
    const ids = watchers.get(key) ?? new Set<number>();
    ids.add(id);
    watchers.set(key, ids);
  }
  if (!entry) {
    entry = (async (): Promise<Loaded> => {
      const spec = AI_MODELS[model];
      const variant = spec.variants[backend];
      if (model === "esrgan-photo" || model === "esrgan-anime") {
        const file = variant.files[0];
        const bytes = await fetchCached(modelFileUrl(model, file, MODEL_HOST, origin), variant.bytes, key);
        const session = await ort.InferenceSession.create(bytes, {
          executionProviders: [backend === "cpu" ? "wasm" : "webgpu"],
        });
        return { backend, session };
      }
      const opts = {
        device: backend === "cpu" ? ("wasm" as const) : ("webgpu" as const),
        dtype: variant.dtype as never,
        revision: spec.revision,
        progress_callback: progressFor(key, variant.bytes),
      };
      if (model === "whisper-base" || model === "whisper-small") {
        // Assembled by hand: pipeline() looks up its file list without the pinned revision (Transformers.js 4.3).
        const [m, tokenizer, processor] = await Promise.all([
          WhisperForConditionalGeneration.from_pretrained(spec.repo, opts),
          AutoTokenizer.from_pretrained(spec.repo, { revision: spec.revision }),
          AutoProcessor.from_pretrained(spec.repo, { revision: spec.revision }),
        ]);
        const asr = new AutomaticSpeechRecognitionPipeline({ task: "automatic-speech-recognition", model: m, tokenizer, processor });
        return { backend, asr };
      }
      const [m, p] = await Promise.all([
        AutoModel.from_pretrained(spec.repo, opts),
        AutoProcessor.from_pretrained(spec.repo, { revision: spec.revision }),
      ]);
      return { backend, model: m, processor: p };
    })();
    loaded.set(key, entry);
    const settled = (): void => {
      watchers.delete(key);
    };
    // A failed load (offline, storage full) gets a fresh attempt next time.
    entry.then(settled, () => {
      settled();
      loaded.delete(key);
    });
  }
  return entry;
}

function bitmapToRaw(bitmap: ImageBitmap, maxSide = Infinity): RawImage {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new RawImage(ctx.getImageData(0, 0, w, h).data, w, h, 4).rgb();
}

/** Float values → 0–255 bytes, stretched between their own min and max. */
function toBytes(data: Float32Array): Uint8ClampedArray<ArrayBuffer> {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i++) out[i] = ((data[i] - min) / range) * 255;
  return out;
}

function floatData(t: Tensor): Float32Array {
  // fp16 models with fp16 outputs: Tensor#to converts to float32.
  return t.type === "float32" ? (t.data as Float32Array) : (t.to("float32").data as Float32Array);
}

async function removeBackground(id: number, bitmap: ImageBitmap, force?: AiBackend): Promise<void> {
  const { model, processor, backend } = await load("birefnet", id, force);
  post({ type: "stage", id, stage: "run", backend });
  // The model sees 1024×1024; the page scales the mask back over the full-size photo.
  const image = bitmapToRaw(bitmap, 2048);
  bitmap.close();
  const { pixel_values } = await processor!(image);
  const { output_image } = (await model!({ input_image: pixel_values })) as { output_image: Tensor };
  const [h, w] = output_image.dims.slice(-2);
  const logits = floatData(output_image);
  const mask = new Uint8ClampedArray(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = 255 / (1 + Math.exp(-logits[i]));
  post({ type: "mask", id, mask, width: w, height: h }, [mask.buffer]);
}

async function estimateDepth(id: number, bitmap: ImageBitmap, force?: AiBackend): Promise<void> {
  const { model, processor, backend } = await load("depth", id, force);
  post({ type: "stage", id, stage: "run", backend });
  // The processor resizes to ~518 px anyway; a smaller copy keeps preprocessing cheap.
  const image = bitmapToRaw(bitmap, 1536);
  bitmap.close();
  const inputs = await processor!(image);
  const { predicted_depth } = (await model!(inputs)) as { predicted_depth: Tensor };
  const [h, w] = predicted_depth.dims.slice(-2);
  const mask = toBytes(floatData(predicted_depth));
  post({ type: "mask", id, mask, width: w, height: h }, [mask.buffer]);
}

/** Context around each tile, wider than the network's receptive field, so tiles meet without seams. */
const SR_PAD = 24;

/**
 * Real-ESRGAN (always ×4) over overlapping tiles, so memory stays flat whatever the photo size.
 * For ×2 each 4×4 output block is averaged down to 2×2 as it is written: the full ×4 image never exists.
 */
async function upscale(id: number, bitmap: ImageBitmap, scale: 2 | 4, style: "photo" | "anime", force?: AiBackend): Promise<void> {
  const { session, backend } = await load(style === "anime" ? "esrgan-anime" : "esrgan-photo", id, force);
  post({ type: "stage", id, stage: "run", backend });
  const w = bitmap.width;
  const h = bitmap.height;
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const src = ctx.getImageData(0, 0, w, h).data;
  const W = w * scale;
  const out = new Uint8ClampedArray(W * h * scale * 4);
  const tile = backend === "cpu" ? 192 : 384;
  const cols = Math.ceil(w / tile);
  const rows = Math.ceil(h / tile);
  const shrink = 4 / scale;
  let done = 0;
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const x0 = tx * tile;
      const y0 = ty * tile;
      const x1 = Math.min(w, x0 + tile);
      const y1 = Math.min(h, y0 + tile);
      const ax = Math.max(0, x0 - SR_PAD);
      const ay = Math.max(0, y0 - SR_PAD);
      const tw = Math.min(w, x1 + SR_PAD) - ax;
      const th = Math.min(h, y1 + SR_PAD) - ay;
      const plane = tw * th;
      const input = new Float32Array(3 * plane);
      for (let y = 0; y < th; y++) {
        let si = ((ay + y) * w + ax) * 4;
        for (let x = 0, di = y * tw; x < tw; x++, di++, si += 4) {
          input[di] = src[si] / 255;
          input[plane + di] = src[si + 1] / 255;
          input[2 * plane + di] = src[si + 2] / 255;
        }
      }
      const feeds = { pixel_values: new ort.Tensor("float32", input, [1, 3, th, tw]) };
      const result = await session!.run(feeds);
      const rec = result.reconstruction;
      const r = rec.data as Float32Array;
      const RW = tw * 4;
      const rp = RW * th * 4;
      // Write the core tile only, at the output scale.
      for (let y = (y0 - ay) * scale; y < (y1 - ay) * scale; y++) {
        const oy = ay * scale + y;
        for (let x = (x0 - ax) * scale; x < (x1 - ax) * scale; x++) {
          const ox = ax * scale + x;
          const di = (oy * W + ox) * 4;
          let red = 0;
          let green = 0;
          let blue = 0;
          for (let dy = 0; dy < shrink; dy++) {
            for (let dx = 0; dx < shrink; dx++) {
              const si = (y * shrink + dy) * RW + x * shrink + dx;
              red += r[si];
              green += r[rp + si];
              blue += r[2 * rp + si];
            }
          }
          const n = 255 / (shrink * shrink);
          out[di] = red * n;
          out[di + 1] = green * n;
          out[di + 2] = blue * n;
          out[di + 3] = 255;
        }
      }
      rec.dispose();
      done += 1;
      post({ type: "tiles", id, done, total: cols * rows });
    }
  }
  post({ type: "image", id, data: out, width: W, height: h * scale }, [out.buffer]);
}

/**
 * Whisper's language guess: the first token it writes after <|startoftranscript|> is the language tag.
 * Transformers.js has no detection of its own and would read every file as English.
 */
async function detectLanguage(asr: AutomaticSpeechRecognitionPipeline, audio: Float32Array): Promise<string | null> {
  const config = asr.model.generation_config as unknown as { decoder_start_token_id: number; lang_to_id: Record<string, number> };
  // Detect from the loudest 30 s window in the first few minutes, not a silent intro.
  const win = 30 * 16_000;
  let best = 0;
  let bestEnergy = -1;
  for (let at = 0; at < Math.min(audio.length, 10 * win); at += win / 2) {
    let e = 0;
    const end = Math.min(audio.length, at + win);
    for (let i = at; i < end; i += 16) e += audio[i] * audio[i];
    if (e > bestEnergy) {
      bestEnergy = e;
      best = at;
    }
  }
  const { input_features } = await asr.processor(audio.subarray(best, best + win));
  const out = (await asr.model.generate({
    inputs: input_features,
    decoder_input_ids: [config.decoder_start_token_id],
    max_new_tokens: 1,
  } as never)) as Tensor;
  const id = Number((out.tolist() as bigint[][])[0].at(-1));
  for (const [token, value] of Object.entries(config.lang_to_id)) {
    if (value === id) return token.slice(2, -2);
  }
  return null;
}

async function transcribe(
  id: number,
  audio: Float32Array,
  model: "whisper-base" | "whisper-small",
  language: string | null,
  task: "transcribe" | "translate",
  force?: AiBackend,
): Promise<void> {
  const { asr, backend } = await load(model, id, force);
  post({ type: "stage", id, stage: "run", backend });
  const lang = language ?? (await detectLanguage(asr!, audio)) ?? "en";
  post({ type: "language", id, language: lang });
  const chunkSeconds = 30;
  const strideSeconds = 5;
  const seconds = audio.length / 16_000;
  const step = chunkSeconds - 2 * strideSeconds;
  const windows = seconds <= chunkSeconds ? 1 : Math.ceil((seconds - chunkSeconds) / step) + 1;
  let finished = 0;
  const streamer = new WhisperTextStreamer(asr!.tokenizer as never, {
    skip_prompt: true,
    callback_function: (text: string) => post({ type: "text", id, text }),
    on_finalize: () => {
      finished += 1;
      post({ type: "tiles", id, done: Math.min(finished, windows), total: windows });
    },
  });
  const output = (await asr!(audio, {
    chunk_length_s: chunkSeconds,
    stride_length_s: strideSeconds,
    return_timestamps: true,
    language: lang,
    task,
    streamer,
  } as never)) as { text: string; chunks?: { timestamp: [number, number | null]; text: string }[] };
  const chunks: AsrChunk[] = (output.chunks ?? []).map((c) => ({
    start: c.timestamp[0] ?? 0,
    end: c.timestamp[1] ?? seconds,
    text: c.text,
  }));
  post({ type: "transcript", id, text: output.text, chunks, language: lang });
}

self.onmessage = async (e: MessageEvent<AiRequest>) => {
  const req = e.data;
  try {
    switch (req.type) {
      case "warm": {
        const { backend } = await load(req.model, req.id, req.backend);
        post({ type: "stage", id: req.id, stage: "ready", backend });
        break;
      }
      case "remove-background":
        await removeBackground(req.id, req.bitmap, req.backend);
        break;
      case "depth":
        await estimateDepth(req.id, req.bitmap, req.backend);
        break;
      case "upscale":
        await upscale(req.id, req.bitmap, req.scale, req.style, req.backend);
        break;
      case "transcribe":
        await transcribe(req.id, req.audio, req.model, req.language, req.task, req.backend);
        break;
    }
  } catch (err) {
    post({ type: "error", id: req.id, message: err instanceof Error ? err.message : String(err) });
  }
};
