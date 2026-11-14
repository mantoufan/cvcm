/**
 * Car depreciation: what a car is worth after some years. The usual industry rule of thumb is about 20% lost in the
 * first year and about 15% a year for the next four (roughly 60% gone after five years), slowing to about 10% a year
 * after that. Luxury cars and electric cars lose value faster, pickups and many SUVs slower; more distance than average
 * and a worse condition take more off.
 */

export const CAR_SEGMENTS = ["average", "luxury", "electric", "truck"] as const;
export type CarSegment = (typeof CAR_SEGMENTS)[number];
export const CAR_CONDITIONS = ["excellent", "good", "fair", "poor"] as const;
export type CarCondition = (typeof CAR_CONDITIONS)[number];

/** Scales every year's loss: a luxury car loses 1.2× the usual share each year. */
const SEGMENT_RATE: Record<CarSegment, number> = { average: 1, luxury: 1.2, electric: 1.3, truck: 0.8 };
const CONDITION: Record<CarCondition, number> = { excellent: 1.05, good: 1, fair: 0.9, poor: 0.78 };

/** Average yearly distance the rule assumes: 12,000 miles (19,312 km). */
export const AVERAGE_YEARLY = { mi: 12_000, km: 19_312 } as const;

/** The usual share lost in year n (1-based). */
export function yearLoss(year: number): number {
  if (year <= 1) return 0.2;
  if (year <= 5) return 0.15;
  return 0.1;
}

/** Value left after `years` (fractions allowed: half a year loses half that year's share, compounded). */
export function retained(years: number, segment: CarSegment): number {
  let left = 1;
  const rate = SEGMENT_RATE[segment];
  for (let y = 1; y <= Math.ceil(years); y++) {
    const part = Math.min(1, years - (y - 1));
    left *= Math.pow(1 - Math.min(0.9, yearLoss(y) * rate), part);
  }
  return left;
}

/**
 * Distance adjustment: each 10% above the average takes 2% off, each 10% below adds 2%, capped at ±20%. It grows in
 * over the first three years, as the distance driven adds up: a new car has none.
 */
export function mileageFactor(yearlyDistance: number, unit: "mi" | "km", years = 3): number {
  if (!Number.isFinite(yearlyDistance) || yearlyDistance < 0) return 1;
  const over = yearlyDistance / AVERAGE_YEARLY[unit] - 1;
  const weight = Math.min(1, Math.max(0, years) / 3);
  return 1 - Math.max(-0.2, Math.min(0.2, over * 0.2)) * weight;
}

export type CarInput = {
  price: number;
  years: number;
  segment: CarSegment;
  condition: CarCondition;
  yearlyDistance: number;
  unit: "mi" | "km";
};

export type CarResult = {
  value: number;
  lost: number;
  lostPct: number;
  /** Value at the end of years 0–10 at average distance and in good condition, for the table and chart. */
  schedule: Array<{ year: number; value: number; lostPct: number }>;
};

export function carValue(input: CarInput): CarResult | null {
  const { price, years } = input;
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(years) || years < 0 || years > 40) return null;
  const value = price * retained(years, input.segment) * mileageFactor(input.yearlyDistance, input.unit, years) * CONDITION[input.condition];
  const capped = Math.min(price, value);
  const schedule = Array.from({ length: 11 }, (_, year) => {
    const v = price * retained(year, input.segment);
    return { year, value: v, lostPct: (1 - v / price) * 100 };
  });
  return { value: capped, lost: price - capped, lostPct: (1 - capped / price) * 100, schedule };
}
