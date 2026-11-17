import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import worker from "../src/worker";
import "../src/shared/messages-all";
import { LOCALES } from "../src/shared/locale";
import { preloadLocalePack } from "../src/shared/locale-preload";
import { caloriesMessages } from "../src/shared/messages";
import { caloriesHref, parseAppPath } from "../src/shared/path";
import { CALORIE_GROUPS, CALORIES_FOCUS, CALORIES_SNAPSHOT, FOODS, isFoodId } from "../src/shared/calories";
import data from "../src/shared/calories-data.json";
import {
  caloriesFaqItems,
  caloriesPageJsonLd,
  caloriesTitle,
  foodData,
  foodLabel,
  servingKcal,
  servingLabel,
  upperFirst,
  type CaloriesData,
} from "../src/shared/calories-i18n";
import { calcOutHtml, caloriesPageHtml, compareIds, macroSplit } from "../src/shared/calories-page";
import { pageCanonical, pageDescription, pageTitle } from "../src/shared/seo";
import { applyHtmlSeo } from "../src/shared/seo-html";
import { buildSitemapXml, sitemapPages } from "../src/shared/sitemap";
import { isTrackedPath } from "../src/shared/analytics";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHELL = `<!doctype html><html lang="en"><head><title>cv.cm</title><meta name="description" content="x" /><link rel="canonical" href="https://cv.cm/" /></head><body><div id="app"></div></body></html>`;
const snapshot = data as unknown as CaloriesData;

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

/** Keys and array lengths; a unit may be a string or { one, other } in any locale. */
function shape(value: unknown, path = ""): unknown {
  if (path.startsWith("units.")) return "unit";
  if (Array.isArray(value)) return value.map((v, i) => shape(v, `${path}.${i}`));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v, path ? `${path}.${k}` : k)]));
  return typeof value;
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

const placeholders = (text: string): string[] => [...new Set([...text.matchAll(/\{[a-zA-Z]+\}/g)].map((m) => m[0]))].sort();

describe("calories: catalog and data", () => {
  it("lists every food once, with a USDA record, calories and a serving", () => {
    expect(new Set(FOODS).size).toBe(FOODS.length);
    expect(FOODS.length).toBeGreaterThanOrEqual(150);
    expect(Object.keys(snapshot.foods).sort()).toEqual([...FOODS].sort());
    expect(snapshot.snapshot).toBe(CALORIES_SNAPSHOT);
    for (const id of FOODS) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      const food = snapshot.foods[id];
      expect(food.fdc, id).toBeGreaterThan(0);
      expect(["foundation", "sr"]).toContain(food.type);
      expect(food.desc.length, id).toBeGreaterThan(3);
      expect(food.n.kcal, id).toBeGreaterThanOrEqual(0);
      expect(typeof food.n.kcal).toBe("number");
      for (const key of ["protein", "fat", "carbs"] as const) expect(typeof food.n[key], `${id} ${key}`).toBe("number");
      expect(food.serving, id).not.toBeNull();
      expect(food.serving!.g, id).toBeGreaterThan(0);
    }
  });

  it("keeps raw and cooked apart in ids and names where it matters", () => {
    for (const id of ["white-rice-cooked", "white-rice-uncooked", "chicken-breast-roasted", "chicken-breast-raw"]) expect(isFoodId(id)).toBe(true);
    expect(caloriesMessages("en").names["white-rice-cooked"]).toContain("cooked");
    expect(caloriesMessages("en").names["white-rice-uncooked"]).toContain("uncooked");
    expect(caloriesMessages("ja").names["white-rice-cooked"]).not.toBe(caloriesMessages("ja").names["white-rice-uncooked"]);
  });

  it("does the per-serving math from the data", () => {
    const apple = foodData("en", "apple");
    expect(apple.n.kcal).toBe(52);
    expect(apple.serving!.g).toBe(182);
    expect(servingKcal(apple)).toBe(Math.round((52 * 182) / 100));
    expect(servingLabel("en", apple)).toBe("1 medium");
    const rice = foodData("en", "white-rice-cooked");
    expect(servingKcal(rice)).toBe(Math.round((rice.n.kcal * 158) / 100));
    expect(servingLabel("en", foodData("en", "peanut-butter"))).toBe("2 tbsp");
    expect(servingLabel("es", foodData("es", "chestnuts-roasted"))).toMatch(/^10 /);
    expect(servingLabel("en", foodData("en", "ice-cream"))).toBe("1/2 cup");
    const egg = foodData("en", "egg");
    expect(calcOutHtml("en", "egg", 200)).toContain(`${Math.round(egg.n.kcal * 2)} kcal`);
    expect(calcOutHtml("en", "egg", Number.NaN)).toContain("—");
  });

  it("has a label for every serving unit in every locale, with one bracket pair at most", () => {
    const used = new Set(FOODS.map((id) => snapshot.foods[id].serving!.unit));
    for (const locale of LOCALES) {
      const units = caloriesMessages(locale).units;
      for (const unit of used) {
        expect(units[unit], `${locale} ${unit}`).toBeTruthy();
        for (const text of strings(units[unit])) expect(text, `${locale} ${unit}`).not.toMatch(/[()（）]/);
      }
      for (const id of FOODS) expect(servingLabel(locale, foodData(locale, id)), `${locale} ${id}`).toBeTruthy();
    }
    // A unit with no label falls back to per 100 g instead of throwing.
    const odd = { ...foodData("en", "apple"), serving: { ...foodData("en", "apple").serving!, unit: "nope" } };
    expect(servingLabel("en", odd)).toBeNull();
    expect(caloriesPageHtml("en", "apple")).not.toMatch(/\) \(/);
  });

  it("leaves a missing value's sort key empty", () => {
    const hub = caloriesPageHtml("en", null);
    // Every food has protein, fat and carbs today; the rule still holds for a future record without one.
    expect(hub).not.toContain('data-v="-1"');
  });

  it("splits energy into shares that add up to 100, or not at all", () => {
    for (const id of FOODS) {
      const split = macroSplit(foodData("en", id));
      if (split) expect(split.protein + split.fat + split.carbs, id).toBe(100);
    }
    expect(macroSplit(foodData("en", "coffee"))).toBeNull();
    expect(macroSplit(foodData("en", "beer"))).toBeNull();
    expect(macroSplit(foodData("en", "olive-oil"))).toEqual({ protein: 0, fat: 100, carbs: 0 });
  });

  it("compares a food with four others from its group", () => {
    for (const id of FOODS) {
      const ids = compareIds("en", id);
      expect(ids).toContain(id);
      expect(ids.length).toBe(5);
      const group = CALORIE_GROUPS.find((g) => (g.foods as readonly string[]).includes(id))!;
      for (const other of ids) expect(group.foods as readonly string[]).toContain(other);
    }
  });
});

describe("calories: copy", () => {
  const en = readJson("src/locales/calories/en.json") as Record<string, unknown>;
  it("has every key and placeholder in every locale", () => {
    for (const locale of LOCALES) {
      const copy = readJson(`src/locales/calories/${locale}.json`) as Record<string, unknown>;
      expect(shape(copy), locale).toEqual(shape(en));
      const enUnits = en.units as Record<string, unknown>;
      for (const unit of Object.keys(enUnits)) expect(Object.keys(copy.units as object), locale).toContain(unit);
      for (const section of ["hub", "ui", "food"] as const) {
        const a = en[section] as Record<string, unknown>;
        const b = copy[section] as Record<string, unknown>;
        for (const key of Object.keys(a)) {
          const enText = strings(a[key]).join(" ");
          const text = strings(b[key]).join(" ");
          expect(placeholders(text), `${locale} ${section}.${key}`).toEqual(placeholders(enText));
        }
      }
      for (const unit of Object.keys(enUnits)) {
        if (unit === "half" || unit === "half-breast") continue;
        for (const text of strings((copy.units as Record<string, unknown>)[unit])) expect(text, `${locale} ${unit}`).toContain("{n}");
      }
      const names = copy.names as Record<string, string>;
      for (const id of FOODS) expect(names[id]?.trim().length, `${locale} ${id}`).toBeGreaterThan(0);
    }
  });

  it("keeps the footer's food names equal to each food's name, and has the nav label", () => {
    for (const locale of LOCALES) {
      const core = readJson(`src/locales/${locale}.json`) as { caloriesFocus: Record<string, string>; nav: Record<string, string> };
      expect(core.nav.calories, locale).toBeTruthy();
      expect(Object.keys(core.caloriesFocus).sort()).toEqual([...CALORIES_FOCUS].sort());
      for (const id of CALORIES_FOCUS) expect(core.caloriesFocus[id], `${locale} ${id}`).toBe(foodLabel(locale, id));
    }
  });
});

describe("calories: routes", () => {
  it("parses and round-trips locale and bare paths", () => {
    expect(parseAppPath("/en/calories/")).toEqual({ kind: "calories", locale: "en", food: null });
    expect(parseAppPath("/zh-tw/calories/banana/")).toEqual({ kind: "calories", locale: "zh-TW", food: "banana" });
    expect(parseAppPath("/calories/")).toEqual({ kind: "bare-calories", food: null });
    expect(parseAppPath("/calories/banana")).toEqual({ kind: "bare-calories", food: "banana" });
    expect(parseAppPath("/en/calories/nope/")).toEqual({ kind: "unknown" });
    expect(parseAppPath("/en/calories/banana/x/")).toEqual({ kind: "unknown" });
    expect(parseAppPath("/en/calories-burned/")).toEqual({ kind: "app", locale: "en", tool: "calories-burned" });
    expect(caloriesHref("zh-CN", "egg")).toBe("/zh-cn/calories/egg/");
    for (const locale of LOCALES) {
      expect(parseAppPath(caloriesHref(locale))).toEqual({ kind: "calories", locale, food: null });
      for (const id of FOODS) expect(parseAppPath(caloriesHref(locale, id))).toEqual({ kind: "calories", locale, food: id });
    }
  });

  it("redirects bare paths, adds the slash, 404s unknown foods and serves the page", async () => {
    const assets = { fetch: async () => new Response(SHELL, { headers: { "Content-Type": "text/html; charset=utf-8" } }) };
    const bare = await worker.fetch(new Request("https://cv.cm/calories/banana/", { headers: { "Accept-Language": "ja" } }), { ASSETS: assets });
    expect(bare.status).toBe(302);
    expect(bare.headers.get("Location")).toBe("https://cv.cm/ja/calories/banana/");
    const slash = await worker.fetch(new Request("https://cv.cm/en/calories/egg"), { ASSETS: assets });
    expect(slash.status).toBe(301);
    expect(slash.headers.get("Location")).toBe("https://cv.cm/en/calories/egg/");
    const upper = await worker.fetch(new Request("https://cv.cm/en/calories/Banana/"), { ASSETS: assets });
    expect(upper.status).toBe(301);
    expect(upper.headers.get("Location")).toBe("https://cv.cm/en/calories/banana/");
    const unknown = await worker.fetch(new Request("https://cv.cm/en/calories/nope/"), { ASSETS: assets });
    expect(unknown.status).toBe(404);
    const page = await worker.fetch(new Request("https://cv.cm/zh-tw/calories/banana/"), { ASSETS: assets });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('<link rel="canonical" href="https://cv.cm/zh-tw/calories/banana/"');
    expect(html).toContain('hreflang="x-default" href="https://cv.cm/en/calories/banana/"');
    expect(html).toContain('hreflang="zh-CN" href="https://cv.cm/zh-cn/calories/banana/"');
    expect(html).toContain("香蕉熱量");
    for (const id of ["breadcrumb-jsonld", "faq-jsonld", "article-jsonld"]) expect(html.match(new RegExp(`id="${id}"`, "g"))?.length, id).toBe(1);
    expect(html).not.toContain('id="howto-jsonld"');
    expect(html).not.toContain('id="software-jsonld"');
  });

  it("preloads the calories pack on its pages", () => {
    const packs = { "calories-ja": ["/assets/cal-ja.js", "/assets/data.js"], ja: ["/assets/ja.js"] };
    const out = preloadLocalePack("<head></head>", "ja", false, packs, false, false, null, null, null, null, null, null, null, true);
    expect(out).toContain("/assets/cal-ja.js");
    expect(out).toContain("/assets/data.js");
    expect(preloadLocalePack("<head></head>", "ja", false, packs)).not.toContain("cal-ja");
  });

  it("is in the sitemap with every locale, alternates and the snapshot lastmod, and tracked by analytics", () => {
    const pages = sitemapPages().filter((p) => p.kind === "calories");
    expect(pages.length).toBe(LOCALES.length * (FOODS.length + 1));
    const xml = buildSitemapXml(pages);
    expect(xml.match(/<url>/g)?.length).toBe(pages.length);
    expect(xml.match(/<lastmod>/g)?.length).toBe(pages.length);
    expect(xml).toContain(`<loc>https://cv.cm/ko/calories/banana/</loc>\n    <lastmod>${CALORIES_SNAPSHOT}</lastmod>`);
    expect(xml).toContain('hreflang="zh-TW" href="https://cv.cm/zh-tw/calories/egg/"');
    expect(xml).toContain('hreflang="x-default" href="https://cv.cm/en/calories/"');
    expect(isTrackedPath("/en/calories/banana/")).toBe(true);
  });
});

describe("calories: page HTML and SEO", () => {
  it("renders the hub and every food in every locale without missing copy", () => {
    for (const locale of LOCALES) {
      const hub = caloriesPageHtml(locale, null);
      expect(hub.match(/<tr data-group=/g)?.length, locale).toBe(FOODS.length);
      expect(hub).toContain('class="faq"');
      for (const id of FOODS) {
        const html = caloriesPageHtml(locale, id);
        expect(html, `${locale} ${id}`).not.toMatch(/\{[a-zA-Z]+\}|undefined|NaN|null/);
        expect(html).toContain('class="kb-answer"');
        expect(html).toContain('class="cal-calc"');
        expect(html).toContain(`/food-details/${foodData(locale, id).fdc}/nutrients`);
        expect(html.match(/<details/g)?.length).toBe(3);
        const title = pageTitle(locale, { calories: true, foodId: id });
        expect(title, `${locale} ${id}`).toMatch(/ — cv\.cm$/);
        expect(title).not.toMatch(/\{|undefined/);
        expect(pageDescription(locale, { calories: true, foodId: id })).not.toMatch(/\{|undefined|NaN/);
        for (const item of caloriesFaqItems(locale, id)) expect(`${item.q} ${item.a}`).not.toMatch(/\{|undefined|NaN/);
      }
    }
  }, 60_000);

  it("answers with calories per 100 g and per serving", () => {
    const banana = foodData("en", "banana");
    const html = caloriesPageHtml("en", "banana");
    expect(html).toContain(`Banana: 100 g has ${Math.round(banana.n.kcal)} kcal`);
    expect(html).toContain(`1 medium (${banana.serving!.g} g) has about ${servingKcal(banana)} kcal`);
    expect(caloriesTitle("en", "white-rice-cooked")).toBe(`Calories in White Rice (Cooked): ${Math.round(foodData("en", "white-rice-cooked").n.kcal)} kcal per 100 g, Nutrition Facts — cv.cm`);
    expect(caloriesTitle("ja", "banana")).toMatch(/^バナナのカロリー：100gあたり\d+kcal/);
    expect(caloriesTitle("zh-TW", "banana")).toMatch(/^香蕉熱量：每100克\d+大卡/);
    expect(upperFirst("es", "plátano")).toBe("Plátano");
  });

  it("titles, canonicals and JSON-LD", () => {
    expect(pageCanonical("zh-CN", { calories: true, foodId: "kimchi" })).toBe("https://cv.cm/zh-cn/calories/kimchi/");
    expect(pageCanonical("en", { calories: true })).toBe("https://cv.cm/en/calories/");
    const hub = caloriesPageJsonLd("en", null) as { "@type": string; mainEntity: { numberOfItems: number } };
    expect(hub["@type"]).toBe("CollectionPage");
    expect(hub.mainEntity.numberOfItems).toBe(FOODS.length);
    const food = caloriesPageJsonLd("es", "avocado") as { "@type": string; isBasedOn: { url: string; license: string } };
    expect(food["@type"]).toBe("WebPage");
    expect(food.isBasedOn.license).toContain("publicdomain/zero/1.0");
    const out = applyHtmlSeo(SHELL, "ko", { calories: true, foodId: "banana" });
    expect(out).toContain("<title>바나나 칼로리");
    expect(out).toContain('"FAQPage"');
    expect(out).toContain('"BreadcrumbList"');
  });
});
