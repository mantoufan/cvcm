import { describe, expect, it } from "vitest";
import "../src/shared/kb-code-meta";
import "../src/shared/kb-ai-meta";
import { LOCALES } from "../src/shared/locale";
import {
  isRecordableQuery,
  isValidEmail,
  nameFromTitle,
  normalizeQuery,
  searchEntries,
  SEARCH_CHANNELS,
  type SearchEntry,
} from "../src/shared/search";
import { buildAllSearchIndexes } from "../src/shared/search-index";
import { sitemapPages } from "../src/shared/sitemap";
import { handleSearchApi, SEARCH_EMAIL_RATE_MAX, SEARCH_MISS_MAX, type SearchStore } from "../src/search-api";
import worker from "../src/worker";

const indexes = buildAllSearchIndexes();
const names = (entries: SearchEntry[]) => entries.map((e) => e[2]);

describe("search index", () => {
  it("lists every sitemap page except home and legal, once, in every locale", () => {
    const expected = sitemapPages().filter((p) => p.locale === "en" && p.kind !== "home" && p.kind !== "legal").length;
    for (const locale of LOCALES) {
      const entries = indexes[locale];
      expect(entries.length).toBe(expected);
      expect(new Set(entries.map((e) => e[1])).size).toBe(entries.length);
      for (const [channel, href, name, blurb] of entries) {
        expect(SEARCH_CHANNELS).toContain(channel);
        expect(href.startsWith(`/${locale.toLowerCase()}/`)).toBe(true);
        expect(name.length).toBeGreaterThan(0);
        expect(name).not.toMatch(/cv\.cm$/);
        expect(blurb.length).toBeLessThanOrEqual(110);
      }
    }
  });

  it("names channel hubs after the channel and keeps English names as keywords", () => {
    const zh = indexes["zh-CN"];
    expect(zh.find((e) => e[1] === "/zh-cn/rankings/")?.[2]).toBe("排行榜");
    expect(zh.find((e) => e[1] === "/zh-cn/merge-pdf/")?.[4]).toBe("Merge PDF");
    expect(indexes.en.every((e) => e.length === 4)).toBe(true);
  });
});

describe("searchEntries", () => {
  const zh = indexes["zh-CN"];
  const en = indexes.en;

  it("finds tools by local name, with or without spaces between scripts", () => {
    expect(names(searchEntries(zh, "合并pdf"))[0]).toBe("合并 PDF");
    expect(names(searchEntries(zh, "pdf 合并"))[0]).toBe("合并 PDF");
    expect(names(searchEntries(zh, "房贷"))[0]).toBe("房贷计算器");
  });

  it("finds pages by their English name in other locales", () => {
    expect(names(searchEntries(zh, "merge pdf"))[0]).toBe("合并 PDF");
  });

  it("puts an exact name first and channel hubs on their own name", () => {
    expect(names(searchEntries(en, "merge pdf"))[0]).toBe("Merge PDF");
    expect(searchEntries(zh, "排行榜")[0][1]).toBe("/zh-cn/rankings/");
  });

  it("matches Latin terms at word starts only", () => {
    expect(names(searchEntries(en, "ps")).some((n) => /cps/i.test(n))).toBe(false);
    expect(names(searchEntries(en, "cps")).some((n) => /cps/i.test(n))).toBe(true);
    expect(searchEntries(en, "json").length).toBeGreaterThan(0);
  });

  it("folds width, case and accents", () => {
    expect(names(searchEntries(zh, "ＰＤＦ")).length).toBeGreaterThan(0);
    expect(searchEntries(indexes.vi, "tieng anh").length).toBeGreaterThan(0);
  });

  it("returns nothing for an empty query or one the site does not cover", () => {
    expect(searchEntries(zh, "   ")).toEqual([]);
    expect(searchEntries(zh, "去水印")).toEqual([]);
    expect(searchEntries(en, "remove watermark")).toEqual([]);
  });

  it("caps the result list", () => {
    expect(searchEntries(en, "pdf").length).toBeLessThanOrEqual(8);
  });
});

describe("query rules", () => {
  it("normalises width, case and spaces and caps the length", () => {
    expect(normalizeQuery("  ＰＤＦ   合并 ")).toBe("pdf 合并");
    expect(normalizeQuery("x".repeat(100)).length).toBe(60);
  });

  it("does not record links, emails, long numbers or punctuation", () => {
    expect(isRecordableQuery("去水印")).toBe(true);
    expect(isRecordableQuery("334424044")).toBe(true);
    expect(isRecordableQuery("https://example.com")).toBe(false);
    expect(isRecordableQuery("me@example.com")).toBe(false);
    expect(isRecordableQuery("138 0013 8000")).toBe(false);
    expect(isRecordableQuery("110101199003071234")).toBe(false);
    expect(isRecordableQuery("?!…")).toBe(false);
  });

  it("checks email shape", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a b@c.com")).toBe(false);
    expect(isValidEmail(`${"a".repeat(250)}@b.com`)).toBe(false);
  });

  it("takes the name part of a title", () => {
    expect(nameFromTitle("Merge PDF | cv.cm")).toBe("Merge PDF");
    expect(nameFromTitle("身份证加水印、暗水印在线工具，证件照防盗用，免费不上传")).toBe("身份证加水印、暗水印在线工具");
    expect(nameFromTitle("塞尔达传说 金手指｜FC 初代 通关攻略 在线玩")).toBe("塞尔达传说 金手指");
  });
});

function memoryStore() {
  const misses = new Map<string, { count: number; visitors: number }>();
  const votes = new Set<string>();
  const requests = new Set<string>();
  const rates = new Map<string, { start: number; misses: number; emails: number }>();
  const store: SearchStore = {
    async recordMiss(q, locale, visitor) {
      const fresh = !votes.has(visitor);
      votes.add(visitor);
      const row = misses.get(`${locale}|${q}`) ?? { count: 0, visitors: 0 };
      row.count++;
      if (fresh) row.visitors++;
      misses.set(`${locale}|${q}`, row);
    },
    async addRequest(q, locale, email) {
      requests.add(`${locale}|${q}|${email}`);
    },
    async bumpRate(ip, kind, max, now) {
      const row = rates.get(ip);
      const cur = row && now - row.start < 3_600_000 ? row : { start: now, misses: 0, emails: 0 };
      if (cur[kind] >= max) return false;
      cur[kind]++;
      rates.set(ip, cur);
      return true;
    },
    async cleanup() {},
  };
  return { store, misses, requests };
}

function post(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`https://cv.cm${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://cv.cm",
      "Sec-Fetch-Site": "same-origin",
      "CF-Connecting-IP": "203.0.113.9",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("search API", () => {
  it("records a miss under the normalised query and counts a visitor once a day", async () => {
    const { store, misses } = memoryStore();
    const opts = { store, now: Date.UTC(2026, 10, 14, 8), random: () => 1 };
    expect((await handleSearchApi(post("/api/search/miss", { q: " 去水印 ", locale: "zh-CN" }), opts))?.status).toBe(204);
    expect((await handleSearchApi(post("/api/search/miss", { q: "去水印", locale: "zh-CN" }), opts))?.status).toBe(204);
    expect(misses.get("zh-CN|去水印")).toEqual({ count: 2, visitors: 1 });
    await handleSearchApi(post("/api/search/miss", { q: "去水印", locale: "zh-CN" }, { "CF-Connecting-IP": "198.51.100.1" }), opts);
    expect(misses.get("zh-CN|去水印")).toEqual({ count: 3, visitors: 2 });
  });

  it("stores an email request", async () => {
    const { store, requests } = memoryStore();
    const res = await handleSearchApi(post("/api/search/notify", { q: "去水印", locale: "zh-CN", email: " Me@Example.com " }), { store });
    expect(res?.status).toBe(200);
    expect([...requests]).toEqual(["zh-CN|去水印|me@example.com"]);
  });

  it("rejects other sites, bad bodies, bad queries and bad emails", async () => {
    const { store } = memoryStore();
    const opts = { store };
    expect((await handleSearchApi(post("/api/search/miss", { q: "x y", locale: "en" }, { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" }), opts))?.status).toBe(403);
    expect((await handleSearchApi(post("/api/search/miss", "not json"), opts))?.status).toBe(400);
    expect((await handleSearchApi(post("/api/search/miss", { q: "x y", locale: "xx" }), opts))?.status).toBe(400);
    expect((await handleSearchApi(post("/api/search/miss", { q: "https://a.b", locale: "en" }), opts))?.status).toBe(400);
    expect((await handleSearchApi(post("/api/search/notify", { q: "abc", locale: "en", email: "nope" }), opts))?.status).toBe(400);
    expect((await handleSearchApi(new Request("https://cv.cm/api/search/miss"), opts))?.status).toBe(405);
    expect(await handleSearchApi(new Request("https://cv.cm/api/other", { method: "POST" }), opts)).toBeNull();
  });

  it("rate-limits misses and emails per IP", async () => {
    const { store } = memoryStore();
    const opts = { store, now: 1_000 };
    for (let i = 0; i < SEARCH_MISS_MAX; i++) {
      expect((await handleSearchApi(post("/api/search/miss", { q: `q${i}`, locale: "en" }), opts))?.status).toBe(204);
    }
    expect((await handleSearchApi(post("/api/search/miss", { q: "one more", locale: "en" }), opts))?.status).toBe(429);
    for (let i = 0; i < SEARCH_EMAIL_RATE_MAX; i++) {
      expect((await handleSearchApi(post("/api/search/notify", { q: `q${i}`, locale: "en", email: `a${i}@b.co` }), opts))?.status).toBe(200);
    }
    expect((await handleSearchApi(post("/api/search/notify", { q: "x1", locale: "en", email: "z@b.co" }), opts))?.status).toBe(429);
  });

  it("answers 503 in the Worker when D1 is not bound, and still 405s other POSTs", async () => {
    const env = { ASSETS: { fetch: async () => new Response("asset") } };
    const miss = await worker.fetch(post("/api/search/miss", { q: "abc", locale: "en" }), env);
    expect(miss.status).toBe(503);
    const other = await worker.fetch(new Request("https://cv.cm/en/", { method: "POST" }), env);
    expect(other.status).toBe(405);
  });
});
