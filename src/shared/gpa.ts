export const GRADES = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"] as const;
export type Grade = (typeof GRADES)[number];

const POINTS: Record<Grade, number> = {
  "A+": 4.0, A: 4.0, "A-": 3.7,
  "B+": 3.3, B: 3.0, "B-": 2.7,
  "C+": 2.3, C: 2.0, "C-": 1.7,
  "D+": 1.3, D: 1.0, "D-": 0.7,
  F: 0,
};

/** Credits per course above this are treated as a typo and skipped. */
export const MAX_CREDITS = 30;

export type GpaRow = { grade: Grade; credits: number };
export type GpaResult = { gpa: number; credits: number; points: number; courses: number };

export function isGrade(value: string): value is Grade {
  return (GRADES as readonly string[]).includes(value);
}

/** Grade points on the common 4.0 scale. `plusAbove4` counts A+ as 4.3, as some schools do. */
export function gradePoints(grade: Grade, plusAbove4 = false): number {
  if (grade === "A+" && plusAbove4) return 4.3;
  return POINTS[grade];
}

/** Credit-weighted GPA. Rows with zero, negative, non-numeric, or > MAX_CREDITS credits are skipped. Null when nothing counts. */
export function gpaOf(rows: GpaRow[], plusAbove4 = false): GpaResult | null {
  let credits = 0;
  let points = 0;
  let courses = 0;
  for (const row of rows) {
    if (!Number.isFinite(row.credits) || row.credits <= 0 || row.credits > MAX_CREDITS || !isGrade(row.grade)) continue;
    credits += row.credits;
    points += row.credits * gradePoints(row.grade, plusAbove4);
    courses += 1;
  }
  if (credits === 0) return null;
  return { gpa: points / credits, credits, points, courses };
}
