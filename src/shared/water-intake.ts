export type Climate = "temperate" | "hot";
/** Common rule of thumb for healthy adults: about 35 ml per kg of body weight a day. */
export const ML_PER_KG = 35;
/** Roughly 12 ml per minute of exercise (360 ml per 30 minutes). */
export const ML_PER_EXERCISE_MIN = 12;
/** Hot or humid weather adds about half a litre. */
export const HOT_EXTRA_ML = 500;
export const GLASS_ML = 250;
export const MAX_EXERCISE_MIN = 600;

export type WaterResult = { ml: number; litres: number; glasses: number; base: number; exercise: number; climate: number };

export function waterIntake(kg: number, exerciseMin = 0, climate: Climate = "temperate"): WaterResult | null {
  if (!Number.isFinite(kg) || kg < 20 || kg > 300) return null;
  if (!Number.isFinite(exerciseMin) || exerciseMin < 0 || exerciseMin > MAX_EXERCISE_MIN) return null;
  const base = kg * ML_PER_KG;
  const exercise = exerciseMin * ML_PER_EXERCISE_MIN;
  const extra = climate === "hot" ? HOT_EXTRA_ML : 0;
  const ml = Math.round((base + exercise + extra) / 10) * 10;
  return { ml, litres: ml / 1000, glasses: Math.ceil(ml / GLASS_ML), base, exercise, climate: extra };
}
