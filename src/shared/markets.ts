export const MARKET_PAGES = ["gold", "silver", "stocks"] as const;
export type MarketId = (typeof MARKET_PAGES)[number];

/** Troy ounce. The unit tool's oz is the avoirdupois ounce. */
export const TROY_OZ_G = 31.1034768;
/** Hong Kong gold tael, Chinese Gold and Silver Exchange Society figure. */
export const HK_TAEL_G = 37.429;
/** Mainland market tael, 市两. */
export const MARKET_TAEL_G = 50;
/** Taiwan tael, 台两. */
export const TW_TAEL_G = 37.5;

export const WEIGHT_UNITS = ["g", "troyOz", "hkTael", "marketTael", "twTael"] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

const GRAMS: Record<WeightUnit, number> = {
  g: 1,
  troyOz: TROY_OZ_G,
  hkTael: HK_TAEL_G,
  marketTael: MARKET_TAEL_G,
  twTael: TW_TAEL_G,
};

export function isMarketId(value: string): value is MarketId {
  return (MARKET_PAGES as readonly string[]).includes(value);
}

export function convertWeight(value: number, from: WeightUnit): Record<WeightUnit, number> | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const grams = value * GRAMS[from];
  const out = {} as Record<WeightUnit, number>;
  for (const unit of WEIGHT_UNITS) {
    const next = grams / GRAMS[unit];
    if (!Number.isFinite(next)) return null;
    out[unit] = next;
  }
  return out;
}

export type MetalPrices = {
  perGram: number;
  perTroyOz: number;
  perHkTael: number;
  perMarketTael: number;
  perTwTael: number;
};

/** USD per troy ounce, typed by the visitor. No quote is fetched. */
export function metalPrices(usdPerTroyOz: number): MetalPrices | null {
  if (!Number.isFinite(usdPerTroyOz) || usdPerTroyOz < 0) return null;
  const perGram = usdPerTroyOz / TROY_OZ_G;
  const out = {
    perGram,
    perTroyOz: usdPerTroyOz,
    perHkTael: perGram * HK_TAEL_G,
    perMarketTael: perGram * MARKET_TAEL_G,
    perTwTael: perGram * TW_TAEL_G,
  };
  return Object.values(out).every(Number.isFinite) ? out : null;
}

/** Company market cap from price and shares outstanding. */
export function companyMarketCap(price: number, shares: number): number | null {
  if (!Number.isFinite(price) || !Number.isFinite(shares) || price < 0 || shares < 0) return null;
  const cap = price * shares;
  return Number.isFinite(cap) ? cap : null;
}

/** Price / annual EPS. Blank when EPS is 0 or the result is not finite. */
export function peRatio(price: number, eps: number): number | null {
  if (!Number.isFinite(price) || !Number.isFinite(eps) || price < 0 || eps < 0 || eps === 0) return null;
  const pe = price / eps;
  return Number.isFinite(pe) ? pe : null;
}

/** Annual dividend per share / price, as a percent. Blank when price is 0. */
export function dividendYield(price: number, annualDividend: number): number | null {
  if (!Number.isFinite(price) || !Number.isFinite(annualDividend) || price <= 0 || annualDividend < 0) return null;
  const yieldPct = (annualDividend / price) * 100;
  return Number.isFinite(yieldPct) ? yieldPct : null;
}

/** US petroleum barrel: 42 US gallons. */
export const BARREL_GAL = 42;
export const GALLON_L = 3.785411784;
export const BARREL_L = BARREL_GAL * GALLON_L;

export const OIL_UNITS = ["bbl", "gal", "l"] as const;
export type OilUnit = (typeof OIL_UNITS)[number];

const OIL_LITERS: Record<OilUnit, number> = {
  bbl: BARREL_L,
  gal: GALLON_L,
  l: 1,
};

export function convertOil(value: number, from: OilUnit): Record<OilUnit, number> | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const liters = value * OIL_LITERS[from];
  const out = {} as Record<OilUnit, number>;
  for (const unit of OIL_UNITS) {
    const next = liters / OIL_LITERS[unit];
    if (!Number.isFinite(next)) return null;
    out[unit] = next;
  }
  return out;
}
