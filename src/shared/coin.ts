import type { CoinFace } from "./dice";

export type { CoinFace };

/** Coins per press the page offers. */
export const FLIP_COUNTS = [1, 10, 100, 1000] as const;
/** The history keeps this many faces (counts keep going past it). */
export const HISTORY_MAX = 1000;

/** One fair flip from one random bit of Web Crypto (no modulo bias). */
export function flipCoin(bit: () => number = cryptoBit): CoinFace {
  return bit() ? "heads" : "tails";
}

function cryptoBit(): number {
  const buf = new Uint8Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! & 1;
}

export type CoinStats = {
  heads: number;
  tails: number;
  total: number;
  /** Longest run of one face in the kept history. */
  longest: { face: CoinFace; length: number } | null;
  /** The run the last flip belongs to. */
  current: { face: CoinFace; length: number } | null;
};

/** Counts come from `heads`/`tails` (all flips); streaks from the kept history, oldest first. */
export function coinStats(heads: number, tails: number, history: readonly CoinFace[]): CoinStats {
  let longest: CoinStats["longest"] = null;
  let run: CoinStats["current"] = null;
  for (const face of history) {
    run = run && run.face === face ? { face, length: run.length + 1 } : { face, length: 1 };
    if (!longest || run.length > longest.length) longest = { ...run };
  }
  return { heads, tails, total: heads + tails, longest, current: run };
}

/** Share of heads in whole percent with one decimal, "—" before any flip. */
export function percentText(part: number, total: number): string {
  if (!total) return "—";
  return `${(Math.round((part / total) * 1000) / 10).toFixed(1)}%`;
}
