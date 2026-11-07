import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import rows from "../src/shared/rankings-rows.json";
import { LOCALES } from "../src/shared/locale";
import { appHref, parseAppPath, rankingHref } from "../src/shared/path";
import { RANKINGS, RANKING_REGIONS, RANKING_SOURCE, rankingCsvHref, rankingKind, rankingMeta } from "../src/shared/rankings";
import { rankingFaqItems, rankingHub, rankingJsonLd, rankingName, rankingPageCopy, rankingStaticHtml, rankingTable, rankingTitle } from "../src/shared/rankings-i18n";
import { applyHtmlSeo } from "../src/shared/seo";

describe("ranking routes", () => {
  it("parses hub and tables, in and out of a locale", () => {
    expect(parseAppPath("/en/rankings/")).toMatchObject({ kind: "ranking", locale: "en", ranking: null });
    expect(parseAppPath("/zh-cn/rankings/ai-models/")).toMatchObject({ kind: "ranking", locale: "zh-CN", ranking: "ai-models" });
    expect(parseAppPath("/rankings/ai-models/")).toMatchObject({ kind: "bare-ranking", ranking: "ai-models" });
    expect(parseAppPath("/en/rankings/nope/").kind).toBe("unknown");
    expect(rankingHref("zh-CN", "ai-models")).toBe("/zh-cn/rankings/ai-models/");
    expect(appHref("en", null)).toBe("/en/");
  });
});

describe("ranking data", () => {
  it("has rows, a CSV, a source and a dated summary for every table", () => {
    for (const id of RANKINGS) {
      const table = (rows as Record<string, unknown[][]>)[id];
      expect(table.length, id).toBeGreaterThanOrEqual(5);
      expect(rankingMeta(id).rows, id).toBe(table.length);
      expect(rankingMeta(id).asOf, id).toMatch(/^\d{4}-\d{2}(-\d{2})?$/);
      expect(rankingMeta(id).updated, id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(RANKING_SOURCE[id].licenseUrl, id).toMatch(/^https:\/\//);
      const href = rankingCsvHref(id);
      if (!href) {
        expect(existsSync(`public/rankings/${id}.csv`), id).toBe(false);
        continue;
      }
      const csv = readFileSync(`public${href}`, "utf8").trim().split("\n");
      expect(csv.length, id).toBe(table.length + 1);
      expect(csv[0].endsWith("source,license"), id).toBe(true);
      expect(csv[1], id).toContain(RANKING_SOURCE[id].license);
    }
  });

  it("orders share tables by world share and has every market in every row", () => {
    for (const id of RANKINGS.filter((set) => rankingKind(set) === "share")) {
      const table = (rows as unknown as Record<string, (string | number)[][]>)[id];
      const world = table.map((row) => row[3] as number);
      expect(world, id).toEqual([...world].sort((a, b) => b - a));
      for (const row of table) expect(row.length, id).toBe(4 + RANKING_REGIONS.length);
    }
  });

  it("keeps platform names as people write them", () => {
    const names = (rows as unknown as Record<string, (string | number)[][]>)["os-market-share"].map((row) => row[1]);
    expect(names).toContain("Android");
    expect(names).toContain("iOS");
    expect(names).toContain("macOS");
    expect(names).not.toContain("MacOS");
    expect(names).not.toContain("OS X");
  });
});

describe.each(LOCALES)("ranking copy in %s", (locale) => {
  it("fills every placeholder and builds a table", () => {
    for (const id of RANKINGS) {
      const copy = rankingPageCopy(locale, id);
      const all = [copy.title, copy.description, copy.h1, copy.lede, ...copy.facts, ...copy.about, ...copy.faq.flatMap((f) => [f.q, f.a])].join(" ");
      expect(all, id).not.toMatch(/\{\w+\}/);
      expect(copy.faq.length, id).toBe(3);
      expect(rankingName(locale, id).name.length, id).toBeGreaterThan(1);
      const table = rankingTable(locale, id, (rows as Record<string, unknown[]>)[id]);
      expect(table.rows.length, id).toBe(rankingMeta(id).rows);
      for (const row of table.rows) expect(row.length, id).toBe(table.columns.length);
      expect(rankingTitle(locale, id).endsWith("| cv.cm"), id).toBe(true);
    }
    expect(rankingHub(locale).faq.length).toBe(3);
    expect(rankingFaqItems(locale, null).length).toBe(3);
  });

  it("writes head tags and a crawler fallback", () => {
    const html = applyHtmlSeo(`<!doctype html><html lang="en"><head><title>cv.cm</title><meta name="description" content="x" /><link rel="canonical" href="https://cv.cm/" /></head><body><div id="app"></div></body></html>`, locale, { ranking: true, rankingId: "ai-models" });
    expect(html).toContain(`${rankingHref(locale, "ai-models")}`);
    expect(html).toContain('id="dataset-jsonld"');
    expect(rankingStaticHtml(locale, "ai-models")).toContain(rankingCsvHref("ai-models")!);
    expect(rankingStaticHtml(locale, "crypto-market-cap")).not.toContain(".csv");
    expect(rankingJsonLd(locale, "crypto-market-cap")).not.toHaveProperty("distribution");
    expect(rankingStaticHtml(locale, null)).toContain(rankingHref(locale, "browser-market-share"));
    expect(rankingJsonLd(locale, "ai-models")).toMatchObject({ "@type": "Dataset", license: RANKING_SOURCE["ai-models"].licenseUrl });
  });
});

describe("share table values", () => {
  it("signs the yearly change and shows percent", () => {
    const row = ["1", "A", 10, 12.5, ...RANKING_REGIONS.map(() => 1)];
    const table = rankingTable("en", "browser-market-share", [row]);
    expect(table.rows[0][2].text).toBe("12.5%");
    expect(table.rows[0][3].text).toBe("+2.5");
    const down = rankingTable("en", "browser-market-share", [["1", "A", 12.5, 10, ...RANKING_REGIONS.map(() => 1)]]);
    expect(down.rows[0][3].text).toBe("−2.5");
    expect(down.rows[0][3].sort).toBe(-2.5);
    const flat = rankingTable("en", "browser-market-share", [["1", "A", 10, 9.96, ...RANKING_REGIONS.map(() => 1)]]);
    expect(flat.rows[0][3].text).toBe("0.0");
  });
});

describe("share table gaps", () => {
  it("shows no change for a name not listed a year ago, and sorts it last", () => {
    const table = rankingTable("en", "browser-market-share", [["1", "New", null, 3.2, ...RANKING_REGIONS.map(() => 1)]]);
    expect(table.rows[0][3].text).toBe("—");
    expect(table.rows[0][3].sort).toBe(Number.NEGATIVE_INFINITY);
  });
  it("shows a dash for a new coin's missing change and volume", () => {
    const table = rankingTable("en", "crypto-market-cap", [[1, "New", "NEW", 0.5, null, null, 1000, null]]);
    expect(table.rows[0][4].text).toBe("—");
    expect(table.rows[0][5].text).toBe("—");
    expect(table.rows[0][7].text).toBe("—");
    expect(table.rows[0][6].text).toContain("1");
  });
  it("marks a model with no company", () => {
    const table = rankingTable("en", "ai-usage", [[1, "Mystery", "", 10, 1]]);
    expect(table.rows[0][2].text).toBe("—");
  });
  it("does not rank OpenRouter's stealth namespace as a company", () => {
    const names = (rows as unknown as Record<string, (string | number)[][]>)["ai-companies"].map((row) => row[1]);
    expect(names).not.toContain("Stealth");
    const usage = (rows as unknown as Record<string, (string | number)[][]>)["ai-usage"].map((row) => String(row[1]));
    for (const name of usage) expect(name).not.toMatch(/-\d{8}$/);
  });
});
