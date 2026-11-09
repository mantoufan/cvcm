import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import baseRows from "../src/shared/rankings-rows.json";
import mountainRows from "../src/shared/rankings-geo/tallest-mountains.json";
import riverRows from "../src/shared/rankings-geo/longest-rivers.json";
import lakeRows from "../src/shared/rankings-geo/largest-lakes.json";
import islandRows from "../src/shared/rankings-geo/largest-islands.json";
import { LOCALES } from "../src/shared/locale";
import { appHref, parseAppPath, rankingHref } from "../src/shared/path";
import { RANKINGS, RANKING_REGIONS, RANKING_SOURCE, rankingCsvHref, rankingKind, rankingMeta, type IslandRow, type LakeRow, type MountainRow, type RiverRow, rankingGroupOf, rankingRowsChunk } from "../src/shared/rankings";
import { rankingFaqItems, rankingHub, rankingJsonLd, rankingName, rankingPageCopy, rankingStaticHtml, rankingTable, rankingTitle } from "../src/shared/rankings-i18n";
import { applyHtmlSeo } from "../src/shared/seo";

const geoRows: Record<string, unknown[]> = { "tallest-mountains": mountainRows, "longest-rivers": riverRows, "largest-lakes": lakeRows, "largest-islands": islandRows };
const rows = { ...baseRows, ...geoRows };

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

describe("tallest mountains", () => {
  // Shape only: the refresh workflow runs these tests on live Wikidata, so no label or count is pinned here.
  const table = (rows as unknown as Record<string, MountainRow[]>)["tallest-mountains"];
  it("lists distinct peaks by height, Everest first, with no peak above its own height", () => {
    expect(table[0][1]).toBe("Q513");
    const heights = table.map((row) => row[3]);
    expect(heights).toEqual([...heights].sort((a, b) => b - a));
    expect(new Set(table.map((row) => row[1])).size).toBe(table.length);
    for (const row of table) {
      expect(row[4], row[2].en).toBeGreaterThanOrEqual(500);
      expect(row[4], row[2].en).toBeLessThanOrEqual(row[3]);
      for (const code of row[5]) expect(code, row[2].en).toMatch(/^[A-Z]{2}$/);
    }
  });
  it("names peaks, countries and ranges in the reader's language and shows feet", () => {
    const row: MountainRow = [1, "Q1", { en: "Peak", "zh-CN": "峰" }, 8848.86, 8848.86, ["CN", "NP"], { en: "Range", "zh-TW": "山脈" }];
    const zh = rankingTable("zh-CN", "tallest-mountains", [row]);
    expect(zh.rows[0][1].text).toBe("峰");
    expect(zh.rows[0][2].text).toBe("8,848.86 m");
    expect(zh.rows[0][3].text).toBe("29,032");
    expect(zh.rows[0][5].text).toBe("中国、尼泊尔");
    expect(zh.rows[0][6].text).toBe("Range");
    expect(rankingTable("zh-TW", "tallest-mountains", [row]).rows[0][6].text).toBe("山脈");
    const en = rankingTable("en", "tallest-mountains", [[1, "Q1", { en: "Peak" }, 7000, 600, [], null]]);
    expect(en.rows[0][5].text).toBe("—");
    expect(en.rows[0][6].text).toBe("—");
    expect(rankingTable("en", "tallest-mountains", [row]).rows[0][5].text).toBe("China, Nepal");
  });
});

describe("rivers, lakes and islands", () => {
  // Shape only: the refresh workflow runs these tests on live Wikipedia data.
  const geo = rows as unknown as Record<string, (RiverRow | LakeRow | IslandRow)[]>;
  it("keeps geography rows in their own file, one entry per place, largest first", () => {
    for (const id of RANKINGS) expect(id in geoRows, id).toBe(rankingGroupOf(id) === "geography");
    for (const id of RANKINGS) expect(rankingRowsChunk(id), id).toBe(rankingGroupOf(id) === "geography" ? `rows-ranking-${id}` : "rows-rankings");
    for (const id of RANKINGS) expect(id in baseRows, id).toBe(rankingGroupOf(id) !== "geography");
    // The fetch script's own list of geography tables (GEO_IDS) writes these files: one per table of the group, no more.
    expect(readdirSync("src/shared/rankings-geo").sort()).toEqual(RANKINGS.filter((id) => rankingGroupOf(id) === "geography").map((id) => `${id}.json`).sort());
    for (const id of ["longest-rivers", "largest-lakes", "largest-islands"]) {
      const table = geo[id];
      const values = table.map((row) => row[3]);
      expect(values, id).toEqual([...values].sort((a, b) => b - a));
      expect(new Set(table.map((row) => row[1])).size, id).toBe(table.length);
      for (const row of table) {
        expect(row[1], id).toMatch(/^Q\d+$/);
        for (const c of row[4]) if (typeof c === "string") expect(c, row[2].en).toMatch(/^[A-Z]{2}$/);
        else expect(c.en, row[2].en).toBeTruthy();
      }
    }
  });
  it("shows imperial units, localized countries and the lake's water", () => {
    const river: RiverRow = [1, "Q1", { en: "River", "zh-CN": "河" }, 6650, ["EG", { en: "Danish Realm", ja: "デンマーク王国" }], "A–B"];
    const zh = rankingTable("zh-CN", "longest-rivers", [river]);
    expect(zh.rows[0][1].text).toBe("河");
    expect(zh.rows[0][2].text).toBe("6,650");
    expect(zh.rows[0][3].text).toBe("4,132");
    expect(zh.rows[0][4].text).toBe("埃及、Danish Realm");
    expect(rankingTable("ja", "longest-rivers", [river]).rows[0][4].text).toBe("エジプト、デンマーク王国");
    expect(rankingTable("en", "longest-rivers", [[1, "Q1", { en: "R" }, 10, [], null]]).rows[0][5].text).toBe("—");
    const lake = rankingTable("en", "largest-lakes", [[1, "Q1", { en: "L" }, 82100, ["CA"], null, "saline"]]);
    expect(lake.rows[0][3].text).toBe("31,699");
    expect(lake.rows[0][4].text).toBe("—");
    expect(lake.rows[0][5].text).toBe("Salt");
    const island = rankingTable("en", "largest-islands", [[1, "Q1", { en: "I" }, 2108459.47, []]]);
    expect(island.rows[0][2].text).toBe("2,108,459");
    expect(island.rows[0][4].text).toBe("—");
  });
});
