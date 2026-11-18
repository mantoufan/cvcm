import { describe, expect, it } from "vitest";
import "../src/shared/messages-all";
import worker from "../src/worker";
import en from "../src/locales/emoji/en.json";
import enUsage from "../src/locales/emoji/usage/en.json";
import { LOCALES, type Locale } from "../src/shared/locale";
import { messages } from "../src/shared/messages";
import { emojiHref, parseAppPath, STATIC_FILE } from "../src/shared/path";
import { EMOJI_FOCUS, EMOJI_SLUGS, emojiUpdated, isEmojiSlug, type EmojiSlug } from "../src/shared/emoji";
import {
  codepointText,
  emojiBreadcrumbJsonLd,
  emojiDescription,
  emojiFaqItems,
  emojiLabel,
  emojiMessages,
  emojiPageJsonLd,
  emojiRow,
  emojiTitle,
  htmlCode,
} from "../src/shared/emoji-i18n";
import { emojiPageHtml, similarSlugs } from "../src/shared/emoji-page";
import { applyHtmlSeo } from "../src/shared/seo-html";
import { buildSectionSitemaps, sitemapPages } from "../src/shared/sitemap";
import { buildSearchIndex } from "../src/shared/search-index";
import { datasetStaticHtml } from "../src/shared/datasets-i18n";
import { escapeHtml } from "../src/shared/device-i18n";
import { baseEmoji, emojiMatches } from "../src/client/emoji/ui";
import slugTable from "../src/shared/emoji-slug-table.json";
// @ts-expect-error plain .mjs helper shared with scripts/fetch-emoji.mjs
import { assignSlugs } from "../scripts/emoji-slugs.mjs";

const SHELL = `<!doctype html><html lang="en"><head><title>cv.cm</title><meta name="description" content="x" /><link rel="canonical" href="https://cv.cm/" /></head><body><div id="app"></div></body></html>`;
const assets = { fetch: async () => new Response(SHELL, { headers: { "Content-Type": "text/html; charset=utf-8" } }) };

function paths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([k, v]) => paths(v, prefix ? `${prefix}.${k}` : k));
}
const leaf = (tree: unknown, path: string): unknown => path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], tree);
// {title} is English title case; other locales write {name}. {Name} is {name} capitalised.
const placeholders = (text: unknown): string[] => [...new Set((String(text).match(/\{\w+\}/g) ?? []).map((p) => (p === "{title}" || p === "{Name}" ? "{name}" : p)))].sort();

describe("emoji: data", () => {
  it("covers 200 fully-qualified emoji with unique CLDR slugs and no flags", () => {
    const data = emojiMessages("en").data;
    expect(EMOJI_SLUGS.length).toBe(200);
    expect(data.map((r) => r.slug)).toEqual([...EMOJI_SLUGS]);
    expect(new Set(EMOJI_SLUGS).size).toBe(200);
    for (const slug of EMOJI_SLUGS) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(data.filter((r) => r.group === "flags")).toEqual([]);
    for (const slug of ["loudly-crying-face", "skull", "pleading-face", "fire", "red-heart", "folded-hands"]) expect(isEmojiSlug(slug)).toBe(true);
  });

  it("round-trips code points", () => {
    for (const row of emojiMessages("en").data) {
      expect(String.fromCodePoint(...row.cp.map((c) => parseInt(c, 16)))).toBe(row.emoji);
      expect([...row.emoji].map((c) => c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0"))).toEqual(row.cp);
      expect(row.year).toBeGreaterThanOrEqual(2010);
      expect(row.year).toBeLessThanOrEqual(2025);
    }
    const sob = emojiRow("en", "loudly-crying-face");
    expect(codepointText(sob)).toBe("U+1F62D");
    expect(htmlCode(sob)).toBe("&#x1F62D;");
    expect(sob).toMatchObject({ emoji: "😭", v: "0.6", year: 2010, group: "smileys-emotion", subgroup: "face-concerned" });
    expect(codepointText(emojiRow("en", "red-heart"))).toBe("U+2764 U+FE0F");
    expect(emojiRow("en", "thumbs-up").variants.length).toBe(5);
    expect(emojiRow("en", "person-facepalming").variants.length).toBe(17);
  });

  it("has a name, keywords, usage and variant names in every locale", () => {
    for (const locale of LOCALES) {
      const m = emojiMessages(locale);
      for (const slug of EMOJI_SLUGS) {
        expect(m.names[slug], `${locale} ${slug}`).toBeTruthy();
        expect(m.english[slug]).toBe(emojiMessages("en").names[slug]);
        expect(m.usage[slug]?.length, `${locale} usage ${slug}`).toBeGreaterThan(5);
        expect(Array.isArray(m.keywords[slug])).toBe(true);
        for (const v of emojiRow(locale, slug).variants) expect(m.variants[v], `${locale} ${v}`).toBeTruthy();
      }
      expect(Object.keys(m.usage).sort()).toEqual(Object.keys(enUsage).sort());
    }
  });

  it("has the same copy keys and placeholders in every locale", () => {
    const keys = paths(en);
    for (const locale of LOCALES) {
      const m = emojiMessages(locale);
      for (const key of keys) {
        expect(leaf(m, key), `${locale} ${key}`).toBeTypeOf("string");
        expect(placeholders(leaf(m, key)), `${locale} ${key}`).toEqual(placeholders(leaf(en, key)));
      }
    }
  });

  it("keeps published slugs: the committed table covers every page, and a refresh never renames", () => {
    const table = slugTable as Record<string, string>;
    for (const row of emojiMessages("en").data) expect(table[row.emoji]).toBe(row.slug);
    expect(new Set(Object.values(table)).size).toBe(Object.keys(table).length);
    // CLDR renaming 😭 keeps its slug; a new emoji gets a slug from its name; a name that would take a used slug fails.
    const renamed = assignSlugs(table, [{ emoji: "😭", name: "sobbing face" }, { emoji: "🫨", name: "shaking face" }]);
    expect(renamed.slugs).toEqual(["loudly-crying-face", "shaking-face"]);
    expect(renamed.table["🫨"]).toBe("shaking-face");
    expect(() => assignSlugs(table, [{ emoji: "🫥", name: "skull" }])).toThrow(/already belongs/);
  });

  it("finds same-subgroup neighbours", () => {
    expect(similarSlugs("en", "loudly-crying-face")).toContain("crying-face");
    // Alone in its subgroup: the rest of its group, and the heading says so.
    expect(emojiPageHtml("en", "dog-face")).toContain("Other emoji in the animals and nature set");
    for (const slug of EMOJI_SLUGS) {
      expect(similarSlugs("en", slug).length).toBeGreaterThan(0);
      expect(similarSlugs("en", slug).length).toBeLessThanOrEqual(8);
    }
  });
});

describe("emoji: pages", () => {
  it("renders the hub and every emoji page in every locale", () => {
    for (const locale of LOCALES) {
      const hub = emojiPageHtml(locale, null);
      expect(hub.match(/class="emoji-copy"/g)?.length).toBe(200);
      expect(hub).not.toMatch(/class="emoji-copy"[^>]*aria-label/);
      expect(hub).toContain('class="sr-only emoji-status" role="status" aria-live="polite"');
      expect(hub).toContain("UNICODE LICENSE V3");
      for (const slug of EMOJI_SLUGS) {
        const html = emojiPageHtml(locale, slug);
        const row = emojiRow(locale, slug);
        expect(html).toContain(`data-copy="${row.emoji}"`);
        expect(html).toContain(codepointText(row));
        expect(html).toContain(escapeHtml(emojiMessages(locale).usage[slug]));
        expect(html).not.toMatch(/\{\w+\}/);
        expect(emojiTitle(locale, slug)).toMatch(/ — cv\.cm$/);
        expect(emojiTitle(locale, slug)).not.toMatch(/\{\w+\}/);
        expect(emojiDescription(locale, slug)).not.toMatch(/\{\w+\}/);
        expect(emojiFaqItems(locale, slug).length).toBe(3);
      }
    }
  }, 60_000);

  it("titles follow the searches", () => {
    expect(emojiTitle("en", "loudly-crying-face")).toBe("😭 Loudly Crying Face Emoji Meaning — cv.cm");
    expect(emojiTitle("en", "face-with-tears-of-joy")).toBe("😂 Face with Tears of Joy Emoji Meaning — cv.cm");
    expect(emojiTitle("zh-CN", "loudly-crying-face")).toBe("😭 放声大哭 表情含义 — cv.cm");
    expect(emojiTitle("ja", "loudly-crying-face")).toBe("😭 大泣きの絵文字の意味 — cv.cm");
    expect(emojiTitle("es", "loudly-crying-face")).toBe("😭 Significado del emoji cara llorando fuerte — cv.cm");
    expect(emojiLabel("es", "loudly-crying-face")).toBe("Cara llorando fuerte");
  });

  it("footer labels match the CLDR names", () => {
    for (const locale of LOCALES) {
      for (const slug of EMOJI_FOCUS) {
        expect((messages(locale).ui as unknown as { emojiFocus: Record<string, string> }).emojiFocus[slug]).toBe(`${emojiRow(locale, slug).emoji} ${emojiLabel(locale, slug)}`);
      }
      expect(messages(locale).ui.nav.emoji).toBeTruthy();
    }
  });

  it("sits under Data and is listed on the data hub", () => {
    const steps = (emojiBreadcrumbJsonLd("en", "skull").itemListElement as { item: string; name: string }[]);
    expect(steps.map((s) => s.item)).toEqual(["https://cv.cm/en/", "https://cv.cm/en/datasets/", "https://cv.cm/en/emoji/", "https://cv.cm/en/emoji/skull/"]);
    expect(steps[3].name).toBe("💀 Skull");
    expect(emojiPageHtml("ja", "skull")).toMatch(/data-nav="home"[^]*data-nav="datasets"[^]*data-nav="emoji"/);
    expect(datasetStaticHtml("en", null)).toContain('href="/en/emoji/"');
  });

  it("builds DefinedTerm and CollectionPage JSON-LD", () => {
    const hub = emojiPageJsonLd("en", null) as { "@type": string; mainEntity: { "@type": string; hasDefinedTerm: unknown[] } };
    expect(hub["@type"]).toBe("CollectionPage");
    expect(hub.mainEntity["@type"]).toBe("DefinedTermSet");
    expect(hub.mainEntity.hasDefinedTerm.length).toBe(200);
    const page = emojiPageJsonLd("ja", "skull") as Record<string, unknown>;
    expect(page).toMatchObject({ "@type": "DefinedTerm", termCode: "U+1F480", inDefinedTermSet: { "@type": "DefinedTermSet" } });
    expect(page.alternateName).toEqual(["💀", "skull"]);
  });

  it("matches hub searches by name, keyword, English name and the emoji itself", () => {
    expect(emojiMatches("en", "loudly-crying-face", "sob")).toBe(true);
    expect(emojiMatches("ja", "loudly-crying-face", "crying")).toBe(true);
    expect(emojiMatches("en", "loudly-crying-face", "😭")).toBe(true);
    expect(emojiMatches("en", "red-heart", "❤")).toBe(true);
    expect(emojiMatches("en", "skull", "rose")).toBe(false);
    expect(emojiMatches("es", "loudly-crying-face", "llorando")).toBe(true);
    // A pasted skin-tone or gender form finds its base emoji.
    expect(baseEmoji("👍🏽")).toBe("👍");
    expect(baseEmoji("🤦‍♀️")).toBe("🤦");
    expect(emojiMatches("en", "thumbs-up", "👍🏽")).toBe(true);
    expect(emojiMatches("en", "person-facepalming", "🤦‍♀️")).toBe(true);
    expect(emojiMatches("en", "person-facepalming", "🤦🏻‍♂️")).toBe(true);
    // Vietnamese đ folds to d (shared foldText).
    expect(emojiMatches("vi", "red-heart", "do")).toBe(emojiMatches("vi", "red-heart", "đỏ"));
  });
});

describe("emoji: routes, sitemap and search", () => {
  it("parses locale and bare paths and rejects unknown slugs", () => {
    expect(parseAppPath("/en/emoji/")).toEqual({ kind: "emoji", locale: "en", entry: null });
    expect(parseAppPath("/zh-cn/emoji/skull/")).toEqual({ kind: "emoji", locale: "zh-CN", entry: "skull" });
    expect(parseAppPath("/emoji/fire")).toEqual({ kind: "bare-emoji", entry: "fire" });
    expect(parseAppPath("/emoji/")).toEqual({ kind: "bare-emoji", entry: null });
    expect(parseAppPath("/en/emoji/unicorn-face-x/")).toEqual({ kind: "unknown" });
    expect(parseAppPath("/en/emoji/skull/x/")).toEqual({ kind: "unknown" });
    expect(emojiHref("zh-TW", "skull")).toBe("/zh-tw/emoji/skull/");
    expect(STATIC_FILE.test("/sitemaps/emoji.xml")).toBe(true);
  });

  it("redirects bare paths, adds the slash and 404s unknown emoji", async () => {
    const bare = await worker.fetch(new Request("https://cv.cm/emoji/skull/", { headers: { "Accept-Language": "ja" } }), { ASSETS: assets });
    expect(bare.status).toBe(302);
    expect(bare.headers.get("Location")).toBe("https://cv.cm/ja/emoji/skull/");
    const slash = await worker.fetch(new Request("https://cv.cm/en/emoji/skull"), { ASSETS: assets });
    expect(slash.status).toBe(301);
    expect(slash.headers.get("Location")).toBe("https://cv.cm/en/emoji/skull/");
    const upper = await worker.fetch(new Request("https://cv.cm/zh-CN/emoji/skull/"), { ASSETS: assets });
    expect(upper.status).toBe(301);
    expect(upper.headers.get("Location")).toBe("https://cv.cm/zh-cn/emoji/skull/");
    const unknown = await worker.fetch(new Request("https://cv.cm/en/emoji/not-an-emoji/"), { ASSETS: assets });
    expect(unknown.status).toBe(404);
    const page = await worker.fetch(new Request("https://cv.cm/ko/emoji/fire/"), { ASSETS: assets });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('<link rel="canonical" href="https://cv.cm/ko/emoji/fire/"');
    for (const id of ["breadcrumb-jsonld", "faq-jsonld", "article-jsonld"]) expect(html).toContain(`id="${id}"`);
    expect(html).not.toContain('id="software-jsonld"');
    expect(html).toContain("DefinedTerm");
  });

  it("serves hreflang for every locale", () => {
    const html = applyHtmlSeo(SHELL, "es", { emoji: true, emojiSlug: "fire" });
    for (const locale of LOCALES) expect(html).toContain(`href="https://cv.cm${emojiHref(locale, "fire")}"`);
    expect(html).toContain('hreflang="x-default" href="https://cv.cm/en/emoji/fire/"');
  });

  it("lists the hub and every emoji in every locale in its own sitemap", () => {
    const xml = buildSectionSitemaps().emoji;
    expect(xml.match(/<url>/g)?.length).toBe(LOCALES.length * 201);
    expect(xml.match(/<lastmod>/g)?.length).toBe(LOCALES.length * 201);
    expect(xml).toContain(`<loc>https://cv.cm/zh-cn/emoji/skull/</loc>\n    <lastmod>${emojiUpdated()}</lastmod>`);
    expect(xml).not.toMatch(/\/emoji\/[^"<]*[A-Z]/);
    expect(sitemapPages().filter((p) => p.kind === "emoji").length).toBe(LOCALES.length * 201);
  });

  it("puts emoji pages in site search under the emoji and its name", () => {
    const index = buildSearchIndex("en" as Locale);
    const skull = index.find((e) => e[1] === "/en/emoji/skull/");
    expect(skull?.[0]).toBe("emoji");
    expect(skull?.[2]).toBe("💀 Skull");
    const ja = buildSearchIndex("ja" as Locale).find((e) => e[1] === "/ja/emoji/skull/" as string);
    expect(ja?.[2]).toBe(`💀 ${emojiMessages("ja").names["skull" as EmojiSlug]}`);
  });
});
