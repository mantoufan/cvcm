export type RGB = { r: number; g: number; b: number };
export type HSL = { h: number; s: number; l: number };

function clamp(n: number, min = 0, max = 255): number {
  return Math.min(max, Math.max(min, n));
}

export function hexToRgb(hex: string): RGB | null {
  const raw = hex.trim().replace(/^#/, "");
  const full = raw.length === 3
    ? raw.split("").map((c) => c + c).join("")
    : raw.length === 8
      ? raw.slice(0, 6)
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const h = (n: number) => clamp(Math.round(n)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === R) h = ((G - B) / d + (G < B ? 6 : 0)) / 6;
  else if (max === G) h = ((B - R) / d + 2) / 6;
  else h = ((R - G) / d + 4) / 6;
  return { h, s, l };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const hue = ((h % 1) + 1) % 1;
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const tk = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return {
    r: Math.round(tk(hue + 1 / 3) * 255),
    g: Math.round(tk(hue) * 255),
    b: Math.round(tk(hue - 1 / 3) * 255),
  };
}

export function formatRgb({ r, g, b }: RGB): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

export function formatHsl({ h, s, l }: HSL): string {
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

export function parseColor(input: string): RGB | null {
  const text = input.trim();
  const hex = hexToRgb(text);
  if (hex) return hex;
  const rgb = text.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) return { r: clamp(+rgb[1]), g: clamp(+rgb[2]), b: clamp(+rgb[3]) };
  const hsl = text.match(/^hsla?\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%/i);
  if (hsl) {
    return hslToRgb({ h: (+hsl[1] % 360) / 360, s: clamp(+hsl[2], 0, 100) / 100, l: clamp(+hsl[3], 0, 100) / 100 });
  }
  return null;
}

function linear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance({ r, g, b }: RGB): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrastRatio(a: RGB, b: RGB): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}
