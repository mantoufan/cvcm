// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { render, start, whenRendered } from "../src/client/app-shell";

function reset(url: string): void {
  document.head.innerHTML = `<title></title><meta name="description" content="old"><link rel="canonical" href="https://cv.cm/">`;
  document.body.innerHTML = `<div id="app"></div>`;
  window.history.pushState(null, "", url);
}

describe("summaries shell", () => {
  it("mounts the hub and a work with nav, head and JSON-LD, keeps the page on a locale switch and clears it on leaving", async () => {
    reset("/en/summaries/");
    start();
    await whenRendered();
    const nav = document.querySelector<HTMLAnchorElement>('.nav a[data-nav="summaries"]');
    expect(nav?.getAttribute("href")).toBe("/en/summaries/");
    expect(nav?.classList.contains("on")).toBe(true);
    // Right after Nostalgia in the top nav, and linked from the footer directory with its focus works.
    const order = [...document.querySelectorAll(".nav a")].map((a) => a.getAttribute("data-nav"));
    expect(order.indexOf("summaries")).toBe(order.indexOf("nostalgia") + 1);
    expect(document.querySelector('.nav a[data-nav="nostalgia"]')?.classList.contains("on")).toBe(false);
    expect(document.querySelector('.dir a[data-nav="summaries"]')).not.toBeNull();
    expect(document.querySelector('.dir a[data-nav="summaries-hamlet"]')?.textContent).toBe("Hamlet");
    expect(document.getElementById("article-jsonld")?.textContent).toContain("ItemList");

    document.querySelector<HTMLAnchorElement>('main a[data-nav="summaries-hamlet"]')!.click();
    await whenRendered();
    expect(window.location.pathname).toBe("/en/summaries/hamlet/");
    expect(document.title).toMatch(/ — cv\.cm$/);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://cv.cm/en/summaries/hamlet/");
    expect(document.querySelector('meta[property="og:type"]')?.getAttribute("content")).toBe("article");
    expect(document.querySelector(".kb-answer")).not.toBeNull();
    expect(document.querySelector(".summary-check details")).not.toBeNull();
    expect(document.getElementById("article-jsonld")?.textContent).toContain('"Book"');
    expect(document.getElementById("breadcrumb-jsonld")?.textContent).toContain("BreadcrumbList");

    const select = document.querySelector<HTMLSelectElement>("select.lang")!;
    select.value = "zh-CN";
    select.dispatchEvent(new Event("change"));
    await whenRendered();
    expect(window.location.pathname).toBe("/zh-cn/summaries/hamlet/");
    expect(document.querySelector('.nav a[data-nav="summaries"]')?.textContent).toBe("一口气看完");
    expect(document.querySelector(".device-crumb")?.textContent).toContain("一口气看完");

    window.history.pushState(null, "", "/zh-cn/");
    render();
    await whenRendered();
    expect(document.getElementById("article-jsonld")).toBeNull();
    expect(document.querySelector('.nav a[data-nav="summaries"]')?.classList.contains("on")).toBe(false);
  });
});
