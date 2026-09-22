// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, start } from "../src/client/app-shell";
import { screenReading } from "../src/client/device/ui";

function reset(url: string): void {
  document.head.innerHTML = `<title></title><meta name="description" content="old"><link rel="canonical" href="https://cv.cm/">`;
  document.body.innerHTML = `<div id="app"></div>`;
  window.history.pushState(null, "", url);
}

beforeEach(() => {
  vi.unstubAllGlobals();
  reset("/en/");
});

describe("device shell", () => {
  it("keeps a direct device URL and waits for a click before asking for the IP", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ip: "203.0.113.50" }), {
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    reset("/en/device/ip/");
    start();
    expect(window.location.pathname).toBe("/en/device/ip/");
    expect(fetchMock).not.toHaveBeenCalled();
    document.querySelector<HTMLButtonElement>(".device-show-ip")?.click();
    await vi.waitFor(() => {
      expect(document.querySelector(".device-ip-value")?.textContent).toContain("203.0.113.50");
    });
    expect(document.title).not.toContain("203.0.113.50");
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).not.toContain("203.0.113.50");
    expect(document.getElementById("faq-jsonld")?.textContent).not.toContain("203.0.113.50");
  });

  it("updates head and JSON-LD from a tool to a device page and back home", () => {
    reset("/en/qr/");
    start();
    window.history.pushState(null, "", "/en/device/ip/");
    render();
    expect(document.querySelector("h1")?.textContent).toBe("What is my IP address");
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://cv.cm/en/device/ip/");
    const faq = [...document.querySelectorAll(".faq summary")];
    expect(faq).toHaveLength(5);
    const ld = JSON.parse(document.getElementById("faq-jsonld")?.textContent || "{}") as {
      mainEntity: { name: string }[];
    };
    expect(ld.mainEntity.map((item) => item.name)).toEqual(faq.map((node) => node.textContent));
    expect(document.getElementById("breadcrumb-jsonld")?.textContent).toContain("BreadcrumbList");
    expect(document.getElementById("howto-jsonld")).toBeNull();
    expect(document.getElementById("game-jsonld")).toBeNull();
    window.history.pushState(null, "", "/en/");
    render();
    expect(document.getElementById("breadcrumb-jsonld")).toBeNull();
    expect(document.querySelector('meta[property="og:type"]')?.getAttribute("content")).not.toBe("article");
  });

  it("switches language without leaving the device page", () => {
    reset("/en/device/screen-resolution/");
    start();
    const select = document.querySelector<HTMLSelectElement>("select.lang");
    select!.value = "zh-CN";
    select!.dispatchEvent(new Event("change"));
    expect(window.location.pathname).toBe("/zh-cn/device/screen-resolution/");
    expect(document.querySelector("h1")?.textContent).toBe("我的屏幕分辨率");
  });

  it("restores the previous page on back", () => {
    reset("/en/qr/");
    start();
    const title = document.title;
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href");
    window.history.pushState(null, "", "/en/device/browser/");
    render();
    expect(document.getElementById("breadcrumb-jsonld")).toBeTruthy();
    window.history.pushState(null, "", "/en/qr/");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(document.title).toBe(title);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(canonical);
    expect(document.getElementById("breadcrumb-jsonld")).toBeNull();
  });

  it("changes the pixel estimate with the ratio and keeps the caveat", () => {
    const wide = screenReading("en", { screenW: 1920, screenH: 1080, viewW: 1280, viewH: 720, dpr: 2 });
    const flat = screenReading("en", { screenW: 1920, screenH: 1080, viewW: 1280, viewH: 720, dpr: 1 });
    expect(wide.querySelector("[data-estimate]")?.textContent).toBe("3840×2160");
    expect(flat.querySelector("[data-estimate]")?.textContent).toBe("1920×1080");
    expect(wide.querySelector("[data-caveat]")?.textContent).toMatch(/Zoom and OS scaling/);
  });
});
