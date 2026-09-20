export type Aspect = { w: number; h: number; ratio: string; decimal: number };

export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

export function aspectOf(width: number, height: number): Aspect | null {
  if (![width, height].every(Number.isFinite)) return null;
  if (width <= 0 || height <= 0) return null;
  const wi = Math.round(width);
  const hi = Math.round(height);
  const g = gcd(wi, hi);
  if (!g) return null;
  const w = wi / g;
  const h = hi / g;
  return { w, h, ratio: `${w}:${h}`, decimal: wi / hi };
}
