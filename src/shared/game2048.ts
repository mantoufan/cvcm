/*! @license 2048 rules ported from https://github.com/gabrielecirulli/2048 — Copyright (c) 2014 Gabriele Cirulli. MIT License: the above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND. */
/**
 * 2048 rules, ported from Gabriele Cirulli's 2048 (https://github.com/gabrielecirulli/2048, MIT License,
 * Copyright (c) 2014 Gabriele Cirulli): a new tile is a 2 nine times in ten and a 4 otherwise, every move slides all
 * tiles as far as they go, two equal tiles merge once per move into their sum (which scores it), and the game is over
 * when no move changes the board. Reaching 2048 wins; the player may keep going.
 *
 * Unlike the original (one mutable grid), the state here is plain data so a move can be tested and saved. Tiles keep
 * an id across moves so the page can slide the same element.
 */

export const SIZE = 4;
export const WIN_VALUE = 2048;
export type Direction = "up" | "right" | "down" | "left";
export const DIRECTIONS: readonly Direction[] = ["up", "right", "down", "left"];

export type Tile = { id: number; value: number; row: number; col: number };
export type Game = { tiles: Tile[]; score: number; won: boolean; keepPlaying: boolean; over: boolean; nextId: number };

/** One tile that slid into another this move: it ends at (row, col) under the merged tile and is then removed. */
export type Consumed = { id: number; row: number; col: number };
export type MoveResult = { game: Game; moved: boolean; gained: number; merged: number[]; spawned: number | null; consumed: Consumed[] };

/** `rand()` is uniform in [0, 1). */
export type Rand = () => number;

const VECTORS: Record<Direction, { dr: number; dc: number }> = {
  up: { dr: -1, dc: 0 },
  right: { dr: 0, dc: 1 },
  down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 },
};

const at = (tiles: readonly Tile[], row: number, col: number) => tiles.find((t) => t.row === row && t.col === col);
const inside = (row: number, col: number) => row >= 0 && row < SIZE && col >= 0 && col < SIZE;

export function emptyCells(tiles: readonly Tile[]): Array<{ row: number; col: number }> {
  const out: Array<{ row: number; col: number }> = [];
  for (let row = 0; row < SIZE; row++) for (let col = 0; col < SIZE; col++) if (!at(tiles, row, col)) out.push({ row, col });
  return out;
}

/** Adds a 2 (90%) or a 4 on a random empty cell, as the original's addRandomTile. Returns the new tile's id. */
function spawn(game: Game, rand: Rand): number | null {
  const cells = emptyCells(game.tiles);
  if (!cells.length) return null;
  const value = rand() < 0.9 ? 2 : 4;
  const cell = cells[Math.min(cells.length - 1, Math.floor(rand() * cells.length))]!;
  const id = game.nextId++;
  game.tiles.push({ id, value, row: cell.row, col: cell.col });
  return id;
}

export function newGame(rand: Rand): Game {
  const game: Game = { tiles: [], score: 0, won: false, keepPlaying: false, over: false, nextId: 1 };
  spawn(game, rand);
  spawn(game, rand);
  return game;
}

/** Any empty cell or two equal neighbours (the original's movesAvailable). */
export function movesAvailable(tiles: readonly Tile[]): boolean {
  if (tiles.length < SIZE * SIZE) return true;
  return tiles.some((t) => {
    const right = at(tiles, t.row, t.col + 1);
    const down = at(tiles, t.row + 1, t.col);
    return right?.value === t.value || down?.value === t.value;
  });
}

/** The original's buildTraversals: walk from the side the tiles move towards, so each tile meets settled ones first. */
function traversal(dir: Direction): Array<{ row: number; col: number }> {
  const rows = [...Array(SIZE).keys()];
  const cols = [...Array(SIZE).keys()];
  if (dir === "down") rows.reverse();
  if (dir === "right") cols.reverse();
  const out: Array<{ row: number; col: number }> = [];
  for (const row of rows) for (const col of cols) out.push({ row, col });
  return out;
}

/** True when play is stopped: lost, or won and the player has not chosen to keep going. */
export function finished(game: Game): boolean {
  return game.over || (game.won && !game.keepPlaying);
}

export function move(prev: Game, dir: Direction, rand: Rand): MoveResult {
  const game: Game = { ...prev, tiles: prev.tiles.map((t) => ({ ...t })) };
  const none: MoveResult = { game: prev, moved: false, gained: 0, merged: [], spawned: null, consumed: [] };
  if (finished(prev)) return none;
  const { dr, dc } = VECTORS[dir];
  const mergedIds = new Set<number>();
  const consumed: Consumed[] = [];
  let gained = 0;
  let moved = false;
  for (const { row, col } of traversal(dir)) {
    const tile = at(game.tiles, row, col);
    if (!tile) continue;
    // findFarthestPosition: slide over empty cells.
    let r = row;
    let c = col;
    while (inside(r + dr, c + dc) && !at(game.tiles, r + dr, c + dc)) {
      r += dr;
      c += dc;
    }
    const next = inside(r + dr, c + dc) ? at(game.tiles, r + dr, c + dc) : undefined;
    if (next && next.value === tile.value && !mergedIds.has(next.id)) {
      // Only one merge per tile per move: [2, 2, 2, 2] → [4, 4], not [8].
      next.value *= 2;
      mergedIds.add(next.id);
      consumed.push({ id: tile.id, row: next.row, col: next.col });
      game.tiles = game.tiles.filter((t) => t !== tile);
      gained += next.value;
      if (next.value === WIN_VALUE && !game.keepPlaying) game.won = true;
      moved = true;
    } else if (r !== row || c !== col) {
      tile.row = r;
      tile.col = c;
      moved = true;
    }
  }
  if (!moved) return none;
  game.score += gained;
  const spawned = spawn(game, rand);
  if (!movesAvailable(game.tiles)) game.over = true;
  return { game, moved, gained, merged: [...mergedIds], spawned, consumed };
}

export function keepGoing(game: Game): Game {
  return { ...game, keepPlaying: true };
}

export function highest(tiles: readonly Tile[]): number {
  return tiles.reduce((m, t) => Math.max(m, t.value), 0);
}

/** Restores a saved game; anything that is not a valid 4 × 4 board of powers of two (≥ 2) gives null. */
export function fromSaved(raw: unknown): Game | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.cells) || r.cells.length !== SIZE * SIZE) return null;
  const tiles: Tile[] = [];
  let id = 1;
  for (let i = 0; i < SIZE * SIZE; i++) {
    const v = r.cells[i];
    if (v === 0) continue;
    if (!Number.isInteger(v) || (v as number) < 2 || (v as number) > 2 ** 17 || ((v as number) & ((v as number) - 1)) !== 0) return null;
    tiles.push({ id: id++, value: v as number, row: Math.floor(i / SIZE), col: i % SIZE });
  }
  if (!tiles.length) return null;
  const score = Number(r.score);
  const keepPlaying = r.keepPlaying === true;
  const won = keepPlaying || highest(tiles) >= WIN_VALUE;
  return { tiles, score: Number.isFinite(score) && score >= 0 ? Math.floor(score) : 0, won, keepPlaying, over: !movesAvailable(tiles), nextId: id };
}

export function toCells(tiles: readonly Tile[]): number[] {
  const cells = new Array<number>(SIZE * SIZE).fill(0);
  for (const t of tiles) cells[t.row * SIZE + t.col] = t.value;
  return cells;
}
