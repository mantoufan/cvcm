/** Quadratic equations ax² + bx + c = 0: discriminant, roots (exact for whole-number coefficients), vertex. */

import { gcd as gcdInt } from "./aspect";

export type QuadraticRoots =
  | { kind: "two"; x1: number; x2: number }
  | { kind: "one"; x: number }
  | { kind: "complex"; re: number; im: number };

export type QuadraticResult = {
  a: number;
  b: number;
  c: number;
  d: number;
  roots: QuadraticRoots;
  vertex: { x: number; y: number };
  /** Exact roots like "(3 ± √5) / 2", "−1/3" or "1 ± 2i" when a, b and c are whole numbers; null otherwise. */
  exact: string[] | null;
  /** "2(x − 1)(x + 3)" when the roots are rational, else null. */
  factored: string | null;
};

/** Largest |coefficient| we treat exactly: b² − 4ac stays a safe integer and its square-free split stays fast. */
export const MAX_EXACT = 1e6;

const MINUS = "−";


/** √n = k√m with m square-free; n ≥ 0 whole. */
export function simplifySqrt(n: number): { k: number; m: number } {
  let k = 1;
  let m = n;
  // Dividing out each prime found keeps the bound √m shrinking; only 2 and odd numbers are tried.
  for (let f = 2; f * f <= m; f += f === 2 ? 1 : 2) {
    while (m % (f * f) === 0) {
      m /= f * f;
      k *= f;
    }
  }
  return { k, m };
}

/** Reduced fraction p/q as text ("3", "−1/3"). */
export function fractionText(p: number, q: number): string {
  if (q < 0) {
    p = -p;
    q = -q;
  }
  const g = gcdInt(p, q) || 1;
  p /= g;
  q /= g;
  const s = q === 1 ? `${Math.abs(p)}` : `${Math.abs(p)}/${q}`;
  return p < 0 ? MINUS + s : s;
}

/** Plain number text for results: up to 6 decimals, no trailing zeros, real minus sign, no "−0". */
export function num(n: number): string {
  if (n === 0) return "0";
  // Small and huge values keep 6 significant digits; 6 decimals would print 1e-7 as 0 and 1.5e-6 as 0.000002.
  const s = Math.abs(n) >= 1e15 || Math.abs(n) < 1e-3 ? String(Number(n.toPrecision(6))) : String(Number(n.toFixed(6)));
  // Only the sign becomes a real minus; "1e-7" keeps its exponent hyphen.
  return s.replace(/^-/, MINUS);
}

export function isWhole(n: number): boolean {
  return Number.isInteger(n) && Math.abs(n) <= MAX_EXACT;
}

export function solveQuadratic(a: number, b: number, c: number): QuadraticResult | null {
  if (![a, b, c].every(Number.isFinite) || a === 0) return null;
  const whole = isWhole(a) && isWhole(b) && isWhole(c);
  let d = b * b - 4 * a * c;
  // With decimal coefficients b² and 4ac carry rounding error: 0.2² − 4 × 0.01 is 6.9e-18, not 0.
  if (!whole && Math.abs(d) <= 1e-12 * Math.max(b * b, Math.abs(4 * a * c))) d = 0;
  let roots: QuadraticRoots;
  if (d > 0) {
    const s = Math.sqrt(d);
    // Citardauq form avoids cancellation when b² ≫ 4ac.
    const q = -0.5 * (b + Math.sign(b || 1) * s);
    const r1 = q / a;
    const r2 = q !== 0 ? c / q : -r1;
    roots = { kind: "two", x1: Math.min(r1, r2), x2: Math.max(r1, r2) };
  } else if (d === 0) {
    roots = { kind: "one", x: -b / (2 * a) };
  } else {
    roots = { kind: "complex", re: -b / (2 * a), im: Math.sqrt(-d) / (2 * Math.abs(a)) };
  }
  const vx = -b / (2 * a);
  const vertex = { x: vx, y: c - (b * b) / (4 * a) };
  let exact: string[] | null = null;
  let factored: string | null = null;
  if (whole) {
    const root = d === 0 ? { k: 0, m: 1 } : simplifySqrt(Math.abs(d));
    exact = exactRoots(a, b, d, root);
    factored = factorForm(a, b, d, root);
  }
  return { a, b, c, d, roots, vertex, exact, factored };
}

function exactRoots(a: number, b: number, d: number, { k, m }: { k: number; m: number }): string[] {
  const den = 2 * a;
  if (d === 0) return [fractionText(-b, den)];
  if (d > 0 && m === 1) {
    const r1 = fractionText(-b - k, den);
    const r2 = fractionText(-b + k, den);
    const v1 = (-b - k) / den;
    const v2 = (-b + k) / den;
    return v1 <= v2 ? [r1, r2] : [r2, r1];
  }
  // (−b ± k√m) / 2a, reduced by the common factor of b, k and 2a.
  let p = -b;
  let kk = k;
  let q = den;
  const g = gcdInt(gcdInt(p, kk), q) || 1;
  p /= g;
  kk /= g;
  q /= g;
  if (q < 0) {
    p = -p;
    q = -q;
  }
  // Imaginary parts read "2i", "i√2", "3i√5" (the i before the root, so √2i is never read as √(2i)).
  const rad = d > 0 ? `${kk === 1 ? "" : kk}√${m}` : `${kk === 1 ? "" : kk}i${m === 1 ? "" : `√${m}`}`;
  const top = p === 0 ? `±${rad}` : `${num(p)} ± ${rad}`;
  return [q === 1 ? top : p === 0 ? `±${rad}/${q}` : `(${top}) / ${q}`];
}

function factorForm(a: number, b: number, d: number, { k, m }: { k: number; m: number }): string | null {
  if (d < 0 || m !== 1) return null;
  const den = 2 * a;
  // Each root p/q gives a factor (qx − p); the leftover constant goes in front.
  const parts: Array<[number, number]> = [-b - k, -b + k].map((p) => {
    let q = den;
    const g = gcdInt(p, q) || 1;
    p /= g;
    q /= g;
    if (q < 0) {
      p = -p;
      q = -q;
    }
    return [p, q];
  });
  const lead = a / (parts[0]![1] * parts[1]![1]);
  // A bare "x" factor reads best first: x(x − 3), not (x − 3)x.
  parts.sort((u, v) => Number(u[0] !== 0) - Number(v[0] !== 0));
  const factor = ([p, q]: [number, number]) => {
    const x = q === 1 ? "x" : `${q}x`;
    if (p === 0) return x;
    return `(${x} ${p > 0 ? MINUS : "+"} ${Math.abs(p)})`;
  };
  const f = d === 0 ? `${factor(parts[0]!)}²` : parts.map(factor).join("");
  const front = lead === 1 ? "" : lead === -1 ? MINUS : num(lead);
  // "x(x − 3)" needs no extra brackets; a lone "x" factor is written first.
  return front + f;
}

/** "2x² − 3x + 1" with real minus signs; zero terms dropped. */
export function equationText(a: number, b: number, c: number): string {
  const terms: string[] = [];
  const add = (coef: number, sym: string) => {
    if (coef === 0) return;
    const abs = Math.abs(coef);
    const body = sym && abs === 1 ? sym : `${num(abs)}${sym}`;
    if (!terms.length) terms.push(coef < 0 ? MINUS + body : body);
    else terms.push(`${coef < 0 ? MINUS : "+"} ${body}`);
  };
  add(a, "x²");
  add(b, "x");
  add(c, "");
  return `${terms.join(" ")} = 0`;
}
