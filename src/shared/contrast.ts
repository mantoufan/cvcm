export type Rgb = { r: number; g: number; b: number };

/** `#rgb` or `#rrggbb`, with or without `#`. */
export function parseHex(value: string): Rgb | null {
  const s = value.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(s)) return null;
  const full = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function toHex({ r, g, b }: Rgb): string {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance, 0 (black) to 1 (white). */
export function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio, 1 to 21, order-independent. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

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
  const toward: Rgb = luminance(bg) > 0.5 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
  if (contrastRatio(toward, bg) < target) return null;
  for (let i = 1; i <= 100; i++) {
    const k = i / 100;
    const c: Rgb = {
      r: fg.r + (toward.r - fg.r) * k,
      g: fg.g + (toward.g - fg.g) * k,
      b: fg.b + (toward.b - fg.b) * k,
    };
    const rounded = parseHex(toHex(c));
    if (rounded && contrastRatio(rounded, bg) >= target) return rounded;
  }
  return toward;
}
