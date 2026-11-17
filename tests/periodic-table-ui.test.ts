// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "../src/shared/messages-all";
import { mountElements, searchOrder } from "../src/client/elements/ui";
import { elementsPageHtml } from "../src/shared/elements-page";

const ALL = Array.from({ length: 118 }, (_, i) => i + 1);

describe("periodic table hub: search", () => {
  it("puts an exact symbol or atomic number first, then name prefixes, then substrings", () => {
    const ca = searchOrder("en", "Ca", "", ALL);
    expect(ca.exact).toBe(20);
    expect(ca.zs[0]).toBe(20);
    // Prefix matches (cadmium, caesium, californium, carbon) before names that only contain "ca" (scandium…).
    const cadmium = ca.zs.indexOf(48);
    const scandium = ca.zs.indexOf(21);
    expect(cadmium).toBeGreaterThan(0);
    expect(scandium).toBeGreaterThan(cadmium);
    expect(searchOrder("en", "fe", "", ALL)).toEqual({ exact: 26, zs: [26, 100] });
    expect(searchOrder("en", "6", "", ALL)).toEqual({ zs: [6], exact: 6 });
    expect(searchOrder("en", "c", "", ALL).zs[0]).toBe(6);
    expect(searchOrder("ja", "炭", "", ALL).zs).toEqual([6]);
    // English names match on every locale; a prefix there is not an exact hit.
    expect(searchOrder("zh-CN", "carb", "", ALL)).toEqual({ zs: [6], exact: null });
    expect(searchOrder("en", "fe", "noble-gas", ALL).zs).toEqual([]);
    expect(searchOrder("en", "", "halogen", ALL).zs).toEqual([9, 17, 35, 53, 85, 117]);
  });

  it("marks and lists an exact match first in the page, and sorts a new column ascending first", () => {
    const host = document.createElement("div");
    mountElements(host, "en", null);
    const number = host.querySelector<HTMLElement>('.data-sort[data-col="number"]')!;
    expect(number.parentElement!.getAttribute("aria-sort")).toBe("ascending");
    const search = host.querySelector<HTMLInputElement>(".pt-search")!;
    search.value = "ca";
    search.dispatchEvent(new Event("input"));
    const visible = [...host.querySelectorAll<HTMLTableRowElement>(".pt-list tbody tr")].filter((tr) => !tr.hidden);
    expect(visible[0].dataset.z).toBe("20");
    expect(visible[0].classList.contains("pt-hit")).toBe(true);
    expect(host.querySelector('.pt-cell[data-z="20"]')!.classList.contains("pt-hit")).toBe(true);
    expect(host.querySelector('.pt-cell[data-z="1"]')!.classList.contains("pt-dim")).toBe(true);
    search.value = "";
    search.dispatchEvent(new Event("input"));
    const mass = host.querySelector<HTMLButtonElement>('.data-sort[data-col="mass"]')!;
    mass.click();
    expect(mass.parentElement!.getAttribute("aria-sort")).toBe("ascending");
    expect(number.parentElement!.getAttribute("aria-sort")).toBe("none");
    expect(host.querySelector<HTMLTableRowElement>(".pt-list tbody tr")!.dataset.z).toBe("1");
    mass.click();
    expect(mass.parentElement!.getAttribute("aria-sort")).toBe("descending");
    expect(host.querySelector<HTMLTableRowElement>(".pt-list tbody tr")!.dataset.z).toBe("118");
  });
});

describe("periodic table: unmeasured configurations", () => {
  it("says calculated for meitnerium and predicted for darmstadtium, in the facts table and the text", () => {
    const mt = elementsPageHtml("en", "meitnerium");
    expect(mt).toContain("(calculated)");
    expect(mt).not.toContain("predicted");
    expect(mt).toContain("This configuration is calculated, not measured.");
    const ds = elementsPageHtml("en", "darmstadtium");
    expect(ds).toContain("(predicted)");
    expect(ds).not.toContain("calculated");
  });
});
