export type Vat = { net: number; tax: number; gross: number };

export function vatOf(amount: number, ratePct: number, inclusive: boolean): Vat | null {
  if (!Number.isFinite(amount) || !Number.isFinite(ratePct)) return null;
  if (amount < 0 || ratePct < 0) return null;
  const r = ratePct / 100;
  if (inclusive) {
    const net = amount / (1 + r);
    if (!Number.isFinite(net)) return null;
    return { net, tax: amount - net, gross: amount };
  }
  const tax = amount * r;
  return { net: amount, tax, gross: amount + tax };
}
