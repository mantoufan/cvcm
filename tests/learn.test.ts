import { describe, expect, it } from "vitest";
import { ALGO_SNIPPETS, TUTORIAL_DIAGRAMS, TUTORIAL_META, lessonsForTool, tutorialSteps } from "../src/shared/learn";
import { GAME_CONSOLES, GAMES } from "../src/shared/games";
import { LOCALES } from "../src/shared/locale";
import {
  CONVERT_JOBS,
  TOOLS,
  TUTORIALS,
  FEATURED_TUTORIALS,
  appHref,
  isPublishedTutorial,
  learnHref,
  parseAppPath,
} from "../src/shared/path";
import { localizedTutorialSrc } from "../src/shared/covers";
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
  it("links each published lesson back from its primary tool", () => {
    expect(lessonsForTool("qr")).toEqual(["make-qr"]);
    expect(lessonsForTool("convert")).toEqual([
      "heic-to-jpg",
      "webp-to-png",
      "png-to-jpg",
      "jpg-to-png",
      "avif-to-jpg",
      "png-to-webp",
    ]);
    expect(lessonsForTool("clip")).toEqual([]);
    expect(lessonsForTool("password")).toEqual(["make-password"]);
  });

  it("parses the hub, new lessons, and old ids", () => {
    expect(parseAppPath("/en/learn/")).toEqual({ kind: "learn", locale: "en", tutorial: null });
    expect(parseAppPath("/zh-CN/learn/make-qr/")).toEqual({
      kind: "learn",
      locale: "zh-CN",
      tutorial: "make-qr",
    });
    expect(parseAppPath("/en/learn/heic-to-jpg/")).toEqual({
      kind: "learn",
      locale: "en",
      tutorial: "heic-to-jpg",
    });
    expect(parseAppPath("/en/learn/png-to-jpg/")).toEqual({
      kind: "learn",
      locale: "en",
      tutorial: "png-to-jpg",
    });
    expect(parseAppPath("/zh-CN/learn/rotate-photo/")).toEqual({
      kind: "learn",
      locale: "zh-CN",
      tutorial: "rotate-photo",
    });
    expect(parseAppPath("/learn/pool-safety")).toEqual({
      kind: "bare-learn",
      tutorial: "pool-safety",
    });
    expect(learnHref("ja", "crop-photo")).toBe("/ja/learn/crop-photo/");
    expect(isPublishedTutorial("make-qr")).toBe(true);
    expect(isPublishedTutorial("phone-photos")).toBe(false);
  });

  it("keeps tool routes unchanged when a lesson reuses a tool id", () => {
    expect(parseAppPath("/en/merge-pdf/")).toEqual({ kind: "app", locale: "en", tool: "merge-pdf" });
    expect(parseAppPath("/en/learn/merge-pdf/")).toEqual({
      kind: "learn",
      locale: "en",
      tutorial: "merge-pdf",
    });
    expect(appHref("en", "crop")).toBe("/en/crop/");
    expect(parseAppPath("/en/split-pdf/")).toEqual({ kind: "app", locale: "en", tool: "split-pdf" });
    expect(parseAppPath("/en/learn/split-pdf/")).toEqual({
      kind: "learn",
      locale: "en",
      tutorial: "split-pdf",
    });
  });
});

describe("learn SEO", () => {
  it("titles a published how-to with the search query", () => {
    expect(pageTitle("en", { learn: true, tutorial: "heic-to-jpg" })).toMatch(/HEIC to JPG/i);
    expect(pageTitle("en", { learn: true, tutorial: "png-to-jpg" })).toMatch(/PNG to JPG/i);
    expect(pageTitle("zh-CN", { learn: true, tutorial: "rotate-photo" })).toMatch(/旋转/);
    expect(pageTitle("en", { learn: true, tutorial: "png-to-webp" })).toMatch(/PNG to WebP/i);
    expect(pageTitle("en", { learn: true, tutorial: "make-favicon" })).toMatch(/favicon/i);
    expect(pageTitle("en", { learn: true, tutorial: "make-signature" })).toMatch(/signature PNG/i);
    expect(pageTitle("en", { learn: true, tutorial: "make-password" })).toMatch(/strong password/i);
    expect(pageTitle("en", { learn: true, tutorial: "format-json" })).toMatch(/format JSON/i);
    expect(pageTitle("en", { learn: true, tutorial: "decode-base64" })).toMatch(/decode Base64/i);
    expect(pageTitle("en", { learn: true, tutorial: "unix-time" })).toMatch(/Unix timestamp/i);
    expect(pageTitle("zh-CN", { learn: true, tutorial: "read-jwt" })).toMatch(/JWT/);
    expect(pageTitle("en", { learn: true, tutorial: "count-workdays" })).toMatch(/business days/i);
    expect(pageTitle("en", { learn: true, tutorial: "simplify-fraction" })).toMatch(/fraction/i);
    expect(pageTitle("en", { learn: true, tutorial: "hourly-pay" })).toMatch(/hourly pay/i);
    expect(pageTitle("zh-CN", { learn: true, tutorial: "convert-timezone" })).toMatch(/时区/);
    expect(lessonsForTool("workdays")).toEqual(["count-workdays"]);
    expect(lessonsForTool("timezone")).toEqual(["convert-timezone"]);
    expect(pageTitle("en", { learn: true, tutorial: "profit-margin" })).toMatch(/profit margin/i);
    expect(pageTitle("en", { learn: true, tutorial: "convert-base" })).toMatch(/between bases/i);
    expect(pageTitle("en", { learn: true, tutorial: "add-duration" })).toMatch(/hours and minutes/i);
    expect(pageTitle("zh-CN", { learn: true, tutorial: "calculate-percent" })).toMatch(/百分比/);
    expect(lessonsForTool("margin")).toEqual(["profit-margin"]);
    expect(lessonsForTool("radix")).toEqual(["convert-base"]);
    expect(pageCanonical("zh-CN", { learn: true, tutorial: "make-qr" })).toBe(
      "https://cv.cm/zh-cn/learn/make-qr/",
    );
    const out = applyHtmlSeo(html, "en", { learn: true, tutorial: "merge-pdf" });
    expect(out).toContain("How to merge PDF");
    expect(out).toContain("application/ld+json");
    expect(out).toContain("HowTo");
  });

  it("keeps the hub title", () => {
    expect(pageTitle("en", { learn: true })).toMatch(/QR code|HEIC|tutorials/i);
  });
});

describe("learn sitemap", () => {
  it("lists published lessons and omits unpublished ones", () => {
    const xml = buildSitemapXml("2026-09-16");
    const extra = 1 + FEATURED_TUTORIALS.length + 1 + GAME_CONSOLES.length + GAMES.length;
    expect(sitemapPages().length).toBe(LOCALES.length * (1 + TOOLS.length + CONVERT_JOBS.length + extra));
    expect(xml).toContain("https://cv.cm/en/convert/heic-to-jpg/");
    expect(xml).toContain("https://cv.cm/zh-cn/convert/png-to-webp/");
    expect(FEATURED_TUTORIALS).toHaveLength(41);
    expect(xml).toContain("https://cv.cm/en/learn/make-qr/");
    expect(xml).toContain("https://cv.cm/en/learn/format-json/");
    expect(xml).toContain("https://cv.cm/zh-cn/learn/read-jwt/");
    expect(xml).toContain("https://cv.cm/zh-cn/learn/heic-to-jpg/");
    expect(xml).not.toContain("https://cv.cm/zh-cn/learn/phone-photos/");
    expect(xml).not.toContain("https://cv.cm/en/learn/algorithms/");
    expect(TUTORIALS).toContain("phone-photos");
  });
});

describe("learn worker", () => {
  it("serves published lessons and 301s unpublished ids to the hub", async () => {
    const assets = {
      fetch: async () => new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
    };
    const live = await worker.fetch(new Request("https://cv.cm/en/learn/make-qr/"), { ASSETS: assets });
    const liveBody = await live.text();
    expect(live.status).toBe(200);
    expect(liveBody).toMatch(/QR code/i);

    const old = await worker.fetch(new Request("https://cv.cm/en/learn/pool-safety/"), { ASSETS: assets });
    expect(old.status).toBe(301);
    expect(old.headers.get("Location")).toBe("https://cv.cm/en/learn/");
  });
});

it("places instructional diagrams on published lessons", () => {
  for (const id of FEATURED_TUTORIALS) {
    const diagrams = TUTORIAL_DIAGRAMS[id];
    expect(diagrams?.length, id).toBeGreaterThanOrEqual(2);
    expect(TUTORIAL_META[id].related.length, id).toBeGreaterThan(0);
    for (const diagram of diagrams!) {
      expect(diagram.step).toBeGreaterThan(0);
      expect(diagram.step).toBeLessThanOrEqual(tutorialSteps(id));
      const step = (howToJsonLd("en", id).step as { image?: string }[])[diagram.step - 1];
      expect(step.image).toBe(`https://cv.cm${diagram.src}`);
    }
  }
});

it("localizes instructional diagrams for Chinese HowTo JSON-LD", () => {
  expect(localizedTutorialSrc("/covers/tutorials/make-qr.svg", "en")).toBe("/covers/tutorials/make-qr.svg");
  expect(localizedTutorialSrc("/covers/tutorials/make-qr.svg", "zh-CN")).toBe("/covers/tutorials/zh-cn/make-qr.svg");
  const step = (howToJsonLd("zh-CN", "make-qr").step as { image?: string }[])[0];
  expect(step.image).toBe("https://cv.cm/covers/tutorials/zh-cn/make-qr-contents.svg");
  const out = applyHtmlSeo(html, "zh-CN", { learn: true, tutorial: "heic-to-jpg" });
  expect(out).toContain("/covers/tutorials/zh-cn/heic-to-jpg-why.svg");
});

it("gives each published lesson FAQ, HowTo, and a search-query title", () => {
  for (const id of FEATURED_TUTORIALS) {
    expect(learnFaqItems("en", id).length, id).toBe(5);
    expect(learnFaqItems("zh-CN", id).length, id).toBe(5);
    const title = pageTitle("en", { learn: true, tutorial: id });
    expect(title, id).toMatch(/How to /i);
    expect(title, id).toContain("cv.cm");
    const howto = howToJsonLd("en", id);
    expect(howto["@type"]).toBe("HowTo");
    expect((howto.step as unknown[]).length, id).toBe(tutorialSteps(id));
  }
});

it("keeps algorithm snippets executable", () => {
  const twoSum = new Function(ALGO_SNIPPETS.twoSum + "\n; return twoSum;")();
  expect(twoSum([2, 7, 11, 15], 9)).toEqual([0, 1]);
});
