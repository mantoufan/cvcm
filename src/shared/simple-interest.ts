import { compoundGrowth } from "./compound";

/**
 * Simple interest: I = P × r × t, with r the yearly rate and t in years. Any one of P, r, t or I can be found from
 * the other three. Time typed in months is months / 12 years; in days it is days / basis, where the basis is 365
 * (exact) or 360 (the banker's year many loans use).
 */

export type Find = "interest" | "principal" | "rate" | "time";
export const FINDS: readonly Find[] = ["interest", "principal", "rate", "time"];
export type TimeUnit = "years" | "months" | "days";
export const TIME_UNITS: readonly TimeUnit[] = ["years", "months", "days"];
export type Basis = 365 | 360;

export function toYears(t: number, unit: TimeUnit, basis: Basis = 365): number {
  return unit === "years" ? t : unit === "months" ? t / 12 : t / basis;
}

export function fromYears(years: number, unit: TimeUnit, basis: Basis = 365): number {
  return unit === "years" ? years : unit === "months" ? years * 12 : years * basis;
}

export type Solved = {
  principal: number;
  /** Yearly rate in %. */
  rate: number;
  years: number;
  interest: number;
  total: number;
};

/**
 * Solves for `find` from the other three (each a finite number; `years` already converted). Returns null when the
 * inputs cannot give an answer: negatives, a zero divisor (finding the rate with no time, the time with no interest
 * rate, the principal with a zero rate or time).
 */
export function solve(find: Find, v: { principal?: number; rate?: number; years?: number; interest?: number }): Solved | null {
  const ok = (n: number | undefined): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;
  let { principal: p, rate: r, years: t, interest: i } = v;
  if (find === "interest") {
    if (!ok(p) || !ok(r) || !ok(t)) return null;
    i = p * (r / 100) * t;
  } else if (find === "principal") {
    if (!ok(i) || !ok(r) || !ok(t) || r === 0 || t === 0) return null;
    p = i / ((r / 100) * t);
  } else if (find === "rate") {
    if (!ok(p) || !ok(i) || !ok(t) || p === 0 || t === 0) return null;
    r = (i / (p * t)) * 100;
  } else {
    if (!ok(p) || !ok(i) || !ok(r) || p === 0 || r === 0) return null;
    t = i / (p * (r / 100));
  }
  const out = { principal: p!, rate: r!, years: t!, interest: i!, total: p! + i! };
  // Huge inputs can overflow: no answer rather than ∞ on the page and the clipboard.
  return Object.values(out).every(Number.isFinite) ? out : null;
}

/**
 * Balance at the end of each whole year (and the part year at the end), for the table: simple interest next to
 * interest compounded once a year at the same rate, so the difference shows. At most `maxRows` rows: a longer term is
 * shown every few years (every 2, 3 … so the rows fit), and the last row is always the end of the term.
 */
export function schedule(s: Solved, maxRows = 50): { year: number; interest: number; balance: number; compound: number | null }[] {
  const rows: { year: number; interest: number; balance: number; compound: number | null }[] = [];
  if (!(s.years > 0) || !Number.isFinite(s.years)) return rows;
  const whole = Math.floor(s.years + 1e-9);
  const step = Math.max(1, Math.ceil(whole / (maxRows - 1)));
  const marks: number[] = [];
  for (let y = step; y <= whole && marks.length < maxRows - 1; y += step) marks.push(y);
  if (!marks.length || s.years - marks[marks.length - 1]! > 1e-9) marks.push(s.years);
  const rate = s.rate / 100;
  for (const y of marks) {
    const interest = s.principal * rate * y;
    // null when yearly compounding overflows (a huge rate or term); the page shows a dash.
    const c = compoundGrowth(s.principal, s.rate, y, 1);
    rows.push({ year: y, interest, balance: s.principal + interest, compound: c ? c.future : null });
  }
  return rows;
}
