// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mountPhoneValue, unmountPhoneValue } from "../src/client/phone-number-value/ui";
import { mountPlateValue, unmountPlateValue } from "../src/client/license-plate-value/ui";
import { mountDomainValue, unmountDomainValue } from "../src/client/domain-value/ui";
import { mountCarDepreciation, unmountCarDepreciation } from "../src/client/car-depreciation/ui";
import { mountNetWorth, unmountNetWorth } from "../src/client/net-worth/ui";
import { mountBusinessValuation, unmountBusinessValuation } from "../src/client/business-valuation/ui";

let host: HTMLElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  unmountPhoneValue();
  unmountPlateValue();
  unmountDomainValue();
  unmountCarDepreciation();
  unmountNetWorth();
  unmountBusinessValuation();
  host.remove();
});

const q = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)!;
const set = (sel: string, value: string, event = "input") => {
  const el = q<HTMLInputElement | HTMLSelectElement>(sel);
  el.value = value;
  el.dispatchEvent(new Event(event));
};

describe("phone number value ui", () => {
  it("values the example, follows the number's market and explains errors", () => {
    mountPhoneValue(host);
    expect(q("[data-out=estimate]").textContent).toMatch(/\$/);
    set("[data-field=number]", "+86 139 1286 8888");
    expect(q<HTMLSelectElement>("[data-field=market]").value).toBe("cn");
    expect(q("[data-out=estimate]").textContent).toMatch(/CN¥|¥/);
    expect(q("[data-out=numerology]").textContent).toBe("8 · lucky");
    expect(q("[data-out=features]").textContent).toContain("Ends in 4 × 8");
    set("[data-field=number]", "0903 686868");
    expect(q<HTMLSelectElement>("[data-field=market]").value).toBe("vn");
    expect(q("[data-out=nut]").textContent).toBe("4 nút");
    set("[data-field=number]", "123");
    expect(q("[data-out=error]").textContent).toContain("10 digits");
    expect(q("[data-out=result]").textContent).toBe("");
    set("[data-field=number]", "");
    expect(q("[data-out=error]").textContent).toBe("Type a phone number.");
  });

  it("keeps a market picked by hand", () => {
    mountPhoneValue(host);
    set("[data-field=market]", "intl", "change");
    set("[data-field=number]", "13912868888");
    expect(q<HTMLSelectElement>("[data-field=market]").value).toBe("intl");
    expect(q("[data-out=estimate]").textContent).toMatch(/\$/);
  });
});

describe("number plate value ui", () => {
  it("values UK marks, swaps examples with the country and shows no premium for an ordinary Vietnamese plate", () => {
    mountPlateValue(host);
    expect(q("[data-out=estimate]").textContent).toMatch(/£/);
    expect(q("[data-out=features]").textContent).toContain("Dateless mark");
    set("[data-field=market]", "vn", "change");
    expect(q<HTMLInputElement>("[data-field=plate]").value).toBe("30K-686.86");
    expect(host.querySelector("[data-preset='51K-888.88']")).not.toBeNull();
    set("[data-field=plate]", "29A-123.67");
    expect(q("[data-out=estimate]").textContent).toBe("No premium");
    expect(host.querySelector("[data-out=range]")).toBeNull();
    set("[data-field=plate]", "nope");
    expect(q("[data-out=error]").textContent).toContain("30K-686.86");
  });
});

describe("domain value ui", () => {
  it("values a pasted link and lists the factors", () => {
    mountDomainValue(host);
    set("[data-field=domain]", "https://www.Cloud.com/x");
    expect(q("[data-out=result]").textContent).toContain("cloud.com");
    expect(q("[data-out=features]").textContent).toContain("One common word: cloud");
    q<HTMLButtonElement>("[data-preset='my-best-shop-online.net']").click();
    expect(q("[data-out=features]").textContent).toContain("renewal fee");
    set("[data-field=domain]", "example");
    expect(q("[data-out=error]").textContent).toBe("Add the extension, such as .com.");
  });
});

describe("car depreciation ui", () => {
  it("shows today's value and an 11-year schedule", () => {
    mountCarDepreciation(host);
    expect(q("[data-out=value]").textContent).toBe("12,528");
    expect(host.querySelectorAll("[data-out=schedule] tbody tr")).toHaveLength(11);
    expect(host.querySelectorAll("[data-out=chart] rect")).toHaveLength(11);
    set("[data-field=price]", "abc");
    expect(q("[data-out=error]").textContent).toContain("price above 0");
    expect(q("[data-out=value]").textContent).toBe("");
  });
});

describe("net worth ui", () => {
  it("adds up the example, compares by age and names a bad field", () => {
    mountNetWorth(host);
    expect(q("[data-out=net]").textContent).toBe("225,000");
    expect(q("[data-out=compare]").textContent).toBe("");
    set("[data-field=age]", "40");
    expect(q("[data-out=compare]").textContent).toContain("$135,600");
    expect(q("[data-out=compare]").textContent).toContain("above the median");
    set("[data-field=cash]", "12x");
    expect(q("[data-out=error]").textContent).toBe("Cash and savings is not a number.");
    q<HTMLButtonElement>("[data-action=clear]").click();
    expect(q("[data-out=net]").textContent).toBe("0");
  });
});

describe("business valuation ui", () => {
  it("fills multiples from the industry, values three ways and flags a bad discount rate", () => {
    mountBusinessValuation(host);
    expect(q<HTMLInputElement>("[data-field=earningsLow]").value).toBe("2.0");
    expect(q("[data-out=rows]").textContent).toContain("240,000 – 420,000");
    expect(host.querySelectorAll("[data-out=dcf] tbody tr")).toHaveLength(6);
    set("[data-field=industry]", "saas", "change");
    expect(q<HTMLInputElement>("[data-field=revenueHigh]").value).toBe("8.0");
    set("[data-field=earningsLow]", "4");
    expect(q<HTMLSelectElement>("[data-field=industry]").value).toBe("custom");
    set("[data-field=discount]", "1");
    expect(q("[data-out=error]").textContent).toContain("discount rate must be above");
    expect(q("[data-out=range]").textContent).not.toBe("");
  });
});

describe("review fixes (ui)", () => {
  it("keeps a typed plate when the country is picked", () => {
    mountPlateValue(host);
    set("[data-field=plate]", "29B1-8888");
    set("[data-field=market]", "vn", "change");
    expect(q<HTMLInputElement>("[data-field=plate]").value).toBe("29B1-8888");
  });

  it("converts the distance when the unit changes", () => {
    mountCarDepreciation(host);
    const before = q("[data-out=value]").textContent;
    set("[data-field=unit]", "km", "change");
    expect(q<HTMLInputElement>("[data-field=distance]").value).toBe("19312");
    expect(q("[data-out=value]").textContent).toBe(before);
  });

  it("does not switch a half-typed plate to another country", () => {
    mountPlateValue(host);
    set("[data-field=market]", "vn", "change");
    for (const typed of ["30K", "30K6", "30K68", "30K686", "30K6868"]) {
      set("[data-field=plate]", typed);
      expect(q<HTMLSelectElement>("[data-field=market]").value).toBe("vn");
    }
  });

  it("shows the DCF's own error when only the DCF inputs are wrong", () => {
    mountBusinessValuation(host);
    set("[data-field=cashFlow]", "");
    expect(q("[data-out=error]").textContent).toContain("forecast years");
    expect(q("[data-out=range]").textContent).not.toBe("");
  });

  it("compares net worth with U.S. households only in dollars", () => {
    mountNetWorth(host);
    set("[data-field=age]", "40");
    set("[data-field=currency]", "other", "change");
    expect(q("[data-out=need-rate]").textContent).toContain("exchange rate");
    set("[data-field=rate]", "25000");
    expect(q("[data-out=compare]").textContent).toContain("$9");
    expect(q("[data-out=compare]").textContent).toContain("below the median");
  });
});
