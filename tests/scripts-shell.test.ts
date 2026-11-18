// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { render, start, whenRendered } from "../src/client/app-shell";

function reset(url: string): void {
  document.head.innerHTML = `<title></title><meta name="description" content="old"><link rel="canonical" href="https://cv.cm/">`;
  document.body.innerHTML = `<div id="app"></div>`;
  window.history.pushState(null, "", url);
}

describe("scripts shell", () => {
  it("mounts the hub, a script and the generator with nav, head and JSON-LD, keeps the page on a locale switch and clears it on leaving", async () => {
    reset("/en/scripts/");
    start();
    await whenRendered();
    const nav = document.querySelector<HTMLAnchorElement>('.nav a[data-nav="scripts"]');
    expect(nav?.getAttribute("href")).toBe("/en/scripts/");
    expect(nav?.classList.contains("on")).toBe(true);
    // Right after Summaries in the top nav, and linked from the footer directory with its focus entries.
    const order = [...document.querySelectorAll(".nav a")].map((a) => a.getAttribute("data-nav"));
    expect(order.indexOf("scripts")).toBe(order.indexOf("summaries") + 1);
    expect(document.querySelector('.dir a[data-nav="scripts"]')).not.toBeNull();
    expect(document.querySelector('.dir a[data-nav="scripts-the-breakup-scene"]')?.textContent).toBe("The Breakup Scene");
    expect(document.getElementById("article-jsonld")?.textContent).toContain("ItemList");

    document.querySelector<HTMLAnchorElement>('main a[data-nav="scripts-the-breakup-scene"]')!.click();
    await whenRendered();
    expect(window.location.pathname).toBe("/en/scripts/the-breakup-scene/");
    expect(document.title).toMatch(/ — cv\.cm$/);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://cv.cm/en/scripts/the-breakup-scene/");
    expect(document.querySelector('meta[property="og:type"]')?.getAttribute("content")).toBe("article");
    expect(document.querySelector(".script-body .sc-line")).not.toBeNull();
    // Copy buttons stay hidden in the crawler copy and show once the page script has wired them.
    expect(document.querySelector<HTMLButtonElement>("button[data-copy]")?.hidden).toBe(false);
    expect(document.getElementById("article-jsonld")?.textContent).toContain('"CreativeWork"');

    window.history.pushState(null, "", "/en/scripts/plot-generator/");
    render();
    await whenRendered();
    const out = document.querySelector("[data-gen-out]");
    expect(out?.textContent).toMatch(/\w/);
    expect(document.querySelector<HTMLElement>("[data-gen-controls]")?.hidden).toBe(false);
    document.querySelector<HTMLButtonElement>("[data-gen-roll]")!.click();
    expect(out?.textContent).not.toMatch(/\{[a-z]+\}/);
    expect(document.getElementById("article-jsonld")?.textContent).toContain("WebApplication");

    const select = document.querySelector<HTMLSelectElement>("select.lang")!;
    select.value = "zh-CN";
    select.dispatchEvent(new Event("change"));
    await whenRendered();
    expect(window.location.pathname).toBe("/zh-cn/scripts/plot-generator/");
    expect(document.querySelector('.nav a[data-nav="scripts"]')?.textContent).toBe("灵感剧本库");

    window.history.pushState(null, "", "/zh-cn/");
    render();
    await whenRendered();
    expect(document.getElementById("article-jsonld")).toBeNull();
    expect(document.querySelector('.nav a[data-nav="scripts"]')?.classList.contains("on")).toBe(false);
  });
});
