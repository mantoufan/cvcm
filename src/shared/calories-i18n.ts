/**
 * Calories channel: number formatting, serving labels, titles, descriptions, FAQ and JSON-LD. In the main bundle (the
 * head needs titles); the page HTML lives in calories-page.ts. Copy and numbers come from the calories pack.
 */
import type { Locale } from "./locale";
import { fill } from "./fill";
import { caloriesMessages, type CaloriesMessages } from "./messages";
import { appHref, caloriesHref } from "./path";
import { CALORIE_GROUPS, CALORIES_SNAPSHOT, FOODS, foodGroupOf, type CalorieGroupId, type FoodId } from "./calories";
import { HREFLANG } from "./sitemap";

export type NutrientKey = "kcal" | "kj" | "protein" | "fat" | "satFat" | "carbs" | "fiber" | "sugars" | "sodium" | "potassium" | "calcium" | "iron" | "vitC" | "alcohol";

/** One food in `calories-data.json` (scripts/fetch-calories.mjs). Values are per 100 g; null = not in the record. */
export type FoodData = {
  fdc: number;
  type: "foundation" | "sr";
  desc: string;
  /** FDC nutrient number the calories came from: 208 Energy, 958 / 957 Atwater specific / general factors. */
  energy: "208" | "957" | "958";
  n: Record<Exclude<NutrientKey, "alcohol">, number | null> & { kcal: number; kj: number; alcohol?: number };
  serving: { unit: string; n: number; g: number; usda: string; fdc: number } | null;
};

export type CaloriesData = {
  snapshot: string;
  releases: { foundation: string; sr: string };
  foods: Record<FoodId, FoodData>;
};

const ORIGIN = "https://cv.cm";

/** USDA FoodData Central's page for one record. */
export function fdcUrl(id: number): string {
  return `https://fdc.nal.usda.gov/food-details/${id}/nutrients`;
}

export const FDC_HOME = "https://fdc.nal.usda.gov/";
export const FDC_LICENSE = "https://creativecommons.org/publicdomain/zero/1.0/";

export function caloriesCopy(locale: Locale): CaloriesMessages {
  return caloriesMessages(locale);
}

export function foodData(locale: Locale, id: FoodId): FoodData {
  return caloriesMessages(locale).data.foods[id];
}

const NO_CASE = new Set<Locale>(["zh-CN", "zh-TW", "ja", "ko"]);

/** First letter upper-cased ("banana" → "Banana"); CJK and Korean are unchanged. */
export function upperFirst(locale: Locale, text: string): string {
  if (NO_CASE.has(locale)) return text;
  return text.charAt(0).toLocaleUpperCase(HREFLANG[locale]) + text.slice(1);
}

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "for", "in", "of", "on", "or", "the", "to", "with"]);

/** English title case for titles and the heading ("white rice (cooked)" → "White Rice (Cooked)"); other locales keep the name as written mid-sentence ("Kalori pisang"). */
function titleName(locale: Locale, name: string): string {
  if (locale !== "en") return name;
  return name.split(" ").map((word, i) => {
    const lead = /^[(“"]/.test(word) ? word[0] : "";
    const rest = lead ? word.slice(1) : word;
    if (i > 0 && SMALL_WORDS.has(rest)) return word;
    return lead + rest.charAt(0).toUpperCase() + rest.slice(1);
  }).join(" ");
}

/** The food's name as it reads mid-sentence (lower-case first letter in en/es/id/vi, except proper nouns). */
export function foodName(locale: Locale, id: FoodId): string {
  return (caloriesMessages(locale).names as Record<string, string>)[id];
}

/** The name for lists, links, the breadcrumb and table rows. */
export function foodLabel(locale: Locale, id: FoodId): string {
  return upperFirst(locale, foodName(locale, id));
}

export function groupLabel(locale: Locale, group: CalorieGroupId): string {
  return (caloriesMessages(locale).groups as Record<string, string>)[group];
}

export function formatNumber(locale: Locale, value: number, digits: number): string {
  return new Intl.NumberFormat(HREFLANG[locale], { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value);
}

/** Decimals shown per nutrient. */
export const NUTRIENT_DIGITS: Record<NutrientKey, number> = {
  kcal: 0, kj: 0, protein: 1, fat: 1, satFat: 1, carbs: 1, fiber: 1, sugars: 1, sodium: 0, potassium: 0, calcium: 0, iron: 1, vitC: 1, alcohol: 1,
};

export const NUTRIENT_UNIT: Record<NutrientKey, "kcal" | "kj" | "g" | "mg"> = {
  kcal: "kcal", kj: "kj", protein: "g", fat: "g", satFat: "g", carbs: "g", fiber: "g", sugars: "g", sodium: "mg", potassium: "mg", calcium: "mg", iron: "mg", vitC: "mg", alcohol: "g",
};

/** Rows of the nutrition facts table, in label order. */
export const NUTRIENT_ROWS: readonly NutrientKey[] = ["kcal", "kj", "protein", "fat", "satFat", "carbs", "fiber", "sugars", "sodium", "potassium", "calcium", "iron", "vitC", "alcohol"];

/** A nutrient for `grams` of the food (100 by default), rounded as shown; null when the record has no value. */
export function nutrientValue(food: FoodData, key: NutrientKey, grams = 100): number | null {
  const per100 = food.n[key];
  if (per100 == null) return null;
  const digits = NUTRIENT_DIGITS[key];
  const scale = 10 ** digits;
  return Math.round((per100 * grams) / 100 * scale) / scale;
}

/** "89", "0.3", "1,234" in the locale's digits; the dash for a missing value. */
export function nutrientText(locale: Locale, food: FoodData, key: NutrientKey, grams = 100): string {
  const value = nutrientValue(food, key, grams);
  return value == null ? "—" : formatNumber(locale, value, NUTRIENT_DIGITS[key]);
}

/** Whole calories per 100 g, as titles and lists show them. */
export function kcalPer100(food: FoodData): number {
  return Math.round(food.n.kcal);
}

/** The food's serving when this locale can name it, else null (the page then shows per 100 g only). */
export function usableServing(locale: Locale, food: FoodData): FoodData["serving"] {
  return food.serving && servingLabel(locale, food) != null ? food.serving : null;
}

export function servingKcal(food: FoodData): number | null {
  return food.serving ? Math.round((food.n.kcal * food.serving.g) / 100) : null;
}

/** 0.5 → "1/2", 0.25 → "1/4", else the number. */
function countText(locale: Locale, n: number): string {
  if (n === 0.5) return "1/2";
  if (n === 0.25) return "1/4";
  return formatNumber(locale, n, 2);
}

/** "1 medium", "2 tbsp", "1/2 cup" in the reader's language; null when the food has no serving. */
export function servingLabel(locale: Locale, food: FoodData): string | null {
  if (!food.serving) return null;
  const units = caloriesMessages(locale).units as Record<string, string | { one: string; other: string }>;
  const unit = units[food.serving.unit];
  // A unit without a label in this locale (tests/calories.test.ts guards against it) falls back to per-100 g only.
  if (!unit) return null;
  const n = food.serving.n;
  const text = typeof unit === "string" ? unit : n === 1 || n < 1 ? unit.one : unit.other;
  return fill(text, { n: countText(locale, n) });
}

export function gramsText(locale: Locale, grams: number): string {
  return formatNumber(locale, grams, 1);
}

/** Placeholders shared by the titles, the answer and the FAQ of a food page. */
export function foodVars(locale: Locale, id: FoodId): Record<string, string | number> {
  const food = foodData(locale, id);
  const name = foodName(locale, id);
  const serving = servingLabel(locale, food) ?? "";
  return {
    name,
    Name: upperFirst(locale, name),
    kcal: formatNumber(locale, kcalPer100(food), 0),
    kj: nutrientText(locale, food, "kj"),
    serving,
    Serving: upperFirst(locale, serving),
    g: food.serving ? gramsText(locale, food.serving.g) : "",
    skcal: formatNumber(locale, servingKcal(food) ?? 0, 0),
    protein: nutrientText(locale, food, "protein"),
    fat: nutrientText(locale, food, "fat"),
    carbs: nutrientText(locale, food, "carbs"),
    fiber: nutrientText(locale, food, "fiber"),
    sugars: nutrientText(locale, food, "sugars"),
  };
}

export function caloriesTitle(locale: Locale, id: FoodId | null): string {
  const m = caloriesMessages(locale);
  if (!id) return `${fill(m.hub.title, { n: FOODS.length })} — cv.cm`;
  const vars = foodVars(locale, id);
  return `${fill(m.food.title, { ...vars, name: titleName(locale, foodName(locale, id)) })} — cv.cm`;
}

export function caloriesDescription(locale: Locale, id: FoodId | null): string {
  const m = caloriesMessages(locale);
  if (!id) return fill(m.hub.description, { n: FOODS.length });
  return fill(usableServing(locale, foodData(locale, id)) ? m.food.description : m.food.description100, foodVars(locale, id));
}

export function caloriesH1(locale: Locale, id: FoodId): string {
  return fill(caloriesMessages(locale).food.h1, { ...foodVars(locale, id), name: titleName(locale, foodName(locale, id)) });
}

export function caloriesAnswer(locale: Locale, id: FoodId): string {
  const m = caloriesMessages(locale);
  return fill(usableServing(locale, foodData(locale, id)) ? m.food.answer : m.food.answer100, foodVars(locale, id));
}

/** Foods of the group ordered from the most to the fewest calories per 100 g (ties keep catalog order). */
export function groupByKcal(locale: Locale, group: CalorieGroupId): FoodId[] {
  const foods = [...CALORIE_GROUPS.find((g) => g.id === group)!.foods] as FoodId[];
  return foods
    .map((id, index) => ({ id, index, kcal: kcalPer100(foodData(locale, id)) }))
    .sort((a, b) => b.kcal - a.kcal || a.index - b.index)
    .map((row) => row.id);
}

export function caloriesFaqItems(locale: Locale, id: FoodId | null): { q: string; a: string }[] {
  const m = caloriesMessages(locale);
  if (!id) return m.hub.faq;
  const food = foodData(locale, id);
  const vars = foodVars(locale, id);
  const group = foodGroupOf(id);
  const ranked = groupByKcal(locale, group);
  const kcals = ranked.map((other) => kcalPer100(foodData(locale, other)));
  let a2 = fill(m.food.a2, vars);
  if (food.n.fiber != null) a2 += fill(m.food.a2fiber, vars);
  if (food.n.sugars != null) a2 += fill(m.food.a2sugars, vars);
  const items = [
    ...(usableServing(locale, food) ? [{ q: fill(m.food.q1, vars), a: fill(m.food.a1, vars) }] : []),
    { q: fill(m.food.q2, vars), a: a2 },
    {
      q: fill(m.food.q3, vars),
      a: fill(m.food.a3, {
        ...vars,
        rank: ranked.indexOf(id) + 1,
        count: ranked.length,
        group: groupLabel(locale, group),
        min: formatNumber(locale, Math.min(...kcals), 0),
        max: formatNumber(locale, Math.max(...kcals), 0),
      }),
    },
  ];
  return items;
}

export function caloriesBreadcrumbJsonLd(locale: Locale, id: FoodId | null): Record<string, unknown> {
  const m = caloriesMessages(locale);
  const items = [
    { name: m.crumbHome, item: `${ORIGIN}${appHref(locale, null)}` },
    { name: m.hub.h1, item: `${ORIGIN}${caloriesHref(locale)}` },
  ];
  if (id) items.push({ name: foodLabel(locale, id), item: `${ORIGIN}${caloriesHref(locale, id)}` });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, ...item })),
  };
}

export function caloriesFaqJsonLd(locale: Locale, id: FoodId | null): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: caloriesFaqItems(locale, id).map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

const FDC_PUBLISHER = { "@type": "GovernmentOrganization", name: "U.S. Department of Agriculture, Agricultural Research Service", url: "https://www.ars.usda.gov/" };

/** The USDA record behind a page, as the CreativeWork it is based on. */
function sourceJsonLd(food: FoodData): Record<string, unknown> {
  return {
    "@type": "Dataset",
    name: `FoodData Central ${food.type === "foundation" ? "Foundation Foods" : "SR Legacy"}: ${food.desc}`,
    identifier: `FDC ID ${food.fdc}`,
    url: fdcUrl(food.fdc),
    license: FDC_LICENSE,
    creator: FDC_PUBLISHER,
    isAccessibleForFree: true,
  };
}

/** A food: a WebPage about the food, based on its FoodData Central record. The hub: a CollectionPage with an ItemList. */
export function caloriesPageJsonLd(locale: Locale, id: FoodId | null): Record<string, unknown> {
  const m = caloriesMessages(locale);
  if (!id) {
    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: m.hub.h1,
      description: caloriesDescription(locale, null),
      url: `${ORIGIN}${caloriesHref(locale)}`,
      inLanguage: HREFLANG[locale],
      dateModified: CALORIES_SNAPSHOT,
      isBasedOn: { "@type": "Dataset", name: "USDA FoodData Central", url: FDC_HOME, license: FDC_LICENSE, creator: FDC_PUBLISHER },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: FOODS.length,
        itemListElement: FOODS.map((food, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: foodLabel(locale, food),
          url: `${ORIGIN}${caloriesHref(locale, food)}`,
        })),
      },
    };
  }
  const food = foodData(locale, id);
  const url = `${ORIGIN}${caloriesHref(locale, id)}`;
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: caloriesH1(locale, id),
    description: caloriesDescription(locale, id),
    url,
    inLanguage: HREFLANG[locale],
    dateModified: CALORIES_SNAPSHOT,
    isPartOf: { "@type": "CollectionPage", name: m.hub.h1, url: `${ORIGIN}${caloriesHref(locale)}` },
    about: {
      "@type": "Thing",
      name: foodLabel(locale, id),
      description: caloriesAnswer(locale, id),
    },
    isBasedOn: sourceJsonLd(food),
  };
}
