// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, start, whenRendered } from "../src/client/app-shell";

function reset(url: string): void {
  document.head.innerHTML = `<title></title><meta name="description" content="old"><link rel="canonical" href="https://cv.cm/">`;
  document.body.innerHTML = `<div id="app"></div>`;
  window.history.pushState(null, "", url);
}

beforeEach(() => {
  vi.unstubAllGlobals();
  reset("/en/");
});

describe("language links", () => {
  it("marks the page's locale in the picker and links this page in every locale from the footer", async () => {
    reset("/ko/qr/");
    start();
    await whenRendered();
    const select = document.querySelector<HTMLSelectElement>("select.lang");
    expect(select?.value).toBe("ko");
    expect([...(select?.options ?? [])].filter((o) => o.hasAttribute("selected")).map((o) => o.value)).toEqual(["ko"]);
    const links = [...document.querySelectorAll<HTMLAnchorElement>("nav.foot-langs a")];
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/en/qr/", "/zh-cn/qr/", "/zh-tw/qr/", "/ja/qr/", "/vi/qr/", "/id/qr/", "/es/qr/"]);
    expect(links.map((a) => a.hreflang)).toEqual(["en", "zh-CN", "zh-TW", "ja", "vi", "id", "es"]);
    // The page's own locale is plain text, so clicking it cannot remount the page.
    expect(document.querySelector('nav.foot-langs [aria-current="page"]')?.tagName).toBe("SPAN");
    expect(document.querySelector('nav.foot-langs [aria-current="page"]')?.getAttribute("lang")).toBe("ko");
  });

  it("carries the current query along on click", async () => {
    reset("/en/qr/");
    start();
    await whenRendered();
    window.history.replaceState(null, "", "/en/qr/?text=hi");
    document.querySelector<HTMLAnchorElement>('nav.foot-langs a[hreflang="ja"]')?.click();
    await whenRendered();
    expect(window.location.pathname + window.location.search).toBe("/ja/qr/?text=hi");
    // The link itself keeps the clean URL for crawlers and new tabs.
    expect(document.querySelector('nav.foot-langs a[hreflang="en"]')?.getAttribute("href")).toBe("/en/qr/");
  });

  it("leaves the links off clip notes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    reset("/en/clip/abc/");
    render();
    await whenRendered();
    expect(document.querySelector("nav.foot-langs")).toBeNull();
  });
});
