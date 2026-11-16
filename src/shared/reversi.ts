/**
 * Reversi, written for cv.cm: 8 × 8, the usual four-disc start, black first. A move must outflank at least one line
 * of the other colour, which turns over. A side with no move passes; when neither side can move the game ends and
 * the side with more discs wins.
 *
 * Squares are r * 8 + c; a disc is 1 black, -1 white, 0 empty.
 */

export type Side = 1 | -1;
export type ReversiGame = { board: number[]; turn: Side };

const DIRS: Array<[number, number]> = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

export function startGame(): ReversiGame {
  const board = new Array<number>(64).fill(0);
  board[27] = -1;
  board[28] = 1;
  board[35] = 1;
  board[36] = -1;
  return { board, turn: 1 };
}

/** The discs that a disc of `side` on `sq` would turn over (empty when the move is illegal). */
export function flips(board: readonly number[], sq: number, side: Side): number[] {
  if (board[sq] !== 0) return [];
  const out: number[] = [];
  const r0 = sq >> 3;
  const c0 = sq & 7;
  for (const [dr, dc] of DIRS) {
    const line: number[] = [];
    let r = r0 + dr;
    let c = c0 + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === -side) {
      line.push(r * 8 + c);
      r += dr;
      c += dc;
    }
    if (line.length && r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === side) out.push(...line);
  }
  return out;
}

export function movesFor(board: readonly number[], side: Side): number[] {
  const out: number[] = [];
  for (let sq = 0; sq < 64; sq++) if (board[sq] === 0 && flips(board, sq, side).length) out.push(sq);
  return out;
}

/** Plays `sq` for the side to move, then passes automatically if the other side has no move. Null when illegal. */
export function play(g: ReversiGame, sq: number): { game: ReversiGame; flipped: number[]; passed: boolean } | null {
  const turned = flips(g.board, sq, g.turn);
  if (!turned.length) return null;
  const board = g.board.slice();
  board[sq] = g.turn;
  for (const f of turned) board[f] = g.turn;
  const next = -g.turn as Side;
  // The opponent passes when it has no move but we still do.
  if (!movesFor(board, next).length && movesFor(board, g.turn).length) return { game: { board, turn: g.turn }, flipped: turned, passed: true };
  return { game: { board, turn: next }, flipped: turned, passed: false };
}

export const count = (board: readonly number[], side: Side) => board.reduce((n, d) => n + (d === side ? 1 : 0), 0);

export function over(g: ReversiGame): boolean {
  return !movesFor(g.board, g.turn).length && !movesFor(g.board, -g.turn as Side).length;
}

/** Winner once the game is over: 1, -1, or 0 for a draw; null while it goes on. */
export function winner(g: ReversiGame): Side | 0 | null {
  if (!over(g)) return null;
  const d = count(g.board, 1) - count(g.board, -1);
  return d > 0 ? 1 : d < 0 ? -1 : 0;
}

export function replay(list: readonly number[]): { game: ReversiGame; moves: number[] } {
  let game = startGame();
  const moves: number[] = [];
  for (const sq of list) {
    if (!Number.isInteger(sq) || sq < 0 || sq > 63) break;
    const r = play(game, sq);
    if (!r) break;
    game = r.game;
    moves.push(sq);
  }
  return { game, moves };
}

// ---------------------------------------------------------------- computer

/** Classic square weights: corners are prized, the squares next to them are dangerous while the corner is empty. */
const WEIGHTS = [
  100, -20, 10, 5, 5, 10, -20, 100,
  -20, -50, -2, -2, -2, -2, -50, -20,
  10, -2, 1, 1, 1, 1, -2, 10,
  5, -2, 1, 0, 0, 1, -2, 5,
  5, -2, 1, 0, 0, 1, -2, 5,
  10, -2, 1, 1, 1, 1, -2, 10,
  -20, -50, -2, -2, -2, -2, -50, -20,
  100, -20, 10, 5, 5, 10, -20, 100,
];

function evaluate(board: readonly number[], side: Side): number {
  let pos = 0;
  for (let sq = 0; sq < 64; sq++) pos += board[sq]! * WEIGHTS[sq]!;
  const mob = movesFor(board, 1).length - movesFor(board, -1).length;
  return (pos + mob * 5) * side;
}

export const REVERSI_LEVELS = ["easy", "medium", "hard"] as const;
export type Level = (typeof REVERSI_LEVELS)[number];

const WIN = 10_000;

export function bestMove(g: ReversiGame, level: Level, rand: () => number, now: () => number = () => performance.now()): number | null {
  const moves = movesFor(g.board, g.turn);
  if (!moves.length) return null;
  const pick = (list: number[]) => list[Math.floor(rand() * list.length)] ?? list[0]!;
  if (level === "easy") {
    // Mostly random; takes a corner now and then.
    const corners = moves.filter((m) => [0, 7, 56, 63].includes(m));
    return corners.length && rand() < 0.3 ? pick(corners) : pick(moves);
  }
  let deadline = now() + (level === "hard" ? 280 : 120);
  let stop = false;
  const empties = g.board.filter((d) => d === 0).length;
  const search = (s: ReversiGame, depth: number, alpha: number, beta: number, exact: boolean): number => {
    if (now() > deadline) {
      stop = true;
      return 0;
    }
    if (over(s)) {
      const d = count(s.board, s.turn) - count(s.board, -s.turn as Side);
      return d > 0 ? WIN + d : d < 0 ? -WIN + d : 0;
    }
    if (!exact && depth <= 0) return evaluate(s.board, s.turn);
    const list = movesFor(s.board, s.turn);
    let best = -Infinity;
    for (const sq of list) {
      const r = play(s, sq)!;
      // After a pass the same side moves again, so the score is not negated.
      const v = r.game.turn === s.turn ? search(r.game, depth - 1, alpha, beta, exact) : -search(r.game, depth - 1, -beta, -alpha, exact);
      if (stop) return 0;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  };
  const rootScore = (sq: number, depth: number, exact: boolean) => {
    const r = play(g, sq)!;
    return r.game.turn === g.turn ? search(r.game, depth - 1, -Infinity, Infinity, exact) : -search(r.game, depth - 1, -Infinity, Infinity, exact);
  };
  let scores = moves.map((sq) => rootScore(sq, 1, false));
  if (level === "hard" && empties <= 10) {
    const exact = moves.map((sq) => rootScore(sq, 64, true));
    if (!stop) scores = exact;
  }
  if (stop || level === "medium" || empties > 10) {
    // An exact endgame solve that ran out of time leaves the deepening its own budget, not an expired one.
    if (stop) deadline = now() + 280;
    stop = false;
    const maxDepth = level === "medium" ? 2 : 10;
    for (let d = 2; d <= maxDepth; d++) {
      const round = moves.map((sq) => rootScore(sq, d, false));
      if (stop) break;
      scores = round;
    }
  }
  const top = Math.max(...scores);
  return pick(moves.filter((_, i) => scores[i] === top));
}
