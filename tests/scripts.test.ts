import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import enHub from "../src/locales/scripts/en.json";
import worker from "../src/worker";
import { LOCALES, type Locale } from "../src/shared/locale";
import { preloadLocalePack } from "../src/shared/locale-preload";
import { messages, scriptsMessages } from "../src/shared/messages";
import { appHref, scriptsHref, parseAppPath } from "../src/shared/path";
import { SCRIPT_ENTRIES, SCRIPTS_FOCUS, SCRIPT_GROUPS, isScriptId, scriptEntryKind, scriptGroupOf, scriptPlayCount, scriptUpdated, type ScriptId } from "../src/shared/scripts";
import { SCRIPTS_META, SCRIPT_FORMATS, SCRIPT_GENRES, SCRIPT_USES } from "../src/shared/scripts-meta";
import {
  SCRIPTS_LICENSE_URL,
  isoDuration,
  scriptCopy,
  scriptsArticleJsonLd,
  scriptsTitle,
  type GeneratorCopy,
  type IdeasListCopy,
  type ScriptEntryCopy,
  type ScriptPlayCopy,
} from "../src/shared/scripts-i18n";
import { premise, runtimeLabel, scriptsPageHtml } from "../src/shared/scripts-page";
import { scriptsSyncFiles } from "../src/shared/scripts-sync";
import type { KbBlock } from "../src/shared/kb-i18n";
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

const blockKind = (b: KbBlock): string => (typeof b === "string" ? "p" : Object.keys(b)[0]);
const listLength = (b: KbBlock): number => (typeof b === "object" && ("ul" in b || "ol" in b) ? ("ul" in b ? b.ul : b.ol).length : typeof b === "object" && "table" in b ? b.table.rows.length : 0);

/** What a translation must keep from the English master: line kinds, speakers by role, list lengths, links, pool sizes. */
function structure(copy: ScriptEntryCopy): unknown {
  const sections = copy.sections.map((s) => s.body.map((b) => `${blockKind(b)}:${listLength(b)}`));
  if ("script" in copy) {
    const roles = copy.roles.map((r) => r.name.toUpperCase());
    // Speakers by role position ("COWORKER (MANAGER)" is the first role), not by name: translations rename roles.
    const speaker = (who: string): number => roles.findIndex((r) => who.toUpperCase().startsWith(r));
    return {
      roles: roles.length,
      script: copy.script.map((l) => ("who" in l ? `line:${speaker(l.who)}:${"how" in l}` : Object.keys(l)[0])),
      sections,
      shots: copy.prompts.shots.length,
      faq: copy.faq.length,
    };
  }
  if ("groups" in copy) return { groups: copy.groups.map((g) => g.items.map((i) => i.script ?? null)), sections, faq: copy.faq.length };
  return { pools: Object.fromEntries(Object.entries(copy.pools).map(([k, v]) => [k, v.length])), template: placeholders(copy.template), sections, faq: copy.faq.length };
}

const PLAY_KEYS = ["name", "blurb", "title", "description", "h1", "logline", "setting", "roles", "script", "sections", "prompts", "faq"];
const IDEAS_KEYS = ["name", "blurb", "title", "description", "h1", "answer", "groups", "sections", "faq"];
const GEN_KEYS = ["name", "blurb", "title", "description", "h1", "answer", "template", "pools", "sections", "faq"];
const keysFor = (id: ScriptId): string[] => ({ script: PLAY_KEYS, ideas: IDEAS_KEYS, generator: GEN_KEYS })[scriptEntryKind(id)];

const plays = SCRIPT_ENTRIES.filter((id) => scriptEntryKind(id) === "script");
const lists = SCRIPT_ENTRIES.filter((id) => scriptEntryKind(id) === "ideas");

describe("scripts: catalog and meta", () => {
  it("puts every entry in exactly one group, with the right kind", () => {
    const grouped = SCRIPT_GROUPS.flatMap((g) => g.entries as readonly string[]);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(grouped).toEqual([...SCRIPT_ENTRIES]);
    for (const id of SCRIPT_ENTRIES) expect(id, id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    for (const id of SCRIPTS_FOCUS) expect(isScriptId(id), id).toBe(true);
    expect(plays.length).toBe(30);
    expect(lists.length).toBe(8);
    expect(SCRIPT_ENTRIES.filter((id) => scriptEntryKind(id) === "generator")).toEqual(["plot-generator"]);
    expect(scriptPlayCount()).toBe(30);
  });

  it("has meta for every entry: cast, runtime, genres, format, uses and three related ids", () => {
    expect(Object.keys(SCRIPTS_META)).toEqual([...SCRIPT_ENTRIES]);
    const runtime: Record<string, [number, number]> = { shorts: [30, 60], drama: [120, 180], skits: [240, 420], duets: [180, 300] };
    for (const id of SCRIPT_ENTRIES) {
      const meta = SCRIPTS_META[id];
      expect(Object.keys(meta), id).toEqual(["cast", "flexible", "seconds", "genres", "format", "uses", "related"]);
      expect(SCRIPT_FORMATS, id).toContain(meta.format);
      expect(meta.related.length, id).toBe(3);
      expect(new Set(meta.related).size, id).toBe(3);
      for (const other of meta.related) expect(isScriptId(other) && other !== id, `${id} related ${other}`).toBe(true);
      if (scriptEntryKind(id) === "script") {
        const [lo, hi] = runtime[scriptGroupOf(id)];
        expect(meta.seconds, id).toBeGreaterThanOrEqual(lo);
        expect(meta.seconds, id).toBeLessThanOrEqual(hi);
        expect(meta.cast, id).toBe((readJson(`src/locales/scripts/en/${id}.json`) as ScriptPlayCopy).roles.length);
        expect(meta.genres.length, id).toBeGreaterThanOrEqual(1);
        for (const g of meta.genres) expect(SCRIPT_GENRES, id).toContain(g);
        expect(meta.uses.length, id).toBeGreaterThanOrEqual(1);
        for (const u of meta.uses) expect(SCRIPT_USES, id).toContain(u);
        expect(["vertical", "stage", "audio", "screen"], id).toContain(meta.format);
      } else {
        expect(meta.format, id).toBe(scriptEntryKind(id) === "ideas" ? "list" : "tool");
        expect([meta.cast, meta.seconds, meta.genres.length, meta.uses.length], id).toEqual([0, 0, 0, 0]);
      }
    }
  });

  it("keeps the footer's entry names equal to each entry's name", () => {
    for (const locale of LOCALES) {
      const names = (readJson(`src/locales/${locale}.json`) as { scriptsFocus: Record<string, string> }).scriptsFocus;
      expect(Object.keys(names).sort()).toEqual([...SCRIPTS_FOCUS].sort());
      for (const id of SCRIPTS_FOCUS) expect(names[id], `${locale} ${id}`).toBe((readJson(`src/locales/scripts/${locale}/${id}.json`) as { name: string }).name);
    }
  });
});

describe("scripts: content", () => {
  it("has every entry in every locale, with the English master's structure", () => {
    for (const locale of LOCALES) {
      expect(existsSync(join(root, `src/locales/scripts/${locale}.json`)), `${locale}.json`).toBe(true);
      for (const id of SCRIPT_ENTRIES) {
        const path = `src/locales/scripts/${locale}/${id}.json`;
        expect(existsSync(join(root, path)), path).toBe(true);
        const copy = readJson(path) as ScriptEntryCopy;
        const master = readJson(`src/locales/scripts/en/${id}.json`) as ScriptEntryCopy;
        expect(Object.keys(copy), path).toEqual(keysFor(id));
        if (locale !== "en") expect(structure(copy), path).toEqual(structure(master));
        expect(scriptCopy(locale, id), path).toEqual(copy);
      }
    }
  }, 30_000);

  it("keeps every entry well formed and plain", () => {
    for (const locale of LOCALES) {
      for (const id of SCRIPT_ENTRIES) {
        const copy = readJson(`src/locales/scripts/${locale}/${id}.json`) as ScriptEntryCopy;
        const where = `${locale} ${id}`;
        for (const key of ["name", "blurb", "title", "description", "h1"] as const) expect(copy[key].trim(), `${where} ${key}`).toBeTruthy();
        expect(copy.title, where).not.toMatch(/—\s*cv\.cm|\|\s*cv\.cm/);
        expect(copy.faq.length, where).toBe(3);
        for (const text of strings(copy)) {
          expect(text, `${where}: backtick`).not.toContain("`");
          expect(text, `${where}: markup`).not.toMatch(/<[a-z/]|\*\*|https?:\/\//i);
        }
        if ("script" in copy) {
          expect(copy.sections.length, where).toBe(3);
          expect(Object.keys(copy.script[0]), where).toEqual(["scene"]);
          const roles = copy.roles.map((r) => r.name.toUpperCase());
          for (const line of copy.script) {
            // A speaker is a role name, optionally followed by a suffix in brackets ("COWORKER (MANAGER)", "同事（经理）").
            if ("who" in line) expect(roles.some((r) => new RegExp(`^${r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s*[(（].*)?$`).test(line.who.toUpperCase())), `${where}: ${line.who}`).toBe(true);
          }
          expect(copy.prompts.keyframe.trim(), where).toBeTruthy();
        } else if ("groups" in copy) {
          const items = copy.groups.flatMap((g) => g.items);
          expect(items.length, where).toBeGreaterThanOrEqual(40);
          expect(items.length, where).toBeLessThanOrEqual(50);
          for (const item of items) if (item.script) expect(scriptEntryKind(item.script as ScriptId), `${where} → ${item.script}`).toBe("script");
          expect(copy.sections.length, where).toBe(2);
        } else {
          const gen = copy as GeneratorCopy;
          for (const part of ["hero", "want", "obstacle", "twist", "setting"]) expect(gen.template, where).toContain(`{${part}}`);
          for (const [part, pool] of Object.entries(gen.pools)) expect(new Set(pool).size, `${where} ${part}`).toBe(pool.length);
        }
      }
    }
  }, 30_000);

  it("has hub packs with the same keys and placeholders as English", () => {
    for (const locale of LOCALES) {
      const hub = readJson(`src/locales/scripts/${locale}.json`);
      expect(shape(hub), locale).toEqual(shape(enHub));
      const en = strings(enHub);
      const local = strings(hub);
      en.forEach((text, i) => expect(placeholders(local[i]), `${locale}: ${text}`).toEqual(placeholders(text)));
    }
  });
});

describe("scripts: scripts:sync (run `npm run scripts:sync` after editing entries)", () => {
  const read = (path: string): string | null => (existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : null);

  it("has every locale × entry on disk", () => {
    expect(scriptsSyncFiles(read).missing).toEqual([]);
  });

  it("has the generated files in step with the entries", () => {
    const { files } = scriptsSyncFiles(read);
    for (const [path, content] of Object.entries(files)) expect(read(path), `${path} is stale: run npm run scripts:sync`).toBe(content);
  });

  it("ships names, blurbs and idea counts in every pack", async () => {
    for (const locale of LOCALES) {
      const pack = scriptsMessages(locale);
      for (const id of SCRIPT_ENTRIES) {
        const copy = scriptCopy(locale, id);
        const ideas = "groups" in copy ? { ideas: (copy as IdeasListCopy).groups.reduce((n, g) => n + g.items.length, 0) } : {};
        expect(pack.list[id], `${locale} ${id}`).toEqual({ name: copy.name, blurb: copy.blurb, ...ideas });
      }
      const { SCRIPT_LOADERS } = await import(`../src/locales/scripts/loaders/${locale}.ts`);
      expect(Object.keys(SCRIPT_LOADERS), locale).toEqual([...SCRIPT_ENTRIES]);
    }
  });

  it("preloads the scripts pack on the hub, plus the loader table and one entry on an entry page", () => {
    const packs = { en: ["/a/en.js"], "scripts-en": ["/a/s-en.js"], "scripts-en/loaders": ["/a/loaders.js"], "scripts-en/the-apology": ["/a/apology.js"], "scripts-en/second-chance": ["/a/second.js"] };
    const at = (page: string): string => preloadLocalePack("<head></head>", "en", false, packs, false, false, null, null, null, null, null, null, null, false, false, false, null, page);
    expect(at("hub")).toContain("/a/s-en.js");
    expect(at("hub")).not.toContain("/a/loaders.js");
    expect(at("the-apology")).toContain("/a/loaders.js");
    expect(at("the-apology")).toContain("/a/apology.js");
    expect(at("the-apology")).not.toContain("/a/second.js");
    expect(preloadLocalePack("<head></head>", "en", false, packs)).not.toContain("s-en");
  });
});

describe("scripts: routes", () => {
  it("parses and round-trips locale and bare paths", () => {
    expect(parseAppPath("/en/scripts/")).toEqual({ kind: "scripts", locale: "en", entry: null });
    expect(parseAppPath("/id/scripts/the-group-project/")).toEqual({ kind: "scripts", locale: "id", entry: "the-group-project" });
    expect(parseAppPath("/scripts/")).toEqual({ kind: "bare-scripts", entry: null });
    expect(parseAppPath("/scripts/plot-generator")).toEqual({ kind: "bare-scripts", entry: "plot-generator" });
    expect(parseAppPath("/en/scripts/nope/")).toEqual({ kind: "unknown" });
    expect(parseAppPath("/en/scripts/the-apology/x/")).toEqual({ kind: "unknown" });
    expect(scriptsHref("zh-TW")).toBe("/zh-tw/scripts/");
    for (const locale of LOCALES) {
      expect(parseAppPath(scriptsHref(locale))).toEqual({ kind: "scripts", locale, entry: null });
      for (const id of SCRIPT_ENTRIES) expect(parseAppPath(scriptsHref(locale, id))).toEqual({ kind: "scripts", locale, entry: id });
    }
  });

  it("redirects bare paths, adds the slash, 404s unknown entries and serves the page", async () => {
    const assets = { fetch: async () => new Response(SHELL, { headers: { "Content-Type": "text/html; charset=utf-8" } }) };
    const bare = await worker.fetch(new Request("https://cv.cm/scripts/the-apology/", { headers: { "Accept-Language": "ko" } }), { ASSETS: assets });
    expect(bare.status).toBe(302);
    expect(bare.headers.get("Location")).toBe("https://cv.cm/ko/scripts/the-apology/");
    const slash = await worker.fetch(new Request("https://cv.cm/en/scripts/the-apology"), { ASSETS: assets });
    expect(slash.status).toBe(301);
    expect(slash.headers.get("Location")).toBe("https://cv.cm/en/scripts/the-apology/");
    const unknown = await worker.fetch(new Request("https://cv.cm/en/scripts/nope/"), { ASSETS: assets });
    expect(unknown.status).toBe(404);
    const hub = await worker.fetch(new Request("https://cv.cm/es/scripts/"), { ASSETS: assets });
    expect(hub.status).toBe(200);
    expect(await hub.text()).toContain('<meta property="og:type" content="website" />');
    const page = await worker.fetch(new Request("https://cv.cm/en/scripts/the-apology/"), { ASSETS: assets });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('<link rel="canonical" href="https://cv.cm/en/scripts/the-apology/"');
    expect(html).toContain('<meta property="og:type" content="article" />');
    expect(html).toContain('hreflang="x-default" href="https://cv.cm/en/scripts/the-apology/"');
    for (const id of ["breadcrumb-jsonld", "faq-jsonld", "article-jsonld"]) expect(html).toContain(`id="${id}"`);
    expect(html).toContain('class="script-body"');
  });

  it("is in the sitemap with every locale and a lastmod, and tracked by analytics", () => {
    const xml = buildSitemapXml(sitemapPages().filter((p) => p.kind === "scripts"));
    expect(xml.match(/<url>/g)?.length).toBe(LOCALES.length * (SCRIPT_ENTRIES.length + 1));
    expect(xml.match(/<lastmod>/g)?.length).toBe(LOCALES.length * (SCRIPT_ENTRIES.length + 1));
    expect(xml).toContain(`<loc>https://cv.cm/vi/scripts/the-apology/</loc>\n    <lastmod>${scriptUpdated("the-apology")}</lastmod>`);
    expect(xml).toContain('hreflang="zh-TW" href="https://cv.cm/zh-tw/scripts/plot-generator/"');
    expect(isTrackedPath("/en/scripts/the-apology/")).toBe(true);
  });
});

describe("scripts: page HTML and SEO", () => {
  it("renders the hub and every entry in every locale", () => {
    for (const locale of LOCALES) {
      const hub = scriptsPageHtml(locale, null);
      for (const group of SCRIPT_GROUPS) expect(hub, locale).toContain(`<section class="wall" id="${group.id}">`);
      for (const id of SCRIPT_ENTRIES) expect(hub, `${locale} ${id}`).toContain(`href="${scriptsHref(locale, id)}" data-nav="scripts-${id}"`);
      expect(hub).not.toMatch(/\{[a-z]+\}|undefined|NaN/);
      for (const id of SCRIPT_ENTRIES) {
        const html = scriptsPageHtml(locale, id);
        const copy = scriptCopy(locale, id);
        const where = `${locale} ${id}`;
        expect(html, where).toContain(`href="${scriptsHref(locale)}" data-nav="scripts"`);
        expect(html, where).toContain('<section class="faq"');
        for (const other of SCRIPTS_META[id].related) expect(html, where).toContain(`href="${scriptsHref(locale, other)}"`);
        if ("script" in copy) {
          expect(html.match(/<p class="sc-/g)?.length, where).toBe(copy.script.length);
          expect(html, where).toContain(`href="${SCRIPTS_LICENSE_URL}"`);
          expect(html, where).toContain(`href="${appHref(locale, "ai-image-generator")}?prompt=${encodeURIComponent(copy.prompts.keyframe).replace(/&/g, "&amp;")}"`);
          expect(html.match(/class="script-prompt"/g)?.length, where).toBe(copy.prompts.shots.length + 1);
        } else if ("groups" in copy) {
          expect(html.match(/<ol class="idea-list"/g)?.length, where).toBe(copy.groups.length);
        } else {
          expect(html, where).toContain("data-scripts-gen");
          expect(html, where).toContain("data-gen-roll");
        }
        expect(html, where).not.toMatch(/<(script|iframe)/i);
        expect(html, where).not.toMatch(/\{[a-z]+\}|undefined|NaN/);
      }
    }
  }, 60_000);

  it("fills the generator template in every locale with any part", () => {
    for (const locale of LOCALES) {
      const gen = scriptCopy(locale, "plot-generator") as GeneratorCopy;
      for (let i = 0; i < 30; i++) {
        const text = premise(gen.template, gen.pools, { hero: i, want: i, obstacle: i, twist: i, setting: i });
        expect(text, locale).not.toMatch(/\{[a-z]+\}/);
        expect(text.includes(gen.pools.hero[i % gen.pools.hero.length]) || text.includes(gen.pools.hero[i % gen.pools.hero.length].replace(/^./, (c) => c.toUpperCase())), locale).toBe(true);
      }
    }
  });

  it("describes a script as a CC BY 4.0 CreativeWork with its runtime, a list as an ItemList, the generator as a WebApplication", () => {
    expect(isoDuration(45)).toBe("PT45S");
    expect(isoDuration(180)).toBe("PT3M");
    expect(isoDuration(150)).toBe("PT2M30S");
    expect(runtimeLabel("en", 45)).toBe("45 s");
    expect(runtimeLabel("en", 150)).toBe("2.5 min");
    for (const id of plays) {
      const ld = scriptsArticleJsonLd("en", id) as Record<string, unknown> & { about: Record<string, unknown> };
      expect(ld["@type"], id).toBe("Article");
      expect(ld.license, id).toBe(SCRIPTS_LICENSE_URL);
      expect(ld.about["@type"], id).toBe("CreativeWork");
      expect(ld.about.timeRequired, id).toBe(isoDuration(SCRIPTS_META[id].seconds));
      expect(ld.articleSection, id).toBe(scriptsMessages("en").hub.groups[scriptGroupOf(id)]);
    }
    for (const id of lists) {
      const ld = scriptsArticleJsonLd("en", id) as { mainEntity: { "@type": string; numberOfItems: number } };
      expect(ld.mainEntity["@type"], id).toBe("ItemList");
      expect(ld.mainEntity.numberOfItems, id).toBe(scriptsMessages("en").list[id].ideas);
    }
    expect((scriptsArticleJsonLd("en", "plot-generator") as { "@type": string })["@type"]).toBe("WebApplication");
  });

  it("titles, canonicals and hub JSON-LD", () => {
    for (const locale of LOCALES) {
      expect(pageTitle(locale, { scripts: true })).toBe(`${scriptsMessages(locale).hub.title} — cv.cm`);
      expect(pageDescription(locale, { scripts: true }), locale).toContain(String(scriptPlayCount()));
    }
    expect(scriptsTitle("en", "the-apology")).toBe(`${scriptCopy("en", "the-apology").title} — cv.cm`);
    expect(pageCanonical("en", { scripts: true })).toBe("https://cv.cm/en/scripts/");
    expect(pageCanonical("ja", { scripts: true, scriptId: "the-apology" })).toBe("https://cv.cm/ja/scripts/the-apology/");
    const hub = scriptsArticleJsonLd("en", null) as { "@type": string; mainEntity: { itemListElement: unknown[] } };
    expect(hub["@type"]).toBe("CollectionPage");
    expect(hub.mainEntity.itemListElement.length).toBe(SCRIPT_ENTRIES.length);
    const html = applyHtmlSeo(SHELL, "en", { scripts: true, scriptId: "plot-generator" });
    expect(html).toContain('<div id="app"><nav class="device-crumb"');
    expect(html).toContain("data-scripts-gen");
  });

  it("has the nav label in every core pack, also the hub h1", () => {
    const expected: Record<Locale, string> = { en: "Scripts & Ideas", "zh-CN": "灵感剧本库", "zh-TW": "靈感劇本庫", ja: "台本・ネタ帳", ko: "대본·아이디어", vi: "Kịch bản & ý tưởng", id: "Naskah & Ide", es: "Guiones e ideas" };
    for (const locale of LOCALES) {
      expect((messages(locale).ui.nav as Record<string, string>).scripts).toBe(expected[locale]);
      expect(scriptsMessages(locale).hub.h1).toBe(expected[locale]);
    }
  });
});
