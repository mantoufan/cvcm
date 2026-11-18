// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "../src/shared/messages-all";
import { mountCurrency } from "../src/client/currency/ui";
import { formatMoney, pairData } from "../src/shared/currency-i18n";

describe("currency pages: converters", () => {
  it("mounts the hub on the locale's default pair and converts on input, swap and change", () => {
    const host = document.createElement("div");
    mountCurrency(host, "zh-CN", null);
    const out = host.querySelector(".fx-out")!;
    expect(out.textContent).toMatch(/^100 USD = [\d,.]+ CNY$/);
    expect(host.querySelector<HTMLAnchorElement>(".fx-pairlink a")?.getAttribute("href")).toBe("/zh-cn/currency/usd-cny/");
    const amount = host.querySelector<HTMLInputElement>(".fx-amount")!;
    amount.value = "1";
    amount.dispatchEvent(new Event("input"));
    expect(out.textContent).toBe(`1 USD = ${formatMoney("zh-CN", pairData("zh-CN", "usd-cny").rate)} CNY`);
    host.querySelector<HTMLButtonElement>(".fx-swap")!.click();
    expect(out.textContent).toMatch(/^1 CNY = 0\.15 USD$/);
    amount.value = "abc";
    amount.dispatchEvent(new Event("input"));
    expect(out.textContent).toContain("100");
  });

  it("fills the other amount on a pair page, with decimal commas in es", () => {
    const host = document.createElement("div");
    mountCurrency(host, "es", "usd-mxn");
    const a = host.querySelector<HTMLInputElement>(".fx-a")!;
    const b = host.querySelector<HTMLInputElement>(".fx-b")!;
    a.value = "10";
    a.dispatchEvent(new Event("input"));
    expect(b.value).toBe(formatMoney("es", pairData("es", "usd-mxn").rate * 10));
    b.value = "1.000";
    b.dispatchEvent(new Event("input"));
    expect(a.value).toBe(formatMoney("es", 1000 / pairData("es", "usd-mxn").rate));
  });
});
