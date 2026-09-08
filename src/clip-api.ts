import {
  CLIP_ID_TRIES,
  CLIP_MAX_BYTES,
  CLIP_MAX_FILE_BYTES,
  CLIP_MAX_VIEWS,
  CLIP_RATE_MAX,
  CLIP_RATE_WINDOW_MS,
  CLIP_READ_MAX,
  CLIP_TTL_MS,
  CLIP_UPLOAD_MAX,
  clientIp,
  clipShareUrl,
  fileKind,
  hashIp,
  isClipId,
  mimeForFile,
  newClipId,
  newFilePrefix,
  normalizeClipId,
  safeFileName,
  utf8Bytes,
} from "./shared/clip";
import type { ClipStore } from "./clip-store";
import { presignS3Put, publicS3Url, s3Delete, s3KeysInBody, type S3Config } from "./s3-sign";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
};

type ClipError =
  | "empty"
  | "too_large"
  | "rate"
  | "gone"
  | "unavailable"
  | "bad_request"
  | "file_type"
  | "file_too_large";

export type ClipApiOpts = {
  store: ClipStore | null;
  s3?: S3Config | null;
  now?: number;
};

function json(status: number, data: unknown, extra?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extra },
  });
}

function error(status: number, code: ClipError, extra?: HeadersInit): Response {
  return json(status, { error: code }, extra);
}

export function parseClipApiPath(
  pathname: string,
): { kind: "col" } | { kind: "upload" } | { kind: "item"; id: string } | null {
  const raw = pathname.replace(/\/+$/, "") || "/";
  if (raw === "/api/clip") return { kind: "col" };
  if (raw === "/api/clip/upload") return { kind: "upload" };
  const match = raw.match(/^\/api\/clip\/([^/]+)$/);
  if (match) return { kind: "item", id: match[1] };
  return null;
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const data: unknown = await request.json();
    if (!data || typeof data !== "object") return null;
    return data as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function readCreateBody(request: Request): Promise<string | null> {
  const ct = (request.headers.get("content-type") || "").toLowerCase();
  try {
    if (ct.includes("application/json")) {
      const data = await readJson(request);
      if (!data) return "";
      return typeof data.body === "string" ? data.body : null;
    }
    return await request.text();
  } catch {
    return null;
  }
}

async function bumpRate(
  store: ClipStore,
  ipHash: string,
  now: number,
  max: number,
): Promise<boolean> {
  const rate = await store.getRate(ipHash);
  const inWindow = rate && now - rate.windowStart < CLIP_RATE_WINDOW_MS;
  if (inWindow && rate.count >= max) return false;
  const windowStart = inWindow ? rate.windowStart : now;
  const count = (inWindow ? rate.count : 0) + 1;
  await store.putRate(ipHash, windowStart, count);
  return true;
}

async function sweepFiles(bodies: string[], s3: S3Config | null | undefined): Promise<void> {
  if (!s3) return;
  const keys = new Set<string>();
  for (const body of bodies) {
    for (const key of s3KeysInBody(body, s3.host)) keys.add(key);
  }
  await Promise.all([...keys].map((key) => s3Delete(s3, key).catch(() => undefined)));
}

export async function handleClipApi(
  request: Request,
  opts: ClipApiOpts,
): Promise<Response | null> {
  const url = new URL(request.url);
  const parsed = parseClipApiPath(url.pathname);
  if (!parsed) return null;
  const now = opts.now ?? Date.now();
  const store = opts.store;
  const s3 = opts.s3 ?? null;

  if (request.method === "OPTIONS") {
    const allow = parsed.kind === "item" ? "GET, OPTIONS" : "POST, OPTIONS";
    return new Response(null, { status: 204, headers: { Allow: allow, "Cache-Control": "no-store" } });
  }

  if (!store) return error(503, "unavailable");

  if (parsed.kind === "upload") {
    if (request.method !== "POST") return error(405, "bad_request", { Allow: "POST, OPTIONS" });
    return createUpload(request, store, s3, now);
  }

  if (parsed.kind === "col") {
    if (request.method !== "POST") return error(405, "bad_request", { Allow: "POST, OPTIONS" });
    return createClip(request, store, s3, url.origin, now);
  }

  if (request.method !== "GET") return error(405, "bad_request", { Allow: "GET, OPTIONS" });
  return readClip(request, parsed.id, store, s3, now);
}

async function createUpload(
  request: Request,
  store: ClipStore,
  s3: S3Config | null,
  now: number,
): Promise<Response> {
  if (!s3) return error(503, "unavailable");
  const data = await readJson(request);
  if (!data) return error(400, "bad_request");
  const name = safeFileName(typeof data.name === "string" ? data.name : "file");
  const size = typeof data.size === "number" ? data.size : Number(data.size);
  const mime = mimeForFile(name, typeof data.type === "string" ? data.type : "");
  if (!mime) return error(400, "file_type");
  if (!Number.isFinite(size) || size <= 0) return error(400, "bad_request");
  if (size > CLIP_MAX_FILE_BYTES) return error(400, "file_too_large");

  const dead = await store.drainDead(now);
  await sweepFiles(dead, s3);
  const ipHash = `u:${await hashIp(clientIp(request))}`;
  if (!(await bumpRate(store, ipHash, now, CLIP_UPLOAD_MAX))) return error(429, "rate");

  const key = `clip/${newFilePrefix()}/${name}`;
  const putUrl = await presignS3Put(s3, key, new Date(now));
  return json(200, {
    key,
    putUrl,
    url: publicS3Url(s3, key),
    mime,
    kind: fileKind(mime),
  });
}

async function createClip(
  request: Request,
  store: ClipStore,
  s3: S3Config | null,
  origin: string,
  now: number,
): Promise<Response> {
  const body = await readCreateBody(request);
  if (body == null) return error(400, "bad_request");
  if (!body.trim()) return error(400, "empty");
  if (utf8Bytes(body) > CLIP_MAX_BYTES) return error(400, "too_large");

  const dead = await store.drainDead(now);
  await sweepFiles(dead, s3);
  const ipHash = await hashIp(clientIp(request));
  if (!(await bumpRate(store, ipHash, now, CLIP_RATE_MAX))) return error(429, "rate");

  for (let i = 0; i < CLIP_ID_TRIES; i++) {
    const id = newClipId();
    const result = await store.insert({
      id,
      body,
      createdAt: now,
      expiresAt: now + CLIP_TTL_MS,
      views: 0,
    });
    if (result === "ok") {
      return json(201, {
        id,
        url: clipShareUrl(origin, id),
        expiresAt: now + CLIP_TTL_MS,
        maxViews: CLIP_MAX_VIEWS,
      });
    }
  }
  return error(503, "unavailable");
}

async function readClip(
  request: Request,
  id: string,
  store: ClipStore,
  s3: S3Config | null,
  now: number,
): Promise<Response> {
  if (!isClipId(id)) return error(404, "gone");
  const ipHash = `r:${await hashIp(clientIp(request))}`;
  if (!(await bumpRate(store, ipHash, now, CLIP_READ_MAX))) return error(429, "rate");
  const row = await store.consume(normalizeClipId(id), now);
  if (!row) return error(404, "gone");
  if (row.views >= CLIP_MAX_VIEWS) await sweepFiles([row.body], s3);
  return json(200, {
    body: row.body,
    views: row.views,
    maxViews: CLIP_MAX_VIEWS,
    expiresAt: row.expiresAt,
  });
}
