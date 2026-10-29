import { BULK_KCAL, CUT_KCAL } from "./tdee";

export type Goal = "lose" | "maintain" | "gain";
export type MacroSplit = "balanced" | "lowcarb" | "highprotein";

/** Share of calories from protein, fat and carbohydrate. Each split sums to 1. */
export const SPLITS: Record<MacroSplit, { protein: number; fat: number; carbs: number }> = {
  balanced: { protein: 0.3, fat: 0.3, carbs: 0.4 },
  lowcarb: { protein: 0.35, fat: 0.45, carbs: 0.2 },
  highprotein: { protein: 0.4, fat: 0.3, carbs: 0.3 },
};

export const KCAL_PER_G = { protein: 4, fat: 9, carbs: 4 } as const;
/** Goal adjustment on maintenance calories, kcal/day (matches the TDEE tool). */
export const GOAL_KCAL: Record<Goal, number> = { lose: -CUT_KCAL, maintain: 0, gain: BULK_KCAL };

export type MacroResult = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  /** Protein grams per kg of body weight, when weight is known. */
  proteinPerKg: number | null;
};

/** Grams of each macronutrient for a daily calorie target. */
export function macros(maintenanceKcal: number, goal: Goal, split: MacroSplit, kg?: number): MacroResult | null {
  if (!Number.isFinite(maintenanceKcal) || maintenanceKcal < 800 || maintenanceKcal > 10000) return null;
  const kcal = maintenanceKcal + GOAL_KCAL[goal];
  if (kcal < 800) return null;
  const s = SPLITS[split];
  const protein = (kcal * s.protein) / KCAL_PER_G.protein;
  return {
    kcal,
    protein,
    fat: (kcal * s.fat) / KCAL_PER_G.fat,
    carbs: (kcal * s.carbs) / KCAL_PER_G.carbs,
    proteinPerKg: kg != null && Number.isFinite(kg) && kg > 0 ? protein / kg : null,
  };
}
