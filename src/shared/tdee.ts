export type Sex = "male" | "female";
export type Activity = "sedentary" | "light" | "moderate" | "active" | "athlete";

/** Standard multipliers on BMR (sedentary 1.2 through very hard daily training 1.9). */
export const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

export const ACTIVITIES = Object.keys(ACTIVITY_FACTOR) as Activity[];

/** A daily 500 kcal gap is roughly 0.5 kg (1 lb) a week; +300 kcal is a slow lean gain. */
export const CUT_KCAL = 500;
export const BULK_KCAL = 300;

/** Common lower limits for an unsupervised diet (kcal/day). */
export const CUT_FLOOR: Record<Sex, number> = { female: 1200, male: 1500 };

export type TdeeResult = {
  bmr: number;
  tdee: number;
  /** TDEE − 500, but never below max(BMR, CUT_FLOOR[sex]) and never above TDEE. */
  cut: number;
  /** The floor that limited the cut, or null when the full 500 kcal deficit fits. */
  cutFloor: number | null;
  bulk: number;
};

export const LB_PER_KG = 2.2046226218;
export const CM_PER_IN = 2.54;

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

export function feetInchesToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_IN;
}

/** Mifflin–St Jeor resting energy in kcal/day. */
export function bmrMifflin(sex: Sex, kg: number, cm: number, age: number): number | null {
  if (![kg, cm, age].every(Number.isFinite)) return null;
  if (kg <= 0 || cm <= 0 || age < 15 || age > 100 || kg > 500 || cm > 280) return null;
  return 10 * kg + 6.25 * cm - 5 * age + (sex === "male" ? 5 : -161);
}

export function tdeeFrom(sex: Sex, kg: number, cm: number, age: number, activity: Activity): TdeeResult | null {
  const bmr = bmrMifflin(sex, kg, cm, age);
  if (bmr == null || bmr <= 0) return null;
  const tdee = bmr * ACTIVITY_FACTOR[activity];
  const floor = Math.max(bmr, CUT_FLOOR[sex]);
  const raw = tdee - CUT_KCAL;
  const cut = raw >= floor ? raw : Math.min(tdee, floor);
  return { bmr, tdee, cut, cutFloor: raw >= floor ? null : floor, bulk: tdee + BULK_KCAL };
}
