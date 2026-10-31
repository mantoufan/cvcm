import { randomInt } from "./random";

export const MAX_ENTRIES = 100;
export const MAX_LABEL = 40;

/** The label a line becomes on the wheel: trimmed and capped at MAX_LABEL characters. */
export function normalizeEntry(line: string): string {
  return Array.from(line.trim()).slice(0, MAX_LABEL).join("");
}

/** One entry per non-empty line, capped at MAX_ENTRIES. */
export function parseEntries(text: string): string[] {
  return text.split(/\r?\n/).map(normalizeEntry).filter((line) => line !== "").slice(0, MAX_ENTRIES);
}

/** Different names in a list; repeated lines only add odds. */
export function distinctEntries(list: readonly string[]): string[] {
  return [...new Set(list)];
}

/** A spin needs two different names; "A" twice has only one possible result. */
export function canSpin(list: readonly string[]): boolean {
  return distinctEntries(list).length >= 2;
}

/** Uniform winner index from Web Crypto (a line repeated twice has twice the chance). */
export function pickIndex(count: number): number {
  return randomInt(0, count - 1);
}

/**
 * Segment i covers [i·seg, (i+1)·seg) degrees clockwise from the top pointer at rotation 0.
 * A clockwise rotation r puts wheel angle (360 − r mod 360) under the pointer.
 */
export function indexAt(rotation: number, count: number): number {
  const seg = 360 / count;
  const under = (((360 - (rotation % 360)) % 360) + 360) % 360;
  return Math.min(count - 1, Math.floor(under / seg));
}

/**
 * Rotation (degrees, larger than `from`) that stops segment `index` under the pointer after `turns` full turns.
 * `offset` in [0, 1) places the stop inside the segment; it is kept away from the edges so the pointer never sits on a line.
 */
export function spinTarget(from: number, index: number, count: number, offset: number, turns = 6): number {
  const seg = 360 / count;
  const inside = 0.15 + Math.min(Math.max(offset, 0), 0.999) * 0.7;
  const angle = (index + inside) * seg;
  const base = from - (((from % 360) + 360) % 360);
  let target = base + turns * 360 + ((360 - angle) % 360);
  while (target - from < turns * 360) target += 360;
  return target;
}
