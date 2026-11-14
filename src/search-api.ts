import type { D1Database } from "./clip-store";
import { clientIp, hashIp } from "./shared/clip";
import { isLocale, type Locale } from "./shared/locale";
import { isRecordableQuery, isValidEmail, normalizeQuery, SEARCH_EMAIL_MAX } from "./shared/search";

/**
 * POST /api/search/miss   { q, locale }         a search with no result (204)
 * POST /api/search/notify { q, locale, email }  email me once when it has one (200 { ok: true })
 * Nothing is read back through the API: the owner reads the tables with wrangler (scripts/search-demand.mjs).
 */

export const SEARCH_RATE_WINDOW_MS = 60 * 60 * 1000;
/** Per IP and hour. A person typing finds a few misses; more is a script. */
export const SEARCH_MISS_MAX = 40;
export const SEARCH_EMAIL_RATE_MAX = 5;
const VOTE_TTL_MS = 2 * 24 * 60 * 60 * 1000;
const BODY_MAX = 2048;

export interface SearchStore {
  /** Count one hit; `visitor` is a per-day key, counted into `visitors` the first time it is seen. */
  recordMiss(q: string, locale: Locale, visitor: string, now: number): Promise<void>;
  addRequest(q: string, locale: Locale, email: string, now: number): Promise<void>;
  /** Bumps the counter if under `max` and returns true; false when the limit is reached. */
  bumpRate(ipHash: string, kind: "misses" | "emails", max: number, now: number): Promise<boolean>;
  cleanup(now: number): Promise<void>;
}

export function d1SearchStore(db: D1Database): SearchStore {
  return {
    async recordMiss(q, locale, visitor, now) {
      const vote = await db
        .prepare("INSERT OR IGNORE INTO search_votes (key, created_at) VALUES (?, ?)")
        .bind(visitor, now)
        .run();
      const fresh = vote.meta.changes > 0 ? 1 : 0;
      await db
        .prepare(
          `INSERT INTO search_misses (q, locale, count, visitors, first_at, last_at) VALUES (?, ?, 1, ?, ?, ?)
           ON CONFLICT (q, locale) DO UPDATE SET count = count + 1, visitors = visitors + excluded.visitors, last_at = excluded.last_at`,
        )
        .bind(q, locale, fresh, now, now)
        .run();
    },
    async addRequest(q, locale, email, now) {
      await db
        .prepare("INSERT OR IGNORE INTO search_requests (q, locale, email, created_at) VALUES (?, ?, ?, ?)")
        .bind(q, locale, email, now)
        .run();
    },
    async bumpRate(ipHash, kind, max, now) {
      const row = await db
        .prepare("SELECT window_start, misses, emails FROM search_rate WHERE ip_hash = ?")
        .bind(ipHash)
        .first<{ window_start: number; misses: number; emails: number }>();
      const inWindow = row && now - row.window_start < SEARCH_RATE_WINDOW_MS;
      const misses = inWindow ? row.misses : 0;
      const emails = inWindow ? row.emails : 0;
      if ((kind === "misses" ? misses : emails) >= max) return false;
      await db
        .prepare(
          `INSERT INTO search_rate (ip_hash, window_start, misses, emails) VALUES (?, ?, ?, ?)
           ON CONFLICT (ip_hash) DO UPDATE SET window_start = excluded.window_start, misses = excluded.misses, emails = excluded.emails`,
        )
        .bind(ipHash, inWindow ? row.window_start : now, misses + (kind === "misses" ? 1 : 0), emails + (kind === "emails" ? 1 : 0))
        .run();
      return true;
    },
    async cleanup(now) {
      await db.prepare("DELETE FROM search_votes WHERE created_at < ?").bind(now - VOTE_TTL_MS).run();
      await db.prepare("DELETE FROM search_rate WHERE window_start < ?").bind(now - SEARCH_RATE_WINDOW_MS * 2).run();
    },
  };
}

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex",
};

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function noContent(): Response {
  return new Response(null, { status: 204, headers: JSON_HEADERS });
}

export type SearchApiOpts = { store: SearchStore | null; now?: number; random?: () => number };

/** Only the site's own pages may post: a form on another site cannot add queries or emails. */
function sameOrigin(request: Request, url: URL): boolean {
  const site = request.headers.get("Sec-Fetch-Site");
  if (site && site !== "same-origin") return false;
  const origin = request.headers.get("Origin");
  return origin === url.origin;
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  if (!(request.headers.get("Content-Type") ?? "").toLowerCase().startsWith("application/json")) return null;
  const length = Number(request.headers.get("Content-Length") ?? "0");
  if (length > BODY_MAX) return null;
  try {
    const text = await request.text();
    if (text.length > BODY_MAX) return null;
    const data: unknown = JSON.parse(text);
    return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function sha(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function handleSearchApi(request: Request, opts: SearchApiOpts): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  if (path !== "/api/search/miss" && path !== "/api/search/notify") return null;
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { ...JSON_HEADERS, Allow: "POST", "Content-Type": "text/plain; charset=utf-8" } });
  }
  if (!sameOrigin(request, url)) return json(403, { error: "origin" });
  const body = await readBody(request);
  if (!body) return json(400, { error: "bad_request" });
  const q = typeof body.q === "string" ? normalizeQuery(body.q) : "";
  const locale = typeof body.locale === "string" && isLocale(body.locale) ? body.locale : null;
  if (!locale || !isRecordableQuery(q)) return json(400, { error: "query" });
  const store = opts.store;
  if (!store) return json(503, { error: "unavailable" });
  const now = opts.now ?? Date.now();
  const ip = clientIp(request);
  const ipHash = await hashIp(ip);

  try {
    // Expired votes and rate rows are swept on about one request in fifty.
    if ((opts.random ?? Math.random)() < 0.02) await store.cleanup(now);
    if (path === "/api/search/miss") {
      if (!(await store.bumpRate(ipHash, "misses", SEARCH_MISS_MAX, now))) return json(429, { error: "rate" });
      const day = new Date(now).toISOString().slice(0, 10);
      await store.recordMiss(q, locale, await sha(`${day}|${ip}|${locale}|${q}`), now);
      return noContent();
    }
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (email.length > SEARCH_EMAIL_MAX || !isValidEmail(email)) return json(400, { error: "email" });
    if (!(await store.bumpRate(ipHash, "emails", SEARCH_EMAIL_RATE_MAX, now))) return json(429, { error: "rate" });
    await store.addRequest(q, locale, email, now);
    return json(200, { ok: true });
  } catch (err) {
    console.error("search api", err);
    return json(503, { error: "unavailable" });
  }
}
