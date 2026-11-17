import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import worker from "../src/worker";
import en from "../src/locales/countries/en.json";
import { LOCALES } from "../src/shared/locale";
import { messages } from "../src/shared/messages";
import "../src/shared/messages-all";
import { preloadLocalePack } from "../src/shared/locale-preload";
import { countriesHref, parseAppPath } from "../src/shared/path";
import { COUNTRIES_FOCUS, COUNTRIES_UPDATED, COUNTRY_LIST, countryBucket, countryCode, isCountrySlug } from "../src/shared/countries";
import { COUNTRY_BUCKET_LOADERS } from "../src/shared/countries/loaders";
import { countriesMessages, countryDetail } from "../src/shared/countries-store";
import { countriesCollectionJsonLd, countryDescription, countryFaqItems, countryName, countryTitle } from "../src/shared/countries-i18n";
import { countriesPageHtml, zonesText } from "../src/shared/countries-page";
import { pageCanonical, pageTitle } from "../src/shared/seo";
import { applyHtmlSeo } from "../src/shared/seo-html";
import { buildSitemapXml, sitemapPages } from "../src/shared/sitemap";
import { DATASETS } from "../src/shared/datasets";
// @ts-expect-error plain ESM script without types
import { buildCountries, COUNTRY_BUCKETS, serialize } from "../scripts/countries-sync.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHELL = `<!doctype html><html lang="en"><head><title>cv.cm</title><meta name="description" content="x" /><link rel="canonical" href="https://cv.cm/" /></head><body><div id="app"></div></body></html>`;
const read = (path: string): string => readFileSync(join(root, path), "utf8");

function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keyPaths(v, prefix ? `${prefix}.${k}` : k));
}

function strings(value: unknown, prefix = ""): [string, string][] {
  if (typeof value === "string") return [[prefix, value]];
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([k, v]) => strings(v, prefix ? `${prefix}.${k}` : k));
}

const placeholders = (text: string): string[] => [...new Set(text.match(/\{\w+\}/g) ?? [])].map((p) => (p === "{The}" ? "{the}" : p)).sort();

describe("countries: data (run `npm run countries:sync` after a data refresh)", () => {
  it("has the generated files in step with the snapshots", () => {
    const { index, summary, buckets } = buildCountries();
    expect(read("src/shared/countries-index.json")).toBe(serialize(index));
    expect(read("src/shared/countries/summary.json")).toBe(serialize(summary));
    buckets.forEach((bucket: unknown, n: number) => expect(read(`src/shared/countries/b${n}.json`)).toBe(serialize(bucket)));
  });

  it("loads every bucket the sync writes, and finds each country in its bucket", () => {
    expect(COUNTRY_BUCKET_LOADERS.length).toBe(COUNTRY_BUCKETS);
    for (const slug of COUNTRY_LIST) {
      const code = countryCode(slug);
      expect(Object.keys(JSON.parse(read(`src/shared/countries/b${countryBucket(code)}.json`)))).toContain(code);
      expect(countryDetail(code).v.population ?? countryDetail(code).v.gdp, slug).toBeTruthy();
    }
  });

  it("has a page for every economy in the World Bank tables, with stable lowercase slugs", () => {
    expect(COUNTRY_LIST.length).toBeGreaterThan(200);
    for (const slug of COUNTRY_LIST) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(countryCode("japan")).toBe("JP");
    expect(countryCode("united-states")).toBe("US");
    expect(countryCode("us-virgin-islands")).toBe("VI");
    expect(countryCode("dr-congo")).toBe("CD");
    expect(countryCode("republic-of-the-congo")).toBe("CG");
    expect(COUNTRIES_FOCUS.every(isCountrySlug)).toBe(true);
  });

  it("names no capital where it is disputed, and every flag it lists exists", () => {
    const summary = countriesMessages("en").summary.countries;
    for (const code of ["IL", "PS", "XK", "YE"]) expect(summary[code].cap).toEqual([]);
    expect(summary.ZA.cap.length).toBe(3);
    expect(summary.BO.cap.length).toBe(2);
    expect(summary.TW).toBeUndefined();
    expect(summary.JP.cap[0]).toMatchObject({ en: "Tokyo" });
    for (const [code, c] of Object.entries(summary)) {
      if (c.flag) expect(() => read(`public/flags/${code.toLowerCase()}.svg`), code).not.toThrow();
    }
    expect(read("public/flags/LICENSE")).toContain("MIT");
    expect(parseAppPath("/flags/jp.svg")).toEqual({ kind: "static" });
  });

  it("leaves self-harm figures out and keeps every other indicator", () => {
    expect(countryDetail("JP").v["suicide-rate"]).toBeUndefined();
    expect(Object.keys(en.labels)).not.toContain("suicide-rate");
    for (const id of Object.keys(en.labels)) expect(DATASETS as readonly string[]).toContain(id);
  });
});

describe("countries: copy", () => {
  it("has every locale with the same keys and placeholders as English", () => {
    const paths = keyPaths(en).sort();
    const base = new Map(strings(en));
    for (const locale of LOCALES) {
      const copy = JSON.parse(read(`src/locales/countries/${locale}.json`));
      expect(keyPaths(copy).sort(), locale).toEqual(paths);
      for (const [path, text] of strings(copy)) expect(placeholders(text), `${locale} ${path}`).toEqual(placeholders(base.get(path)!));
    }
  });

  it("has the nav label and the data hub link in every locale", () => {
    for (const locale of LOCALES) {
      expect(typeof (messages(locale).ui.nav as Record<string, string>).countries).toBe("string");
      const datasets = JSON.parse(read(`src/locales/datasets/${locale}.json`));
      expect(datasets.hub.countries.title.length).toBeGreaterThan(2);
    }
  });
});

describe("countries: routes", () => {
  it("parses and round-trips locale and bare paths", () => {
    expect(parseAppPath("/en/countries/")).toEqual({ kind: "countries", locale: "en", entry: null });
    expect(parseAppPath("/zh-cn/countries/japan/")).toEqual({ kind: "countries", locale: "zh-CN", entry: "japan" });
    expect(parseAppPath("/countries/")).toEqual({ kind: "bare-countries", entry: null });
    expect(parseAppPath("/countries/Japan")).toEqual({ kind: "bare-countries", entry: "japan" });
    expect(parseAppPath("/en/countries/atlantis/")).toEqual({ kind: "unknown" });
    expect(parseAppPath("/en/countries/japan/x/")).toEqual({ kind: "unknown" });
    for (const locale of LOCALES) {
      expect(parseAppPath(countriesHref(locale))).toEqual({ kind: "countries", locale, entry: null });
      for (const slug of COUNTRY_LIST) expect(parseAppPath(countriesHref(locale, slug))).toEqual({ kind: "countries", locale, entry: slug });
    }
  });

  it("redirects bare paths, adds the slash, 404s unknown slugs and serves the page", async () => {
    const assets = { fetch: async () => new Response(SHELL, { headers: { "Content-Type": "text/html; charset=utf-8" } }) };
    const bare = await worker.fetch(new Request("https://cv.cm/countries/japan/", { headers: { "Accept-Language": "ja" } }), { ASSETS: assets });
    expect(bare.status).toBe(302);
    expect(bare.headers.get("Location")).toBe("https://cv.cm/ja/countries/japan/");
    const slash = await worker.fetch(new Request("https://cv.cm/en/countries/china"), { ASSETS: assets });
    expect(slash.status).toBe(301);
    expect(slash.headers.get("Location")).toBe("https://cv.cm/en/countries/china/");
    const unknown = await worker.fetch(new Request("https://cv.cm/en/countries/atlantis/"), { ASSETS: assets });
    expect(unknown.status).toBe(404);
    const page = await worker.fetch(new Request("https://cv.cm/zh-cn/countries/japan/"), { ASSETS: assets });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('<link rel="canonical" href="https://cv.cm/zh-cn/countries/japan/"');
    expect(html).toContain('hreflang="x-default" href="https://cv.cm/en/countries/japan/"');
    expect(html).toContain("<title>日本人口");
    expect(html).toContain('id="breadcrumb-jsonld"');
    expect(html).toContain('id="faq-jsonld"');
    expect(html).not.toContain('id="howto-jsonld"');
    const hub = await (await worker.fetch(new Request("https://cv.cm/en/countries/"), { ASSETS: assets })).text();
    expect(hub).toContain('id="article-jsonld"');
    expect(hub).toContain("CollectionPage");
  });

  it("preloads the pack on the hub and the data bucket on a profile", () => {
    const packs = { en: ["/a/en.js"], "countries-en": ["/a/c-en.js"], "countries-data/3": ["/a/b3.js"] };
    const hub = preloadLocalePack("<head></head>", "en", false, packs, false, false, null, null, null, null, null, null, "hub");
    expect(hub).toContain("/a/c-en.js");
    expect(hub).not.toContain("/a/b3.js");
    const page = preloadLocalePack("<head></head>", "en", false, packs, false, false, null, null, null, null, null, null, "3");
    expect(page).toContain("/a/b3.js");
  });

  it("is in the sitemap with every locale and the data date as lastmod", () => {
    const pages = sitemapPages().filter((p) => p.kind === "countries");
    expect(pages.length).toBe(LOCALES.length * (COUNTRY_LIST.length + 1));
    const xml = buildSitemapXml(pages);
    expect(xml.match(/<lastmod>/g)?.length).toBe(pages.length);
    expect(xml).toContain(`<loc>https://cv.cm/vi/countries/japan/</loc>\n    <lastmod>${COUNTRIES_UPDATED}</lastmod>`);
    expect(xml).toContain('hreflang="zh-TW" href="https://cv.cm/zh-tw/countries/japan/"');
  });
});

describe("countries: pages", () => {
  it("renders the hub and every profile in every locale without leftover placeholders", { timeout: 60_000 }, () => {
    for (const locale of LOCALES) {
      const hub = countriesPageHtml(locale, null);
      expect(hub).toContain("<h1>");
      expect(hub).not.toMatch(/\{\w+\}/);
      for (const slug of COUNTRY_LIST) {
        const html = countriesPageHtml(locale, slug);
        expect(html, `${locale} ${slug}`).not.toMatch(/\{\w+\}|undefined|NaN/);
        expect(html).toContain('class="kb-answer"');
        expect(html).toContain(`href="/${locale.toLowerCase()}/datasets/population/"`);
        const title = countryTitle(locale, slug);
        expect(title, `${locale} ${slug}`).toMatch(/ — cv\.cm$/);
        expect(title).not.toMatch(/\{\w+\}/);
        expect(countryDescription(locale, slug)).not.toMatch(/\{\w+\}|undefined/);
        expect(countryFaqItems(locale, slug).length, `${locale} ${slug}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("answers from the data in templated sentences", () => {
    const html = countriesPageHtml("en", "japan");
    expect(html).toContain("The capital of Japan is Tokyo.");
    expect(html).toMatch(/The population of Japan was [\d.]+ million in \d{4}, \d+(st|nd|rd|th) of \d+ in the world\./);
    expect(html).toContain('src="/flags/jp.svg"');
    expect(html.match(/<img /g)?.length).toBe(1);
    // Lists are text (rule 7): no flags on the hub.
    expect(countriesPageHtml("en", null)).not.toContain("<img");
    expect(zonesText("en", countryDetail("AR"))).toBe("1 time zone (UTC-03:00)");
    expect(zonesText("en", countryDetail("DE"))).toBe("1 time zone (UTC+01:00, summer UTC+02:00)");
    expect(zonesText("en", countryDetail("US"))).toMatch(/^\d+ time zones: UTC-1\d:00 to UTC-0\d:00$/);
    expect(countryName("en", "CD")).toBe("DR Congo");
    expect(countryName("zh-CN", "HK")).toBe("中国香港");
    expect(countriesPageHtml("en", "isle-of-man")).toContain("the Isle of Man");
    expect(countriesPageHtml("en", "united-states")).toContain("Washington, D.C. The population");
    expect(countriesPageHtml("en", "netherlands")).toContain("The capital of the Netherlands is Amsterdam.");
    expect(countryFaqItems("en", "israel").map((f) => f.q)).not.toContain("What is the capital of Israel?");
    expect(countryTitle("en", "japan")).toMatch(/^Japan: Population, GDP, Capital, Flag \(\d{4} Data\) — cv\.cm$/);
    expect(countryTitle("en", "israel")).not.toContain("Capital");
    expect(pageTitle("ja", { countries: true, countryId: "japan" })).toMatch(/^日本の人口・GDP・首都・国旗/);
    expect(pageCanonical("zh-TW", { countries: true, countryId: "japan" })).toBe("https://cv.cm/zh-tw/countries/japan/");
    const hub = countriesCollectionJsonLd("en", null) as { mainEntity: { itemListElement: unknown[] } };
    expect(hub.mainEntity.itemListElement.length).toBe(COUNTRY_LIST.length);
    expect(countriesCollectionJsonLd("en", "japan")).toBeNull();
    const served = applyHtmlSeo(SHELL, "es", { countries: true, countryId: "spain" });
    expect(served).toContain('<div id="app"><nav class="device-crumb"');
  });
});
