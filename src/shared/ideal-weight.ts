import { CM_PER_IN, type Sex } from "./tdee";

export type IdealFormula = "devine" | "robinson" | "miller" | "hamwi";
export const FORMULAS: IdealFormula[] = ["devine", "robinson", "miller", "hamwi"];

/** Every formula is a base weight at 5 ft (152.4 cm) plus a per-inch step; below 5 ft it extrapolates down to 140 cm. */
export const BASE_CM = 152.4;
export const MIN_CM = 140;
export const MAX_CM = 250;

/** kg for the four common formulas, all defined from 5 ft plus per-inch increments. */
export function idealWeights(sex: Sex, cm: number): Record<IdealFormula, number> | null {
  if (!Number.isFinite(cm) || cm < MIN_CM || cm > MAX_CM) return null;
  const over = (cm - BASE_CM) / CM_PER_IN;
  const m = sex === "male";
  return {
    devine: (m ? 50 : 45.5) + 2.3 * over,
    robinson: (m ? 52 : 49) + (m ? 1.9 : 1.7) * over,
    miller: (m ? 56.2 : 53.1) + (m ? 1.41 : 1.36) * over,
    hamwi: (m ? 48 : 45.5) + (m ? 2.7 : 2.2) * over,
  };
}

/** Weight range for BMI 18.5 to 24.9 at this height (WHO healthy range). */
export function healthyBmiRange(cm: number): { low: number; high: number } | null {
  if (!Number.isFinite(cm) || cm <= 0 || cm > MAX_CM) return null;
  const m2 = (cm / 100) ** 2;
  return { low: 18.5 * m2, high: 24.9 * m2 };
}
