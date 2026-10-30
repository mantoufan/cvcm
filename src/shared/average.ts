export const MAX_VALUES = 100000;

export type ParsedNumbers = { values: number[]; skipped: string[]; truncated: number };

export type DecimalMark = "." | ",";

/**
 * Numbers separated by spaces, new lines or semicolons. With a dot as the decimal mark commas separate too;
 * with a comma ("3,5") the comma is the decimal mark. Anything else is skipped.
 */
export function parseNumbers(text: string, decimal: DecimalMark = "."): ParsedNumbers {
  const values: number[] = [];
  const skipped: string[] = [];
  let truncated = 0;
  // With a dot decimal mark, "1,234.50" (comma before groups of three digits, no space) is one number with thousands
  // separators; any other comma separates numbers.
  const chunks = decimal === ","
    ? text.split(/[\s;；、]+/)
    : text.split(/[\s;；、]+/).flatMap((chunk) => (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(chunk) ? [chunk.replaceAll(",", "")] : chunk.split(/[,，]+/)));
  for (const raw of chunks) {
    if (raw === "") continue;
    let token = raw.replace(/[−–]/g, "-");
    if (decimal === ",") token = token.replace(",", ".");
    const n = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(token) ? Number(token) : NaN;
    if (!Number.isFinite(n)) skipped.push(raw);
    else if (values.length < MAX_VALUES) values.push(n);
    else truncated++;
  }
  return { values, skipped, truncated };
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
  // Work on values divided by the largest magnitude so 1e308 + 1e308 does not overflow the mean or variance.
  const scale = Math.max(Math.abs(sorted[0]), Math.abs(sorted[count - 1])) || 1;
  // Kahan summation keeps 0.1 + 0.2 + … sums from drifting on long lists.
  let scaled = 0;
  let c = 0;
  for (const v of values) {
    const y = v / scale - c;
    const t = scaled + y;
    c = t - scaled - y;
    scaled = t;
  }
  const sum = scaled * scale;
  const mean = (scaled / count) * scale;
  const mid = count >> 1;
  const median = count % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const freq = new Map<number, number>();
  // Track the top count in the loop: spreading 100k distinct values into Math.max overflows Safari's argument limit.
  let top = 0;
  for (const v of sorted) {
    const n = (freq.get(v) ?? 0) + 1;
    freq.set(v, n);
    if (n > top) top = n;
  }
  // No mode when every value appears the same number of times (all unique, or 1 1 2 2); 5 5 5 has mode 5.
  const tie = freq.size > 1 && [...freq.values()].every((n) => n === top);
  const modes = top > 1 && !tie ? [...freq].filter(([, n]) => n === top).map(([v]) => v) : [];
  let sq = 0;
  for (const v of values) sq += (v / scale - mean / scale) ** 2;
  const populationVariance = (sq / count) * scale * scale;
  const sampleVariance = count > 1 ? (sq / (count - 1)) * scale * scale : null;
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
