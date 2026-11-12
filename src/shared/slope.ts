/**
 * Slope calculator: the line through two points, worked in exact fractions when the points are typed as decimals or
 * fractions ("0.25", "-3/4"), with decimals alongside.
 */
import { parseDecimalInput } from "./decimal-input";

/** An exact fraction n/d with d > 0, in lowest terms. */
export type Q = { n: bigint; d: bigint };

const abs = (v: bigint) => (v < 0n ? -v : v);
function gcd(a: bigint, b: bigint): bigint {
  a = abs(a);
  b = abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export function q(n: bigint, d: bigint = 1n): Q {
  if (d === 0n) throw new RangeError("zero denominator");
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1n;
  return { n: n / g, d: d / g };
}

export const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
export const div = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n);
export const isZero = (a: Q) => a.n === 0n;
export const toNumber = (a: Q) => Number(a.n) / Number(a.d);

/** Most digits a typed number may have; past that the working would be unreadable. */
const MAX_DIGITS = 15;

/** A plain decimal string ("-12.5", "3e-2" is refused) as an exact fraction. */
function decimalToQ(text: string): Q | null {
  const m = /^(-?)(\d*)(?:\.(\d*))?$/.exec(text);
  if (!m || (m[2] === "" && !m[3])) return null;
  const whole = m[2] || "0";
  const frac = m[3] ?? "";
  if (whole.replace(/^0+/, "").length + frac.length > MAX_DIGITS) return null;
  const n = BigInt(whole + frac) * (m[1] ? -1n : 1n);
  return q(n, 10n ** BigInt(frac.length));
}

/**
 * Reads a coordinate typed as a decimal (in the page's own decimal mark), a fraction "a/b" or a mixed number "1 1/2".
 * Undefined when empty, null when not a number.
 */
export function parseCoord(raw: string, locale: string): Q | null | undefined {
  const text = raw.trim().replace(/^−/, "-").replace(/[⁄∕／]/g, "/");
  if (text === "") return undefined;
  const one = (s: string): Q | null => {
    const v = parseDecimalInput(s, locale);
    if (v === undefined || Number.isNaN(v)) return null;
    // parseDecimalInput settles the decimal mark and thousands; String() of the result is the plain decimal back.
    const plain = String(v);
    return /e/i.test(plain) ? null : decimalToQ(plain);
  };
  const mixed = /^(-?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(text);
  if (mixed) {
    const d = BigInt(mixed[4]);
    if (d === 0n || mixed[2].length + mixed[3].length + mixed[4].length > MAX_DIGITS) return null;
    const v = add(q(BigInt(mixed[2])), q(BigInt(mixed[3]), d));
    return mixed[1] ? q(-v.n, v.d) : v;
  }
  const parts = text.split("/");
  if (parts.length === 2) {
    const a = one(parts[0]);
    const b = one(parts[1]);
    if (!a || !b || isZero(b)) return null;
    return div(a, b);
  }
  if (parts.length > 2) return null;
  return one(text);
}

export type Line =
  | { kind: "vertical"; x: Q }
  | { kind: "sloped"; /** Slope. */ m: Q; /** y-intercept. */ b: Q };

export type SlopeResult = {
  dx: Q;
  dy: Q;
  line: Line;
  /** Angle to the positive x-axis in degrees, in (−90, 90]. */
  angle: number;
  /** √(dx² + dy²) as a decimal, and as k√r when dx² + dy² is a whole number (k = 1 or r = 1 included). */
  distance: number;
  radical: { k: bigint; r: bigint } | null;
  midpoint: [Q, Q];
  /** x where the line crosses y = 0: null when horizontal (none, or every x if it is y = 0). */
  xIntercept: Q | null;
  /** Standard form Ax + By = C with whole A, B, C, no common factor, A ≥ 0 (B > 0 when A = 0). */
  standard: { a: bigint; b: bigint; c: bigint };
};

export type SlopeError = "same-point";

/** The line through (x1, y1) and (x2, y2). */
export function solveSlope(x1: Q, y1: Q, x2: Q, y2: Q): { ok: true; r: SlopeResult } | { ok: false; error: SlopeError } {
  const dx = sub(x2, x1);
  const dy = sub(y2, y1);
  if (isZero(dx) && isZero(dy)) return { ok: false, error: "same-point" };
  const midpoint: [Q, Q] = [div(add(x1, x2), q(2n)), div(add(y1, y2), q(2n))];
  const sq = add(mul(dx, dx), mul(dy, dy));
  const distance = Math.hypot(toNumber(dx), toNumber(dy));
  const radical = sq.d === 1n ? simplifyRoot(sq.n) : null;
  // Standard form from (y2 − y1)x − (x2 − x1)y = (y2 − y1)x1 − (x2 − x1)y1, cleared of fractions.
  const a0 = dy;
  const b0 = q(-dx.n, dx.d);
  const c0 = sub(mul(dy, x1), mul(dx, y1));
  const l = lcm(lcm(a0.d, b0.d), c0.d);
  let a = (a0.n * l) / a0.d;
  let b = (b0.n * l) / b0.d;
  let c = (c0.n * l) / c0.d;
  const g = gcd(gcd(a, b), c) || 1n;
  a /= g;
  b /= g;
  c /= g;
  if (a < 0n || (a === 0n && b < 0n)) {
    a = -a;
    b = -b;
    c = -c;
  }
  if (isZero(dx)) {
    return { ok: true, r: { dx, dy, line: { kind: "vertical", x: x1 }, angle: 90, distance, radical, midpoint, xIntercept: x1, standard: { a, b, c } } };
  }
  const m = div(dy, dx);
  const bIntercept = sub(y1, mul(m, x1));
  const xIntercept = isZero(m) ? null : div(q(-bIntercept.n, bIntercept.d), m);
  const angle = (Math.atan(toNumber(m)) * 180) / Math.PI;
  return { ok: true, r: { dx, dy, line: { kind: "sloped", m, b: bIntercept }, angle, distance, radical, midpoint, xIntercept, standard: { a, b, c } } };
}

function lcm(a: bigint, b: bigint): bigint {
  return (a / gcd(a, b)) * b;
}

/** √n as k√r with r square-free, for whole n up to about 10^12 (bigger ones keep r = n). */
export function simplifyRoot(n: bigint): { k: bigint; r: bigint } {
  if (n <= 0n) return { k: 0n, r: 1n };
  let k = 1n;
  let r = n;
  if (n > 10n ** 12n) return { k, r };
  for (let f = 2n; f * f <= r; f++) {
    while (r % (f * f) === 0n) {
      r /= f * f;
      k *= f;
    }
  }
  return { k, r };
}

/** "3/4", "-2", "1/3" — with a minus sign that reads well (U+2212). */
export function formatQ(a: Q): string {
  const sign = a.n < 0n ? "−" : "";
  const n = abs(a.n);
  return a.d === 1n ? `${sign}${n}` : `${sign}${n}/${a.d}`;
}
