import { describe, expect, it } from "vitest";
import "../src/shared/kb-code-meta";
import "../src/shared/kb-ai-meta";
import "../src/shared/kb-photo-meta";
import { LOCALES } from "../src/shared/locale";
import {
  isRecordableQuery,
  nameFromTitle,
  normalizeQuery,
  searchEntries,
  SEARCH_CHANNELS,
  type SearchEntry,
} from "../src/shared/search";
import { buildAllSearchIndexes } from "../src/shared/search-index";
import { sitemapPages } from "../src/shared/sitemap";
import { d1SearchStore, handleSearchApi, rateSubject, resetSearchApiCache, SEARCH_MISS_MAX, type SearchStore } from "../src/search-api";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
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

  it("treats hyphens and punctuation as spaces but keeps + and #", () => {
    expect(names(searchEntries(en, "pdf-to-jpg"))).toEqual(names(searchEntries(en, "pdf to jpg")));
    expect(searchEntries(en, "qr-code").length).toBeGreaterThan(0);
    expect(searchEntries(en, "bmi?").length).toBeGreaterThan(0);
  });

  it("finds CJK words typed in another order", () => {
    expect(searchEntries(indexes["zh-CN"], "图片压缩").length).toBeGreaterThan(0);
    expect(searchEntries(indexes["zh-CN"], "图片压缩")[0][2]).toContain("压缩");
  });

  it("reads 1920x1080 as two numbers", () => {
    const entries: SearchEntry[] = [["tool", "/en/r/", "Resize image", "Set 1920 by 1080 or any size."]];
    expect(searchEntries(entries, "1920x1080").length).toBe(1);
  });

  it("gives the whole-name bonus to hyphenated names", () => {
    const entries: SearchEntry[] = [["learn", "/en/a/", "Rock paper scissors strategy", ""], ["tool", "/en/b/", "Rock-Paper-Scissors", ""]];
    expect(searchEntries(entries, "rock paper scissors")[0][1]).toBe("/en/b/");
  });

  it("gives every result in a locale a distinct name", () => {
    for (const locale of LOCALES) {
      const lower = indexes[locale].map((e) => e[2].toLowerCase());
      expect(lower.length - new Set(lower).size, locale).toBe(0);
    }
  });

  it("matches Latin terms at word starts only", () => {
    expect(names(searchEntries(en, "ps")).some((n) => /cps/i.test(n))).toBe(false);
    expect(names(searchEntries(en, "cps")).some((n) => /cps/i.test(n))).toBe(true);
    expect(searchEntries(en, "json").length).toBeGreaterThan(0);
  });

  it("treats terms starting with an Ext-B Han character or ー as CJK", () => {
    const entries: SearchEntry[] = [["tool", "/ja/x/", "テストツール", ""], ["tool", "/zh-cn/y/", "吉𠮷野家", ""]];
    expect(searchEntries(entries, "ール").length).toBe(1);
    expect(searchEntries(entries, "𠮷野").length).toBe(1);
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
    const cut = normalizeQuery("a" + "😀".repeat(80));
    expect([...cut].length).toBe(60);
    expect(cut).not.toMatch(/[\uD800-\uDBFF]$/);
  });

  it("does not record links, emails, long numbers or punctuation", () => {
    expect(isRecordableQuery("去水印")).toBe(true);
    expect(isRecordableQuery("520 meaning")).toBe(true);
    expect(isRecordableQuery("(415) 555-0199")).toBe(false);
    expect(isRecordableQuery("555 123 4567")).toBe(false);
    expect(isRecordableQuery("https://example.com")).toBe(false);
    expect(isRecordableQuery("me@example.com")).toBe(false);
    expect(isRecordableQuery("138 0013 8000")).toBe(false);
    expect(isRecordableQuery("110101199003071234")).toBe(false);
    expect(isRecordableQuery("?!…")).toBe(false);
    expect(isRecordableQuery("bit.ly/3xYzAbc")).toBe(false);
    expect(isRecordableQuery("t.me/someuser")).toBe(false);
    expect(isRecordableQuery("example.com/reset?token=abc")).toBe(false);
    expect(isRecordableQuery("node.js")).toBe(true);
    expect(isRecordableQuery("draw.io")).toBe(true);
    expect(isRecordableQuery("asp.net tutorial")).toBe(true);
    expect(isRecordableQuery("1920 1080 wallpaper")).toBe(true);
    expect(isRecordableQuery("2026-11-15")).toBe(true);
    expect(isRecordableQuery("1920x1080 to 3840x2160")).toBe(true);
    expect(isRecordableQuery("203.0.113.45")).toBe(false);
    expect(isRecordableQuery("2001:db8::1")).toBe(false);
    expect(isRecordableQuery("14:30:00 to 12 hour")).toBe(true);
    expect(isRecordableQuery("std::vector")).toBe(true);
    expect(isRecordableQuery("vec::new rust")).toBe(true);
    expect(isRecordableQuery("fe80::1ff:fe23:4567:890a")).toBe(false);
    expect(isRecordableQuery("𠮷".repeat(40))).toBe(true);
    expect(isRecordableQuery("c.ai")).toBe(true);
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
  const rates = new Map<string, { start: number; misses: number }>();
  const store: SearchStore = {
    async recordMiss(q, locale, visitor) {
      const fresh = !votes.has(visitor);
      votes.add(visitor);
      const row = misses.get(`${locale}|${q}`) ?? { count: 0, visitors: 0 };
      row.count++;
      if (fresh) row.visitors++;
      misses.set(`${locale}|${q}`, row);
    },
    async daySalt(day) {
      return `salt-${day}`;
    },
    async bumpRate(ip, max, now) {
      const row = rates.get(ip);
      const cur = row && now - row.start < 3_600_000 ? row : { start: now, misses: 0 };
      if (cur.misses >= max) return false;
      cur.misses++;
      rates.set(ip, cur);
      return true;
    },
    async cleanup() {},
  };
  return { store, misses };
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

/** The real D1 store over node:sqlite with the real migration. */
function sqliteStore(): { store: SearchStore; db: DatabaseSync } {
  const db = new DatabaseSync(":memory:");
  // Every migration in order, so the test always runs against the schema production has.
  for (const file of readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort()) db.exec(readFileSync(`migrations/${file}`, "utf8"));
  const d1 = {
    async batch(statements: Array<{ run(): Promise<unknown> }>) {
      db.exec("BEGIN");
      try {
        const out = [];
        for (const st of statements) out.push(await st.run());
        db.exec("COMMIT");
        return out;
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },
    prepare(sql: string) {
      const st = db.prepare(sql);
      let args: unknown[] = [];
      const p = {
        bind(...a: unknown[]) { args = a; return p; },
        async first<T>() { return (st.get(...(args as never[])) ?? null) as T | null; },
        async run() { return { meta: { changes: Number(st.run(...(args as never[])).changes) } }; },
        async all<T>() { return { results: st.all(...(args as never[])) as T[] }; },
      };
      return p;
    },
  };
  return { store: d1SearchStore(d1), db };
}

describe("search API on the D1 schema", () => {
  it("stores no IP or email, counts visitors per day and sweeps after two days", async () => {
    resetSearchApiCache();
    const { store, db } = sqliteStore();
    const day1 = Date.UTC(2026, 10, 14, 8);
    for (const ip of ["203.0.113.9", "203.0.113.9", "198.51.100.1"]) {
      await handleSearchApi(post("/api/search/miss", { q: "去水印", locale: "zh-CN" }, { "CF-Connecting-IP": ip }), { store, now: day1 });
    }
    expect(db.prepare("SELECT count, visitors FROM search_misses").get()).toEqual({ count: 3, visitors: 2 });
    const dump = JSON.stringify([db.prepare("SELECT * FROM search_votes").all(), db.prepare("SELECT * FROM search_rate").all()]);
    expect(dump).not.toContain("203.0.113.9");
    // No email table and no email column remain after 0003.
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'search_requests'").get()).toBeUndefined();
    const columns = (db.prepare("PRAGMA table_info(search_rate)").all() as Array<{ name: string }>).map((c) => c.name);
    expect(columns).toEqual(["ip_hash", "window_start", "misses"]);
    // The real store's rate limit is one atomic upsert: concurrent requests cannot slip past the cap.
    const burst = await Promise.all(
      Array.from({ length: SEARCH_MISS_MAX + 10 }, (_, i) =>
        handleSearchApi(post("/api/search/miss", { q: `burst ${i}`, locale: "en" }, { "CF-Connecting-IP": "198.51.100.77" }), { store, now: day1 }),
      ),
    );
    expect(burst.filter((r) => r!.status === 204).length).toBe(SEARCH_MISS_MAX);
    await store.cleanup(day1 + 3 * 86_400_000);
    for (const table of ["search_votes", "search_salts", "search_rate"]) {
      expect(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get(), table).toEqual({ n: 0 });
    }
    expect(db.prepare("SELECT COUNT(*) AS n FROM search_misses").get()).toEqual({ n: 1 + SEARCH_MISS_MAX });
  });
});

describe("rateSubject", () => {
  it("keeps IPv4 and cuts IPv6 to its /64", () => {
    expect(rateSubject("203.0.113.9")).toBe("203.0.113.9");
    expect(rateSubject("2001:db8:1:2:aaaa::1")).toBe("2001:db8:1:2::/64");
    expect(rateSubject("2001:DB8:1:2:ffff:1:2:3")).toBe("2001:db8:1:2::/64");
    expect(rateSubject("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(rateSubject("::ffff:203.0.113.9")).toBe("203.0.113.9");
  });
});

describe("search API", () => {
  it("records a miss under the normalised query and counts a visitor once a day", async () => {
    const { store, misses } = memoryStore();
    const opts = { store, now: Date.UTC(2026, 10, 14, 8) };
    expect((await handleSearchApi(post("/api/search/miss", { q: " 去水印 ", locale: "zh-CN" }), opts))?.status).toBe(204);
    expect((await handleSearchApi(post("/api/search/miss", { q: "去水印", locale: "zh-CN" }), opts))?.status).toBe(204);
    expect(misses.get("zh-CN|去水印")).toEqual({ count: 2, visitors: 1 });
    await handleSearchApi(post("/api/search/miss", { q: "去水印", locale: "zh-CN" }, { "CF-Connecting-IP": "198.51.100.1" }), opts);
    expect(misses.get("zh-CN|去水印")).toEqual({ count: 3, visitors: 2 });
  });

  it("rejects other sites, bad bodies and bad queries, and has no notify endpoint", async () => {
    const { store } = memoryStore();
    const opts = { store };
    expect((await handleSearchApi(post("/api/search/miss", { q: "x y", locale: "en" }, { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" }), opts))?.status).toBe(403);
    expect((await handleSearchApi(post("/api/search/miss", "not json"), opts))?.status).toBe(400);
    expect((await handleSearchApi(post("/api/search/miss", { q: "x y", locale: "xx" }), opts))?.status).toBe(400);
    expect((await handleSearchApi(post("/api/search/miss", { q: "https://a.b", locale: "en" }), opts))?.status).toBe(400);
    expect(await handleSearchApi(post("/api/search/notify", { q: "abc", locale: "en", email: "a@b.co" }), opts)).toBeNull();
    expect((await handleSearchApi(new Request("https://cv.cm/api/search/miss"), opts))?.status).toBe(405);
    expect(await handleSearchApi(new Request("https://cv.cm/api/other", { method: "POST" }), opts)).toBeNull();
  });

  it("rejects an oversized body even without Content-Length", async () => {
    const { store } = memoryStore();
    const big = JSON.stringify({ q: "x".repeat(5000), locale: "en" });
    const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(big)); c.close(); } });
    const req = new Request("https://cv.cm/api/search/miss", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://cv.cm", "Sec-Fetch-Site": "same-origin" },
      body: stream,
      // @ts-expect-error Node needs duplex for a streamed body
      duplex: "half",
    });
    expect((await handleSearchApi(req, { store }))?.status).toBe(400);
  });

  it("rate-limits misses per IP", async () => {
    const { store } = memoryStore();
    const opts = { store, now: 1_000 };
    for (let i = 0; i < SEARCH_MISS_MAX; i++) {
      expect((await handleSearchApi(post("/api/search/miss", { q: `q${i}`, locale: "en" }), opts))?.status).toBe(204);
    }
    expect((await handleSearchApi(post("/api/search/miss", { q: "one more", locale: "en" }), opts))?.status).toBe(429);
  });

  it("answers 503 in the Worker when D1 is not bound, and still 405s other POSTs", async () => {
    const env = { ASSETS: { fetch: async () => new Response("asset") } };
    const miss = await worker.fetch(post("/api/search/miss", { q: "abc", locale: "en" }), env);
    expect(miss.status).toBe(503);
    const other = await worker.fetch(new Request("https://cv.cm/en/", { method: "POST" }), env);
    expect(other.status).toBe(405);
  });
});
