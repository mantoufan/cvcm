import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { INDEXNOW_KEY, changedUrls, indexNowBody, sitemapUrls } from "../scripts/indexnow.mjs";

it("reads every loc of a sitemap", () => {
  const xml = `<urlset><url><loc>https://cv.cm/en/</loc><xhtml:link rel="alternate" hreflang="ja" href="https://cv.cm/ja/"/></url><url><loc> https://cv.cm/en/json/ </loc></url></urlset>`;
  expect(sitemapUrls(xml)).toEqual(["https://cv.cm/en/", "https://cv.cm/en/json/"]);
});

it("submits everything the first time, then only what changed", () => {
  const next = { "https://cv.cm/en/": "a", "https://cv.cm/en/json/": "b", "https://cv.cm/en/new/": "c" };
  expect(changedUrls(null, next)).toEqual(Object.keys(next));
  const previous = { "https://cv.cm/en/": "a", "https://cv.cm/en/json/": "old", "https://cv.cm/en/gone/": "d" };
  // Changed and new pages, then the removed one so engines drop it.
  expect(changedUrls(previous, next)).toEqual(["https://cv.cm/en/json/", "https://cv.cm/en/new/", "https://cv.cm/en/gone/"]);
  expect(changedUrls(next, next)).toEqual([]);
});

it("names the key file the site serves", () => {
  const body = indexNowBody(["https://cv.cm/en/"]);
  expect(body.host).toBe("cv.cm");
  expect(body.keyLocation).toBe(`https://cv.cm/${INDEXNOW_KEY}.txt`);
  expect(existsSync(resolve(__dirname, "../public", `${INDEXNOW_KEY}.txt`))).toBe(true);
});
