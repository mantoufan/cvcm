/**
 * Startup cost and break-even for a small shop (coffee shop, bubble tea, bakery): what it takes to open, what a month
 * earns, how long until the money put in comes back, and how many orders a day cover the monthly costs.
 *
 * Every amount is in whatever currency the visitor types; the examples are illustrative, never quotes.
 */

export interface ShopInput {
  /** One-off: franchise or brand fee. */
  fee: number;
  /** One-off: fit-out / renovation. */
  buildout: number;
  /** One-off: equipment. */
  equipment: number;
  /** One-off: key money or lease takeover paid to the previous tenant. */
  keyMoney: number;
  /** Rent deposit, in months of rent (held for the lease, so counted as money put in). */
  depositMonths: number;
  /** One-off: first stock and sundries. */
  stock: number;
  /** Monthly rent. */
  rent: number;
  /** Staff on the payroll (an owner who works full time should count as one). */
  staff: number;
  /** Monthly cost per person: pay plus payroll taxes or social insurance. */
  wage: number;
  /** Monthly utilities. */
  utilities: number;
  /** Other monthly costs: service fees, software, marketing. */
  other: number;
  /** Average spend per order. */
  price: number;
  /** Ingredients as a share of the price, waste included, 0–100. */
  cogsPct: number;
  /** Packaging per order. */
  packaging: number;
  /** Share of orders placed through delivery apps, 0–100. */
  deliveryPct: number;
  /** Delivery app commission on those orders, 0–100. */
  commissionPct: number;
  /** Orders a day. */
  orders: number;
  /** Days open a month, 1–31. */
  days: number;
}

export interface ShopResult {
  /** Money put in before opening, deposit included. */
  startup: number;
  /** Monthly fixed costs: rent, staff, utilities, other. */
  fixed: number;
  /** What one order leaves after ingredients, packaging and delivery commission. */
  perOrder: number;
  revenue: number;
  /** Monthly profit before tax and before the owner's own pay (unless the owner is counted as staff). */
  profit: number;
  /** Months to earn back the startup money; Infinity when a month makes no profit (rounded to a whole unit). */
  paybackMonths: number;
  /** Orders a day at which the month breaks even; Infinity when each order loses money. */
  breakEvenOrders: number;
  rentShare: number;
  laborShare: number;
}

const clampPct = (x: number) => Math.min(Math.max(x, 0), 100) / 100;
const pos = (x: number) => (Number.isFinite(x) && x > 0 ? x : 0);

export function shopNumbers(input: ShopInput, ordersOverride?: number): ShopResult {
  const v = Object.fromEntries(Object.entries(input).map(([k, x]) => [k, pos(x)])) as unknown as ShopInput;
  const orders = ordersOverride === undefined ? v.orders : pos(ordersOverride);
  const days = Math.min(Math.max(Math.round(v.days), 1), 31);
  const startup = v.fee + v.buildout + v.equipment + v.keyMoney + v.rent * v.depositMonths + v.stock;
  const labor = v.staff * v.wage;
  const fixed = v.rent + labor + v.utilities + v.other;
  const perOrder = v.price * (1 - clampPct(v.cogsPct)) - v.packaging - v.price * clampPct(v.deliveryPct) * clampPct(v.commissionPct);
  const revenue = v.price * orders * days;
  const profit = perOrder * orders * days - fixed;
  return {
    startup,
    fixed,
    perOrder,
    revenue,
    profit,
    // A profit that rounds to nothing (floating-point dust at break-even) is no payback, not 10¹⁶ years.
    paybackMonths: Math.round(profit) > 0 ? startup / profit : Infinity,
    breakEvenOrders: perOrder > 0 ? fixed / (perOrder * days) : Infinity,
    rentShare: revenue > 0 ? v.rent / revenue : NaN,
    laborShare: revenue > 0 ? labor / revenue : NaN,
  };
}

/** Rows of the "what if you sell more or less" table, as shares of the orders typed. */
export const SENSITIVITY = [0.6, 0.8, 1, 1.2, 1.5] as const;

export const SHOP_KINDS = ["coffee", "tea", "bakery"] as const;
export type ShopKind = (typeof SHOP_KINDS)[number];

/**
 * US examples in dollars for a small street-front shop of about 40 m² (430 sq ft). Other languages scale them by
 * rough local price, rent and wage levels (`MARKETS`); zh-CN has its own figures for a second-tier Chinese city.
 */
const US: Record<ShopKind, ShopInput> = {
  coffee: { fee: 0, buildout: 90000, equipment: 60000, keyMoney: 0, depositMonths: 2, stock: 10000, rent: 6000, staff: 4, wage: 3500, utilities: 1200, other: 1500, price: 6.5, cogsPct: 30, packaging: 0.35, deliveryPct: 15, commissionPct: 25, orders: 250, days: 30 },
  tea: { fee: 30000, buildout: 80000, equipment: 40000, keyMoney: 0, depositMonths: 2, stock: 8000, rent: 5000, staff: 4, wage: 3000, utilities: 1000, other: 1500, price: 7, cogsPct: 30, packaging: 0.4, deliveryPct: 30, commissionPct: 25, orders: 220, days: 30 },
  bakery: { fee: 0, buildout: 100000, equipment: 90000, keyMoney: 0, depositMonths: 2, stock: 12000, rent: 6500, staff: 5, wage: 3600, utilities: 2500, other: 2000, price: 12, cogsPct: 35, packaging: 0.5, deliveryPct: 15, commissionPct: 25, orders: 180, days: 30 },
};

const CN: Record<ShopKind, ShopInput> = {
  coffee: { fee: 0, buildout: 120000, equipment: 80000, keyMoney: 0, depositMonths: 2, stock: 20000, rent: 12000, staff: 3, wage: 6000, utilities: 2500, other: 3000, price: 22, cogsPct: 30, packaging: 1.5, deliveryPct: 30, commissionPct: 20, orders: 120, days: 30 },
  tea: { fee: 60000, buildout: 80000, equipment: 60000, keyMoney: 30000, depositMonths: 2, stock: 20000, rent: 10000, staff: 4, wage: 5500, utilities: 3000, other: 3000, price: 16, cogsPct: 35, packaging: 1.2, deliveryPct: 50, commissionPct: 20, orders: 250, days: 30 },
  bakery: { fee: 0, buildout: 100000, equipment: 150000, keyMoney: 0, depositMonths: 2, stock: 30000, rent: 15000, staff: 4, wage: 6500, utilities: 6000, other: 4000, price: 35, cogsPct: 40, packaging: 2, deliveryPct: 20, commissionPct: 20, orders: 130, days: 30 },
};

/** Currency units per US dollar, and local levels relative to the US for costs (fit-out, rent), wages and prices. */
interface Market { fx: number; cost: number; labor: number; price: number }
const MARKETS: Record<string, Market> = {
  es: { fx: 0.92, cost: 0.55, labor: 0.55, price: 0.6 },
  ja: { fx: 150, cost: 0.6, labor: 0.6, price: 0.65 },
  ko: { fx: 1380, cost: 0.6, labor: 0.6, price: 0.6 },
  "zh-TW": { fx: 32, cost: 0.45, labor: 0.35, price: 0.4 },
  id: { fx: 16000, cost: 0.3, labor: 0.12, price: 0.2 },
  vi: { fx: 25000, cost: 0.25, labor: 0.1, price: 0.18 },
};

/** Two significant figures: 41,250 → 41,000; 0.0731 → 0.073. */
function nice(x: number): number {
  return x === 0 ? 0 : Number(x.toPrecision(2));
}

/** The example a page opens with for a shop kind, in the page language's usual currency. */
export function shopExample(loc: string, kind: ShopKind): ShopInput {
  if (loc === "zh-CN") return { ...CN[kind] };
  const base = US[kind];
  const m = MARKETS[loc];
  if (!m) return { ...base };
  const c = (x: number) => nice(x * m.fx * m.cost);
  const p = (x: number) => nice(x * m.fx * m.price);
  return {
    ...base,
    fee: c(base.fee),
    buildout: c(base.buildout),
    equipment: c(base.equipment),
    keyMoney: c(base.keyMoney),
    stock: c(base.stock),
    rent: c(base.rent),
    wage: nice(base.wage * m.fx * m.labor),
    utilities: c(base.utilities),
    other: c(base.other),
    price: p(base.price),
    packaging: p(base.packaging),
  };
}
