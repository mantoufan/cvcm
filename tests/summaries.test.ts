import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import enHub from "../src/locales/summaries/en.json";
import worker from "../src/worker";
import { LOCALES, type Locale } from "../src/shared/locale";
import { preloadLocalePack } from "../src/shared/locale-preload";
import { messages, summariesMessages } from "../src/shared/messages";
import { summariesHref, parseAppPath } from "../src/shared/path";
import { SUMMARY_ENTRIES, SUMMARIES_FOCUS, SUMMARY_GROUPS, isSummaryId, summaryGroupOf, summaryUpdated } from "../src/shared/summaries";
import { SUMMARIES_META, SUMMARY_KINDS } from "../src/shared/summaries-meta";
import { summariesArticleJsonLd, summaryCopy, summariesTitle, summaryWorkType, type SummaryEntryCopy } from "../src/shared/summaries-i18n";
import { summariesPageHtml } from "../src/shared/summaries-page";
import { summariesSyncFiles } from "../src/shared/summaries-sync";
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

/** Block kinds per section, spoiler flags and quiz answers: translations keep the English master's structure. */
function structure(copy: SummaryEntryCopy): unknown {
  const block = (b: KbBlock): string => {
    if (typeof b === "string") return "p";
    if ("ul" in b) return "ul";
    if ("ol" in b) return "ol";
    if ("table" in b) return "table";
    if ("code" in b) return "code";
    return "note";
  };
  return {
    sections: copy.sections.map((s) => ({ spoiler: Boolean(s.spoiler), kinds: s.body.map(block) })),
    check: copy.check.map((c) => ({ options: c.options.length, answer: c.answer })),
    faq: copy.faq.length,
  };
}

/** Works whose English master exists (all of them once content has landed). */
const written = SUMMARY_ENTRIES.filter((id) => existsSync(join(root, `src/locales/summaries/en/${id}.json`)));
const withMeta = written.filter((id) => id in SUMMARIES_META);

describe("summaries: catalog", () => {
  it("puts every work in exactly one group", () => {
    const grouped = SUMMARY_GROUPS.flatMap((g) => g.entries as readonly string[]);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(grouped).toEqual([...SUMMARY_ENTRIES]);
    for (const id of SUMMARY_ENTRIES) expect(id, id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    for (const id of SUMMARIES_FOCUS) expect(isSummaryId(id), id).toBe(true);
  });

  it("has meta for every work, with valid kinds, years, related ids and sources", () => {
    expect(Object.keys(SUMMARIES_META).sort()).toEqual([...SUMMARY_ENTRIES].sort());
    for (const [id, meta] of Object.entries(SUMMARIES_META)) {
      expect(isSummaryId(id), id).toBe(true);
      expect(SUMMARY_KINDS, id).toContain(meta.kind);
      for (const key of ["original", "creator", "language"] as const) expect(meta[key].trim(), `${id} ${key}`).toBeTruthy();
      expect(meta.language, id).toMatch(/^[a-z]{2}$/);
      expect(meta.year, id).toMatch(/^-?\d{1,4}$/);
      const series = meta.kind === "series" || meta.kind === "anime-series";
      if (meta.end !== null) {
        expect(series, `${id}: only a series has an end year`).toBe(true);
        expect(meta.end, id).toMatch(/^\d{4}$/);
        expect(Number(meta.end), id).toBeGreaterThanOrEqual(Number(meta.year));
      }
      expect(meta.related.length, id).toBe(3);
      for (const other of meta.related) expect(isSummaryId(other) && other !== id, `${id} related ${other}`).toBe(true);
      expect(new Set(meta.related).size, id).toBe(3);
      expect(meta.sources.length, id).toBeGreaterThanOrEqual(2);
      for (const source of meta.sources) {
        expect(source.name.trim(), id).toBeTruthy();
        expect(source.url, id).toMatch(/^https:\/\/[^\s"<>]+$/);
      }
    }
  });

  it("keeps the footer's work names equal to each work's name", () => {
    for (const locale of LOCALES) {
      const names = (readJson(`src/locales/${locale}.json`) as { summariesFocus: Record<string, string> }).summariesFocus;
      expect(Object.keys(names).sort()).toEqual([...SUMMARIES_FOCUS].sort());
      for (const id of SUMMARIES_FOCUS) {
        const path = `src/locales/summaries/${locale}/${id}.json`;
        expect(existsSync(join(root, path)), path).toBe(true);
        expect(names[id], `${locale} ${id}`).toBe((readJson(path) as { name: string }).name);
      }
    }
  });
});

describe("summaries: content", () => {
  it("has every work in every locale, with the English master's structure", () => {
    for (const locale of LOCALES) {
      expect(existsSync(join(root, `src/locales/summaries/${locale}.json`)), `${locale}.json`).toBe(true);
      for (const id of SUMMARY_ENTRIES) {
        const path = `src/locales/summaries/${locale}/${id}.json`;
        expect(existsSync(join(root, path)), path).toBe(true);
        const copy = readJson(path) as SummaryEntryCopy;
        const master = readJson(`src/locales/summaries/en/${id}.json`) as SummaryEntryCopy;
        expect(Object.keys(copy).sort(), path).toEqual(Object.keys(master).sort());
        if (locale !== "en") expect(structure(copy), path).toEqual(structure(master));
        expect(summaryCopy(locale, id), path).toEqual(copy);
      }
    }
  });

  it("keeps the copy that exists well formed: five sections, spoilers on plot and ending, three questions and three FAQs", () => {
    for (const locale of LOCALES) {
      for (const id of written) {
        const path = `src/locales/summaries/${locale}/${id}.json`;
        if (!existsSync(join(root, path))) continue;
        const copy = readJson(path) as SummaryEntryCopy;
        const where = `${locale} ${id}`;
        expect(Object.keys(copy).sort(), where).toEqual(["aka", "answer", "blurb", "check", "description", "faq", "h1", "name", "sections", "title"]);
        for (const key of ["name", "blurb", "title", "description", "h1", "answer"] as const) expect(copy[key].trim(), `${where} ${key}`).toBeTruthy();
        expect(copy.title, where).not.toMatch(/—\s*cv\.cm|\|\s*cv\.cm/);
        expect(Array.isArray(copy.aka), where).toBe(true);
        expect(copy.sections.length, where).toBe(5);
        expect(copy.sections.map((s) => s.spoiler === true), where).toEqual([false, true, true, false, false]);
        expect(copy.faq.length, where).toBe(3);
        expect(copy.check.length, where).toBe(3);
        for (const q of copy.check) {
          expect(q.options.length, where).toBe(3);
          expect([0, 1, 2], where).toContain(q.answer);
          expect(q.q.trim() && q.why.trim(), where).toBeTruthy();
        }
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
      const hub = readJson(`src/locales/summaries/${locale}.json`);
      expect(shape(hub), locale).toEqual(shape(enHub));
      const en = strings(enHub);
      const local = strings(hub);
      en.forEach((text, i) => expect(placeholders(local[i]), `${locale}: ${text}`).toEqual(placeholders(text)));
    }
  });
});

describe("summaries: summaries:sync (run `npm run summaries:sync` after editing works)", () => {
  it("has every locale × work on disk", () => {
    const read = (path: string): string | null => (existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : null);
    expect(summariesSyncFiles(read).missing).toEqual([]);
  });

  it("has the generated files in step with the works", () => {
    const read = (path: string): string | null => (existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : null);
    const { files } = summariesSyncFiles(read);
    for (const [path, content] of Object.entries(files)) expect(read(path), `${path} is stale: run npm run summaries:sync`).toBe(content);
  });

  it("ships names and blurbs in every pack", async () => {
    for (const locale of LOCALES) {
      const pack = summariesMessages(locale);
      for (const id of written) {
        expect(pack.list[id], `${locale} ${id}`).toEqual({ name: summaryCopy(locale, id).name, blurb: summaryCopy(locale, id).blurb });
      }
      const { SUMMARY_LOADERS } = await import(`../src/locales/summaries/loaders/${locale}.ts`);
      expect(Object.keys(SUMMARY_LOADERS).sort(), locale).toEqual([...written].sort());
    }
  });

  it("preloads the summaries pack on the hub, plus the loader table and one work on a work page", () => {
    const packs = { en: ["/a/en.js"], "summaries-en": ["/a/s-en.js"], "summaries-en/loaders": ["/a/loaders.js"], "summaries-en/hamlet": ["/a/hamlet.js"], "summaries-en/lost": ["/a/lost.js"] };
    const at = (page: string): string => preloadLocalePack("<head></head>", "en", false, packs, false, false, null, null, null, null, null, null, null, false, false, false, page);
    expect(at("hub")).toContain("/a/s-en.js");
    expect(at("hub")).not.toContain("/a/loaders.js");
    expect(at("hamlet")).toContain("/a/loaders.js");
    expect(at("hamlet")).toContain("/a/hamlet.js");
    expect(at("hamlet")).not.toContain("/a/lost.js");
    expect(preloadLocalePack("<head></head>", "en", false, packs)).not.toContain("s-en");
  });
});

describe("summaries: routes", () => {
  it("parses and round-trips locale and bare paths", () => {
    expect(parseAppPath("/en/summaries/")).toEqual({ kind: "summaries", locale: "en", entry: null });
    expect(parseAppPath("/vi/summaries/truyen-kieu/")).toEqual({ kind: "summaries", locale: "vi", entry: "truyen-kieu" });
    expect(parseAppPath("/summaries/")).toEqual({ kind: "bare-summaries", entry: null });
    expect(parseAppPath("/summaries/hamlet")).toEqual({ kind: "bare-summaries", entry: "hamlet" });
    expect(parseAppPath("/en/summaries/nope/")).toEqual({ kind: "unknown" });
    expect(parseAppPath("/en/summaries/hamlet/x/")).toEqual({ kind: "unknown" });
    expect(parseAppPath("/en/summaries/Hamlet/")).toEqual({ kind: "summaries", locale: "en", entry: "hamlet" });
    expect(summariesHref("zh-TW")).toBe("/zh-tw/summaries/");
    for (const locale of LOCALES) {
      expect(parseAppPath(summariesHref(locale))).toEqual({ kind: "summaries", locale, entry: null });
      for (const id of SUMMARY_ENTRIES) expect(parseAppPath(summariesHref(locale, id))).toEqual({ kind: "summaries", locale, entry: id });
    }
  });

  it("redirects bare paths, adds the slash, 404s unknown works and serves the page", async () => {
    const assets = { fetch: async () => new Response(SHELL, { headers: { "Content-Type": "text/html; charset=utf-8" } }) };
    const bare = await worker.fetch(new Request("https://cv.cm/summaries/hamlet/", { headers: { "Accept-Language": "ja" } }), { ASSETS: assets });
    expect(bare.status).toBe(302);
    expect(bare.headers.get("Location")).toBe("https://cv.cm/ja/summaries/hamlet/");
    const slash = await worker.fetch(new Request("https://cv.cm/en/summaries/hamlet"), { ASSETS: assets });
    expect(slash.status).toBe(301);
    expect(slash.headers.get("Location")).toBe("https://cv.cm/en/summaries/hamlet/");
    const upper = await worker.fetch(new Request("https://cv.cm/en/summaries/Hamlet/"), { ASSETS: assets });
    expect(upper.status).toBe(301);
    expect(upper.headers.get("Location")).toBe("https://cv.cm/en/summaries/hamlet/");
    const unknown = await worker.fetch(new Request("https://cv.cm/en/summaries/nope/"), { ASSETS: assets });
    expect(unknown.status).toBe(404);
    const hub = await worker.fetch(new Request("https://cv.cm/es/summaries/"), { ASSETS: assets });
    expect(hub.status).toBe(200);
    expect(await hub.text()).toContain('<meta property="og:type" content="website" />');
    const page = await worker.fetch(new Request("https://cv.cm/en/summaries/hamlet/"), { ASSETS: assets });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('<link rel="canonical" href="https://cv.cm/en/summaries/hamlet/"');
    expect(html).toContain('<meta property="og:type" content="article" />');
    expect(html).toContain('hreflang="x-default" href="https://cv.cm/en/summaries/hamlet/"');
    expect(html).toContain(summaryCopy("en", "hamlet").h1.replace(/&/g, "&amp;"));
    for (const id of ["breadcrumb-jsonld", "faq-jsonld", "article-jsonld"]) expect(html).toContain(`id="${id}"`);
    expect(html).not.toContain('id="howto-jsonld"');
  });

  it("is in the sitemap with every locale and a lastmod, and tracked by analytics", () => {
    const xml = buildSitemapXml(sitemapPages().filter((p) => p.kind === "summaries"));
    expect(xml.match(/<url>/g)?.length).toBe(LOCALES.length * (SUMMARY_ENTRIES.length + 1));
    expect(xml.match(/<lastmod>/g)?.length).toBe(LOCALES.length * (SUMMARY_ENTRIES.length + 1));
    expect(xml).toContain(`<loc>https://cv.cm/vi/summaries/hamlet/</loc>\n    <lastmod>${summaryUpdated("hamlet")}</lastmod>`);
    expect(xml).toContain('hreflang="zh-TW" href="https://cv.cm/zh-tw/summaries/lost/"');
    expect(isTrackedPath("/en/summaries/hamlet/")).toBe(true);
  });
});

describe("summaries: page HTML and SEO", () => {
  it("renders the hub and every written work in every locale", () => {
    for (const locale of LOCALES) {
      const hub = summariesPageHtml(locale, null);
      for (const group of SUMMARY_GROUPS) expect(hub, locale).toContain(`<section class="wall" id="${group.id}">`);
      for (const id of SUMMARY_ENTRIES) expect(hub, `${locale} ${id}`).toContain(`href="${summariesHref(locale, id)}" data-nav="summaries-${id}"`);
      expect(hub).toContain('<section class="faq"');
      expect(hub).not.toMatch(/\{[a-z]+\}|undefined/);
      for (const id of withMeta) {
        const html = summariesPageHtml(locale, id);
        const copy = summaryCopy(locale, id);
        const ui = summariesMessages(locale).ui;
        const where = `${locale} ${id}`;
        expect(html, where).toContain(`href="${summariesHref(locale)}" data-nav="summaries"`);
        expect(html, where).toContain('<section class="kb-answer"');
        expect(html.match(/<section class="kb-section"/g)?.length, where).toBe(copy.sections.length);
        // A badge on each spoiler section, one warning before the first; nothing collapsed.
        expect(html.match(/class="pill summary-spoiler"/g)?.length, where).toBe(copy.sections.filter((s) => s.spoiler).length);
        expect(html.split(ui.spoilerNote).length - 1, where).toBe(1);
        expect(html.indexOf(ui.spoilerNote), where).toBeLessThan(html.indexOf('id="summary-2"'));
        // The self-check: three questions, each answer behind a <details>.
        expect(html.match(/<p class="summary-q">/g)?.length, where).toBe(3);
        for (const q of copy.check) expect(html, where).toContain(fill(ui.checkAnswer, { option: q.options[q.answer] }).replace(/&/g, "&amp;").replace(/"/g, "&quot;"));
        for (const other of SUMMARIES_META[id].related) expect(html, where).toContain(`href="${summariesHref(locale, other)}"`);
        for (const source of SUMMARIES_META[id].sources) expect(html, where).toContain(`href="${source.url.replace(/&/g, "&amp;")}"`);
        expect(html, where).not.toMatch(/<(script|iframe)/i);
        expect(html, where).not.toMatch(/\{[a-z]+\}|undefined/);
      }
    }
  }, 30_000);

  it("describes the work as a Book, Movie or TVSeries, and keeps the quiz out of JSON-LD", () => {
    expect(summaryWorkType("play")).toBe("Book");
    expect(summaryWorkType("anime-film")).toBe("Movie");
    expect(summaryWorkType("anime-series")).toBe("TVSeries");
    for (const id of withMeta) {
      const meta = SUMMARIES_META[id];
      const ld = summariesArticleJsonLd("en", id) as Record<string, unknown> & { about: Record<string, unknown> };
      expect(ld["@type"], id).toBe("Article");
      expect(ld.headline, id).toBe(summaryCopy("en", id).h1);
      expect(ld.abstract, id).toBe(summaryCopy("en", id).answer);
      expect(ld.articleSection, id).toBe(summariesMessages("en").hub.groups[summaryGroupOf(id)]);
      expect(ld.about["@type"], id).toBe(summaryWorkType(meta.kind));
      expect(ld.about.name, id).toBe(summaryCopy("en", id).name);
      expect(ld.about.inLanguage, id).toBe(meta.language);
      const by = ld.about.author ?? ld.about.director ?? ld.about.creator;
      expect(JSON.stringify(by), id).toContain('"Person"');
      if (ld.about["@type"] === "TVSeries") expect(ld.about.startDate, id).toBe(meta.year);
      else expect(ld.about.datePublished, id).toBe(meta.year);
      expect(JSON.stringify(ld), id).not.toContain(summaryCopy("en", id).check[0].why);
    }
  });

  it("titles, canonicals and hub JSON-LD", () => {
    for (const locale of LOCALES) {
      expect(pageTitle(locale, { summaries: true })).toBe(`${summariesMessages(locale).hub.title} — cv.cm`);
      expect(pageDescription(locale, { summaries: true }), locale).toContain(String(SUMMARY_ENTRIES.length));
    }
    expect(summariesTitle("en", "hamlet")).toBe(`${summaryCopy("en", "hamlet").title} — cv.cm`);
    expect(pageCanonical("en", { summaries: true })).toBe("https://cv.cm/en/summaries/");
    expect(pageCanonical("ko", { summaries: true, summaryId: "hamlet" })).toBe("https://cv.cm/ko/summaries/hamlet/");
    const hub = summariesArticleJsonLd("en", null) as { "@type": string; mainEntity: { "@type": string; itemListElement: unknown[] } };
    expect(hub["@type"]).toBe("CollectionPage");
    expect(hub.mainEntity.itemListElement.length).toBe(SUMMARY_ENTRIES.length);
    const html = applyHtmlSeo(SHELL, "en", { summaries: true, summaryId: "hamlet" });
    expect(html).toContain('<div id="app"><nav class="device-crumb"');
    expect(html).toContain('<section class="kb-answer"');
  });

  it("has the nav label in every core pack, also the hub h1", () => {
    const expected: Record<Locale, string> = { en: "Summaries", "zh-CN": "一口气看完", "zh-TW": "一口氣看完", ja: "あらすじ", ko: "줄거리 요약", vi: "Tóm tắt", id: "Sinopsis", es: "Resúmenes" };
    for (const locale of LOCALES) {
      expect((messages(locale).ui.nav as Record<string, string>).summaries).toBe(expected[locale]);
      expect(summariesMessages(locale).hub.h1).toBe(expected[locale]);
    }
  });
});
