import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import enHub from "../src/locales/slang/en.json";
import worker from "../src/worker";
import { LOCALES, type Locale } from "../src/shared/locale";
import { preloadLocalePack } from "../src/shared/locale-preload";
import { messages, slangMessages } from "../src/shared/messages";
import { parseAppPath, slangHref } from "../src/shared/path";
import { SLANG_ENTRIES, SLANG_FOCUS, SLANG_GROUPS, SLANG_META, SLANG_PUBLISHED, SLANG_UPDATED, isSlangId, slangGroupOf } from "../src/shared/slang";
import { slangArticleJsonLd, slangCopy, slangPageHtml, slangTitle, type SlangEntryCopy } from "../src/shared/slang-i18n";
import { slangSyncFiles } from "../src/shared/slang-sync";
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
function structure(copy: SlangEntryCopy): { sections: number; faq: number; kinds: string[][] } {
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

describe("slang: catalog", () => {
  it("puts every entry in exactly one group, with meta and valid related ids", () => {
    const grouped = SLANG_GROUPS.flatMap((g) => g.entries as readonly string[]);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(grouped).toEqual([...SLANG_ENTRIES]);
    expect(Object.keys(SLANG_META).sort()).toEqual([...SLANG_ENTRIES].sort());
    for (const id of SLANG_ENTRIES) {
      expect(id, id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      const meta = SLANG_META[id];
      expect(meta.term.trim(), id).toBeTruthy();
      expect(meta.related.length, id).toBeGreaterThan(0);
      for (const other of meta.related) expect(isSlangId(other) && other !== id, `${id} related ${other}`).toBe(true);
      expect(new Set(meta.related).size, id).toBe(meta.related.length);
      for (const source of meta.sources) {
        expect(source.name.trim(), id).toBeTruthy();
        expect(source.url, id).toMatch(/^https?:\/\/[^\s"<>]+$/);
      }
    }
    for (const id of SLANG_FOCUS) expect(isSlangId(id), id).toBe(true);
  });

  it("keeps the footer's entry names equal to each entry's name", () => {
    for (const locale of LOCALES) {
      const names = (readJson(`src/locales/${locale}.json`) as { slangFocus: Record<string, string> }).slangFocus;
      expect(Object.keys(names).sort()).toEqual([...SLANG_FOCUS].sort());
      for (const id of SLANG_FOCUS) expect(names[id], `${locale} ${id}`).toBe((readJson(`src/locales/slang/${locale}/${id}.json`) as { name: string }).name);
    }
  });
});

describe("slang: content", () => {
  it("has every entry in every locale, with the master's structure", () => {
    for (const locale of LOCALES) {
      expect(existsSync(join(root, `src/locales/slang/${locale}.json`)), `${locale}.json`).toBe(true);
      for (const id of SLANG_ENTRIES) {
        const path = `src/locales/slang/${locale}/${id}.json`;
        expect(existsSync(join(root, path)), path).toBe(true);
        const copy = readJson(path) as SlangEntryCopy;
        // Chinese-origin entries are mastered in zh-CN, English ones in en: translations keep the master's sections and block kinds.
        const master = readJson(`src/locales/slang/${SLANG_META[id].origin === "en" ? "en" : "zh-CN"}/${id}.json`) as SlangEntryCopy;
        expect(Object.keys(copy).sort(), path).toEqual(Object.keys(master).sort());
        // en and zh-CN were both written from sources (the other is not a translation of the master), so only the six translated locales must match.
        if (locale !== "en" && locale !== "zh-CN") expect(structure(copy), path).toEqual(structure(master));
        // The registered copy is this locale's own file, not the English fallback.
        expect(slangCopy(locale, id), path).toEqual(copy);
      }
    }
  });

  it("keeps entry copy well formed", () => {
    for (const locale of LOCALES) {
      for (const id of SLANG_ENTRIES) {
        const copy = slangCopy(locale, id);
        const where = `${locale} ${id}`;
        for (const key of ["name", "blurb", "title", "description", "h1", "answer"] as const) expect(copy[key].trim(), `${where} ${key}`).toBeTruthy();
        expect(copy.title, where).not.toContain(" — cv.cm");
        expect(copy.title, where).not.toMatch(/\|\s*cv\.cm/);
        expect(copy.faq.length, where).toBe(3);
        expect(copy.sections.length, where).toBeGreaterThanOrEqual(3);
        expect(copy.sections.length, where).toBeLessThanOrEqual(5);
        expect(Array.isArray(copy.aka), where).toBe(true);
        for (const text of strings(copy)) {
          expect(text, `${where}: backtick`).not.toContain("`");
          expect(text, `${where}: markup`).not.toMatch(/<[a-z/]|\*\*|https?:\/\//i);
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

  it("puts the searched phrase at the start of each Chinese title", () => {
    for (const id of SLANG_ENTRIES) {
      expect(slangCopy("zh-CN", id).title, id).toMatch(/是什么意思/);
      expect(slangCopy("zh-TW", id).title, id).toMatch(/是什麼意思/);
    }
  });

  it("has hub packs with the same keys and placeholders as English", () => {
    for (const locale of LOCALES) {
      const hub = readJson(`src/locales/slang/${locale}.json`);
      expect(shape(hub), locale).toEqual(shape(enHub));
      const en = strings(enHub);
      const local = strings(hub);
      en.forEach((text, i) => expect(placeholders(local[i]), `${locale}: ${text}`).toEqual(placeholders(text)));
    }
  });
});

describe("slang: slang:sync (run `npm run slang:sync` after editing entries)", () => {
  it("has the generated files in step with the entries", () => {
    const read = (path: string): string | null => (existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : null);
    const { files, missing } = slangSyncFiles(read);
    expect(missing).toEqual([]);
    for (const [path, content] of Object.entries(files)) expect(read(path), `${path} is stale: run npm run slang:sync`).toBe(content);
  });

  it("ships names and blurbs in every pack", async () => {
    for (const locale of LOCALES) {
      const pack = slangMessages(locale);
      for (const id of SLANG_ENTRIES) {
        expect(pack.list[id], `${locale} ${id}`).toEqual({ name: slangCopy(locale, id).name, blurb: slangCopy(locale, id).blurb });
      }
      const { SLANG_LOADERS } = await import(`../src/locales/slang/loaders/${locale}.ts`);
      expect(Object.keys(SLANG_LOADERS).sort(), locale).toEqual([...SLANG_ENTRIES].sort());
    }
  });

  it("preloads the slang pack on the hub, plus the loader table and one entry on an entry", () => {
    const packs = { en: ["/a/en.js"], "slang-en": ["/a/slang-en.js"], "slang-en/loaders": ["/a/loaders.js"], "slang-en/yyds": ["/a/yyds.js"], "slang-en/emo": ["/a/emo.js"] };
    const hub = preloadLocalePack("<head></head>", "en", false, packs, false, false, null, null, "hub");
    expect(hub).toContain("/a/slang-en.js");
    expect(hub).not.toContain("/a/loaders.js");
    const entry = preloadLocalePack("<head></head>", "en", false, packs, false, false, null, null, "yyds");
    expect(entry).toContain("/a/slang-en.js");
    expect(entry).toContain("/a/loaders.js");
    expect(entry).toContain("/a/yyds.js");
    expect(entry).not.toContain("/a/emo.js");
    expect(preloadLocalePack("<head></head>", "en", false, packs)).not.toContain("slang-en");
  });
});

describe("slang: routes", () => {
  it("parses and round-trips locale and bare paths", () => {
    expect(parseAppPath("/en/slang/")).toEqual({ kind: "slang", locale: "en", entry: null });
    expect(parseAppPath("/zh-cn/slang/334424044/")).toEqual({ kind: "slang", locale: "zh-CN", entry: "334424044" });
    expect(parseAppPath("/slang/")).toEqual({ kind: "bare-slang", entry: null });
    expect(parseAppPath("/slang/yyds")).toEqual({ kind: "bare-slang", entry: "yyds" });
    expect(parseAppPath("/en/slang/nope/")).toEqual({ kind: "unknown" });
    expect(parseAppPath("/en/slang/yyds/x/")).toEqual({ kind: "unknown" });
    expect(parseAppPath("/en/slang/FOMO/")).toEqual({ kind: "slang", locale: "en", entry: "fomo" });
    expect(slangHref("zh-TW")).toBe("/zh-tw/slang/");
    expect(slangHref("ja", "67")).toBe("/ja/slang/67/");
    for (const locale of LOCALES) {
      expect(parseAppPath(slangHref(locale))).toEqual({ kind: "slang", locale, entry: null });
      for (const id of SLANG_ENTRIES) expect(parseAppPath(slangHref(locale, id))).toEqual({ kind: "slang", locale, entry: id });
    }
  });

  it("redirects bare paths, adds the slash, 404s unknown entries and serves the page", async () => {
    const assets = { fetch: async () => new Response(SHELL, { headers: { "Content-Type": "text/html; charset=utf-8" } }) };
    const bare = await worker.fetch(new Request("https://cv.cm/slang/yyds/", { headers: { "Accept-Language": "zh-CN" } }), { ASSETS: assets });
    expect(bare.status).toBe(302);
    expect(bare.headers.get("Location")).toBe("https://cv.cm/zh-cn/slang/yyds/");
    const slash = await worker.fetch(new Request("https://cv.cm/en/slang/yyds"), { ASSETS: assets });
    expect(slash.status).toBe(301);
    expect(slash.headers.get("Location")).toBe("https://cv.cm/en/slang/yyds/");
    const upper = await worker.fetch(new Request("https://cv.cm/en/slang/FOMO/"), { ASSETS: assets });
    expect(upper.status).toBe(301);
    expect(upper.headers.get("Location")).toBe("https://cv.cm/en/slang/fomo/");
    const unknown = await worker.fetch(new Request("https://cv.cm/en/slang/nope/"), { ASSETS: assets });
    expect(unknown.status).toBe(404);
    const hub = await worker.fetch(new Request("https://cv.cm/es/slang/"), { ASSETS: assets });
    expect(hub.status).toBe(200);
    const hubHtml = await hub.text();
    expect(hubHtml).toContain(`<title>${pageTitle("es", { slang: true }).replace(/&/g, "&amp;")}</title>`);
    expect(hubHtml).toContain('<meta property="og:type" content="website" />');
    const page = await worker.fetch(new Request("https://cv.cm/zh-cn/slang/334424044/"), { ASSETS: assets });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('<link rel="canonical" href="https://cv.cm/zh-cn/slang/334424044/"');
    expect(html).toContain('<meta property="og:type" content="article" />');
    expect(html).toContain('hreflang="x-default" href="https://cv.cm/en/slang/334424044/"');
    expect(html).toContain("334424044是什么意思");
    for (const id of ["breadcrumb-jsonld", "faq-jsonld", "article-jsonld"]) expect(html).toContain(`id="${id}"`);
    expect(html).not.toContain('id="howto-jsonld"');
    expect(html).not.toContain('id="software-jsonld"');
  });

  it("is in the sitemap with every locale and a lastmod, and tracked by analytics", () => {
    const pages = sitemapPages().filter((p) => p.kind === "slang");
    const xml = buildSitemapXml(pages);
    expect(xml.match(/<url>/g)?.length).toBe(LOCALES.length * (SLANG_ENTRIES.length + 1));
    expect(xml.match(/<lastmod>/g)?.length).toBe(LOCALES.length * (SLANG_ENTRIES.length + 1));
    expect(xml).toContain(`<loc>https://cv.cm/vi/slang/yyds/</loc>\n    <lastmod>${SLANG_UPDATED.yyds ?? SLANG_PUBLISHED}</lastmod>`);
    expect(xml).toContain('hreflang="zh-TW" href="https://cv.cm/zh-tw/slang/rizz/"');
    expect(readFileSync(join(root, "public/sitemaps/slang.xml"), "utf8")).toBe(xml);
    expect(readFileSync(join(root, "public/sitemap.xml"), "utf8")).toContain("https://cv.cm/sitemaps/slang.xml");
    expect(isTrackedPath("/en/slang/yyds/")).toBe(true);
  });
});

describe("slang: page HTML and SEO", () => {
  it("renders the hub and every entry in every locale", () => {
    for (const locale of LOCALES) {
      const hub = slangPageHtml(locale, null);
      for (const group of SLANG_GROUPS) expect(hub, locale).toContain(`<section class="wall" id="${group.id}">`);
      for (const id of SLANG_ENTRIES) expect(hub, `${locale} ${id}`).toContain(`href="${slangHref(locale, id)}" data-nav="slang-${id}"`);
      expect(hub).toContain('<section class="faq"');
      expect(hub).not.toMatch(/\{[a-z]+\}/);
      for (const id of SLANG_ENTRIES) {
        const html = slangPageHtml(locale, id);
        const copy = slangCopy(locale, id);
        expect(html, `${locale} ${id}`).toContain(`href="${slangHref(locale)}" data-nav="slang"`);
        expect(html).toContain('<section class="kb-answer"');
        expect(html.match(/<section class="kb-section"/g)?.length).toBe(copy.sections.length);
        for (const other of SLANG_META[id].related) expect(html).toContain(`href="${slangHref(locale, other)}"`);
        for (const source of SLANG_META[id].sources) expect(html).toContain(`href="${source.url.replace(/&/g, "&amp;")}"`);
        expect(html).not.toMatch(/<(script|iframe)/i);
        expect(html).not.toMatch(/\{[a-z]+\}/);
      }
    }
  });

  it("titles, canonicals and JSON-LD", () => {
    for (const locale of LOCALES) {
      expect(slangTitle(locale, "yyds")).toBe(`${slangCopy(locale, "yyds").title} — cv.cm`);
      expect(pageTitle(locale, { slang: true })).toBe(`${slangMessages(locale).hub.title} — cv.cm`);
    }
    expect(pageCanonical("en", { slang: true })).toBe("https://cv.cm/en/slang/");
    for (const locale of LOCALES) {
      expect(pageDescription(locale, { slang: true }), locale).toContain(String(SLANG_ENTRIES.length));
      expect(pageDescription(locale, { slang: true }), locale).not.toContain("{n}");
    }
    expect(pageCanonical("zh-CN", { slang: true, slangId: "neijuan" })).toBe("https://cv.cm/zh-cn/slang/neijuan/");
    const ld = slangArticleJsonLd("ko", "rizz") as Record<string, unknown>;
    expect(ld["@type"]).toBe("Article");
    expect(ld.datePublished).toBe(SLANG_PUBLISHED);
    expect(ld.inLanguage).toBe("ko");
    expect(ld.headline).toBe(slangCopy("ko", "rizz").h1);
    expect(ld.about).toMatchObject({ "@type": "DefinedTerm", name: slangCopy("ko", "rizz").name, inDefinedTermSet: { "@id": "https://cv.cm/ko/slang/#terms" } });
    expect(ld.articleSection).toBe(slangMessages("ko").hub.groups[slangGroupOf("rizz")]);
    const hub = slangArticleJsonLd("en", null) as { "@type": string; mainEntity: { "@type": string; "@id": string; hasDefinedTerm: unknown[] } };
    expect(hub["@type"]).toBe("CollectionPage");
    expect(hub.mainEntity["@type"]).toBe("DefinedTermSet");
    expect(hub.mainEntity["@id"]).toBe("https://cv.cm/en/slang/#terms");
    expect(hub.mainEntity.hasDefinedTerm.length).toBe(SLANG_ENTRIES.length);
    const html = applyHtmlSeo(SHELL, "id", { slang: true, slangId: "yyds" });
    expect(html).toContain('<div id="app"><nav class="device-crumb"');
    expect(html).toContain('<section class="kb-answer"');
  });

  it("has the nav label in every core pack", () => {
    const expected: Record<Locale, string> = { en: "Slang", "zh-CN": "流行语", "zh-TW": "流行語", ja: "スラング", ko: "신조어", vi: "Tiếng lóng", id: "Bahasa gaul", es: "Jerga" };
    for (const locale of LOCALES) expect((messages(locale).ui.nav as Record<string, string>).slang).toBe(expected[locale]);
  });
});
