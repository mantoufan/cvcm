/** "HH:MM" (24-hour) → minutes since midnight, or null. */
export function clockMinutes(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return hh * 60 + mm;
}

export type ShiftRow = { start: string; end: string; breakMin: number };
export type ShiftResult = { minutes: number; overnight: boolean };
export type TimeCardResult = {
  shifts: Array<ShiftResult | null>;
  totalMin: number;
  regularMin: number;
  overtimeMin: number;
  pay: number | null;
};

/** Worked minutes for one shift. An end before the start runs past midnight. Null when the times or break are invalid. */
export function shiftMinutes(row: ShiftRow): ShiftResult | null {
  const start = clockMinutes(row.start);
  const end = clockMinutes(row.end);
  if (start == null || end == null) return null;
  if (!Number.isFinite(row.breakMin) || row.breakMin < 0) return null;
  const overnight = end <= start;
  const span = overnight ? end + 1440 - start : end - start;
  if (row.breakMin >= span) return null;
  return { minutes: span - row.breakMin, overnight };
}

/**
 * Totals for a list of shifts. Rows with blank times are skipped; invalid rows count as null.
 * Hours above `overtimeAfterHours` in the period are overtime, paid at `rate × multiplier`.
 */
export function timeCard(rows: ShiftRow[], rate: number | null, overtimeAfterHours = 40, multiplier = 1.5): TimeCardResult {
  const shifts = rows.map((row) => (row.start.trim() === "" && row.end.trim() === "" ? null : shiftMinutes(row)));
  const totalMin = shifts.reduce((sum, s) => sum + (s?.minutes ?? 0), 0);
  const limit = Number.isFinite(overtimeAfterHours) && overtimeAfterHours >= 0 ? overtimeAfterHours * 60 : Infinity;
  const regularMin = Math.min(totalMin, limit);
  const overtimeMin = totalMin - regularMin;
  const pay = rate != null && Number.isFinite(rate) && rate >= 0 ? (regularMin / 60) * rate + (overtimeMin / 60) * rate * multiplier : null;
  return { shifts, totalMin, regularMin, overtimeMin, pay };
}

/** 450 → "7:30" */
export function hhmm(minutes: number): string {
  const m = Math.round(minutes);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}
