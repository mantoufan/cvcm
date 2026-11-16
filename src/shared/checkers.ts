/**
 * American checkers (English draughts), written for cv.cm: 8 × 8, pieces on the dark squares, black moves first.
 * Men move one square diagonally forward, kings one square any diagonal way. Captures are compulsory and a
 * multi-jump must be finished (any capture sequence may be chosen, not necessarily the longest). A man that reaches
 * the far row is crowned and the move ends there. A side with no piece or no legal move loses; 80 plies (40 moves
 * each) with no capture and no crowning is a draw.
 *
 * Squares are r * 8 + c with row 0 at the top; black starts on rows 5–7 and moves up, white on rows 0–2.
 * A piece is 1 black man, 2 black king, -1 white man, -2 white king, 0 empty.
 */

export type Side = 1 | -1;
export type Board = number[];
export type CheckersMove = { path: number[]; captures: number[]; crowns: boolean };
export type CheckersGame = { board: Board; turn: Side; quiet: number };

export const DRAW_PLIES = 80;

export const isDark = (sq: number) => ((sq >> 3) + (sq & 7)) % 2 === 1;
export const sideOf = (p: number): Side | 0 => (p > 0 ? 1 : p < 0 ? -1 : 0);

export function startGame(): CheckersGame {
  const board = new Array<number>(64).fill(0);
  for (let sq = 0; sq < 64; sq++) {
    if (!isDark(sq)) continue;
    const r = sq >> 3;
    if (r <= 2) board[sq] = -1;
    else if (r >= 5) board[sq] = 1;
  }
  return { board, turn: 1, quiet: 0 };
}

const at = (r: number, c: number) => (r >= 0 && r < 8 && c >= 0 && c < 8 ? r * 8 + c : -1);

/** The diagonal directions a piece may move or capture in. */
function dirs(p: number): Array<[number, number]> {
  if (Math.abs(p) === 2) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  return p > 0 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
}

const crownRow = (side: Side) => (side === 1 ? 0 : 7);

/** All complete capture sequences for the piece on `from` (captured pieces stay on the board until the move ends). */
function jumps(board: Board, from: number): CheckersMove[] {
  const piece = board[from]!;
  const side = sideOf(piece) as Side;
  const out: CheckersMove[] = [];
  const walk = (sq: number, path: number[], captured: number[]) => {
    let extended = false;
    const r = sq >> 3;
    const c = sq & 7;
    for (const [dr, dc] of dirs(piece)) {
      const mid = at(r + dr, c + dc);
      const land = at(r + 2 * dr, c + 2 * dc);
      if (mid < 0 || land < 0) continue;
      if (sideOf(board[mid]!) !== -side || captured.includes(mid)) continue;
      if (board[land] !== 0 && land !== from) continue;
      extended = true;
      const nextPath = [...path, land];
      const nextCaptured = [...captured, mid];
      // A man crowned by this jump stops here.
      if (Math.abs(piece) === 1 && land >> 3 === crownRow(side)) out.push({ path: nextPath, captures: nextCaptured, crowns: true });
      else walk(land, nextPath, nextCaptured);
    }
    if (!extended && captured.length) out.push({ path, captures: captured, crowns: false });
  };
  walk(from, [from], []);
  return out;
}

export function legalMoves(g: CheckersGame): CheckersMove[] {
  const captures: CheckersMove[] = [];
  const steps: CheckersMove[] = [];
  for (let sq = 0; sq < 64; sq++) {
    const p = g.board[sq]!;
    if (sideOf(p) !== g.turn) continue;
    captures.push(...jumps(g.board, sq));
    if (captures.length) continue;
    const r = sq >> 3;
    const c = sq & 7;
    for (const [dr, dc] of dirs(p)) {
      const to = at(r + dr, c + dc);
      if (to < 0 || g.board[to] !== 0) continue;
      steps.push({ path: [sq, to], captures: [], crowns: Math.abs(p) === 1 && to >> 3 === crownRow(g.turn) });
    }
  }
  return captures.length ? captures : steps;
}

export function play(g: CheckersGame, m: CheckersMove): CheckersGame {
  const board = g.board.slice();
  const from = m.path[0]!;
  const to = m.path[m.path.length - 1]!;
  const piece = board[from]!;
  board[from] = 0;
  for (const c of m.captures) board[c] = 0;
  board[to] = m.crowns ? piece * 2 : piece;
  return { board, turn: -g.turn as Side, quiet: m.captures.length || m.crowns ? 0 : g.quiet + 1 };
}

export const sameMove = (a: CheckersMove, b: { path: readonly number[] }) => a.path.length === b.path.length && a.path.every((s, i) => s === b.path[i]);

export type Result = { winner: Side | 0 } | null;

/** The winner (or 0 for a draw) once the game is over, else null. */
export function result(g: CheckersGame): Result {
  if (!legalMoves(g).length) return { winner: -g.turn as Side };
  if (g.quiet >= DRAW_PLIES) return { winner: 0 };
  return null;
}

/** Replays saved paths; stops at the first one that is not legal. */
export function replay(paths: ReadonlyArray<readonly number[]>): { game: CheckersGame; moves: CheckersMove[] } {
  let game = startGame();
  const moves: CheckersMove[] = [];
  for (const path of paths) {
    if (result(game)) break;
    const m = legalMoves(game).find((x) => sameMove(x, { path }));
    if (!m) break;
    game = play(game, m);
    moves.push(m);
  }
  return { game, moves };
}

// ---------------------------------------------------------------- computer

/** Material and position from black's point of view. */
function evaluate(b: Board): number {
  let s = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq]!;
    if (!p) continue;
    const r = sq >> 3;
    const c = sq & 7;
    const king = Math.abs(p) === 2;
    let v = king ? 160 : 100;
    // Men gain as they advance; pieces in the middle columns are worth a little more; the back row guards.
    if (!king) v += p > 0 ? (7 - r) * 3 : r * 3;
    if (c >= 2 && c <= 5) v += 4;
    if (!king && ((p > 0 && r === 7) || (p < 0 && r === 0))) v += 6;
    s += p > 0 ? v : -v;
  }
  return s;
}

const WIN = 100_000;

export const CHECKERS_LEVELS = ["easy", "medium", "hard"] as const;
export type Level = (typeof CHECKERS_LEVELS)[number];
const BUDGET: Record<Level, { depth: number; ms: number; noise: number }> = {
  easy: { depth: 2, ms: 60, noise: 60 },
  medium: { depth: 5, ms: 150, noise: 8 },
  hard: { depth: 14, ms: 280, noise: 0 },
};

/**
 * The computer's move: iterative-deepening alpha-beta within a time budget; equal scores (plus a little noise on the
 * easier levels) are settled by `rand`.
 */
export function bestMove(g: CheckersGame, level: Level, rand: () => number, now: () => number = () => performance.now()): CheckersMove | null {
  const moves = legalMoves(g);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0]!;
  const { depth: maxDepth, ms, noise } = BUDGET[level];
  const deadline = now() + ms;
  let stop = false;
  const search = (s: CheckersGame, depth: number, alpha: number, beta: number, ply: number): number => {
    if (now() > deadline) {
      stop = true;
      return 0;
    }
    const list = legalMoves(s);
    if (!list.length) return -WIN + ply;
    if (s.quiet >= DRAW_PLIES) return 0;
    // Do not stop in the middle of a capture exchange.
    if (depth <= 0 && !list[0]!.captures.length) return evaluate(s.board) * s.turn;
    let best = -Infinity;
    for (const m of list) {
      const v = -search(play(s, m), depth - 1, -beta, -alpha, ply + 1);
      if (stop) return 0;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  };
  let scores = moves.map(() => 0);
  for (let d = 1; d <= maxDepth; d++) {
    const round = moves.map((m) => -search(play(g, m), d - 1, -Infinity, Infinity, 1));
    if (stop) break;
    scores = round;
    if (scores.some((v) => Math.abs(v) > WIN / 2)) break;
  }
  const noisy = scores.map((v) => v + (noise ? (rand() - 0.5) * 2 * noise : 0));
  const top = Math.max(...noisy);
  const best = moves.filter((_, i) => noisy[i]! >= top - 1e-9);
  return best[Math.floor(rand() * best.length)] ?? best[0]!;
}
