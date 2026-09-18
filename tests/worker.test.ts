import { expect, it } from "vitest";
import worker from "../src/worker";

const assets = {
  fetch: async () =>
    new Response("<!doctype html><title>cv.cm</title>", {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }),
};

it("serves PNG favicons instead of locale-redirecting them", async () => {
  const response = await worker.fetch(new Request("https://cv.cm/favicon-512.png"), {
    ASSETS: {
      fetch: async () =>
        new Response("png", { headers: { "Content-Type": "image/png" } }),
    },
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("image/png");
});

it("revalidates favicon.svg instead of caching the previous icon for a day", async () => {
  const response = await worker.fetch(new Request("https://cv.cm/favicon.svg"), {
    ASSETS: {
      fetch: async () =>
        new Response("<svg/>", { headers: { "Content-Type": "image/svg+xml" } }),
    },
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-cache");
});

it("keeps search on tool locale redirects", async () => {
  const bare = await worker.fetch(new Request("https://cv.cm/crop/?lens=85"), { ASSETS: assets });
  expect(bare.status).toBe(302);
  expect(bare.headers.get("Location")).toBe("https://cv.cm/en/crop/?lens=85");

  const slash = await worker.fetch(new Request("https://cv.cm/en/crop?x=1"), { ASSETS: assets });
  expect(slash.status).toBe(301);
  expect(slash.headers.get("Location")).toBe("https://cv.cm/en/crop/?x=1");
});

it("allows same-origin workers for in-tab PDF rendering", async () => {
  const response = await worker.fetch(new Request("https://cv.cm/favicon.svg"), {
    ASSETS: {
      fetch: async () =>
        new Response("<svg/>", { headers: { "Content-Type": "image/svg+xml" } }),
    },
  });
  expect(response.headers.get("Content-Security-Policy")).toContain("worker-src 'self' blob:");
});
