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

const shell = '<!doctype html><html lang="en"><head><title>cv.cm</title><meta name="description" content="x" /></head><body><div id="app"></div></body></html>';

function ssrAssets(fragments: Record<string, string>) {
  return {
    fetch: async (input: Request | string) => {
      const path = new URL(typeof input === "string" ? input : input.url).pathname;
      const body = fragments[path] ?? shell;
      return new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    },
  };
}

it("serves the prerendered body of a page inside its HTML", async () => {
  const res = await worker.fetch(new Request("https://cv.cm/en/tip/"), {
    ASSETS: ssrAssets({ "/_ssr/en/tip/": '<!--ssr--><div class="page"><h1>Tip $&amp; split $1</h1></div>' }),
  });
  expect(res.status).toBe(200);
  const html = await res.text();
  // A "$&" in page text must not be expanded by String.replace.
  expect(html).toContain('<div id="app"><div class="page"><h1>Tip $&amp; split $1</h1></div></div>');
  expect(html).not.toContain("<!--ssr-->");
});

it("falls back to the text copy when a page was not prerendered", async () => {
  const res = await worker.fetch(new Request("https://cv.cm/en/tip/"), { ASSETS: ssrAssets({}) });
  const html = await res.text();
  expect(html).toMatch(/<div id="app"><div class="page"><header class="top">/);
  expect(html).toContain("<h1>");
});

it("does not serve prerendered bodies on their own", async () => {
  const res = await worker.fetch(new Request("https://cv.cm/_ssr/en/tip/"), {
    ASSETS: ssrAssets({ "/_ssr/en/tip/": "<!--ssr--><div></div>" }),
  });
  expect(res.status).toBe(404);
});

it("never answers a page revalidation with index.html's validators", async () => {
  let sawConditional = false;
  const res = await worker.fetch(new Request("https://cv.cm/en/tip/", { headers: { "If-None-Match": '"abc"' } }), {
    ASSETS: {
      fetch: async (input: Request | string) => {
        if (typeof input !== "string" && input.headers.get("If-None-Match")) sawConditional = true;
        return new Response(shell, { headers: { "Content-Type": "text/html; charset=utf-8", ETag: '"abc"' } });
      },
    },
  });
  expect(sawConditional).toBe(false);
  expect(res.status).toBe(200);
  expect(res.headers.get("ETag")).toBeNull();
});

it("serves the IndexNow key file as a static file", async () => {
  const response = await worker.fetch(new Request("https://cv.cm/4972981e4cdf3fdd13b674ad85304c11.txt"), {
    ASSETS: { fetch: async () => new Response("4972981e4cdf3fdd13b674ad85304c11", { headers: { "Content-Type": "text/plain" } }) },
  });
  expect(response.status).toBe(200);
  expect(await response.text()).toBe("4972981e4cdf3fdd13b674ad85304c11");
});

it("moves old /zh URLs Google still crawls to their zh-cn pages", async () => {
  const cases: [string, string][] = [
    ["https://cv.cm/zh", "https://cv.cm/zh-cn/"],
    ["https://cv.cm/zh/terms", "https://cv.cm/zh-cn/terms/"],
    ["https://cv.cm/zh/privacy/", "https://cv.cm/zh-cn/privacy/"],
    ["https://cv.cm/zh-Hant/qr", "https://cv.cm/zh-tw/qr/"],
  ];
  for (const [from, to] of cases) {
    const res = await worker.fetch(new Request(from), { ASSETS: assets });
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe(to);
  }
  for (const gone of ["https://cv.cm/zh/pricing", "https://cv.cm/zh/register?next=%2Fzh", "https://cv.cm/pt"]) {
    expect((await worker.fetch(new Request(gone), { ASSETS: assets })).status).toBe(404);
  }
});
