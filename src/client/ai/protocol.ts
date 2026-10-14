import type { AiBackend, AiModelId } from "../../shared/ai-models";

export type AsrChunk = { start: number; end: number; text: string };

/** Main thread → worker. `backend` forces a backend (tests, or a retry on the CPU after a GPU failure). */
export type AiRequest =
  | { type: "warm"; id: number; model: AiModelId; backend?: AiBackend }
  | { type: "remove-background"; id: number; bitmap: ImageBitmap; backend?: AiBackend }
  | { type: "depth"; id: number; bitmap: ImageBitmap; backend?: AiBackend }
  | { type: "upscale"; id: number; bitmap: ImageBitmap; scale: 2 | 4; style: "photo" | "anime"; backend?: AiBackend }
  | {
    type: "transcribe";
    id: number;
    audio: Float32Array;
    model: "whisper-base" | "whisper-small";
    language: string | null;
    task: "transcribe" | "translate";
    backend?: AiBackend;
  };

/** Worker → main thread. */
export type AiResponse =
  | { type: "progress"; id: number; loaded: number; total: number }
  | { type: "stage"; id: number; stage: "run" | "ready"; backend: AiBackend }
  | { type: "tiles"; id: number; done: number; total: number }
  | { type: "mask"; id: number; mask: Uint8ClampedArray<ArrayBuffer>; width: number; height: number }
  | { type: "image"; id: number; data: Uint8ClampedArray<ArrayBuffer>; width: number; height: number }
  | { type: "text"; id: number; text: string }
  | { type: "language"; id: number; language: string }
  | { type: "transcript"; id: number; text: string; chunks: AsrChunk[]; language: string }
  | { type: "error"; id: number; message: string };
