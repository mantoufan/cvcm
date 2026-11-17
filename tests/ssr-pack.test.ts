import { describe, expect, it } from "vitest";
import { SSR_BUCKETS, encodePack, readPack, ssrBucket, ssrPackPath } from "../src/shared/ssr-pack";

describe("ssr packs", () => {
  it("round-trips bodies, multi-byte text included", () => {
    const entries: Array<[string, string]> = [
      ["/en/tip/", "<!--ssr--><h1>Tip $& split</h1>"],
      ["/zh-cn/games/mini/", "<!--ssr--><h1>免费小游戏</h1><p>纸牌接龙 🃏</p>"],
      ["/ko/typing-practice/", "<!--ssr--><h1>타자 연습</h1>"],
    ];
    const pack = encodePack(entries);
    for (const [path, body] of entries) expect(readPack(pack, path)).toBe(body);
    expect(readPack(pack, "/en/missing/")).toBeNull();
    expect(readPack(pack.buffer.slice(0) as ArrayBuffer, "/en/tip/")).toBe(entries[0]![1]);
  });

  it("rejects anything that is not a pack", () => {
    expect(readPack(new TextEncoder().encode("<!doctype html><html></html>"), "/en/tip/")).toBeNull();
    expect(readPack(new Uint8Array(0), "/en/tip/")).toBeNull();
  });

  it("names a stable bucket in range for every path", () => {
    expect(ssrBucket("/en/tip/")).toBe(ssrBucket("/en/tip/"));
    const seen = new Set<string>();
    for (let i = 0; i < 20000; i++) {
      const b = ssrBucket(`/en/page-${i}/`);
      expect(b).toMatch(/^[0-7][0-9a-f]{2}$/);
      expect(parseInt(b, 16)).toBeLessThan(SSR_BUCKETS);
      seen.add(b);
    }
    // 20,000 paths spread over (nearly) every bucket.
    expect(seen.size).toBeGreaterThan(SSR_BUCKETS * 0.99);
    expect(ssrPackPath("/en/tip/")).toBe(`/_ssr/${ssrBucket("/en/tip/")}.pack`);
  });
});
