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
  /** Where the files come from when they are not on Hugging Face (the mirror's source, and dev without a mirror). */
  source?: string;
  variants: Record<AiBackend, AiVariant>;
};

/** Janus on a GPU without 16-bit floats (and the CPU entry): image_decode in fp32, the rest as on gpu16. */
const JANUS_FP32: AiVariant = {
  dtype: { prepare_inputs_embeds: "q8", language_model: "q4", lm_head: "q4", gen_head: "q4", gen_img_embeds: "q4", image_decode: "fp32" },
  files: [
    "onnx/prepare_inputs_embeds_quantized.onnx",
    "onnx/language_model_q4.onnx",
    "onnx/lm_head_q4.onnx",
    "onnx/gen_head_q4.onnx",
    "onnx/gen_img_embeds_q4.onnx",
    "onnx/image_decode.onnx",
  ],
  bytes: 523_040_991 + 779_633_963 + 131_072_477 + 23_669_258 + 3_205_586 + 170_460_651,
};

/**
 * OPUS-MT (Helsinki-NLP) <lang> → English, int8, for the image generator's prompts: Janus draws well only from
 * English, and its own translations were lossy (and copied a few-shot example) outside Chinese. Small
 * encoder–decoders that run on the CPU, one per language, downloaded only when a prompt in it is drawn.
 */
function opusMt(lang: string, revision: string, encoder: number, decoder: number, license = "Apache-2.0"): AiModel {
  const variant: AiVariant = {
    dtype: "q8",
    files: ["onnx/encoder_model_quantized.onnx", "onnx/decoder_model_merged_quantized.onnx"],
    bytes: encoder + decoder,
  };
  return {
    repo: `Xenova/opus-mt-${lang}-en`,
    revision,
    license,
    configs: ["config.json", "generation_config.json", "tokenizer.json", "tokenizer_config.json"],
    variants: { gpu16: variant, gpu: variant, cpu: variant },
  };
}

const TRIO_SHARDS = [1, 2, 3, 4, 5].map((i) => `group1-shard${i}of5`);
const TRIO_BYTES = 4 * 4_194_304 + 859_316;

const WHISPER_CONFIGS = [
  "config.json",
  "generation_config.json",
  "preprocessor_config.json",
  "tokenizer.json",
  "tokenizer_config.json",
] as const;

/** Long side of the copy the depth model's processor reads (it resizes to about 518 px itself). */
export const DEPTH_INPUT_MAX = 1536;

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
  // Janus-Pro-1B (DeepSeek Model License: royalty-free, commercial use allowed, with the use restrictions of its
  // Attachment A passed on to users). Text to a 384 × 384 image, 576 image tokens; prompts in other languages are
  // translated by OPUS-MT first. Choices that are not obvious:
  // - prepare_inputs_embeds also holds the image-understanding encoder, whose Conv fails on WebGPU even for
  //   text-only input: that session runs on the CPU (int8, once per prompt; JANUS_DEVICES).
  // - The q4 language model keeps fp32 activations, which the q4 heads expect; the q4f16 one emits fp16 hidden
  //   states that only the (larger) fp16 heads accept. lm_head (text answers) never runs here but is loaded.
  janus: {
    repo: "onnx-community/Janus-Pro-1B-ONNX",
    revision: "04efdf2e36cb07a034b0d94f7322356b292f0418",
    license: "DeepSeek Model License",
    configs: [
      "config.json",
      "generation_config.json",
      "preprocessor_config.json",
      "processor_config.json",
      "special_tokens_map.json",
      "tokenizer.json",
      "tokenizer_config.json",
    ],
    variants: {
      gpu16: {
        dtype: { prepare_inputs_embeds: "q8", language_model: "q4", lm_head: "q4", gen_head: "q4", gen_img_embeds: "q4", image_decode: "fp16" },
        files: [
          "onnx/prepare_inputs_embeds_quantized.onnx",
          "onnx/language_model_q4.onnx",
          "onnx/lm_head_q4.onnx",
          "onnx/gen_head_q4.onnx",
          "onnx/gen_img_embeds_q4.onnx",
          "onnx/image_decode_fp16.onnx",
        ],
        bytes: 523_040_991 + 779_633_963 + 131_072_477 + 23_669_258 + 3_205_586 + 85_297_169,
      },
      gpu: JANUS_FP32,
      // 576 sequential steps of a 1B model take many minutes on a CPU: the page asks for WebGPU instead.
      // Listed so the catalog stays complete.
      cpu: JANUS_FP32,
    },
  },
  // CC BY 4.0: credited on the page (FAQ) and in the agent docs.
  "opus-zh": opusMt("zh", "39d480d52a9ea3065a1f117adfe4dbc55de10e6f", 52_899_742, 60_212_804, "CC-BY-4.0"),
  "opus-ja": opusMt("ja", "1a906cfaaf7c8f4193f67f5885c082aa6dbd9d16", 50_705_822, 58_001_744),
  "opus-ko": opusMt("ko", "d9fa1ac6008242100fecb4fff9b0a5917a1be81f", 52_899_741, 60_212_803),
  "opus-vi": opusMt("vi", "541dfd72ec07e8f1563795e0224408ad8d729e80", 47_133_597, 54_401_611),
  "opus-id": opusMt("id", "c38ef36c843b71177da903442835c3c870975fd6", 47_674_782, 54_947_024),
  "opus-es": opusMt("es", "eadfd7c658a9d8929ac3b8e996b68a68e2c7d480", 52_899_742, 60_212_804),
  // Magenta MusicVAE trio_4bar (Apache-2.0): 4 bars of melody, bass and drums at once. TensorFlow.js weights from
  // Magenta's checkpoint bucket, pinned by the @magenta/music release that lists them (the bucket has no versions).
  trio: {
    repo: "magenta/music_vae-trio_4bar",
    revision: "v1.23.1",
    license: "Apache-2.0",
    source: "https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/trio_4bar",
    configs: ["config.json", "weights_manifest.json"],
    variants: {
      gpu16: { dtype: "fp32", files: TRIO_SHARDS, bytes: TRIO_BYTES },
      gpu: { dtype: "fp32", files: TRIO_SHARDS, bytes: TRIO_BYTES },
      cpu: { dtype: "fp32", files: TRIO_SHARDS, bytes: TRIO_BYTES },
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

/** Where each Janus session runs on a GPU backend (see the janus entry); on the CPU backend all run on wasm. */
export const JANUS_DEVICES = {
  prepare_inputs_embeds: "wasm",
  language_model: "webgpu",
  lm_head: "webgpu",
  gen_head: "webgpu",
  gen_img_embeds: "webgpu",
  image_decode: "webgpu",
} as const;

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
  const { source } = AI_MODELS[id] as AiModel;
  if (host) return `${new URL(host, origin).href}${repo}/${revision}/${file}`;
  return source ? `${source}/${file}` : `https://huggingface.co/${repo}/resolve/${revision}/${file}`;
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
