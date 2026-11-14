/**
 * Small business valuation three ways:
 * - earnings multiple: yearly profit (SDE for an owner-run business, EBITDA for a larger one) × a multiple;
 * - revenue multiple: yearly sales × a multiple;
 * - discounted cash flow (DCF): free cash flow grown for a number of years, plus a Gordon-growth terminal value, all
 *   discounted back at the discount rate.
 * Industry presets hold typical small-business multiples (rough ranges from broker market reports); every multiple can
 * be edited.
 */

export const INDUSTRIES = ["services", "retail", "restaurant", "manufacturing", "ecommerce", "saas", "custom"] as const;
export type Industry = (typeof INDUSTRIES)[number];

/** [low, high] earnings multiple and [low, high] revenue multiple. */
export const INDUSTRY_MULTIPLES: Record<Exclude<Industry, "custom">, { earnings: [number, number]; revenue: [number, number] }> = {
  services: { earnings: [2, 3.5], revenue: [0.5, 1] },
  retail: { earnings: [1.8, 3], revenue: [0.3, 0.6] },
  restaurant: { earnings: [1.5, 2.5], revenue: [0.3, 0.5] },
  manufacturing: { earnings: [3, 5], revenue: [0.6, 1.2] },
  ecommerce: { earnings: [2.5, 4], revenue: [0.8, 1.5] },
  saas: { earnings: [5, 10], revenue: [3, 8] },
};

export type DcfInput = {
  cashFlow: number;
  /** Yearly growth for the forecast years, as a fraction (0.1 = 10%). */
  growth: number;
  /** Discount rate, as a fraction. */
  discount: number;
  /** Growth after the forecast, as a fraction; must be below the discount rate. */
  terminalGrowth: number;
  years: number;
};

export type DcfResult = {
  value: number;
  /** Present value of the forecast years' cash flows. */
  forecastPv: number;
  /** Present value of the terminal value. */
  terminalPv: number;
  rows: Array<{ year: number; cashFlow: number; pv: number }>;
};

export type DcfError = "discountBelowGrowth" | "invalid";

export function dcf(input: DcfInput): { ok: true; result: DcfResult } | { ok: false; error: DcfError } {
  const { cashFlow, growth, discount, terminalGrowth, years } = input;
  if (![cashFlow, growth, discount, terminalGrowth, years].every(Number.isFinite) || years < 1 || years > 30 || discount <= -1 || growth <= -1) {
    return { ok: false, error: "invalid" };
  }
  if (discount <= terminalGrowth) return { ok: false, error: "discountBelowGrowth" };
  const rows: DcfResult["rows"] = [];
  let cf = cashFlow;
  let forecastPv = 0;
  for (let year = 1; year <= Math.round(years); year++) {
    cf *= 1 + growth;
    const pv = cf / Math.pow(1 + discount, year);
    forecastPv += pv;
    rows.push({ year, cashFlow: cf, pv });
  }
  const terminal = (cf * (1 + terminalGrowth)) / (discount - terminalGrowth);
  const terminalPv = terminal / Math.pow(1 + discount, Math.round(years));
  return { ok: true, result: { value: forecastPv + terminalPv, forecastPv, terminalPv, rows } };
}

export function multipleRange(base: number, [lo, hi]: readonly [number, number]): [number, number] | null {
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(lo) || !Number.isFinite(hi) || lo < 0 || hi < lo) return null;
  return [base * lo, base * hi];
}
