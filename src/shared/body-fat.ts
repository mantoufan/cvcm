import type { Sex } from "./tdee";

export type BodyFatInput = { sex: Sex; cm: number; neck: number; waist: number; hip?: number; kg?: number };
export type BodyFatCategory = "essential" | "athlete" | "fitness" | "average" | "obese";
export type BodyFatResult = { percent: number; category: BodyFatCategory; fatKg: number | null; leanKg: number | null };

/** ACE body-fat ranges (lower bound of each band, percent). */
export const CATEGORY_FLOOR: Record<Sex, Record<BodyFatCategory, number>> = {
  male: { essential: 0, athlete: 6, fitness: 14, average: 18, obese: 25 },
  female: { essential: 0, athlete: 14, fitness: 21, average: 25, obese: 32 },
};

export const CATEGORIES: BodyFatCategory[] = ["essential", "athlete", "fitness", "average", "obese"];

export function categoryOf(sex: Sex, percent: number): BodyFatCategory {
  const floors = CATEGORY_FLOOR[sex];
  let cat: BodyFatCategory = "essential";
  for (const c of CATEGORIES) if (percent >= floors[c]) cat = c;
  return cat;
}

/**
 * U.S. Navy circumference method (Hodgdon & Beckett, 1984), all lengths in centimetres.
 * Men need neck and waist; women also need hips. Weight is optional and only splits fat and lean mass.
 */
export function bodyFat(input: BodyFatInput): BodyFatResult | null {
  const { sex, cm, neck, waist } = input;
  if (![cm, neck, waist].every(Number.isFinite)) return null;
  if (cm < 100 || cm > 280 || neck < 20 || neck > 80 || waist < 40 || waist > 250) return null;
  let percent: number;
  if (sex === "male") {
    if (waist - neck <= 0) return null;
    percent = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(cm)) - 450;
  } else {
    const hip = input.hip ?? NaN;
    if (!Number.isFinite(hip) || hip < 40 || hip > 250 || waist + hip - neck <= 0) return null;
    percent = 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.221 * Math.log10(cm)) - 450;
  }
  if (!Number.isFinite(percent) || percent < 1 || percent > 75) return null;
  const kg = input.kg;
  const hasKg = kg != null && Number.isFinite(kg) && kg > 0 && kg <= 500;
  return {
    percent,
    category: categoryOf(sex, percent),
    fatKg: hasKg ? (kg * percent) / 100 : null,
    leanKg: hasKg ? kg - (kg * percent) / 100 : null,
  };
}
