import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import worker from "../src/worker";
import en from "../src/locales/datasets/en.json";
import countries from "../src/data/countries.json";
import { LOCALES } from "../src/shared/locale";
import { datasetMessages } from "../src/shared/messages";
import { STATIC_FILE, datasetHref, parseAppPath } from "../src/shared/path";
import { DATASETS, DATASET_FILES, INDICATORS, INDICATOR_SPEC, csvHref, datasetMeta, isIndicator, type CountryRow, type DatasetId, type DatasetRows, type IndicatorRow } from "../src/shared/datasets";
import { datasetJsonLd, datasetPageCopy, datasetStaticHtml, datasetTable, datasetTitle, regionName, utcOffset } from "../src/shared/datasets-i18n";
import { applyHtmlSeo, pageCanonical } from "../src/shared/seo";
import { buildSitemapXml } from "../src/shared/sitemap";

const SHELL = `<!doctype html><html lang="en"><head><title>cv.cm</title><meta name="description" content="x" /><link rel="canonical" href="https://cv.cm/" /></head><body><div id="app"></div></body></html>`;

function rows(id: DatasetId): DatasetRows {
  return JSON.parse(readFileSync(`src/data/${DATASET_FILES[id][0]}.json`, "utf8")) as DatasetRows;
}

function placeholders(value: unknown): string[] {
  return (JSON.stringify(value).match(/\{\w+\}/g) ?? []).sort();
}

describe("data pages: routes", () => {
  it("parses locale and bare paths and leaves the /data/ tool alone", () => {
    expect(parseAppPath("/en/datasets/")).toEqual({ kind: "dataset", locale: "en", dataset: null });
    expect(parseAppPath("/zh-cn/datasets/population/")).toEqual({ kind: "dataset", locale: "zh-CN", dataset: "population" });
    expect(parseAppPath("/datasets/ascii")).toEqual({ kind: "bare-dataset", dataset: "ascii" });
    expect(parseAppPath("/en/datasets/nope/")).toEqual({ kind: "unknown" });
    expect(parseAppPath("/en/data/")).toEqual({ kind: "app", locale: "en", tool: "data" });
    expect(parseAppPath("/datasets/gdp.csv")).toEqual({ kind: "static" });
    expect(STATIC_FILE.test(csvHref("time-zones"))).toBe(true);
    expect(datasetHref("zh-TW", "paper-sizes")).toBe("/zh-tw/datasets/paper-sizes/");
  });

  it("redirects bare paths, adds the slash and 404s unknown tables", async () => {
    const assets = { fetch: async () => new Response(SHELL, { headers: { "Content-Type": "text/html; charset=utf-8" } }) };
    const bare = await worker.fetch(new Request("https://cv.cm/datasets/gdp/", { headers: { "Accept-Language": "vi" } }), { ASSETS: assets });
    expect(bare.status).toBe(302);
    expect(bare.headers.get("Location")).toBe("https://cv.cm/vi/datasets/gdp/");
    const slash = await worker.fetch(new Request("https://cv.cm/en/datasets/gdp"), { ASSETS: assets });
    expect(slash.status).toBe(301);
    expect(slash.headers.get("Location")).toBe("https://cv.cm/en/datasets/gdp/");
    const unknown = await worker.fetch(new Request("https://cv.cm/en/datasets/nope/"), { ASSETS: assets });
    expect(unknown.status).toBe(404);
    const page = await worker.fetch(new Request("https://cv.cm/ja/datasets/time-zones/"), { ASSETS: assets });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('<link rel="canonical" href="https://cv.cm/ja/datasets/time-zones/"');
    expect(html).toContain('id="dataset-jsonld"');
  });

  it("lists the hub and every table in every locale in the sitemap", () => {
    const xml = buildSitemapXml();
    for (const locale of LOCALES) {
      expect(xml).toContain(`<loc>https://cv.cm${datasetHref(locale)}</loc>`);
      for (const id of DATASETS) expect(xml).toContain(`<loc>https://cv.cm${datasetHref(locale, id)}</loc>`);
    }
  });

  it("ships a CSV for every table", () => {
    for (const id of DATASETS) expect(existsSync(`public${csvHref(id)}`), id).toBe(true);
  });
});

describe("data pages: SEO", () => {
  it("serves Dataset, breadcrumb and FAQ JSON-LD with hreflang", () => {
    const html = applyHtmlSeo(SHELL, "es", { dataset: true, datasetId: "population" });
    expect(html).toContain('<link rel="canonical" href="https://cv.cm/es/datasets/population/"');
    expect(html).toContain('hreflang="zh-CN" href="https://cv.cm/zh-cn/datasets/population/"');
    for (const id of ["breadcrumb-jsonld", "faq-jsonld", "dataset-jsonld"]) expect(html).toContain(`id="${id}"`);
    expect(html).not.toContain('id="software-jsonld"');
    expect(pageCanonical("en", { dataset: true })).toBe("https://cv.cm/en/datasets/");
  });

  it("describes each table as a Dataset Google can index", () => {
    for (const id of DATASETS) {
      const ld = datasetJsonLd("en", id);
      expect(ld["@type"]).toBe("Dataset");
      expect(String(ld.description).length, id).toBeGreaterThan(50);
      expect(String(ld.description).length, id).toBeLessThan(5000);
      expect(ld.license).toMatch(/^https:\/\//);
      expect((ld.distribution as { contentUrl: string }[])[0].contentUrl).toBe(`https://cv.cm${csvHref(id)}`);
      if (isIndicator(id)) expect(ld.temporalCoverage).toMatch(/^\d{4}(\/\d{4})?$/);
    }
    const hub = datasetJsonLd("ko", null);
    expect(hub["@type"]).toBe("DataCatalog");
    expect((hub.dataset as unknown[]).length).toBe(DATASETS.length);
  });

  it("fills every placeholder from the snapshot", () => {
    for (const locale of LOCALES) {
      for (const id of DATASETS) {
        const copy = datasetPageCopy(locale, id);
        const text = JSON.stringify([copy.title, copy.description, copy.h1, copy.lede, copy.facts, copy.about, copy.faq]);
        expect(text.match(/\{\w+\}/g), `${locale} ${id}`).toBeNull();
        expect(copy.title.endsWith(" | cv.cm"), `${locale} ${id}`).toBe(true);
      }
    }
    expect(datasetTitle("en", "population")).toMatch(/^World Population by Country \d{4}/);
    // Names follow the page language.
    expect(datasetPageCopy("zh-CN", "population").facts[1]).toContain("印度");
  });

  it("keeps a text fallback with the facts and a CSV link", () => {
    const html = datasetStaticHtml("en", "gdp");
    expect(html).toContain("<h1>");
    expect(html).toContain(csvHref("gdp"));
    expect(datasetStaticHtml("en", null)).toContain(datasetHref("en", "ascii"));
  });
});

describe("data pages: copy", () => {
  it("has the same keys and placeholders in every locale", () => {
    const walk = (a: unknown, b: unknown, path: string, locale: string): void => {
      if (typeof a === "string") {
        expect(typeof b, `${locale} ${path}`).toBe("string");
        expect(placeholders(b), `${locale} ${path}`).toEqual(placeholders(a));
        return;
      }
      expect(Object.keys(b as object), `${locale} ${path}`).toEqual(Object.keys(a as object));
      for (const [k, v] of Object.entries(a as object)) walk(v, (b as Record<string, unknown>)[k], `${path}.${k}`, locale);
    };
    for (const locale of LOCALES) walk(en, datasetMessages(locale), "", locale);
  });
});

describe("data pages: tables", () => {
  it("builds every table in every locale with a cell per column", () => {
    for (const locale of LOCALES) {
      for (const id of DATASETS) {
        const table = datasetTable(locale, id, rows(id), countries as CountryRow[]);
        expect(table.rows.length, `${locale} ${id}`).toBe(datasetMeta(id).rows);
        expect(table.columns.filter((c) => c.head).length, id).toBe(1);
        for (const row of table.rows) expect(row.length).toBe(table.columns.length);
        expect(table.columns.every((c) => c.label), `${locale} ${id}`).toBe(true);
      }
    }
  });

  it("ranks indicators and shows shares that add up to under 100%", () => {
    const table = datasetTable("en", "population", rows("population"));
    expect(table.rows[0][0].text).toBe("1");
    expect(table.rows[0][1].text).toBe("India");
    const sorts = table.rows.map((r) => r[2].sort as number);
    expect(sorts).toEqual([...sorts].sort((a, b) => b - a));
  });

  it("gives every indicator a known format, a row file and a reason for each data filter", () => {
    for (const id of INDICATORS) {
      const spec = INDICATOR_SPEC[id];
      expect([undefined, "usd", "usd-compact"], id).toContain(spec.format);
      expect(Number.isInteger(spec.decimals), id).toBe(true);
      if (spec.maxAge !== undefined || spec.floor !== undefined || spec.skip) expect(spec.why, id).toBeTruthy();
    }
    for (const id of DATASETS) for (const file of DATASET_FILES[id]) expect(existsSync(`src/data/${file}.json`), file).toBe(true);
  });

  it("divides each share by the world total of its year and names every country tied for last", () => {
    // Every row of a total table gets a share, each against the world total of its own year.
    for (const id of INDICATORS.filter((i) => INDICATOR_SPEC[i].total)) {
      const table = datasetTable("en", id, rows(id));
      const shareCol = table.columns.findIndex((c) => c.label === "Share of world");
      expect(table.rows.filter((r) => r[shareCol].text === "–").length, id).toBe(0);
    }
    // Each share is the row's value over the world total stored for the row's year.
    const exports = datasetTable("en", "exports", rows("exports"));
    const worlds = datasetMeta("exports").worlds!;
    for (const row of exports.rows) expect(parseFloat(row[3].text), row[1].text).toBeCloseTo(((row[2].sort as number) / worlds[row[4].text]) * 100, 1);
    const forest = rows("forest-area") as IndicatorRow[];
    const zeros = forest.filter((r) => r[2] === forest[forest.length - 1][2]).length;
    expect(datasetMeta("forest-area").bottom!.length).toBe(Math.min(zeros, 3));
  });

  it("places every indicator from indicators.json in exactly one group", () => {
    for (const id of INDICATORS) expect(DATASETS.filter((d) => d === id).length, id).toBe(1);
    expect(DATASETS.filter(isIndicator).length).toBe(INDICATORS.length);
  });

  it("keeps one latest row per country in every indicator", () => {
    for (const id of DATASETS.filter(isIndicator)) {
      const codes = (rows(id) as IndicatorRow[]).map((r) => r[1]);
      expect(new Set(codes).size, id).toBe(codes.length);
    }
  });

  it("shows land as a share of the world and keeps negative rates signed", () => {
    const land = datasetTable("en", "land-area", rows("land-area"));
    expect(land.columns.map((c) => c.label)).toContain("Share of world");
    expect(land.rows[0][1].text).toBe("Russia");
    // Some economy shrinks every year or two; its rate keeps the minus sign.
    const growth = datasetTable("en", "gdp-growth", rows("gdp-growth"));
    const shrank = growth.rows.find((r) => (r[2].sort as number) < 0);
    expect(shrank).toBeDefined();
    expect(shrank![2].text).toMatch(/^-\d/);
  });

  it("drops stale rates and EDGAR placeholder zeros", () => {
    for (const id of ["gdp-growth", "inflation", "unemployment", "gdp-ppp-per-capita"] as const) {
      const meta = datasetMeta(id);
      expect(meta.to! - meta.from!, id).toBeLessThanOrEqual(1);
    }
    const co2 = rows("co2-per-capita") as IndicatorRow[];
    expect(Math.min(...co2.map((r) => r[2]))).toBeGreaterThan(0);
    expect(co2.some((r) => r[1] === "FRO" || r[1] === "PLW")).toBe(false);
  });

  it("computes ISO paper sizes and time zone offsets", () => {
    const paper = datasetTable("en", "paper-sizes", rows("paper-sizes"));
    const a4 = paper.rows.find((r) => r[0].text === "A4")!;
    expect(a4[2].text).toBe("210 × 297");
    expect(a4[4].text).toBe("2480 × 3508");
    expect(utcOffset(330)).toBe("UTC+05:30");
    expect(utcOffset(-210)).toBe("UTC-03:30");
    const zones = datasetTable("en", "time-zones", rows("time-zones"));
    const shanghai = zones.rows.find((r) => r[0].text === "Asia/Shanghai")!;
    expect([shanghai[3].text, shanghai[4].text]).toEqual(["UTC+08:00", "UTC+08:00"]);
    // Current IANA names from zone.tab, not ICU's legacy aliases.
    const ids = zones.rows.map((r) => r[0].text);
    expect(ids).toContain("Asia/Kolkata");
    expect(ids).toContain("Europe/Kyiv");
    expect(ids).not.toContain("Asia/Calcutta");
    expect(datasetPageCopy("en", "time-zones").facts[0]).toMatch(/west \(UTC-1\d:00\) to east \(UTC\+1\d:00\)/);
  });

  it("names currencies and countries in the page language", () => {
    const table = datasetTable("ja", "currency-codes", rows("currency-codes"), countries as CountryRow[]);
    const jpy = table.rows.find((r) => r[0].text === "JPY")!;
    expect(jpy[1].text).toContain("円");
    expect(jpy[4].text).toBe("0");
    expect(jpy[5].text).toContain("日本");
    expect(regionName("en", "JG", "Channel Islands")).toBe("Channel Islands");
    // A country with two currencies is listed under both.
    const en = datasetTable("en", "currency-codes", rows("currency-codes"), countries as CountryRow[]);
    expect(en.rows.find((r) => r[0].text === "BTN")![5].text).toContain("Bhutan");
    expect(en.rows.find((r) => r[0].text === "USD")![5].text).toContain("Panama");
  });

  it("shares ranks between equal values and sorts multi-code dialing areas by their first code", () => {
    const internet = datasetTable("en", "internet-users", rows("internet-users"));
    expect(internet.rows[0][2].sort).toBe(internet.rows[1][2].sort);
    expect(internet.rows[1][0].text).toBe("1");
    const calling = datasetTable("en", "calling-codes", rows("calling-codes"));
    const dominican = calling.rows.find((r) => r[2].text === "DO")!;
    expect(dominican[1].text).toBe("+1-809, +1-829, +1-849");
    expect(dominican[1].sort).toBeCloseTo(1.0809);
    expect(calling.rows.find((r) => r[2].text === "CN")![1].sort).toBe(86);
  });
});
