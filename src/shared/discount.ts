export type Discount = { sale: number; saved: number };

export function discountOf(original: number, pct: number): Discount | null {
  if (!Number.isFinite(original) || !Number.isFinite(pct) || original < 0) return null;
  const saved = original * (pct / 100);
  return { sale: original - saved, saved };
}

export function money(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2);
}
