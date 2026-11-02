/** Options of the AI image generator (`/ai-image-generator/`), shared by the page and the agent docs. */

export const IMAGE_STYLES = ["none", "photo", "anime", "watercolor", "3d"] as const;
export type ImageStyle = (typeof IMAGE_STYLES)[number];

/** Appended to the prompt after translation, in English: the model follows English style words most reliably. */
export const IMAGE_STYLE_SUFFIX: Record<ImageStyle, string> = {
  none: "",
  photo: ", realistic photo, natural light, high detail",
  anime: ", anime illustration, clean line art, soft colors",
  watercolor: ", watercolor painting, soft edges, paper texture",
  "3d": ", 3D render, soft studio lighting, clay style",
};

export const IMAGE_COUNTS = [1, 2, 4] as const;
export type ImageCount = (typeof IMAGE_COUNTS)[number];

/** Output long side: the model draws 384 px; 768 and 1536 run Real-ESRGAN on the result. */
export const IMAGE_SIZES = [384, 768, 1536] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];

export const PROMPT_MAX = 500;

/** Letters outside basic Latin: Chinese, Japanese, Korean, Vietnamese, accented Spanish… */
const NON_ASCII = /[^\x00-\x7F]/;
/** Words that only English prompts use (Spanish and Indonesian prompts in plain ASCII have none of them). */
const ENGLISH_WORDS = /\b(the|with|and|of|from|under|over|by|wearing|holding)\b/i;

/**
 * Whether a prompt needs translating to English before drawing. Non-ASCII text always does; plain ASCII does only
 * on pages whose language is written in Latin letters without them (Spanish, Indonesian, unaccented Vietnamese)
 * and only when it has no English words, so an English prompt on any page is drawn as typed.
 */
export function needsTranslation(text: string, locale: string): boolean {
  if (NON_ASCII.test(text)) return true;
  return (locale === "es" || locale === "id" || locale === "vi") && !ENGLISH_WORDS.test(text);
}
