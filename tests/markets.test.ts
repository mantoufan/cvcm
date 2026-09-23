import { describe, expect, it } from "vitest";
import zh from "../src/locales/markets/zh-CN.json";
import { LOCALES } from "../src/shared/locale";
import {
  HK_TAEL_G,
  MARKET_PAGES,
  MARKET_TAEL_G,
  TROY_OZ_G,
  TW_TAEL_G,
  companyMarketCap,
  convertWeight,
  dividendYield,
  metalPrices,
  peRatio,
} from "../src/shared/markets";
import { marketCopy } from "../src/shared/markets-i18n";
import { STATIC_FILE, appHref, parseAppPath } from "../src/shared/path";
import { BARREL_GAL, BARREL_L, convertOil } from "../src/shared/markets";
import { applyHtmlSeo, hreflangAlternates, pageTitle } from "../src/shared/seo";
import worker from "../src/worker";

const html = `<!doctype html>
<html lang="en">
  <head>
    <title>cv.cm</title>
    <meta name="description" content="old" />
    <link rel="canonical" href="https://cv.cm/" />
  </head>
  <body><div id="app"></div>
    <noscript><p>cv.cm needs JavaScript.</p></noscript>
  </body>
</html>`;

const BANNED = ["立即购买", "交易所", "钱包", "开户", "实时金价", "今日金价", "怎么买", "司马两"];

describe("markets routes", () => {
  it("parses the hub and the three tools", () => {
    expect(parseAppPath("/en/markets/")).toEqual({ kind: "markets", locale: "en", market: null });
    expect(parseAppPath("/zh-cn/markets/gold/")).toEqual({ kind: "markets", locale: "zh-CN", market: "gold" });
    expect(parseAppPath("/markets/silver")).toEqual({ kind: "bare-markets", market: "silver" });
    expect(parseAppPath("/en/markets/btc/").kind).toBe("unknown");
    expect(parseAppPath("/en/markets/oil/").kind).toBe("unknown");
    expect(parseAppPath("/assets/gold/").kind).toBe("static");
    expect(STATIC_FILE.test("/assets/index.js")).toBe(true);
  });

  it("keeps troy ounces distinct from the avoirdupois ounce", () => {
    expect(TROY_OZ_G).toBe(31.1034768);
    expect(TROY_OZ_G).not.toBeCloseTo(0.028349523125 * 1000, 4);
    expect(HK_TAEL_G).toBe(37.429);
    expect(MARKET_TAEL_G).toBe(50);
    expect(TW_TAEL_G).toBe(37.5);
    expect(convertWeight(1, "troyOz")?.g).toBeCloseTo(31.1034768, 6);
    expect(convertWeight(1, "hkTael")?.g).toBeCloseTo(37.429, 3);
    expect(convertWeight(-1, "g")).toBeNull();
  });

  it("leaves prices blank until the visitor types one", () => {
    expect(metalPrices(31.1034768)?.perGram).toBeCloseTo(1, 6);
    expect(metalPrices(-1)).toBeNull();
    const weights = convertWeight(2, "g");
    expect(weights && "perGram" in weights).toBe(false);
  });

  it("blanks P/E and yield instead of dividing by zero", () => {
    expect(companyMarketCap(10, 100)).toBe(1000);
    expect(companyMarketCap(-1, 10)).toBeNull();
    expect(companyMarketCap(Number.MAX_VALUE, 2)).toBeNull();
    expect(peRatio(10, 0)).toBeNull();
    expect(peRatio(10, 2)).toBe(5);
    expect(dividendYield(0, 1)).toBeNull();
    expect(dividendYield(50, 1)).toBeCloseTo(2, 6);
    expect(BARREL_GAL).toBe(42);
    expect(BARREL_L).toBeCloseTo(158.987294928, 8);
    expect(convertOil(1, "bbl")?.l).toBeCloseTo(158.987294928, 8);
    expect(convertOil(1, "bbl")?.gal).toBe(42);
  });

  it("keeps Chinese copy away from quotes and buy buttons", () => {
    const text = JSON.stringify(zh);
    for (const word of BANNED) expect(text).not.toContain(word);
    expect(text).toContain("香港金衡两");
    expect(text).toContain("市两");
    expect(text).toContain("台两");
    for (const id of MARKET_PAGES) {
      expect(marketCopy("zh-CN", id).a5.length).toBeGreaterThan(8);
    }
  });

  it("points hreflang at the gold page", () => {
    const links = hreflangAlternates("gold");
    expect(links.find((link) => link.hreflang === "x-default")?.href).toBe("https://cv.cm/en/gold/");
    expect(links.find((link) => link.hreflang === "zh-CN")?.href).toBe("https://cv.cm/zh-cn/gold/");
    expect(links).toHaveLength(LOCALES.length + 1);
    expect(pageTitle("en", "gold")).toMatch(/troy ounce/i);
    expect(pageTitle("en", "oil")).toMatch(/barrel/i);
    const out = applyHtmlSeo(html, "zh-CN", "gold");
    expect(out).toContain("黄金金衡盎司换算成克");
    expect(appHref("zh-TW", "stocks")).toBe("/zh-tw/stocks/");
    expect(appHref("en", "platinum")).toBe("/en/platinum/");
  });
});

describe("markets worker", () => {
  it("redirects a bare path and serves the gold title", async () => {
    const bare = await worker.fetch(new Request("https://cv.cm/markets/gold/"), { ASSETS: { fetch: async () => new Response("no") } });
    expect(bare.status).toBe(301);
    expect(bare.headers.get("Location")).toBe("https://cv.cm/en/gold/");

    const assets = { fetch: async () => new Response(html, { headers: { "Content-Type": "text/html" } }) };
    const live = await worker.fetch(new Request("https://cv.cm/en/gold/"), { ASSETS: assets });
    expect(live.status).toBe(200);
    expect(await live.text()).toContain("Gold troy ounce to grams");
  });
});
