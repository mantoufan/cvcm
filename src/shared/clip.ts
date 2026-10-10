export const CLIP_MAX_VIEWS = 10;
export const CLIP_TTL_MS = 24 * 60 * 60 * 1000;
export const CLIP_MAX_BYTES = 64 * 1024;
export const CLIP_MAX_FILE_BYTES = 32 * 1024 * 1024;
export const CLIP_RATE_MAX = 20;
export const CLIP_UPLOAD_MAX = 30;
export const CLIP_READ_MAX = 80;
export const CLIP_RATE_WINDOW_MS = 60 * 60 * 1000;
export const CLIP_ID_LENGTH = 3;
export const CLIP_ID_TRIES = 12;
export const CLIP_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
export const CLIP_FILE_PREFIX_LENGTH = 16;

const CLIP_ID_RE = /^[0-9a-z]{3}$/;
const LEGACY_CLIP_ID_RE = /^[23456789abcdefghijkmnpqrstuvwxyz]{8}$/;

export function normalizeClipId(value: string): string {
  return value.toLowerCase();
}

export function isClipId(value: string): boolean {
  const id = normalizeClipId(value);
  return CLIP_ID_RE.test(id) || LEGACY_CLIP_ID_RE.test(id);
}

function randomChars(alphabet: string, length: number): string {
  const size = alphabet.length;
  const limit = Math.floor(256 / size) * size;
  let out = "";
  const bytes = new Uint8Array(32);
  while (out.length < length) {
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b >= limit) continue;
      out += alphabet[b % size];
      if (out.length === length) break;
    }
  }
  return out;
}

export function newClipId(): string {
  return randomChars(CLIP_ALPHABET, CLIP_ID_LENGTH);
}

export function newFilePrefix(): string {
  return randomChars("0123456789abcdef", CLIP_FILE_PREFIX_LENGTH);
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
const AUDIO_MIME: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  flac: "audio/flac",
  weba: "audio/webm",
};
// Types s3.cv.cm could render as a page or script. Rejected by type *and* by extension, so an
// empty or wrong browser type cannot slip one through.
const BLOCKED_MIME = new Set(["text/html", "application/xhtml+xml", "image/svg+xml", "text/javascript", "application/javascript", "text/xml", "application/xml"]);
const BLOCKED_EXT = new Set(["html", "htm", "xhtml", "shtml", "svg", "svgz", "js", "mjs", "xml", "xsl", "xslt"]);
const KEEP_MIME = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
]);

/**
 * Stored Content-Type for an upload, or null when it is refused. Images, video and audio keep a
 * media type so they play inline; a few plain document types are kept; anything else (Word,
 * Excel, archives, …) is stored as application/octet-stream, i.e. a download.
 */
export function mimeForFile(name: string, type: string): string | null {
  const given = type.toLowerCase().split(";")[0].trim();
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (BLOCKED_MIME.has(given) || BLOCKED_EXT.has(ext)) return null;
  if (IMAGE_EXT.has(ext)) return ext === "jpg" ? "image/jpeg" : `image/${ext === "jpeg" ? "jpeg" : ext}`;
  if (ext === "mov") return "video/quicktime";
  if (VIDEO_EXT.has(ext)) return ext === "m4v" ? "video/mp4" : `video/${ext}`;
  if (AUDIO_MIME[ext]) return AUDIO_MIME[ext];
  if (ext === "pdf") return "application/pdf";
  if (ext === "zip") return "application/zip";
  if (KEEP_MIME.has(given)) return given;
  return "application/octet-stream";
}

export function fileKind(mime: string): "image" | "video" | "audio" | "file" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}

export async function hashIp(ip: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip || "0"));
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < 16; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}
