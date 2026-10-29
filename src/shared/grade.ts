export type GradeInput = { current: number; wanted: number; weight: number };
export type GradeResult = {
  /** Score needed on the final, in percent (may be below 0 or above 100). */
  needed: number;
  /** Table of needed scores for the common letter cut-offs. */
  targets: Array<{ letter: string; wanted: number; needed: number }>;
};

/** Common US letter cut-offs, percent. */
export const LETTER_CUTOFFS = [
  { letter: "A", wanted: 90 },
  { letter: "B", wanted: 80 },
  { letter: "C", wanted: 70 },
  { letter: "D", wanted: 60 },
] as const;

/** Final-exam score needed: (wanted − current × (1 − w)) ÷ w, with w the final's weight as a fraction. */
export function neededOnFinal(current: number, wanted: number, weightPercent: number): number | null {
  if (![current, wanted, weightPercent].every(Number.isFinite)) return null;
  if (current < 0 || current > 150 || wanted < 0 || wanted > 150 || weightPercent <= 0 || weightPercent > 100) return null;
  const w = weightPercent / 100;
  return (wanted - current * (1 - w)) / w;
}

export function finalGrade(input: GradeInput): GradeResult | null {
  const needed = neededOnFinal(input.current, input.wanted, input.weight);
  if (needed == null) return null;
  // Validation above covers current and weight, so the per-letter rows (fixed 60–90 targets) cannot fail.
  return {
    needed,
    targets: LETTER_CUTOFFS.map((c) => ({ letter: c.letter, wanted: c.wanted, needed: neededOnFinal(input.current, c.wanted, input.weight) as number })),
  };
}
