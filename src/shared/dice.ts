import { randomInt } from "./random";

export const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;
export const MAX_DICE = 50;
export const MAX_COINS = 50;

export type DiceRoll = { sides: number; rolls: number[]; total: number };
export type CoinFace = "heads" | "tails";

/** Rolls `count` dice with `sides` faces. Returns null for a non-integer count or an unsupported die. */
export function rollDice(count: number, sides: number, rng: () => number = cryptoUnit): DiceRoll | null {
  if (!Number.isInteger(count) || !Number.isInteger(sides)) return null;
  if (count < 1 || count > MAX_DICE || sides < 2 || sides > 1000) return null;
  const rolls = Array.from({ length: count }, () => 1 + Math.floor(rng() * sides));
  return { sides, rolls, total: rolls.reduce((sum, n) => sum + n, 0) };
}

/** Flips `count` fair coins. */
export function flipCoins(count: number, rng: () => number = cryptoUnit): CoinFace[] | null {
  if (!Number.isInteger(count) || count < 1 || count > MAX_COINS) return null;
  return Array.from({ length: count }, () => (rng() < 0.5 ? "heads" : "tails"));
}

/** Uniform number in [0, 1) from the shared Web Crypto draw (same source as the random number tool). */
function cryptoUnit(): number {
  return randomInt(0, 0xffffffff) / 4294967296;
}
