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
