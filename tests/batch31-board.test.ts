import { describe, expect, it } from "vitest";
import { seeded } from "../src/shared/random";
import * as ck from "../src/shared/checkers";
import * as rv from "../src/shared/reversi";
import * as gm from "../src/shared/gomoku";

const sq = (r: number, c: number) => r * 8 + c;
const empty = (): ck.CheckersGame => ({ board: new Array<number>(64).fill(0), turn: 1, quiet: 0 });

describe("checkers", () => {
  it("starts with 12 men each and seven opening moves for black", () => {
    const g = ck.startGame();
    expect(g.board.filter((p) => p === 1)).toHaveLength(12);
    expect(g.board.filter((p) => p === -1)).toHaveLength(12);
    expect(ck.legalMoves(g)).toHaveLength(7);
  });

  it("forces a capture when one exists", () => {
    const g = empty();
    g.board[sq(5, 2)] = 1;
    g.board[sq(4, 3)] = -1;
    g.board[sq(5, 6)] = 1;
    const moves = ck.legalMoves(g);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ path: [sq(5, 2), sq(3, 4)], captures: [sq(4, 3)] });
  });

  it("finishes a multi-jump and lets any sequence be chosen", () => {
    const g = empty();
    g.board[sq(7, 0)] = 1;
    g.board[sq(6, 1)] = -1;
    g.board[sq(4, 3)] = -1;
    g.board[sq(4, 1)] = -1;
    const moves = ck.legalMoves(g);
    // From a1 over b2 to c3, then over d4 to e5 or over b4 to a5: two complete sequences, both legal.
    expect(moves.map((m) => m.path.length)).toEqual([3, 3]);
    const after = ck.play(g, moves[0]!);
    expect(after.board.filter((p) => p < 0)).toHaveLength(1);
    expect(after.turn).toBe(-1);
  });

  it("ends the move when a man is crowned", () => {
    const g = empty();
    g.board[sq(2, 1)] = 1;
    g.board[sq(1, 2)] = -1;
    g.board[sq(1, 4)] = -1; // would allow a king to jump on, but crowning ends the move
    g.board[sq(7, 7)] = -1;
    const moves = ck.legalMoves(g);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ path: [sq(2, 1), sq(0, 3)], crowns: true });
    expect(ck.play(g, moves[0]!).board[sq(0, 3)]).toBe(2);
  });

  it("loses with no legal move and draws after 40 quiet moves each", () => {
    const g = empty();
    g.board[sq(0, 1)] = 1; // a black man on the far row cannot move forward
    g.board[sq(7, 0)] = -1;
    g.turn = 1;
    g.board[sq(0, 1)] = 1;
    expect(ck.result(g)).toEqual({ winner: -1 });
    const k = empty();
    k.board[sq(4, 3)] = 2;
    k.board[sq(0, 7)] = -2;
    k.quiet = ck.DRAW_PLIES;
    expect(ck.result(k)).toEqual({ winner: 0 });
  });

  it("replays saves and stops at an illegal move", () => {
    const first = ck.legalMoves(ck.startGame())[0]!.path;
    const r = ck.replay([first, [0, 9], first]);
    expect(r.moves).toHaveLength(1);
  });

  it("the computer completes a double jump (a jump that can go on must)", () => {
    const g = empty();
    g.board[sq(5, 2)] = 1;
    g.board[sq(2, 5)] = -1;
    g.board[sq(3, 4)] = 1;
    g.turn = -1;
    // After taking (3,4) the white piece lands on (4,3) and must go on over (5,2).
    expect(ck.legalMoves(g).map((m) => m.captures)).toEqual([[sq(3, 4), sq(5, 2)]]);
    for (const level of ck.CHECKERS_LEVELS) expect(ck.bestMove(g, level, seeded(1))?.captures).toEqual([sq(3, 4), sq(5, 2)]);
  });
});

describe("reversi", () => {
  it("starts with four legal moves for black", () => {
    expect(rv.movesFor(rv.startGame().board, 1).sort((a, b) => a - b)).toEqual([19, 26, 37, 44]);
  });

  it("flips in all eight directions", () => {
    const board = new Array<number>(64).fill(0);
    const centre = sq(3, 3);
    for (const [dr, dc] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
      board[sq(3 + dr, 3 + dc)] = -1;
      board[sq(3 + 2 * dr, 3 + 2 * dc)] = 1;
    }
    expect(rv.flips(board, centre, 1)).toHaveLength(8);
  });

  it("passes when the other side has no move and ends when neither can", () => {
    // Black plays a1 and turns the last white disc: white has none left, the game is over.
    const board = new Array<number>(64).fill(0);
    board[1] = -1;
    board[2] = 1;
    const r = rv.play({ board, turn: 1 }, 0)!;
    expect(rv.over(r.game)).toBe(true);
    expect(rv.winner(r.game)).toBe(1);
    // White to move with no move while black has one: white passes automatically.
    const p = new Array<number>(64).fill(0);
    p[0] = 1; p[1] = -1; p[3] = -1; p[4] = 1;
    p[10] = -1;
    const after = rv.play({ board: p, turn: 1 }, 2)!;
    expect(after.game.board.slice(0, 5)).toEqual([1, 1, 1, 1, 1]);
    expect(after.passed).toBe(rv.movesFor(after.game.board, -1).length === 0 && rv.movesFor(after.game.board, 1).length > 0);
  });

  it("replays saves and every level returns a legal move", () => {
    const r = rv.replay([19, 18, 99, 17]);
    expect(r.moves).toEqual([19, 18]);
    for (const level of rv.REVERSI_LEVELS) {
      const m = rv.bestMove(r.game, level, seeded(2));
      expect(rv.movesFor(r.game.board, r.game.turn)).toContain(m);
    }
  });
});

describe("gomoku", () => {
  const P = (r: number, c: number) => r * gm.N + c;

  it("wins with five or more in all four directions", () => {
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const board = new Array<number>(gm.N * gm.N).fill(0);
      for (let i = 0; i < 6; i++) board[P(5 + dr * i, 7 + dc * i)] = 1;
      expect(gm.winningLine(board, P(5, 7))?.length).toBe(6);
    }
    const four = new Array<number>(gm.N * gm.N).fill(0);
    for (let i = 0; i < 4; i++) four[P(0, i)] = 1;
    expect(gm.winningLine(four, P(0, 0))).toBeNull();
  });

  it("the computer completes its own four and blocks the other side's", () => {
    let g = gm.startGame();
    // Black: row 7 cols 3–6 (open four next move); white: row 2 cols 3–6.
    for (const p of [P(7, 3), P(2, 3), P(7, 4), P(2, 4), P(7, 5), P(2, 5), P(7, 6), P(2, 6)]) g = gm.play(g, p)!;
    // Black to move: it wins at col 2 or col 7.
    const win = gm.bestMove(g, "medium", seeded(3))!;
    expect([P(7, 2), P(7, 7)]).toContain(win);
    // White to move against black's four with one end closed: it must block.
    let b = gm.startGame();
    for (const p of [P(9, 1), P(0, 0), P(9, 2), P(14, 14), P(9, 3), P(0, 14), P(9, 4), P(9, 0)]) b = gm.play(b, p)!;
    expect(b.turn).toBe(1);
    b = gm.play(b, P(13, 13))!;
    for (const level of gm.GOMOKU_LEVELS) expect(gm.bestMove(b, level, seeded(4))).toBe(P(9, 5));
  });

  it("replays saves and refuses taken points", () => {
    const r = gm.replay([P(7, 7), P(7, 7), P(7, 8)]);
    expect(r.moves).toEqual([P(7, 7)]);
  });
});
