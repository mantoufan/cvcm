// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { render, start, whenRendered } from "../src/client/app-shell";

function reset(url: string): void {
  document.head.innerHTML = `<title></title><meta name="description" content="old"><link rel="canonical" href="https://cv.cm/">`;
  document.body.innerHTML = `<div id="app"></div>`;
  window.history.pushState(null, "", url);
}

describe("nostalgia shell", () => {
  it("mounts the hub and an entry with nav, head and JSON-LD, keeps the page on a locale switch and clears it on leaving", async () => {
    reset("/en/nostalgia/");
    start();
    await whenRendered();
    const nav = document.querySelector<HTMLAnchorElement>('.nav a[data-nav="nostalgia"]');
    expect(nav?.getAttribute("href")).toBe("/en/nostalgia/");
    expect(nav?.classList.contains("on")).toBe(true);
    // Right after Ideas in the top nav, and linked from the footer directory with its focus entries.
    const order = [...document.querySelectorAll(".nav a")].map((a) => a.getAttribute("data-nav"));
    expect(order.indexOf("nostalgia")).toBe(order.indexOf("ideas") + 1);
    expect(document.querySelector('.nav a[data-nav="slang"]')?.classList.contains("on")).toBe(false);
    expect(document.querySelector('.dir a[data-nav="nostalgia"]')).not.toBeNull();
    expect(document.querySelector('.dir a[data-nav="nostalgia-famicom"]')?.textContent).toBe("Famicom (NES)");
    expect(document.getElementById("article-jsonld")?.textContent).toContain("ItemList");

    document.querySelector<HTMLAnchorElement>('main a[data-nav="nostalgia-pager"]')!.click();
    await whenRendered();
    expect(window.location.pathname).toBe("/en/nostalgia/pager/");
    expect(document.title).toMatch(/ — cv\.cm$/);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://cv.cm/en/nostalgia/pager/");
    expect(document.querySelector('meta[property="og:type"]')?.getAttribute("content")).toBe("article");
    expect(document.querySelector(".kb-answer")).not.toBeNull();
    expect(document.getElementById("article-jsonld")?.textContent).toContain('"Thing"');
    expect(document.getElementById("breadcrumb-jsonld")?.textContent).toContain("BreadcrumbList");

    const select = document.querySelector<HTMLSelectElement>("select.lang")!;
    select.value = "zh-CN";
    select.dispatchEvent(new Event("change"));
    await whenRendered();
    expect(window.location.pathname).toBe("/zh-cn/nostalgia/pager/");
    expect(document.querySelector('.nav a[data-nav="nostalgia"]')?.textContent).toBe("怀旧");
    expect(document.querySelector("h1")?.textContent).toMatch(/BP机|传呼机/);

    window.history.pushState(null, "", "/zh-cn/");
    render();
    await whenRendered();
    expect(document.getElementById("article-jsonld")).toBeNull();
    expect(document.querySelector('.nav a[data-nav="nostalgia"]')?.classList.contains("on")).toBe(false);
  });
});
