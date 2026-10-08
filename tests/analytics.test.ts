import { expect, it } from "vitest";
import { isTrackedPath } from "../src/shared/analytics";
import worker from "../src/worker";

it("tracks content pages but not file tools or clip notes", () => {
  for (const path of ["/en/", "/zh-cn/json/", "/en/games/", "/en/learn/watermark-id-copy/", "/en/device/ip/", "/en/clip/", "/en/gold/"]) {
    expect(isTrackedPath(path), path).toBe(true);
  }
  for (const path of ["/en/watermark/", "/zh-cn/mosaic/", "/en/merge-pdf/", "/en/invoice/", "/ja/exif/", "/en/convert/", "/en/clip/abc/", "/clip/x7k/", "/en/clip/abc123/"]) {
    expect(isTrackedPath(path), path).toBe(false);
  }
});

const assets = {
  fetch: async () => new Response("<!doctype html><html><head></head><body><div id=\"app\"></div></body></html>", {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  }),
};

it("allows the analytics hosts only on tracked pages", async () => {
  const tracked = await worker.fetch(new Request("https://cv.cm/en/json/"), { ASSETS: assets });
  const csp = tracked.headers.get("Content-Security-Policy") ?? "";
  expect(csp).toContain("script-src 'self' https://www.googletagmanager.com");
  expect(csp).toContain("https://*.google-analytics.com");

  const tool = await worker.fetch(new Request("https://cv.cm/en/watermark/"), { ASSETS: assets });
  const strict = tool.headers.get("Content-Security-Policy") ?? "";
  expect(strict).toContain("script-src 'self';");
  expect(strict).not.toContain("google");
});
