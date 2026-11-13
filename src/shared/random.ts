export function randomInt(min: number, max: number): number {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return 0;
  const span = hi - lo + 1;
  if (span <= 1) return lo;
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return lo + (buf[0]! % span);
}

export function randomInts(min: number, max: number, count: number): number[] {
  const n = Math.max(1, Math.min(200, Math.round(count) || 1));
  return Array.from({ length: n }, () => randomInt(min, max));
}

/**
 * Uniform integer in [0, n) from Web Crypto, rejecting the top of the range that would bias small values.
 * `rand` fills the buffer (tests pass a fake).
 */
export function randomBelow(n: number, rand: (buf: Uint32Array) => Uint32Array = (b) => crypto.getRandomValues(b)): number {
  if (n <= 1) return 0;
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  const buf = new Uint32Array(1);
  do rand(buf);
  while (buf[0]! >= limit);
  return buf[0]! % n;
}

/**
 * mulberry32: a small seeded generator, so the same seed gives the same sudoku, colour plate or watermark layout
 * everywhere. Never change its sequence: invisible watermarks already in images decode with it (blind.ts), and
 * sudoku puzzle numbers name its output.
 */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}
