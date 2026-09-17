const MAP: Array<[number, string]> = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

export function toRoman(n: number): string | null {
  if (!Number.isInteger(n) || n < 1 || n > 3999) return null;
  let left = n;
  let out = "";
  for (const [value, glyph] of MAP) {
    while (left >= value) {
      out += glyph;
      left -= value;
    }
  }
  return out;
}

export function fromRoman(raw: string): number | null {
  const s = raw.trim().toUpperCase();
  if (!s || /[^MDCLXVI]/.test(s)) return null;
  let i = 0;
  let total = 0;
  for (const [value, glyph] of MAP) {
    while (s.startsWith(glyph, i)) {
      total += value;
      i += glyph.length;
    }
  }
  if (i !== s.length) return null;
  if (toRoman(total) !== s) return null;
  return total;
}
