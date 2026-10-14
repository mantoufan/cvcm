import { parseAppPath, type ToolId } from "./path";
import type { QuizId } from "./quiz";

/** GA4 property 538063843 (cv.cm). */
export const GA_ID = "G-5X2J6QT5KK";

/** Hosts gtag.js loads from and reports to; allowed by CSP only on tracked pages. */
export const GA_SCRIPT_HOST = "https://www.googletagmanager.com";
export const GA_CONNECT_HOSTS = [
  "https://www.googletagmanager.com",
  "https://*.google-analytics.com",
  "https://*.analytics.google.com",
  // Google Signals (the property is linked to Google Ads for audiences).
  "https://stats.g.doubleclick.net",
  "https://www.google.com",
];

/** AGENTS.md rule 1: tools that handle the visitor's own files (image, PDF, audio) send no analytics. */
export const UNTRACKED_TOOLS: ReadonlySet<ToolId> = new Set<ToolId>([
  "watermark", "mosaic", "collage", "portrait-sim", "convert", "image-pdf", "resize", "crop", "rotate",
  "exif", "meme", "signature", "favicon", "screenshot", "pdf-jpg", "merge-pdf", "compress-pdf",
  "split-pdf", "invoice", "audio", "audio-cutter", "audio-joiner",
  "remove-background", "image-upscaler", "speech-to-text", "depth-map",
]);

/** Mental health self-checks: a visit is health information, so these pages send nothing to GA (or its ad links). */
export const UNTRACKED_QUIZZES: ReadonlySet<QuizId> = new Set<QuizId>(["self-esteem", "anxiety", "depression"]);

/** Whether this page may report to GA. A clip URL is its own access key, so clip notes are never reported. */
export function isTrackedPath(pathname: string): boolean {
  // Any /clip/<id> path, valid id or not, stays out (a mistyped id is still someone's key).
  if (/\/clip\/[^/]+/i.test(pathname)) return false;
  const parsed = parseAppPath(pathname);
  if (parsed.kind === "clip") return false;
  if ((parsed.kind === "quiz" || parsed.kind === "bare-quiz") && parsed.quiz && UNTRACKED_QUIZZES.has(parsed.quiz)) return false;
  if (parsed.kind === "app" || parsed.kind === "bare") {
    if (parsed.tool && UNTRACKED_TOOLS.has(parsed.tool)) return false;
    if (parsed.tool === "clip" && parsed.clipId) return false;
  }
  return true;
}
