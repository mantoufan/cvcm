import { describe, expect, it } from "vitest";
import uiSource from "../src/client/device/ui.ts?raw";
import { describeClient, estimatedDevicePixels, isIpAddress, parseUserAgent } from "../src/shared/device";
import { deviceFaqItems, deviceFaqJsonLd, devicePageCopy, deviceStaticHtml } from "../src/shared/device-i18n";
import { LOCALES } from "../src/shared/locale";
import { deviceHref, parseAppPath } from "../src/shared/path";
import { applyHtmlSeo, pageTitle } from "../src/shared/seo";
import { buildSitemapXml } from "../src/shared/sitemap";
import worker from "../src/worker";
import en from "../src/locales/device/en.json";
import es from "../src/locales/device/es.json";
import id from "../src/locales/device/id.json";
import ja from "../src/locales/device/ja.json";
import ko from "../src/locales/device/ko.json";
import vi from "../src/locales/device/vi.json";
import zhCN from "../src/locales/device/zh-CN.json";
import zhTW from "../src/locales/device/zh-TW.json";

const SHELL = `<!doctype html><html lang="en"><head><title>cv.cm</title><meta name="description" content="old" /><link rel="canonical" href="https://cv.cm/" /></head><body><div id="app"></div></body></html>`;
const assets = { fetch: async () => new Response(SHELL, { headers: { "content-type": "text/html; charset=utf-8" } }) };

function keys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key));
}

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const EDGE = `${CHROME} Edg/120.0.2210.91`;
const OPERA = `${CHROME} OPR/106.0.0.0`;
const FIREFOX = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0";
const SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15";
const CRIOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1";

describe("device routes", () => {
  it("parses locale, bare, and unknown slugs", () => {
    expect(parseAppPath("/en/device/")).toEqual({ kind: "device", locale: "en", page: "hub" });
    expect(parseAppPath("/zh-cn/device/ip/")).toEqual({ kind: "device", locale: "zh-CN", page: "ip" });
    expect(parseAppPath("/device/ip")).toEqual({ kind: "bare-device", page: "ip" });
    expect(parseAppPath("/en/device/gpu/")).toEqual({ kind: "unknown" });
    expect(deviceHref("zh-CN", "screen")).toBe("/zh-cn/device/screen-resolution/");
  });
});

describe("device copy", () => {
  it("keeps locale keys and the screen caveat", () => {
    const baseline = keys(en).sort();
    for (const file of [zhCN, zhTW, ja, ko, vi, id, es]) expect(keys(file).sort()).toEqual(baseline);
    expect(pageTitle("en", { devicePage: "ip" })).toMatch(/what is my IP address/i);
    expect(pageTitle("zh-CN", { devicePage: "ip" })).toMatch(/我的 IP 地址/);
    expect(pageTitle("en", { devicePage: "screen" })).toMatch(/screen resolution/i);
    expect(pageTitle("en", { devicePage: "screen" })).not.toMatch(/physical resolution/i);
    expect(devicePageCopy("en", "screen").readBody).toMatch(/Zoom and OS scaling/);
    expect(devicePageCopy("zh-CN", "screen").readBody).toMatch(/缩放/);
  });

  it("matches FAQ JSON-LD to visible questions", () => {
    for (const locale of LOCALES) {
      for (const page of ["hub", "ip", "browser", "screen", "ua"] as const) {
        const items = deviceFaqItems(locale, page);
        expect(items).toHaveLength(5);
        const ld = deviceFaqJsonLd(locale, page);
        const entities = ld.mainEntity as { name: string; acceptedAnswer: { text: string } }[];
        expect(entities.map((item) => item.name)).toEqual(items.map((item) => item.q));
        expect(entities.map((item) => item.acceptedAnswer.text)).toEqual(items.map((item) => item.a));
        const html = deviceStaticHtml(locale, page);
        expect(html).toContain(`<h1>${devicePageCopy(locale, page).h1}</h1>`);
        expect(html).not.toContain("HowTo");
      }
    }
  });
});

describe("device parsers", () => {
  it("checks addresses and browser order", () => {
    expect(isIpAddress("203.0.113.10")).toBe(true);
    expect(isIpAddress("2001:db8::1")).toBe(true);
    expect(isIpAddress("203.0.113.10\n")).toBe(false);
    expect(isIpAddress("1.2.3.4<script>")).toBe(false);
    expect(isIpAddress("8.8.8.8, 1.2.3.4")).toBe(false);
    expect(isIpAddress("")).toBe(false);
    expect(parseUserAgent(EDGE).browser).toBe("edge");
    expect(parseUserAgent(OPERA).browser).toBe("opera");
    expect(parseUserAgent(CRIOS)).toMatchObject({ browser: "chrome", platform: "ios" });
    expect(parseUserAgent(FIREFOX).browser).toBe("firefox");
    expect(parseUserAgent(CHROME)).toMatchObject({ browser: "chrome", platform: "windows" });
    expect(parseUserAgent(SAFARI, { maxTouchPoints: 0 })).toMatchObject({ platform: "macos", platformSource: "ua" });
    expect(parseUserAgent(SAFARI, { maxTouchPoints: 5 })).toMatchObject({ platform: "ipad", platformSource: "touch" });
    expect(describeClient(CHROME, { brands: [{ brand: "Microsoft Edge", version: "121.0.1" }], platform: "macOS" })).toMatchObject({
      browser: "edge", version: "121.0.1", platform: "macos", platformSource: "hint",
    });
    expect(estimatedDevicePixels(1920, 1080, 2)).toEqual({ width: 3840, height: 2160 });
  });
});

describe("device worker", () => {
  it("redirects device URLs and keeps the IP out of HTML", async () => {
    const bare = await worker.fetch(new Request("https://cv.cm/device/ip"), { ASSETS: assets });
    expect(bare.status).toBe(302);
    expect(bare.headers.get("Location")).toMatch(/\/device\/ip\/$/);
    const slash = await worker.fetch(new Request("https://cv.cm/EN/device/IP"), { ASSETS: assets });
    expect(slash.status).toBe(301);
    expect(slash.headers.get("Location")).toBe("https://cv.cm/en/device/ip/");
    const unknown = await worker.fetch(new Request("https://cv.cm/en/device/gpu/"), { ASSETS: assets });
    expect(unknown.status).toBe(302);
    expect(unknown.headers.get("Location")).toBe("https://cv.cm/en/");
    const html = await worker.fetch(new Request("https://cv.cm/en/device/ip/", { headers: { "CF-Connecting-IP": "203.0.113.50" } }), { ASSETS: assets });
    const body = await html.text();
    expect(body).not.toContain("203.0.113.50");
    expect(body).toContain("Show the address for this request");
    expect(body).toContain("<h1>What is my IP address</h1>");
    expect(applyHtmlSeo(SHELL, "en", { devicePage: "ip" })).not.toContain("HowTo");
  });

  it("returns only the edge address and does not cache it", async () => {
    const first = await worker.fetch(new Request("https://cv.cm/api/device/ip?ip=8.8.8.8", {
      headers: { "CF-Connecting-IP": "203.0.113.10", "X-Forwarded-For": "1.1.1.1" },
    }), { ASSETS: assets });
    const second = await worker.fetch(new Request("https://cv.cm/api/device/ip", {
      headers: { "CF-Connecting-IP": "2001:db8::1" },
    }), { ASSETS: assets });
    expect(await first.json()).toEqual({ ip: "203.0.113.10" });
    expect(await second.json()).toEqual({ ip: "2001:db8::1" });
    for (const response of [first, second]) {
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(response.headers.get("CDN-Cache-Control")).toBe("no-store");
      expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    }
    const junk = await worker.fetch(new Request("https://cv.cm/api/device/ip", {
      headers: { "CF-Connecting-IP": "1.2.3.4<script>" },
    }), { ASSETS: assets });
    const junkText = await junk.text();
    expect(JSON.parse(junkText)).toEqual({ ip: "" });
    expect(junkText).not.toContain("<script>");
    const head = await worker.fetch(new Request("https://cv.cm/api/device/ip", { method: "HEAD", headers: { "CF-Connecting-IP": "203.0.113.10" } }), { ASSETS: assets });
    expect(await head.text()).toBe("");
    expect(head.headers.get("Cache-Control")).toBe("private, no-store");
    const post = await worker.fetch(new Request("https://cv.cm/api/device/ip", { method: "POST" }), { ASSETS: assets });
    expect(post.status).toBe(405);
  });
});

describe("device sitemap", () => {
  it("points hreflang at the same device page", () => {
    const xml = buildSitemapXml("2026-09-22");
    expect(xml).not.toContain("/api/device/ip");
    for (const page of ["hub", "ip", "browser", "screen", "ua"] as const) {
      const loc = `https://cv.cm${deviceHref("zh-CN", page)}`;
      const block = xml.split("<url>").find((part) => part.includes(`<loc>${loc}</loc>`));
      expect(block, page).toBeTruthy();
      expect(block).toContain(`hreflang="zh-CN" href="${loc}"`);
      expect(block).toContain(`hreflang="en" href="https://cv.cm${deviceHref("en", page)}"`);
      expect(block).toContain(`hreflang="x-default" href="https://cv.cm${deviceHref("en", page)}"`);
      expect(block).not.toContain('hreflang="zh-CN" href="https://cv.cm/zh-cn/"');
    }
  });
});

describe("device ui source", () => {
  it("does not read fingerprint or location APIs", () => {
    expect(uiSource).not.toContain("RTCPeerConnection");
    expect(uiSource).not.toContain("getCurrentPosition");
    expect(uiSource).not.toContain("getUserMedia");
    expect(uiSource).not.toContain("deviceMemory");
    expect(uiSource).not.toMatch(/getHighEntropyValues\([^)]*model/);
  });
});
