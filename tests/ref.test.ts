import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import enHub from "../src/locales/ref/en.json";
import photosJson from "../src/data/ref-photos.json";
import worker from "../src/worker";
import { LOCALES, type Locale } from "../src/shared/locale";
import { preloadLocalePack } from "../src/shared/locale-preload";
import { messages, refMessages } from "../src/shared/messages";
import { parseAppPath, refHref } from "../src/shared/path";
import { REF_ENTRIES, REF_GROUPS, REF_META, REF_PUBLISHED, isRefId, mfan8Href, refGroupOf, type RefId } from "../src/shared/ref";
import { refArticleJsonLd, refCopy, refPageHtml, refPhotos, refTitle, type RefEntryCopy, type RefPhoto } from "../src/shared/ref-i18n";
import { refSyncFiles } from "../src/shared/ref-sync";
import type { KbBlock } from "../src/shared/kb-i18n";
import { applyHtmlSeo, pageCanonical, pageTitle } from "../src/shared/seo";
import { buildSitemapXml, sitemapPages } from "../src/shared/sitemap";
import { isTrackedPath } from "../src/shared/analytics";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHELL = `<!doctype html><html lang="en"><head><title>cv.cm</title><meta name="description" content="x" /><link rel="canonical" href="https://cv.cm/" /></head><body><div id="app"></div></body></html>`;
const PHOTOS = photosJson as unknown as Record<string, RefPhoto[]>;

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

/** Block kind and, for lists and tables, their size: an entry's structure, which every locale must share with English. */
function structure(copy: RefEntryCopy): unknown {
  const block = (b: KbBlock): unknown => {
    if (typeof b === "string") return "p";
    if ("ul" in b) return ["ul", b.ul.length];
    if ("ol" in b) return ["ol", b.ol.length];
    if ("table" in b) return ["table", b.table.head.length, b.table.rows.map((row) => row.length)];
    if ("code" in b) return "code";
    return "note";
  };
  return { sections: copy.sections.map((s) => s.body.map(block)), faq: copy.faq.length, aka: Array.isArray(copy.aka) };
}

describe("reference: content", () => {
  it("has every entry in every locale, matching the English structure", () => {
    for (const locale of LOCALES) {
      expect(existsSync(join(root, `src/locales/ref/${locale}.json`)), `${locale}.json`).toBe(true);
      for (const id of REF_ENTRIES) {
        const path = `src/locales/ref/${locale}/${id}.json`;
        expect(existsSync(join(root, path)), path).toBe(true);
        const copy = readJson(path) as RefEntryCopy;
        const en = readJson(`src/locales/ref/en/${id}.json`) as RefEntryCopy;
        expect(Object.keys(copy).sort(), path).toEqual(Object.keys(en).sort());
        expect(structure(copy), path).toEqual(structure(en));
        // The registered copy is this locale's own file, not the English fallback.
        expect(refCopy(locale, id), path).toEqual(copy);
      }
    }
  });

  it("keeps entry copy well formed", () => {
    for (const locale of LOCALES) {
      for (const id of REF_ENTRIES) {
        const copy = refCopy(locale, id);
        const where = `${locale} ${id}`;
        for (const key of ["name", "blurb", "title", "description", "h1", "answer"] as const) expect(copy[key].trim(), `${where} ${key}`).toBeTruthy();
        expect(copy.title, where).not.toContain(" — cv.cm");
        expect(copy.title, where).not.toMatch(/\|\s*cv\.cm/);
        expect(copy.faq.length, where).toBe(3);
        expect(copy.sections.length, where).toBeGreaterThanOrEqual(2);
        for (const text of strings(copy)) {
          expect(text, `${where}: backtick`).not.toContain("`");
          expect(text, `${where}: markup`).not.toMatch(/<[a-z/]|\*\*/i);
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
  });

  it("has hub packs with the same keys and placeholders as English", () => {
    for (const locale of LOCALES) {
      const hub = readJson(`src/locales/ref/${locale}.json`);
      expect(shape(hub), locale).toEqual(shape(enHub));
      const en = strings(enHub);
      const local = strings(hub);
      en.forEach((text, i) => expect(placeholders(local[i]), `${locale}: ${text}`).toEqual(placeholders(text)));
    }
  });
});

describe("reference: catalog", () => {
  it("puts every entry in exactly one group, with meta and valid related ids", () => {
    const grouped = REF_GROUPS.flatMap((g) => g.entries as readonly string[]);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(grouped).toEqual([...REF_ENTRIES]);
    expect(Object.keys(REF_META).sort()).toEqual([...REF_ENTRIES].sort());
    for (const id of REF_ENTRIES) {
      const meta = REF_META[id];
      expect(meta.prompt.length, id).toBeGreaterThan(0);
      expect(meta.mfan8, id).toBeTruthy();
      expect(meta.related.length, id).toBeGreaterThan(0);
      for (const other of meta.related) expect(isRefId(other) && other !== id, `${id} related ${other}`).toBe(true);
      expect(new Set(meta.related).size, id).toBe(meta.related.length);
    }
    expect(mfan8Href("萌点:双马尾")).toBe("https://www.mfan8.com/%E8%90%8C%E7%82%B9:%E5%8F%8C%E9%A9%AC%E5%B0%BE");
  });

  it("has photos only for real entries, with numeric ids and sizes", () => {
    for (const [id, list] of Object.entries(PHOTOS)) {
      expect(isRefId(id), id).toBe(true);
      expect(Array.isArray(list), id).toBe(true);
      expect(list.length, id).toBeLessThanOrEqual(8);
      for (const photo of list) {
        expect(photo.img, id).toMatch(/^\d+$/);
        expect(photo.item, id).toMatch(/^\d+$/);
        expect(Number.isInteger(photo.w) && photo.w > 0, id).toBe(true);
        expect(Number.isInteger(photo.h) && photo.h > 0, id).toBe(true);
      }
    }
  });
});

describe("reference: ref:sync (run `npm run ref:sync` after editing entries)", () => {
  it("has the generated files in step with the entries", () => {
    const read = (path: string): string | null => (existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : null);
    const { files, missing } = refSyncFiles(read);
    expect(missing).toEqual([]);
    for (const [path, content] of Object.entries(files)) expect(read(path), `${path} is stale: run npm run ref:sync`).toBe(content);
  });

  it("ships names, blurbs and the names table in every pack", async () => {
    for (const locale of LOCALES) {
      const pack = refMessages(locale);
      for (const id of REF_ENTRIES) {
        expect(pack.list[id], `${locale} ${id}`).toEqual({ name: refCopy(locale, id).name, blurb: refCopy(locale, id).blurb });
        for (const other of LOCALES) expect(pack.names[id][other], `${locale} ${id} ${other}`).toBe(refCopy(other, id).name);
      }
      const { REF_LOADERS } = await import(`../src/locales/ref/loaders/${locale}.ts`);
      expect(Object.keys(REF_LOADERS), locale).toEqual([...REF_ENTRIES]);
    }
  });

  it("preloads the ref pack on the hub, plus the loader table and one entry on an entry", () => {
    const packs = { en: ["/a/en.js"], "ref-en": ["/a/ref-en.js"], "ref-en/loaders": ["/a/loaders.js"], "ref-en/wink": ["/a/wink.js"], "ref-en/pout": ["/a/pout.js"] };
    const hub = preloadLocalePack("<head></head>", "en", false, packs, false, false, null, "hub");
    expect(hub).toContain("/a/ref-en.js");
    expect(hub).not.toContain("/a/loaders.js");
    const entry = preloadLocalePack("<head></head>", "en", false, packs, false, false, null, "wink");
    expect(entry).toContain("/a/ref-en.js");
    expect(entry).toContain("/a/loaders.js");
    expect(entry).toContain("/a/wink.js");
    expect(entry).not.toContain("/a/pout.js");
    expect(preloadLocalePack("<head></head>", "en", false, packs)).not.toContain("ref-en");
  });
});

describe("reference: routes", () => {
  it("parses and round-trips locale and bare paths", () => {
    expect(parseAppPath("/en/reference/")).toEqual({ kind: "ref", locale: "en", entry: null });
    expect(parseAppPath("/zh-cn/reference/twin-tails/")).toEqual({ kind: "ref", locale: "zh-CN", entry: "twin-tails" });
    expect(parseAppPath("/reference/")).toEqual({ kind: "bare-ref", entry: null });
    expect(parseAppPath("/reference/wink")).toEqual({ kind: "bare-ref", entry: "wink" });
    expect(parseAppPath("/en/reference/nope/")).toEqual({ kind: "unknown" });
    expect(parseAppPath("/en/reference/wink/x/")).toEqual({ kind: "unknown" });
    expect(parseAppPath("/reference/nope/")).toEqual({ kind: "unknown" });
    expect(refHref("zh-TW")).toBe("/zh-tw/reference/");
    expect(refHref("ja", "hanfu")).toBe("/ja/reference/hanfu/");
    for (const locale of LOCALES) {
      expect(parseAppPath(refHref(locale))).toEqual({ kind: "ref", locale, entry: null });
      for (const id of REF_ENTRIES) expect(parseAppPath(refHref(locale, id))).toEqual({ kind: "ref", locale, entry: id });
    }
  });

  it("redirects bare paths, adds the slash, 404s unknown entries and serves the page", async () => {
    const assets = { fetch: async () => new Response(SHELL, { headers: { "Content-Type": "text/html; charset=utf-8" } }) };
    const bare = await worker.fetch(new Request("https://cv.cm/reference/wink/", { headers: { "Accept-Language": "ko" } }), { ASSETS: assets });
    expect(bare.status).toBe(302);
    expect(bare.headers.get("Location")).toBe("https://cv.cm/ko/reference/wink/");
    const slash = await worker.fetch(new Request("https://cv.cm/en/reference/wink"), { ASSETS: assets });
    expect(slash.status).toBe(301);
    expect(slash.headers.get("Location")).toBe("https://cv.cm/en/reference/wink/");
    const unknown = await worker.fetch(new Request("https://cv.cm/en/reference/nope/"), { ASSETS: assets });
    expect(unknown.status).toBe(404);
    const hub = await worker.fetch(new Request("https://cv.cm/es/reference/"), { ASSETS: assets });
    expect(hub.status).toBe(200);
    const hubHtml = await hub.text();
    expect(hubHtml).toContain(`<title>${pageTitle("es", { ref: true }).replace(/&/g, "&amp;")}</title>`);
    expect(hubHtml).toContain('<meta property="og:type" content="website" />');
    const page = await worker.fetch(new Request("https://cv.cm/ja/reference/twin-tails/"), { ASSETS: assets });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('<link rel="canonical" href="https://cv.cm/ja/reference/twin-tails/"');
    expect(html).toContain('<meta property="og:type" content="article" />');
    expect(html).toContain('hreflang="x-default" href="https://cv.cm/en/reference/twin-tails/"');
    for (const id of ["breadcrumb-jsonld", "faq-jsonld", "article-jsonld"]) expect(html).toContain(`id="${id}"`);
    expect(html).not.toContain('id="howto-jsonld"');
    expect(html).not.toContain('id="software-jsonld"');
  });

  it("is in the sitemap with every locale, without lastmod, and tracked by analytics", () => {
    const xml = buildSitemapXml(sitemapPages().filter((p) => p.kind === "ref"));
    expect(xml.match(/<url>/g)?.length).toBe(LOCALES.length * (REF_ENTRIES.length + 1));
    expect(xml).not.toContain("<lastmod>");
    expect(xml).toContain("<loc>https://cv.cm/vi/reference/hanfu/</loc>");
    expect(xml).toContain('hreflang="zh-TW" href="https://cv.cm/zh-tw/reference/hanfu/"');
    expect(readFileSync(join(root, "public/sitemaps/reference.xml"), "utf8")).toBe(buildSitemapXml(sitemapPages().filter((p) => p.kind === "ref")));
    expect(isTrackedPath("/en/reference/wink/")).toBe(true);
  });
});

describe("reference: page HTML and SEO", () => {
  const withPhotos = REF_ENTRIES.find((id) => (PHOTOS[id] ?? []).length > 0) as RefId | undefined;
  const without = REF_ENTRIES.find((id) => !(PHOTOS[id] ?? []).length);

  it("renders the hub and an entry in every locale", () => {
    for (const locale of LOCALES) {
      const hub = refPageHtml(locale, null);
      for (const group of REF_GROUPS) expect(hub, locale).toContain(`<section class="wall" id="${group.id}">`);
      for (const id of REF_ENTRIES) expect(hub, `${locale} ${id}`).toContain(`href="${refHref(locale, id)}" data-nav="ref-${id}"`);
      expect(hub).toContain('<section class="faq"');
      for (const id of REF_ENTRIES) {
        const html = refPageHtml(locale, id);
        const copy = refCopy(locale, id);
        expect(html, `${locale} ${id}`).toContain(`href="${refHref(locale)}" data-nav="reference"`);
        expect(html).toContain('<section class="ref-photos"');
        expect(html).toContain(`href="${mfan8Href(REF_META[id].mfan8)}" target="_blank" rel="noopener"`);
        for (const k of REF_META[id].prompt) expect(html).toContain(`<code>${k}</code>`);
        expect(html.match(/<section class="kb-section"/g)?.length).toBe(copy.sections.length);
        // Names table: one row per locale.
        expect(html.match(/<tr><th scope="row"/g)?.length).toBe(LOCALES.length + copy.sections.flatMap((s) => s.body).reduce((n, b) => n + (typeof b === "object" && "table" in b ? b.table.rows.length : 0), 0));
        expect(html).not.toMatch(/<(script|iframe)/i);
      }
    }
  });

  it("shows hotlinked photos with credit, or the empty note", () => {
    if (withPhotos) {
      const photo = refPhotos("en", withPhotos)[0];
      for (const locale of LOCALES) {
        const html = refPageHtml(locale, withPhotos);
        expect(html).toContain(`<a href="https://www.mfan8.com/${photo.item}" target="_blank" rel="noopener"><img src="https://s1.mtf6.com/${photo.img}_c_w_300_ext_jpg.webp" srcset="https://s1.mtf6.com/${photo.img}_c_w_600_ext_jpg.webp 2x" width="300" height="${Math.round((300 * photo.h) / photo.w)}" loading="lazy" decoding="async" alt="`);
        expect(html.match(/<figure>/g)?.length).toBe(refPhotos(locale, withPhotos).length);
        expect(html).toContain('<p class="ref-note">');
        if (photo.model) expect(html).toContain(photo.model.replace(/&/g, "&amp;"));
      }
      const ld = refArticleJsonLd("en", withPhotos) as { image: { contentUrl: string; acquireLicensePage: string }[] };
      expect(ld.image[0].contentUrl).toBe(`https://s1.mtf6.com/${photo.img}_c_w_600_ext_jpg.webp`);
      expect(ld.image[0]).not.toHaveProperty("acquireLicensePage");
    }
    if (without) {
      const html = refPageHtml("en", without);
      expect(html).not.toContain("<figure>");
      expect(html).toContain(refMessages("en").ui.noPhotos);
      expect(refArticleJsonLd("en", without)).not.toHaveProperty("image");
    }
  });

  it("titles, canonicals and JSON-LD", () => {
    for (const locale of LOCALES) {
      expect(refTitle(locale, "wink")).toBe(`${refCopy(locale, "wink").title} — cv.cm`);
      expect(pageTitle(locale, { ref: true })).toBe(`${refMessages(locale).hub.title} — cv.cm`);
    }
    expect(pageCanonical("en", { ref: true })).toBe("https://cv.cm/en/reference/");
    const ld = refArticleJsonLd("ko", "hanfu") as Record<string, unknown>;
    expect(ld["@type"]).toBe("Article");
    expect(ld.datePublished).toBe(REF_PUBLISHED);
    expect(ld.dateModified).toBe(REF_PUBLISHED);
    expect(ld.inLanguage).toBe("ko");
    expect(ld.headline).toBe(refCopy("ko", "hanfu").h1);
    expect(ld.about).toMatchObject({ "@type": "DefinedTerm", name: refCopy("ko", "hanfu").name });
    expect(ld.articleSection).toBe(refMessages("ko").hub.groups[refGroupOf("hanfu")]);
    const hub = refArticleJsonLd("en", null) as { "@type": string; mainEntity: { itemListElement: unknown[] } };
    expect(hub["@type"]).toBe("CollectionPage");
    expect(hub.mainEntity.itemListElement.length).toBe(REF_ENTRIES.length);
    const html = applyHtmlSeo(SHELL, "id", { ref: true, refId: "wink" });
    expect(html).toContain('<div id="app"><nav class="device-crumb"');
    expect(html).toContain('<section class="kb-answer"');
  });

  it("has the nav label in every core pack", () => {
    const expected: Record<Locale, string> = { en: "Reference", "zh-CN": "参考", "zh-TW": "參考", ja: "資料集", ko: "참고 자료", vi: "Tham khảo", id: "Referensi", es: "Referencias" };
    for (const locale of LOCALES) expect((messages(locale).ui.nav as Record<string, string>).reference).toBe(expected[locale]);
  });
});
