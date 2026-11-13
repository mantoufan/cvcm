/** Tic-tac-toe on a 3 × 3 board: cells 0–8 row by row, each "X", "O" or "". */

export type Mark = "X" | "O";
export type Cell = Mark | "";
export type Board = readonly Cell[];
export const LEVELS = ["easy", "medium", "hard"] as const;
export type Level = (typeof LEVELS)[number];

export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export type Outcome = { winner: Mark; line: readonly [number, number, number] } | { winner: "draw" } | null;

/** The winner and the winning line, "draw" on a full board, null while the game goes on. */
export function outcome(b: Board): Outcome {
  for (const line of LINES) {
    const [a, c, d] = line;
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { winner: b[a] as Mark, line };
  }
  return b.every((v) => v) ? { winner: "draw" } : null;
}

/** The corners and the centre: the openings that give the other side the most ways to go wrong. */
const OPENINGS = [0, 2, 4, 6, 8] as const;

export const other = (m: Mark): Mark => (m === "X" ? "O" : "X");
export const emptyCells = (b: Board) => b.flatMap((v, i) => (v ? [] : [i]));

/**
 * Minimax score for `turn` to move: +10 − depth for a win, depth − 10 for a loss, 0 for a draw, so a quicker win
 * and a slower loss score higher.
 */
function score(b: Cell[], turn: Mark, me: Mark, depth: number): number {
  const o = outcome(b);
  if (o) return o.winner === "draw" ? 0 : o.winner === me ? 10 - depth : depth - 10;
  let best = turn === me ? -Infinity : Infinity;
  for (const i of emptyCells(b)) {
    b[i] = turn;
    const s = score(b, other(turn), me, depth + 1);
    b[i] = "";
    best = turn === me ? Math.max(best, s) : Math.min(best, s);
  }
  return best;
}

/** Every move that scores best for `me` (perfect play); several when they tie. */
export function bestMoves(board: Board, me: Mark): number[] {
  const b = board.slice();
  let best = -Infinity;
  let out: number[] = [];
  for (const i of emptyCells(b)) {
    b[i] = me;
    const s = score(b, other(me), me, 1);
    b[i] = "";
    if (s > best) {
      best = s;
      out = [i];
    } else if (s === best) out.push(i);
  }
  return out;
}

/** A move that wins at once, else one that stops the other side winning next turn, else null. */
export function winOrBlock(board: Board, me: Mark): number | null {
  for (const who of [me, other(me)]) {
    for (const [a, c, d] of LINES) {
      const line = [board[a], board[c], board[d]];
      if (line.filter((v) => v === who).length === 2 && line.includes("")) return [a, c, d][line.indexOf("")]!;
    }
  }
  return null;
}

/**
 * The computer's move. `pick(n)` returns a whole number below n (Web Crypto in the page, fixed in tests).
 * easy: any empty cell; medium: wins or blocks when it can, else any cell (so it can be beaten);
 * hard: perfect play, never loses.
 */
export function computerMove(board: Board, me: Mark, level: Level, pick: (n: number) => number): number {
  const empty = emptyCells(board);
  if (!empty.length) return -1;
  if (level === "easy") return empty[pick(empty.length)]!;
  if (level === "medium") return winOrBlock(board, me) ?? empty[pick(empty.length)]!;
  // Every opening draws with perfect play; a corner or the centre (the strongest openings) skips the full search.
  if (empty.length === 9) return OPENINGS[pick(OPENINGS.length)]!;
  const best = bestMoves(board, me);
  return best[pick(best.length)]!;
}
