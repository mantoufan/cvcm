/** The coverage grid of the touch test: the pad is split into this many cells whatever its size. */
export const TOUCH_COLS = 8;
export const TOUCH_ROWS = 12;

/** Grid cell under a point of a `width` × `height` pad, or -1 outside it. */
export function cellAt(x: number, y: number, width: number, height: number, cols = TOUCH_COLS, rows = TOUCH_ROWS): number {
  if (!(width > 0) || !(height > 0) || !(x >= 0) || !(y >= 0) || x > width || y > height) return -1;
  const c = Math.min(cols - 1, Math.floor((x / width) * cols));
  const r = Math.min(rows - 1, Math.floor((y / height) * rows));
  return r * cols + c;
}

/** Cells crossed by a straight stroke from (x0, y0) to (x1, y1), so a fast swipe leaves no gaps (sampled every pixel, so a clipped corner counts). */
export function cellsAlong(x0: number, y0: number, x1: number, y1: number, width: number, height: number, cols = TOUCH_COLS, rows = TOUCH_ROWS): number[] {
  const n = width > 0 && height > 0 ? Math.min(5000, Math.ceil(Math.hypot(x1 - x0, y1 - y0))) : 0;
  const out = new Set<number>();
  for (let i = 0; i <= n; i++) {
    const f = n ? i / n : 1;
    const cell = cellAt(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, width, height, cols, rows);
    if (cell >= 0) out.add(cell);
  }
  return [...out];
}

/** Share of cells touched, as a whole percent. */
export function coveragePercent(touched: number, total = TOUCH_COLS * TOUCH_ROWS): number {
  if (!(total > 0)) return 0;
  return Math.round((Math.max(0, Math.min(touched, total)) / total) * 100);
}
