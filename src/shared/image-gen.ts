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

/**
 * Function words of English that Spanish, Indonesian and plain-ASCII Vietnamese do not use ("a", "an", "en" do
 * occur there). Loanwords like "style" or "light" turn up in any language's prompt, so they are not listed.
 */
const ENGLISH_WORDS = /\b(the|in|on|at|with|and|of|from|under|over|by|is|are|for|wearing|holding)\b/gi;

function looksEnglish(text: string): boolean {
  return new Set((text.match(ENGLISH_WORDS) ?? []).map((w) => w.toLowerCase())).size >= 2;
}

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
  if (foreignShare(text) >= 0.1) return true;
  return (locale === "es" || locale === "id" || locale === "vi") && !looksEnglish(text);
}
