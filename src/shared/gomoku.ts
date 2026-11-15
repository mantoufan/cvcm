/**
 * Gomoku (five in a row), written for cv.cm: 15 × 15 points, black first, freestyle rule — five or more stones in a
 * row across, down or diagonally wins. A full board is a draw.
 *
 * Points are r * 15 + c; a stone is 1 black, -1 white, 0 empty.
 */

export const N = 15;
export type Side = 1 | -1;
export type GomokuGame = { board: number[]; turn: Side; last: number };

const DIRS: Array<[number, number]> = [[0, 1], [1, 0], [1, 1], [1, -1]];
const inside = (r: number, c: number) => r >= 0 && r < N && c >= 0 && c < N;

export function startGame(): GomokuGame {
  return { board: new Array<number>(N * N).fill(0), turn: 1, last: -1 };
}

/** The five-or-more line through `p` for the stone on it, or null. */
export function winningLine(board: readonly number[], p: number): number[] | null {
  const side = board[p];
  if (!side) return null;
  const r0 = Math.floor(p / N);
  const c0 = p % N;
  for (const [dr, dc] of DIRS) {
    const line = [p];
    for (const s of [1, -1]) {
      let r = r0 + dr * s;
      let c = c0 + dc * s;
      while (inside(r, c) && board[r * N + c] === side) {
        line.push(r * N + c);
        r += dr * s;
        c += dc * s;
      }
    }
    if (line.length >= 5) return line.sort((a, b) => a - b);
  }
  return null;
}

export function play(g: GomokuGame, p: number): GomokuGame | null {
  if (!Number.isInteger(p) || p < 0 || p >= N * N || g.board[p] !== 0 || result(g)) return null;
  const board = g.board.slice();
  board[p] = g.turn;
  return { board, turn: -g.turn as Side, last: p };
}

/** { winner, line } when the game is over (winner 0 and an empty line for a draw), else null. */
export function result(g: GomokuGame): { winner: Side | 0; line: number[] } | null {
  if (g.last >= 0) {
    const line = winningLine(g.board, g.last);
    if (line) return { winner: g.board[g.last] as Side, line };
  }
  if (g.board.every((s) => s !== 0)) return { winner: 0, line: [] };
  return null;
}

export function replay(list: readonly number[]): { game: GomokuGame; moves: number[] } {
  let game = startGame();
  const moves: number[] = [];
  for (const p of list) {
    const next = play(game, p);
    if (!next) break;
    game = next;
    moves.push(p);
  }
  return { game, moves };
}

// ---------------------------------------------------------------- computer

/** What a stone of `side` on the empty point `p` would make along one direction: run length and open ends. */
function shape(board: readonly number[], p: number, side: Side, dr: number, dc: number): { len: number; open: number } {
  const r0 = Math.floor(p / N);
  const c0 = p % N;
  let len = 1;
  let open = 0;
  for (const s of [1, -1]) {
    let r = r0 + dr * s;
    let c = c0 + dc * s;
    while (inside(r, c) && board[r * N + c] === side) {
      len++;
      r += dr * s;
      c += dc * s;
    }
    if (inside(r, c) && board[r * N + c] === 0) open++;
  }
  return { len, open };
}

const SHAPE_SCORE = (len: number, open: number) => {
  if (len >= 5) return 1_000_000;
  if (open === 0) return 0;
  if (len === 4) return open === 2 ? 100_000 : 12_000;
  if (len === 3) return open === 2 ? 10_000 : 1_000;
  if (len === 2) return open === 2 ? 600 : 80;
  return open === 2 ? 20 : 4;
};

/** How good `p` is for `side` to play: the sum over the four directions, with a bonus for two strong lines at once. */
export function pointScore(board: readonly number[], p: number, side: Side): number {
  let total = 0;
  let strong = 0;
  for (const [dr, dc] of DIRS) {
    const { len, open } = shape(board, p, side, dr, dc);
    const v = SHAPE_SCORE(len, open);
    if (v >= 10_000) strong++;
    total += v;
  }
  // Two open threes or a four plus a three cannot both be stopped.
  if (strong >= 2) total += 50_000;
  return total;
}

/** Empty points within two of a stone (the centre on an empty board). */
export function candidates(board: readonly number[]): number[] {
  const out: number[] = [];
  let any = false;
  for (let p = 0; p < N * N; p++) {
    if (board[p] !== 0) {
      any = true;
      continue;
    }
    const r = Math.floor(p / N);
    const c = p % N;
    let near = false;
    for (let dr = -2; dr <= 2 && !near; dr++) for (let dc = -2; dc <= 2 && !near; dc++) if (inside(r + dr, c + dc) && board[(r + dr) * N + c + dc] !== 0) near = true;
    if (near) out.push(p);
  }
  return any ? out : [Math.floor(N / 2) * N + Math.floor(N / 2)];
}

export const GOMOKU_LEVELS = ["easy", "medium", "hard"] as const;
export type Level = (typeof GOMOKU_LEVELS)[number];

/** Attack plus defence for the side to move at `p`. */
const value = (board: readonly number[], p: number, side: Side) => pointScore(board, p, side) * 1.1 + pointScore(board, p, -side as Side);

export function bestMove(g: GomokuGame, level: Level, rand: () => number): number | null {
  if (result(g)) return null;
  const list = candidates(g.board);
  if (!list.length) return null;
  const pick = (ps: number[]) => ps[Math.floor(rand() * ps.length)] ?? ps[0]!;
  const scored = list.map((p) => ({ p, v: value(g.board, p, g.turn) })).sort((a, b) => b.v - a.v);
  // Always take a win and always stop a five, whatever the level.
  if (scored[0]!.v >= 1_000_000) return pick(scored.filter((s) => s.v >= scored[0]!.v - 1).map((s) => s.p));
  if (level === "easy") {
    // One of the better moves, not always the best.
    const top = scored.slice(0, Math.min(6, scored.length));
    return top[Math.floor(rand() * top.length)]!.p;
  }
  if (level === "medium") return pick(scored.filter((s) => s.v === scored[0]!.v).map((s) => s.p));
  // Hard: look one reply ahead among the best few, and pick the point after which the opponent's best answer is weakest.
  const top = scored.slice(0, 10);
  let bestV = -Infinity;
  let best: number[] = [];
  for (const { p, v } of top) {
    const board = g.board.slice();
    board[p] = g.turn;
    if (winningLine(board, p)) return p;
    const replies = candidates(board);
    let worst = 0;
    for (const q of replies) worst = Math.max(worst, value(board, q, -g.turn as Side));
    const net = v - worst * 0.9;
    if (net > bestV + 1e-6) {
      bestV = net;
      best = [p];
    } else if (Math.abs(net - bestV) <= 1e-6) best.push(p);
  }
  return pick(best);
}
