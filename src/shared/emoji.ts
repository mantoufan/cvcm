/**
 * The emoji meanings channel under `/{locale}/emoji/` (hub: every covered emoji by Unicode group) and
 * `/{locale}/emoji/{slug}/` (one page per emoji, slug = the CLDR English short name, e.g. `loudly-crying-face`).
 * Data: Unicode emoji-test.txt and CLDR annotations (Unicode License v3), snapshotted by `node scripts/fetch-emoji.mjs`;
 * pages never call either at runtime.
 *
 * This module is in the main bundle (path parsing needs the slugs): keep it to slugs. Rows, names, keywords and the
 * usage sentences travel in the emoji pack (`src/locales/packs/emoji-<locale>.ts`).
 */
import { EMOJI_SLUGS, EMOJI_SNAPSHOT } from "./emoji-slugs";

export { EMOJI_SLUGS, EMOJI_SNAPSHOT };

export const EMOJI_SEGMENT = "emoji";

export type EmojiSlug = (typeof EMOJI_SLUGS)[number];

/** An emoji page: the hub, one emoji, or none. */
export type EmojiPage = EmojiSlug | "hub" | null;

/** The day the channel went live (datePublished, and the sitemap lastmod until the data or copy changes). */
export const EMOJI_PUBLISHED = "2026-11-18";

/** The last edit of the usage sentences in any locale (`src/locales/emoji/usage/`); bump it with every copy change. */
export const EMOJI_COPY_UPDATED = "2026-11-18";

export function isEmojiSlug(value: string): value is EmojiSlug {
  return (EMOJI_SLUGS as readonly string[]).includes(value);
}

/** Emoji the site footer links directly; labels are core-pack `emojiFocus.*` (the emoji, then its CLDR name). */
export const EMOJI_FOCUS = [
  "face-with-tears-of-joy",
  "red-heart",
  "loudly-crying-face",
  "skull",
  "pleading-face",
  "folded-hands",
  "fire",
  "thumbs-up",
] as const satisfies readonly EmojiSlug[];

/** Tool pages that link the emoji channel (the text tools people use to dress up messages). */
export const EMOJI_TOOLS = ["fancy-text"] as const;

/** The sitemap lastmod and dateModified: the latest of launch, data snapshot and usage copy edit. */
export function emojiUpdated(): string {
  return [EMOJI_PUBLISHED, EMOJI_SNAPSHOT, EMOJI_COPY_UPDATED].sort().at(-1)!;
}
