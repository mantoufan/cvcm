import { expect, it } from "vitest";
import { DEVICE_COVER, GAME_COVER, LEARN_COVER, MARKET_COVER, TOOL_COVER, thumbOriginal, thumbSrc, tileSrcset } from "../src/shared/covers";
import { readFileSync } from "node:fs";
import { STATIC_FILE } from "../src/shared/path";
import { THUMB_WIDTHS, coverRefs, thumbFile } from "../scripts/thumbs-lib.mjs";

const ALL = [...Object.values(TOOL_COVER), ...Object.values(GAME_COVER), ...Object.values(LEARN_COVER), ...Object.values(MARKET_COVER), DEVICE_COVER];

it("names thumbs by width and cover version", () => {
  expect(thumbSrc("/covers/games/contra.jpg?v=1", 160)).toBe("/thumbs/160/games/contra.jpg.v1.webp");
  expect(thumbSrc("/covers/clip-sweet.jpg", 640)).toBe("/thumbs/640/clip-sweet.jpg.webp");
  expect(tileSrcset("/covers/qr-sweet.jpg?v=2")).toBe("/thumbs/640/qr-sweet.jpg.v2.webp 640w, /thumbs/960/qr-sweet.jpg.v2.webp 960w");
});

it("leaves SVG covers alone", () => {
  expect(thumbSrc("/covers/tutorials/read-cron.svg", 160)).toBe("/covers/tutorials/read-cron.svg");
  expect(tileSrcset("/covers/tutorials/read-cron.svg")).toBeUndefined();
});

it("maps every cover's thumb back to its original and serves it as a static file", () => {
  for (const src of ALL) {
    const thumb = thumbSrc(src, 160);
    if (thumb === src) continue;
    expect(STATIC_FILE.test(thumb), thumb).toBe(true);
    expect(thumbOriginal(thumb), thumb).toBe(src);
  }
});

it("rejects thumb paths that are not covers", () => {
  expect(thumbOriginal("/thumbs/160/../secret.jpg.webp")).toBeNull();
  expect(thumbOriginal("/thumbs/200/clip-sweet.jpg.webp")).toBeNull();
  expect(thumbOriginal("/thumbs/160/clip-sweet.webp")).toBeNull();
});

it("builds a thumb file for every raster cover at the URL thumbSrc asks for", () => {
  const refs = coverRefs(readFileSync("src/shared/covers.ts", "utf8"));
  const built = new Set(refs.flatMap(({ path, v }) => THUMB_WIDTHS.map((w) => thumbFile(path, v, w))));
  for (const src of ALL) {
    for (const w of [160, 640, 960] as const) {
      const thumb = thumbSrc(src, w);
      if (thumb !== src) expect(built.has(thumb), `${src} @${w}`).toBe(true);
    }
  }
});
