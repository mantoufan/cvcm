import {
  CLIP_MAX_BYTES,
  CLIP_MAX_VIEWS,
  CLIP_RATE_MAX,
  CLIP_RATE_WINDOW_MS,
  CLIP_TTL_MS,
  clientIp,
  clipShareUrl,
  hashIp,
  isClipId,
  newClipId,
  utf8Bytes,
} from "./shared/clip";
import type { ClipStore } from "./clip-store";

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
  | "bad_request";

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
): { kind: "col" } | { kind: "item"; id: string } | null {
  const raw = pathname.replace(/\/+$/, "") || "/";
  if (raw === "/api/clip") return { kind: "col" };
  const match = raw.match(/^\/api\/clip\/([^/]+)$/);
  if (match) return { kind: "item", id: match[1] };
  return null;
}

async function readBody(request: Request): Promise<string | null> {
  const ct = (request.headers.get("content-type") || "").toLowerCase();
  try {
    if (ct.includes("application/json")) {
      const data: unknown = await request.json();
      if (!data || typeof data !== "object" || !("body" in data)) return "";
      const value = (data as { body: unknown }).body;
      return typeof value === "string" ? value : null;
    }
    return await request.text();
  } catch {
    return null;
  }
}

export async function handleClipApi(
  request: Request,
  store: ClipStore | null,
  now = Date.now(),
): Promise<Response | null> {
  const url = new URL(request.url);
  const parsed = parseClipApiPath(url.pathname);
  if (!parsed) return null;

  if (request.method === "OPTIONS") {
    const allow = parsed.kind === "col" ? "POST, OPTIONS" : "GET, OPTIONS";
    return new Response(null, {
      status: 204,
      headers: {
        Allow: allow,
        "Cache-Control": "no-store",
      },
    });
  }

  if (!store) return error(503, "unavailable");

  if (parsed.kind === "col") {
    if (request.method !== "POST") {
      return error(405, "bad_request", { Allow: "POST, OPTIONS" });
    }
    return createClip(request, store, url.origin, now);
  }

  if (request.method !== "GET") {
    return error(405, "bad_request", { Allow: "GET, OPTIONS" });
  }
  return readClip(parsed.id, store, now);
}

async function createClip(
  request: Request,
  store: ClipStore,
  origin: string,
  now: number,
): Promise<Response> {
  const body = await readBody(request);
  if (body == null) return error(400, "bad_request");
  if (!body.trim()) return error(400, "empty");
  if (utf8Bytes(body) > CLIP_MAX_BYTES) return error(400, "too_large");

  await store.purge(now);

  const ipHash = await hashIp(clientIp(request));
  const rate = await store.getRate(ipHash);
  const inWindow = rate && now - rate.windowStart < CLIP_RATE_WINDOW_MS;
  if (inWindow && rate.count >= CLIP_RATE_MAX) return error(429, "rate");
  const windowStart = inWindow ? rate.windowStart : now;
  const count = (inWindow ? rate.count : 0) + 1;
  await store.putRate(ipHash, windowStart, count);

  for (let i = 0; i < 6; i++) {
    const id = newClipId();
    const createdAt = now;
    const expiresAt = now + CLIP_TTL_MS;
    const result = await store.insert({
      id,
      body,
      createdAt,
      expiresAt,
      views: 0,
    });
    if (result === "ok") {
      return json(201, {
        id,
        url: clipShareUrl(origin, id),
        expiresAt,
        maxViews: CLIP_MAX_VIEWS,
      });
    }
  }
  return error(503, "unavailable");
}

async function readClip(id: string, store: ClipStore, now: number): Promise<Response> {
  if (!isClipId(id)) return error(404, "gone");
  const row = await store.consume(id, now);
  if (!row) return error(404, "gone");
  return json(200, {
    body: row.body,
    views: row.views,
    maxViews: CLIP_MAX_VIEWS,
    expiresAt: row.expiresAt,
  });
}
