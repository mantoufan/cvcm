// Shared by scripts/make-thumbs.mjs and tests/thumbs.test.ts so the files built match thumbSrc() URLs.
export const THUMB_WIDTHS = [240, 640, 960];

const COVER_REF = /"(\/covers\/[A-Za-z0-9._/-]+\.(?:jpe?g|png))(?:\?v=(\d+))?"/g;

/** Every raster cover literal in src/shared/covers.ts: [{ path, v }]. */
export function coverRefs(source) {
  const refs = new Map();
  for (const [, path, v] of source.matchAll(COVER_REF)) refs.set(`${path}?v=${v ?? ""}`, { path, v: v ?? null });
  return [...refs.values()];
}

/** Published path of one thumbnail, e.g. /thumbs/160/games/contra.jpg.v1.webp. */
export function thumbFile(path, v, width) {
  return `/thumbs/${width}/${path.slice("/covers/".length)}${v ? `.v${v}` : ""}.webp`;
}
