import { describe, expect, it } from "vitest";
import worker from "../src/worker";

const SHELL = `<!doctype html><html lang="en"><head><title>cv.cm</title><meta name="description" content="x" /><link rel="canonical" href="https://cv.cm/" /></head><body><div id="app"></div></body></html>`;
const assets = { fetch: async () => new Response(SHELL, { headers: { "Content-Type": "text/html; charset=utf-8" } }) };
const get = (path: string, headers: Record<string, string> = {}): Promise<Response> => worker.fetch(new Request(`https://cv.cm${path}`, { headers }), { ASSETS: assets });

describe("removed channels", () => {
  it("answers 410 Gone, noindex, for every Summaries URL, with a link home in the page's locale", async () => {
    for (const path of ["/en/summaries/", "/en/summaries", "/zh-cn/summaries/hamlet/", "/ja/summaries/attack-on-titan", "/summaries/", "/summaries", "/summaries/hamlet/", "/EN/Summaries/Hamlet/", "/SUMMARIES/", "/summaries/summaries/", "/sitemaps/summaries.xml"]) {
      const res = await get(path, { "Accept-Language": "en" });
      expect(res.status, path).toBe(410);
      expect(res.headers.get("X-Robots-Tag"), path).toBe("noindex");
      expect(res.headers.get("Location"), path).toBeNull();
      expect(await res.text(), path).toContain('<meta name="robots" content="noindex">');
    }
    expect(await (await get("/zh-cn/summaries/hamlet/")).text()).toContain('href="/zh-cn/"');
    expect(await (await get("/summaries/", { "Accept-Language": "ja" })).text()).toContain('href="/ja/"');
    const head = await worker.fetch(new Request("https://cv.cm/en/summaries/hamlet/", { method: "HEAD" }), { ASSETS: assets });
    expect(head.status).toBe(410);
    expect(await head.text()).toBe("");
  });

  it("leaves other pages alone", async () => {
    expect((await get("/en/nostalgia/")).status).toBe(200);
    // Only the channel segment: a word that merely contains it, or a deeper segment, is not the removed channel.
    expect((await get("/en/summaries-tool/")).status).not.toBe(410);
    expect((await get("/en/learn/summaries/")).status).not.toBe(410);
  });
});
