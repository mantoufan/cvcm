import type { AiGroupId } from "./kb";
import type { ToolId } from "./path";

/** AI shelf: `/{locale}/learn/ai/{id}/`, copy in src/locales/kb/<locale>/<id>.json, names in the core packs (`kb.<id>`). */
export const AI_ARTICLES = [
  "what-is-generative-ai",
  "how-llms-work",
  "tokens-and-context-window",
  "ai-hallucination",
  "how-diffusion-models-work",
  "what-are-ai-agents",
  "ai-glossary",
  "prompt-engineering-basics",
  "image-prompts",
  "video-prompts",
  "camera-movement-terms",
  "storyboard-prompts",
  "text-to-image",
  "image-to-image",
  "consistent-ai-characters",
  "how-ai-upscaling-works",
  "how-ai-background-removal-works",
  "what-is-a-depth-map",
  "text-to-video",
  "image-to-video",
  "first-last-frame-video",
  "multi-shot-ai-video",
  "ai-short-drama-workflow",
  "how-speech-to-text-works",
  "text-to-speech",
  "run-ai-in-the-browser",
  "call-an-llm-api",
  "ai-copyright-and-commercial-use",
  "labeling-ai-content",
  "c2pa-and-ai-watermarks",
] as const;

export type AiId = (typeof AI_ARTICLES)[number];

export const AI_GROUPS: readonly { id: AiGroupId; articles: readonly AiId[] }[] = [
  { id: "basics", articles: ["what-is-generative-ai", "how-llms-work", "tokens-and-context-window", "ai-hallucination", "how-diffusion-models-work", "what-are-ai-agents", "ai-glossary"] },
  { id: "prompts", articles: ["prompt-engineering-basics", "image-prompts", "video-prompts", "camera-movement-terms", "storyboard-prompts"] },
  { id: "image", articles: ["text-to-image", "image-to-image", "consistent-ai-characters", "how-ai-upscaling-works", "how-ai-background-removal-works", "what-is-a-depth-map"] },
  { id: "video", articles: ["text-to-video", "image-to-video", "first-last-frame-video", "multi-shot-ai-video", "ai-short-drama-workflow"] },
  { id: "audio", articles: ["how-speech-to-text-works", "text-to-speech"] },
  { id: "dev", articles: ["run-ai-in-the-browser", "call-an-llm-api"] },
  { id: "trust", articles: ["ai-copyright-and-commercial-use", "labeling-ai-content", "c2pa-and-ai-watermarks"] },
];

/** Tools an AI article puts to work (first is its call to action); tool pages list these, so they ship with the ids. */
export const AI_ARTICLE_TOOLS: Partial<Record<AiId, readonly ToolId[]>> = {
  "what-is-generative-ai": ["ai-image-generator", "v", "speech-to-text"],
  "tokens-and-context-window": ["word-count"],
  "how-diffusion-models-work": ["ai-image-generator"],
  "image-prompts": ["ai-image-generator"],
  "video-prompts": ["v"],
  "camera-movement-terms": ["v"],
  "text-to-image": ["ai-image-generator", "image-upscaler"],
  "image-to-image": ["remove-background", "image-upscaler"],
  "how-ai-upscaling-works": ["image-upscaler"],
  "how-ai-background-removal-works": ["remove-background"],
  "what-is-a-depth-map": ["depth-map", "v"],
  "text-to-video": ["ai-image-generator", "v"],
  "image-to-video": ["v", "depth-map"],
  "how-speech-to-text-works": ["speech-to-text"],
  "text-to-speech": ["text-to-speech"],
  "run-ai-in-the-browser": ["remove-background", "speech-to-text", "ai-image-generator"],
  "call-an-llm-api": ["json"],
  "labeling-ai-content": ["watermark", "exif"],
  "ai-short-drama-workflow": ["speech-to-text"],
  "c2pa-and-ai-watermarks": ["watermark", "exif"],
};
