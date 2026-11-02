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

/** Languages a prompt can be drawn from: English as typed, Chinese via Janus, the rest via OPUS-MT. */
export const PROMPT_LANGS = ["en", "zh", "ja", "ko", "vi", "id", "es"] as const;
export type PromptLang = (typeof PROMPT_LANGS)[number];

/** Letters of Vietnamese beyond Latin-1 (ă â đ ê ô ơ ư and the tone marks of Latin Extended Additional). */
const VIETNAMESE = /[ăđĩũơưĂĐĨŨƠƯ\u1EA0-\u1EF9]/;

/**
 * The language to translate a prompt from. The script decides when it can (Hangul, kana, Chinese characters,
 * Vietnamese letters); Latin text counts as English unless the page is Spanish, Indonesian or Vietnamese and the
 * prompt has no English function words. Accents of English loanwords ("crème brûlée", "Pokémon") stay English.
 */
export function promptLanguage(text: string, locale: string): PromptLang {
  if (/\p{Script=Hangul}/u.test(text)) return "ko";
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) return "ja";
  if (/\p{Script=Han}/u.test(text)) return locale === "ja" ? "ja" : "zh";
  if (VIETNAMESE.test(text)) return "vi";
  if ((locale === "es" || locale === "id" || locale === "vi") && !looksEnglish(text)) return locale;
  return "en";
}
