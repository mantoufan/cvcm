export type Margin = {
  profit: number;
  marginPct: number | null;
  markupPct: number | null;
};

/** Margin is profit / price. Markup is profit / cost. Both amounts must be ≥ 0. */
export function marginOf(cost: number, price: number): Margin | null {
  if (!Number.isFinite(cost) || !Number.isFinite(price)) return null;
  if (cost < 0 || price < 0) return null;
  if (cost === 0 && price === 0) return null;
  const profit = price - cost;
  return {
    profit,
    marginPct: price === 0 ? null : (profit / price) * 100,
    markupPct: cost === 0 ? null : (profit / cost) * 100,
  };
}
