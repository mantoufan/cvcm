import images from "./meme-images.json";

/**
 * A meme's picture: a freely licensed Wikimedia Commons file (public domain, CC0, CC BY or CC BY-SA, never fair use),
 * fitted to 640 px as WebP at `/covers/<src>` (s3.cv.cm files/covers/, copy in public/covers/). `author` is null when
 * the file page names none; `creatorType` says whether a named author is a person or an organisation.
 */
export type MemeImage = {
  src: string;
  width: number;
  height: number;
  author: string | null;
  /** "Person" or "Organization" (schema.org type); tests/slang.test.ts checks the value, JSON imports widen it to string. */
  creatorType: string | null;
  license: string;
  licenseUrl: string;
  page: string;
};

const MEME_IMAGES: Partial<Record<string, MemeImage>> = images satisfies Record<string, MemeImage>;

/** Pictures do not depend on the language, so they are a static table, not part of the slang packs. */
export function memeImage(id: string | null): MemeImage | null {
  return id ? MEME_IMAGES[id] ?? null : null;
}

/** Site path of a meme's picture (`/covers/memes/<id>-meme.webp`), or null; one place for the page, og:image and sitemap. */
export function memeImagePath(id: string | null): string | null {
  const image = memeImage(id);
  return image ? `/covers/${image.src}` : null;
}
