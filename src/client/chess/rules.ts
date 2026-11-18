/*! @license Uses chess.js (https://github.com/jhlywa/chess.js) — Copyright (c) 2025, Jeff Hlywa. BSD-2-Clause. */
import { Chess, type Move } from "chess.js";

/** Game helpers shared by /chess/ and /3d-chess/ (kept out of either page's chunk so each page keeps its own). */

/** Replays saved UCI moves; stops at the first one that is not legal. */
export function replay(moves: readonly string[]): Chess {
  const game = new Chess();
  for (const m of moves) {
    try {
      game.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
    } catch {
      break;
    }
  }
  return game;
}

export const uci = (m: Pick<Move, "from" | "to" | "promotion">) => `${m.from}${m.to}${m.promotion ?? ""}`;

/** The reason the game ended, as a locale key under chess.*, or null while it goes on. */
export function endReason(game: Chess): string | null {
  if (game.isCheckmate()) return game.turn() === "w" ? "blackMates" : "whiteMates";
  if (game.isStalemate()) return "stalemate";
  if (game.isInsufficientMaterial()) return "insufficient";
  if (game.isThreefoldRepetition()) return "repetition";
  if (game.isDrawByFiftyMoves()) return "fifty";
  if (game.isDraw()) return "draw";
  return null;
}
