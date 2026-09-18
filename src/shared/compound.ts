export type Compound = { future: number; interest: number };

export function compoundGrowth(
  principal: number,
  annualPct: number,
  years: number,
  timesPerYear: number,
): Compound | null {
  if (![principal, annualPct, years, timesPerYear].every(Number.isFinite)) return null;
  if (principal < 0 || years < 0) return null;
  const n = Math.floor(timesPerYear);
  if (n < 1) return null;
  const r = annualPct / 100;
  const base = 1 + r / n;
  if (base <= 0) return null;
  const future = principal * Math.pow(base, n * years);
  if (!Number.isFinite(future)) return null;
  return { future, interest: future - principal };
}
