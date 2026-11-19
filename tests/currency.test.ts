import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import worker from "../src/worker";
import en from "../src/locales/currency/en.json";
import { LOCALES, type Locale } from "../src/shared/locale";
import { currencyHref, parseAppPath, STATIC_FILE } from "../src/shared/path";
import { CURRENCY_PAIRS, CURRENCY_PUBLISHED, CURRENCY_SNAPSHOT, isCurrencyPair, pairCodes, reversePair } from "../src/shared/currency";
import {
  crossRate,
  currencyData,
  currencyDescription,
  currencyFaqItems,
  currencyMessages,
  currencyName,
  currencyPageJsonLd,
  currencyTitle,
  ecbCodes,
  formatMoney,
  monthRange,
  pairData,
  tableAmounts,
  type CurrencyData,
} from "../src/shared/currency-i18n";
import { registerCurrencyMessages, currencyMessages as packOf } from "../src/shared/messages";
import { currencyPageHtml, resultText } from "../src/shared/currency-page";
import { applyHtmlSeo } from "../src/shared/seo-html";
import { buildSectionSitemaps } from "../src/shared/sitemap";
// @ts-expect-error plain ES module without types
import { buildCurrencySnapshot, parseEcbCsv, snapshotText } from "../scripts/currency-snapshot.mjs";

/** pairData on a stand-in snapshot: registered under a spare pack object and read back, then the real pack restored. */
function buildPairForTest(data: CurrencyData, pair: string) {
  const real = packOf("vi");
  registerCurrencyMessages("vi", { ...real, data });
  try {
    return pairData("vi", pair);
  } finally {
    registerCurrencyMessages("vi", real);
  }
}

const SHELL = `<!doctype html><html lang="en"><head><title>cv.cm</title><meta name="description" content="x" /><link rel="canonical" href="https://cv.cm/" /></head><body><div id="app"></div></body></html>`;
const assets = { fetch: async () => new Response(SHELL, { headers: { "Content-Type": "text/html; charset=utf-8" } }) };

/** A tiny ECB file: three days, USD and JPY, an N/A cell, newest first as the ECB writes it. */
const CSV = [
  "Date,USD,JPY,CNY,",
  "2026-11-17,1.1000,176.00,7.7000,",
  "2026-11-16,1.0000,170.00,N/A,",
  "2025-11-14,1.2500,150.00,8.0000,",
].join("\n");

function paths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([k, v]) => paths(v, prefix ? `${prefix}.${k}` : k));
}
function leaf(tree: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], tree);
}
// {fromNameCap} is {fromName} with a capital first letter: the two count as one placeholder.
const placeholders = (text: unknown): string[] => [...new Set((String(text).match(/\{\w+\}/g) ?? []).map((p) => p.replace("NameCap}", "Name}")))].sort();

describe("currency: snapshot math", () => {
  it("parses the ECB file oldest first and skips N/A", () => {
    const days = parseEcbCsv(CSV);
    expect(days.map((d: { date: string }) => d.date)).toEqual(["2025-11-14", "2026-11-16", "2026-11-17"]);
    expect(days[1].rates).toEqual({ USD: 1, JPY: 170 });
  });

  it("stores rates once per currency and works out cross-rate windows through the euro", () => {
    const snap = buildCurrencySnapshot(CSV, ["usd-jpy", "eur-usd", "jpy-cny"]);
    expect(snap.asOf).toBe("2026-11-17");
    expect(snap.latest).toEqual({ CNY: 7.7, JPY: 176, USD: 1.1 });
    // Only the pairs' currencies, per EUR, by day (last 90 days) and month; N/A cells are left out.
    expect(snap.days).toEqual({ "2026-11-16": { JPY: 170, USD: 1 }, "2026-11-17": { CNY: 7.7, JPY: 176, USD: 1.1 } });
    expect(snap.months).toEqual({ "2025-11": { CNY: 8, JPY: 150, USD: 1.25 }, "2026-11": { CNY: 7.7, JPY: 173, USD: 1.05 } });
    const usdJpy = snap.stats["usd-jpy"];
    expect(usdJpy.start).toBe("2025-11-14");
    expect(usdJpy.all).toMatchObject({ hi: 170, hiOn: "2026-11-16", lo: 120, loOn: "2025-11-14", avg: 150, n: 3, open: 120 });
    // 30 days and one year leave out 2025-11-14.
    expect(usdJpy.d30).toMatchObject({ hi: 170, lo: 160, avg: 165, n: 2 });
    expect(usdJpy.y1.n).toBe(2);
    // A day with no CNY rate is left out of the JPY/CNY stats.
    expect(snap.stats["jpy-cny"].d30.n).toBe(1);
  });

  it("writes the same bytes for the same file, and refuses a pair with no latest rate", () => {
    const pairs = ["usd-jpy", "eur-usd"];
    expect(snapshotText(buildCurrencySnapshot(CSV, pairs))).toBe(snapshotText(buildCurrencySnapshot(CSV, pairs)));
    expect(() => buildCurrencySnapshot(CSV.replace("1.1000,176.00", "N/A,176.00"), ["usd-jpy"])).toThrow(/no USD\/JPY/);
  });

  it("a new ECB day changes only a few lines of the file", () => {
    const pairs = ["usd-jpy", "eur-usd"];
    const before = snapshotText(buildCurrencySnapshot(CSV, pairs)).split("\n");
    const next = CSV.replace("Date,USD,JPY,CNY,\n", "Date,USD,JPY,CNY,\n2026-11-18,1.1100,177.00,7.7100,\n");
    const after = snapshotText(buildCurrencySnapshot(next, pairs)).split("\n");
    const added = after.filter((line: string) => !before.includes(line));
    // asOf, latest, the two pairs' stats, the new day, the day before it (now with a comma), this month.
    expect(added.length).toBeLessThanOrEqual(7);
  });

  it("draws monthly gaps as gaps, keeping every label on its own month", () => {
    const gap = buildCurrencySnapshot(["Date,USD,JPY,", "2026-03-02,1.1,160,", "2026-02-02,N/A,150,", "2026-01-02,1.0,140,"].join("\n"), ["usd-jpy"]);
    const data = { ...currencyData("en"), ...gap };
    const pair = buildPairForTest(data, "usd-jpy");
    expect(pair.monthly).toEqual([["2026-01", 140], ["2026-02", null], ["2026-03", Number((160 / 1.1).toPrecision(5))]]);
    expect(monthRange("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("the committed snapshot covers every pair, ends on its date and has no TWD or VND", () => {
    const data = currencyData("en");
    expect(data.asOf).toBe(CURRENCY_SNAPSHOT);
    expect(Object.keys(data.stats).sort()).toEqual([...CURRENCY_PAIRS].sort());
    expect(new Set(CURRENCY_PAIRS).size).toBe(CURRENCY_PAIRS.length);
    expect(ecbCodes("en")).not.toContain("TWD");
    expect(ecbCodes("en")).not.toContain("VND");
    expect(Object.keys(data.days).sort().at(-1)).toBe(data.asOf);
    for (const pair of CURRENCY_PAIRS) {
      const d = pairData("en", pair);
      const [from, to] = pairCodes(pair);
      expect(d.rate).toBe(Number(crossRate("en", from, to).toPrecision(6)));
      expect(d.daily.at(-1)).toEqual([data.asOf, d.rate]);
      expect(d.monthly[0][0]).toBe(d.start.slice(0, 7));
      expect(d.monthly[0][1]).not.toBeNull();
      for (const key of ["d30", "y1", "y5", "all"] as const) {
        expect(d.stats[key].lo).toBeLessThanOrEqual(d.stats[key].avg);
        expect(d.stats[key].avg).toBeLessThanOrEqual(d.stats[key].hi);
      }
      // The stats' last day agrees with the derived rate.
      expect(d.stats.d30.lo).toBeLessThanOrEqual(d.rate);
      expect(d.stats.d30.hi).toBeGreaterThanOrEqual(d.rate);
    }
  });

  it("rewrites the committed file byte for byte from the same pairs (when the ECB file is at hand)", () => {
    const file = process.env.CURRENCY_CSV;
    if (!file) return;
    const text = snapshotText(buildCurrencySnapshot(readFileSync(file, "utf8"), CURRENCY_PAIRS));
    expect(text).toBe(readFileSync(resolve(__dirname, "../src/shared/currency-data.json"), "utf8"));
  });

  it("scales the conversion tables and echoes small typed amounts", () => {
    expect(tableAmounts(7.3)[0]).toBe(1);
    expect(tableAmounts(0.0067)[0]).toBe(100);
    expect(tableAmounts(0.00005)[0]).toBe(10_000);
    expect(formatMoney("en", 1234.5)).toBe("1,234.50");
    expect(formatMoney("en", 0.006278)).toBe("0.006278");
    expect(resultText("en", 0.001, "USD", "CNY", 6.66612)).toBe("0.001 USD = 0.006666 CNY");
    expect(resultText("es", 1234.5678, "USD", "MXN", 18.4635)).toBe("1234,5678 USD = 22.794,44 MXN");
  });
});

describe("currency: copy", () => {
  it("has every key and the same placeholders in all eight locales", () => {
    const keys = paths({ ...en, names: undefined, titles: undefined }).filter((p) => !p.startsWith("names") && !p.startsWith("titles"));
    for (const locale of LOCALES) {
      const pack = currencyMessages(locale);
      for (const key of keys) {
        expect(leaf(pack, key), `${locale} ${key}`).toBeTypeOf("string");
        expect(placeholders(leaf(pack, key)), `${locale} ${key}`).toEqual(placeholders(leaf(en, key)));
      }
      for (const [pair, title] of Object.entries(pack.titles as Record<string, string>)) {
        expect(isCurrencyPair(pair), `${locale} ${pair}`).toBe(true);
        expect(title).toContain(pair.toUpperCase().replace("-", "/"));
      }
    }
  });

  it("names currencies natively and writes titles people search for", () => {
    expect(currencyName("zh-CN", "CNY")).toBe("人民币");
    expect(currencyTitle("zh-CN", "usd-cny")).toBe("美元兑人民币汇率（USD/CNY）今日、历史走势与换算 — cv.cm");
    expect(currencyTitle("ja", "usd-jpy")).toContain("ドル円");
    expect(currencyTitle("ja", "jpy-cny")).toContain("円/人民元");
    expect(currencyTitle("ko", "usd-krw")).toContain("달러 환율");
    expect(currencyTitle("es", "usd-mxn")).toMatch(/^Dólar a peso mexicano/);
    expect(currencyTitle("es", "eur-usd")).toMatch(/^Euro a dólar estadounidense/);
    expect(currencyTitle("id", "usd-idr")).toMatch(/^Kurs Dolar ke Rupiah/);
  });
});

describe("currency: routes and SEO", () => {
  it("parses locale and bare paths and rejects unknown pairs", () => {
    expect(parseAppPath("/en/currency/")).toEqual({ kind: "currency", locale: "en", pair: null });
    expect(parseAppPath("/zh-cn/currency/usd-cny/")).toEqual({ kind: "currency", locale: "zh-CN", pair: "usd-cny" });
    expect(parseAppPath("/en/currency/USD-CNY/")).toEqual({ kind: "currency", locale: "en", pair: "usd-cny" });
    expect(parseAppPath("/currency/usd-jpy")).toEqual({ kind: "bare-currency", pair: "usd-jpy" });
    expect(parseAppPath("/currency/")).toEqual({ kind: "bare-currency", pair: null });
    expect(parseAppPath("/en/currency/usd-twd/")).toEqual({ kind: "unknown" });
    expect(parseAppPath("/en/currency/usd-cny/x/")).toEqual({ kind: "unknown" });
    expect(currencyHref("zh-TW", "usd-cny")).toBe("/zh-tw/currency/usd-cny/");
    expect(STATIC_FILE.test("/sitemaps/currency.xml")).toBe(true);
    expect(reversePair("usd-cny")).toBe("cny-usd");
    expect(reversePair("usd-krw")).toBeNull();
  });

  it("redirects bare paths to a locale, lowercases and 404s unknown pairs", async () => {
    const bare = await worker.fetch(new Request("https://cv.cm/currency/usd-cny/", { headers: { "Accept-Language": "ja" } }), { ASSETS: assets });
    expect(bare.status).toBe(302);
    expect(bare.headers.get("Location")).toBe("https://cv.cm/ja/currency/usd-cny/");
    const upper = await worker.fetch(new Request("https://cv.cm/zh-CN/currency/USD-CNY/"), { ASSETS: assets });
    expect(upper.status).toBe(301);
    expect(upper.headers.get("Location")).toBe("https://cv.cm/zh-cn/currency/usd-cny/");
    const unknown = await worker.fetch(new Request("https://cv.cm/en/currency/usd-vnd/"), { ASSETS: assets });
    expect(unknown.status).toBe(404);
    const page = await worker.fetch(new Request("https://cv.cm/ko/currency/usd-krw/"), { ASSETS: assets });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('<link rel="canonical" href="https://cv.cm/ko/currency/usd-krw/"');
    for (const id of ["breadcrumb-jsonld", "faq-jsonld", "article-jsonld"]) expect(html).toContain(`id="${id}"`);
    expect(html).toContain("ExchangeRateSpecification");
    expect(html).not.toContain('id="software-jsonld"');
  });

  it("serves hreflang for every locale", () => {
    const html = applyHtmlSeo(SHELL, "es", { currency: true, currencyPair: "usd-mxn" });
    for (const locale of LOCALES) expect(html).toContain(`href="https://cv.cm${currencyHref(locale, "usd-mxn")}"`);
    expect(html).toContain('hreflang="x-default" href="https://cv.cm/en/currency/usd-mxn/"');
  });

  it("has its own sitemap with the snapshot as lastmod", () => {
    const xml = buildSectionSitemaps().currency;
    expect(xml.match(/<url>/g)?.length).toBe(LOCALES.length * (1 + CURRENCY_PAIRS.length));
    expect(xml).toContain(`<lastmod>${[CURRENCY_PUBLISHED, CURRENCY_SNAPSHOT].sort().at(-1)}</lastmod>`);
    // The same day as the pages' JSON-LD dateModified.
    expect(currencyPageJsonLd("en", "usd-cny").dateModified).toBe([CURRENCY_PUBLISHED, CURRENCY_SNAPSHOT].sort().at(-1));
    expect(xml).toContain("https://cv.cm/zh-cn/currency/usd-cny/");
    expect(xml).not.toContain("/zh-CN/");
  });
});

describe("currency: pages", () => {
  it("renders the hub and every pair in every locale with the notice, FAQ and data", () => {
    for (const locale of LOCALES as readonly Locale[]) {
      const hub = currencyPageHtml(locale, null);
      expect(hub).toContain(currencyMessages(locale).notice);
      expect(hub).toContain('class="fx-from"');
      expect(currencyFaqItems(locale, null)).toHaveLength(3);
      expect(currencyPageJsonLd(locale, null)["@type"]).toBe("CollectionPage");
      for (const pair of CURRENCY_PAIRS) {
        const html = currencyPageHtml(locale, pair);
        const [from, to] = pairCodes(pair);
        expect(html, `${locale} ${pair}`).toContain(`1 ${from} = `);
        expect(html).toContain(currencyMessages(locale).notice);
        expect(html.match(/<svg class="fx-chart"/g)).toHaveLength(2);
        expect(html).not.toMatch(/NaN|undefined|Infinity|\{\w+\}/);
        expect(html).toContain(`<th scope="col" class="num">${to}</th>`);
        const faq = currencyFaqItems(locale, pair);
        expect(faq).toHaveLength(3);
        for (const item of faq) expect(item.q + item.a).not.toMatch(/\{\w+\}/);
        expect(currencyTitle(locale, pair)).not.toMatch(/\{\w+\}/);
        expect(currencyDescription(locale, pair)).not.toMatch(/\{\w+\}/);
      }
    }
  }, 60_000);

  it("never links to a trade or a broker", () => {
    const html = currencyPageHtml("en", "usd-cny");
    const external = [...html.matchAll(/href="(https?:[^"]+)"/g)].map((m) => new URL(m[1]).host);
    expect(new Set(external)).toEqual(new Set(["www.ecb.europa.eu"]));
  });
});

describe("currency: chart text alternative", () => {
  it("phrases month-only dates as months", () => {
    const en = currencyPageHtml("en", "usd-cny");
    expect(en).toMatch(/aria-label="Line chart of USD\/CNY: [^"]* in [A-Z][a-z]+ \d{4}, /);
    expect(en).not.toMatch(/aria-label="[^"]* on [A-Z][a-z]+ \d{4}, /);
    const es = currencyPageHtml("es", "usd-cny");
    expect(es).not.toMatch(/ el [a-z]+ de \d{4}/);
  });
});
