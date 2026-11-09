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

/** Panel sizes without a common name that scaled screens often report (Surface, MacBook, 3:2 laptops). */
const KNOWN: Array<[number, number]> = [
  [2256, 1504], [2736, 1824], [2880, 1920], [3000, 2000], [1920, 1280], [2560, 1664], [2880, 1864],
  [2940, 1912], [3024, 1964], [3456, 2234], [2880, 1800], [3840, 2400], [2560, 1700],
];

/** Physical pixels from CSS pixels × devicePixelRatio, rounded (Windows 125% gives 1536 × 1.25 = 1920). */
export function physical(cssPx: number, dpr: number): number {
  return Math.round(cssPx * (dpr > 0 ? dpr : 1));
}

/**
 * Real resolution from the CSS screen size. Browsers round the CSS size, so at 150% a 2560 × 1440 screen reports
 * 1707 × 960 and multiplies back to 2561 × 1440: snap to a known resolution within the rounding error.
 */
export function realResolution(cssW: number, cssH: number, dpr: number): { w: number; h: number } {
  const w = physical(cssW, dpr);
  const h = physical(cssH, dpr);
  const slack = Math.ceil(dpr > 0 ? dpr : 1);
  const sizes: Array<[number, number]> = [...NAMES.map(([a, b]) => [a, b] as [number, number]), ...KNOWN];
  for (const [a, b] of sizes) {
    for (const [x, y] of [[a, b], [b, a]] as const) {
      if (Math.abs(w - x) <= slack && Math.abs(h - y) <= slack) return { w: x, h: y };
    }
  }
  return { w, h };
}
