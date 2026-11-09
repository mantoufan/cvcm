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

/**
 * Real resolution from the CSS screen size. Browsers round (or floor) the CSS size, so at 150% a 2560 × 1440 screen
 * reports 1707 × 960, which multiplies back to 2561. Look at every pixel count within one CSS pixel: a common
 * resolution there wins; otherwise each side takes the count with the most factors of 2 (panel sizes are multiples
 * of 8, or at least even), then the nearest. A whole-number ratio is exact already.
 */
export function realResolution(cssW: number, cssH: number, dpr: number): { w: number; h: number } {
  const r = dpr > 0 ? dpr : 1;
  if (Number.isInteger(r)) return { w: Math.round(cssW * r), h: Math.round(cssH * r) };
  const ws = candidates(cssW, r);
  const hs = candidates(cssH, r);
  for (const [a, b] of NAMES) {
    if (ws.includes(a) && hs.includes(b)) return { w: a, h: b };
    if (ws.includes(b) && hs.includes(a)) return { w: b, h: a };
  }
  return { w: bestSide(ws, cssW * r), h: bestSide(hs, cssH * r) };
}

/** Pixel counts that a browser could report as this CSS size, rounding any way. */
function candidates(css: number, r: number): number[] {
  const out: number[] = [];
  for (let px = Math.floor((css - 1) * r) + 1; px < (css + 1) * r; px++) out.push(px);
  return out.length ? out : [Math.round(css * r)];
}

function bestSide(options: number[], exact: number): number {
  let best = Math.round(exact);
  let bestScore = -Infinity;
  for (const px of options) {
    let twos = 0;
    for (let v = px; v > 0 && v % 2 === 0 && twos < 3; v /= 2) twos++;
    const score = twos * 10 - Math.abs(px - exact);
    if (score > bestScore) {
      best = px;
      bestScore = score;
    }
  }
  return best;
}
