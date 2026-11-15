/**
 * Chinese checkers for two, written for cv.cm: the six-pointed star of 121 holes; each side starts with 10 marbles in
 * one point and races them into the opposite point. A move is a step to a neighbouring empty hole, or a chain of
 * jumps, each over one neighbouring marble (either colour) into the empty hole straight beyond it; a chain may stop
 * after any jump. A side wins when its target point is full and holds at least one of its own marbles — so marbles
 * the other side never moves out of that point cannot block the win.
 *
 * Holes are cube coordinates (x, y, z), x + y + z = 0, inside the union of the two big triangles x, y, z ≤ 4 and
 * x, y, z ≥ −4. Index order is row by row (z from −8 to 8), left to right. Side 1 starts in the bottom point (z > 4)
 * and moves up to the top point (z < −4); side 2 the other way.
 */

export type Side = 1 | 2;
export type Hole = { x: number; y: number; z: number; row: number; col: number };

export const HOLES: readonly Hole[] = (() => {
  const out: Hole[] = [];
  for (let z = -8; z <= 8; z++) {
    for (let x = -8; x <= 8; x++) {
      const y = -x - z;
      if (y < -8 || y > 8) continue;
      const inA = x <= 4 && y <= 4 && z <= 4;
      const inB = x >= -4 && y >= -4 && z >= -4;
      if (inA || inB) out.push({ x, y, z, row: z + 8, col: x - y });
    }
  }
  return out.sort((a, b) => a.row - b.row || a.col - b.col);
})();
export const HOLE_COUNT = HOLES.length;

const KEY = (x: number, y: number, z: number) => `${x},${y},${z}`;
const INDEX = new Map(HOLES.map((h, i) => [KEY(h.x, h.y, h.z), i]));
const DIRS = [[1, -1, 0], [1, 0, -1], [0, 1, -1], [-1, 1, 0], [-1, 0, 1], [0, -1, 1]] as const;

/** Neighbour of hole i in each of the six directions (undefined off the board). */
export const NEIGHBOURS: ReadonlyArray<ReadonlyArray<number | undefined>> = HOLES.map((h) =>
  DIRS.map(([dx, dy, dz]) => INDEX.get(KEY(h.x + dx, h.y + dy, h.z + dz))));

export const HOME: Record<Side, readonly number[]> = {
  1: HOLES.flatMap((h, i) => (h.z > 4 ? [i] : [])),
  2: HOLES.flatMap((h, i) => (h.z < -4 ? [i] : [])),
};
export const TARGET: Record<Side, readonly number[]> = { 1: HOME[2], 2: HOME[1] };
/** The far tip of each side's target, which progress is measured against. */
const TIP: Record<Side, Hole> = { 1: { x: 4, y: 4, z: -8, row: 0, col: 0 }, 2: { x: -4, y: -4, z: 8, row: 16, col: 0 } };

export function distance(a: Hole, b: Hole): number {
  return (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z)) / 2;
}

/** Board: 0 empty, 1 or 2 a marble of that side. */
export type Board = number[];
export type Game = { board: Board; turn: Side };
/** A move is the path of holes the marble visits, from its start to where it stops. */
export type Move = number[];

export function startGame(): Game {
  const board = new Array<number>(HOLE_COUNT).fill(0);
  for (const i of HOME[1]) board[i] = 1;
  for (const i of HOME[2]) board[i] = 2;
  return { board, turn: 1 };
}

/** Every hole the marble on `from` can stop on, with one path to each (steps first, then jump chains). */
export function destinations(board: Board, from: number): Map<number, Move> {
  const out = new Map<number, Move>();
  if (!board[from]) return out;
  for (const n of NEIGHBOURS[from]!) if (n !== undefined && !board[n]) out.set(n, [from, n]);
  // Jumps: breadth-first over landing holes; the start hole counts as empty once the marble has left it.
  const seen = new Set<number>([from]);
  const queue: Move[] = [[from]];
  while (queue.length) {
    const path = queue.shift()!;
    const at = path[path.length - 1]!;
    for (let d = 0; d < 6; d++) {
      const over = NEIGHBOURS[at]![d];
      if (over === undefined || !board[over] || over === from) continue;
      const land = NEIGHBOURS[over]![d];
      if (land === undefined || seen.has(land) || (board[land] && land !== from)) continue;
      seen.add(land);
      const next = [...path, land];
      if (land !== from && !out.has(land)) out.set(land, next);
      queue.push(next);
    }
  }
  return out;
}

export function legalMoves(g: Game): Move[] {
  const out: Move[] = [];
  g.board.forEach((s, i) => {
    if (s === g.turn) for (const path of destinations(g.board, i).values()) out.push(path);
  });
  return out;
}

/** Whether `path` is a real step or jump chain for the side to move. */
export function isLegal(g: Game, path: readonly number[]): boolean {
  if (path.length < 2 || g.board[path[0]!] !== g.turn) return false;
  const from = path[0]!;
  const end = path[path.length - 1]!;
  if (g.board[end] && end !== from) return false;
  if (end === from) return false;
  if (path.length === 2 && NEIGHBOURS[from]!.includes(path[1])) return !g.board[path[1]!];
  // Every hop is a jump over an occupied neighbour into an empty hole.
  const board = g.board.slice();
  board[from] = 0;
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1]!;
    const b = path[k]!;
    let over = -1;
    for (let d = 0; d < 6; d++) {
      const n = NEIGHBOURS[a]![d];
      if (n !== undefined && NEIGHBOURS[n]![d] === b) over = n;
    }
    if (over < 0 || !board[over] || board[b]) return false;
  }
  return true;
}

export function play(g: Game, path: readonly number[]): Game | null {
  if (!isLegal(g, path)) return null;
  const board = g.board.slice();
  board[path[path.length - 1]!] = board[path[0]!]!;
  board[path[0]!] = 0;
  return { board, turn: g.turn === 1 ? 2 : 1 };
}

export function winner(board: Board): Side | null {
  for (const side of [1, 2] as const) {
    const target = TARGET[side];
    if (target.every((i) => board[i]) && target.some((i) => board[i] === side)) return side;
  }
  return null;
}

/** Replays a saved list of moves; stops at the first illegal one. */
/** The side to move has no move (very rare): the turn passes, recorded as an empty move. */
export function passTurn(g: Game): Game {
  return { board: g.board, turn: g.turn === 1 ? 2 : 1 };
}

export function replay(list: readonly unknown[]): { game: Game; moves: Move[] } {
  let game = startGame();
  const moves: Move[] = [];
  for (const m of list) {
    if (winner(game.board)) break;
    if (!Array.isArray(m) || !m.every((i) => Number.isInteger(i) && i >= 0 && i < HOLE_COUNT)) break;
    // An empty entry is a pass, allowed only when the side to move has no move at all.
    if (!m.length) {
      if (legalMoves(game).length) break;
      game = passTurn(game);
      moves.push([]);
      continue;
    }
    const next = play(game, m as number[]);
    if (!next) break;
    game = next;
    moves.push(m as number[]);
  }
  return { game, moves };
}

// ---------------------------------------------------------------- computer

export const CC_LEVELS = ["easy", "medium", "hard"] as const;
export type Level = (typeof CC_LEVELS)[number];

/** Lower is better for `side`: total distance to its tip, a straggler penalty, minus filled target holes. */
function cost(board: Board, side: Side): number {
  const tip = TIP[side];
  let sum = 0;
  let worst = 0;
  board.forEach((s, i) => {
    if (s !== side) return;
    const d = distance(HOLES[i]!, tip);
    sum += d;
    if (d > worst) worst = d;
  });
  const filled = TARGET[side].filter((i) => board[i] === side).length;
  return sum + worst * 0.6 - filled * 0.5;
}

/** Progress a move makes for the mover (positive is forward). */
function gain(path: Move, side: Side): number {
  const tip = TIP[side];
  return distance(HOLES[path[0]!]!, tip) - distance(HOLES[path[path.length - 1]!]!, tip);
}

export function bestMove(g: Game, level: Level, rand: () => number): Move | null {
  const moves = legalMoves(g);
  if (!moves.length) return null;
  const side = g.turn;
  const other: Side = side === 1 ? 2 : 1;
  const after = (m: Move) => play(g, m)!;
  const winNow = moves.find((m) => winner(after(m).board) === side);
  if (winNow) return winNow;
  const pick = (scored: Array<[Move, number]>) => {
    const top = Math.max(...scored.map((s) => s[1]));
    const best = scored.filter((s) => s[1] >= top - 1e-9);
    return best[Math.floor(rand() * best.length)]![0];
  };
  if (level === "easy") {
    // Mostly forward moves, chosen loosely.
    const scored = moves.map((m): [Move, number] => [m, gain(m, side) + rand() * 2.5]);
    return pick(scored);
  }
  const oneply = moves.map((m): [Move, number] => [m, cost(g.board, side) - cost(after(m).board, side)]);
  if (level === "medium") return pick(oneply);
  // Hard: the best few by one ply, each answered by the opponent's best reply.
  const shortlist = oneply.sort((a, b) => b[1] - a[1]).slice(0, 10);
  const scored = shortlist.map(([m, own]): [Move, number] => {
    const g2 = after(m);
    let replyGain = 0;
    for (const r of legalMoves(g2)) replyGain = Math.max(replyGain, cost(g2.board, other) - cost(play(g2, r)!.board, other));
    return [m, own - replyGain * 0.5];
  });
  return pick(scored);
}
