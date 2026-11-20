/**
 * Geometry for the ID photo maker: where the crop sits on the photo, the head guides, the print sheet layout, a file
 * size limit for online forms, and the DPI field of the JPEG. Pure functions, so tests cover them without a canvas.
 */
import type { IdPhotoSpec } from "./id-photo-specs";

export const DPI = 300;
const MM_PER_INCH = 25.4;

export type Rect = { x: number; y: number; w: number; h: number };

export function mmToPx(mm: number, dpi = DPI): number {
  return Math.max(1, Math.round((mm / MM_PER_INCH) * dpi));
}

/** Output pixels at 300 DPI (a 35 × 45 mm photo is 413 × 531 px). */
export function specPixels(spec: IdPhotoSpec, dpi = DPI): { w: number; h: number } {
  return { w: mmToPx(spec.w, dpi), h: mmToPx(spec.h, dpi) };
}

/** Head height the placement aims for: the middle of the rule, or 60 % of the photo when there is none. */
export function targetHeadMm(spec: IdPhotoSpec): number {
  return spec.head ? (spec.head[0] + spec.head[1]) / 2 : spec.h * 0.6;
}

/**
 * The guide lines in mm from the photo's top: where the top of the head goes, and the band the chin must fall in
 * (only for sizes with a head rule).
 */
export function guides(spec: IdPhotoSpec): { top: number; chin: readonly [number, number] | null } {
  const top = spec.top ? (spec.top[0] + spec.top[1]) / 2 : (spec.h - targetHeadMm(spec)) * 0.4;
  return { top, chin: spec.head ? [top + spec.head[0], top + spec.head[1]] : null };
}

export type HeadEstimate = { top: number; chin: number; cx: number };

/**
 * A rough head position from the background model's mask (alpha 0–255, row-major): the first row with enough of the
 * person is the top of the head; the head is as wide as the widest row before the shoulders spread out, and the chin
 * sits about 1.35 head widths below the top (or where the shoulders start, if sooner). An estimate to adjust by hand.
 * `colAspect` is how wide one mask column is in mask rows: the model's square mask stretches the photo, so a
 * 4000 × 3000 photo's 1024 × 1024 mask has colAspect 4/3.
 */
export function estimateHead(mask: ArrayLike<number>, width: number, height: number, colAspect = 1): HeadEstimate | null {
  if (width < 4 || height < 4 || mask.length < width * height) return null;
  const counts = new Float64Array(height);
  const sums = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    let c = 0;
    let s = 0;
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (mask[row + x] >= 128) {
        c++;
        s += x;
      }
    }
    counts[y] = c;
    sums[y] = s;
  }
  const minCount = Math.max(2, width * 0.01);
  let top = -1;
  for (let y = 0; y < height; y++) {
    // Two rows in a row, so a stray speck above the head is not the top.
    if (counts[y] >= minCount && (y + 1 >= height || counts[y + 1] >= minCount)) {
      top = y;
      break;
    }
  }
  if (top < 0) return null;
  let widest = 0;
  let shoulders = -1;
  for (let y = top; y < height; y++) {
    const c = counts[y] * colAspect;
    if (y - top > widest * 0.9 && widest > 0 && c > widest * 1.3) {
      shoulders = y;
      break;
    }
    if (c > widest) widest = c;
  }
  let chin = top + widest * 1.35;
  if (shoulders > 0) chin = Math.min(chin, shoulders);
  chin = Math.min(height - 1, Math.max(top + 1, chin));
  let n = 0;
  let s = 0;
  for (let y = top; y <= Math.floor(chin); y++) {
    n += counts[y];
    s += sums[y];
  }
  return { top, chin, cx: n ? s / n : width / 2 };
}

/** The crop for a head found at `head` (image px), so it matches the size's guides. */
export function placeCrop(spec: IdPhotoSpec, head: HeadEstimate): Rect {
  const pxPerMm = (head.chin - head.top) / targetHeadMm(spec);
  const w = spec.w * pxPerMm;
  const h = spec.h * pxPerMm;
  return { x: head.cx - w / 2, y: head.top - guides(spec).top * pxPerMm, w, h };
}

/** Without a mask: the largest crop of the size's shape that fits, centred, a little above the middle. */
export function defaultCrop(spec: IdPhotoSpec, imgW: number, imgH: number): Rect {
  const aspect = spec.w / spec.h;
  let h = imgH * 0.92;
  let w = h * aspect;
  if (w > imgW * 0.92) {
    w = imgW * 0.92;
    h = w / aspect;
  }
  return { x: (imgW - w) / 2, y: (imgH - h) * 0.35, w, h };
}

/** Keeps the crop's shape when the size changes, around the same centre and head scale (by height). */
export function reshapeCrop(crop: Rect, from: IdPhotoSpec, to: IdPhotoSpec): Rect {
  const pxPerMm = crop.h / from.h * (targetHeadMm(from) / targetHeadMm(to));
  const topLine = crop.y + guides(from).top * (crop.h / from.h);
  const w = to.w * pxPerMm;
  const h = to.h * pxPerMm;
  const cx = crop.x + crop.w / 2;
  return { x: cx - w / 2, y: topLine - guides(to).top * pxPerMm, w, h };
}

/** Zoom by `factor` (>1 shows the face larger, so the crop gets smaller) around the crop's centre. */
export function zoomCrop(crop: Rect, factor: number, imgW: number, imgH: number): Rect {
  const minH = Math.max(8, imgH * 0.05);
  const maxH = Math.max(imgH, imgW) * 3;
  const h = Math.min(maxH, Math.max(minH, crop.h / factor));
  const w = crop.w * (h / crop.h);
  const cx = crop.x + crop.w / 2;
  const cy = crop.y + crop.h / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** Moves the crop, keeping at least part of the photo inside it. */
export function moveCrop(crop: Rect, dx: number, dy: number, imgW: number, imgH: number): Rect {
  const x = Math.min(imgW - crop.w * 0.1, Math.max(-crop.w * 0.9, crop.x + dx));
  const y = Math.min(imgH - crop.h * 0.1, Math.max(-crop.h * 0.9, crop.y + dy));
  return { ...crop, x, y };
}

export type SheetPaper = "4x6" | "a4" | "letter";
/** Portrait paper sizes in mm. */
export const SHEET_MM: Record<SheetPaper, { w: number; h: number }> = {
  "4x6": { w: 101.6, h: 152.4 },
  a4: { w: 210, h: 297 },
  letter: { w: 215.9, h: 279.4 },
};

export type SheetLayout = {
  /** Paper size in mm as laid out (landscape when that fits more photos). */
  w: number;
  h: number;
  cols: number;
  rows: number;
  /** Top-left corner of each photo, mm. */
  cells: { x: number; y: number }[];
};

/** As many photos as fit with `gap` mm between them and `margin` mm to the edges, the grid centred. */
export function sheetLayout(paper: SheetPaper, photo: { w: number; h: number }, gap = 2, margin = 4): SheetLayout {
  const base = SHEET_MM[paper];
  const fits = (pw: number, ph: number) => ({
    cols: Math.max(0, Math.floor((pw - 2 * margin + gap) / (photo.w + gap))),
    rows: Math.max(0, Math.floor((ph - 2 * margin + gap) / (photo.h + gap))),
  });
  const portrait = fits(base.w, base.h);
  const landscape = fits(base.h, base.w);
  const useLandscape = landscape.cols * landscape.rows > portrait.cols * portrait.rows;
  const w = useLandscape ? base.h : base.w;
  const h = useLandscape ? base.w : base.h;
  const { cols, rows } = useLandscape ? landscape : portrait;
  const gridW = cols * photo.w + Math.max(0, cols - 1) * gap;
  const gridH = rows * photo.h + Math.max(0, rows - 1) * gap;
  const x0 = (w - gridW) / 2;
  const y0 = (h - gridH) / 2;
  const cells: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) cells.push({ x: x0 + c * (photo.w + gap), y: y0 + r * (photo.h + gap) });
  }
  return { w, h, cols, rows, cells };
}

export type FitResult<T> = { out: T; bytes: number; quality: number; scale: number };

/**
 * The best JPEG under `maxBytes`: the highest quality that fits (binary search from 0.95 down to 0.35); if even the
 * lowest is too big, the picture is scaled down 15 % at a time (never below `minScale`). `encode` returns the size.
 */
export async function fitToBytes<T>(
  encode: (quality: number, scale: number) => Promise<{ out: T; bytes: number }>,
  maxBytes: number,
  minScale = 0.25,
): Promise<FitResult<T> | null> {
  for (let scale = 1; scale >= minScale - 1e-9; scale *= 0.85) {
    const top = await encode(0.95, scale);
    if (top.bytes <= maxBytes) return { ...top, quality: 0.95, scale };
    let lo = 0.35;
    let hi = 0.95;
    let best: FitResult<T> | null = null;
    const low = await encode(lo, scale);
    if (low.bytes <= maxBytes) {
      best = { ...low, quality: lo, scale };
      for (let i = 0; i < 6; i++) {
        const mid = (lo + hi) / 2;
        const r = await encode(mid, scale);
        if (r.bytes <= maxBytes) {
          best = { ...r, quality: mid, scale };
          lo = mid;
        } else hi = mid;
      }
      return best;
    }
  }
  return null;
}

/**
 * Writes the print resolution into a JPEG's JFIF header (canvas JPEGs say "no unit, 1 × 1"), so photo labs and
 * printers place it at its real size. Adds a JFIF segment when there is none. Returns a new array.
 */
export function setJpegDpi(jpeg: Uint8Array, dpi = DPI): Uint8Array {
  if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return jpeg;
  const d = Math.max(1, Math.min(65535, Math.round(dpi)));
  if (jpeg[2] === 0xff && jpeg[3] === 0xe0 && jpeg.length >= 18 &&
      jpeg[6] === 0x4a && jpeg[7] === 0x46 && jpeg[8] === 0x49 && jpeg[9] === 0x46 && jpeg[10] === 0) {
    const out = jpeg.slice();
    out[13] = 1;
    out[14] = d >> 8;
    out[15] = d & 0xff;
    out[16] = d >> 8;
    out[17] = d & 0xff;
    return out;
  }
  const app0 = new Uint8Array([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, d >> 8, d & 0xff, d >> 8, d & 0xff, 0x00, 0x00]);
  const out = new Uint8Array(jpeg.length + app0.length);
  out.set(jpeg.subarray(0, 2), 0);
  out.set(app0, 2);
  out.set(jpeg.subarray(2), 2 + app0.length);
  return out;
}
