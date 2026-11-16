import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import enHub from "../src/locales/nostalgia/en.json";
import worker from "../src/worker";
import { LOCALES, type Locale } from "../src/shared/locale";
import { preloadLocalePack } from "../src/shared/locale-preload";
import { messages, nostalgiaMessages } from "../src/shared/messages";
import { nostalgiaHref, parseAppPath } from "../src/shared/path";
import {
  NOSTALGIA_ENTRIES,
  NOSTALGIA_FOCUS,
  NOSTALGIA_GROUPS,
  NOSTALGIA_LINKS,
  NOSTALGIA_UPDATED,
  isNostalgiaId,
  nostalgiaGroupOf,
  nostalgiaPublished,
} from "../src/shared/nostalgia";
import { NOSTALGIA_META } from "../src/shared/nostalgia-meta";
import { nostalgiaArticleJsonLd, nostalgiaCopy, nostalgiaPageHtml, nostalgiaTitle, type NostalgiaEntryCopy } from "../src/shared/nostalgia-i18n";
import { nostalgiaSyncFiles } from "../src/shared/nostalgia-sync";
import type { KbBlock } from "../src/shared/kb-i18n";
import { fill } from "../src/shared/fill";
import { pageCanonical, pageDescription, pageTitle } from "../src/shared/seo";
import { applyHtmlSeo } from "../src/shared/seo-html";
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
function structure(copy: NostalgiaEntryCopy): { sections: number; faq: number; kinds: string[][] } {
  const block = (b: KbBlock): string => {
    if (typeof b === "string") return "p";
    if ("ul" in b) return "ul";
    if ("ol" in b) return "ol";
    if ("table" in b) return "table";
    if ("code" in b) return "code";
    return "note";
  };
  // Block by block, so a translation that merges or drops a paragraph fails, not only one that drops a block kind.
  return { sections: copy.sections.length, faq: copy.faq.length, kinds: copy.sections.map((s) => s.body.map(block)) };
}

/** Chinese childhood items are mastered in zh-CN; Western and worldwide ones in en. */
const masterOf = (id: (typeof NOSTALGIA_ENTRIES)[number]): Locale => (NOSTALGIA_META[id].region === "cn" ? "zh-CN" : "en");

describe("nostalgia: catalog", () => {
  it("puts every entry in exactly one group, with meta and valid related ids", () => {
    const grouped = NOSTALGIA_GROUPS.flatMap((g) => g.entries as readonly string[]);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(grouped).toEqual([...NOSTALGIA_ENTRIES]);
    expect(Object.keys(NOSTALGIA_META).sort()).toEqual([...NOSTALGIA_ENTRIES].sort());
    for (const id of NOSTALGIA_ENTRIES) {
      expect(id, id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      const meta = NOSTALGIA_META[id];
      expect(meta.term.trim(), id).toBeTruthy();
      expect(["cn", "west", "global"], id).toContain(meta.region);
      expect(meta.from, id).toMatch(/^\d{4}s?$/);
      if (meta.to !== null) {
        expect(meta.to, id).toMatch(/^\d{4}s?$/);
        expect(Number.parseInt(meta.to, 10), id).toBeGreaterThanOrEqual(Number.parseInt(meta.from, 10));
      }
      expect([null, "available", "revived", "discontinued"], id).toContain(meta.status);
      // A thing that ended has an end year, or a status saying so; never "to today" next to "discontinued".
      if (meta.to !== null && meta.status !== null) expect(meta.status, id).not.toBe("available");
      expect(meta.related.length, id).toBe(3);
      for (const other of meta.related) expect(isNostalgiaId(other) && other !== id, `${id} related ${other}`).toBe(true);
      expect(new Set(meta.related).size, id).toBe(meta.related.length);
      expect(meta.sources.length, id).toBeGreaterThan(0);
      for (const source of meta.sources) {
        expect(source.name.trim(), id).toBeTruthy();
        // https everywhere except the 文曲星 maker's official site, which serves no https.
        expect(source.url, id).toMatch(source.url.startsWith("http://www.ggv.com.cn/") ? /^http:\/\/[^\s"<>]+$/ : /^https:\/\/[^\s"<>]+$/);
      }
    }
    for (const id of NOSTALGIA_FOCUS) expect(isNostalgiaId(id), id).toBe(true);
    for (const id of Object.keys(NOSTALGIA_LINKS)) expect(isNostalgiaId(id), id).toBe(true);
  });

  it("keeps the footer's entry names equal to each entry's name", () => {
    for (const locale of LOCALES) {
      const names = (readJson(`src/locales/${locale}.json`) as { nostalgiaFocus: Record<string, string> }).nostalgiaFocus;
      expect(Object.keys(names).sort()).toEqual([...NOSTALGIA_FOCUS].sort());
      for (const id of NOSTALGIA_FOCUS) expect(names[id], `${locale} ${id}`).toBe((readJson(`src/locales/nostalgia/${locale}/${id}.json`) as { name: string }).name);
    }
  });
});

describe("nostalgia: content", () => {
  it("has every entry in every locale, with the master's structure", () => {
    for (const locale of LOCALES) {
      expect(existsSync(join(root, `src/locales/nostalgia/${locale}.json`)), `${locale}.json`).toBe(true);
      for (const id of NOSTALGIA_ENTRIES) {
        const path = `src/locales/nostalgia/${locale}/${id}.json`;
        expect(existsSync(join(root, path)), path).toBe(true);
        const copy = readJson(path) as NostalgiaEntryCopy;
        const master = readJson(`src/locales/nostalgia/${masterOf(id)}/${id}.json`) as NostalgiaEntryCopy;
        expect(Object.keys(copy).sort(), path).toEqual(Object.keys(master).sort());
        // en and zh-CN were both written from sources, so only the six translated locales must match the master.
        if (locale !== "en" && locale !== "zh-CN") expect(structure(copy), path).toEqual(structure(master));
        expect(nostalgiaCopy(locale, id), path).toEqual(copy);
      }
    }
  });

  it("keeps entry copy well formed", () => {
    for (const locale of LOCALES) {
      for (const id of NOSTALGIA_ENTRIES) {
        const copy = nostalgiaCopy(locale, id);
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
      const hub = readJson(`src/locales/nostalgia/${locale}.json`);
      expect(shape(hub), locale).toEqual(shape(enHub));
      const en = strings(enHub);
      const local = strings(hub);
      en.forEach((text, i) => expect(placeholders(local[i]), `${locale}: ${text}`).toEqual(placeholders(text)));
    }
  });
});

describe("nostalgia: nostalgia:sync (run `npm run nostalgia:sync` after editing entries)", () => {
  it("has the generated files in step with the entries", () => {
    const read = (path: string): string | null => (existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : null);
    const { files, missing } = nostalgiaSyncFiles(read);
    expect(missing).toEqual([]);
    for (const [path, content] of Object.entries(files)) expect(read(path), `${path} is stale: run npm run nostalgia:sync`).toBe(content);
  });

  it("ships names and blurbs in every pack", async () => {
    for (const locale of LOCALES) {
      const pack = nostalgiaMessages(locale);
      for (const id of NOSTALGIA_ENTRIES) {
        expect(pack.list[id], `${locale} ${id}`).toEqual({ name: nostalgiaCopy(locale, id).name, blurb: nostalgiaCopy(locale, id).blurb });
      }
      const { NOSTALGIA_LOADERS } = await import(`../src/locales/nostalgia/loaders/${locale}.ts`);
      expect(Object.keys(NOSTALGIA_LOADERS).sort(), locale).toEqual([...NOSTALGIA_ENTRIES].sort());
    }
  });

  it("preloads the nostalgia pack on the hub, plus the loader table and one entry on an entry", () => {
    const packs = { en: ["/a/en.js"], "nostalgia-en": ["/a/n-en.js"], "nostalgia-en/loaders": ["/a/loaders.js"], "nostalgia-en/famicom": ["/a/famicom.js"], "nostalgia-en/pager": ["/a/pager.js"] };
    const hub = preloadLocalePack("<head></head>", "en", false, packs, false, false, null, null, null, null, null, "hub");
    expect(hub).toContain("/a/n-en.js");
    expect(hub).not.toContain("/a/loaders.js");
    const entry = preloadLocalePack("<head></head>", "en", false, packs, false, false, null, null, null, null, null, "famicom");
    expect(entry).toContain("/a/n-en.js");
    expect(entry).toContain("/a/loaders.js");
    expect(entry).toContain("/a/famicom.js");
    expect(entry).not.toContain("/a/pager.js");
    expect(preloadLocalePack("<head></head>", "en", false, packs)).not.toContain("n-en");
  });
});

describe("nostalgia: routes", () => {
  it("parses and round-trips locale and bare paths", () => {
    expect(parseAppPath("/en/nostalgia/")).toEqual({ kind: "nostalgia", locale: "en", entry: null });
    expect(parseAppPath("/zh-cn/nostalgia/tangseng-rou/")).toEqual({ kind: "nostalgia", locale: "zh-CN", entry: "tangseng-rou" });
    expect(parseAppPath("/nostalgia/")).toEqual({ kind: "bare-nostalgia", entry: null });
    expect(parseAppPath("/nostalgia/famicom")).toEqual({ kind: "bare-nostalgia", entry: "famicom" });
    expect(parseAppPath("/en/nostalgia/nope/")).toEqual({ kind: "unknown" });
    expect(parseAppPath("/en/nostalgia/famicom/x/")).toEqual({ kind: "unknown" });
    expect(parseAppPath("/en/nostalgia/Famicom/")).toEqual({ kind: "nostalgia", locale: "en", entry: "famicom" });
    expect(parseAppPath("/nostalgia/Y2K/")).toEqual({ kind: "bare-nostalgia", entry: "y2k" });
    expect(nostalgiaHref("zh-TW")).toBe("/zh-tw/nostalgia/");
    for (const locale of LOCALES) {
      expect(parseAppPath(nostalgiaHref(locale))).toEqual({ kind: "nostalgia", locale, entry: null });
      for (const id of NOSTALGIA_ENTRIES) expect(parseAppPath(nostalgiaHref(locale, id))).toEqual({ kind: "nostalgia", locale, entry: id });
    }
  });

  it("redirects bare paths, adds the slash, 404s unknown entries and serves the page", async () => {
    const assets = { fetch: async () => new Response(SHELL, { headers: { "Content-Type": "text/html; charset=utf-8" } }) };
    const bare = await worker.fetch(new Request("https://cv.cm/nostalgia/famicom/", { headers: { "Accept-Language": "zh-CN" } }), { ASSETS: assets });
    expect(bare.status).toBe(302);
    expect(bare.headers.get("Location")).toBe("https://cv.cm/zh-cn/nostalgia/famicom/");
    const slash = await worker.fetch(new Request("https://cv.cm/en/nostalgia/pager"), { ASSETS: assets });
    expect(slash.status).toBe(301);
    expect(slash.headers.get("Location")).toBe("https://cv.cm/en/nostalgia/pager/");
    const upper = await worker.fetch(new Request("https://cv.cm/en/nostalgia/Famicom/"), { ASSETS: assets });
    expect(upper.status).toBe(301);
    expect(upper.headers.get("Location")).toBe("https://cv.cm/en/nostalgia/famicom/");
    const unknown = await worker.fetch(new Request("https://cv.cm/en/nostalgia/nope/"), { ASSETS: assets });
    expect(unknown.status).toBe(404);
    const hub = await worker.fetch(new Request("https://cv.cm/es/nostalgia/"), { ASSETS: assets });
    expect(hub.status).toBe(200);
    const hubHtml = await hub.text();
    expect(hubHtml).toContain('<meta property="og:type" content="website" />');
    const page = await worker.fetch(new Request("https://cv.cm/zh-cn/nostalgia/tangseng-rou/"), { ASSETS: assets });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('<link rel="canonical" href="https://cv.cm/zh-cn/nostalgia/tangseng-rou/"');
    expect(html).toContain('<meta property="og:type" content="article" />');
    expect(html).toContain('hreflang="x-default" href="https://cv.cm/en/nostalgia/tangseng-rou/"');
    expect(html).toContain("唐僧肉");
    for (const id of ["breadcrumb-jsonld", "faq-jsonld", "article-jsonld"]) expect(html).toContain(`id="${id}"`);
    expect(html).not.toContain('id="howto-jsonld"');
  });

  it("is in the sitemap with every locale and a lastmod, and tracked by analytics", () => {
    const pages = sitemapPages().filter((p) => p.kind === "nostalgia");
    const xml = buildSitemapXml(pages);
    expect(xml.match(/<url>/g)?.length).toBe(LOCALES.length * (NOSTALGIA_ENTRIES.length + 1));
    expect(xml.match(/<lastmod>/g)?.length).toBe(LOCALES.length * (NOSTALGIA_ENTRIES.length + 1));
    expect(xml).toContain(`<loc>https://cv.cm/vi/nostalgia/pager/</loc>\n    <lastmod>${NOSTALGIA_UPDATED.pager ?? nostalgiaPublished("pager")}</lastmod>`);
    expect(xml).toContain('hreflang="zh-TW" href="https://cv.cm/zh-tw/nostalgia/famicom/"');
    expect(isTrackedPath("/en/nostalgia/famicom/")).toBe(true);
  });
});

describe("nostalgia: page HTML and SEO", () => {
  it("renders the hub and every entry in every locale", () => {
    for (const locale of LOCALES) {
      const hub = nostalgiaPageHtml(locale, null);
      for (const group of NOSTALGIA_GROUPS) expect(hub, locale).toContain(`<section class="wall" id="${group.id}">`);
      for (const id of NOSTALGIA_ENTRIES) expect(hub, `${locale} ${id}`).toContain(`href="${nostalgiaHref(locale, id)}" data-nav="nostalgia-${id}"`);
      expect(hub).toContain('<section class="faq"');
      expect(hub).not.toMatch(/\{[a-z]+\}/);
      for (const id of NOSTALGIA_ENTRIES) {
        const html = nostalgiaPageHtml(locale, id);
        const copy = nostalgiaCopy(locale, id);
        expect(html, `${locale} ${id}`).toContain(`href="${nostalgiaHref(locale)}" data-nav="nostalgia"`);
        expect(html).toContain('<section class="kb-answer"');
        expect(html.match(/<section class="kb-section"/g)?.length).toBe(copy.sections.length);
        for (const other of NOSTALGIA_META[id].related) expect(html).toContain(`href="${nostalgiaHref(locale, other)}"`);
        for (const source of NOSTALGIA_META[id].sources) expect(html).toContain(`href="${source.url.replace(/&/g, "&amp;")}"`);
        expect(html).not.toMatch(/<(script|iframe)/i);
        expect(html, `${locale} ${id}`).not.toMatch(/\{[a-z]+\}|undefined/);
      }
    }
  });

  it("only says \"to today\" for things still sold without a break", () => {
    for (const locale of LOCALES) {
      const ui = nostalgiaMessages(locale).ui;
      for (const id of NOSTALGIA_ENTRIES) {
        const meta = NOSTALGIA_META[id];
        if (meta.status === "available" || meta.to) continue;
        const html = nostalgiaPageHtml(locale, id);
        // Shows "from 1991", never "1991 to today".
        const from = /^\d{4}s$/.test(meta.from) ? fill(ui.decade, { y: meta.from.slice(0, 4) }) : meta.from;
        const shown = fill(ui.from, { from });
        expect(html, `${locale} ${id}`).toContain(`<span>${shown.charAt(0).toLocaleUpperCase(locale) + shown.slice(1)}</span>`);
        // No doubled year word ("1980年代年から").
        expect(html, `${locale} ${id}`).not.toMatch(/年代年|년대년|năm thập niên/);
        expect(html, `${locale} ${id}`).not.toContain(`<span>${fill(ui.since, { from })}</span>`);
        // No end year and not still sold: no temporalCoverage at all (a lone year or decade would claim it existed only then).
        expect((nostalgiaArticleJsonLd(locale, id) as { temporalCoverage?: string }).temporalCoverage, `${locale} ${id}`).toBeUndefined();
      }
    }
  });

  it("links entries to the cv.cm tools and consoles that go with them", () => {
    expect(nostalgiaPageHtml("en", "famicom")).toContain('href="/en/rom-emulator/"');
    expect(nostalgiaPageHtml("en", "famicom")).toContain('href="/en/games/fc/"');
    expect(nostalgiaPageHtml("zh-CN", "fuduji")).toContain('href="/zh-cn/voice-recorder/"');
    expect(nostalgiaPageHtml("en", "tangseng-rou")).not.toContain("rom-emulator");
  });

  it("titles, canonicals and JSON-LD", () => {
    for (const locale of LOCALES) {
      expect(nostalgiaTitle(locale, "famicom")).toBe(`${nostalgiaCopy(locale, "famicom").title} — cv.cm`);
      expect(pageTitle(locale, { nostalgia: true })).toBe(`${nostalgiaMessages(locale).hub.title} — cv.cm`);
      expect(pageDescription(locale, { nostalgia: true }), locale).toContain(String(NOSTALGIA_ENTRIES.length));
    }
    expect(pageCanonical("en", { nostalgia: true })).toBe("https://cv.cm/en/nostalgia/");
    expect(pageCanonical("zh-CN", { nostalgia: true, nostalgiaId: "fuduji" })).toBe("https://cv.cm/zh-cn/nostalgia/fuduji/");
    const ld = nostalgiaArticleJsonLd("ko", "pager") as Record<string, unknown>;
    expect(ld["@type"]).toBe("Article");
    expect(ld.datePublished).toBe("2026-11-15");
    expect(ld.inLanguage).toBe("ko");
    expect(ld.headline).toBe(nostalgiaCopy("ko", "pager").h1);
    expect(ld.about).toMatchObject({ "@type": "Thing", name: nostalgiaCopy("ko", "pager").name });
    expect((nostalgiaArticleJsonLd("en", "famicom") as Record<string, unknown>).temporalCoverage).toBe("1983/2003");
    expect((nostalgiaArticleJsonLd("en", "tamagotchi") as Record<string, unknown>).temporalCoverage).toBe("1996/..");
    // Brought back after a known first run: the header shows 2000–2005 and the status says it is back, so no interval.
    expect(nostalgiaArticleJsonLd("en", "nokia-3310")).not.toHaveProperty("temporalCoverage");
    expect(nostalgiaArticleJsonLd("en", "xiaomaibu")).not.toHaveProperty("temporalCoverage");
    expect(ld.articleSection).toBe(nostalgiaMessages("ko").hub.groups[nostalgiaGroupOf("pager")]);
    const hub = nostalgiaArticleJsonLd("en", null) as { "@type": string; mainEntity: { "@type": string; itemListElement: unknown[] } };
    expect(hub["@type"]).toBe("CollectionPage");
    expect(hub.mainEntity.itemListElement.length).toBe(NOSTALGIA_ENTRIES.length);
    const html = applyHtmlSeo(SHELL, "id", { nostalgia: true, nostalgiaId: "y2k" });
    expect(html).toContain('<div id="app"><nav class="device-crumb"');
    expect(html).toContain('<section class="kb-answer"');
  });

  it("has the nav label in every core pack", () => {
    const expected: Record<Locale, string> = { en: "Nostalgia", "zh-CN": "怀旧", "zh-TW": "懷舊", ja: "懐かしい", ko: "추억", vi: "Hoài niệm", id: "Nostalgia", es: "Nostalgia" };
    for (const locale of LOCALES) expect((messages(locale).ui.nav as Record<string, string>).nostalgia).toBe(expected[locale]);
  });
});
