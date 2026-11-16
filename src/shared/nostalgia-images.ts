import images from "./nostalgia-images.json";
import type { MemeImage } from "./meme-images";

/**
 * A nostalgia entry's picture: a freely licensed Wikimedia Commons file (public domain, CC0, CC BY or CC BY-SA, never
 * fair use), fitted to 640 px as WebP at `/covers/<src>` (s3.cv.cm files/covers/nostalgia/, copy in public/covers/).
 * Same shape and rules as the meme pictures.
 */
export type NostalgiaImage = MemeImage;

const NOSTALGIA_IMAGES: Partial<Record<string, NostalgiaImage>> = images satisfies Record<string, NostalgiaImage>;

/** Pictures do not depend on the language, so they are a static table, not part of the nostalgia packs. */
export function nostalgiaImage(id: string | null): NostalgiaImage | null {
  return id ? NOSTALGIA_IMAGES[id] ?? null : null;
}

/** Site path of an entry's picture (`/covers/nostalgia/<id>.webp`), or null; one place for the page, og:image and sitemap. */
export function nostalgiaImagePath(id: string | null): string | null {
  const image = nostalgiaImage(id);
  return image ? `/covers/${image.src}` : null;
}
