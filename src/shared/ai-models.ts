/**
 * Models behind the AI tools. Weights are mirrored from Hugging Face at a pinned revision to
 * s3.cv.cm `files/ai/models/{repo}/` (scripts/mirror-ai-models.mjs) and served same-origin at `/ai/models/`.
 * Hugging Face is not reachable from mainland China, and same-origin keeps the CSP closed.
 */

/** How the model runs: WebGPU with 16-bit floats, WebGPU without them, or WebAssembly on the CPU. */
export type AiBackend = "gpu16" | "gpu" | "cpu";

export type AiVariant = {
  /** Transformers.js dtype: one for the whole model, or one per ONNX session. */
  dtype: string | Record<string, string>;
  /** ONNX files this variant downloads, relative to the repo root. */
  files: readonly string[];
  /** Total download in bytes (configs excluded), shown before the visitor starts. */
  bytes: number;
};

export type AiModel = {
  repo: string;
  revision: string;
  license: string;
  /** Small JSON / tokenizer files every variant needs. */
  configs: readonly string[];
  variants: Record<AiBackend, AiVariant>;
};

const WHISPER_CONFIGS = [
  "config.json",
  "generation_config.json",
  "preprocessor_config.json",
  "tokenizer.json",
  "tokenizer_config.json",
] as const;

export const AI_MODELS = {
  // BiRefNet lite (MIT), re-exported from ZhengPeng7/BiRefNet_lite with ONNX's native DeformConv
  // (scripts/ai/export-birefnet.py). The public ONNX export unrolls deformable convolution into GatherND
  // chains that need over 4 GB at 1024 px; the native op runs in a fraction of the memory and time.
  birefnet: {
    repo: "cvcm/birefnet-lite-1024",
    revision: "aa62cd87eafb9cc43056d08ef3615a14628b831d",
    license: "MIT",
    configs: ["config.json", "preprocessor_config.json"],
    variants: {
      gpu16: { dtype: "fp16", files: ["onnx/model_fp16.onnx"], bytes: 101_615_014 },
      gpu: { dtype: "fp32", files: ["onnx/model.onnx"], bytes: 180_826_341 },
      // The CPU runs the fp16 file about as fast as fp32 and downloads 80 MB less.
      cpu: { dtype: "fp16", files: ["onnx/model_fp16.onnx"], bytes: 101_615_014 },
    },
  },
  depth: {
    repo: "onnx-community/depth-anything-v2-small",
    revision: "4472b7362082ad9968fee890ca0f1e5aca36b93d",
    license: "Apache-2.0",
    configs: ["config.json", "preprocessor_config.json"],
    variants: {
      gpu16: { dtype: "fp16", files: ["onnx/model_fp16.onnx"], bytes: 49_642_442 },
      gpu: { dtype: "fp32", files: ["onnx/model.onnx"], bytes: 99_060_839 },
      cpu: { dtype: "q8", files: ["onnx/model_quantized.onnx"], bytes: 27_258_801 },
    },
  },
  // Real-ESRGAN's compact SRVGGNet (BSD-3-Clause), exported by scripts/ai/export-realesrgan.py. Swin2SR was
  // tried first: seconds per 192 px tile on WebGPU, where this runs a tile in tens of milliseconds.
  "esrgan-photo": {
    repo: "cvcm/realesrgan-general-x4v3",
    revision: "v0.2.5.0",
    license: "BSD-3-Clause",
    configs: ["config.json"],
    variants: {
      gpu16: { dtype: "fp16", files: ["onnx/model_fp16.onnx"], bytes: 2_445_084 },
      gpu: { dtype: "fp32", files: ["onnx/model.onnx"], bytes: 4_866_457 },
      cpu: { dtype: "fp32", files: ["onnx/model.onnx"], bytes: 4_866_457 },
    },
  },
  "esrgan-anime": {
    repo: "cvcm/realesrgan-anime-x4v3",
    revision: "v0.2.5.0",
    license: "BSD-3-Clause",
    configs: ["config.json"],
    variants: {
      gpu16: { dtype: "fp16", files: ["onnx/model_fp16.onnx"], bytes: 1_253_243 },
      gpu: { dtype: "fp32", files: ["onnx/model.onnx"], bytes: 2_492_937 },
      cpu: { dtype: "fp32", files: ["onnx/model.onnx"], bytes: 2_492_937 },
    },
  },
  "whisper-base": {
    repo: "onnx-community/whisper-base",
    revision: "1846881b6b3a3024392c1eea3ad983695bc23925",
    license: "Apache-2.0",
    configs: WHISPER_CONFIGS,
    variants: {
      gpu16: {
        dtype: { encoder_model: "fp32", decoder_model_merged: "fp16" },
        files: ["onnx/encoder_model.onnx", "onnx/decoder_model_merged_fp16.onnx"],
        bytes: 82_468_078 + 104_727_818,
      },
      gpu: {
        dtype: { encoder_model: "fp32", decoder_model_merged: "q4" },
        files: ["onnx/encoder_model.onnx", "onnx/decoder_model_merged_q4.onnx"],
        bytes: 82_468_078 + 123_602_419,
      },
      cpu: {
        dtype: { encoder_model: "fp32", decoder_model_merged: "q8" },
        files: ["onnx/encoder_model.onnx", "onnx/decoder_model_merged_quantized.onnx"],
        bytes: 82_468_078 + 53_693_315,
      },
    },
  },
  "whisper-small": {
    repo: "onnx-community/whisper-small",
    revision: "36050c46d777d46dc4b5f43f6d90574fc38f8732",
    license: "Apache-2.0",
    configs: WHISPER_CONFIGS,
    variants: {
      gpu16: {
        dtype: { encoder_model: "fp16", decoder_model_merged: "q4" },
        files: ["onnx/encoder_model_fp16.onnx", "onnx/decoder_model_merged_q4.onnx"],
        bytes: 176_607_756 + 233_149_327,
      },
      gpu: {
        dtype: { encoder_model: "fp32", decoder_model_merged: "q4" },
        files: ["onnx/encoder_model.onnx", "onnx/decoder_model_merged_q4.onnx"],
        bytes: 352_825_870 + 233_149_327,
      },
      cpu: {
        dtype: { encoder_model: "q8", decoder_model_merged: "q8" },
        files: ["onnx/encoder_model_quantized.onnx", "onnx/decoder_model_merged_quantized.onnx"],
        bytes: 92_326_160 + 156_750_845,
      },
    },
  },
} as const satisfies Record<string, AiModel>;

export type AiModelId = keyof typeof AI_MODELS;

/** Same-origin path the Worker proxies to s3.cv.cm. */
export const AI_MODEL_PREFIX = "/ai/models/";
/** ONNX Runtime's WebAssembly build, mirrored next to the models (the .wasm is over Pages' 25 MiB file limit). */
export const AI_ORT_PREFIX = "/ai/ort/";

/**
 * URL of one model file: under `host` (the /ai/models/ mirror, or a dev mirror) as {repo}/{revision}/{file},
 * else Hugging Face itself. Transformers.js caches under the same URL, so the page can check the cache with it.
 */
export function modelFileUrl(id: AiModelId, file: string, host: string | null | undefined, origin: string): string {
  const { repo, revision } = AI_MODELS[id];
  return host
    ? `${new URL(host, origin).href}${repo}/${revision}/${file}`
    : `https://huggingface.co/${repo}/resolve/${revision}/${file}`;
}

export function modelBytes(id: AiModelId, backend: AiBackend): number {
  return AI_MODELS[id].variants[backend].bytes;
}

/** Every file to mirror for a model: configs plus each variant's ONNX files, once each. */
export function mirrorFiles(id: AiModelId): string[] {
  const model: AiModel = AI_MODELS[id];
  const onnx = Object.values(model.variants).flatMap((v) => v.files);
  return [...new Set([...model.configs, ...onnx])];
}

/** Megabytes for the download label, rounded the way people read them. */
export function formatMb(bytes: number): string {
  const mb = bytes / 1_000_000;
  return mb >= 100 ? `${Math.round(mb)} MB` : `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}
