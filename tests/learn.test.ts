import { describe, expect, it } from "vitest";
import { LEARN_COVER } from "../src/shared/covers";
import { ALGO_SNIPPETS, TUTORIAL_META, tutorialSteps } from "../src/shared/learn";
import { LOCALES } from "../src/shared/locale";
import {
  TOOLS,
  TUTORIALS,
  FEATURED_TUTORIALS,
  appHref,
  learnHref,
  parseAppPath,
} from "../src/shared/path";
import {
  applyHtmlSeo,
  howToJsonLd,
  learnFaqItems,
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
  it("parses the hub and a lesson", () => {
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
    expect(parseAppPath("/zh-CN/learn/healthy-boundaries/")).toEqual({
      kind: "learn",
      locale: "zh-CN",
      tutorial: "healthy-boundaries",
    });
    expect(learnHref("en", "healthy-boundaries")).toBe("/en/learn/healthy-boundaries/");
    expect(parseAppPath("/zh-CN/learn/read-character/")).toEqual({
      kind: "learn",
      locale: "zh-CN",
      tutorial: "read-character",
    });
    expect(learnHref("en", "read-character")).toBe("/en/learn/read-character/");
    expect(parseAppPath("/zh-CN/learn/portrait/")).toEqual({
      kind: "learn",
      locale: "zh-CN",
      tutorial: "portrait",
    });
    expect(learnHref("en", "algorithms")).toBe("/en/learn/algorithms/");
  });

  it("keeps tool routes unchanged", () => {
    expect(parseAppPath("/en/crop/")).toEqual({ kind: "app", locale: "en", tool: "crop" });
    expect(appHref("en", "crop")).toBe("/en/crop/");
  });
});

describe("learn SEO", () => {
  it("uses keyword titles and HowTo plus FAQ JSON-LD", () => {
    expect(pageTitle("en", { learn: true, tutorial: "phone-photos" })).toMatch(/phone photography/i);
    expect(pageTitle("en", { learn: true })).toMatch(/Photography and practical tutorials/i);
    expect(pageCanonical("zh-CN", { learn: true, tutorial: "pool-safety" })).toBe(
      "https://cv.cm/zh-CN/learn/pool-safety/",
    );
    for (const id of TUTORIALS) {
      expect(learnFaqItems("en", id).length, id).toBe(5);
      expect(TUTORIAL_META[id].minutes).toBeGreaterThan(5);
      expect(LEARN_COVER[id]).toContain("/covers/learn-");
      const how = howToJsonLd("en", id);
      expect(how["@type"]).toBe("HowTo");
      expect((how.step as unknown[]).length).toBe(tutorialSteps(id));
    }
    expect(tutorialSteps("portrait")).toBe(10);
    expect(howToJsonLd("en", "portrait").step).toHaveLength(10);
    expect(pageTitle("en", { learn: true, tutorial: "portrait" })).toMatch(/portrait photography practice/i);
    expect(pageTitle("en", { learn: true, tutorial: "algorithms" })).toMatch(/algorithms practice/i);
    const out = applyHtmlSeo(html, "en", { learn: true, tutorial: "phone-photos" });
    expect(out).toContain("phone photography practice");
    expect(out).toContain("HowTo");
    expect(out).toContain("FAQPage");
    expect(out).toContain("og:image");
    expect(out).toContain("https://cv.cm/en/learn/phone-photos/");
  });
});

describe("learn sitemap", () => {
  it("lists the hub and every lesson in every locale", () => {
    const xml = buildSitemapXml("2026-09-13");
    const extra = 1 + TUTORIALS.length;
    expect(sitemapPages().length).toBe(LOCALES.length * (1 + TOOLS.length + extra));
    expect(xml).toContain("https://cv.cm/en/learn/");
    expect(xml).toContain("https://cv.cm/zh-CN/learn/phone-photos/");
    expect(xml).toContain("https://cv.cm/es/learn/one-page-site/");
    expect(xml).toContain("https://cv.cm/zh-CN/learn/healthy-boundaries/");
    expect(xml).toContain("https://cv.cm/zh-CN/learn/portrait/");
    expect(xml).toContain("https://cv.cm/en/learn/algorithms/");
    expect(xml).toContain("https://cv.cm/zh-CN/learn/read-character/");
  });
});

describe("learn worker", () => {
  it("injects HowTo for a lesson URL and redirects a bare learn path", async () => {
    const assets = {
      fetch: async () => new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
    };
    const page = await worker.fetch(new Request("https://cv.cm/en/learn/pool-safety/"), { ASSETS: assets });
    const body = await page.text();
    expect(page.status).toBe(200);
    expect(body).toContain("Pool safety");
    expect(body).toContain("HowTo");
    expect(body).toContain("not a swimming course");

    const bare = await worker.fetch(new Request("https://cv.cm/learn/phone-photos"), { ASSETS: assets });
    expect(bare.status).toBe(302);
    expect(bare.headers.get("Location")).toBe("https://cv.cm/en/learn/phone-photos/");

    const mind = await worker.fetch(new Request("https://cv.cm/en/learn/healthy-boundaries/"), { ASSETS: assets });
    const mindBody = await mind.text();
    expect(mind.status).toBe(200);
    expect(mindBody).toContain("Healthy boundaries");
    expect(mindBody).toContain("Not therapy");

    const course = await worker.fetch(new Request("https://cv.cm/en/learn/portrait/"), { ASSETS: assets });
    const courseBody = await course.text();
    expect(course.status).toBe(200);
    expect(courseBody).toContain("portrait photography practice");
    expect(courseBody).toContain("HowTo");

    const read = await worker.fetch(new Request("https://cv.cm/en/learn/read-character/"), { ASSETS: assets });
    const readBody = await read.text();
    expect(read.status).toBe(200);
    expect(readBody).toContain("How to read people");
    expect(readBody).toContain("Not a verdict");
  });
});


describe("edited learning collection", () => {
  it("promotes six practical lessons while preserving older URLs", () => {
    expect(FEATURED_TUTORIALS).toHaveLength(6);
    expect(new Set(FEATURED_TUTORIALS).size).toBe(6);
    expect(FEATURED_TUTORIALS).not.toContain("read-character");
    expect(parseAppPath("/en/learn/read-character/").kind).toBe("learn");
  });

  it("executes the examples shown to readers, including edge cases", () => {
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
});
