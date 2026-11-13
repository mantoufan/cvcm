/**
 * Chinese chess (xiangqi) rules and computer play on top of XiangQi Wizard Light by Morning Yellow
 * (https://github.com/xqbase/xqwlight, GPL-2.0-or-later). The game-end checks follow its board.js postAddMove:
 * checkmate or stalemate (no legal move loses), repetition judged by repValue (a side that keeps checking
 * loses, otherwise a draw), no attacking pieces left on either side, and 100 plies without a capture.
 * This file is distributed under the GPL-2.0-or-later together with the engine; its source is cv.cm's public repository.
 */
import { DST, FILE_LEFT, FILE_X, IN_BOARD, MOVE, Position, RANK_TOP, RANK_Y, SRC, Search, WIN_VALUE, COORD_XY, LIMIT_DEPTH } from "../vendor/xqwlight/xqwlight.js";

export const START_FEN = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1";

/** Think time per level in milliseconds (XQWLight's own levels are 10, 100 and 1000). */
export const LEVEL_MS = [10, 100, 500, 1500] as const;

export type Side = "red" | "black";
export type PieceType = "k" | "a" | "b" | "n" | "r" | "c" | "p";
export type Piece = { side: Side; type: PieceType };
/** Files 0–8 from red's left, ranks 0–9 from black's back rank (row 0 is the top as red looks at the board). */
export type Point = { file: number; rank: number };
export type Result = { kind: "mate" | "repetition" | "material" | "moves"; winner: Side | null } | null;

const TYPES: PieceType[] = ["k", "a", "b", "n", "r", "c", "p"];

export function sqOf(p: Point): number {
  return COORD_XY(p.file + FILE_LEFT, p.rank + RANK_TOP);
}
export function pointOf(sq: number): Point {
  return { file: FILE_X(sq) - FILE_LEFT, rank: RANK_Y(sq) - RANK_TOP };
}
export const moveSrc = (mv: number): number => SRC(mv);
export const moveDst = (mv: number): number => DST(mv);
export const makeMv = (from: number, to: number): number => MOVE(from, to);

/** ICCS move text such as "h2e2" (files a–i from red's left, ranks 0–9 from red's side), for saves. */
export function toIccs(mv: number): string {
  const s = pointOf(SRC(mv));
  const d = pointOf(DST(mv));
  return `${"abcdefghi"[s.file]}${9 - s.rank}${"abcdefghi"[d.file]}${9 - d.rank}`;
}
export function fromIccs(text: string): number | null {
  const m = /^([a-i])([0-9])([a-i])([0-9])$/.exec(text);
  if (!m) return null;
  const f = (c: string) => "abcdefghi".indexOf(c);
  return MOVE(sqOf({ file: f(m[1]!), rank: 9 - Number(m[2]) }), sqOf({ file: f(m[3]!), rank: 9 - Number(m[4]) }));
}

export class Xiangqi {
  readonly pos: any;
  readonly moves: number[] = [];

  constructor() {
    this.pos = new Position();
    this.pos.fromFen(START_FEN);
  }

  /** Replays saved ICCS moves; stops at the first illegal one. */
  static replay(list: readonly string[]): Xiangqi {
    const g = new Xiangqi();
    for (const text of list) {
      const mv = fromIccs(text);
      if (mv === null || g.result() || !g.play(mv)) break;
    }
    return g;
  }

  turn(): Side {
    return this.pos.sdPlayer === 0 ? "red" : "black";
  }

  pieceAt(p: Point): Piece | null {
    const pc = this.pos.squares[sqOf(p)];
    if (!pc) return null;
    return { side: pc & 8 ? "red" : "black", type: TYPES[pc & 7]! };
  }

  /** Legal moves of the piece on `from` (the side to move's own pieces only). */
  legalFrom(from: number): number[] {
    const out: number[] = [];
    for (const mv of this.pos.generateMoves(null) as number[]) {
      if (SRC(mv) !== from || !this.pos.legalMove(mv)) continue;
      if (this.pos.makeMove(mv)) {
        this.pos.undoMakeMove();
        out.push(mv);
      }
    }
    return out;
  }

  play(mv: number): boolean {
    if (!this.pos.legalMove(mv) || !this.pos.makeMove(mv)) return false;
    this.moves.push(mv);
    return true;
  }

  undo(): boolean {
    if (!this.moves.length) return false;
    this.pos.undoMakeMove();
    this.moves.pop();
    return true;
  }

  inCheck(): boolean {
    return this.pos.inCheck();
  }

  /** Where the side to move's general stands (for the check highlight). */
  kingSquare(): number {
    const pc = (this.pos.sdPlayer === 0 ? 8 : 16) + 0;
    for (let sq = 0; sq < 256; sq++) if (IN_BOARD(sq) && this.pos.squares[sq] === pc) return sq;
    return 0;
  }

  /** The end of the game after the last move, as XQWLight's board.js decides it. */
  result(): Result {
    if (!this.moves.length) return null;
    const mover: Side = this.turn() === "red" ? "black" : "red";
    if (this.pos.isMate()) return { kind: "mate", winner: mover };
    let rep = this.pos.repStatus(3);
    if (rep > 0) {
      rep = this.pos.repValue(rep);
      // repValue is from the side to move's view: below -WIN_VALUE it lost (the mover's repetition was allowed).
      if (rep > -WIN_VALUE && rep < WIN_VALUE) return { kind: "repetition", winner: null };
      return { kind: "repetition", winner: rep < 0 ? mover : this.turn() };
    }
    if (this.pos.captured()) {
      let material = false;
      for (let sq = 0; sq < 256; sq++) if (IN_BOARD(sq) && (this.pos.squares[sq] & 7) > 2) material = true;
      if (!material) return { kind: "material", winner: null };
    } else if (this.pos.pcList.length > 100) {
      let captured = false;
      for (let i = 2; i <= 100; i++) if (this.pos.pcList[this.pos.pcList.length - i] > 0) captured = true;
      if (!captured) return { kind: "moves", winner: null };
    }
    return null;
  }

  /** The computer's move: book first, then iterative deepening for about `millis` (XQWLight's searchMain). */
  bestMove(millis: number): number {
    const search = new Search(this.pos, 16);
    const mv = search.searchMain(LIMIT_DEPTH, millis) as number;
    return mv;
  }
}
