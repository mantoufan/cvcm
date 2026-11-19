// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { render, start, whenRendered } from "../src/client/app-shell";

function reset(url: string): void {
  document.head.innerHTML = `<title></title><meta name="description" content="old"><link rel="canonical" href="https://cv.cm/">`;
  document.body.innerHTML = `<div id="app"></div>`;
  window.history.pushState(null, "", url);
}

describe("ideas shell", () => {
  it("mounts the hub and an idea with nav, head and JSON-LD, and keeps the page on a locale switch", async () => {
    reset("/en/ideas/");
    start();
    await whenRendered();
    const nav = document.querySelector<HTMLAnchorElement>('.nav a[data-nav="ideas"]');
    expect(nav?.getAttribute("href")).toBe("/en/ideas/");
    expect(nav?.classList.contains("on")).toBe(true);
    // After Nostalgia in the top nav, and linked from the footer directory with its focus ideas.
    const order = [...document.querySelectorAll(".nav a")].map((a) => a.getAttribute("data-nav"));
    expect(order.indexOf("ideas")).toBe(order.indexOf("nostalgia") + 1);
    expect(document.querySelector('.dir a[data-nav="ideas"]')).not.toBeNull();
    expect(document.querySelector('.dir a[data-nav="ideas-vending-machine"]')).not.toBeNull();
    expect(document.querySelector("#ranking table")).not.toBeNull();
    expect(document.getElementById("article-jsonld")?.textContent).toContain("ItemList");

    document.querySelector<HTMLAnchorElement>('main a[data-nav="ideas-laundromat"]')!.click();
    await whenRendered();
    expect(window.location.pathname).toBe("/en/ideas/laundromat/");
    expect(document.title).toMatch(/ — cv\.cm$/);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://cv.cm/en/ideas/laundromat/");
    expect(document.querySelector('meta[property="og:type"]')?.getAttribute("content")).toBe("article");
    expect(document.querySelector(".idea-panel svg")).not.toBeNull();
    expect(document.getElementById("article-jsonld")?.textContent).toContain('"Article"');
    expect(document.getElementById("breadcrumb-jsonld")?.textContent).toContain("BreadcrumbList");
    expect(document.getElementById("faq-jsonld")?.textContent).toContain("FAQPage");
    expect(document.getElementById("howto-jsonld")).toBeNull();

    const select = document.querySelector<HTMLSelectElement>("select.lang")!;
    select.value = "zh-CN";
    select.dispatchEvent(new Event("change"));
    await whenRendered();
    expect(window.location.pathname).toBe("/zh-cn/ideas/laundromat/");
    expect(document.querySelector('.nav a[data-nav="ideas"]')?.textContent).toBe("创意");
    expect(document.querySelector("h1")?.textContent).toMatch(/洗衣/);

    window.history.pushState(null, "", "/en/");
    render();
    await whenRendered();
    expect(document.getElementById("article-jsonld")).toBeNull();
  });
});
