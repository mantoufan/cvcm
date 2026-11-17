/**
 * Calculations behind the academic statistics tools: standard deviation, sample size, Cronbach's alpha, t-tests,
 * chi-square tests, p-values and z-scores. Pure functions (no DOM) so every number on the pages is testable.
 */
import {
  chiInvUpper, chiUpper, fInvUpper, fUpper, normCdf, normInv, normUpper, symmetricP, tInvUpper, tUpper, type Tail,
} from "./stat-dist";

// ---------- formatting for APA-style report lines ----------

/** APA style: p = .027, p < .001 (no leading zero, three decimals). */
export function apaP(p: number): string {
  if (!Number.isFinite(p)) return "p = —";
  if (p < 0.001) return "p < .001";
  // Never round up to an exact 1: .9996 is reported as p > .999 (a p of exactly 1, as for χ² = 0, stays 1.000).
  if (p === 1) return "p = 1.000";
  if (p >= 0.9995) return "p > .999";
  // Never round across a usual cut-off: p = .04996 is reported as p < .05, not p = .050 next to "significant".
  for (const cut of [0.01, 0.05, 0.1]) if (p < cut && Number(p.toFixed(3)) >= cut) return `p < ${cut.toFixed(2).replace(/^0/, "")}`;
  return `p = ${p.toFixed(3).replace(/^0/, "")}`;
}

/** A statistic to two decimals, e.g. 2.31 or −0.48 (APA uses a true minus in print; we keep "-" for pasting). */
export function apa2(x: number): string {
  if (!Number.isFinite(x)) return "—";
  const s = x.toFixed(2);
  return s === "-0.00" ? "0.00" : s;
}

/** A value that cannot exceed 1 in magnitude (alpha, r, Cramér's V): two decimals without the leading zero. */
export function apaUnit(x: number): string {
  if (!Number.isFinite(x)) return "—";
  const s = x.toFixed(2);
  return (s === "-0.00" ? "0.00" : s).replace(/^(-?)0\./, "$1.");
}

/** Degrees of freedom: whole numbers as is, Welch's fractional df to two decimals. */
export function apaDf(df: number): string {
  return Number.isInteger(df) ? String(df) : df.toFixed(2);
}

// ---------- standard deviation ----------

export type SdKind = "sample" | "population";

export type SdResult = {
  n: number;
  mean: number;
  sum: number;
  /** Σ(x − mean)². */
  ss: number;
  variance: number;
  sd: number;
  /** Standard error of the mean, sd / √n. */
  se: number;
  /** Coefficient of variation, sd / |mean| (null when the mean is 0). */
  cv: number | null;
  min: number;
  max: number;
  /** Divisor used: n − 1 for a sample, n for a population. */
  divisor: number;
};

/**
 * Mean and sum of squared deviations in O(n), shared by every tool here. Values are divided by the largest magnitude
 * so 1e160-sized data neither overflow nor underflow, and the mean uses a compensated (Kahan) sum like the average
 * tool. `ss` is returned scaled (multiply by scale²) so callers can take roots before scaling back.
 */
function moments(values: readonly number[]): { n: number; mean: number; sum: number; ssScaled: number; scale: number; min: number; max: number } | null {
  const n = values.length;
  if (n === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) { if (v < min) min = v; if (v > max) max = v; }
  const scale = Math.max(Math.abs(min), Math.abs(max)) || 1;
  let sum = 0;
  let c = 0;
  for (const v of values) {
    const y = v / scale - c;
    const t = sum + y;
    c = t - sum - y;
    sum = t;
  }
  const meanScaled = sum / n;
  let ssScaled = 0;
  for (const v of values) ssScaled += (v / scale - meanScaled) ** 2;
  return { n, mean: meanScaled * scale, sum: sum * scale, ssScaled, scale, min, max };
}

export function standardDeviation(values: readonly number[], kind: SdKind): SdResult | null {
  const m = moments(values);
  if (!m || (kind === "sample" && m.n < 2)) return null;
  const divisor = kind === "sample" ? m.n - 1 : m.n;
  const sd = Math.sqrt(m.ssScaled / divisor) * m.scale;
  // A mean that is zero up to rounding (0.1 + 0.2 − 0.3 = 5.6e-17) has no meaningful coefficient of variation.
  const zeroMean = Math.abs(m.mean) <= 4 * m.n * Number.EPSILON * m.scale;
  const out: SdResult = {
    n: m.n,
    mean: zeroMean ? 0 : m.mean,
    sum: m.sum,
    ss: m.ssScaled * m.scale * m.scale,
    variance: (m.ssScaled / divisor) * m.scale * m.scale,
    sd,
    se: sd / Math.sqrt(m.n),
    cv: zeroMean ? null : sd / Math.abs(m.mean),
    min: m.min,
    max: m.max,
    divisor,
  };
  return [out.mean, out.sd, out.variance, out.ss].every(Number.isFinite) ? out : null;
}

// ---------- sample size ----------

export type SampleMethod = "proportion" | "slovin" | "mean";
export const SAMPLE_METHODS: readonly SampleMethod[] = ["proportion", "slovin", "mean"];
export const CONFIDENCE_LEVELS = [80, 85, 90, 95, 98, 99, 99.9] as const;

/** Two-sided critical z for a confidence level in % (95 → 1.959964). */
export function zFor(confidencePct: number): number {
  return normInv(0.5 + confidencePct / 200);
}

export type SampleSizeInput = {
  method: SampleMethod;
  confidence: number;
  /** Margin of error in % for proportion and Slovin; in the data's own units for a mean. */
  margin: number;
  /** Expected proportion in % (proportion method). */
  proportion?: number;
  /** Population standard deviation (mean method). */
  sigma?: number;
  /** Population size; optional for proportion and mean (finite population correction), required for Slovin. */
  population?: number;
  /** Expected response rate in %; the number to invite is n ÷ rate. */
  responseRate?: number;
};

export type SampleSizeResult = {
  /** Required sample, rounded up. */
  n: number;
  /** Before the finite population correction (or Slovin's exact value, unrounded). */
  n0: number;
  /** After the correction, unrounded. */
  exact: number;
  z: number | null;
  corrected: boolean;
  /** People to invite for the response rate (rounded up), or null at 100 %. */
  invite: number | null;
};

const pos = (x: number | undefined): x is number => typeof x === "number" && Number.isFinite(x) && x > 0;
/** Largest degrees of freedom the p-value tool accepts (accuracy in stat-dist.ts holds up to here). */
export const MAX_DF = 1_000_000;
const dfOk = (x: number | undefined): x is number => pos(x) && x <= MAX_DF;

export function sampleSize(i: SampleSizeInput): SampleSizeResult | null {
  const N = pos(i.population) ? i.population : undefined;
  if (N !== undefined && !Number.isInteger(N)) return null;
  let n0: number;
  let exact: number;
  let z: number | null = null;
  if (i.method === "slovin") {
    if (N === undefined || !(i.margin > 0 && i.margin < 100)) return null;
    const e = i.margin / 100;
    n0 = exact = N / (1 + N * e * e);
  } else {
    if (!(i.confidence > 0 && i.confidence < 100) || !pos(i.margin)) return null;
    z = zFor(i.confidence);
    if (i.method === "proportion") {
      // 0 % or 100 % gives p(1 − p) = 0: no sample size to compute.
      if (!(i.margin < 100) || i.proportion === undefined || !(i.proportion > 0 && i.proportion < 100)) return null;
      const p = i.proportion / 100;
      const e = i.margin / 100;
      n0 = (z * z * p * (1 - p)) / (e * e);
    } else {
      if (!pos(i.sigma)) return null;
      n0 = ((z * i.sigma) / i.margin) ** 2;
    }
    // Finite population correction: n = n0 / (1 + (n0 − 1) / N).
    // Below one person the correction would raise n (its denominator drops under 1), so it only applies from n0 > 1.
    exact = N !== undefined && n0 > 1 ? n0 / (1 + (n0 - 1) / N) : n0;
  }
  // 1e-9 guards against 384.00000000000006 becoming 385.
  let n = Math.max(1, Math.ceil(exact - 1e-9));
  if (N !== undefined) n = Math.min(n, N);
  const rate = i.responseRate;
  if (rate !== undefined && !(rate > 0 && rate <= 100)) return null;
  // Never more invitations than people: with a small population everyone is invited.
  const inviteAll = rate !== undefined && rate < 100 ? Math.ceil(n / (rate / 100) - 1e-9) : null;
  const invite = inviteAll !== null && N !== undefined ? Math.min(inviteAll, N) : inviteAll;
  if (![n0, exact, n].every(Number.isFinite)) return null;
  return { n, n0, exact, z, corrected: i.method !== "slovin" && N !== undefined && n0 > 1, invite };
}

// ---------- Cronbach's alpha ----------

export type Matrix = { names: string[]; rows: number[][]; skipped: number; truncated: boolean };
/** Limits that keep a repaint fast (pairwise item correlations are O(k² n)). */
export const MAX_RESPONDENTS = 10_000;
export const MAX_ITEMS = 100;

/**
 * Item scores pasted from a spreadsheet: one respondent per line, one item per column, split by tabs, semicolons,
 * commas (when the decimal mark is a dot) or spaces. A first line with any non-number cell is taken as item names.
 * Lines with a missing or non-numeric score, or a different number of cells, are skipped (listwise deletion).
 */
export type HeaderMode = "auto" | "yes" | "no";
export const HEADER_MODES: readonly HeaderMode[] = ["auto", "yes", "no"];

export function parseMatrix(text: string, decimal: "." | "," = ".", header: HeaderMode = "auto"): Matrix | null {
  const lines = text.replace(/\r/g, "").split("\n").map((l) => l.trim()).filter((l) => l !== "");
  if (!lines.length) return null;
  /**
   * One splitter for the header and the data: tabs, then semicolons. With a dot decimal mark commas separate too, then
   * spaces. With a decimal comma, spaces separate ("3,5 4,5"), and a line with no spaces splits on commas only when it
   * has two or more ("4,5,3" is CSV; "4,5" stays one number), or when it is the header (item names hold no decimals).
   */
  const split = (line: string, isHeader = false): string[] => {
    if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
    if (line.includes(";")) return line.split(";").map((c) => c.trim());
    // Item names may contain spaces ("Item A,Item B"): a header with commas splits on them first.
    if (decimal === "." || (isHeader && line.includes(","))) return line.includes(",") ? line.split(",").map((c) => c.trim()) : line.split(/\s+/);
    if (/\s/.test(line)) return line.split(/\s+/);
    return (line.match(/,/g)?.length ?? 0) > 1 ? line.split(",").map((c) => c.trim()) : [line];
  };
  // Same number forms as the other tools: a typographic minus and e-notation are fine.
  const num = (cell: string): number => {
    // With a decimal comma a dot is ambiguous (1.234 may mean 1234): skipped, as the other tools do.
    if (decimal === "," && cell.includes(".")) return NaN;
    const c = (decimal === "," ? cell.replace(",", ".") : cell).replace(/^[−–]/, "-");
    return /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(c) ? Number(c) : NaN;
  };
  let cells = lines.map((l) => split(l));
  let names: string[] = [];
  // A header row is mostly words ("Q1 Q2 Q3"); a first respondent with one missing score ("NA 3 4") is data.
  // On a comma page a first line like "3,5 4,5 2,5" is scores split by spaces, not names split by commas.
  const l0 = lines[0]!;
  const spaced = decimal === "," && !/[\t;]/.test(l0) && /\s/.test(l0) ? l0.split(/\s+/) : null;
  const first = spaced && spaced.filter((c) => !Number.isNaN(num(c))).length * 2 >= spaced.length ? spaced : split(l0, true);
  // Numeric item labels ("1 2 3 4 5") cannot be told from scores: the "yes" option covers them.
  if (header === "yes" || (header === "auto" && first.filter((c) => Number.isNaN(num(c))).length * 2 > first.length)) {
    names = first;
    cells = cells.slice(1);
  }
  // With a decimal comma and no header, lines like "4,5" read as one number each; a scale needs two or more items, so
  // when nothing else splits them the commas must be column separators.
  if (!names.length && decimal === "," && mostCommonLength(cells) === 1 && cells.some((c) => c[0]!.includes(","))) {
    cells = lines.map((l) => l.split(",").map((c) => c.trim()));
  }
  // A header that splits into a different number of cells than the data ("Item A Item B" by spaces) is dropped in
  // favour of numbered items, rather than skipping every row as uneven.
  const dataK = mostCommonLength(cells);
  if (names.length && cells.length && dataK >= 2 && dataK !== names.length) names = Array.from({ length: dataK }, (_, i) => `#${i + 1}`);
  const k = names.length || dataK;
  if (k < 2) return null;
  if (!names.length) names = Array.from({ length: k }, (_, i) => `#${i + 1}`);
  const rows: number[][] = [];
  let skipped = 0;
  let truncated = k > MAX_ITEMS;
  for (const line of cells) {
    // With a decimal comma a two-item line "4,5" stays one cell; once the header fixes k, k − 1 commas mean CSV.
    const row = line.length === 1 && k > 1 && (line[0]!.match(/,/g)?.length ?? 0) === k - 1 ? line[0]!.split(",") : line;
    const vals = row.map(num);
    if (vals.length !== k || vals.some((v) => !Number.isFinite(v))) skipped++;
    else if (rows.length < MAX_RESPONDENTS) rows.push(vals.slice(0, MAX_ITEMS));
    else truncated = true;
  }
  return { names: names.slice(0, MAX_ITEMS), rows, skipped, truncated };
}

function mostCommonLength(cells: string[][]): number {
  const count = new Map<number, number>();
  for (const r of cells) count.set(r.length, (count.get(r.length) ?? 0) + 1);
  let best = 0;
  let top = 0;
  for (const [len, n] of count) if (n > top || (n === top && len > best)) { best = len; top = n; }
  return best;
}

/** Sample variance (n − 1), from the shared scaled moments. */
function variance(xs: readonly number[]): number {
  const m = moments(xs);
  return m && m.n > 1 ? (m.ssScaled / (m.n - 1)) * m.scale * m.scale : NaN;
}

function correlation(a: readonly number[], b: readonly number[]): number {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < n; i++) {
    sab += (a[i]! - ma) * (b[i]! - mb);
    saa += (a[i]! - ma) ** 2;
    sbb += (b[i]! - mb) ** 2;
  }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : NaN;
}

export type AlphaItem = {
  name: string;
  mean: number;
  variance: number;
  /** Corrected item-total correlation (the item against the sum of the other items). */
  itemTotal: number;
  /** Alpha with this item removed (null with two items: one item has no alpha). */
  alphaIfDeleted: number | null;
};

export type AlphaResult = {
  alpha: number;
  /** Standardized alpha from the mean inter-item correlation. */
  standardized: number;
  k: number;
  n: number;
  meanInterItem: number;
  sumItemVariance: number;
  totalVariance: number;
  items: AlphaItem[];
};

export function cronbachAlpha(m: Matrix): AlphaResult | null {
  const k = m.names.length;
  const n = m.rows.length;
  if (k < 2 || n < 2) return null;
  const all = Array.from({ length: k }, (_, j) => j);
  const columns = all.map((j) => m.rows.map((r) => r[j]!));
  const totals = m.rows.map((r) => r.reduce((s, x) => s + x, 0));
  const totalVariance = variance(totals);
  if (!(totalVariance > 0)) return null;
  const vars = columns.map(variance);
  const sumItemVariance = vars.reduce((s, v) => s + v, 0);
  const alpha = (k / (k - 1)) * (1 - sumItemVariance / totalVariance);
  if (!Number.isFinite(alpha)) return null;
  // Centre each column once; every pair is then one dot product (k up to 100 gives 4,950 pairs).
  const centred = columns.map((col) => {
    const mean = col.reduce((s, x) => s + x, 0) / n;
    return col.map((x) => x - mean);
  });
  const norms = centred.map((c) => Math.sqrt(c.reduce((s, x) => s + x * x, 0)));
  let rSum = 0;
  let rCount = 0;
  for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) {
    if (!(norms[a]! > 0 && norms[b]! > 0)) continue;
    const ca = centred[a]!;
    const cb = centred[b]!;
    let dot = 0;
    for (let i = 0; i < n; i++) dot += ca[i]! * cb[i]!;
    rSum += dot / (norms[a]! * norms[b]!);
    rCount++;
  }
  // A constant item has no correlation: the mean inter-item r (and standardized alpha) would leave it out while still
  // counting it in k, so both are refused rather than overstated.
  const meanInterItem = rCount === (k * (k - 1)) / 2 ? rSum / rCount : NaN;
  const standardized = (k * meanInterItem) / (1 + (k - 1) * meanInterItem);
  // Alpha without item j needs only the other items' variances (sum minus this one) and the variance of the total
  // minus this item: O(n) per item instead of recomputing every column.
  const items = all.map((j) => {
    const rest = m.rows.map((r, i) => totals[i]! - r[j]!);
    const restVar = variance(rest);
    return {
      name: m.names[j]!,
      mean: columns[j]!.reduce((s, x) => s + x, 0) / n,
      variance: vars[j]!,
      itemTotal: correlation(columns[j]!, rest),
      alphaIfDeleted: k > 2 ? (restVar > 0 ? ((k - 1) / (k - 2)) * (1 - (sumItemVariance - vars[j]!) / restVar) : NaN) : null,
    };
  });
  return { alpha, standardized, k, n, meanInterItem, sumItemVariance, totalVariance, items };
}

export type AlphaBand = "excellent" | "good" | "acceptable" | "questionable" | "poor" | "unacceptable";

/** George & Mallery (2003) rule of thumb. */
export function alphaBand(alpha: number): AlphaBand {
  // An alpha of .70 computed as 0.6999999999999998 belongs in the band it is shown as.
  alpha = Math.round(alpha * 1e9) / 1e9;
  if (alpha >= 0.9) return "excellent";
  if (alpha >= 0.8) return "good";
  if (alpha >= 0.7) return "acceptable";
  if (alpha >= 0.6) return "questionable";
  if (alpha >= 0.5) return "poor";
  return "unacceptable";
}

// ---------- t-tests ----------

export type TTestKind = "one" | "independent" | "paired";
export const T_TEST_KINDS: readonly TTestKind[] = ["one", "independent", "paired"];

export type GroupSummary = { n: number; mean: number; sd: number };

export type TTestResult = {
  kind: TTestKind;
  t: number;
  df: number;
  p: number;
  /** Mean difference (one-sample: mean − μ0; independent: A − B; paired: mean of A − B). */
  diff: number;
  se: number;
  ciLow: number;
  ciHigh: number;
  /** Cohen's d. */
  d: number;
  groups: GroupSummary[];
  /** Independent test: Welch (unequal variances) or Student (pooled). */
  welch: boolean;
};

/** n, mean and sample SD in O(n) (no sorting: a t-test needs nothing else). */
function summary(xs: readonly number[]): GroupSummary | null {
  const m = moments(xs);
  if (!m || m.n < 2) return null;
  const out = { n: m.n, mean: m.mean, sd: Math.sqrt(m.ssScaled / (m.n - 1)) * m.scale };
  return Number.isFinite(out.mean) && Number.isFinite(out.sd) ? out : null;
}

/**
 * The confidence interval follows the alternative: two-sided gives [low, high]; "right" (greater) gives [low, ∞);
 * "left" (less) gives (−∞, high], matching R's t.test.
 */
function finish(kind: TTestKind, diff: number, se: number, df: number, tail: Tail, confidence: number, d: number, groups: GroupSummary[], welch: boolean): TTestResult | null {
  if (!(se > 0) || !(df > 0)) return null;
  const t = diff / se;
  const p = symmetricP((x) => tUpper(x, df), t, tail);
  const a = 1 - confidence / 100;
  const crit = tInvUpper(tail === "two" ? a / 2 : a, df);
  const ciLow = tail === "left" ? -Infinity : diff - crit * se;
  const ciHigh = tail === "right" ? Infinity : diff + crit * se;
  return Number.isFinite(t) ? { kind, t, df, p, diff, se, ciLow, ciHigh, d, groups, welch } : null;
}

export function tTest(kind: TTestKind, a: readonly number[], b: readonly number[], opts: { mu?: number; welch?: boolean; tail?: Tail; confidence?: number } = {}): TTestResult | null {
  const tail = opts.tail ?? "two";
  const confidence = opts.confidence ?? 95;
  if (kind === "one") {
    const g = summary(a);
    const mu = opts.mu ?? 0;
    if (!g || !Number.isFinite(mu)) return null;
    return finish(kind, g.mean - mu, g.sd / Math.sqrt(g.n), g.n - 1, tail, confidence, (g.mean - mu) / g.sd, [g], false);
  }
  if (kind === "paired") {
    if (a.length !== b.length) return null;
    const diffs = a.map((x, i) => x - b[i]!);
    const g = summary(diffs);
    const ga = summary(a);
    const gb = summary(b);
    if (!g || !ga || !gb) return null;
    return finish(kind, g.mean, g.sd / Math.sqrt(g.n), g.n - 1, tail, confidence, g.mean / g.sd, [ga, gb, g], false);
  }
  const ga = summary(a);
  const gb = summary(b);
  if (!ga || !gb) return null;
  const welch = opts.welch ?? true;
  const va = ga.sd ** 2 / ga.n;
  const vb = gb.sd ** 2 / gb.n;
  const pooledVar = ((ga.n - 1) * ga.sd ** 2 + (gb.n - 1) * gb.sd ** 2) / (ga.n + gb.n - 2);
  const se = welch ? Math.sqrt(va + vb) : Math.sqrt(pooledVar * (1 / ga.n + 1 / gb.n));
  // Welch–Satterthwaite degrees of freedom.
  const df = welch ? (va + vb) ** 2 / (va ** 2 / (ga.n - 1) + vb ** 2 / (gb.n - 1)) : ga.n + gb.n - 2;
  return finish(kind, ga.mean - gb.mean, se, df, tail, confidence, (ga.mean - gb.mean) / Math.sqrt(pooledVar), [ga, gb], welch);
}

// ---------- chi-square ----------

export type ChiResult = {
  chi2: number;
  df: number;
  p: number;
  n: number;
  expected: number[][];
  /** Share of cells with an expected count below 5. */
  lowExpected: number;
  minExpected: number;
  /** Cramér's V (independence) or null (goodness of fit). */
  v: number | null;
  yates: boolean;
};

/** Test of independence on an r × c table of counts (Yates' correction optional, 2 × 2 only). */
export function chiIndependence(table: readonly number[][], yates = false): ChiResult | null {
  const r = table.length;
  const c = table[0]?.length ?? 0;
  // Counts are whole numbers: the test is defined for frequencies, not percentages or means.
  if (r < 2 || c < 2 || table.some((row) => row.length !== c || row.some((x) => !(Number.isInteger(x) && x >= 0)))) return null;
  const rowSum = table.map((row) => row.reduce((s, x) => s + x, 0));
  const colSum = Array.from({ length: c }, (_, j) => table.reduce((s, row) => s + row[j]!, 0));
  const n = rowSum.reduce((s, x) => s + x, 0);
  if (!(n > 0) || rowSum.some((s) => s === 0) || colSum.some((s) => s === 0)) return null;
  const useYates = yates && r === 2 && c === 2;
  const expected = table.map((_, i) => colSum.map((cs) => (rowSum[i]! * cs) / n));
  let chi2 = 0;
  // Cramér's V is an effect size: it uses the uncorrected Pearson χ² even when Yates' correction is applied to the test.
  let pearson = 0;
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) {
    const e = expected[i]![j]!;
    const dev = Math.abs(table[i]![j]! - e);
    const adj = useYates ? Math.max(0, dev - 0.5) : dev;
    chi2 += (adj * adj) / e;
    pearson += (dev * dev) / e;
  }
  const df = (r - 1) * (c - 1);
  const flat = expected.flat();
  return {
    chi2, df, p: chiUpper(chi2, df), n, expected,
    lowExpected: flat.filter((e) => e < 5).length / flat.length,
    minExpected: Math.min(...flat),
    v: Math.sqrt(pearson / (n * Math.min(r - 1, c - 1))),
    yates: useYates,
  };
}

/**
 * Goodness of fit: observed counts against expected proportions (or counts, rescaled to the observed total).
 * Equal expected shares when `expected` is omitted.
 */
export function chiGoodness(observed: readonly number[], expected?: readonly number[]): ChiResult | null {
  const k = observed.length;
  if (k < 2 || observed.some((x) => !(Number.isInteger(x) && x >= 0))) return null;
  const n = observed.reduce((s, x) => s + x, 0);
  if (!(n > 0)) return null;
  const shares = expected ?? observed.map(() => 1);
  if (shares.length !== k || shares.some((x) => !(Number.isFinite(x) && x > 0))) return null;
  const total = shares.reduce((s, x) => s + x, 0);
  const exp = shares.map((x) => (x / total) * n);
  const chi2 = observed.reduce((s, o, i) => s + (o - exp[i]!) ** 2 / exp[i]!, 0);
  const df = k - 1;
  return {
    chi2, df, p: chiUpper(chi2, df), n, expected: [exp],
    lowExpected: exp.filter((e) => e < 5).length / k,
    minExpected: Math.min(...exp),
    v: null,
    yates: false,
  };
}

// ---------- p-value and critical values ----------

export type Dist = "z" | "t" | "chi2" | "f";
export const DISTS: readonly Dist[] = ["z", "t", "chi2", "f"];

/** Chi-square and F are one-sided by nature: only the right tail is offered for them. */
export function tailsFor(dist: Dist): readonly Tail[] {
  return dist === "z" || dist === "t" ? ["two", "left", "right"] : ["right"];
}

export function pValue(dist: Dist, stat: number, tail: Tail, df1?: number, df2?: number): number | null {
  // Past about 1e150 the squared statistic overflows inside the distributions: refuse rather than show p = 0.
  if (!Number.isFinite(stat) || Math.abs(stat) > 1e150) return null;
  let p: number;
  if (dist === "z") p = symmetricP(normUpper, stat, tail);
  else if (dist === "t") {
    if (!dfOk(df1)) return null;
    p = symmetricP((x) => tUpper(x, df1), stat, tail);
  } else if (dist === "chi2") {
    if (!dfOk(df1) || stat < 0) return null;
    p = chiUpper(stat, df1);
  } else {
    if (!dfOk(df1) || !dfOk(df2) || stat < 0) return null;
    p = fUpper(stat, df1, df2);
  }
  return Number.isFinite(p) ? p : null;
}

/**
 * Critical value for significance level alpha: for a two-tailed z or t, the positive cut-off (reject when |stat| ≥ it);
 * left tail gives the negative cut-off; chi-square and F give the right-tail cut-off.
 */
export function criticalValue(dist: Dist, alpha: number, tail: Tail, df1?: number, df2?: number): number | null {
  if (!(alpha > 0 && alpha < 1)) return null;
  const a = tail === "two" ? alpha / 2 : alpha;
  let x: number;
  if (dist === "z") x = -normInv(a);
  else if (dist === "t") {
    if (!dfOk(df1)) return null;
    x = tInvUpper(a, df1);
  } else if (dist === "chi2") {
    if (!dfOk(df1)) return null;
    const c = chiInvUpper(alpha, df1);
    return Number.isFinite(c) ? c : null;
  } else {
    if (!dfOk(df1) || !dfOk(df2)) return null;
    const c = fInvUpper(alpha, df1, df2);
    return Number.isFinite(c) ? c : null;
  }
  if (!Number.isFinite(x)) return null;
  // Bisection never lands exactly on a root of 0 (t at α = 0.5, one tail): show 0, not 2E-16.
  if (Math.abs(x) < 1e-12) return 0;
  return tail === "left" ? -x : x;
}

// ---------- z-score ----------

export type ZAreas = { z: number; below: number; above: number; between: number; outside: number };

/** z = (x − μ) / σ and the areas under the normal curve: below z, above z, between ±|z| and outside ±|z|. */
export function zScore(x: number, mu: number, sigma: number): ZAreas | null {
  if (![x, mu, sigma].every(Number.isFinite) || !(sigma > 0)) return null;
  return areas((x - mu) / sigma);
}

export function areas(z: number): ZAreas | null {
  if (!Number.isFinite(z)) return null;
  const above = normUpper(z);
  const below = normCdf(z);
  const outside = Math.min(1, 2 * normUpper(Math.abs(z)));
  return { z, below, above, between: 1 - outside, outside };
}

/** The z and value at a percentile (share below, 0–100 exclusive). */
export function fromPercentile(pct: number, mu: number, sigma: number): { z: number; x: number } | null {
  if (!(pct > 0 && pct < 100) || !Number.isFinite(mu) || !(sigma > 0)) return null;
  const z = normInv(pct / 100);
  return { z, x: mu + z * sigma };
}

/** P between a and b for X ~ N(μ, σ); za and zb follow the input order (a may be the larger one). */
export function between(a: number, b: number, mu: number, sigma: number): { za: number; zb: number; p: number } | null {
  if (![a, b, mu, sigma].every(Number.isFinite) || !(sigma > 0)) return null;
  const za = (a - mu) / sigma;
  const zb = (b - mu) / sigma;
  const lo = Math.min(za, zb);
  const hi = Math.max(za, zb);
  // Use upper tails on the right side of the mean so far-out ranges keep their digits.
  const p = lo >= 0 ? normUpper(lo) - normUpper(hi) : normCdf(hi) - normCdf(lo);
  return { za, zb, p: Math.max(0, p) };
}
