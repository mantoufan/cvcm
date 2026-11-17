/**
 * Probability distributions for the statistics tools (z, t, chi-square, F): CDFs, upper tails and inverses.
 *
 * Built on the log-gamma function (Lanczos, g = 7), the regularized incomplete gamma function (series below a + 1,
 * Lentz continued fraction above) and the regularized incomplete beta function (Lentz continued fraction). Upper tails
 * are computed directly, not as 1 − CDF, so tiny p-values such as 1e-12 keep their digits. Accuracy is about 1e-12
 * relative for small degrees of freedom and about 1e-9 near df = 1e6 (the tools refuse more: the log-gamma differences
 * lose digits beyond).
 */

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** ln Γ(x) for x > 0. */
export function lnGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  x -= 1;
  let a = LANCZOS[0]!;
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i]! / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

const EPS = 1e-15;
const TINY = 1e-300;

/** Regularized lower incomplete gamma P(a, x) and upper Q(a, x) = 1 − P. */
function gammaPQ(a: number, x: number): { p: number; q: number } {
  if (x <= 0) return { p: 0, q: 1 };
  if (!Number.isFinite(x)) return { p: 1, q: 0 };
  const lnPre = a * Math.log(x) - x - lnGamma(a);
  if (x < a + 1) {
    let sum = 1 / a;
    let term = sum;
    for (let n = 1; n < 10000; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * EPS) break;
    }
    const p = Math.min(1, sum * Math.exp(lnPre));
    return { p, q: 1 - p };
  }
  // Continued fraction for Q (Numerical Recipes gcf, modified Lentz).
  let b = x + 1 - a;
  let c = 1 / TINY;
  let d = 1 / b;
  let hh = d;
  for (let i = 1; i < 10000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    hh *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  const q = Math.min(1, Math.exp(lnPre) * hh);
  return { p: 1 - q, q };
}

/** Continued fraction for the incomplete beta function (Numerical Recipes betacf). */
function betacf(a: number, b: number, x: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let hh = d;
  for (let m = 1; m < 10000; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    hh *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    hh *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return hh;
}

/** Regularized incomplete beta I_x(a, b). */
export function betaInc(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lnFront = lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log1p(-x);
  // The continued fraction converges fast for x < (a + 1) / (a + b + 2); otherwise use the symmetry I_x(a,b) = 1 − I_{1−x}(b,a).
  if (x < (a + 1) / (a + b + 2)) return (Math.exp(lnFront) * betacf(a, b, x)) / a;
  return 1 - (Math.exp(lnFront) * betacf(b, a, 1 - x)) / b;
}

/** Standard normal CDF Φ(z). */
export function normCdf(z: number): number {
  if (Number.isNaN(z)) return NaN;
  return z < 0 ? normUpper(-z) : 1 - normUpper(z);
}

/** Standard normal upper tail 1 − Φ(z), exact for large z. */
export function normUpper(z: number): number {
  if (Number.isNaN(z)) return NaN;
  if (z < 0) return 1 - normUpper(-z);
  // erfc(z/√2) / 2 = Q(1/2, z²/2) / 2.
  return gammaPQ(0.5, (z * z) / 2).q / 2;
}

/** Inverse standard normal CDF (Acklam's rational approximation plus one Halley step). p in (0, 1). */
export function normInv(p: number): number {
  if (!(p > 0 && p < 1)) return p === 0 ? -Infinity : p === 1 ? Infinity : NaN;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  let x: number;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  } else if (p <= 1 - lo) {
    const q = p - 0.5;
    const r = q * q;
    x = ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log1p(-p));
    x = -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  // Halley refinement against the exact CDF (tail-aware, so p = 1e-12 stays accurate). Beyond |x| ≈ 37 the density
  // underflows (exp(x²/2) overflows): keep the approximation, already accurate to about 1e-9 there.
  if ((x * x) / 2 > 700) return x;
  const e = x < 0 ? normCdf(x) - p : (1 - normUpper(x)) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}

/** Student's t upper tail P(T > t) with df degrees of freedom (df may be fractional, as in Welch's test). */
export function tUpper(t: number, df: number): number {
  if (Number.isNaN(t) || !(df > 0)) return NaN;
  if (!Number.isFinite(t)) return t > 0 ? 0 : 1;
  const t2 = t * t;
  const x = df / (df + t2);
  // P(0 < T < |t|) = I_y(1/2, df/2) / 2 with y = t² / (df + t²). Near t = 0 this form is exact where x = df / (df + t²)
  // rounds to 1, and the tail (0.5 minus it) stays large, so the subtraction loses nothing. Further out the direct
  // form I_x(df/2, 1/2) / 2 keeps the digits of small p-values.
  // |t| < 0.6 keeps the tail above 0.27 for every df, so one incomplete beta per call is enough.
  const tail = Math.abs(t) < 0.6 ? 0.5 - betaInc(t2 / (df + t2), 0.5, df / 2) / 2 : betaInc(x, df / 2, 0.5) / 2;
  return t >= 0 ? tail : 1 - tail;
}

/** Chi-square upper tail P(X > x) with k degrees of freedom. */
export function chiUpper(x: number, k: number): number {
  if (Number.isNaN(x) || !(k > 0)) return NaN;
  return gammaPQ(k / 2, Math.max(0, x) / 2).q;
}

export function chiCdf(x: number, k: number): number {
  if (Number.isNaN(x) || !(k > 0)) return NaN;
  return gammaPQ(k / 2, Math.max(0, x) / 2).p;
}

/** F upper tail P(F > x) with (d1, d2) degrees of freedom. */
export function fUpper(x: number, d1: number, d2: number): number {
  if (Number.isNaN(x) || !(d1 > 0) || !(d2 > 0)) return NaN;
  if (x <= 0) return 1;
  if (!Number.isFinite(x)) return 0;
  return betaInc(d2 / (d2 + d1 * x), d2 / 2, d1 / 2);
}

/**
 * The x at which a decreasing upper-tail function equals `target`, by bracketing then bisection (in log space for
 * x > 0 when the bracket is wide). `lo` is the smallest x allowed (−∞ for t, 0 for chi-square and F).
 */
function invertUpper(upper: (x: number) => number, target: number, lo: number): number {
  if (!(target > 0 && target < 1)) return NaN;
  let a = lo === -Infinity ? -1 : lo;
  let b = 1;
  if (lo === -Infinity) while (upper(a) < target && a > -1e152) a *= 2;
  while (upper(b) > target && b < 1e152) b *= 2;
  // No bracket within a reliable range (t² overflows past about 1e154): say so rather than return a cap as the answer.
  if (b > 1e150 || a < -1e150 || upper(b) > target || (lo === -Infinity && upper(a) < target)) return NaN;
  for (let i = 0; i < 400; i++) {
    const m = a >= 0 && b / Math.max(a, 1e-300) > 4 ? Math.sqrt(Math.max(a, 1e-300) * b) : (a + b) / 2;
    if (upper(m) > target) a = m;
    else b = m;
    // Relative tolerance, so tiny quantiles (chi-square at p close to 1 is about 1e-12) keep their digits.
    if (Math.abs(b - a) <= 1e-14 * Math.max(Math.abs(a), Math.abs(b)) || Math.abs(b - a) < 1e-300) break;
  }
  return (a + b) / 2;
}

/** t with P(T > t) = upper. */
export function tInvUpper(upper: number, df: number): number {
  if (!(df > 0)) return NaN;
  return invertUpper((x) => tUpper(x, df), upper, -Infinity);
}

/** x with P(X > x) = upper for chi-square(k). */
export function chiInvUpper(upper: number, k: number): number {
  if (!(k > 0)) return NaN;
  return invertUpper((x) => chiUpper(x, k), upper, 0);
}

/** x with P(F > x) = upper for F(d1, d2). */
export function fInvUpper(upper: number, d1: number, d2: number): number {
  if (!(d1 > 0) || !(d2 > 0)) return NaN;
  return invertUpper((x) => fUpper(x, d1, d2), upper, 0);
}

export type Tail = "two" | "left" | "right";
export const TAILS: readonly Tail[] = ["two", "left", "right"];

/** p-value of an observed z or t for a tail. */
export function symmetricP(upper: (x: number) => number, stat: number, tail: Tail): number {
  if (tail === "right") return upper(stat);
  if (tail === "left") return upper(-stat);
  return Math.min(1, 2 * upper(Math.abs(stat)));
}
