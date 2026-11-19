import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import worker from "../src/worker";
import { LOCALES, type Locale } from "../src/shared/locale";
import { breedsHref, parseAppPath, quizHref } from "../src/shared/path";
import { BREED_IDS, BREED_QUIZ, BREEDS_FOCUS, breedKey, breedKindOf, breedOfQuizResult, isBreedId, type BreedId } from "../src/shared/breeds";
import { breedsMessages } from "../src/shared/breeds-store";
import { breedName, breedsArticleJsonLd, breedsBreadcrumbJsonLd, breedsFaqJsonLd, breedsTitle, breedSize } from "../src/shared/breeds-i18n";
import { breedsPageHtml } from "../src/shared/breeds-page";
import { breedsSyncFiles } from "../src/shared/breeds-sync";
import { QUIZ_DEFS } from "../src/shared/quiz";
import { messages } from "../src/shared/messages";
import { buildSitemapXml, sitemapPages } from "../src/shared/sitemap";
import { pageDescription } from "../src/shared/seo";
import images from "../src/shared/breeds-images.json";
import data from "../src/shared/breeds-data.json";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHELL = `<!doctype html><html lang="en"><head><title>cv.cm</title><meta name="description" content="x" /><link rel="canonical" href="https://cv.cm/" /></head><body><div id="app"></div></body></html>`;
const read = (path: string): string | null => {
  const file = join(root, path);
  return existsSync(file) ? readFileSync(file, "utf8") : null;
};
const HEADINGS: Record<Locale, string[]> = {
  en: ["Origin and history", "Appearance and coat", "Temperament", "Care and exercise", "Health"],
  "zh-CN": ["起源与历史", "外貌与被毛", "性格", "护理与运动", "健康"],
  "zh-TW": ["起源與歷史", "外貌與被毛", "性格", "照顧與運動", "健康"],
  ja: ["起源と歴史", "外見と被毛", "性格", "世話と運動", "健康"],
  ko: ["기원과 역사", "외모와 털", "성격", "관리와 운동", "건강"],
  vi: ["Nguồn gốc và lịch sử", "Ngoại hình và bộ lông", "Tính cách", "Chăm sóc và vận động", "Sức khỏe"],
  id: ["Asal-usul dan sejarah", "Penampilan dan bulu", "Temperamen", "Perawatan dan olahraga", "Kesehatan"],
  es: ["Origen e historia", "Aspecto y pelaje", "Temperamento", "Cuidados y ejercicio", "Salud"],
};

describe("breeds: catalog and data", () => {
  it("has 120 dogs and 45 cats with facts, names and copy files in every locale", () => {
    expect(BREED_IDS.filter((id) => breedKindOf(id) === "dogs")).toHaveLength(120);
    expect(BREED_IDS.filter((id) => breedKindOf(id) === "cats")).toHaveLength(45);
    expect(new Set(BREED_IDS).size).toBe(BREED_IDS.length);
    expect(Object.keys(data)).toEqual([...BREED_IDS]);
    for (const locale of LOCALES) {
      const names = JSON.parse(read(`src/locales/breeds/names/${locale}.json`)!) as Record<string, string>;
      expect(Object.keys(names)).toEqual([...BREED_IDS]);
      expect(read(`src/locales/breeds/${locale}.json`)).not.toBeNull();
      for (const id of BREED_IDS) {
        expect(read(`src/locales/breeds/${locale}/${id}.json`), `${locale} ${id}`).not.toBeNull();
        expect(names[id].trim(), `${locale} ${id}`).not.toBe("");
      }
    }
  });

  it("writes names in each locale's script", () => {
    for (const id of BREED_IDS) {
      expect(breedName("zh-CN", id)).toMatch(/[一-鿿]/u);
      expect(breedName("zh-TW", id)).toMatch(/[一-鿿]/u);
      expect(breedName("ja", id)).toMatch(/[぀-ヿ一-鿿]/u);
      expect(breedName("ko", id)).toMatch(/[가-힯]/u);
      for (const locale of ["en", "vi", "id", "es"] as const) expect(breedName(locale, id)).not.toMatch(/[぀-ヿ一-鿿가-힯]/u);
    }
  });

  it("keeps facts in sane ranges and never invents a figure", () => {
    for (const [id, facts] of Object.entries(data) as [BreedId, (typeof data)[keyof typeof data]][]) {
      expect(facts.origin.length, id).toBeGreaterThan(0);
      for (const code of facts.origin) expect(code).toMatch(/^[A-Z]{2}$/);
      expect(facts.qid).toMatch(/^Q\d+$/);
      expect(facts.wikipedia).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\//);
      for (const range of [facts.height, facts.weight, facts.life]) if (range) expect(range.min).toBeLessThanOrEqual(range.max);
      if (facts.fci) {
        expect(facts.fci.group).toBeGreaterThanOrEqual(1);
        expect(facts.fci.group).toBeLessThanOrEqual(10);
        expect(facts.fci.page).toMatch(/^https:\/\/www\.fci\.be\//);
      }
      for (const r of facts.registries) expect(r.url).toMatch(/^https?:\/\//);
      expect(breedKindOf(id) === "dogs" || facts.fci === null).toBe(true);
    }
  });

  it("credits every picture with a free licence, and the file exists", () => {
    for (const [id, image] of Object.entries(images)) {
      expect(isBreedId(id), id).toBe(true);
      expect(image.src).toBe(`breeds/${breedKey(id as BreedId)}.webp`);
      expect(statSync(join(root, "public/covers", image.src)).size).toBeGreaterThan(1000);
      expect(Math.max(image.width, image.height)).toBeLessThanOrEqual(640);
      expect(image.license).toMatch(/^(Public domain|CC0|CC BY(-SA)? \d\.\d( [a-z]{2})?)$/);
      expect(image.licenseUrl).toMatch(/^https:\/\/creativecommons\.org\//);
      expect(image.page).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      if (image.author) expect(image.author.length).toBeLessThan(60);
      expect([null, "Person", "Organization"]).toContain(image.creatorType);
    }
  });
});

describe("breeds: copy", () => {
  it("has the same shape in every locale", () => {
    for (const id of BREED_IDS) {
      const en = JSON.parse(read(`src/locales/breeds/en/${id}.json`)!);
      for (const locale of LOCALES) {
        const copy = JSON.parse(read(`src/locales/breeds/${locale}/${id}.json`)!);
        const where = `${locale} ${id}`;
        expect(Object.keys(copy), where).toEqual(["blurb", "description", "answer", "sections", "faq"]);
        expect(copy.sections.map((s: { h: string }) => s.h), where).toEqual(HEADINGS[locale]);
        copy.sections.forEach((s: { body: unknown[] }, i: number) => expect(s.body.length, where).toBe(en.sections[i].body.length));
        expect(copy.faq.length, where).toBe(en.faq.length);
        expect(copy.faq.length, where).toBeGreaterThanOrEqual(3);
        expect(copy.blurb, where).not.toMatch(/[.。]$/);
        expect(JSON.stringify(copy), where).not.toContain("`");
      }
    }
  });

  it("generated files are in step with the copy (npm run breeds:sync)", () => {
    const { files, missing } = breedsSyncFiles(read);
    expect(missing).toEqual([]);
    for (const [path, content] of Object.entries(files)) expect(read(path), path).toBe(content);
  });
});

describe("breeds: pages", () => {
  it("lets the hub search find a breed by its name in any locale", () => {
    const hub = breedsPageHtml("en", null);
    expect(hub).toContain("ゴールデン・レトリバー");
    expect(hub).toContain("金毛寻回犬");
  });

  it("renders the hub and every breed in every locale", { timeout: 60_000 }, () => {
    for (const locale of LOCALES) {
      const hub = breedsPageHtml(locale, null);
      expect(hub).toContain(breedsMessages(locale).hub.h1);
      for (const id of BREED_IDS) {
        expect(hub).toContain(`href="${breedsHref(locale, id)}"`);
        const html = breedsPageHtml(locale, id);
        expect(html, `${locale} ${id}`).toContain(`<h1>${breedName(locale, id).replace(/&/g, "&amp;")}</h1>`);
        expect(html).toContain(`href="${quizHref(locale, breedKindOf(id) === "dogs" ? "dog-breed" : "cat-breed")}"`);
        expect(html).toContain(messages(locale).ui.nav.data);
        expect(html).not.toMatch(/\{[a-z]+\}/);
        if ((images as Record<string, unknown>)[id]) expect(html).toContain('rel="noopener license"');
        expect(breedsTitle(locale, id)).toContain(breedName(locale, id));
        expect(pageDescription(locale, { breeds: true, breedId: id }).length).toBeGreaterThan(20);
      }
    }
  });

  it("builds Article, FAQPage and BreadcrumbList JSON-LD with picture licence fields", () => {
    const article = breedsArticleJsonLd("ja", "dogs/shiba-inu") as Record<string, any>;
    expect(article["@type"]).toBe("Article");
    expect(article.about["@type"]).toBe("Thing");
    expect(article.about.sameAs[0]).toMatch(/wikidata\.org/);
    expect(article.image.license).toMatch(/creativecommons/);
    expect(article.image.acquireLicensePage).toMatch(/commons\.wikimedia\.org/);
    expect(article.citation.length).toBeGreaterThanOrEqual(2);
    expect((breedsArticleJsonLd("en", null) as Record<string, any>).mainEntity.numberOfItems).toBe(BREED_IDS.length);
    const crumbs = (breedsBreadcrumbJsonLd("zh-CN", "cats/maine-coon") as Record<string, any>).itemListElement;
    expect(crumbs.map((c: { name: string }) => c.name)).toEqual(["首页", messages("zh-CN").ui.nav.data, breedsMessages("zh-CN").hub.h1, breedName("zh-CN", "cats/maine-coon")].map((n, i) => (i === 0 ? crumbs[0].name : n)));
    expect((breedsFaqJsonLd("es", "dogs/pug") as Record<string, any>).mainEntity.length).toBeGreaterThanOrEqual(3);
  });

  it("uses the search-shaped titles", () => {
    expect(breedsTitle("en", "dogs/golden-retriever")).toBe("Golden Retriever: Size, Temperament, Lifespan — cv.cm");
    expect(breedsTitle("ja", "dogs/golden-retriever")).toBe("ゴールデン・レトリバーの特徴・性格・大きさ — cv.cm");
    expect(breedsTitle("zh-CN", "dogs/golden-retriever")).toBe("金毛寻回犬：体型、性格、寿命 — cv.cm");
  });

  it("sizes breeds only from listed figures", () => {
    expect(breedSize({ ...data["dogs/golden-retriever"], height: { min: 51, max: 61 } } as never, "dogs")).toBe("large");
    expect(breedSize({ ...data["dogs/golden-retriever"], height: null, weight: null } as never, "dogs")).toBeNull();
  });
});

describe("breeds: quiz cross-links and footer", () => {
  it("maps every breed quiz result to a breed page", () => {
    for (const [quiz, entry] of Object.entries(BREED_QUIZ)) {
      expect(Object.keys(entry.results).sort()).toEqual([...QUIZ_DEFS[quiz as keyof typeof QUIZ_DEFS].dims].sort());
      for (const [dim, id] of Object.entries(entry.results)) {
        expect(isBreedId(id)).toBe(true);
        expect(breedKindOf(id)).toBe(entry.kind);
        expect(breedOfQuizResult(quiz, dim)).toBe(id);
      }
    }
    expect(breedOfQuizResult("mbti", "golden")).toBeNull();
  });

  it("footer names equal the breed names", () => {
    for (const locale of LOCALES) {
      const focus = (messages(locale).ui as unknown as { breedsFocus: Record<string, Record<string, string>> }).breedsFocus;
      for (const id of BREEDS_FOCUS) {
        const [kind, slug] = id.split("/");
        expect(focus[kind][slug]).toBe(breedName(locale, id));
      }
    }
  });
});

describe("breeds: routes and sitemap", () => {
  it("parses and round-trips paths", () => {
    expect(parseAppPath("/en/breeds/")).toEqual({ kind: "breeds", locale: "en", entry: null });
    expect(parseAppPath("/zh-cn/breeds/dogs/pug/")).toEqual({ kind: "breeds", locale: "zh-CN", entry: "dogs/pug" });
    expect(parseAppPath("/breeds/cats/ragdoll")).toEqual({ kind: "bare-breeds", entry: "cats/ragdoll" });
    expect(parseAppPath("/en/breeds/dogs/")).toEqual({ kind: "unknown" });
    expect(parseAppPath("/en/breeds/cats/pug/")).toEqual({ kind: "unknown" });
    expect(parseAppPath("/en/breeds/dogs/pug/x/")).toEqual({ kind: "unknown" });
    for (const locale of LOCALES) {
      expect(breedsHref(locale)).toBe(`/${locale.toLowerCase()}/breeds/`);
      for (const id of BREED_IDS) expect(parseAppPath(breedsHref(locale, id))).toEqual({ kind: "breeds", locale, entry: id });
    }
  });

  it("redirects bare paths, 404s unknown breeds and serves the page", async () => {
    const assets = { fetch: async () => new Response(SHELL, { headers: { "Content-Type": "text/html; charset=utf-8" } }) };
    const env = { ASSETS: assets } as never;
    const bare = await worker.fetch(new Request("https://cv.cm/breeds/dogs/pug/", { headers: { "Accept-Language": "ja" } }), env);
    expect(bare.status).toBe(302);
    expect(bare.headers.get("Location")).toBe("https://cv.cm/ja/breeds/dogs/pug/");
    const slash = await worker.fetch(new Request("https://cv.cm/en/breeds/dogs/pug"), env);
    expect(slash.status).toBe(301);
    expect(slash.headers.get("Location")).toBe("https://cv.cm/en/breeds/dogs/pug/");
    expect((await worker.fetch(new Request("https://cv.cm/en/breeds/dogs/nope/"), env)).status).toBe(404);
    const page = await worker.fetch(new Request("https://cv.cm/zh-tw/breeds/cats/maine-coon/"), env);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('<link rel="canonical" href="https://cv.cm/zh-tw/breeds/cats/maine-coon/"');
    expect(html).toContain('hreflang="x-default" href="https://cv.cm/en/breeds/cats/maine-coon/"');
    expect(html).toContain('<meta property="og:type" content="article" />');
    expect(html).toContain('<meta property="og:image" content="https://s3.cv.cm/files/covers/breeds/cat-maine-coon.webp" />');
    expect(html).toContain(breedName("zh-TW", "cats/maine-coon"));
  });

  it("lists every page with hreflang, lastmod and picture in the sitemap", () => {
    const pages = sitemapPages().filter((p) => p.kind === "breeds");
    expect(pages).toHaveLength(LOCALES.length * (1 + BREED_IDS.length));
    const xml = buildSitemapXml(pages);
    expect(xml).toContain("https://cv.cm/zh-cn/breeds/dogs/golden-retriever/");
    expect(xml).not.toContain("/zh-CN/");
    expect(xml.match(/<lastmod>/g)).toHaveLength(pages.length);
    expect(xml).toContain("<image:loc>https://s3.cv.cm/files/covers/breeds/dog-golden-retriever.webp</image:loc>");
    // The hub's lastmod is its JSON-LD dateModified.
    const hubLastmod = /<loc>https:\/\/cv\.cm\/en\/breeds\/<\/loc>\s*<lastmod>([^<]+)</.exec(xml)?.[1];
    expect(hubLastmod).toBe((breedsArticleJsonLd("en", null) as Record<string, string>).dateModified);
  });
});
