/**
 * Blood alcohol content estimate with the Widmark formula:
 *   BAC (g/100 mL, i.e. %) = alcohol grams / (body weight in grams × r) × 100 − β × hours
 * r is the Widmark factor (0.68 for men, 0.55 for women, the textbook averages) and β the elimination rate,
 * 0.015 % per hour. It is an average-person estimate: food, health, medicines and how fast the drinks went down all
 * change the real number, so it never says whether someone is fit to drive.
 */

import { convertAmount } from "./units";

/** Density of ethanol, g/mL. */
export const ETHANOL_DENSITY = 0.789;
/** Average elimination, % BAC per hour. */
export const ELIMINATION = 0.015;
export const WIDMARK_R = { male: 0.68, female: 0.55 } as const;
export type Sex = keyof typeof WIDMARK_R;

/** One U.S. standard drink is 14 g of alcohol (NIAAA). */
export const US_STANDARD_DRINK_G = 14;

/** US fluid ounce in mL, from the unit converter's table. */
export const ML_PER_US_FL_OZ = convertAmount("volume", 1, "floz", "ml");

/** Common drinks: size in mL and alcohol by volume in %. The page names them (bac.d_<id>). */
export const DRINKS = [
  { id: "beer", ml: 355, abv: 5 },
  // A US pint (16 fl oz): the English page starts in US units. A UK pint (568 mL) can be typed as the size.
  { id: "pint", ml: 473, abv: 5 },
  { id: "wine", ml: 150, abv: 12 },
  { id: "shot", ml: 44, abv: 40 },
  { id: "cocktail", ml: 150, abv: 15 },
  { id: "soju", ml: 360, abv: 16.5 },
  { id: "sake", ml: 180, abv: 15 },
  { id: "baijiu", ml: 50, abv: 52 },
] as const;
export type DrinkId = (typeof DRINKS)[number]["id"];

export type Drink = { ml: number; abv: number; count: number };

/** Grams of pure alcohol in the drinks. */
export function alcoholGrams(drinks: readonly Drink[]): number {
  let g = 0;
  for (const d of drinks) {
    if (!(d.ml > 0) || !(d.abv > 0) || !(d.count > 0)) continue;
    g += d.ml * Math.min(d.abv, 100) / 100 * ETHANOL_DENSITY * d.count;
  }
  return g;
}

/** Peak BAC in % if all the alcohol were absorbed at once, before any is burned off. */
export function peakBac(grams: number, weightKg: number, sex: Sex): number {
  if (!(grams > 0) || !(weightKg > 0)) return 0;
  return grams / (weightKg * 1000 * WIDMARK_R[sex]) * 100;
}

/** BAC in % after `hours` since the first drink (never below 0). */
export function bacAfter(peak: number, hours: number): number {
  return Math.max(0, peak - ELIMINATION * Math.max(0, hours));
}

/** Hours from now until the BAC falls to `level` (0 when it already is at or under it). */
export function hoursUntil(current: number, level: number): number {
  return current > level ? (current - level) / ELIMINATION : 0;
}

/** The same BAC in the units countries write limits in: % (g/100 mL), ‰ (g/L) and mg/100 mL. */
export function bacUnits(pct: number): { pct: number; permille: number; mg100: number } {
  return { pct, permille: pct * 10, mg100: pct * 1000 };
}

/** The levels the page counts down to, in %. */
export const LEVELS = [0.08, 0.05, 0.02, 0] as const;

/**
 * How the estimate reads, by the usual effects at each level (NIAAA / NHTSA descriptions): none, mild (relaxed,
 * judgment already slipping), impaired (coordination and reaction time), heavy (clear loss of balance and speech),
 * danger (vomiting, blackouts, risk of alcohol poisoning).
 */
export type Band = "none" | "mild" | "impaired" | "heavy" | "danger";
export function band(pct: number): Band {
  if (pct <= 0) return "none";
  if (pct < 0.05) return "mild";
  if (pct < 0.15) return "impaired";
  if (pct < 0.3) return "heavy";
  return "danger";
}
