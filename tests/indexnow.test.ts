import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { INDEXNOW_KEY, changedUrls, indexNowBody, pageSignature, sitemapUrls } from "../scripts/indexnow.mjs";

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

it("signs what a search engine reads, not the build or the site-wide footer", () => {
  const page = (title: string, main: string, asset: string, footer: string): string =>
    `<html><head><title>${title}</title><meta\n name="description"\n content="d" /><link rel="canonical" href="https://cv.cm/en/json/" /><script type="module" src="/assets/index-${asset}.js"></script><script type="application/ld+json" id="faq-jsonld">{"a":1}</script></head><body><div id="app"><header class="top">nav</header><main id="main"><h1>${main}</h1><img src="/assets/pic-${asset}.svg"></main><footer class="foot">${footer}</footer></div></body></html>`;
  const base = pageSignature(page("JSON", "Format", "aaa", "170 tools"));
  // A new build (asset names) or a new tool in the footer directory is not a change to this page.
  expect(pageSignature(page("JSON", "Format", "bbb", "171 tools"))).toBe(base);
  expect(pageSignature(page("JSON formatter", "Format", "aaa", "170 tools"))).not.toBe(base);
  expect(pageSignature(page("JSON", "Format JSON", "aaa", "170 tools"))).not.toBe(base);
});
