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

/** Words that English prompts use and Spanish, Indonesian or Vietnamese ones do not ("a" and "en" are Spanish too). */
const ENGLISH_WORDS = /\b(the|an|in|on|at|with|and|of|from|under|over|by|is|are|for|wearing|holding|night|light|style)\b/i;

/** Share of the prompt's letters outside basic Latin: Chinese is all of them; "café" or "girl’s" barely any. */
function foreignShare(text: string): number {
  const letters = [...text].filter((c) => /\p{L}/u.test(c));
  if (!letters.length) return 0;
  return letters.filter((c) => c.charCodeAt(0) > 0x7f).length / letters.length;
}

/**
 * Whether a prompt needs translating to English before drawing. Text mostly in other scripts always does; Latin text does only
 * on pages whose language is written in Latin letters without them (Spanish, Indonesian, unaccented Vietnamese)
 * and only when it has no English words, so an English prompt on any page is drawn as typed.
 */
export function needsTranslation(text: string, locale: string): boolean {
  if (foreignShare(text) > 0.2) return true;
  return (locale === "es" || locale === "id" || locale === "vi") && !ENGLISH_WORDS.test(text);
}
