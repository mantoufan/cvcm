/*! @license Mahjong solitaire rules and layouts ported from https://github.com/ffalt/mah — Copyright (c) 2016 ffalt. MIT License: the above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND. */
/**
 * Mahjong solitaire, ported from ffalt/mah (https://github.com/ffalt/mah, MIT License, Copyright (c) 2016 ffalt):
 * the tile set and match groups (src/app/model/consts.ts TILES), the free-tile rule (stone.ts isBlocked: nothing on
 * top, and the left or the right side open), and the solvable deal (builder/solvable.ts: fill the empty layout in
 * reverse, always putting a pair on two tiles that are free at that moment, so playing the pairs back clears it).
 *
 * Positions are mah's: x and y in half-tile units (a tile covers x..x+1, y..y+1), z the level.
 */
import { MAHJONG_LAYOUTS, type CompactLayout, type LayoutId } from "./mahjong-layouts";

export type Rand = () => number;
export type Place = readonly [z: number, x: number, y: number];

/** 36 groups of four; tiles match within a group (seasons with any season, flowers with any flower). */
export const TILE_GROUPS: ReadonlyArray<readonly [string, string, string, string]> = [
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [`t_do${n}`, `t_do${n}`, `t_do${n}`, `t_do${n}`] as const),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [`t_ch${n}`, `t_ch${n}`, `t_ch${n}`, `t_ch${n}`] as const),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [`t_ba${n}`, `t_ba${n}`, `t_ba${n}`, `t_ba${n}`] as const),
  ["t_se_spring", "t_se_summer", "t_se_fall", "t_se_winter"],
  ["t_wi_north", "t_wi_north", "t_wi_north", "t_wi_north"],
  ["t_wi_south", "t_wi_south", "t_wi_south", "t_wi_south"],
  ["t_wi_east", "t_wi_east", "t_wi_east", "t_wi_east"],
  ["t_wi_west", "t_wi_west", "t_wi_west", "t_wi_west"],
  ["t_fl_bamboo", "t_fl_chrysanthemum", "t_fl_orchid", "t_fl_plum"],
  ["t_dr_green", "t_dr_green", "t_dr_green", "t_dr_green"],
  ["t_dr_white", "t_dr_white", "t_dr_white", "t_dr_white"],
  ["t_dr_red", "t_dr_red", "t_dr_red", "t_dr_red"],
];

export type Stone = { z: number; x: number; y: number; group: number; face: string; gone: boolean };
export type Board = { layout: LayoutId; stones: Stone[] };

export function expandLayout(map: CompactLayout): Place[] {
  const out: Place[] = [];
  for (const [z, rows] of map) {
    for (const [y, cells] of rows) {
      if (!Array.isArray(cells)) {
        out.push([z, cells as number, y]);
        continue;
      }
      for (const cell of cells as ReadonlyArray<number | readonly [number, number]>) {
        if (Array.isArray(cell)) for (let i = 0; i < cell[1]; i++) out.push([z, cell[0] + i * 2, y]);
        else out.push([z, cell as number, y]);
      }
    }
  }
  return out;
}

export function layoutPlaces(id: LayoutId): Place[] {
  return expandLayout(MAHJONG_LAYOUTS[id] as CompactLayout);
}

type Geometry = { top: number[][]; left: number[][]; right: number[][] };

/** mah's collectNodes: the tiles over a tile and the ones touching its left and right sides on the same level. */
function geometry(places: readonly Place[]): Geometry {
  const index = new Map<string, number>();
  places.forEach(([z, x, y], i) => index.set(`${z}/${x}/${y}`, i));
  const find = (z: number, x: number, y: number) => index.get(`${z}/${x}/${y}`);
  const g: Geometry = { top: [], left: [], right: [] };
  places.forEach(([z, x, y]) => {
    const top: number[] = [];
    const left: number[] = [];
    const right: number[] = [];
    for (let yy = y - 1; yy <= y + 1; yy++) {
      const l = find(z, x - 2, yy);
      if (l !== undefined) left.push(l);
      const r = find(z, x + 2, yy);
      if (r !== undefined) right.push(r);
      for (let xx = x - 1; xx <= x + 1; xx++) {
        const t = find(z + 1, xx, yy);
        if (t !== undefined) top.push(t);
      }
    }
    g.top.push(top);
    g.left.push(left);
    g.right.push(right);
  });
  return g;
}

const cache = new WeakMap<readonly Stone[], Geometry>();
function geometryOf(stones: readonly Stone[]): Geometry {
  let g = cache.get(stones);
  if (!g) {
    g = geometry(stones.map((s) => [s.z, s.x, s.y] as const));
    cache.set(stones, g);
  }
  return g;
}

function blockedBy(g: Geometry, i: number, gone: (j: number) => boolean): boolean {
  const present = (list: number[]) => list.some((j) => !gone(j));
  return present(g.top[i]!) || (present(g.left[i]!) && present(g.right[i]!));
}

/** A tile can be taken when nothing lies on it and its left or right side is open. */
export function isFree(board: Board, i: number): boolean {
  const s = board.stones[i]!;
  if (s.gone) return false;
  return !blockedBy(geometryOf(board.stones), i, (j) => board.stones[j]!.gone);
}

export function freeTiles(board: Board): number[] {
  return board.stones.map((_, i) => i).filter((i) => isFree(board, i));
}

/** Free pairs that match, grouped: [[a, b], …] for every two free tiles of one group. */
export function matchingPairs(board: Board): Array<[number, number]> {
  const free = freeTiles(board);
  const out: Array<[number, number]> = [];
  for (let a = 0; a < free.length; a++) {
    for (let b = a + 1; b < free.length; b++) {
      if (board.stones[free[a]!]!.group === board.stones[free[b]!]!.group) out.push([free[a]!, free[b]!]);
    }
  }
  return out;
}

export function canMatch(board: Board, a: number, b: number): boolean {
  return a !== b && isFree(board, a) && isFree(board, b) && board.stones[a]!.group === board.stones[b]!.group;
}

export function remaining(board: Board): number {
  return board.stones.reduce((n, s) => n + (s.gone ? 0 : 1), 0);
}

function shuffled<T>(list: readonly T[], rand: Rand): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * mah's assignTilePairs: shuffle the pairs, then fill the layout from the top down, each pair on two random tiles
 * that would be free if the not-yet-filled tiles were all there. Returns faces/groups per place, or null on a dead end.
 */
function assign(places: readonly Place[], g: Geometry, pairs: ReadonlyArray<readonly [string, string, number]>, rand: Rand): Array<{ face: string; group: number }> | null {
  const filled = new Array<boolean>(places.length).fill(false);
  const out: Array<{ face: string; group: number }> = new Array(places.length);
  for (const [faceA, faceB, group] of shuffled(pairs, rand)) {
    // "Free" while filling: the filled tiles count as removed (they come off before the unfilled ones).
    const free = places.map((_, i) => i).filter((i) => !filled[i] && !blockedBy(g, i, (j) => filled[j]!));
    if (free.length < 2) return null;
    const a = free.splice(Math.floor(rand() * free.length), 1)[0]!;
    const b = free.splice(Math.floor(rand() * free.length), 1)[0]!;
    filled[a] = true;
    filled[b] = true;
    out[a] = { face: faceA, group };
    out[b] = { face: faceB, group };
  }
  return out;
}

function pairsFor(count: number, rand: Rand, groups: ReadonlyArray<readonly string[]> = TILE_GROUPS): Array<[string, string, number]> {
  const pairs: Array<[string, string, number]> = [];
  for (const gi of shuffled(groups.map((_, i) => i), rand)) {
    const faces = shuffled(groups[gi]!, rand);
    for (let i = 0; i + 1 < faces.length && pairs.length < count / 2; i += 2) pairs.push([faces[i]!, faces[i + 1]!, gi]);
    if (pairs.length >= count / 2) break;
  }
  return pairs;
}

const MAX_RUNS = 2000;

/** A new deal on a layout that can always be cleared (mah's solvable builder). */
export function deal(layout: LayoutId, rand: Rand): Board {
  const places = layoutPlaces(layout);
  const g = geometry(places);
  for (let run = 0; run < MAX_RUNS; run++) {
    const faces = assign(places, g, pairsFor(places.length, rand), rand);
    if (faces) {
      return { layout, stones: places.map(([z, x, y], i) => ({ z, x, y, face: faces[i]!.face, group: faces[i]!.group, gone: false })) };
    }
  }
  throw new Error(`no solvable deal for ${layout}`);
}

/**
 * Re-deals the tiles still on the table onto their places so they can again be cleared (mah's Board.shuffle);
 * removed tiles stay removed. Null if no solvable arrangement was found.
 */
export function reshuffle(board: Board, rand: Rand): Board | null {
  const left = board.stones.map((s, i) => ({ s, i })).filter(({ s }) => !s.gone);
  const places = left.map(({ s }) => [s.z, s.x, s.y] as const);
  const g = geometry(places);
  // Pair the faces that are left by group, as they are (a pair keeps its two faces).
  const byGroup = new Map<number, string[]>();
  for (const { s } of left) byGroup.set(s.group, [...(byGroup.get(s.group) ?? []), s.face]);
  for (let run = 0; run < MAX_RUNS; run++) {
    const pairs: Array<[string, string, number]> = [];
    for (const [group, faces] of byGroup) {
      const f = shuffled(faces, rand);
      for (let i = 0; i + 1 < f.length; i += 2) pairs.push([f[i]!, f[i + 1]!, group]);
    }
    const faces = assign(places, g, pairs, rand);
    if (!faces) continue;
    const stones = board.stones.map((s) => ({ ...s }));
    left.forEach(({ i }, k) => {
      stones[i]!.face = faces[k]!.face;
      stones[i]!.group = faces[k]!.group;
    });
    return { layout: board.layout, stones };
  }
  return null;
}

export function removePair(board: Board, a: number, b: number): Board {
  const stones = board.stones.map((s, i) => (i === a || i === b ? { ...s, gone: true } : s));
  // The geometry depends only on places, which did not change.
  const g = cache.get(board.stones);
  if (g) cache.set(stones, g);
  return { layout: board.layout, stones };
}

export function restorePair(board: Board, a: number, b: number): Board {
  const stones = board.stones.map((s, i) => (i === a || i === b ? { ...s, gone: false } : s));
  const g = cache.get(board.stones);
  if (g) cache.set(stones, g);
  return { layout: board.layout, stones };
}

/** Saved form: layout, one face per place (in layout order) and the removed pairs in order. */
export type SavedBoard = { layout: string; faces: string[]; removed: number[] };

const FACE_GROUP = new Map<string, number>();
TILE_GROUPS.forEach((g, i) => g.forEach((f) => FACE_GROUP.set(f, i)));

export function fromSavedBoard(raw: unknown): { board: Board; removed: number[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<SavedBoard>;
  if (typeof r.layout !== "string" || !(r.layout in MAHJONG_LAYOUTS)) return null;
  const places = layoutPlaces(r.layout as LayoutId);
  if (!Array.isArray(r.faces) || r.faces.length !== places.length || !r.faces.every((f) => typeof f === "string" && FACE_GROUP.has(f))) return null;
  // Each group of four must appear exactly four times, as in a real deal.
  const counts = new Map<number, number>();
  for (const f of r.faces) counts.set(FACE_GROUP.get(f)!, (counts.get(FACE_GROUP.get(f)!) ?? 0) + 1);
  if ([...counts.values()].some((n) => n % 2 !== 0)) return null;
  const removed = Array.isArray(r.removed) ? r.removed : [];
  if (removed.length % 2 !== 0 || !removed.every((i) => Number.isInteger(i) && i >= 0 && i < places.length) || new Set(removed).size !== removed.length) return null;
  let board: Board = { layout: r.layout as LayoutId, stones: places.map(([z, x, y], i) => ({ z, x, y, face: r.faces![i]!, group: FACE_GROUP.get(r.faces![i]!)!, gone: false })) };
  for (let k = 0; k < removed.length; k += 2) {
    if (!canMatch(board, removed[k]!, removed[k + 1]!)) return null;
    board = removePair(board, removed[k]!, removed[k + 1]!);
  }
  return { board, removed };
}

export function toSaved(board: Board, removed: readonly number[]): SavedBoard {
  return { layout: board.layout, faces: board.stones.map((s) => s.face), removed: [...removed] };
}

/** Draw order back to front (mah's sortDrawItems): lower levels first, then from the top-left. */
export function drawOrder(board: Board): number[] {
  return board.stones.map((_, i) => i).sort((a, b) => {
    const s = board.stones[a]!;
    const t = board.stones[b]!;
    return s.z - t.z || s.x + s.y - (t.x + t.y) || s.x - t.x;
  });
}

/** Tile drawing geometry in SVG units, as mah's calcDrawPos: a 75 × 100 face, each level shifted up-left by 8. */
export const TILE_W = 75;
export const TILE_H = 100;
export const LEVEL_SHIFT = 8;
export function tilePos(z: number, x: number, y: number): { x: number; y: number } {
  return { x: ((TILE_W + 2) * x) / 2 - z * LEVEL_SHIFT, y: ((TILE_H + 2) * y) / 2 - z * LEVEL_SHIFT };
}
