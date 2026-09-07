export const CLIP_MAX_VIEWS = 10;
export const CLIP_TTL_MS = 24 * 60 * 60 * 1000;
export const CLIP_MAX_BYTES = 64 * 1024;
export const CLIP_MAX_FILE_BYTES = 32 * 1024 * 1024;
export const CLIP_RATE_MAX = 20;
export const CLIP_UPLOAD_MAX = 30;
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

export function safeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() || "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^\.+/, "").slice(0, 80);
  return cleaned || "file";
}

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp"]);
const VIDEO_EXT = new Set(["mp4", "webm", "mov", "m4v"]);
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "text/plain",
  "application/json",
  "application/octet-stream",
]);

export function mimeForFile(name: string, type: string): string | null {
  const given = type.toLowerCase().split(";")[0].trim();
  if (given === "text/html" || given === "image/svg+xml" || given === "text/javascript") return null;
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (IMAGE_EXT.has(ext)) return ext === "jpg" ? "image/jpeg" : `image/${ext === "jpeg" ? "jpeg" : ext}`;
  if (ext === "mov") return "video/quicktime";
  if (VIDEO_EXT.has(ext)) return ext === "m4v" ? "video/mp4" : `video/${ext}`;
  if (ext === "pdf") return "application/pdf";
  if (ext === "zip") return "application/zip";
  if (given && ALLOWED_MIME.has(given)) return given;
  if (!given || given === "application/octet-stream") return "application/octet-stream";
  return ALLOWED_MIME.has(given) ? given : null;
}

export function fileKind(mime: string): "image" | "video" | "file" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "file";
}

export async function hashIp(ip: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip || "0"));
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < 16; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}
