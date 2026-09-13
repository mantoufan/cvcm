export type ResizeMode =
  | { kind: "exact"; width: number; height: number; lock: boolean }
  | { kind: "max-edge"; edge: number }
  | { kind: "percent"; pct: number };

export function targetSize(
  srcW: number,
  srcH: number,
  mode: ResizeMode,
): { width: number; height: number } {
  const w0 = Math.max(1, srcW);
  const h0 = Math.max(1, srcH);
  if (mode.kind === "percent") {
    const s = Math.max(1, Math.min(400, mode.pct)) / 100;
    return {
      width: Math.max(1, Math.round(w0 * s)),
      height: Math.max(1, Math.round(h0 * s)),
    };
  }
  if (mode.kind === "max-edge") {
    const edge = Math.max(1, mode.edge);
    const s = Math.min(1, edge / Math.max(w0, h0));
    return {
      width: Math.max(1, Math.round(w0 * s)),
      height: Math.max(1, Math.round(h0 * s)),
    };
  }
  let width = Math.max(1, Math.round(mode.width || w0));
  let height = Math.max(1, Math.round(mode.height || h0));
  if (mode.lock) {
    const s = Math.min(width / w0, height / h0);
    width = Math.max(1, Math.round(w0 * s));
    height = Math.max(1, Math.round(h0 * s));
  }
  return { width, height };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
