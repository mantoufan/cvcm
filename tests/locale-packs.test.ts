import { afterEach, expect, it, vi } from "vitest";
import { hasMessages, messages } from "../src/shared/messages";
import { LOCALES } from "../src/shared/locale";
import worker, { preloadLocalePack } from "../src/worker";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("registers every locale for the Worker", () => {
  for (const locale of LOCALES) {
    expect(hasMessages(locale)).toBe(true);
    expect(messages(locale).ui.brand).toBeTruthy();
  }
});

it("leaves HTML alone when no pack map was built in", () => {
  expect(preloadLocalePack("<head></head>", "ja")).toBe("<head></head>");
});

it("preloads the page locale's pack and its imports", async () => {
  vi.stubGlobal("__LOCALE_PACKS__", { "zh-CN": ["/assets/zh-CN-abc.js", "/assets/shared-def.js"], en: ["/assets/en-xyz.js"] });
  const response = await worker.fetch(new Request("https://cv.cm/zh-cn/json/"), {
    ASSETS: {
      fetch: async () =>
        new Response("<!doctype html><html><head><title>cv.cm</title></head><body></body></html>", {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }),
    },
  });
  const html = await response.text();
  expect(html).toContain('<link rel="modulepreload" crossorigin href="/assets/zh-CN-abc.js">');
  expect(html).toContain('<link rel="modulepreload" crossorigin href="/assets/shared-def.js">');
  expect(html).not.toContain("en-xyz");
});
