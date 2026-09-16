export function normalizeDegrees(degrees: number): number {
  if (!Number.isFinite(degrees)) return 0;
  const n = degrees % 360;
  return n < 0 ? n + 360 : n;
}

export function rotatedSize(srcW: number, srcH: number, degrees: number): { width: number; height: number } {
  const w = Math.max(1, srcW);
  const h = Math.max(1, srcH);
  const rad = (normalizeDegrees(degrees) * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  return {
    width: Math.max(1, Math.round(w * c + h * s)),
    height: Math.max(1, Math.round(w * s + h * c)),
  };
}
