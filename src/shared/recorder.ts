/** Shared helpers for the voice and screen recorders: container choice, file names and readouts. */

import { shortClock } from "./subtitles";

/** Audio containers in order of preference. Chrome/Firefox record WebM Opus, Safari only MP4 (AAC). */
export const AUDIO_TYPES = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm"] as const;

/** Video containers: MP4 first where the browser can write it (Safari, Chrome 126+), else WebM. */
export const VIDEO_MP4_TYPES = ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4;codecs=avc1,opus", "video/mp4"] as const;
export const VIDEO_WEBM_TYPES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"] as const;

/** Longest recording kept in memory; recordings stay in the tab as Blobs, so this guards against filling RAM. */
export const MAX_VOICE_MINUTES = 120;
export const MAX_SCREEN_MINUTES = 60;

/** First type the browser accepts, or "" to let MediaRecorder choose. */
export function pickType(candidates: readonly string[], supported: (type: string) => boolean): string {
  for (const type of candidates) {
    try {
      if (supported(type)) return type;
    } catch {
      // Some browsers throw on unknown codecs instead of returning false.
    }
  }
  return "";
}

/** File extension for a recorded MIME type ("audio/webm;codecs=opus" → "webm", MP4 audio → "m4a"). */
export function extensionFor(mime: string): string {
  const base = mime.split(";")[0].trim().toLowerCase();
  if (base === "audio/mp4" || base === "audio/x-m4a" || base === "audio/aac") return "m4a";
  if (base === "video/mp4") return "mp4";
  if (base === "audio/ogg") return "ogg";
  if (base === "video/x-matroska") return "mkv";
  if (base.endsWith("/webm")) return "webm";
  if (base === "audio/wav" || base === "audio/wave") return "wav";
  return "webm";
}

/** `prefix-2026-11-10-143005.ext` in local time. */
export function recordingName(prefix: string, at: Date, ext: string): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${prefix}-${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}-${p(at.getHours())}${p(at.getMinutes())}${p(at.getSeconds())}.${ext}`;
}

/** Elapsed time as m:ss or h:mm:ss (whole seconds, rounded down). */
export function clockText(ms: number): string {
  return shortClock(ms / 1000);
}

/**
 * Wall-clock time spent recording, excluding pauses. `startedAt` is when recording began (or resumed);
 * `banked` holds what was recorded before the last pause.
 */
export function elapsedMs(banked: number, startedAt: number | null, now: number): number {
  return banked + (startedAt === null ? 0 : Math.max(0, now - startedAt));
}
