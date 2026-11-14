import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import enHub from "../src/locales/ideas/en.json";
import snapshot from "../src/shared/ideas-data.json";
import worker from "../src/worker";
import { LOCALES, type Locale } from "../src/shared/locale";
import { preloadLocalePack } from "../src/shared/locale-preload";
import { ideasMessages, messages } from "../src/shared/messages";
import { ideasHref, parseAppPath } from "../src/shared/path";
import { IDEAS_DATA_FETCHED, IDEAS_FOCUS, IDEA_ENTRIES, IDEA_GROUPS, IDEA_META, ideaGroupOf, ideaPublished, isIdeaId } from "../src/shared/ideas";
import { ideaChartSvg, ideaCopy, ideaData, ideaOutlook, ideaTitle, ideasArticleJsonLd, ideasData, ideasPageHtml, pct, rankedIdeas, type IdeaEntryCopy } from "../src/shared/ideas-i18n";
import { ideasSyncFiles } from "../src/shared/ideas-sync";
import type { KbBlock } from "../src/shared/kb-i18n";
import { applyHtmlSeo, pageCanonical, pageDescription, pageTitle } from "../src/shared/seo";
import { buildSitemapXml, sitemapPages } from "../src/shared/sitemap";
import { isTrackedPath } from "../src/shared/analytics";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHELL = `<!doctype html><html lang="en"><head><title>cv.cm</title><meta name="description" content="x" /><link rel="canonical" href="https://cv.cm/" /></head><body><div id="app"></div></body></html>`;

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

/** Keys and array lengths, not text. */
function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]));
  return typeof value;
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

const placeholders = (text: string): string[] => [...text.matchAll(/\{[a-z]+\}/gi)].map((m) => m[0]).sort();

/** Block kinds per section: translations keep the master's sections, though list lengths may differ. */
function structure(copy: IdeaEntryCopy): { sections: number; faq: number; kinds: string[][] } {
  const block = (b: KbBlock): string => {
    if (typeof b === "string") return "p";
    if ("ul" in b) return "ul";
    if ("ol" in b) return "ol";
    if ("table" in b) return "table";
    if ("code" in b) return "code";
    return "note";
  };
  return { sections: copy.sections.length, faq: copy.faq.length, kinds: copy.sections.map((s) => [...new Set(s.body.map(block))].sort()) };
}

describe("ideas: catalog", () => {
  it("puts every idea in exactly one group, with meta and valid related ids", () => {
    const grouped = IDEA_GROUPS.flatMap((g) => g.entries as readonly string[]);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(grouped).toEqual([...IDEA_ENTRIES]);
    expect(Object.keys(IDEA_META).sort()).toEqual([...IDEA_ENTRIES].sort());
    for (const id of IDEA_ENTRIES) {
      expect(id, id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      const meta = IDEA_META[id];
      expect([1, 2, 3], id).toContain(meta.startup);
      expect(["online", "local"], id).toContain(meta.where);
      expect(meta.related.length, id).toBeGreaterThan(0);
      for (const other of meta.related) expect(isIdeaId(other) && other !== id, `${id} related ${other}`).toBe(true);
      expect(new Set(meta.related).size, id).toBe(meta.related.length);
      for (const source of meta.sources) {
        expect(source.name.trim(), id).toBeTruthy();
        expect(source.url, id).toMatch(/^https:\/\/[^\s"<>]+$/);
      }
    }
    for (const id of IDEAS_FOCUS) expect(isIdeaId(id), id).toBe(true);
  });

  it("has search keywords for every idea in every locale", () => {
    const keywords = readJson("scripts/ideas/keywords.json") as Record<string, Record<string, string[]>>;
    expect(Object.keys(keywords).sort()).toEqual([...IDEA_ENTRIES].sort());
    for (const id of IDEA_ENTRIES) for (const locale of LOCALES) expect(keywords[id][locale]?.length, `${id} ${locale}`).toBeGreaterThan(0);
  });

  it("keeps the footer's idea names equal to each idea's name", () => {
    for (const locale of LOCALES) {
      const names = (readJson(`src/locales/${locale}.json`) as { ideasFocus: Record<string, string> }).ideasFocus;
      expect(Object.keys(names).sort()).toEqual([...IDEAS_FOCUS].sort());
      for (const id of IDEAS_FOCUS) expect(names[id], `${locale} ${id}`).toBe((readJson(`src/locales/ideas/${locale}/${id}.json`) as { name: string }).name);
    }
  });
});

describe("ideas: data snapshot", () => {
  it("covers every idea with derived values only (no raw volumes or bids)", () => {
    expect(snapshot.fetched).toBe(IDEAS_DATA_FETCHED);
    expect(snapshot.from).toMatch(/^\d{4}-\d{2}$/);
    expect(snapshot.to).toMatch(/^\d{4}-\d{2}$/);
    expect(Object.keys(snapshot.ideas).sort()).toEqual([...IDEA_ENTRIES].sort());
    for (const id of IDEA_ENTRIES) {
      const d = ideaData("en", id);
      expect(d, id).not.toBeNull();
      if (!d) continue;
      expect(d.idx.length, id).toBe(48);
      expect(Math.max(...d.idx), id).toBe(100);
      for (const v of d.idx) expect(v >= 0 && v <= 100, id).toBe(true);
      expect(d.fc.length, id).toBe(12);
      d.fc.forEach((v, i) => expect(d.fcLo[i] <= v && v <= d.fcHi[i], `${id} band ${i}`).toBe(true));
      expect(d.demand >= 0 && d.demand <= snapshot.bands.demand.length, id).toBe(true);
      for (const s of Object.values(d.scores)) expect(Number.isInteger(s) && s >= 0 && s <= 100, id).toBe(true);
      expect(["low", "medium", "high", null], id).toContain(d.competition);
      expect(d.yoy === null || Number.isInteger(d.yoy), id).toBe(true);
      for (const lang of Object.keys(d.langs)) expect(LOCALES as readonly string[], `${id} ${lang}`).toContain(lang);
    }
    // Nothing that looks like a raw Keyword Planner field.
    const text = JSON.stringify(snapshot);
    for (const key of ['"avg"', '"lo"', '"hi"', '"ci"', '"h"']) expect(text).not.toContain(key);
  });

  it("ranks by outlook score and labels the outlook from momentum", () => {
    const ranked = rankedIdeas("en");
    expect(ranked.length).toBe(IDEA_ENTRIES.length);
    for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1].data.scores.total).toBeGreaterThanOrEqual(ranked[i].data.scores.total);
    const d = ideaData("en", IDEA_ENTRIES[0])!;
    expect(ideaOutlook({ ...d, scores: { ...d.scores, momentum: 70 } })).toBe("up");
    expect(ideaOutlook({ ...d, scores: { ...d.scores, momentum: 50 } })).toBe("flat");
    expect(ideaOutlook({ ...d, scores: { ...d.scores, momentum: 30 } })).toBe("down");
    expect(pct("en", 12)).toBe("+12%");
    expect(pct("en", -5)).toBe("−5%");
    expect(pct("en", 0)).toBe("0%");
  });

  it("draws the chart as a script-free SVG with history, forecast and band", () => {
    const svg = ideaChartSvg("en", ideaData("en", "vending-machine")!, ideasData("en").from);
    expect(svg).toContain('class="idea-line"');
    expect(svg).toContain('class="idea-fc"');
    expect(svg).toContain('class="idea-band"');
    expect(svg).not.toMatch(/NaN|undefined|<script/);
    // One year label per January in the window.
    expect(svg.match(/text-anchor="middle"/g)?.length).toBeGreaterThanOrEqual(4);
  });
});

describe("ideas: content", () => {
  it("has every idea in every locale, with the master's structure", () => {
    for (const locale of LOCALES) {
      expect(existsSync(join(root, `src/locales/ideas/${locale}.json`)), `${locale}.json`).toBe(true);
      for (const id of IDEA_ENTRIES) {
        const path = `src/locales/ideas/${locale}/${id}.json`;
        expect(existsSync(join(root, path)), path).toBe(true);
        const copy = readJson(path) as IdeaEntryCopy;
        const master = readJson(`src/locales/ideas/en/${id}.json`) as IdeaEntryCopy;
        expect(Object.keys(copy).sort(), path).toEqual(Object.keys(master).sort());
        expect(structure(copy), path).toEqual(structure(master));
        expect(ideaCopy(locale, id), path).toEqual(copy);
      }
    }
  });

  it("keeps idea copy well formed", () => {
    for (const locale of LOCALES) {
      for (const id of IDEA_ENTRIES) {
        const copy = ideaCopy(locale, id);
        const where = `${locale} ${id}`;
        for (const key of ["name", "blurb", "title", "description", "h1", "answer"] as const) expect(copy[key].trim(), `${where} ${key}`).toBeTruthy();
        expect(copy.title, where).not.toContain("cv.cm");
        expect(copy.faq.length, where).toBe(3);
        expect(copy.sections.length, where).toBe(6);
        for (const text of strings(copy)) {
          expect(text, `${where}: backtick`).not.toContain("`");
          expect(text, `${where}: markup`).not.toMatch(/<[a-z/]|\*\*|https?:\/\//i);
          expect(text, `${where}: cv.cm`).not.toMatch(/cv\.cm/i);
        }
        for (const section of copy.sections) {
          for (const block of section.body) {
            if (typeof block === "object" && "table" in block) {
              for (const row of block.table.rows) expect(row.length, `${where} table`).toBe(block.table.head.length);
            }
          }
        }
      }
    }
  }, 30_000);

  it("has hub packs with the same keys and placeholders as English", () => {
    for (const locale of LOCALES) {
      const hub = readJson(`src/locales/ideas/${locale}.json`);
      expect(shape(hub), locale).toEqual(shape(enHub));
      const en = strings(enHub);
      const local = strings(hub);
      en.forEach((text, i) => expect(placeholders(local[i]), `${locale}: ${text}`).toEqual(placeholders(text)));
    }
  });
});

describe("ideas: ideas:sync (run `npm run ideas:sync` after editing ideas)", () => {
  it("has the generated files in step with the ideas", () => {
    const read = (path: string): string | null => (existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : null);
    const { files, missing } = ideasSyncFiles(read);
    expect(missing).toEqual([]);
    for (const [path, content] of Object.entries(files)) expect(read(path), `${path} is stale: run npm run ideas:sync`).toBe(content);
  });

  it("ships names, blurbs and the data snapshot in every pack", async () => {
    for (const locale of LOCALES) {
      const pack = ideasMessages(locale);
      for (const id of IDEA_ENTRIES) expect(pack.list[id], `${locale} ${id}`).toEqual({ name: ideaCopy(locale, id).name, blurb: ideaCopy(locale, id).blurb });
      expect(pack.data.fetched).toBe(snapshot.fetched);
      const { IDEA_LOADERS } = await import(`../src/locales/ideas/loaders/${locale}.ts`);
      expect(Object.keys(IDEA_LOADERS).sort(), locale).toEqual([...IDEA_ENTRIES].sort());
    }
  });

  it("preloads the ideas pack on the hub, plus the loader table and one idea on an idea page", () => {
    const packs = { en: ["/a/en.js"], "ideas-en": ["/a/ideas-en.js"], "ideas-en/loaders": ["/a/loaders.js"], "ideas-en/laundromat": ["/a/laundromat.js"], "ideas-en/car-wash": ["/a/car-wash.js"] };
    const hub = preloadLocalePack("<head></head>", "en", false, packs, false, false, null, null, null, "hub");
    expect(hub).toContain("/a/ideas-en.js");
    expect(hub).not.toContain("/a/loaders.js");
    const entry = preloadLocalePack("<head></head>", "en", false, packs, false, false, null, null, null, "laundromat");
    expect(entry).toContain("/a/ideas-en.js");
    expect(entry).toContain("/a/loaders.js");
    expect(entry).toContain("/a/laundromat.js");
    expect(entry).not.toContain("/a/car-wash.js");
    expect(preloadLocalePack("<head></head>", "en", false, packs)).not.toContain("ideas-en");
  });
});

describe("ideas: routes", () => {
  it("parses and round-trips locale and bare paths", () => {
    expect(parseAppPath("/en/ideas/")).toEqual({ kind: "ideas", locale: "en", entry: null });
    expect(parseAppPath("/zh-cn/ideas/3d-printing/")).toEqual({ kind: "ideas", locale: "zh-CN", entry: "3d-printing" });
    expect(parseAppPath("/ideas/")).toEqual({ kind: "bare-ideas", entry: null });
    expect(parseAppPath("/ideas/amazon-fba")).toEqual({ kind: "bare-ideas", entry: "amazon-fba" });
    expect(parseAppPath("/en/ideas/nope/")).toEqual({ kind: "unknown" });
    expect(parseAppPath("/en/ideas/amazon-fba/x/")).toEqual({ kind: "unknown" });
    expect(parseAppPath("/en/ideas/Amazon-FBA/")).toEqual({ kind: "ideas", locale: "en", entry: "amazon-fba" });
    expect(ideasHref("zh-TW")).toBe("/zh-tw/ideas/");
    expect(ideasHref("ja", "laundromat")).toBe("/ja/ideas/laundromat/");
    for (const locale of LOCALES) {
      expect(parseAppPath(ideasHref(locale))).toEqual({ kind: "ideas", locale, entry: null });
      for (const id of IDEA_ENTRIES) expect(parseAppPath(ideasHref(locale, id))).toEqual({ kind: "ideas", locale, entry: id });
    }
  });

  it("redirects bare paths, adds the slash, 404s unknown ideas and serves the page", async () => {
    const assets = { fetch: async () => new Response(SHELL, { headers: { "Content-Type": "text/html; charset=utf-8" } }) };
    const bare = await worker.fetch(new Request("https://cv.cm/ideas/amazon-fba/", { headers: { "Accept-Language": "zh-CN" } }), { ASSETS: assets });
    expect(bare.status).toBe(302);
    expect(bare.headers.get("Location")).toBe("https://cv.cm/zh-cn/ideas/amazon-fba/");
    const slash = await worker.fetch(new Request("https://cv.cm/en/ideas/amazon-fba"), { ASSETS: assets });
    expect(slash.status).toBe(301);
    expect(slash.headers.get("Location")).toBe("https://cv.cm/en/ideas/amazon-fba/");
    const upper = await worker.fetch(new Request("https://cv.cm/en/ideas/Amazon-FBA/"), { ASSETS: assets });
    expect(upper.status).toBe(301);
    expect(upper.headers.get("Location")).toBe("https://cv.cm/en/ideas/amazon-fba/");
    const unknown = await worker.fetch(new Request("https://cv.cm/en/ideas/nope/"), { ASSETS: assets });
    expect(unknown.status).toBe(404);
    const hub = await worker.fetch(new Request("https://cv.cm/es/ideas/"), { ASSETS: assets });
    expect(hub.status).toBe(200);
    const hubHtml = await hub.text();
    expect(hubHtml).toContain(`<title>${pageTitle("es", { ideas: true }).replace(/&/g, "&amp;")}</title>`);
    expect(hubHtml).toContain('<meta property="og:type" content="website" />');
    expect(hubHtml).toContain('id="ranking"');
    const page = await worker.fetch(new Request("https://cv.cm/zh-cn/ideas/vending-machine/"), { ASSETS: assets });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('<link rel="canonical" href="https://cv.cm/zh-cn/ideas/vending-machine/"');
    expect(html).toContain('<meta property="og:type" content="article" />');
    expect(html).toContain('hreflang="x-default" href="https://cv.cm/en/ideas/vending-machine/"');
    expect(html).toContain('class="idea-panel"');
    for (const id of ["breadcrumb-jsonld", "faq-jsonld", "article-jsonld"]) expect(html).toContain(`id="${id}"`);
    expect(html).not.toContain('id="howto-jsonld"');
    expect(html).not.toContain('id="software-jsonld"');
  });

  it("is in the sitemap with every locale and a lastmod, and tracked by analytics", () => {
    const pages = sitemapPages().filter((p) => p.kind === "ideas");
    const xml = buildSitemapXml(pages);
    expect(xml.match(/<url>/g)?.length).toBe(LOCALES.length * (IDEA_ENTRIES.length + 1));
    expect(xml.match(/<lastmod>/g)?.length).toBe(LOCALES.length * (IDEA_ENTRIES.length + 1));
    const lastmod = [ideaPublished("laundromat"), IDEAS_DATA_FETCHED].sort().at(-1);
    expect(xml).toContain(`<loc>https://cv.cm/vi/ideas/laundromat/</loc>\n    <lastmod>${lastmod}</lastmod>`);
    expect(xml).toContain('hreflang="zh-TW" href="https://cv.cm/zh-tw/ideas/car-wash/"');
    expect(readFileSync(join(root, "public/sitemaps/ideas.xml"), "utf8")).toBe(xml);
    expect(readFileSync(join(root, "public/sitemap.xml"), "utf8")).toContain("https://cv.cm/sitemaps/ideas.xml");
    expect(isTrackedPath("/en/ideas/laundromat/")).toBe(true);
  });
});

describe("ideas: page HTML and SEO", () => {
  it("renders the hub and every idea in every locale", () => {
    for (const locale of LOCALES) {
      const hub = ideasPageHtml(locale, null);
      for (const group of IDEA_GROUPS) expect(hub, locale).toContain(`<section class="wall" id="${group.id}">`);
      for (const id of IDEA_ENTRIES) expect(hub, `${locale} ${id}`).toContain(`href="${ideasHref(locale, id)}" data-nav="ideas-${id}"`);
      expect(hub).toContain('id="method"');
      expect(hub).toContain('<section class="faq"');
      expect(hub).not.toMatch(/\{[a-z]+\}/);
      for (const id of IDEA_ENTRIES) {
        const html = ideasPageHtml(locale, id);
        const copy = ideaCopy(locale, id);
        expect(html, `${locale} ${id}`).toContain(`href="${ideasHref(locale)}" data-nav="ideas"`);
        expect(html).toContain('<section class="kb-answer"');
        expect(html).toContain('class="idea-panel"');
        expect(html.match(/<section class="kb-section"/g)?.length).toBe(copy.sections.length);
        for (const other of IDEA_META[id].related) expect(html).toContain(`href="${ideasHref(locale, other)}"`);
        for (const source of IDEA_META[id].sources) expect(html).toContain(`href="${source.url.replace(/&/g, "&amp;")}"`);
        expect(html).not.toMatch(/<(script|iframe)/i);
        expect(html).not.toMatch(/\{[a-z]+\}|NaN|undefined/);
      }
    }
  }, 30_000);

  it("titles, canonicals and JSON-LD", () => {
    for (const locale of LOCALES) {
      expect(ideaTitle(locale, "laundromat")).toBe(`${ideaCopy(locale, "laundromat").title} — cv.cm`);
      expect(pageTitle(locale, { ideas: true })).toBe(`${ideasMessages(locale).hub.title.replace("{n}", String(IDEA_ENTRIES.length)).replace("{year}", ideasData(locale).fetched.slice(0, 4))} — cv.cm`);
      expect(pageTitle(locale, { ideas: true }), locale).toContain(String(IDEA_ENTRIES.length));
      expect(pageDescription(locale, { ideas: true }), locale).toContain(String(IDEA_ENTRIES.length));
      expect(pageDescription(locale, { ideas: true }), locale).not.toContain("{n}");
    }
    expect(pageCanonical("en", { ideas: true })).toBe("https://cv.cm/en/ideas/");
    expect(pageCanonical("zh-CN", { ideas: true, ideaId: "car-wash" })).toBe("https://cv.cm/zh-cn/ideas/car-wash/");
    const ld = ideasArticleJsonLd("ko", "laundromat") as Record<string, unknown>;
    expect(ld["@type"]).toBe("Article");
    expect(ld.datePublished).toBe(ideaPublished("laundromat"));
    expect(ld.inLanguage).toBe("ko");
    expect(ld.headline).toBe(ideaCopy("ko", "laundromat").h1);
    expect(ld.articleSection).toBe(ideasMessages("ko").hub.groups[ideaGroupOf("laundromat")]);
    const hub = ideasArticleJsonLd("en", null) as { "@type": string; mainEntity: { "@type": string; itemListElement: { url: string }[] } };
    expect(hub["@type"]).toBe("CollectionPage");
    expect(hub.mainEntity["@type"]).toBe("ItemList");
    expect(hub.mainEntity.itemListElement.length).toBe(IDEA_ENTRIES.length);
    expect(hub.mainEntity.itemListElement[0].url).toBe(`https://cv.cm${ideasHref("en", rankedIdeas("en")[0].id)}`);
    const html = applyHtmlSeo(SHELL, "id", { ideas: true, ideaId: "laundromat" });
    expect(html).toContain('<div id="app"><nav class="device-crumb"');
    expect(html).toContain('class="idea-panel"');
  });

  it("has the nav label in every core pack", () => {
    const expected: Record<Locale, string> = { en: "Ideas", "zh-CN": "创意", "zh-TW": "創意", ja: "アイデア", ko: "아이디어", vi: "Ý tưởng", id: "Ide", es: "Ideas" };
    for (const locale of LOCALES) expect((messages(locale).ui.nav as Record<string, string>).ideas).toBe(expected[locale]);
  });
});
