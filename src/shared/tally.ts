export const MAX_COUNTERS = 12;
export const MAX_STEP = 1000;
export const MAX_NAME = 40;
/** Counts stay within ±1e12 so they never lose integer precision. */
export const MAX_COUNT = 1e12;

export type Counter = { name: string; count: number };
export type TallyState = { counters: Counter[]; step: number; allowNegative: boolean };

export function clampStep(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_STEP, Math.max(1, Math.round(value)));
}

/** Adds delta to count; without allowNegative the count stops at zero. */
export function bump(count: number, delta: number, allowNegative: boolean): number {
  const next = count + delta;
  const floor = allowNegative ? -MAX_COUNT : 0;
  return Math.min(MAX_COUNT, Math.max(floor, next));
}

export function total(counters: readonly Counter[]): number {
  return counters.reduce((sum, c) => sum + c.count, 0);
}

/** Reads a saved state, dropping anything malformed; null when nothing usable was saved. */
export function parseTally(raw: string | null): TallyState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<TallyState>;
    if (!Array.isArray(data.counters)) return null;
    const counters = data.counters
      .filter((c): c is Counter => !!c && typeof c.name === "string" && Number.isInteger(c.count) && Math.abs(c.count) <= MAX_COUNT)
      .slice(0, MAX_COUNTERS)
      .map((c) => ({ name: c.name.slice(0, MAX_NAME), count: c.count }));
    if (!counters.length) return null;
    const allowNegative = data.allowNegative === true;
    return {
      counters: allowNegative ? counters : counters.map((c) => ({ ...c, count: Math.max(0, c.count) })),
      step: clampStep(Number(data.step)),
      allowNegative,
    };
  } catch {
    return null;
  }
}
