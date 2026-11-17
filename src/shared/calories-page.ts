/**
 * The calories page HTML (hub and food pages), shared by the client page and the Worker's crawler copy. Kept out of
 * calories-i18n so the main bundle, which needs only titles, descriptions and JSON-LD, does not carry it.
 */
import type { Locale } from "./locale";
import { escapeHtml } from "./device-i18n";
import { fill } from "./fill";
import { dateLabel, linkListHtml } from "./article-html";
import { caloriesMessages, messages } from "./messages";
import { appHref, caloriesHref } from "./path";
import { CALORIE_GROUPS, CALORIES_SNAPSHOT, CALORIES_TOOLS, FOODS, foodGroupOf, type FoodId } from "./calories";
import {
  FDC_HOME,
  FDC_LICENSE,
  NUTRIENT_ROWS,
  NUTRIENT_UNIT,
  caloriesAnswer,
  caloriesFaqItems,
  caloriesH1,
  fdcUrl,
  foodData,
  foodLabel,
  formatNumber,
  gramsText,
  groupLabel,
  kcalPer100,
  nutrientText,
  servingLabel,
  usableServing,
  type FoodData,
  type NutrientKey,
} from "./calories-i18n";

type Copy = ReturnType<typeof caloriesMessages>;

function unitText(m: Copy, key: NutrientKey): string {
  return m[NUTRIENT_UNIT[key]];
}

/** "89 kcal", "0.3 g", "—". */
function valueText(locale: Locale, m: Copy, food: FoodData, key: NutrientKey, grams = 100): string {
  const text = nutrientText(locale, food, key, grams);
  return text === "—" ? text : `${text} ${unitText(m, key)}`;
}

function crumbHtml(locale: Locale, id: FoodId | null): string {
  const m = caloriesMessages(locale);
  const sep = ` <span aria-hidden="true">/</span> `;
  const parts = [
    `<a href="${escapeHtml(appHref(locale, null))}" data-nav="home">${escapeHtml(m.crumbHome)}</a>`,
    id
      ? `<a href="${escapeHtml(caloriesHref(locale))}" data-nav="calories">${escapeHtml(m.hub.h1)}</a>`
      : `<span>${escapeHtml(m.hub.h1)}</span>`,
  ];
  if (id) parts.push(`<span>${escapeHtml(foodLabel(locale, id))}</span>`);
  return `<nav class="device-crumb" aria-label="${escapeHtml(messages(locale).ui.nav.breadcrumb)}">${parts.join(sep)}</nav>`;
}

function faqHtml(locale: Locale, id: FoodId | null): string {
  const items = caloriesFaqItems(locale, id).map((item, index) => (
    `<details${index === 0 ? " open" : ""}><summary>${escapeHtml(item.q)}</summary><p>${escapeHtml(item.a)}</p></details>`
  )).join("");
  return `<section class="faq" aria-labelledby="faq-title"><h2 id="faq-title">${escapeHtml(caloriesMessages(locale).ui.faq)}</h2>${items}</section>`;
}

function toolsHtml(locale: Locale): string {
  const ui = messages(locale).ui;
  const tools = ui.tools as unknown as Record<string, { name: string; blurb: string }>;
  const items = CALORIES_TOOLS.map((tool) => ({ href: appHref(locale, tool), name: tools[tool].name, blurb: tools[tool].blurb, nav: tool }));
  return `<section class="learn-related"><h2>${escapeHtml(caloriesMessages(locale).ui.tools)}</h2>${linkListHtml(items)}</section>`;
}

const sortButton = (label: string): string => `<th scope="col" aria-sort="none"><button type="button" class="data-sort">${escapeHtml(label)}</button></th>`;

/** The hub table: every food with its group and per-100 g calories and macros; the client wires search, group and sort. */
function hubTableHtml(locale: Locale): string {
  const m = caloriesMessages(locale);
  const ui = m.ui;
  const kcalHead = `${m.nutrients.kcal} (${m.kcal}) ${ui.per100Short}`;
  const head = [
    sortButton(ui.food),
    sortButton(ui.group),
    sortButton(kcalHead),
    sortButton(`${m.nutrients.protein} (${m.g})`),
    sortButton(`${m.nutrients.fat} (${m.g})`),
    sortButton(`${m.nutrients.carbs} (${m.g})`),
  ].join("");
  const rows = FOODS.map((id) => {
    const food = foodData(locale, id);
    const group = foodGroupOf(id);
    const label = foodLabel(locale, id);
    const query = `${label} ${id.replaceAll("-", " ")}`.toLocaleLowerCase();
    // A value the record lacks has an empty data-v: the client sorts it last either way.
    const num = (key: NutrientKey): string => `<td class="num" data-v="${food.n[key] ?? ""}">${escapeHtml(nutrientText(locale, food, key))}</td>`;
    return `<tr data-group="${group}" data-q="${escapeHtml(query)}">`
      + `<th scope="row" data-v="${escapeHtml(label)}"><a href="${escapeHtml(caloriesHref(locale, id))}" data-nav="food-${id}">${escapeHtml(label)}</a></th>`
      + `<td data-v="${CALORIE_GROUPS.findIndex((g) => g.id === group)}">${escapeHtml(groupLabel(locale, group))}</td>`
      + `<td class="num" data-v="${food.n.kcal}">${escapeHtml(formatNumber(locale, kcalPer100(food), 0))}</td>`
      + num("protein") + num("fat") + num("carbs")
      + `</tr>`;
  }).join("");
  const options = [`<option value="">${escapeHtml(ui.allGroups)}</option>`, ...CALORIE_GROUPS.map((g) => `<option value="${g.id}">${escapeHtml(groupLabel(locale, g.id))}</option>`)].join("");
  return `<section class="data-table cal-table" aria-label="${escapeHtml(m.hub.h1)}">`
    + `<div class="data-tools"><input type="search" class="data-search" placeholder="${escapeHtml(ui.searchPlaceholder)}" aria-label="${escapeHtml(ui.search)}" autocomplete="off" enterkeyhint="search">`
    + `<select class="cal-group" aria-label="${escapeHtml(ui.group)}">${options}</select></div>`
    + `<p class="data-count" aria-live="polite">${escapeHtml(fill(ui.rows, { n: formatNumber(locale, FOODS.length, 0) }))}</p>`
    + `<div class="data-wrap"><table><caption>${escapeHtml(m.hub.h1)}. ${escapeHtml(ui.sortHint)}</caption><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`
    + `<p class="data-empty" hidden>${escapeHtml(ui.noMatch)}</p></section>`;
}

function sourceHtml(locale: Locale, food: FoodData | null): string {
  const m = caloriesMessages(locale);
  const ui = m.ui;
  const snapshot = escapeHtml(fill(ui.snapshot, { date: dateLabel(locale, CALORIES_SNAPSHOT) }));
  const license = `<a href="${FDC_LICENSE}" target="_blank" rel="noopener license">${escapeHtml(ui.license)}</a>`;
  if (!food) {
    return `<p class="data-source muted">${escapeHtml(ui.source)}: <a href="${FDC_HOME}" target="_blank" rel="noopener">USDA FoodData Central</a> · ${license} · ${snapshot}</p>`;
  }
  const record = fill(ui.sourceLine, { type: food.type === "foundation" ? ui.foundation : ui.sr, id: String(food.fdc), desc: food.desc });
  const lines = [
    `${escapeHtml(ui.source)}: <a href="${escapeHtml(fdcUrl(food.fdc))}" target="_blank" rel="noopener">${escapeHtml(record)}</a>`,
    food.serving ? `<a href="${escapeHtml(fdcUrl(food.serving.fdc))}" target="_blank" rel="noopener">${escapeHtml(fill(ui.servingSource, { id: String(food.serving.fdc), usda: food.serving.usda }))}</a>` : "",
    `${license} · ${snapshot}`,
  ].filter(Boolean);
  return `<p class="data-source muted">${lines.join("<br>")}</p>`;
}

/** Energy shares of protein, fat and carbohydrate (4/9/4 kcal per g), summing to 100; null when they explain too little of the energy. */
export function macroSplit(food: FoodData): { protein: number; fat: number; carbs: number } | null {
  const p = (food.n.protein ?? 0) * 4;
  const f = (food.n.fat ?? 0) * 9;
  const c = (food.n.carbs ?? 0) * 4;
  const total = p + f + c;
  if (food.n.kcal < 5 || total < food.n.kcal * 0.5) return null;
  const raw = [p, f, c].map((v) => (v / total) * 100);
  const floors = raw.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return { protein: floors[0], fat: floors[1], carbs: floors[2] };
}

function macroHtml(locale: Locale, food: FoodData): string {
  const m = caloriesMessages(locale);
  const split = macroSplit(food);
  const head = `<h2>${escapeHtml(m.ui.macro)}</h2>`;
  if (!split) {
    const note = food.n.alcohol ? m.ui.macroAlcohol : m.ui.macroNone;
    return `<section class="cal-macro">${head}<p class="muted">${escapeHtml(note)}</p></section>`;
  }
  const parts = (["protein", "fat", "carbs"] as const).map((key) => ({ key, pct: split[key], label: m.nutrients[key] }));
  const bar = parts.map((p) => `<span class="cal-${p.key}" style="width:${p.pct}%"></span>`).join("");
  const legend = parts.map((p) => `<li><i class="cal-${p.key}" aria-hidden="true"></i>${escapeHtml(p.label)} ${p.pct}%</li>`).join("");
  return `<section class="cal-macro">${head}<div class="cal-bar" aria-hidden="true">${bar}</div><ul class="cal-legend">${legend}</ul><p class="muted">${escapeHtml(m.ui.macroNote)}</p></section>`;
}

/** Calculator results for `grams`: calories and the three macros. The client re-renders the same list on input. */
export function calcOutHtml(locale: Locale, id: FoodId, grams: number): string {
  const m = caloriesMessages(locale);
  const food = foodData(locale, id);
  const valid = Number.isFinite(grams) && grams >= 0 && grams <= 100_000;
  const rows = (["kcal", "protein", "fat", "carbs"] as const).map((key) => (
    `<div><dt>${escapeHtml(m.nutrients[key])}</dt><dd>${escapeHtml(valid ? valueText(locale, m, food, key, grams) : "—")}</dd></div>`
  )).join("");
  return `<p class="cal-out-head">${escapeHtml(fill(m.ui.calcOut, { g: valid ? gramsText(locale, grams) : "—" }))}</p><dl class="cal-out-list">${rows}</dl>`;
}

function calcHtml(locale: Locale, id: FoodId, food: FoodData): string {
  const m = caloriesMessages(locale);
  const serving = usableServing(locale, food);
  const grams = serving?.g ?? 100;
  const label = servingLabel(locale, food);
  return `<section class="cal-calc" aria-labelledby="cal-calc-title"><h2 id="cal-calc-title">${escapeHtml(m.ui.calc)}</h2>`
    + `<p class="cal-calc-row"><label>${escapeHtml(m.ui.calcLabel)} <input type="number" class="cal-grams" inputmode="decimal" min="0" max="100000" step="any" value="${grams}"></label> `
    + `<button type="button" class="btn ghost" data-grams="100">100 ${escapeHtml(m.g)}</button>`
    + (serving && label ? ` <button type="button" class="btn ghost" data-grams="${serving.g}">${escapeHtml(label)}</button>` : "")
    + `</p><div class="cal-out" aria-live="polite">${calcOutHtml(locale, id, grams)}</div></section>`;
}

function factsHtml(locale: Locale, food: FoodData): string {
  const m = caloriesMessages(locale);
  const ui = m.ui;
  const label = servingLabel(locale, food);
  const grams = usableServing(locale, food)?.g ?? null;
  const rows = NUTRIENT_ROWS.filter((key) => key !== "alcohol" || food.n.alcohol).map((key) => {
    // "Energy" + " (kJ)" unless the locale's label already names the unit ("エネルギー（kJ）").
    const name = key === "kj" && !m.nutrients.kj.includes(m.kj) ? `${m.nutrients.kj} (${m.kj})` : m.nutrients[key];
    const cell = (g: number): string => {
      const text = valueText(locale, m, food, key, g);
      return text === "—" ? `<td class="num" title="${escapeHtml(ui.missing)}">—</td>` : `<td class="num">${escapeHtml(text)}</td>`;
    };
    return `<tr><th scope="row">${escapeHtml(name)}</th>${cell(100)}${grams != null ? cell(grams) : ""}</tr>`;
  }).join("");
  const head = `<tr><th scope="col">${escapeHtml(ui.nutrient)}</th><th scope="col" class="num">${escapeHtml(ui.per100)}</th>${grams != null ? `<th scope="col" class="num">${escapeHtml(ui.perServing)}</th>` : ""}</tr>`;
  const atwater = food.energy === "958" ? ui.atwater958 : food.energy === "957" ? ui.atwater957 : null;
  return `<section class="cal-facts" aria-labelledby="cal-facts-title"><h2 id="cal-facts-title">${escapeHtml(ui.facts)}</h2>`
    + (label && grams != null ? `<p class="muted">${escapeHtml(fill(ui.servingIs, { serving: label, g: gramsText(locale, grams) }))}</p>` : "")
    + `<div class="data-wrap cal-facts-table"><table><thead>${head}</thead><tbody>${rows}</tbody></table></div>`
    + (atwater ? `<p class="muted">${escapeHtml(atwater)}</p>` : "")
    + `<p class="muted">${escapeHtml(ui.note)}</p></section>`;
}

/** The food and the four foods of its group closest in calories per 100 g, from the most to the fewest calories. */
export function compareIds(locale: Locale, id: FoodId): FoodId[] {
  const group = CALORIE_GROUPS.find((g) => g.id === foodGroupOf(id))!;
  const kcal = (food: FoodId): number => foodData(locale, food).n.kcal;
  const others = (group.foods as readonly FoodId[])
    .filter((food) => food !== id)
    .map((food, index) => ({ food, index, d: Math.abs(kcal(food) - kcal(id)) }))
    .sort((a, b) => a.d - b.d || a.index - b.index)
    .slice(0, 4)
    .map((row) => row.food);
  return [id, ...others].sort((a, b) => kcal(b) - kcal(a));
}

function compareHtml(locale: Locale, id: FoodId): string {
  const m = caloriesMessages(locale);
  const head = `<tr><th scope="col">${escapeHtml(m.ui.food)}</th><th scope="col" class="num">${escapeHtml(m.nutrients.kcal)} (${escapeHtml(m.kcal)})</th><th scope="col" class="num">${escapeHtml(m.nutrients.protein)} (${escapeHtml(m.g)})</th><th scope="col" class="num">${escapeHtml(m.nutrients.fat)} (${escapeHtml(m.g)})</th><th scope="col" class="num">${escapeHtml(m.nutrients.carbs)} (${escapeHtml(m.g)})</th></tr>`;
  const rows = compareIds(locale, id).map((food) => {
    const data = foodData(locale, food);
    const name = food === id
      ? `<strong aria-current="page">${escapeHtml(foodLabel(locale, food))}</strong>`
      : `<a href="${escapeHtml(caloriesHref(locale, food))}" data-nav="food-${food}">${escapeHtml(foodLabel(locale, food))}</a>`;
    return `<tr${food === id ? ' class="on"' : ""}><th scope="row">${name}</th><td class="num">${escapeHtml(formatNumber(locale, kcalPer100(data), 0))}</td>`
      + `<td class="num">${escapeHtml(nutrientText(locale, data, "protein"))}</td><td class="num">${escapeHtml(nutrientText(locale, data, "fat"))}</td><td class="num">${escapeHtml(nutrientText(locale, data, "carbs"))}</td></tr>`;
  }).join("");
  return `<section class="cal-compare"><h2>${escapeHtml(m.ui.compare)}</h2><p class="muted">${escapeHtml(m.ui.per100)}</p><div class="data-wrap"><table><thead>${head}</thead><tbody>${rows}</tbody></table></div></section>`;
}

/** The calories hub or one food as HTML: the client mounts it as is, and the Worker serves it to crawlers. */
export function caloriesPageHtml(locale: Locale, id: FoodId | null): string {
  const m = caloriesMessages(locale);
  if (!id) {
    return [
      crumbHtml(locale, null),
      `<header class="tool-head"><h1>${escapeHtml(m.hub.h1)}</h1><p class="lede">${escapeHtml(fill(m.hub.lede, { n: FOODS.length }))}</p></header>`,
      hubTableHtml(locale),
      sourceHtml(locale, null),
      `<p class="muted">${escapeHtml(m.ui.note)}</p>`,
      `<section class="kb-about">${m.hub.about.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}</section>`,
      toolsHtml(locale),
      faqHtml(locale, null),
    ].join("");
  }
  const food = foodData(locale, id);
  const group = foodGroupOf(id);
  return [
    crumbHtml(locale, id),
    `<article class="kb calories">`,
    `<header class="tool-head"><p class="kicker">${escapeHtml(m.ui.kicker)} · ${escapeHtml(groupLabel(locale, group))}</p><h1>${escapeHtml(caloriesH1(locale, id))}</h1></header>`,
    `<section class="kb-answer" aria-label="${escapeHtml(m.ui.answer)}"><h2>${escapeHtml(m.ui.answer)}</h2><p>${escapeHtml(caloriesAnswer(locale, id))}</p></section>`,
    factsHtml(locale, food),
    macroHtml(locale, food),
    calcHtml(locale, id, food),
    compareHtml(locale, id),
    faqHtml(locale, id),
    toolsHtml(locale),
    sourceHtml(locale, food),
    `<p class="more"><a href="${escapeHtml(caloriesHref(locale))}" data-nav="calories">${escapeHtml(fill(m.ui.allLink, { n: FOODS.length }))}</a></p>`,
    `</article>`,
  ].join("");
}

