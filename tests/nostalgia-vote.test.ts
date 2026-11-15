import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { d1NostalgiaStore, handleNostalgiaApi, NOSTALGIA_PER_ADDRESS, NOSTALGIA_VOTE_MAX, resetNostalgiaApiCache } from "../src/nostalgia-api";
import worker from "../src/worker";
import "../src/shared/messages-all";
import { nostalgiaPageHtml, nostalgiaVoteResult } from "../src/shared/nostalgia-i18n";

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://cv.cm/api/nostalgia/vote", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://cv.cm", "Sec-Fetch-Site": "same-origin", "CF-Connecting-IP": "203.0.113.9", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** The real D1 store over node:sqlite with every migration, as production runs it. */
function sqliteStore() {
  const db = new DatabaseSync(":memory:");
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
        // Like D1: a statement with RETURNING hands back its rows in `results`, inside the batch.
        async run() {
          if (/\bRETURNING\b/i.test(sql)) return { results: st.all(...(args as never[])), meta: { changes: 1 } };
          return { meta: { changes: Number(st.run(...(args as never[])).changes) } };
        },
        async all<T>() { return { results: st.all(...(args as never[])) as T[] }; },
      };
      return p;
    },
  };
  return { store: d1NostalgiaStore(d1 as never), db };
}

describe("nostalgia vote API", () => {
  it("counts answers up to a cap per address, entry and day, returns the totals and stores no IP", async () => {
    resetNostalgiaApiCache();
    const { store, db } = sqliteStore();
    const day1 = Date.UTC(2026, 10, 15, 8);
    const first = await handleNostalgiaApi(post({ id: "famicom", answer: "yes" }), { store, now: day1 });
    expect(first?.status).toBe(200);
    expect(await first!.json()).toEqual({ yes: 1, no: 0, counted: true });
    // Readers behind one carrier NAT share an address: answers keep counting up to the cap, then stop, and the reply says so.
    for (let i = 2; i <= NOSTALGIA_PER_ADDRESS; i++) await handleNostalgiaApi(post({ id: "famicom", answer: "no" }), { store, now: day1 });
    expect(await (await handleNostalgiaApi(post({ id: "famicom", answer: "no" }), { store, now: day1 }))!.json()).toEqual({ yes: 1, no: NOSTALGIA_PER_ADDRESS - 1, counted: false });
    // Another address counts; another entry from the capped address counts on its own.
    expect(await (await handleNostalgiaApi(post({ id: "famicom", answer: "no" }, { "CF-Connecting-IP": "198.51.100.4" }), { store, now: day1 }))!.json()).toEqual({ yes: 1, no: NOSTALGIA_PER_ADDRESS, counted: true });
    expect(await (await handleNostalgiaApi(post({ id: "pager", answer: "yes" }), { store, now: day1 }))!.json()).toEqual({ yes: 1, no: 0, counted: true });
    // The next day the capped address counts again.
    expect(await (await handleNostalgiaApi(post({ id: "famicom", answer: "yes" }), { store, now: day1 + 24 * 60 * 60 * 1000 }))!.json()).toEqual({ yes: 2, no: NOSTALGIA_PER_ADDRESS, counted: true });
    const dump = JSON.stringify([
      db.prepare("SELECT * FROM nostalgia_votes").all(),
      db.prepare("SELECT * FROM nostalgia_vote_keys").all(),
      db.prepare("SELECT * FROM nostalgia_rate").all(),
    ]);
    expect(dump).not.toContain("203.0.113.9");
    expect(dump).not.toContain("198.51.100.4");
    // Keys and rate rows are swept after two days; the counts stay.
    await store.cleanup(day1 + 4 * 24 * 60 * 60 * 1000);
    expect(db.prepare("SELECT COUNT(*) AS n FROM nostalgia_vote_keys").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM nostalgia_rate").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT yes, no FROM nostalgia_votes WHERE id = 'famicom'").get()).toEqual({ yes: 2, no: NOSTALGIA_PER_ADDRESS });
  });

  it("rejects other origins, bad bodies, unknown ids, other methods, and rate-limits", async () => {
    resetNostalgiaApiCache();
    const { store } = sqliteStore();
    const opts = { store, now: Date.UTC(2026, 10, 15, 9) };
    expect((await handleNostalgiaApi(post({ id: "famicom", answer: "yes" }, { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" }), opts))?.status).toBe(403);
    expect((await handleNostalgiaApi(post("not json"), opts))?.status).toBe(400);
    expect((await handleNostalgiaApi(post({ id: "nope", answer: "yes" }), opts))?.status).toBe(400);
    expect((await handleNostalgiaApi(post({ id: "famicom", answer: "maybe" }), opts))?.status).toBe(400);
    expect((await handleNostalgiaApi(new Request("https://cv.cm/api/nostalgia/vote"), opts))?.status).toBe(405);
    expect(await handleNostalgiaApi(new Request("https://cv.cm/api/other", { method: "POST" }), opts)).toBeNull();
    expect((await handleNostalgiaApi(post({ id: "famicom", answer: "yes" }), { store: null }))?.status).toBe(503);
    for (let i = 1; i < NOSTALGIA_VOTE_MAX; i++) await handleNostalgiaApi(post({ id: "famicom", answer: "yes" }, { "CF-Connecting-IP": "192.0.2.50" }), opts);
    // The hourly rate counts every request, counted or not.
    expect((await handleNostalgiaApi(post({ id: "pager", answer: "yes" }, { "CF-Connecting-IP": "192.0.2.50" }), opts))?.status).toBe(200);
    expect((await handleNostalgiaApi(post({ id: "y2k", answer: "yes" }, { "CF-Connecting-IP": "192.0.2.50" }), opts))?.status).toBe(429);
  });

  it("is routed by the Worker, and other POSTs still get 405", async () => {
    const env = { ASSETS: { fetch: async () => new Response("x") } };
    expect((await worker.fetch(post({ id: "famicom", answer: "yes" }), env))?.status).toBe(503);
    expect((await worker.fetch(new Request("https://cv.cm/api/nostalgia/other", { method: "POST" }), env)).status).toBe(405);
  });
});

describe("nostalgia vote markup", () => {
  it("puts the question and two buttons on every entry page, none on the hub, with no script", () => {
    const html = nostalgiaPageHtml("zh-CN", "white-rabbit");
    expect(html).toContain('<section class="nostalgia-vote" aria-labelledby="nostalgia-vote-title">');
    expect(html).toContain("你吃过吗？");
    expect(html).toContain('data-answer="yes">吃过</button>');
    expect(html).toContain('data-answer="no">没有</button>');
    expect(nostalgiaPageHtml("en", "famicom")).toContain("Did you ever play it?");
    expect(nostalgiaPageHtml("en", null)).not.toContain("nostalgia-vote");
  });

  it("formats the share", () => {
    expect(nostalgiaVoteResult("zh-CN", "white-rabbit", { yes: 3, no: 1 })).toBe("75% 的回答是「吃过」 · 共 4 份回答");
    // No "1 answers": the count reads as a label.
    expect(nostalgiaVoteResult("en", "pager", { yes: 1, no: 0 })).toBe("100% chose “I used one” · answers: 1");
    expect(nostalgiaVoteResult("en", "famicom", { yes: 1234, no: 0 })).toContain("answers: 1,234");
  });
});
