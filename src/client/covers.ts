import { thumbSrc as builtThumbSrc, tileSrcset as builtTileSrcset, type ThumbWidth } from "../shared/covers";

/** `sizes` for tile covers, matching .tiles: 3 columns in the 1080px column, 2 on tablets, 1 on phones. */
export const TILE_SIZES = "(min-width: 961px) 360px, (min-width: 641px) 50vw, 100vw";

// Thumbnails exist only in a build (scripts/make-thumbs.mjs); the Vite dev server shows the originals.
export function thumbSrc(src: string, width: ThumbWidth): string {
  return import.meta.env.DEV ? src : builtThumbSrc(src, width);
}

export function tileSrcset(src: string): string | undefined {
  return import.meta.env.DEV ? undefined : builtTileSrcset(src);
}

export {
  TOOL_COVER as COVER,
  GAME_COVER,
  LEARN_COVER,
  MARKET_COVER,
  LEARN_FIG,
  LEARN_HERO,
  DEVICE_COVER,
  localizedTutorialSrc,
} from "../shared/covers";
