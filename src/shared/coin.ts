import type { CoinFace } from "./dice";

export type { CoinFace };

/** Coins per press the page offers. */
export const FLIP_COUNTS = [1, 10, 100, 1000] as const;
/** The history keeps this many faces (counts keep going past it). */
export const HISTORY_MAX = 1000;

/** Fair flips from one Web Crypto draw: one random bit per coin (no modulo bias), 8 coins per byte. */
export function flipCoins(count: number, bytes: (n: number) => Uint8Array = cryptoBytes): CoinFace[] {
  const n = Math.max(0, Math.floor(count));
  const buf = bytes(Math.ceil(n / 8));
  const out: CoinFace[] = [];
  for (let i = 0; i < n; i++) out.push((buf[i >> 3]! >> (i & 7)) & 1 ? "heads" : "tails");
  return out;
}

function cryptoBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  if (n) crypto.getRandomValues(buf);
  return buf;
}

export type Run = { face: CoinFace; length: number };

/** Streaks over every flip so far, updated as coins land (the history kept for display may be shorter). */
export type Streaks = { longest: Run | null; current: Run | null };

export function extendStreaks(prev: Streaks, faces: readonly CoinFace[]): Streaks {
  let { longest, current } = prev;
  for (const face of faces) {
    current = current && current.face === face ? { face, length: current.length + 1 } : { face, length: 1 };
    if (!longest || current.length > longest.length) longest = current;
  }
  return { longest, current };
}

/** Share in percent with one decimal, "—" before any flip. */
export function percentText(part: number, total: number): string {
  if (!total) return "—";
  return `${(Math.round((part / total) * 1000) / 10).toFixed(1)}%`;
}
