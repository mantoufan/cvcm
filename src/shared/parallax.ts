/** Camera paths for the photo-to-video tool (`/v/`): pure math, shared by the preview, the export and the tests. */

export const MOTIONS = ["push", "pull", "orbit", "pan", "rise"] as const;
export type Motion = (typeof MOTIONS)[number];

export const STRENGTHS = { subtle: 0.6, normal: 1, strong: 1.6 } as const;
export type Strength = keyof typeof STRENGTHS;

export const DURATIONS = [3, 5, 8] as const;
export type Duration = (typeof DURATIONS)[number];

export const ASPECTS = ["original", "9:16", "1:1", "16:9"] as const;
export type Aspect = (typeof ASPECTS)[number];

export const SIZES = [720, 1080] as const;
export type Size = (typeof SIZES)[number];

export const FPS = 30;

/**
 * Where the virtual camera is at one moment.
 * `ox` / `oy`: sideways shift in lengths of the frame's short side, per unit of depth away from the focus plane.
 * `zoom`: overall scale (above 1 hides the edges the shift would reveal).
 * `dolly`: extra scale for near layers, so moving forward makes the subject grow faster than the background.
 */
export type Camera = { ox: number; oy: number; zoom: number; dolly: number };

const ease = (x: number): number => 0.5 - 0.5 * Math.cos(Math.PI * x);

/**
 * The camera at `t` (0 → 1 over the clip). With `loop`, one-way moves go there and back so the last frame
 * meets the first; the orbit is a closed circle either way.
 */
export function cameraAt(motion: Motion, strength: number, t: number, loop: boolean): Camera {
  const x = Math.min(1, Math.max(0, t));
  // 0 → 1 → 0 for loops, an eased 0 → 1 otherwise.
  const p = loop ? 0.5 - 0.5 * Math.cos(2 * Math.PI * x) : ease(x);
  const s = strength;
  const margin = 1 + 0.06 * s;
  switch (motion) {
    case "push":
      return { ox: 0, oy: 0, zoom: margin + 0.1 * s * p, dolly: 0.18 * s * p };
    case "pull":
      return { ox: 0, oy: 0, zoom: margin + 0.1 * s * (1 - p), dolly: 0.18 * s * (1 - p) };
    case "orbit": {
      const a = 2 * Math.PI * x;
      return { ox: 0.035 * s * Math.sin(a), oy: 0.02 * s * (1 - Math.cos(a)) - 0.01 * s, zoom: margin + 0.02 * s, dolly: 0.04 * s };
    }
    case "pan":
      return { ox: 0.05 * s * (2 * p - 1), oy: 0, zoom: margin + 0.02 * s, dolly: 0.03 * s };
    case "rise":
      return { ox: 0, oy: 0.04 * s * (1 - 2 * p), zoom: margin + 0.04 * s * p, dolly: 0.06 * s * p };
  }
}

/** Frames in a clip. */
export function frameCount(seconds: number): number {
  return Math.round(seconds * FPS);
}

/** Output size in even pixels: the short side is `size` (never more than the cropped part of the photo), shaped as `aspect`. */
export function outputSize(photoW: number, photoH: number, aspect: Aspect, size: number): { width: number; height: number } {
  const ratio = aspect === "original" ? photoW / photoH : aspectRatio(aspect);
  const crop = cropRect(photoW, photoH, aspect);
  const short = Math.min(size, Math.max(2, Math.min(photoW * crop.w, photoH * crop.h)));
  let width = ratio >= 1 ? short * ratio : short;
  let height = ratio >= 1 ? short : short / ratio;
  // The encoder's first choice, H.264 level 4.0 (avc1.640028), covers 1920 × 1080 at 30 fps.
  const cap = 1920 / Math.max(width, height);
  if (cap < 1) {
    width *= cap;
    height *= cap;
  }
  return { width: even(width), height: even(height) };
}

/** The centred part of the photo shown for `aspect`, in 0–1 photo coordinates. */
export function cropRect(photoW: number, photoH: number, aspect: Aspect): { x: number; y: number; w: number; h: number } {
  if (aspect === "original") return { x: 0, y: 0, w: 1, h: 1 };
  const target = aspectRatio(aspect);
  const photo = photoW / photoH;
  if (photo > target) {
    const w = target / photo;
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  const h = photo / target;
  return { x: 0, y: (1 - h) / 2, w: 1, h };
}

function aspectRatio(aspect: Exclude<Aspect, "original">): number {
  const [w, h] = aspect.split(":").map(Number);
  return w / h;
}

function even(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}
