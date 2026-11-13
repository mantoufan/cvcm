/// <reference lib="webworker" />
/**
 * Runs XiangQi Wizard Light's search (GPL-2.0-or-later, https://github.com/xqbase/xqwlight) off the page's thread.
 * In: { id, moves: ICCS strings, millis }. Out: { id, move: ICCS string or null }.
 */
import { Xiangqi, toIccs } from "../../shared/xiangqi";

self.onmessage = (e: MessageEvent<{ id: number; moves: string[]; millis: number }>) => {
  const { id, moves, millis } = e.data;
  const game = Xiangqi.replay(moves);
  const mv = game.moves.length === moves.length && !game.result() ? game.bestMove(millis) : 0;
  (self as unknown as Worker).postMessage({ id, move: mv > 0 ? toIccs(mv) : null });
};
