export function percentOf(n: number, pct: number): number {
  return n * (pct / 100);
}

export function isWhatPercent(part: number, whole: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole === 0) return null;
  return (part / whole) * 100;
}

export function changeByPercent(n: number, pct: number): number {
  return n * (1 + pct / 100);
}

export function percentChange(from: number, to: number): number | null {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return null;
  return ((to - from) / from) * 100;
}

export function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
  return String(Number(n.toPrecision(digits)));
}
