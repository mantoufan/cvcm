/** Mortgage maths: equal monthly payments (annuity) or equal principal, with a year-by-year schedule. */

export type MortgageMethod = "annuity" | "principal";

export type MortgageInput = {
  /** Home price. */
  price: number;
  /** Down payment as a percentage of the price, 0–100. */
  downPct: number;
  /** Yearly interest rate in percent, 0–100. */
  rate: number;
  /** Term in whole years, 1–50. */
  years: number;
  method: MortgageMethod;
};

export type MortgageYear = { year: number; principal: number; interest: number; balance: number };

export type MortgageResult = {
  loan: number;
  down: number;
  /** Payment in month 1. Equal for every month with the annuity method. */
  firstPayment: number;
  /** Payment in the last month (lower with equal principal). */
  lastPayment: number;
  /** With equal principal, each month's payment falls by this much. 0 for the annuity method. */
  monthlyDrop: number;
  interest: number;
  total: number;
  months: number;
  schedule: MortgageYear[];
};

export const MAX_YEARS = 50;
export const MAX_PRICE = 1e12;

/** Fixed monthly payment for a loan; 0% interest splits it evenly. */
export function annuityPayment(loan: number, monthlyRate: number, months: number): number {
  if (monthlyRate === 0) return loan / months;
  const f = Math.pow(1 + monthlyRate, months);
  return (loan * monthlyRate * f) / (f - 1);
}

export function mortgage(input: MortgageInput): MortgageResult | null {
  const { price, downPct, rate, years, method } = input;
  if (![price, downPct, rate, years].every(Number.isFinite)) return null;
  if (price <= 0 || price > MAX_PRICE) return null;
  if (downPct < 0 || downPct >= 100) return null;
  if (rate < 0 || rate > 100) return null;
  if (!Number.isInteger(years) || years < 1 || years > MAX_YEARS) return null;
  const down = (price * downPct) / 100;
  const loan = price - down;
  const months = years * 12;
  const r = rate / 100 / 12;
  const schedule: MortgageYear[] = [];
  let balance = loan;
  let interest = 0;
  let firstPayment = 0;
  let lastPayment = 0;
  const fixed = annuityPayment(loan, r, months);
  const part = loan / months;
  let yp = 0;
  let yi = 0;
  for (let m = 1; m <= months; m++) {
    const i = balance * r;
    // The last month clears what is left, so rounding never leaves a few cents owing.
    const p = m === months ? balance : method === "annuity" ? fixed - i : part;
    const pay = p + i;
    if (m === 1) firstPayment = pay;
    if (m === months) lastPayment = pay;
    balance -= p;
    interest += i;
    yp += p;
    yi += i;
    if (m % 12 === 0) {
      schedule.push({ year: m / 12, principal: yp, interest: yi, balance: Math.max(0, balance) });
      yp = 0;
      yi = 0;
    }
  }
  return {
    loan,
    down,
    firstPayment,
    lastPayment,
    monthlyDrop: method === "principal" ? part * r : 0,
    interest,
    total: loan + interest,
    months,
    schedule,
  };
}
