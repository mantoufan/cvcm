export const CLIP_MAX_VIEWS = 10;
export const CLIP_TTL_MS = 24 * 60 * 60 * 1000;
export const CLIP_MAX_BYTES = 32 * 1024;
export const CLIP_RATE_MAX = 20;
export const CLIP_RATE_WINDOW_MS = 60 * 60 * 1000;
export const CLIP_ID_LENGTH = 8;
export const CLIP_ALPHABET = "23456789abcdefghijkmnpqrstuvwxyz";

const CLIP_ID_RE = /^[23456789abcdefghijkmnpqrstuvwxyz]{8}$/;

export function isClipId(value: string): boolean {
  return CLIP_ID_RE.test(value);
}

export function newClipId(): string {
  const bytes = new Uint8Array(CLIP_ID_LENGTH);
  crypto.getRandomValues(bytes);
  let id = "";
  for (const b of bytes) id += CLIP_ALPHABET[b & 31];
  return id;
}

export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function clipSharePath(id: string): string {
  return `/c/${id}`;
}

export function clipShareUrl(origin: string, id: string): string {
  return `${origin.replace(/\/+$/, "")}${clipSharePath(id)}`;
}

export function remainingClock(ms: number): { h: number; m: number } | null {
  if (ms <= 0) return null;
  const totalMin = Math.max(1, Math.round(ms / 60_000));
  return { h: Math.floor(totalMin / 60), m: totalMin % 60 };
}

export function clientIp(request: Request): string {
  const cf = request.headers.get("CF-Connecting-IP");
  if (cf) return cf.trim();
  const forwarded = request.headers.get("X-Forwarded-For");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "0";
  return "0";
}

export async function hashIp(ip: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip || "0"));
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < 16; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}
