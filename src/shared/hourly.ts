export type HourlyPay = {
  hourly: number;
  weekly: number;
  annual: number;
  hoursPerWeek: number;
  weeksPerYear: number;
};

function yearHours(hoursPerWeek: number, weeksPerYear: number): number | null {
  if (!Number.isFinite(hoursPerWeek) || !Number.isFinite(weeksPerYear)) return null;
  if (hoursPerWeek <= 0 || hoursPerWeek > 168) return null;
  if (weeksPerYear <= 0 || weeksPerYear > 52) return null;
  return hoursPerWeek * weeksPerYear;
}

export function payFromHourly(hourly: number, hoursPerWeek: number, weeksPerYear: number): HourlyPay | null {
  const hours = yearHours(hoursPerWeek, weeksPerYear);
  if (hours == null || !Number.isFinite(hourly) || hourly < 0) return null;
  const weekly = hourly * hoursPerWeek;
  return { hourly, weekly, annual: weekly * weeksPerYear, hoursPerWeek, weeksPerYear };
}

export function payFromAnnual(annual: number, hoursPerWeek: number, weeksPerYear: number): HourlyPay | null {
  const hours = yearHours(hoursPerWeek, weeksPerYear);
  if (hours == null || !Number.isFinite(annual) || annual < 0) return null;
  const hourly = annual / hours;
  return { hourly, weekly: hourly * hoursPerWeek, annual, hoursPerWeek, weeksPerYear };
}
