/** Screen resolution helpers: reduced aspect ratio and the common name of a resolution. */

import { gcd } from "./aspect";

/** Marketing ratios that do not reduce cleanly (2560×1080 is 64:27, sold as 21:9). */
const NAMED_RATIOS: Array<[number, string]> = [
  [16 / 9, "16:9"],
  [16 / 10, "16:10"],
  [4 / 3, "4:3"],
  [5 / 4, "5:4"],
  [3 / 2, "3:2"],
  [21 / 9, "21:9"],
  [64 / 27, "21:9"],
  [43 / 18, "21:9"],
  [32 / 9, "32:9"],
  [19.5 / 9, "19.5:9"],
  [20 / 9, "20:9"],
  [18 / 9, "18:9"],
];

/** "16:9" for 1920×1080; near-standard ratios get their usual name; otherwise the reduced fraction. Portrait keeps the long side first. */
export function aspectRatio(w: number, h: number): string {
  if (w <= 0 || h <= 0) return "—";
  const long = Math.max(w, h);
  const short = Math.min(w, h);
  const r = long / short;
  for (const [v, name] of NAMED_RATIOS) if (Math.abs(r - v) / v < 0.012) return name;
  const g = gcd(Math.round(long), Math.round(short)) || 1;
  const a = Math.round(long) / g;
  const b = Math.round(short) / g;
  return a <= 64 && b <= 64 ? `${a}:${b}` : `${r.toFixed(2)}:1`;
}

const NAMES: Array<[number, number, string]> = [
  [7680, 4320, "8K UHD"],
  [5120, 2880, "5K"],
  [3840, 2160, "4K UHD"],
  [3440, 1440, "UWQHD"],
  [2560, 1600, "WQXGA"],
  [2560, 1440, "QHD (1440p)"],
  [2560, 1080, "UW-FHD"],
  [1920, 1200, "WUXGA"],
  [1920, 1080, "Full HD (1080p)"],
  [1680, 1050, "WSXGA+"],
  [1600, 900, "HD+"],
  [1440, 900, "WXGA+"],
  [1366, 768, "HD (WXGA)"],
  [1280, 800, "WXGA"],
  [1280, 720, "HD (720p)"],
  [1280, 1024, "SXGA"],
  [1024, 768, "XGA"],
];

/** "Full HD (1080p)" for 1920×1080 in either orientation; null for sizes without a common name. */
export function resolutionName(w: number, h: number): string | null {
  const long = Math.round(Math.max(w, h));
  const short = Math.round(Math.min(w, h));
  for (const [a, b, name] of NAMES) if (a === long && b === short) return name;
  return null;
}

/** Physical pixels from CSS pixels × devicePixelRatio, rounded (Windows 125% gives 1536 × 1.25 = 1920). */
export function physical(cssPx: number, dpr: number): number {
  return Math.round(cssPx * (dpr > 0 ? dpr : 1));
}

/** Panel sizes without a common name that scaled laptops and tablets report (Surface, MacBook, 3:2 and 16:10 panels). */
const KNOWN: ReadonlyArray<readonly [number, number]> = [
  [2256, 1504], [2736, 1824], [2880, 1920], [3000, 2000], [1920, 1280], [2560, 1664], [2880, 1864], [2940, 1912],
  [3024, 1964], [3456, 2234], [2880, 1800], [3840, 2400], [2560, 1700], [3200, 2000], [3200, 1800], [2400, 1600],
  [2048, 1536], [2360, 1640], [2388, 1668], [2732, 2048], [2160, 1440], [1600, 1200], [1080, 2400], [1080, 2340],
  [1440, 3200], [1440, 3120], [1170, 2532], [1179, 2556], [1290, 2796], [1284, 2778],
];
const SNAP: ReadonlyArray<readonly [number, number]> = [...NAMES.map(([a, b]) => [a, b] as const), ...KNOWN];

/**
 * Real resolution from the CSS screen size. With a fractional ratio browsers round (or floor) the CSS size, so at
 * 150% a 2560 × 1440 screen reports 1707 × 960 (2560.5) or 1706 × 960 (2559). In order:
 * 1. a known resolution within one CSS pixel on both sides (the nearest one);
 * 2. a whole-number product, which is exact;
 * 3. per side, among the pixel counts that round or floor to the reported size, the one with the most factors of 2
 *    (panel sides are multiples of 8, or at least even), then the nearest.
 */
export function realResolution(cssW: number, cssH: number, dpr: number): { w: number; h: number } {
  const r = dpr > 0 ? dpr : 1;
  const w = cssW * r;
  const h = cssH * r;
  if (Number.isInteger(r)) return { w: Math.round(w), h: Math.round(h) };
  let best: { w: number; h: number } | null = null;
  let bestDist = Infinity;
  for (const [a, b] of SNAP) {
    for (const [x, y] of [[a, b], [b, a]] as const) {
      const dist = Math.abs(x - w) + Math.abs(y - h);
      if (Math.abs(x - w) < r && Math.abs(y - h) < r && dist < bestDist) {
        best = { w: x, h: y };
        bestDist = dist;
      }
    }
  }
  if (best) return best;
  return { w: side(cssW, r), h: side(cssH, r) };
}

function side(css: number, r: number): number {
  const exact = css * r;
  if (Number.isInteger(exact)) return exact;
  let pick = Math.round(exact);
  let pickScore = -Infinity;
  for (let px = Math.ceil((css - 0.5) * r); px < (css + 1) * r; px++) {
    if (Math.round(px / r) !== css && Math.floor(px / r) !== css) continue;
    let twos = 0;
    for (let v = px; v > 0 && v % 2 === 0 && twos < 3; v /= 2) twos++;
    const score = twos * 10 - Math.abs(px - exact);
    if (score > pickScore) {
      pick = px;
      pickScore = score;
    }
  }
  return pick;
}
