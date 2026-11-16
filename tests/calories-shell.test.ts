// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { render, start, whenRendered } from "../src/client/app-shell";

function reset(url: string): void {
  document.head.innerHTML = `<title></title><meta name="description" content="old"><link rel="canonical" href="https://cv.cm/">`;
  document.body.innerHTML = `<div id="app"></div>`;
  window.history.pushState(null, "", url);
}

describe("calories shell", () => {
  it("mounts the hub and a food with head and JSON-LD, filters, calculates, keeps the page on a locale switch", async () => {
    reset("/en/calories/");
    start();
    await whenRendered();
    expect(document.title).toMatch(/^Calories in Food/);
    expect(document.querySelector('.dir a[data-nav="calories"]')).not.toBeNull();
    expect(document.querySelector('.dir a[data-nav="food-banana"]')?.textContent).toBe("Banana");
    expect(document.getElementById("article-jsonld")?.textContent).toContain("ItemList");
    const search = document.querySelector<HTMLInputElement>("main .data-search")!;
    search.value = "kimchi";
    search.dispatchEvent(new Event("input"));
    const visible = [...document.querySelectorAll<HTMLTableRowElement>("main tbody tr")].filter((tr) => !tr.hidden);
    expect(visible.map((tr) => tr.dataset.group)).toEqual(["vegetables"]);

    document.querySelector<HTMLAnchorElement>('main a[data-nav="food-white-rice-cooked"]')!.click();
    await whenRendered();
    expect(window.location.pathname).toBe("/en/calories/white-rice-cooked/");
    expect(document.title).toMatch(/^Calories in White Rice \(Cooked\): 130 kcal/);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://cv.cm/en/calories/white-rice-cooked/");
    expect(document.getElementById("faq-jsonld")?.textContent).toContain("FAQPage");
    const grams = document.querySelector<HTMLInputElement>("main .cal-grams")!;
    expect(grams.value).toBe("158");
    grams.value = "200";
    grams.dispatchEvent(new Event("input"));
    expect(document.querySelector("main .cal-out")?.textContent).toContain("260 kcal");

    const select = document.querySelector<HTMLSelectElement>("select.lang")!;
    select.value = "ja";
    select.dispatchEvent(new Event("change"));
    await whenRendered();
    expect(window.location.pathname).toBe("/ja/calories/white-rice-cooked/");
    expect(document.title).toMatch(/のカロリー/);

    window.history.pushState(null, "", "/ja/tdee/");
    render();
    await whenRendered();
    expect(document.getElementById("article-jsonld")).toBeNull();
    expect(document.querySelector('main a[data-nav="calories"]')).not.toBeNull();
  });
});
