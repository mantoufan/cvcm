import { expect, it } from "vitest";
import { THUMB_WIDTHS, thumbOriginal } from "../src/shared/covers";
import { STATIC_FILE } from "../src/shared/path";
import worker from "../src/worker";

// Pages no longer show covers, so no thumbnails are built. Old /thumbs/ URLs (cached pages, image search) go to the original.

it("maps a legacy thumb URL back to its versioned original", () => {
  expect(thumbOriginal("/thumbs/240/games/contra.jpg.v1.webp")).toBe("/covers/games/contra.jpg?v=1");
  expect(thumbOriginal("/thumbs/640/clip-sweet.jpg.webp")).toBe("/covers/clip-sweet.jpg");
  for (const w of THUMB_WIDTHS) expect(STATIC_FILE.test(`/thumbs/${w}/clip-sweet.jpg.webp`)).toBe(true);
});

it("rejects thumb paths that are not covers", () => {
  expect(thumbOriginal("/thumbs/240/../secret.jpg.webp")).toBeNull();
  expect(thumbOriginal("/thumbs/200/clip-sweet.jpg.webp")).toBeNull();
  expect(thumbOriginal("/thumbs/240/clip-sweet.webp")).toBeNull();
});

it("redirects a thumb to the versioned original", async () => {
  const response = await worker.fetch(new Request("https://cv.cm/thumbs/640/games/contra.jpg.v2.webp"), {
    ASSETS: {
      fetch: async () => new Response("<!doctype html>", { headers: { "Content-Type": "text/html" } }),
    },
  });
  expect(response.status).toBe(302);
  expect(response.headers.get("Location")).toBe("https://cv.cm/covers/games/contra.jpg?v=2");
});
