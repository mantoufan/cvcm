export type TipSplit = {
  tip: number;
  total: number;
  perPerson: number;
};

export function tipSplit(bill: number, pct: number, people: number): TipSplit | null {
  if (!Number.isFinite(bill) || !Number.isFinite(pct) || !Number.isFinite(people)) return null;
  if (bill < 0 || people < 1) return null;
  const n = Math.max(1, Math.floor(people));
  const tip = bill * (pct / 100);
  const total = bill + tip;
  return { tip, total, perPerson: total / n };
}

export function money(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2);
}
