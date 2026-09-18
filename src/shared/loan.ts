export type Loan = {
  payment: number;
  interest: number;
  total: number;
};

export function loanPayment(principal: number, annualPct: number, years: number): Loan | null {
  if (!Number.isFinite(principal) || !Number.isFinite(annualPct) || !Number.isFinite(years)) return null;
  if (principal <= 0 || years <= 0) return null;
  const n = Math.round(years * 12);
  if (n < 1) return null;
  const r = annualPct / 100 / 12;
  const payment = r === 0 ? principal / n : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const total = payment * n;
  return { payment, total, interest: total - principal };
}
