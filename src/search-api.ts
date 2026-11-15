import type { D1Database } from "./clip-store";
import { toHex } from "./shared/hash";
import { clientIp } from "./shared/clip";
import { isLocale, type Locale } from "./shared/locale";
import { isRecordableQuery, normalizeQuery } from "./shared/search";

/**
 * POST /api/search/miss { q, locale }  a search with no result (204). Nothing else is collected: no emails, no IPs.
 * Nothing is read back through the API: the owner reads the tables with wrangler (`npm run search:demand`, scripts/search-tool.ts).
 * IPs are never stored: the vote key and the rate key are HMACs under a random salt per UTC day (search_salts), and
 * salts, votes and rate rows are deleted after two days by the hourly cron (worker.ts `scheduled`). While a salt
 * exists, someone with D1 access could brute-force IPv4 against it; once it is gone, no key can be tied to an address.
 */

export const SEARCH_RATE_WINDOW_MS = 60 * 60 * 1000;
/** Per IPv4 address or IPv6 /64 and hour. A person finds a few misses; a mobile carrier NAT shares one address among
 * many people, so the cap is generous. */
export const SEARCH_MISS_MAX = 120;
const VOTE_TTL_MS = 2 * 24 * 60 * 60 * 1000;
/** A no-result query nobody has searched for a year is deleted (the privacy policy says one year). */
export const MISS_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const BODY_MAX = 2048;

export interface SearchStore {
  /** Count one hit; `visitor` is a per-day key, counted into `visitors` the first time it is seen. */
  recordMiss(q: string, locale: Locale, visitor: string, now: number): Promise<void>;
  /** The random salt of a UTC day, created on first use. */
  daySalt(day: string, now: number): Promise<string>;
  /** Counts one request in a single atomic upsert; false once the window's count is over `max`. */
  bumpRate(ipHash: string, max: number, now: number): Promise<boolean>;
  cleanup(now: number): Promise<void>;
}

export function d1SearchStore(db: D1Database): SearchStore {
  return {
    async recordMiss(q, locale, visitor, now) {
      // The visitor counts if their vote key is new; the vote is written after, in the same transaction, so a failed
      // request leaves neither and its retry still counts the visitor.
      const miss = db
        .prepare(
          `INSERT INTO search_misses (q, locale, count, visitors, first_at, last_at)
           VALUES (?, ?, 1, CASE WHEN EXISTS (SELECT 1 FROM search_votes WHERE key = ?) THEN 0 ELSE 1 END, ?, ?)
           ON CONFLICT (q, locale) DO UPDATE SET
             count = count + 1, visitors = visitors + excluded.visitors, last_at = excluded.last_at`,
        )
        .bind(q, locale, visitor, now, now);
      const vote = db.prepare("INSERT OR IGNORE INTO search_votes (key, created_at) VALUES (?, ?)").bind(visitor, now);
      await db.batch([miss, vote]);
    },
    async daySalt(day, now) {
      const fresh = toHex(crypto.getRandomValues(new Uint8Array(32)));
      await db.prepare("INSERT OR IGNORE INTO search_salts (day, salt, created_at) VALUES (?, ?, ?)").bind(day, fresh, now).run();
      const row = await db.prepare("SELECT salt FROM search_salts WHERE day = ?").bind(day).first<{ salt: string }>();
      if (!row) throw new Error("search salt");
      return row.salt;
    },
    async bumpRate(ipHash, max, now) {
      // One statement, so concurrent requests cannot both read the old count. SET expressions see the old row.
      const fresh = `excluded.window_start - search_rate.window_start >= ${SEARCH_RATE_WINDOW_MS}`;
      const row = await db
        .prepare(
          `INSERT INTO search_rate (ip_hash, window_start, misses) VALUES (?, ?, 1)
           ON CONFLICT (ip_hash) DO UPDATE SET
             window_start = CASE WHEN ${fresh} THEN excluded.window_start ELSE search_rate.window_start END,
             misses = CASE WHEN ${fresh} THEN 1 ELSE search_rate.misses + 1 END
           RETURNING misses`,
        )
        .bind(ipHash, now)
        .first<{ misses: number }>();
      return Boolean(row) && row!.misses <= max;
    },
    async cleanup(now) {
      const sweeps = [
        db.prepare("DELETE FROM search_votes WHERE created_at < ?").bind(now - VOTE_TTL_MS),
        db.prepare("DELETE FROM search_rate WHERE window_start < ?").bind(now - SEARCH_RATE_WINDOW_MS * 2),
        db.prepare("DELETE FROM search_salts WHERE created_at < ?").bind(now - VOTE_TTL_MS),
        db.prepare("DELETE FROM search_misses WHERE last_at < ?").bind(now - MISS_TTL_MS),
      ];
      await db.batch(sweeps);
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

export type SearchApiOpts = { store: SearchStore | null; now?: number };

/** Per isolate: the salt of the current day (saves two D1 calls per request). The sweep is the hourly cron's job. */
let saltCache: { day: string; key: CryptoKey } | null = null;

/** Tests reset the per-isolate caches. */
export function resetSearchApiCache(): void {
  saltCache = null;
}

/** Only the site's own pages may post: a form on another site cannot add queries. */
export function sameOrigin(request: Request, url: URL): boolean {
  const site = request.headers.get("Sec-Fetch-Site");
  if (site && site !== "same-origin") return false;
  const origin = request.headers.get("Origin");
  return origin === url.origin;
}

export async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  if (!(request.headers.get("Content-Type") ?? "").toLowerCase().startsWith("application/json")) return null;
  const length = Number(request.headers.get("Content-Length") ?? "0");
  if (length > BODY_MAX || !request.body) return null;
  try {
    // Read at most BODY_MAX bytes, also for a chunked body without Content-Length.
    const reader = request.body.getReader();
    const parts: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > BODY_MAX) {
        await reader.cancel();
        return null;
      }
      parts.push(value);
    }
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const part of parts) {
      bytes.set(part, at);
      at += part.byteLength;
    }
    const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * The address a person controls: IPv4 as is, IPv6 cut to its /64 (one connection rotates through a whole /64,
 * so counting single IPv6 addresses would let one script look like thousands of visitors).
 */
export function rateSubject(ip: string): string {
  if (!ip.includes(":")) return ip;
  // IPv4-mapped (::ffff:1.2.3.4) is the IPv4 address.
  const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) return mapped[1];
  const [head, tail = ""] = ip.toLowerCase().split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right];
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

/** HMAC-SHA-256 of `text` under the day's salt, first 16 bytes as hex. */
export async function keyed(key: CryptoKey, text: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return toHex(new Uint8Array(sig).slice(0, 16));
}

export async function handleSearchApi(request: Request, opts: SearchApiOpts): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  if (path !== "/api/search/miss") return null;
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
  const ip = rateSubject(clientIp(request));

  try {
    const day = new Date(now).toISOString().slice(0, 10);
    if (saltCache?.day !== day) {
      const salt = await store.daySalt(day, now);
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(salt), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      saltCache = { day, key };
    }
    const salt = saltCache.key;
    // Keyed by the day's salt so no stable IP identifier is kept. Trade-off: an IP's hourly window restarts at
    // 00:00 UTC, so the boundary hour allows up to twice the cap.
    const ipHash = await keyed(salt, `rate|${ip}`);
    if (!(await store.bumpRate(ipHash, SEARCH_MISS_MAX, now))) return json(429, { error: "rate" });
    await store.recordMiss(q, locale, await keyed(salt, `vote|${ip}|${locale}|${q}`), now);
    return noContent();
  } catch (err) {
    console.error("search api", err);
    return json(503, { error: "unavailable" });
  }
}
