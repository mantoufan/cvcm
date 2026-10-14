import { describe, expect, it } from "vitest";
import en from "../src/locales/kb/en.json";
import enHeic from "../src/locales/kb/en/what-is-heic.json";
import syncMeta from "../src/locales/kb/meta.json";
import { KB_ALL } from "../src/locales/kb/all";
import { KB_LOADERS } from "../src/locales/kb/loaders";
import { syncEntry, type KbSyncEntry } from "../src/shared/kb-sync";
import { preloadLocalePack } from "../src/shared/locale-preload";
import worker from "../src/worker";
import { LOCALES } from "../src/shared/locale";
import { kbMessages, messages } from "../src/shared/messages";
import { FEATURED_TUTORIALS, TOOLS, kbHref, parseAppPath } from "../src/shared/path";
import { KB_ARTICLES, KB_GROUPS, KB_META, kbForTool, type KbId } from "../src/shared/kb";
import { kbArticleJsonLd, kbCopy, kbMinutes, kbPageHtml, kbUpdated, type KbArticleCopy, type KbBlock } from "../src/shared/kb-i18n";
import { KB_MINUTES, KB_UPDATED } from "../src/locales/kb/meta";
import { applyHtmlSeo, pageCanonical, pageTitle } from "../src/shared/seo";
import { buildSitemapXml } from "../src/shared/sitemap";
import { isTrackedPath } from "../src/shared/analytics";

const SHELL = `<!doctype html><html lang="en"><head><title>cv.cm</title><meta name="description" content="x" /><link rel="canonical" href="https://cv.cm/" /></head><body><div id="app"></div></body></html>`;

/** Keys and array lengths, not text: every locale must match English. */
function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]));
  }
  return typeof value;
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("knowledge: routes", () => {
  it("parses locale and bare paths under /learn/knowledge/", () => {
    expect(parseAppPath("/en/learn/knowledge/")).toEqual({ kind: "kb", locale: "en", article: null });
    expect(parseAppPath("/zh-cn/learn/knowledge/what-is-heic/")).toEqual({ kind: "kb", locale: "zh-CN", article: "what-is-heic" });
    expect(parseAppPath("/learn/knowledge/")).toEqual({ kind: "bare-kb", article: null });
    expect(parseAppPath("/learn/knowledge/iso-8601")).toEqual({ kind: "bare-kb", article: "iso-8601" });
    expect(parseAppPath("/en/learn/knowledge/nope/")).toEqual({ kind: "unknown" });
    expect(parseAppPath("/en/learn/knowledge/iso-8601/x/")).toEqual({ kind: "unknown" });
    // Tutorials are untouched.
    expect(parseAppPath("/en/learn/make-qr/")).toEqual({ kind: "learn", locale: "en", tutorial: "make-qr" });
    expect(kbHref("zh-TW", "apr-vs-apy")).toBe("/zh-tw/learn/knowledge/apr-vs-apy/");
    expect(kbHref("ja")).toBe("/ja/learn/knowledge/");
  });

  it("redirects bare paths, adds the slash, 404s unknown articles and serves the page", async () => {
    const assets = { fetch: async () => new Response(SHELL, { headers: { "Content-Type": "text/html; charset=utf-8" } }) };
    const bare = await worker.fetch(new Request("https://cv.cm/learn/knowledge/what-is-uuid/", { headers: { "Accept-Language": "vi" } }), { ASSETS: assets });
    expect(bare.status).toBe(302);
    expect(bare.headers.get("Location")).toBe("https://cv.cm/vi/learn/knowledge/what-is-uuid/");
    const slash = await worker.fetch(new Request("https://cv.cm/en/learn/knowledge/what-is-uuid"), { ASSETS: assets });
    expect(slash.status).toBe(301);
    expect(slash.headers.get("Location")).toBe("https://cv.cm/en/learn/knowledge/what-is-uuid/");
    const unknown = await worker.fetch(new Request("https://cv.cm/en/learn/knowledge/nope/"), { ASSETS: assets });
    expect(unknown.status).toBe(404);
    const page = await worker.fetch(new Request("https://cv.cm/ko/learn/knowledge/what-is-base64/"), { ASSETS: assets });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain(`<title>${pageTitle("ko", { kb: true, kbId: "what-is-base64" })}</title>`);
    expect(html).toContain('<link rel="canonical" href="https://cv.cm/ko/learn/knowledge/what-is-base64/"');
    expect(html).toContain('<meta property="og:type" content="article" />');
  });

  it("lists the hub and every article in every locale in the sitemap", () => {
    const xml = buildSitemapXml("2026-10-14");
    for (const locale of LOCALES) {
      expect(xml).toContain(`<loc>https://cv.cm${kbHref(locale)}</loc>`);
      for (const id of KB_ARTICLES) expect(xml).toContain(`<loc>https://cv.cm${kbHref(locale, id)}</loc>`);
    }
  });

  it("is tracked by analytics (no personal data on these pages)", () => {
    expect(isTrackedPath("/en/learn/knowledge/what-is-exif/")).toBe(true);
  });
});

describe("knowledge: SEO", () => {
  it("serves crawlable HTML with article, breadcrumb and FAQ JSON-LD", () => {
    const html = applyHtmlSeo(SHELL, "es", { kb: true, kbId: "url-encoding" });
    expect(html).toContain('<link rel="canonical" href="https://cv.cm/es/learn/knowledge/url-encoding/"');
    expect(html).toContain('hreflang="zh-CN" href="https://cv.cm/zh-cn/learn/knowledge/url-encoding/"');
    expect(html).toContain('hreflang="x-default" href="https://cv.cm/en/learn/knowledge/url-encoding/"');
    for (const id of ["breadcrumb-jsonld", "faq-jsonld", "article-jsonld"]) expect(html).toContain(`id="${id}"`);
    expect(html).not.toContain('id="howto-jsonld"');
    expect(html).not.toContain('id="software-jsonld"');
    // The article body is in the HTML, not only in JSON-LD.
    const copy = kbCopy("es", "url-encoding");
    expect(html).toContain(`<h1>${copy.h1.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</h1>`);
    expect(html).toContain('<div class="kb-table">');
    expect(pageCanonical("en", { kb: true })).toBe("https://cv.cm/en/learn/knowledge/");
  });

  it("describes each article as a dated TechArticle with its sources", () => {
    const ld = kbArticleJsonLd("en", "md5-vs-sha-256") as Record<string, unknown>;
    expect(ld["@type"]).toBe("TechArticle");
    expect(ld.datePublished).toBe(KB_META["md5-vs-sha-256"].published);
    expect(ld.dateModified).toBe(kbUpdated("en", "md5-vs-sha-256"));
    expect((ld.citation as unknown[]).length).toBe(KB_META["md5-vs-sha-256"].sources.length);
    const hub = kbArticleJsonLd("en", null) as { mainEntity: { itemListElement: unknown[] } };
    expect(hub.mainEntity.itemListElement.length).toBe(KB_ARTICLES.length);
  });

  it("escapes copy and renders `code` spans", () => {
    const html = kbPageHtml("en", "url-encoding");
    expect(html).toContain("<code>a%20b%26c</code>");
    expect(html).not.toMatch(/<(script|img|iframe)/i);
  });
});

describe("knowledge: catalog and copy", () => {
  it("puts every article in exactly one group", () => {
    const grouped = KB_GROUPS.flatMap((g) => g.articles);
    expect([...grouped].sort()).toEqual([...KB_ARTICLES].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
    // Lists use KB_ARTICLES directly, so it must already be in hub order.
    expect(grouped).toEqual([...KB_ARTICLES]);
  });

  it("links only to real tools, published tutorials and other articles", () => {
    for (const id of KB_ARTICLES) {
      const meta = KB_META[id];
      expect(meta.tools.length, id).toBeGreaterThan(0);
      for (const tool of meta.tools) expect(TOOLS, `${id} tool ${tool}`).toContain(tool);
      for (const tutorial of meta.tutorials) expect(FEATURED_TUTORIALS, `${id} tutorial ${tutorial}`).toContain(tutorial);
      for (const other of meta.related) expect(KB_ARTICLES.includes(other) && other !== id, `${id} related ${other}`).toBe(true);
      for (const source of meta.sources) expect(source.href, id).toMatch(/^https:\/\//);
    }
    expect(kbForTool("base64")).toEqual(["what-is-base64"]);
  });

  it("has the same copy structure in every locale", () => {
    for (const locale of LOCALES) {
      expect(shape(kbMessages(locale)), locale).toEqual(shape(en));
      // Articles differ in sections and tables; each must match its English original.
      for (const id of KB_ARTICLES) expect(shape(kbCopy(locale, id)), `${locale} ${id}`).toEqual(shape(kbCopy("en", id)));
    }
    expect(shape(kbCopy("en", "what-is-heic"))).toEqual(shape(enHeic));
  });

  it("has a name and blurb for every article in every core pack", () => {
    for (const locale of LOCALES) {
      const kb = messages(locale).ui.kb as unknown as Record<string, { name: string; blurb: string }>;
      for (const id of KB_ARTICLES) {
        expect(kb[id]?.name, `${locale} ${id}`).toBeTruthy();
        expect(kb[id]?.blurb, `${locale} ${id}`).toBeTruthy();
      }
    }
  });

  it("keeps titles, answers, FAQ and `code` spans well formed", () => {
    for (const locale of LOCALES) {
      for (const id of KB_ARTICLES) {
        const copy = kbCopy(locale, id);
        const where = `${locale} ${id}`;
        expect(copy.title.endsWith(" — cv.cm"), where).toBe(true);
        expect(copy.description.length, where).toBeGreaterThan(40);
        expect(copy.answer.length, where).toBeGreaterThan(80);
        expect(copy.sections.length, where).toBeGreaterThanOrEqual(4);
        expect(copy.faq.length, where).toBeGreaterThanOrEqual(3);
        for (const text of strings(copy)) {
          expect((text.match(/`/g) ?? []).length % 2, `${where}: ${text}`).toBe(0);
          expect(text.replace(/`[^`]*`/g, ""), where).not.toMatch(/<[a-z/]|\*\*/i);
        }
        for (const section of copy.sections) {
          for (const block of section.body as KbBlock[]) {
            if (typeof block === "object" && "table" in block) {
              for (const row of block.table.rows) expect(row.length, `${where} table`).toBe(block.table.head.length);
            }
          }
        }
        expect(kbMinutes(locale, id), where).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe("knowledge: sync (run `npm run kb:sync` after editing any article or its sources)", () => {
  const meta = syncMeta as unknown as Record<KbId, KbSyncEntry>;
  const copiesOf = (id: KbId): Record<typeof LOCALES[number], KbArticleCopy> =>
    Object.fromEntries(LOCALES.map((locale) => [locale, KB_ALL[locale][id]])) as Record<typeof LOCALES[number], KbArticleCopy>;

  it("has meta.json in step with the copy and sources of every page", () => {
    expect(Object.keys(meta).sort()).toEqual([...KB_ARTICLES].sort());
    for (const id of KB_ARTICLES) {
      // A different fingerprint means the copy changed without `npm run kb:sync`, so its "Updated" date is stale.
      expect(syncEntry(copiesOf(id), KB_META[id].sources, meta[id], "changed"), `${id}: copy or sources changed, run npm run kb:sync`).toEqual(meta[id]);
      for (const locale of LOCALES) {
        expect(meta[id].updated[locale], `${id} ${locale}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(meta[id].updated[locale] >= KB_META[id].published, `${id} ${locale}`).toBe(true);
      }
    }
  });

  it("ships the same dates and reading times to the pages", () => {
    for (const id of KB_ARTICLES) {
      expect(KB_UPDATED[id], id).toEqual(meta[id].updated);
      expect(KB_MINUTES[id], id).toEqual(meta[id].minutes);
    }
    expect(kbMinutes("ja", "what-is-heic")).toBe(meta["what-is-heic"].minutes.ja);
    expect(kbUpdated("vi", "iso-8601")).toBe(meta["iso-8601"].updated.vi);
  });

  it("dates only the locale whose copy changed, every locale when sources change, and all on --touch", () => {
    const copies = copiesOf("iso-8601");
    const sources = KB_META["iso-8601"].sources;
    const before = syncEntry(copies, sources, undefined, "2026-01-01");
    const same = syncEntry(copies, sources, before, "2026-02-02");
    expect(same.updated).toEqual(before.updated);
    const edited = syncEntry({ ...copies, ja: { ...copies.ja, answer: copies.ja.answer + "。" } }, sources, before, "2026-02-02");
    expect(edited.updated.ja).toBe("2026-02-02");
    expect(edited.updated.en).toBe("2026-01-01");
    const newSource = syncEntry(copies, [...sources, { title: "x", href: "https://example.org/" }], before, "2026-02-02");
    for (const locale of LOCALES) expect(newSource.updated[locale]).toBe("2026-02-02");
    const touched = syncEntry(copies, sources, before, "2026-03-03", true);
    for (const locale of LOCALES) expect(touched.updated[locale]).toBe("2026-03-03");
  });

  it("has a generated lazy loader for every article in every locale", () => {
    for (const locale of LOCALES) expect(Object.keys(KB_LOADERS[locale]).sort(), locale).toEqual([...KB_ARTICLES].sort());
  });

  it("preloads only the hub pack, or the hub pack plus one article", () => {
    const packs = { en: ["/a/en.js"], "kb-en": ["/a/kb-en.js"], "kb-en/iso-8601": ["/a/iso.js"], "kb-en/what-is-uuid": ["/a/uuid.js"] };
    const shell = "<head></head>";
    const hub = preloadLocalePack(shell, "en", false, packs, false, false, "hub");
    expect(hub).toContain("/a/kb-en.js");
    expect(hub).not.toContain("/a/iso.js");
    const article = preloadLocalePack(shell, "en", false, packs, false, false, "iso-8601");
    expect(article).toContain("/a/kb-en.js");
    expect(article).toContain("/a/iso.js");
    expect(article).not.toContain("/a/uuid.js");
  });
});
