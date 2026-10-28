import { AI_MODELS, modelFileUrl, type AiBackend, type AiModelId } from "../../shared/ai-models";
import { detectBackend } from "./gpu";
import { CACHE_NAME, MODEL_HOST } from "./host";
import type { AiRequest, AiResponse } from "./protocol";

type Handlers = {
  /** Model download progress, in bytes across all of the model's files. */
  onProgress?: (loaded: number, total: number) => void;
  /** The model is in memory; inference starts. */
  onRun?: (backend: AiBackend) => void;
  /** Work units done (upscale tiles, speech windows). */
  onTiles?: (done: number, total: number) => void;
  /** Streamed transcript text. */
  onText?: (text: string) => void;
  /** The spoken language Whisper detected (or was told). */
  onLanguage?: (code: string) => void;
};

type Pending = Handlers & {
  resolve: (msg: AiResponse) => void;
  reject: (err: Error) => void;
};

/** Distributive Omit, so each request keeps its own fields. */
type Body<T> = T extends unknown ? Omit<T, "id"> : never;

/** One worker per tool page. It is created on first use, so a page view that never starts a job costs nothing. */
export class AiClient {
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, Pending>();

  private ensure(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module", name: "cvcm-ai" });
    worker.onmessage = (e: MessageEvent<AiResponse>) => this.onMessage(e.data);
    worker.onerror = (e) => {
      e.preventDefault();
      this.failAll(new Error(e.message || "worker"));
    };
    this.worker = worker;
    return worker;
  }

  private onMessage(msg: AiResponse): void {
    const job = this.pending.get(msg.id);
    if (!job) return;
    switch (msg.type) {
      case "progress":
        job.onProgress?.(msg.loaded, msg.total);
        return;
      case "stage":
        if (msg.stage === "run") {
          job.onRun?.(msg.backend);
          return;
        }
        break;
      case "tiles":
        job.onTiles?.(msg.done, msg.total);
        return;
      case "text":
        job.onText?.(msg.text);
        return;
      case "language":
        job.onLanguage?.(msg.language);
        return;
      case "error":
        this.pending.delete(msg.id);
        job.reject(new Error(msg.message));
        return;
    }
    this.pending.delete(msg.id);
    job.resolve(msg);
  }

  private failAll(err: Error): void {
    for (const job of this.pending.values()) job.reject(err);
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
  }

  /** Sends one job; resolves with its final message (mask, image, transcript, or ready). */
  run(body: Body<AiRequest>, handlers: Handlers = {}, transfer: Transferable[] = []): Promise<AiResponse> {
    const worker = this.ensure();
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { ...handlers, resolve, reject });
      worker.postMessage({ ...body, id } as AiRequest, transfer);
    });
  }

  /** Stops any running job and frees the model's memory (GPU buffers included). */
  dispose(): void {
    this.failAll(new Error("cancelled"));
  }
}

let backendGuess: Promise<AiBackend> | null = null;

/** The backend the worker will pick, for the size label before anything loads. Same test as the worker's. */
export function guessBackend(): Promise<AiBackend> {
  backendGuess ??= detectBackend(navigator);
  return backendGuess;
}

/** Whether every ONNX file of this variant is already in the browser cache (the next run starts offline). */
export async function isModelCached(id: AiModelId, backend: AiBackend): Promise<boolean> {
  try {
    if (typeof caches === "undefined") return false;
    const cache = await caches.open(CACHE_NAME);
    const files = AI_MODELS[id].variants[backend].files;
    const hits = await Promise.all(files.map((f) => cache.match(modelFileUrl(id, f, MODEL_HOST, location.origin))));
    return hits.every(Boolean);
  } catch {
    return false;
  }
}

/** Ask the browser not to evict the downloaded weights under storage pressure. */
export function persistStorage(): void {
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* not supported */
  }
}
