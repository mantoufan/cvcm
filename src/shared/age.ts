export type Age = {
  years: number;
  months: number;
  days: number;
  totalDays: number;
};

export function parseIsoDate(raw: string): Date | null {
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

export function ageOn(birthIso: string, onIso: string): Age | null {
  const birth = parseIsoDate(birthIso);
  const on = parseIsoDate(onIso);
  if (!birth || !on) return null;
  if (on.getTime() < birth.getTime()) return null;
  let years = on.getUTCFullYear() - birth.getUTCFullYear();
  let months = on.getUTCMonth() - birth.getUTCMonth();
  let days = on.getUTCDate() - birth.getUTCDate();
  if (days < 0) {
    months -= 1;
    const prev = new Date(Date.UTC(on.getUTCFullYear(), on.getUTCMonth(), 0));
    days += prev.getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const totalDays = Math.round((on.getTime() - birth.getTime()) / 86400000);
  return { years, months, days, totalDays };
}

export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
