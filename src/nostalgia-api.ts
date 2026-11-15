import type { D1Database } from "./clip-store";
import { clientIp } from "./shared/clip";
import { isNostalgiaId, type NostalgiaId } from "./shared/nostalgia";
import { d1SearchStore, keyed, rateSubject, readBody, sameOrigin } from "./search-api";

/**
 * POST /api/nostalgia/vote { id, answer: "yes" | "no" } → { yes, no }: the reader's answer to "have you had / played /
 * used it?" on a nostalgia entry, and the totals so far. Nothing else is collected and nothing is read without answering.
 * IPs are never stored: the per-entry key and the rate key are HMACs under the site search's random salt of the UTC day
 * (search_salts), and keys and rate rows are deleted after two days by the hourly cron, like the search ones. Up to
 * NOSTALGIA_PER_ADDRESS answers count per address, entry and day.
 */

export const NOSTALGIA_RATE_WINDOW_MS = 60 * 60 * 1000;
/**
 * Requests per IPv4 address or IPv6 /64 and clock hour. Generous: a carrier NAT shares it among many readers, and a
 * single script is held by the per-entry cap below anyway.
 */
export const NOSTALGIA_VOTE_MAX = 600;
/**
 * Answers counted per address, entry and UTC day. Not one: a mobile carrier NAT puts many readers behind one address, and
 * one browser answers once anyway (it remembers its answer). The cap only stops one script from swinging an entry.
 */
export const NOSTALGIA_PER_ADDRESS = 20;
const KEY_TTL_MS = 2 * 24 * 60 * 60 * 1000;

export type NostalgiaAnswer = "yes" | "no";
export type NostalgiaTally = { yes: number; no: number };
/** The totals, and whether this answer was added (false: this address already answered this entry today). */
export type NostalgiaVoteResult = NostalgiaTally & { counted: boolean };

export interface NostalgiaVoteStore {
  /** Counts the answer unless `key` (address, entry, day) is over the cap; returns the totals either way. */
  vote(id: NostalgiaId, answer: NostalgiaAnswer, key: string, now: number): Promise<NostalgiaVoteResult>;
  daySalt(day: string, now: number): Promise<string>;
  /** Counts one request atomically; false once the window's count is over `max`. */
  bumpRate(ipHash: string, max: number, now: number): Promise<boolean>;
  cleanup(now: number): Promise<void>;
}

export function d1NostalgiaStore(db: D1Database): NostalgiaVoteStore {
  const search = d1SearchStore(db);
  return {
    async vote(id, answer, key, now) {
      // Stored times are cut to the UTC day (keys and counts carry no finer timestamp).
      const day = now - (now % (24 * 60 * 60 * 1000));
      // One batch, one transaction: count the address's answers for this entry today, then add to the totals only while
      // that count is within the cap. Both upserts return their rows, so `counted` and the totals are exactly this
      // request's, not a later read that a concurrent request could have moved.
      const seen = db
        .prepare(
          `INSERT INTO nostalgia_vote_keys (key, answers, created_at) VALUES (?, 1, ?)
           ON CONFLICT (key) DO UPDATE SET answers = nostalgia_vote_keys.answers + 1
             WHERE nostalgia_vote_keys.answers <= ${NOSTALGIA_PER_ADDRESS}
           RETURNING answers`,
        )
        .bind(key, day);
      // Over the cap nothing is written to the counts (no timestamp touch, no empty row): the WHERE skips the insert.
      const count = db
        .prepare(
          `INSERT INTO nostalgia_votes (id, yes, no, updated_at)
           SELECT ?, ${answer === "yes" ? 1 : 0}, ${answer === "no" ? 1 : 0}, ?
           WHERE (SELECT answers FROM nostalgia_vote_keys WHERE key = ?) <= ${NOSTALGIA_PER_ADDRESS}
           ON CONFLICT (id) DO UPDATE SET yes = yes + excluded.yes, no = no + excluded.no, updated_at = excluded.updated_at
           RETURNING yes, no`,
        )
        .bind(id, day, key);
      const [mark, totals] = (await db.batch([seen, count])) as Array<{ results?: Array<Record<string, number>> }>;
      // No row back means the key was already past the cap and was left alone.
      const answers = Number(mark?.results?.[0]?.answers ?? Infinity);
      const counted = answers <= NOSTALGIA_PER_ADDRESS;
      // A capped answer wrote nothing, so read the totals as they stand.
      const row = totals?.results?.[0] ?? (await db.prepare("SELECT yes, no FROM nostalgia_votes WHERE id = ?").bind(id).first<NostalgiaTally>());
      return { yes: Number(row?.yes ?? 0), no: Number(row?.no ?? 0), counted };
    },
    daySalt: (day, now) => search.daySalt(day, now),
    async bumpRate(ipHash, max, now) {
      const fresh = `excluded.window_start - nostalgia_rate.window_start >= ${NOSTALGIA_RATE_WINDOW_MS}`;
      const row = await db
        .prepare(
          `INSERT INTO nostalgia_rate (ip_hash, window_start, votes) VALUES (?, ?, 1)
           ON CONFLICT (ip_hash) DO UPDATE SET
             window_start = CASE WHEN ${fresh} THEN excluded.window_start ELSE nostalgia_rate.window_start END,
             votes = CASE WHEN ${fresh} THEN 1 ELSE nostalgia_rate.votes + 1 END
           RETURNING votes`,
        )
        // Clock-hour windows: the stored start is the hour, never the request's millisecond.
        .bind(ipHash, now - (now % NOSTALGIA_RATE_WINDOW_MS))
        .first<{ votes: number }>();
      return Boolean(row) && row!.votes <= max;
    },
    async cleanup(now) {
      await db.batch([
        db.prepare("DELETE FROM nostalgia_vote_keys WHERE created_at < ?").bind(now - KEY_TTL_MS),
        db.prepare("DELETE FROM nostalgia_rate WHERE window_start < ?").bind(now - NOSTALGIA_RATE_WINDOW_MS * 2),
      ]);
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

export type NostalgiaApiOpts = { store: NostalgiaVoteStore | null; now?: number };

/** Per isolate: the HMAC key of the current day (saves two D1 calls per request). */
let saltCache: { day: string; key: CryptoKey } | null = null;

export function resetNostalgiaApiCache(): void {
  saltCache = null;
}

export async function handleNostalgiaApi(request: Request, opts: NostalgiaApiOpts): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  if (path !== "/api/nostalgia/vote") return null;
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { ...JSON_HEADERS, Allow: "POST", "Content-Type": "text/plain; charset=utf-8" } });
  }
  if (!sameOrigin(request, url)) return json(403, { error: "origin" });
  const body = await readBody(request);
  if (!body) return json(400, { error: "bad_request" });
  const id = typeof body.id === "string" && isNostalgiaId(body.id) ? body.id : null;
  const answer = body.answer === "yes" || body.answer === "no" ? body.answer : null;
  if (!id || !answer) return json(400, { error: "vote" });
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
    if (!(await store.bumpRate(await keyed(salt, `nostalgia-rate|${ip}`), NOSTALGIA_VOTE_MAX, now))) return json(429, { error: "rate" });
    const tally = await store.vote(id, answer, await keyed(salt, `nostalgia|${ip}|${id}`), now);
    return json(200, tally);
  } catch (err) {
    console.error("nostalgia api", err);
    return json(503, { error: "unavailable" });
  }
}
