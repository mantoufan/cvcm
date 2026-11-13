// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { render, start, whenRendered } from "../src/client/app-shell";

function reset(url: string): void {
  document.head.innerHTML = `<title></title><meta name="description" content="old"><link rel="canonical" href="https://cv.cm/">`;
  document.body.innerHTML = `<div id="app"></div>`;
  window.history.pushState(null, "", url);
}

describe("slang shell", () => {
  it("mounts the hub and an entry with nav, head and JSON-LD, and keeps the page on a locale switch", async () => {
    reset("/en/memes/");
    start();
    await whenRendered();
    const nav = document.querySelector<HTMLAnchorElement>('.nav a[data-nav="slang"]');
    expect(nav?.getAttribute("href")).toBe("/en/memes/");
    expect(nav?.classList.contains("on")).toBe(true);
    // After Reference in the top nav, and linked from the footer directory with its focus terms.
    const order = [...document.querySelectorAll(".nav a")].map((a) => a.getAttribute("data-nav"));
    expect(order.indexOf("slang")).toBe(order.indexOf("reference") + 1);
    expect(document.querySelector('.dir a[data-nav="slang"]')).not.toBeNull();
    expect(document.querySelector('.dir a[data-nav="slang-tung-tung-tung-sahur"]')?.textContent).toBe("Tung Tung Tung Sahur");
    expect(document.querySelector('.dir a[data-nav="slang-hajimi"]')).not.toBeNull();
    expect(document.getElementById("article-jsonld")?.textContent).toContain("DefinedTermSet");

    document.querySelector<HTMLAnchorElement>('main a[data-nav="slang-yyds"]')!.click();
    await whenRendered();
    expect(window.location.pathname).toBe("/en/memes/yyds/");
    expect(document.title).toMatch(/ — cv\.cm$/);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://cv.cm/en/memes/yyds/");
    expect(document.querySelector('meta[property="og:type"]')?.getAttribute("content")).toBe("article");
    expect(document.querySelector(".kb-answer")).not.toBeNull();
    expect(document.getElementById("article-jsonld")?.textContent).toContain("DefinedTerm");
    expect(document.getElementById("breadcrumb-jsonld")?.textContent).toContain("BreadcrumbList");

    const select = document.querySelector<HTMLSelectElement>("select.lang")!;
    select.value = "zh-CN";
    select.dispatchEvent(new Event("change"));
    await whenRendered();
    expect(window.location.pathname).toBe("/zh-cn/memes/yyds/");
    expect(document.querySelector('.nav a[data-nav="slang"]')?.textContent).toBe("热梗");
    expect(document.querySelector("h1")?.textContent).toMatch(/yyds/i);

    window.history.pushState(null, "", "/en/");
    render();
    await whenRendered();
    expect(document.getElementById("article-jsonld")).toBeNull();
  });
});
