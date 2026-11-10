/** GIF maker geometry and timing: output size, how a frame sits in it, and which moments of a video become frames. */

/** Most frames one GIF may have (memory and encode time grow with each). */
export const MAX_FRAMES = 300;

export type Fit = "contain" | "cover";

/** Output size: `width` wide (never wider than the source) with the source's shape, at least 1 px each way. */
export function gifSize(srcW: number, srcH: number, width: number): { width: number; height: number } {
  const w = Math.max(1, Math.min(Math.round(width), Math.round(srcW)));
  return { width: w, height: Math.max(1, Math.round((w * srcH) / Math.max(1, srcW))) };
}

export type FrameRect = { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number };

/**
 * Where a source of another shape goes in a w × h frame: "contain" shows all of it centred (the background shows on
 * two sides), "cover" fills the frame and trims the overflow evenly.
 */
export function fitFrame(srcW: number, srcH: number, w: number, h: number, fit: Fit): FrameRect {
  const sw = Math.max(1, srcW);
  const sh = Math.max(1, srcH);
  if (fit === "cover") {
    const scale = Math.max(w / sw, h / sh);
    const cw = w / scale;
    const ch = h / scale;
    return { sx: (sw - cw) / 2, sy: (sh - ch) / 2, sw: cw, sh: ch, dx: 0, dy: 0, dw: w, dh: h };
  }
  const scale = Math.min(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  return { sx: 0, sy: 0, sw, sh, dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh };
}

/**
 * Times (seconds) to grab from a video: every 1/fps from `start` while before `end`, clipped to the clip's length.
 * Each frame is sampled at its middle, so the last frame never asks for the very end, where some browsers show black.
 */
export function frameTimes(start: number, end: number, fps: number, duration: number): number[] {
  const lo = Math.max(0, start);
  const hi = duration > 0 ? Math.min(end, duration) : end;
  const step = 1 / Math.max(1, fps);
  if (!(hi > lo)) return [];
  const n = Math.max(1, Math.round((hi - lo) / step));
  // Past MAX_FRAMES the caller refuses the job; one extra is enough to say so without building a huge list.
  return Array.from({ length: Math.min(n, MAX_FRAMES + 1) }, (_, i) => lo + (i + 0.5) * ((hi - lo) / n));
}
