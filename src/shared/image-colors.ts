/** Dominant colors from RGBA pixels: median cut for a stable start, then a few k-means passes to settle the centers. */

export type Rgb = [number, number, number];
export type PaletteColor = { rgb: Rgb; hex: string; share: number };

export const MIN_COLORS = 2;
export const MAX_COLORS = 12;

export function rgbToHex([r, g, b]: Rgb): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** Opaque pixels only (alpha ≥ 128), as RGB triples. */
export function opaquePixels(data: ArrayLike<number>): Rgb[] {
  const out: Rgb[] = [];
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    out.push([data[i], data[i + 1], data[i + 2]]);
  }
  return out;
}

function channelRange(box: Rgb[], c: number): number {
  let lo = 255;
  let hi = 0;
  for (const p of box) {
    if (p[c] < lo) lo = p[c];
    if (p[c] > hi) hi = p[c];
  }
  return hi - lo;
}

function mean(box: Rgb[]): Rgb {
  let r = 0, g = 0, b = 0;
  for (const p of box) { r += p[0]; g += p[1]; b += p[2]; }
  const n = box.length || 1;
  return [r / n, g / n, b / n];
}

function medianCut(pixels: Rgb[], k: number): Rgb[] {
  const boxes: Rgb[][] = [pixels.slice()];
  while (boxes.length < k) {
    // Split the box with the widest channel spread (weighted by size so tiny boxes are not split first).
    let best = -1;
    let bestScore = 0;
    let bestChannel = 0;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      for (let c = 0; c < 3; c++) {
        const score = channelRange(box, c) * Math.sqrt(box.length);
        if (score > bestScore) { bestScore = score; best = i; bestChannel = c; }
      }
    });
    if (best < 0) break;
    const box = boxes[best].sort((a, b) => a[bestChannel] - b[bestChannel]);
    const mid = box.length >> 1;
    boxes.splice(best, 1, box.slice(0, mid), box.slice(mid));
  }
  return boxes.map(mean);
}

function dist2(a: Rgb, b: Rgb): number {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

/** Up to k colors, most common first, with each one's share of opaque pixels (0–1). Deterministic for the same input. */
export function extractPalette(data: ArrayLike<number>, k: number, iterations = 8): PaletteColor[] {
  const count = Math.max(MIN_COLORS, Math.min(MAX_COLORS, Math.round(k)));
  const pixels = opaquePixels(data);
  if (!pixels.length) return [];
  let centers = medianCut(pixels, count);
  const assign = new Int32Array(pixels.length);
  for (let pass = 0; pass <= iterations; pass++) {
    for (let i = 0; i < pixels.length; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d = dist2(pixels[i], centers[c]);
        if (d < bestD) { bestD = d; best = c; }
      }
      assign[i] = best;
    }
    if (pass === iterations) break;
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < pixels.length; i++) {
      const s = sums[assign[i]];
      s[0] += pixels[i][0]; s[1] += pixels[i][1]; s[2] += pixels[i][2]; s[3] += 1;
    }
    centers = centers.map((c, i) => (sums[i][3] ? [sums[i][0] / sums[i][3], sums[i][1] / sums[i][3], sums[i][2] / sums[i][3]] : c));
  }
  const sizes = new Array<number>(centers.length).fill(0);
  for (let i = 0; i < pixels.length; i++) sizes[assign[i]] += 1;
  // Merge centers that round to the same hex (flat images with fewer colors than k).
  const byHex = new Map<string, PaletteColor>();
  centers.forEach((c, i) => {
    if (!sizes[i]) return;
    const rgb: Rgb = [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])];
    const hex = rgbToHex(rgb);
    const prev = byHex.get(hex);
    if (prev) prev.share += sizes[i] / pixels.length;
    else byHex.set(hex, { rgb, hex, share: sizes[i] / pixels.length });
  });
  return [...byHex.values()].sort((a, b) => b.share - a.share || a.hex.localeCompare(b.hex));
}

/** Scale (w, h) down so the longer side is at most max; sampling a small copy keeps k-means fast. */
export function sampleSize(width: number, height: number, max = 160): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height, 1));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
