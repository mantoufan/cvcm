// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { render, start, whenRendered } from "../src/client/app-shell";

function reset(url: string): void {
  document.head.innerHTML = `<title></title><meta name="description" content="old"><link rel="canonical" href="https://cv.cm/">`;
  document.body.innerHTML = `<div id="app"></div>`;
  window.history.pushState(null, "", url);
}

describe("reference shell", () => {
  it("mounts the hub and an entry with nav, head and JSON-LD, and keeps the page on a locale switch", async () => {
    reset("/en/reference/");
    start();
    await whenRendered();
    const nav = document.querySelector<HTMLAnchorElement>('.nav a[data-nav="reference"]');
    expect(nav?.getAttribute("href")).toBe("/en/reference/");
    expect(nav?.classList.contains("on")).toBe(true);
    // After Data in the top nav, and linked from the footer directory.
    const order = [...document.querySelectorAll(".nav a")].map((a) => a.getAttribute("data-nav"));
    expect(order.indexOf("reference")).toBe(order.indexOf("datasets") + 1);
    // Reference, memes and nostalgia sit under one "Wiki" menu: one button on the row, the three links in its markup.
    const group = nav!.closest(".nav-group")!;
    expect(group.querySelector(".nav-group-label")?.textContent).toBe("Wiki");
    expect(group.querySelector(".nav-group-btn")?.classList.contains("on")).toBe(true);
    expect(group.classList.contains("on")).toBe(true);
    expect([...group.querySelectorAll(".nav-group-pop a")].map((a) => a.getAttribute("data-nav"))).toEqual(["reference", "slang", "nostalgia"]);
    // A native <details>: works in the server HTML and without JS; a tap outside or Escape closes it.
    const details = group as HTMLDetailsElement;
    expect(details.tagName).toBe("DETAILS");
    expect(details.open).toBe(false);
    details.open = true;
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(details.open).toBe(false);
    // A tap inside the menu keeps it open.
    details.open = true;
    group.querySelector(".nav-group-pop")!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(details.open).toBe(true);
    details.open = true;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(details.open).toBe(false);
    expect(document.querySelector('.nav > a[data-nav="ideas"]')).not.toBeNull();
    expect(document.querySelector('.dir a[data-nav="reference"]')).not.toBeNull();
    expect(document.getElementById("article-jsonld")?.textContent).toContain("CollectionPage");

    document.querySelector<HTMLAnchorElement>('a[data-nav="ref-wink"]')!.click();
    await whenRendered();
    expect(window.location.pathname).toBe("/en/reference/wink/");
    expect(document.title).toMatch(/ — cv\.cm$/);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://cv.cm/en/reference/wink/");
    expect(document.querySelector('meta[property="og:type"]')?.getAttribute("content")).toBe("article");
    expect(document.querySelector(".ref-photos")).not.toBeNull();
    expect(document.getElementById("article-jsonld")?.textContent).toContain('"Article"');
    expect(document.getElementById("breadcrumb-jsonld")?.textContent).toContain("BreadcrumbList");

    const select = document.querySelector<HTMLSelectElement>("select.lang")!;
    select.value = "zh-CN";
    select.dispatchEvent(new Event("change"));
    await whenRendered();
    expect(window.location.pathname).toBe("/zh-cn/reference/wink/");
    expect(document.querySelector('.nav a[data-nav="reference"]')?.textContent).toBe("姿势参考");

    window.history.pushState(null, "", "/en/");
    render();
    await whenRendered();
    expect(document.getElementById("article-jsonld")).toBeNull();
  });
});
