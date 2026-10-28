import { AI_MODEL_PREFIX } from "../../shared/ai-models";

/** Where models load from: the /ai/models/ mirror, or in dev Hugging Face unless VITE_AI_MODEL_HOST names a local mirror. */
export const MODEL_HOST: string | undefined = import.meta.env.DEV ? import.meta.env.VITE_AI_MODEL_HOST : AI_MODEL_PREFIX;

/** Transformers.js's Cache API store. The worker keeps the files it fetches itself (Real-ESRGAN) there too. */
export const CACHE_NAME = "transformers-cache";
