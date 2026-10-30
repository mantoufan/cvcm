export const MAX_VALUES = 100000;

export type ParsedNumbers = { values: number[]; skipped: string[] };

/** Numbers separated by spaces, new lines, commas or semicolons. Decimals use a dot. Anything else is skipped. */
export function parseNumbers(text: string): ParsedNumbers {
  const values: number[] = [];
  const skipped: string[] = [];
  for (const raw of text.split(/[\s,;，；、]+/)) {
    if (raw === "") continue;
    const token = raw.replace(/[−–]/g, "-");
    const n = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(token) ? Number(token) : NaN;
    if (Number.isFinite(n) && values.length < MAX_VALUES) values.push(n);
    else if (!Number.isFinite(n)) skipped.push(raw);
  }
  return { values, skipped };
}

export type Stats = {
  count: number;
  sum: number;
  mean: number;
  median: number;
  modes: number[];
  modeCount: number;
  min: number;
  max: number;
  range: number;
  populationSd: number;
  sampleSd: number | null;
  populationVariance: number;
  sampleVariance: number | null;
  geometricMean: number | null;
};

export function stats(values: readonly number[]): Stats | null {
  const count = values.length;
  if (count === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  // Kahan summation keeps 0.1 + 0.2 + … sums from drifting on long lists.
  let sum = 0;
  let c = 0;
  for (const v of values) {
    const y = v - c;
    const t = sum + y;
    c = t - sum - y;
    sum = t;
  }
  const mean = sum / count;
  const mid = count >> 1;
  const median = count % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const freq = new Map<number, number>();
  for (const v of sorted) freq.set(v, (freq.get(v) ?? 0) + 1);
  const top = Math.max(...freq.values());
  // No mode when every value appears the same number of times (all unique, or 1 1 2 2).
  const modes = freq.size > 1 && [...freq.values()].some((n) => n !== top) ? [...freq].filter(([, n]) => n === top).map(([v]) => v) : [];
  let sq = 0;
  for (const v of values) sq += (v - mean) ** 2;
  const populationVariance = sq / count;
  const sampleVariance = count > 1 ? sq / (count - 1) : null;
  const geometricMean = sorted[0] > 0 ? Math.exp(values.reduce((s, v) => s + Math.log(v), 0) / count) : null;
  return {
    count,
    sum,
    mean,
    median,
    modes,
    modeCount: modes.length ? top : 0,
    min: sorted[0],
    max: sorted[count - 1],
    range: sorted[count - 1] - sorted[0],
    populationSd: Math.sqrt(populationVariance),
    sampleSd: sampleVariance == null ? null : Math.sqrt(sampleVariance),
    populationVariance,
    sampleVariance,
    geometricMean,
  };
}

/** Weighted mean of value/weight pairs; null when the weights do not sum to a positive number. */
export function weightedMean(values: readonly number[], weights: readonly number[]): number | null {
  if (values.length === 0 || values.length !== weights.length) return null;
  if (weights.some((w) => !Number.isFinite(w) || w < 0)) return null;
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return null;
  return values.reduce((s, v, i) => s + v * weights[i], 0) / total;
}
