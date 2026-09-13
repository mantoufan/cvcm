import { expect, it } from "vitest";
import worker from "../src/worker";

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

it("allows same-origin workers for in-tab PDF rendering", async () => {
  const response = await worker.fetch(new Request("https://cv.cm/favicon.svg"), {
    ASSETS: {
      fetch: async () =>
        new Response("<svg/>", { headers: { "Content-Type": "image/svg+xml" } }),
    },
  });
  expect(response.headers.get("Content-Security-Policy")).toContain("worker-src 'self' blob:");
});
