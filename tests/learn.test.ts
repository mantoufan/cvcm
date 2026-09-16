import { describe, expect, it } from "vitest";
import { ALGO_SNIPPETS } from "../src/shared/learn";
import { LOCALES } from "../src/shared/locale";
import {
  TOOLS,
  TUTORIALS,
  FEATURED_TUTORIALS,
  appHref,
  isPublishedTutorial,
  learnHref,
  parseAppPath,
} from "../src/shared/path";
import {
  applyHtmlSeo,
  pageCanonical,
  pageTitle,
} from "../src/shared/seo";
import { buildSitemapXml, sitemapPages } from "../src/shared/sitemap";
import worker from "../src/worker";

const html = `<!doctype html>
<html lang="en">
  <head>
    <title>cv.cm</title>
    <meta name="description" content="old" />
    <link rel="canonical" href="https://cv.cm/" />
  </head>
  <body></body>
</html>`;

describe("learn routes", () => {
  it("parses the hub and keeps old lesson ids for redirects", () => {
    expect(parseAppPath("/en/learn/")).toEqual({ kind: "learn", locale: "en", tutorial: null });
    expect(parseAppPath("/zh-CN/learn/phone-photos/")).toEqual({
      kind: "learn",
      locale: "zh-CN",
      tutorial: "phone-photos",
    });
    expect(parseAppPath("/learn/pool-safety")).toEqual({
      kind: "bare-learn",
      tutorial: "pool-safety",
    });
    expect(learnHref("ja", null)).toBe("/ja/learn/");
    expect(learnHref("es", "one-page-site")).toBe("/es/learn/one-page-site/");
    expect(isPublishedTutorial("phone-photos")).toBe(false);
  });

  it("keeps tool routes unchanged", () => {
    expect(parseAppPath("/en/crop/")).toEqual({ kind: "app", locale: "en", tool: "crop" });
    expect(appHref("en", "crop")).toBe("/en/crop/");
  });
});

describe("learn SEO", () => {
  it("keeps the hub title while lessons are unpublished", () => {
    expect(pageTitle("en", { learn: true })).toMatch(/Simple illustrated tutorials/i);
    expect(pageCanonical("zh-CN", { learn: true })).toBe("https://cv.cm/zh-cn/learn/");
    const out = applyHtmlSeo(html, "en", { learn: true });
    expect(out).toContain("Simple illustrated tutorials");
    expect(out).toContain("https://cv.cm/en/learn/");
  });
});

describe("learn sitemap", () => {
  it("lists the hub in every locale and omits unpublished lessons", () => {
    const xml = buildSitemapXml("2026-09-13");
    const extra = 1 + FEATURED_TUTORIALS.length;
    expect(sitemapPages().length).toBe(LOCALES.length * (1 + TOOLS.length + extra));
    expect(xml).toContain("https://cv.cm/en/learn/");
    expect(xml).not.toContain("https://cv.cm/zh-cn/learn/phone-photos/");
    expect(xml).not.toContain("https://cv.cm/en/learn/algorithms/");
    expect(FEATURED_TUTORIALS).toHaveLength(0);
    expect(TUTORIALS.length).toBeGreaterThan(0);
  });
});

describe("learn worker", () => {
  it("redirects unpublished lesson URLs to the hub", async () => {
    const assets = {
      fetch: async () => new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
    };
    const page = await worker.fetch(new Request("https://cv.cm/en/learn/pool-safety/"), { ASSETS: assets });
    expect(page.status).toBe(301);
    expect(page.headers.get("Location")).toBe("https://cv.cm/en/learn/");

    const hub = await worker.fetch(new Request("https://cv.cm/en/learn/"), { ASSETS: assets });
    const body = await hub.text();
    expect(hub.status).toBe(200);
    expect(body).toContain("Simple illustrated tutorials");

    const bare = await worker.fetch(new Request("https://cv.cm/learn/phone-photos"), { ASSETS: assets });
    expect(bare.status).toBe(302);
    expect(bare.headers.get("Location")).toBe("https://cv.cm/en/learn/phone-photos/");
  });
});

it("keeps algorithm snippets executable for the next rewrite", () => {
  const twoSum = new Function(ALGO_SNIPPETS.twoSum + "\n; return twoSum;")();
  const binarySearch = new Function(ALGO_SNIPPETS.binarySearch + "\n; return binarySearch;")();
  const countdown = new Function(ALGO_SNIPPETS.countdown + "\n; return countdown;")();
  expect(twoSum([2, 7, 11, 15], 9)).toEqual([0, 1]);
  expect(twoSum([3, 3], 6)).toEqual([0, 1]);
  expect(twoSum([3], 6)).toBeNull();
  expect(binarySearch([1, 3, 4, 8, 12], 8)).toBe(3);
  expect(binarySearch([1, 3, 4, 8, 12], 7)).toBe(-1);
  expect(binarySearch([], 1)).toBe(-1);
  expect(binarySearch([8], 8)).toBe(0);
  expect(countdown(3)).toEqual([3, 2, 1]);
  expect(countdown(0)).toEqual([]);
});
