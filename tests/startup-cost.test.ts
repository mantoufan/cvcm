// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXAMPLE_KIND, fieldOk, mountStartupCost, readField, sensitivityRows, shownValue, unmountStartupCost } from "../src/client/startup-cost/ui";
import { LOCALES, type Locale } from "../src/shared/locale";
import { SHOP_KINDS, shopExample, shopNumbers, type ShopInput } from "../src/shared/startup-cost";

const BASE: ShopInput = {
  fee: 0, buildout: 100, equipment: 50, keyMoney: 10, depositMonths: 2, stock: 20, rent: 10, staff: 2, wage: 20, utilities: 5, other: 5,
  price: 10, cogsPct: 30, packaging: 0.5, deliveryPct: 50, commissionPct: 20, orders: 10, days: 30,
};

describe("shop numbers", () => {
  it("adds the deposit to the money put in and nets commission off each order", () => {
    const r = shopNumbers(BASE);
    expect(r.startup).toBe(100 + 50 + 10 + 20 + 20);
    expect(r.fixed).toBe(10 + 40 + 5 + 5);
    // 10 × 0.7 − 0.5 − 10 × 0.5 × 0.2
    expect(r.perOrder).toBeCloseTo(5.5);
    expect(r.revenue).toBe(3000);
    expect(r.profit).toBeCloseTo(5.5 * 300 - 60);
    expect(r.paybackMonths).toBeCloseTo(200 / 1590);
    expect(r.breakEvenOrders).toBeCloseTo(60 / (5.5 * 30));
  });
  it("treats a margin of floating-point dust as zero", () => {
    const r = shopNumbers({ ...BASE, price: 6, cogsPct: 70, packaging: 1.8, deliveryPct: 0 });
    expect(r.perOrder).toBe(0);
    expect(r.breakEvenOrders).toBe(Infinity);
  });
  it("treats a profit that rounds to nothing as no payback", () => {
    const at = 60 / (5.5 * 30);
    expect(shopNumbers({ ...BASE, orders: at }).paybackMonths).toBe(Infinity);
  });
  it("never pays back at a loss, and has no break-even when each order loses", () => {
    expect(shopNumbers({ ...BASE, orders: 0 }).paybackMonths).toBe(Infinity);
    const loss = shopNumbers({ ...BASE, cogsPct: 100 });
    expect(loss.perOrder).toBeLessThan(0);
    expect(loss.breakEvenOrders).toBe(Infinity);
    expect(loss.paybackMonths).toBe(Infinity);
  });
  it("clamps shares and days and ignores negatives", () => {
    expect(shopNumbers({ ...BASE, cogsPct: 250 }).perOrder).toBeCloseTo(-0.5 - 1);
    expect(shopNumbers({ ...BASE, days: 90 }).revenue).toBe(10 * 10 * 31);
    expect(shopNumbers({ ...BASE, days: 0 }).revenue).toBe(100);
    expect(shopNumbers({ ...BASE, rent: -5 }).fixed).toBe(50);
  });
});

describe("examples", () => {
  it.each(LOCALES)("%s: every example makes money and pays back in one to three years", (loc) => {
    for (const kind of SHOP_KINDS) {
      const r = shopNumbers(shopExample(loc, kind));
      expect(r.profit).toBeGreaterThan(0);
      expect(r.paybackMonths).toBeGreaterThan(12);
      expect(r.paybackMonths).toBeLessThan(36);
    }
  });
  it.each(LOCALES)("%s: start values read back as the same numbers", (loc: Locale) => {
    for (const kind of SHOP_KINDS) {
      const ex = shopExample(loc, kind);
      for (const [k, x] of Object.entries(ex)) {
        const shown = shownValue(x, loc);
        expect(readField(shown, k as keyof ShopInput, loc), `${kind}.${k} ${shown}`).toBe(x);
      }
    }
  });
  it.each(LOCALES)("%s: FAQ a1 quotes the coffee example's startup total and payback", (loc) => {
    const pack = JSON.parse(readFileSync(resolve(process.cwd(), `src/locales/${loc}.json`), "utf8"));
    const a1: string = pack.faq["startup-cost"].a1;
    const ex = shopExample(loc, "coffee");
    const r = shopNumbers(ex);
    const nf = new Intl.NumberFormat(loc, { maximumFractionDigits: 0 });
    for (const n of [r.startup, ex.buildout, ex.equipment, ex.orders]) expect(a1).toContain(nf.format(n));
    const m = r.paybackMonths;
    const shown = new Intl.NumberFormat(loc, { maximumFractionDigits: 1 }).format(Math.round((m < 24 ? m : m / 12) * 10) / 10);
    expect(a1).toContain(shown);
  });
});

describe("reading a field", () => {
  it("reads grouped counts as whole numbers where a dot groups thousands", () => {
    expect(readField("1.200", "orders", "vi")).toBe(1200);
    expect(readField("1.200", "orders", "id")).toBe(1200);
    expect(readField("1,200", "orders", "en")).toBe(1200);
    expect(readField("2,5", "staff", "es")).toBe(2.5);
    expect(readField("1.5", "depositMonths", "en")).toBe(1.5);
  });
  it("drops percent and currency signs, and tells empty from unreadable", () => {
    expect(readField("30%", "cogsPct", "en")).toBe(30);
    expect(readField("$6.50", "price", "en")).toBe(6.5);
    expect(readField("₫29.000", "price", "vi")).toBe(29000);
    expect(readField("120,000 元", "buildout", "zh-CN")).toBe(120000);
    expect(readField("  ", "rent", "en")).toBeUndefined();
    expect(readField("%", "cogsPct", "en")).toBeNaN();
    expect(readField("abc", "rent", "en")).toBeNaN();
    expect(readField("￥1,000", "rent", "ja")).toBe(1000);
    expect(readField("12万", "buildout", "zh-CN")).toBe(120000);
    expect(readField("1.5萬", "rent", "zh-TW")).toBe(15000);
    expect(readField("1 2", "rent", "en")).toBeNaN();
    expect(readField("3000만원", "buildout", "ko")).toBe(30000000);
    expect(readField("1.5억", "buildout", "ko")).toBe(150000000);
    expect(readField("35k", "price", "vi")).toBe(35000);
    expect(readField("2 triệu", "rent", "vi")).toBe(2000000);
    expect(readField("5 jt", "rent", "id")).toBe(5000000);
    expect(readField("US$6.50", "price", "en")).toBe(6.5);
    expect(readField("HK$40", "price", "zh-TW")).toBe(40);
    expect(readField("30k", "cogsPct", "en")).toBeNaN();
    expect(readField("2.3k", "rent", "en")).toBe(2300);
    expect(readField("1.1万", "rent", "zh-CN")).toBe(11000);
    expect(readField("1$000", "rent", "en")).toBeNaN();
    expect(readField("30%", "rent", "en")).toBeNaN();
    expect(readField("Rp 26.000", "price", "id")).toBe(26000);
  });
  it("keeps shares to 100 % and days open to 1–31", () => {
    expect(fieldOk(250, "commissionPct")).toBe(false);
    expect(fieldOk(100, "cogsPct")).toBe(true);
    expect(fieldOk(60, "days")).toBe(false);
    expect(fieldOk(30.5, "days")).toBe(false);
    expect(fieldOk(undefined, "days")).toBe(false);
    expect(fieldOk(undefined, "rent")).toBe(true);
    expect(fieldOk(-1, "rent")).toBe(false);
  });
  it("drops what-if rows that round onto another", () => {
    expect(sensitivityRows(250).map((r) => r.orders)).toEqual([150, 200, 250, 300, 375]);
    expect(sensitivityRows(2).map((r) => r.orders)).toEqual([1.2, 1.6, 2, 2.4, 3]);
    expect(sensitivityRows(0.1).map((r) => r.orders)).toEqual([0.1, 0.2]);
    expect(sensitivityRows(12.5).map((r) => r.orders)).toEqual([7.5, 10, 12.5, 15, 18.8]);
  });
});

let host: HTMLElement;
beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => {
  unmountStartupCost();
  host.remove();
  vi.useRealTimers();
});

const q = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)!;
const text = (sel: string) => q(sel).textContent ?? "";
const set = (sel: string, value: string, event = "input") => {
  const el = q<HTMLInputElement | HTMLSelectElement>(sel);
  el.value = value;
  el.dispatchEvent(new Event(event));
  vi.advanceTimersByTime(200);
};

describe("startup cost ui", () => {
  it("opens on the US coffee shop example with payback, break-even and a five-row table", () => {
    mountStartupCost(host);
    expect(EXAMPLE_KIND).toBe("coffee");
    expect(q<HTMLInputElement>("[data-field=buildout]").value).toBe("90,000");
    expect(text("[data-out=result]")).toContain("Payback2.1 years");
    expect(text("[data-out=result]")).toContain("Break-even orders a day192 orders");
    expect(text("[data-out=result]")).toContain("Money needed to open172,000");
    expect(host.querySelectorAll("[data-out=table] tbody tr")).toHaveLength(5);
    expect(text("[data-out=disclaimer]")).toContain("For reference only");
  });
  it("loads another example and recalculates typed figures", () => {
    mountStartupCost(host);
    set("[data-field=kind]", "bakery", "change");
    expect(q<HTMLInputElement>("[data-field=equipment]").value).toBe("90,000");
    set("[data-field=orders]", "100");
    expect(text("[data-out=verdict]")).toMatch(/^At 100 orders a day the shop loses/);
    expect(text("[data-out=result]")).toContain("PaybackNever");
  });
  it("says so when a figure is not a number, marks the field and disables copy", () => {
    mountStartupCost(host);
    set("[data-field=rent]", "abc");
    expect(text("[data-out=result]")).toBe("Enter amounts of zero or more.");
    expect(q("[data-field=rent]").hasAttribute("aria-invalid")).toBe(true);
    expect(q<HTMLButtonElement>("[data-action=copy]").disabled).toBe(true);
    set("[data-field=rent]", "");
    expect(q("[data-field=rent]").hasAttribute("aria-invalid")).toBe(false);
    expect(q<HTMLButtonElement>("[data-action=copy]").disabled).toBe(false);
  });
  it("asks for the days open instead of counting one day a month", () => {
    mountStartupCost(host);
    set("[data-field=days]", "");
    expect(text("[data-out=result]")).toBe("Enter how many days a month the shop is open (1–31).");
    set("[data-field=days]", "0");
    expect(text("[data-out=result]")).toBe("Enter how many days a month the shop is open (1–31).");
    set("[data-field=days]", "60");
    expect(q("[data-field=days]").hasAttribute("aria-invalid")).toBe(true);
    set("[data-field=days]", "30");
    set("[data-field=commissionPct]", "250");
    expect(text("[data-out=result]")).toBe("Enter shares from 0 to 100 %.");
  });
  it("calls a zero month break-even, never shows −0, and keeps the typed orders on the yours row", () => {
    mountStartupCost(host);
    // Coffee example: 3.95625 left per order, fixed 22,700, 30 days → 22,700 / (3.95625 × 30) orders a day.
    set("[data-field=orders]", String(22700 / (3.95625 * 30)));
    expect(text("[data-out=verdict]")).toMatch(/just breaks even/);
    expect(text("[data-out=result]")).not.toContain("−0");
    expect(text("[data-out=result]")).toContain("PaybackNever");
    set("[data-field=orders]", "191.3");
    expect(text("[data-out=result]")).toContain("PaybackOver 50 years");
    expect(text("[data-out=verdict]")).toContain("payback takes over 50 years.");
    set("[data-field=orders]", "12.5");
    expect(text("[data-out=table] tbody tr:nth-child(3) td:first-child")).toBe("12.5 (yours)");
    // Singular in English: one order a day breaks even when fixed costs are tiny.
    set("[data-field=rent]", "0"); set("[data-field=staff]", "0"); set("[data-field=utilities]", "0"); set("[data-field=other]", "100");
    expect(text("[data-out=result]")).toContain("Break-even orders a day1 order");
    set("[data-field=other]", "0");
    expect(text("[data-out=result]")).toContain("Break-even orders a day0 orders");
  });
});
