/** Image splitter: cut one picture into a rows × columns grid of tiles. */

export const MAX_GRID = 20;

export type Rect = { x: number; y: number; width: number; height: number };
export type Tile = Rect & { row: number; col: number; index: number };

/** Common grids: Instagram's three-across profile rows, the 3 × 3 nine-grid, carousel panoramas. */
export const SPLIT_PRESETS = [
  { id: "grid3x3", rows: 3, cols: 3, square: true },
  { id: "grid2x2", rows: 2, cols: 2, square: true },
  { id: "row1x3", rows: 1, cols: 3, square: true },
  { id: "row1x2", rows: 1, cols: 2, square: false },
  { id: "col2x1", rows: 2, cols: 1, square: false },
  { id: "grid3x2", rows: 2, cols: 3, square: true },
] as const;

/**
 * The part of the picture that is cut. With `square` every tile is square: the largest rows × cols block of squares
 * that fits, centred (the rest is trimmed evenly from both sides). Otherwise the whole picture.
 */
export function cropArea(width: number, height: number, rows: number, cols: number, square: boolean): Rect {
  if (!square) return { x: 0, y: 0, width, height };
  const side = Math.floor(Math.min(width / cols, height / rows));
  const w = side * cols;
  const h = side * rows;
  return { x: Math.floor((width - w) / 2), y: Math.floor((height - h) / 2), width: w, height: h };
}

/**
 * Tiles in reading order (left to right, top to bottom). Edges are rounded from exact fractions, so the tiles cover
 * the area with no gap or overlap and differ by at most one pixel when the size does not divide evenly.
 */
export function splitGrid(area: Rect, rows: number, cols: number): Tile[] {
  const r = clampGrid(rows);
  const c = clampGrid(cols);
  const xs = Array.from({ length: c + 1 }, (_, i) => area.x + Math.round((i * area.width) / c));
  const ys = Array.from({ length: r + 1 }, (_, i) => area.y + Math.round((i * area.height) / r));
  const tiles: Tile[] = [];
  for (let row = 0; row < r; row++) {
    for (let col = 0; col < c; col++) {
      tiles.push({ row, col, index: row * c + col, x: xs[col]!, y: ys[row]!, width: xs[col + 1]! - xs[col]!, height: ys[row + 1]! - ys[row]! });
    }
  }
  return tiles;
}

export function clampGrid(n: number): number {
  return Math.min(MAX_GRID, Math.max(1, Math.round(Number.isFinite(n) ? n : 1)));
}

/**
 * Instagram shows the newest post first, top left, so a grid is posted from the last tile back to the first.
 * Returns the 1-based posting order for each tile index.
 */
export function postingOrder(count: number): number[] {
  return Array.from({ length: count }, (_, i) => count - i);
}

/** File name for a tile: stem-r1-c2.png, numbered from 1, padded so the files sort in reading order. */
export function tileName(stem: string, tile: Tile, rows: number, cols: number, ext: string): string {
  const pad = (n: number, max: number) => String(n).padStart(String(max).length, "0");
  return `${stem}-r${pad(tile.row + 1, rows)}-c${pad(tile.col + 1, cols)}.${ext}`;
}
