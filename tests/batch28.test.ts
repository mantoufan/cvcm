import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { seeded } from "../src/shared/random";
import { fromSaved, move, movesAvailable, newGame, toCells, type Game } from "../src/shared/game2048";
import { canMatch, deal, fromSavedBoard, isFree, layoutPlaces, matchingPairs, remaining, removePair, reshuffle, toSaved, type Board } from "../src/shared/mahjong";
import { LAYOUT_IDS } from "../src/shared/mahjong-layouts";
import { Xiangqi, fromIccs, sqOf, toIccs } from "../src/shared/xiangqi";
import { goCommand, parseBestMove } from "../src/client/chess/engine";
import { endReason, replay, uci } from "../src/client/chess/ui";
import { swipeDirection } from "../src/client/game-input";

const board = (cells: number[]): Game => fromSaved({ cells, score: 0 })!;
const noSpawn = () => 0.99;

describe("2048", () => {
  it("starts with two tiles, deterministically for a seed", () => {
    const a = newGame(seeded(2048));
    expect(a.tiles).toHaveLength(2);
    expect(toCells(newGame(seeded(2048)).tiles)).toEqual(toCells(a.tiles));
  });

  it("merges each tile once per move", () => {
    const r = move(board([2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), "left", noSpawn);
    expect(toCells(r.game.tiles).slice(0, 4)).toEqual([4, 4, 0, 0]);
    expect(r.gained).toBe(8);
    expect(r.game.score).toBe(8);
    expect(r.consumed).toHaveLength(2);
    expect(r.game.tiles).toHaveLength(3);
  });

  it("merges towards the moving side first", () => {
    const r = move(board([2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), "right", noSpawn);
    expect(toCells(r.game.tiles).slice(0, 4)).toEqual([0, 0, 2, 4]);
  });

  it("does nothing when no tile can move", () => {
    const g = board([2, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(move(g, "left", noSpawn).moved).toBe(false);
    expect(move(g, "up", noSpawn).moved).toBe(false);
  });

  it("wins at 2048 and ends when the board is locked", () => {
    const w = move(board([1024, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), "left", noSpawn);
    expect(w.game.won).toBe(true);
    const locked = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2];
    expect(movesAvailable(board(locked).tiles)).toBe(false);
    expect(board(locked).over).toBe(true);
  });

  it("rejects bad saves", () => {
    expect(fromSaved({ cells: [3, ...new Array(15).fill(0)] })).toBeNull();
    expect(fromSaved({ cells: [2] })).toBeNull();
    expect(fromSaved(null)).toBeNull();
  });
});

/** Greedy play with backtracking-free hint order is not enough to prove solvability; replay the builder's order. */
function solveByRemoval(b: Board): boolean {
  // Depth-first over matching pairs, capped, to show a deal can be cleared.
  const seen = new Set<string>();
  const go = (cur: Board, depth: number): boolean => {
    if (!remaining(cur)) return true;
    const key = cur.stones.map((s) => (s.gone ? "0" : "1")).join("");
    if (seen.has(key) || seen.size > 20000) return false;
    seen.add(key);
    for (const [a, c] of matchingPairs(cur)) if (go(removePair(cur, a, c), depth + 1)) return true;
    return false;
  };
  return go(b, 0);
}

describe("mahjong", () => {
  it("every layout has 144 places and deals 36 groups of four", () => {
    for (const id of LAYOUT_IDS) {
      expect(layoutPlaces(id)).toHaveLength(144);
      const b = deal(id, seeded(7));
      const counts = new Map<number, number>();
      for (const s of b.stones) counts.set(s.group, (counts.get(s.group) ?? 0) + 1);
      expect([...counts.values()].every((n) => n === 4)).toBe(true);
    }
  });

  it("the start deal is the same every time", () => {
    expect(deal("turtle", seeded(1)).stones.map((s) => s.face)).toEqual(deal("turtle", seeded(1)).stones.map((s) => s.face));
  });

  it("a covered tile is not free", () => {
    const b = deal("turtle", seeded(1));
    const top = b.stones.findIndex((s) => s.z === 4);
    const under = b.stones.findIndex((s) => s.z === 3 && Math.abs(s.x - b.stones[top]!.x) <= 1 && Math.abs(s.y - b.stones[top]!.y) <= 1);
    expect(isFree(b, top)).toBe(true);
    expect(isFree(b, under)).toBe(false);
  });

  it("deals can be cleared", () => {
    for (const seed of [1, 2, 3]) expect(solveByRemoval(deal("pyramid", seeded(seed)))).toBe(true);
  });

  it("only free tiles of one group match", () => {
    const b = deal("turtle", seeded(1));
    const [a, c] = matchingPairs(b)[0]!;
    expect(canMatch(b, a, c)).toBe(true);
    expect(canMatch(b, a, a)).toBe(false);
  });

  it("reshuffle keeps removed tiles and stays clearable", () => {
    let b = deal("fortress", seeded(4));
    const [a, c] = matchingPairs(b)[0]!;
    b = removePair(b, a, c);
    const r = reshuffle(b, seeded(9))!;
    expect(r.stones[a]!.gone && r.stones[c]!.gone).toBe(true);
    expect(remaining(r)).toBe(142);
    expect(solveByRemoval(r)).toBe(true);
  });

  it("saves round-trip and illegal removals are rejected", () => {
    let b = deal("castle", seeded(5));
    const [a, c] = matchingPairs(b)[0]!;
    b = removePair(b, a, c);
    const back = fromSavedBoard(toSaved(b, [a, c]))!;
    expect(back.board.stones.map((s) => s.gone)).toEqual(b.stones.map((s) => s.gone));
    const blocked = b.stones.findIndex((s, i) => !s.gone && !isFree(b, i));
    expect(fromSavedBoard({ ...toSaved(b, []), removed: [blocked, blocked === 0 ? 1 : 0] })).toBeNull();
    expect(fromSavedBoard({ layout: "nope", faces: [], removed: [] })).toBeNull();
  });
});

describe("chinese chess", () => {
  it("knows the opening moves and ICCS round-trips", () => {
    const g = new Xiangqi();
    expect(g.turn()).toBe("red");
    const cannon = sqOf({ file: 7, rank: 7 });
    expect(g.legalFrom(cannon).map(toIccs)).toContain("h2e2");
    const mv = fromIccs("h2e2")!;
    expect(toIccs(mv)).toBe("h2e2");
    expect(g.play(mv)).toBe(true);
    expect(g.turn()).toBe("black");
    expect(g.pieceAt({ file: 4, rank: 7 })).toEqual({ side: "red", type: "c" });
  });

  it("rejects illegal moves and replays saves", () => {
    const g = new Xiangqi();
    expect(g.play(fromIccs("a0a5")!)).toBe(false);
    const r = Xiangqi.replay(["h2e2", "h9g7", "zz", "b0c2"]);
    expect(r.moves.map(toIccs)).toEqual(["h2e2", "h9g7"]);
    expect(r.undo()).toBe(true);
    expect(r.moves).toHaveLength(1);
  });

  it("the computer answers with a legal move", () => {
    const g = new Xiangqi();
    g.play(fromIccs("h2e2")!);
    const mv = g.bestMove(50);
    expect(mv).toBeGreaterThan(0);
    expect(g.play(mv)).toBe(true);
    expect(g.moves).toHaveLength(2);
  });

  it("spots checkmate", () => {
    // Two red chariots against a bare general: after the computer's reply, keep playing until the game ends.
    const g = new Xiangqi();
    g.pos.fromFen("4k4/9/9/9/9/9/9/R8/R8/3K5 w - - 0 1");
    for (let i = 0; i < 40 && !g.result(); i++) expect(g.play(g.bestMove(30))).toBe(true);
    expect(g.result()).toEqual({ kind: "mate", winner: "red" });
  });
});

describe("chess helpers", () => {
  it("parses UCI answers", () => {
    expect(parseBestMove("bestmove e2e4 ponder e7e5")).toBe("e2e4");
    expect(parseBestMove("bestmove e7e8q")).toBe("e7e8q");
    expect(parseBestMove("bestmove (none)")).toBeNull();
    expect(goCommand(0)).toBe("go depth 1 movetime 250");
    expect(goCommand(4)).toBe("go movetime 1500");
  });

  it("replays saved moves and names the end", () => {
    const g = replay(["f2f3", "e7e5", "g2g4", "d8h4", "a2a3"]);
    expect(g.history()).toEqual(["f3", "e5", "g4", "Qh4#"]);
    expect(endReason(g)).toBe("blackMates");
    expect(endReason(new Chess())).toBeNull();
    expect(uci({ from: "e7", to: "e8", promotion: "q" })).toBe("e7e8q");
  });
});

describe("swipes", () => {
  it("needs 10 px along the main axis", () => {
    expect(swipeDirection(5, 3)).toBeNull();
    expect(swipeDirection(30, 5)).toBe("right");
    expect(swipeDirection(-3, -40)).toBe("up");
  });
});

describe("batch 28 copy", () => {
  it("every new game has a real title and description in every locale", async () => {
    const { pageTitle, pageDescription } = await import("../src/shared/seo");
    const { LOCALES } = await import("../src/shared/locale");
    for (const loc of LOCALES) for (const id of ["2048", "dinosaur-game", "mahjong", "chess", "chinese-chess"] as const) {
      expect(pageTitle(loc, id)).not.toMatch(/meta\./);
      expect(pageDescription(loc, id)).not.toMatch(/meta\./);
    }
  });
});
