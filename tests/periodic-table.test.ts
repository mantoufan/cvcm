import { describe, expect, it } from "vitest";
import worker from "../src/worker";
import en from "../src/locales/elements/en.json";
import enCore from "../src/locales/en.json";
import { LOCALES, type Locale } from "../src/shared/locale";
import { messages } from "../src/shared/messages";
import { elementsHref, parseAppPath, STATIC_FILE } from "../src/shared/path";
import {
  ELEMENT_SLUGS,
  ELEMENTS_FOCUS,
  ELEMENTS_SNAPSHOT,
  atomicNumberOf,
  blockOf,
  cellOf,
  groupMembers,
  groupOf,
  hasStandardWeight,
  isFBlockRow,
  periodOf,
  shellsOf,
} from "../src/shared/elements";
import {
  configText,
  elementName,
  elementsDescription,
  elementsFaqItems,
  elementsMessages,
  elementsPageJsonLd,
  elementsTitle,
  formatMass,
  fullConfigText,
  kelvinToCelsius,
} from "../src/shared/elements-i18n";
import { elementsPageHtml } from "../src/shared/elements-page";
import { pageCanonical } from "../src/shared/seo";
import { applyHtmlSeo } from "../src/shared/seo-html";
import { buildSectionSitemaps, buildSitemapXml, sitemapPages } from "../src/shared/sitemap";
import { buildSearchIndex } from "../src/shared/search-index";

const SHELL = `<!doctype html><html lang="en"><head><title>cv.cm</title><meta name="description" content="x" /><link rel="canonical" href="https://cv.cm/" /></head><body><div id="app"></div></body></html>`;
const assets = { fetch: async () => new Response(SHELL, { headers: { "Content-Type": "text/html; charset=utf-8" } }) };

/** Dotted key paths of a JSON tree, arrays by index. */
function paths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([k, v]) => paths(v, prefix ? `${prefix}.${k}` : k));
}

function leaf(tree: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], tree);
}

// {nameText} is {name} in lower case where the language has case: the two count as one placeholder.
const placeholders = (text: unknown): string[] => [...new Set((String(text).match(/\{\w+\}/g) ?? []).map((p) => (p === "{nameText}" ? "{name}" : p)))].sort();

describe("periodic table: data", () => {
  it("has all 118 elements in order, with IUPAC slugs", () => {
    const data = elementsMessages("en").data;
    expect(ELEMENT_SLUGS.length).toBe(118);
    expect(data.length).toBe(118);
    data.forEach((row, i) => expect(row.z).toBe(i + 1));
    expect(new Set(ELEMENT_SLUGS).size).toBe(118);
    for (const slug of ELEMENT_SLUGS) expect(slug).toMatch(/^[a-z]+$/);
    expect(ELEMENT_SLUGS).toContain("aluminium");
    expect(ELEMENT_SLUGS).toContain("caesium");
    expect(ELEMENT_SLUGS).toContain("sulfur");
    expect(atomicNumberOf("carbon")).toBe(6);
    expect(atomicNumberOf("oganesson")).toBe(118);
    expect(data[5]).toMatchObject({ symbol: "C", category: "nonmetal", state: "solid" });
    expect(ELEMENTS_SNAPSHOT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("has a name for every element in every locale", () => {
    for (const locale of LOCALES) {
      const names = elementsMessages(locale).names;
      expect(names.length, locale).toBe(118);
      for (const name of names) expect(name.trim(), locale).not.toBe("");
    }
    expect(elementName("ja", 1)).toBe("水素");
    expect(elementName("ko", 1)).toBe("수소");
    expect(elementName("zh-CN", 6)).toBe("碳");
    expect(elementName("zh-TW", 1)).toBe("氫");
    expect(elementName("es", 26)).toBe("Hierro");
    expect(elementName("en", 13)).toBe("Aluminium");
  });

  it("counts every element's electrons from its configuration", () => {
    for (const row of elementsMessages("en").data) {
      expect(shellsOf(row.config).reduce((a, b) => a + b, 0), row.symbol).toBe(row.z);
    }
    expect(shellsOf("[Ar]4s1")).toEqual([2, 8, 8, 1]);
    expect(shellsOf("[Xe]6s2 4f14 5d10")).toEqual([2, 8, 18, 32, 18, 2]);
    expect(configText("[He]2s2 2p2")).toBe("[He] 2s² 2p²");
    expect(fullConfigText("[He]2s2 2p2")).toBe("1s² 2s² 2p²");
  });

  it("brackets the mass of elements with no standard atomic weight, and converts K to °C", () => {
    const off = Array.from({ length: 118 }, (_, i) => i + 1).filter((z) => !hasStandardWeight(z));
    expect(off.slice(0, 9)).toEqual([43, 61, 84, 85, 86, 87, 88, 89, 93]);
    expect(off.length).toBe(2 + 6 + 26);
    expect(formatMass("en", 6, "12.011")).toBe("12.011");
    expect(formatMass("en", 43, "96.90636")).toBe("[96.90636]");
    expect(formatMass("es", 6, "12.011")).toBe("12,011");
    expect(kelvinToCelsius("en", "13.81")).toBe("-259.34");
    expect(kelvinToCelsius("en", "1000")).toBe("726.85");
    expect(kelvinToCelsius("en", "453.65")).toBe("180.5");
    expect(kelvinToCelsius("en", "273.15")).toBe("0");
  });
});

describe("periodic table: layout (IUPAC 18-column table, La–Lu and Ac–Lr in the f-block rows)", () => {
  it("derives periods, groups and blocks from the atomic number", () => {
    const cases: [number, number, number | null, string][] = [
      [1, 1, 1, "s"], [2, 1, 18, "s"], [3, 2, 1, "s"], [5, 2, 13, "p"], [10, 2, 18, "p"], [11, 3, 1, "s"], [13, 3, 13, "p"],
      [19, 4, 1, "s"], [21, 4, 3, "d"], [30, 4, 12, "d"], [31, 4, 13, "p"], [39, 5, 3, "d"], [55, 6, 1, "s"], [56, 6, 2, "s"],
      [57, 6, null, "f"], [71, 6, null, "f"], [72, 6, 4, "d"], [80, 6, 12, "d"], [86, 6, 18, "p"], [87, 7, 1, "s"],
      [89, 7, null, "f"], [103, 7, null, "f"], [104, 7, 4, "d"], [118, 7, 18, "p"],
    ];
    for (const [z, period, group, block] of cases) {
      expect(periodOf(z), `period of ${z}`).toBe(period);
      expect(groupOf(z), `group of ${z}`).toBe(group);
      expect(blockOf(z), `block of ${z}`).toBe(block);
    }
    expect(Array.from({ length: 118 }, (_, i) => i + 1).filter(isFBlockRow).length).toBe(30);
    // Group 3 keeps scandium and yttrium; the f-block rows have no group number, as on IUPAC's table.
    expect(groupMembers(3)).toEqual([21, 39]);
    expect(groupMembers(1)).toEqual([1, 3, 11, 19, 37, 55, 87]);
    expect(groupMembers(18)).toEqual([2, 10, 18, 36, 54, 86, 118]);
    for (let g = 4; g <= 17; g++) expect(groupMembers(g).length, `group ${g}`).toBeGreaterThanOrEqual(4);
  });

  it("puts each element in its own grid cell", () => {
    expect(cellOf(1)).toEqual({ row: 1, col: 1 });
    expect(cellOf(2)).toEqual({ row: 1, col: 18 });
    expect(cellOf(5)).toEqual({ row: 2, col: 13 });
    expect(cellOf(72)).toEqual({ row: 6, col: 4 });
    expect(cellOf(57)).toEqual({ row: 9, col: 3 });
    expect(cellOf(71)).toEqual({ row: 9, col: 17 });
    expect(cellOf(89)).toEqual({ row: 10, col: 3 });
    expect(cellOf(103)).toEqual({ row: 10, col: 17 });
    expect(cellOf(118)).toEqual({ row: 7, col: 18 });
    const cells = new Set(Array.from({ length: 118 }, (_, i) => JSON.stringify(cellOf(i + 1))));
    expect(cells.size).toBe(118);
    // Group 3 of periods 6 and 7 is left for the f-block marks.
    expect(cells.has(JSON.stringify({ row: 6, col: 3 }))).toBe(false);
    expect(cells.has(JSON.stringify({ row: 7, col: 3 }))).toBe(false);
  });
});

describe("periodic table: copy", () => {
  it("has the same keys and placeholders in every locale", () => {
    const keys = paths(en);
    for (const locale of LOCALES) {
      const copy = elementsMessages(locale);
      const own = paths(Object.fromEntries(Object.entries(copy).filter(([k]) => !["names", "english", "data"].includes(k))));
      expect(own.sort(), locale).toEqual([...keys].sort());
      for (const key of keys) expect(placeholders(leaf(copy, key)), `${locale} ${key}`).toEqual(placeholders(leaf(en, key)));
    }
  });

  it("names the footer elements in the core pack exactly as the elements pack does", () => {
    for (const locale of LOCALES) {
      const ui = messages(locale).ui as unknown as { nav: Record<string, string>; periodicTable: { focus: Record<string, string>; lead: string; all: string } };
      expect(ui.nav.elements, locale).toBeTruthy();
      for (const slug of ELEMENTS_FOCUS) expect(ui.periodicTable.focus[slug], `${locale} ${slug}`).toBe(elementName(locale, atomicNumberOf(slug)));
    }
    expect(enCore.nav.elements).toBe("Periodic table");
  });

  it("renders the hub and every element page in every locale with nothing left unfilled", () => {
    for (const locale of LOCALES) {
      for (const slug of [null, ...ELEMENT_SLUGS]) {
        const html = elementsPageHtml(locale, slug);
        const where = `${locale} ${slug ?? "hub"}`;
        expect(html, where).not.toMatch(/\{\w+\}|undefined|NaN|\[object/);
        expect(html, where).toContain('class="faq"');
        const title = elementsTitle(locale, slug);
        expect(title, where).toMatch(/ — cv\.cm$/);
        expect(title + elementsDescription(locale, slug), where).not.toMatch(/\{\w+\}|undefined|NaN/);
        const faq = elementsFaqItems(locale, slug);
        expect(faq.length, where).toBe(3);
        for (const item of faq) expect(item.q + item.a, where).not.toMatch(/\{\w+\}|undefined|NaN/);
        if (slug) {
          const z = atomicNumberOf(slug);
          expect(html, where).toContain(`>${elementsMessages(locale).data[z - 1].symbol}</b>`);
          expect(html, where).toContain(elementsHref(locale));
        } else {
          // Every element is a plain link in the table (no JavaScript needed) and a row in the list.
          for (const s of ELEMENT_SLUGS) expect(html, `${where} ${s}`).toContain(`href="${elementsHref(locale, s)}"`);
          expect(html.match(/class="pt-cell pt-(?!fmark)/g)?.length, where).toBe(118);
          expect(html.match(/<tr data-z=/g)?.length, where).toBe(118);
        }
      }
    }
  });

  it("writes the questions people search for", () => {
    const [mass, config, heat] = elementsFaqItems("en", "carbon");
    expect(mass.q).toBe("What is the atomic mass of carbon?");
    expect(mass.a).toContain("12.011 u");
    expect(config.a).toContain("[He] 2s² 2p²");
    expect(heat.a).toContain("3,823 K (3,549.85 °C)");
    expect(elementsTitle("en", "carbon")).toBe("Carbon (C): Atomic Mass, Electron Configuration, Properties — cv.cm");
    expect(elementsTitle("zh-CN", "carbon")).toBe("碳（C）元素：原子量、电子排布、性质 — cv.cm");
    // No melting point in PubChem: the third question falls back to the symbol, and nothing is invented.
    expect(elementsFaqItems("en", "oganesson")[2].q).toBe("What is the symbol of oganesson?");
    expect(elementsFaqItems("en", "technetium")[0].a).toContain("[96.90636] u");
    expect(elementsPageHtml("en", "oganesson")).toContain("predicted");
  });
});

describe("periodic table: routes and SEO", () => {
  it("parses locale and bare paths and rejects unknown slugs", () => {
    expect(parseAppPath("/en/periodic-table/")).toEqual({ kind: "elements", locale: "en", entry: null });
    expect(parseAppPath("/zh-cn/periodic-table/carbon/")).toEqual({ kind: "elements", locale: "zh-CN", entry: "carbon" });
    expect(parseAppPath("/periodic-table/gold")).toEqual({ kind: "bare-elements", entry: "gold" });
    expect(parseAppPath("/periodic-table/")).toEqual({ kind: "bare-elements", entry: null });
    expect(parseAppPath("/en/periodic-table/aluminum/")).toEqual({ kind: "unknown" });
    expect(parseAppPath("/en/periodic-table/carbon/x/")).toEqual({ kind: "unknown" });
    expect(elementsHref("zh-TW", "carbon")).toBe("/zh-tw/periodic-table/carbon/");
    expect(STATIC_FILE.test("/sitemaps/elements.xml")).toBe(true);
  });

  it("redirects bare paths to a locale, adds the slash and 404s unknown elements", async () => {
    const bare = await worker.fetch(new Request("https://cv.cm/periodic-table/carbon/", { headers: { "Accept-Language": "ja" } }), { ASSETS: assets });
    expect(bare.status).toBe(302);
    expect(bare.headers.get("Location")).toBe("https://cv.cm/ja/periodic-table/carbon/");
    const slash = await worker.fetch(new Request("https://cv.cm/en/periodic-table/carbon"), { ASSETS: assets });
    expect(slash.status).toBe(301);
    expect(slash.headers.get("Location")).toBe("https://cv.cm/en/periodic-table/carbon/");
    const upper = await worker.fetch(new Request("https://cv.cm/zh-CN/periodic-table/Carbon/"), { ASSETS: assets });
    expect(upper.status).toBe(301);
    expect(upper.headers.get("Location")).toBe("https://cv.cm/zh-cn/periodic-table/carbon/");
    const unknown = await worker.fetch(new Request("https://cv.cm/en/periodic-table/unobtainium/"), { ASSETS: assets });
    expect(unknown.status).toBe(404);
    const page = await worker.fetch(new Request("https://cv.cm/ko/periodic-table/gold/"), { ASSETS: assets });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('<link rel="canonical" href="https://cv.cm/ko/periodic-table/gold/"');
    expect(html).toContain('<html lang="ko">');
    for (const id of ["breadcrumb-jsonld", "faq-jsonld", "article-jsonld"]) expect(html).toContain(`id="${id}"`);
    expect(html).not.toContain('id="software-jsonld"');
    expect(html).toContain("ChemicalSubstance");
  });

  it("serves hreflang for every locale and the right JSON-LD", () => {
    const html = applyHtmlSeo(SHELL, "es", { elements: true, elementSlug: "iron" });
    expect(html).toContain('<link rel="canonical" href="https://cv.cm/es/periodic-table/iron/"');
    for (const locale of LOCALES) expect(html).toContain(`href="https://cv.cm${elementsHref(locale, "iron")}"`);
    expect(html).toContain('hreflang="x-default" href="https://cv.cm/en/periodic-table/iron/"');
    expect(html).toContain("Hierro (Fe)");
    expect(pageCanonical("en", { elements: true })).toBe("https://cv.cm/en/periodic-table/");
    const hub = elementsPageJsonLd("en", null) as { "@type": string; mainEntity: { itemListElement: unknown[] } };
    expect(hub["@type"]).toBe("CollectionPage");
    expect(hub.mainEntity.itemListElement.length).toBe(118);
    const page = elementsPageJsonLd("ja", "hydrogen") as { mainEntity: { "@type": string; name: string; alternateName: string[]; sameAs: string[] } };
    expect(page.mainEntity).toMatchObject({ "@type": "ChemicalSubstance", name: "水素" });
    expect(page.mainEntity.alternateName).toEqual(["H", "Hydrogen"]);
    expect(page.mainEntity.sameAs[0]).toBe("https://pubchem.ncbi.nlm.nih.gov/element/1");
  });

  it("lists the hub and every element in every locale in its own sitemap, dated by the snapshot", () => {
    const xml = buildSectionSitemaps().elements;
    expect(xml.match(/<url>/g)?.length).toBe(LOCALES.length * 119);
    expect(xml.match(/<lastmod>/g)?.length).toBe(LOCALES.length * 119);
    expect(xml).toContain(`<loc>https://cv.cm/zh-cn/periodic-table/carbon/</loc>\n    <lastmod>`);
    expect(xml).toContain('hreflang="zh-TW" href="https://cv.cm/zh-tw/periodic-table/carbon/"');
    expect(xml).not.toMatch(/periodic-table\/[^"<]*[A-Z]/);
    expect(buildSitemapXml()).toContain("https://cv.cm/vi/periodic-table/gold/");
    expect(sitemapPages().filter((p) => p.kind === "elements").length).toBe(LOCALES.length * 119);
  });

  it("puts the hub and element pages in site search under their own names", () => {
    const index = buildSearchIndex("ja" as Locale);
    const carbon = index.find((e) => e[1] === "/ja/periodic-table/carbon/");
    expect(carbon?.[0]).toBe("elements");
    expect(carbon?.[2]).toBe("炭素");
    expect(carbon?.[4]).toBe("Carbon");
    expect(index.find((e) => e[1] === "/ja/periodic-table/")?.[2]).toBe("周期表");
  });
});

describe("periodic table: Chinese names stay in their own script", () => {
  // Metal-radical characters: Traditional 釒 forms are U+91D2–U+9484, Simplified 钅 forms U+9485–U+95AB.
  it("has no Traditional metal radical in zh-CN and no Simplified one in zh-TW", () => {
    const cn = elementsMessages("zh-CN").names;
    const tw = elementsMessages("zh-TW").names;
    expect(cn.filter((n) => /[釒-钄]/u.test(n))).toEqual([]);
    expect(tw.filter((n) => /[钅-閫]/u.test(n))).toEqual([]);
    // The mainland names filled in where Wikidata has no Simplified label (ZH_CN_GAPS in the fetch script).
    expect([54, 60, 62, 64, 65, 66, 71, 75].map((z) => cn[z - 1]).join("")).toBe("氙钕钐钆铽镝镥铼");
    expect(cn[117]).toBe("鿫");
    expect(tw[117]).toBe("鿫");
    expect(elementsFaqItems("zh-TW", null)[0].a).toContain("鿫");
  });
});
