/** Image splitter: cut one picture into a rows × columns grid of tiles. */

export const MAX_GRID = 20;

export type Rect = { x: number; y: number; width: number; height: number };
export type Tile = Rect & { row: number; col: number; index: number };

/**
 * Width : height of a tile, or null for the whole picture as it is; the menu lists them in this order. Instagram's
 * profile grid has shown every post as a 3:4 thumbnail since 2025, so 3:4 tiles posted in order line up there; WeChat
 * Moments shows nine pictures as squares, so its nine-grid wants square tiles.
 */
export const TILE_RATIO = {
  whole: null,
  square: [1, 1],
  portrait: [3, 4],
} as const satisfies Record<string, readonly [number, number] | null>;
export type TileShape = keyof typeof TILE_RATIO;
export const TILE_SHAPES = Object.keys(TILE_RATIO) as TileShape[];

/** The shape a page starts on: square in zh-CN (WeChat Moments shows its nine-grid as squares), 3:4 elsewhere. */
export function defaultShape(locale: string): TileShape {
  return locale === "zh-CN" ? "square" : "portrait";
}

/** Common grids: Instagram's three-across profile rows (3:4 tiles), carousels (square slides), halves. */
export const SPLIT_PRESETS = [
  { id: "grid3x3", rows: 3, cols: 3, shape: "portrait" },
  { id: "grid3x3sq", rows: 3, cols: 3, shape: "square" },
  { id: "grid3x2", rows: 2, cols: 3, shape: "portrait" },
  { id: "row1x3", rows: 1, cols: 3, shape: "square" },
  { id: "grid2x2", rows: 2, cols: 2, shape: "square" },
  { id: "row1x2", rows: 1, cols: 2, shape: "whole" },
  { id: "col2x1", rows: 2, cols: 1, shape: "whole" },
] as const satisfies readonly { id: string; rows: number; cols: number; shape: TileShape }[];

/**
 * The part of the picture that is cut. With a tile shape, the largest rows × cols block of equal tiles of that shape
 * that fits, centred (the rest is trimmed evenly from both sides). Tile width is the widest that fits; its height is
 * the nearest whole pixel to the ratio, so a tile is within a pixel of 3:4 and almost nothing more is trimmed. With
 * "whole", the whole picture.
 */
export function cropArea(width: number, height: number, rows: number, cols: number, shape: TileShape): Rect {
  const ratio = TILE_RATIO[shape];
  if (!ratio) return { x: 0, y: 0, width, height };
  const [a, b] = ratio;
  // At least 1 px each way whenever the picture has a pixel per row and column (a 2000 × 20 strip in 20 rows still cuts).
  const tileW = Math.min(Math.floor(width / cols), Math.max(1, Math.floor((height * a) / (rows * b))));
  const tileH = Math.min(Math.floor(height / rows), Math.max(1, Math.round((tileW * b) / a)));
  const w = tileW * cols;
  const h = tileH * rows;
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
