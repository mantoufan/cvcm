import { contrastRatio, hexToRgb, rgbToHex, type RGB } from "./color";

type Rgb = RGB;

export const AA_NORMAL = 4.5;
export const AA_LARGE = 3;
export const AAA_NORMAL = 7;
export const AAA_LARGE = 4.5;
/** Non-text contrast (WCAG 1.4.11): UI components and graphical objects. */
export const UI_MIN = 3;

export type ContrastLevels = {
  ratio: number;
  aaNormal: boolean;
  aaLarge: boolean;
  aaaNormal: boolean;
  aaaLarge: boolean;
  ui: boolean;
};

export function contrastLevels(fg: Rgb, bg: Rgb): ContrastLevels {
  const ratio = contrastRatio(fg, bg);
  return {
    ratio,
    aaNormal: ratio >= AA_NORMAL,
    aaLarge: ratio >= AA_LARGE,
    aaaNormal: ratio >= AAA_NORMAL,
    aaaLarge: ratio >= AAA_LARGE,
    ui: ratio >= UI_MIN,
  };
}

/**
 * Darkens or lightens `fg` (toward black or white, whichever already helps) in small steps until the pair
 * reaches `target`. Null when even black or white cannot reach it against `bg`.
 */
export function suggestForeground(fg: Rgb, bg: Rgb, target = AA_NORMAL): Rgb | null {
  if (contrastRatio(fg, bg) >= target) return fg;
  const black: Rgb = { r: 0, g: 0, b: 0 };
  const white: Rgb = { r: 255, g: 255, b: 255 };
  const toward = contrastRatio(black, bg) >= contrastRatio(white, bg) ? black : white;
  if (contrastRatio(toward, bg) < target) return null;
  for (let i = 1; i <= 100; i++) {
    const k = i / 100;
    const c: Rgb = {
      r: fg.r + (toward.r - fg.r) * k,
      g: fg.g + (toward.g - fg.g) * k,
      b: fg.b + (toward.b - fg.b) * k,
    };
    const rounded = hexToRgb(rgbToHex(c));
    if (rounded && contrastRatio(rounded, bg) >= target) return rounded;
  }
  return toward;
}
