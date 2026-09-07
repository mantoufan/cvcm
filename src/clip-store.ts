import {
  CLIP_MAX_VIEWS,
  CLIP_RATE_WINDOW_MS,
} from "./shared/clip";

export type ClipRow = {
  id: string;
  body: string;
  createdAt: number;
  expiresAt: number;
  views: number;
};

export type RateRow = {
  windowStart: number;
  count: number;
};

export interface ClipStore {
  insert(row: ClipRow): Promise<"ok" | "conflict">;
  consume(id: string, now: number): Promise<ClipRow | null>;
  purge(now: number): Promise<void>;
  getRate(ipHash: string): Promise<RateRow | null>;
  putRate(ipHash: string, windowStart: number, count: number): Promise<void>;
}

export interface D1Prepared {
  bind(...values: unknown[]): D1Prepared;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<{ meta: { changes: number } }>;
}

export interface D1Database {
  prepare(query: string): D1Prepared;
}

type SqlClip = {
  id: string;
  body: string;
  created_at: number;
  expires_at: number;
  views: number;
};

function fromSql(row: SqlClip): ClipRow {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    views: row.views,
  };
}

export function d1Store(db: D1Database): ClipStore {
  return {
    async insert(row) {
      const result = await db
        .prepare(
          "INSERT OR IGNORE INTO clips (id, body, created_at, expires_at, views) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(row.id, row.body, row.createdAt, row.expiresAt, row.views)
        .run();
      return result.meta.changes === 1 ? "ok" : "conflict";
    },

    async consume(id, now) {
      const row = await db
        .prepare(
          `UPDATE clips
           SET views = views + 1
           WHERE id = ? AND views < ? AND expires_at > ?
           RETURNING id, body, created_at, expires_at, views`,
        )
        .bind(id, CLIP_MAX_VIEWS, now)
        .first<SqlClip>();
      if (!row) {
        await db
          .prepare("DELETE FROM clips WHERE id = ? AND (views >= ? OR expires_at <= ?)")
          .bind(id, CLIP_MAX_VIEWS, now)
          .run();
        return null;
      }
      if (row.views >= CLIP_MAX_VIEWS) {
        await db.prepare("DELETE FROM clips WHERE id = ?").bind(id).run();
      }
      return fromSql(row);
    },

    async purge(now) {
      await db
        .prepare("DELETE FROM clips WHERE expires_at <= ? OR views >= ?")
        .bind(now, CLIP_MAX_VIEWS)
        .run();
      await db
        .prepare("DELETE FROM clip_rate WHERE window_start < ?")
        .bind(now - CLIP_RATE_WINDOW_MS * 2)
        .run();
    },

    async getRate(ipHash) {
      const row = await db
        .prepare("SELECT window_start, count FROM clip_rate WHERE ip_hash = ?")
        .bind(ipHash)
        .first<{ window_start: number; count: number }>();
      if (!row) return null;
      return { windowStart: row.window_start, count: row.count };
    },

    async putRate(ipHash, windowStart, count) {
      await db
        .prepare(
          `INSERT INTO clip_rate (ip_hash, window_start, count) VALUES (?, ?, ?)
           ON CONFLICT(ip_hash) DO UPDATE SET window_start = excluded.window_start, count = excluded.count`,
        )
        .bind(ipHash, windowStart, count)
        .run();
    },
  };
}

export function memoryStore(): ClipStore {
  const clips = new Map<string, ClipRow>();
  const rates = new Map<string, RateRow>();
  return {
    async insert(row) {
      if (clips.has(row.id)) return "conflict";
      clips.set(row.id, { ...row });
      return "ok";
    },
    async consume(id, now) {
      const row = clips.get(id);
      if (!row) return null;
      if (row.expiresAt <= now || row.views >= CLIP_MAX_VIEWS) {
        clips.delete(id);
        return null;
      }
      row.views += 1;
      const out = { ...row };
      if (row.views >= CLIP_MAX_VIEWS) clips.delete(id);
      return out;
    },
    async purge(now) {
      for (const [id, row] of clips) {
        if (row.expiresAt <= now || row.views >= CLIP_MAX_VIEWS) clips.delete(id);
      }
      for (const [hash, rate] of rates) {
        if (now - rate.windowStart >= CLIP_RATE_WINDOW_MS * 2) rates.delete(hash);
      }
    },
    async getRate(ipHash) {
      const row = rates.get(ipHash);
      return row ? { ...row } : null;
    },
    async putRate(ipHash, windowStart, count) {
      rates.set(ipHash, { windowStart, count });
    },
  };
}
