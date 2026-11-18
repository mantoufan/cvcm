/**
 * The periodic table page HTML (hub and element pages), shared by the client page and the Worker's crawler copy. Kept
 * out of elements-i18n so the main bundle, which needs only titles, descriptions and JSON-LD, does not carry it.
 * Everything here is templated from the PubChem / Wikidata snapshot: no prose about history or uses.
 */
import { CJK_LOCALES, type Locale } from "./locale";
import { escapeHtml } from "./device-i18n";
import { fill } from "./fill";
import { messages } from "./messages";
import { appHref, elementsHref } from "./path";
import { dataCrumbHtml } from "./channel-parent";
import { ELEMENT_SLUGS, ELEMENTS_SNAPSHOT, atomicNumberOf, blockOf, cellOf, groupMembers, groupOf, hasStandardWeight, periodOf, slugOf, type ElementSlug } from "./elements";
import {
  ELEMENT_CATEGORIES,
  ELEMENTS_SOURCES,
  categoryInText,
  categoryLabel,
  configText,
  elementAnswer,
  elementName,
  elementNameVars,
  elementRow,
  elementVars,
  elementsFaqItems,
  elementsMessages,
  formatMass,
  formatNumber,
  fullConfigText,
  kelvinToCelsius,
  pubchemElementUrl,
  shellsText,
  type ElementRow,
} from "./elements-i18n";

const sep = ` <span aria-hidden="true">/</span> `;

/** A label's colon: full-width in Chinese and Japanese. */
const colon = (locale: Locale): string => (CJK_LOCALES.has(locale) ? "：" : ": ");

function crumbHtml(locale: Locale, slug: ElementSlug | null): string {
  const m = elementsMessages(locale);
  const parts = [
    `<a href="${escapeHtml(appHref(locale, null))}" data-nav="home">${escapeHtml(m.crumbHome)}</a>`,
    dataCrumbHtml(locale),
    slug ? `<a href="${escapeHtml(elementsHref(locale))}" data-nav="elements">${escapeHtml(m.hub.h1)}</a>` : `<span>${escapeHtml(m.hub.h1)}</span>`,
  ];
  if (slug) parts.push(`<span>${escapeHtml(elementName(locale, atomicNumberOf(slug)))}</span>`);
  return `<nav class="device-crumb" aria-label="${escapeHtml(messages(locale).ui.nav.breadcrumb)}">${parts.join(sep)}</nav>`;
}

function faqHtml(locale: Locale, slug: ElementSlug | null): string {
  const items = elementsFaqItems(locale, slug).map((item, index) => (
    `<details${index === 0 ? " open" : ""}><summary>${escapeHtml(item.q)}</summary><p>${escapeHtml(item.a)}</p></details>`
  )).join("");
  return `<section class="faq" aria-labelledby="faq-title"><h2 id="faq-title">${escapeHtml(elementsMessages(locale).page.faqTitle)}</h2>${items}</section>`;
}

function elementLink(locale: Locale, z: number): string {
  const row = elementsMessages(locale).data[z - 1];
  return `<a href="${escapeHtml(elementsHref(locale, slugOf(z)))}" data-nav="element-${slugOf(z)}">${escapeHtml(elementName(locale, z))} (${escapeHtml(row.symbol)})</a>`;
}

/** Data sources, licences and the snapshot date, on the hub and every element page. */
function sourcesHtml(locale: Locale, z: number | null): string {
  const s = elementsMessages(locale).sources;
  const link = (href: string, text: string): string => `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(text)}</a>`;
  const data = escapeHtml(s.data).replace("{pubchem}", link(ELEMENTS_SOURCES.pubchem, s.pubchem));
  const names = escapeHtml(s.names).replace("{wikidata}", link(ELEMENTS_SOURCES.wikidata, s.wikidata));
  const own = z ? `<li>${link(pubchemElementUrl(z), fill(s.element, elementNameVars(locale, z)))}</li>` : "";
  return `<section class="learn-related pt-sources"><h2>${escapeHtml(s.title)}</h2><ul><li>${data}</li><li>${names}</li>${own}</ul>`
    + `<p class="muted">${escapeHtml(fill(s.snapshot, { date: ELEMENTS_SNAPSHOT }))}</p></section>`;
}

/** One table cell: number, symbol, name, mass; the category in words for screen readers (the colour is not the only cue). */
function cellHtml(locale: Locale, row: ElementRow): string {
  const { row: r, col } = cellOf(row.z);
  const name = elementName(locale, row.z);
  const category = categoryLabel(locale, row.category);
  return `<a class="pt-cell pt-${row.category}" href="${escapeHtml(elementsHref(locale, slugOf(row.z)))}" data-nav="element-${slugOf(row.z)}" data-z="${row.z}" style="grid-area:${r + 1}/${col}" title="${escapeHtml(`${name} · ${category}`)}">`
    + `<span class="pt-z">${row.z}</span><b>${escapeHtml(row.symbol)}</b><span class="pt-n">${escapeHtml(name)}</span>`
    + `<span class="pt-m">${escapeHtml(formatMass(locale, row.z, row.mass))}</span><span class="sr-only">${escapeHtml(category)}</span></a>`;
}

/** The whole table as a CSS grid (row 1 holds the group numbers, so every cellOf row moves down one) of plain links (works without JavaScript); the f-block rows sit under it, as on IUPAC's table. */
function tableHtml(locale: Locale): string {
  const m = elementsMessages(locale);
  const cells = m.data.map((row) => cellHtml(locale, row)).join("");
  // Group 3 of periods 6 and 7 points at the f-block rows below.
  const marks = [[6, 57, 71, "lanthanide"], [7, 89, 103, "actinide"]].map(([period, from, to, category]) => (
    `<a class="pt-cell pt-fmark pt-${category}" href="#pt-f${period}" style="grid-area:${Number(period) + 1}/3"><span class="pt-z">${escapeHtml(fill(m.hub.fRow, { from, to }))}</span><span class="sr-only">${escapeHtml(categoryLabel(locale, category as ElementRow["category"]))}</span></a>`
  )).join("");
  const anchors = `<span id="pt-f6" class="pt-anchor" style="grid-area:10/1"></span><span id="pt-f7" class="pt-anchor" style="grid-area:11/1"></span>`;
  const groups = Array.from({ length: 18 }, (_, i) => `<span class="pt-head" aria-hidden="true" style="grid-area:1/${i + 1}">${i + 1}</span>`).join("");
  return `<div class="pt-wrap"><nav class="pt-table" aria-label="${escapeHtml(fill(m.hub.tableLabel, { n: ELEMENT_SLUGS.length }))}">${groups}${marks}${anchors}${cells}</nav></div>`;
}

function legendHtml(locale: Locale): string {
  const m = elementsMessages(locale);
  const items = ELEMENT_CATEGORIES.map((category) => (
    `<li><button type="button" class="pt-key" data-cat="${category}" aria-pressed="false"><span class="pt-chip pt-${category}" aria-hidden="true"></span>${escapeHtml(m.categoryPlural[category])}</button></li>`
  )).join("");
  return `<section class="pt-legend" aria-labelledby="pt-legend-title"><h2 id="pt-legend-title">${escapeHtml(m.hub.legend)}</h2><ul>${items}</ul></section>`;
}

/** Hub list columns: label key, and whether the column is numeric (sorted as numbers, right-aligned). */
const LIST_COLUMNS = [
  ["number", true],
  ["symbol", false],
  ["name", false],
  ["mass", true],
  ["category", false],
  ["group", true],
  ["period", true],
  ["state", false],
  ["melting", true],
  ["boiling", true],
  ["density", true],
  ["electronegativity", true],
  ["year", true],
] as const;
export type ElementListColumn = (typeof LIST_COLUMNS)[number][0];
export const ELEMENT_LIST_COLUMNS: readonly ElementListColumn[] = LIST_COLUMNS.map(([key]) => key);

function listHeading(locale: Locale, key: ElementListColumn): string {
  const l = elementsMessages(locale).labels;
  if (key === "mass") return `${l.mass} (u)`;
  if (key === "melting") return `${l.melting} (K)`;
  if (key === "boiling") return `${l.boiling} (K)`;
  if (key === "density") return `${l.density} (g/cm³)`;
  return l[key];
}

function stateText(locale: Locale, row: ElementRow): string {
  const m = elementsMessages(locale);
  const state = m.states[row.state];
  return row.stateExpected ? fill(m.values.expected, { state }) : state;
}

/** The sortable, filterable list of every element under the table (sorting and filtering are wired by the client). */
function listHtml(locale: Locale): string {
  const m = elementsMessages(locale);
  const none = m.values.none;
  const num = (value: string | null): string => (value ? escapeHtml(formatNumber(locale, value)) : none);
  // The list starts in atomic-number order, so that column is marked sorted ascending.
  const heads = LIST_COLUMNS.map(([key, numeric]) => (
    `<th scope="col"${numeric ? ' class="num"' : ""} aria-sort="${key === "number" ? "ascending" : "none"}"><button type="button" class="data-sort" data-col="${key}" aria-label="${escapeHtml(fill(m.hub.sortBy, { column: listHeading(locale, key) }))}">${escapeHtml(listHeading(locale, key))}</button></th>`
  )).join("");
  const rows = m.data.map((row) => {
    const group = groupOf(row.z);
    const cells = [
      `<td class="num">${row.z}</td>`,
      `<td>${escapeHtml(row.symbol)}</td>`,
      `<th scope="row"><a href="${escapeHtml(elementsHref(locale, slugOf(row.z)))}" data-nav="element-${slugOf(row.z)}">${escapeHtml(elementName(locale, row.z))}</a></th>`,
      `<td class="num">${escapeHtml(formatMass(locale, row.z, row.mass))}</td>`,
      `<td><span class="pt-chip pt-${row.category}" aria-hidden="true"></span>${escapeHtml(categoryLabel(locale, row.category))}</td>`,
      `<td class="num">${group ?? none}</td>`,
      `<td class="num">${periodOf(row.z)}</td>`,
      `<td>${escapeHtml(stateText(locale, row))}</td>`,
      `<td class="num">${num(row.melting)}</td>`,
      `<td class="num">${num(row.boiling)}</td>`,
      `<td class="num">${num(row.density)}</td>`,
      `<td class="num">${num(row.electronegativity)}</td>`,
      `<td class="num">${row.year === "ancient" ? escapeHtml(m.values.ancient) : row.year}</td>`,
    ];
    return `<tr data-z="${row.z}" data-cat="${row.category}">${cells.join("")}</tr>`;
  }).join("");
  const options = ELEMENT_CATEGORIES.map((category) => `<option value="${category}">${escapeHtml(m.categoryPlural[category])}</option>`).join("");
  return `<section class="data-table pt-list" aria-labelledby="pt-list-title"><h2 id="pt-list-title">${escapeHtml(m.hub.listTitle)}</h2>`
    + `<div class="data-tools"><input type="search" class="data-search pt-search" placeholder="${escapeHtml(m.hub.searchPlaceholder)}" aria-label="${escapeHtml(m.hub.search)}" autocomplete="off" enterkeyhint="search">`
    + `<select class="pt-filter" aria-label="${escapeHtml(m.hub.filterCategory)}"><option value="">${escapeHtml(m.hub.allCategories)}</option>${options}</select></div>`
    + `<p class="data-count pt-count" aria-live="polite">${escapeHtml(fill(m.hub.shown, { n: ELEMENT_SLUGS.length, total: ELEMENT_SLUGS.length }))}</p>`
    + `<div class="data-wrap"><table><caption>${escapeHtml(m.hub.listTitle)}</caption><thead><tr>${heads}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function hubHtml(locale: Locale): string {
  const m = elementsMessages(locale);
  return [
    crumbHtml(locale, null),
    `<header class="tool-head"><h1>${escapeHtml(m.hub.h1)}</h1><p class="lede">${escapeHtml(m.hub.lede)}</p></header>`,
    tableHtml(locale),
    legendHtml(locale),
    listHtml(locale),
    `<section class="kb-about"><h2>${escapeHtml(m.hub.aboutTitle)}</h2>${m.hub.about.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}</section>`,
    faqHtml(locale, null),
    sourcesHtml(locale, null),
  ].join("");
}

/** The facts table: every PubChem field with its unit; a dash where PubChem has no value. */
function factsHtml(locale: Locale, slug: ElementSlug): string {
  const m = elementsMessages(locale);
  const l = m.labels;
  const row = elementRow(locale, slug);
  const none = m.values.none;
  const unit = (value: string | null, u: string): string => (value ? `${formatNumber(locale, value)} ${u}` : none);
  const temp = (k: string | null): string => (k ? `${formatNumber(locale, k)} K (${kelvinToCelsius(locale, k)} °C)` : none);
  const group = groupOf(row.z);
  // PubChem marks a configuration it has not measured as "predicted" or "calculated" (meitnerium): say which.
  const measured = row.configNote === "predicted" ? m.values.predicted : row.configNote === "calculated" ? m.values.calculated : null;
  const config = `${configText(row.config)}${measured ? ` (${measured})` : ""}`;
  const facts: [string, string, string?][] = [
    [l.atomicNumber, String(row.z)],
    [l.symbol, row.symbol],
    ...(locale === "en" ? [] : [[l.englishName, m.english[row.z - 1]] as [string, string]]),
    [l.mass, row.mass ? `${formatMass(locale, row.z, row.mass)} u` : none],
    [l.category, categoryLabel(locale, row.category)],
    [l.group, group === null ? m.values.fBlockGroup : String(group)],
    [l.period, String(periodOf(row.z))],
    [l.block, fill(m.values.block, { block: blockOf(row.z) })],
    [l.state, stateText(locale, row)],
    [l.config, config],
    [l.electronegativity, row.electronegativity ? formatNumber(locale, row.electronegativity) : none],
    [l.radius, unit(row.radius, "pm")],
    [l.ionization, unit(row.ionization, "eV")],
    [l.affinity, unit(row.affinity, "eV")],
    [l.oxidation, row.oxidation.length ? row.oxidation.join(", ") : none],
    [l.melting, temp(row.melting)],
    [l.boiling, temp(row.boiling)],
    [l.density, unit(row.density, "g/cm³")],
    [l.year, row.year === "ancient" ? m.values.ancient : String(row.year)],
  ];
  const body = facts.map(([label, value]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join("");
  const cpk = row.cpk
    ? `<tr><th scope="row">${escapeHtml(l.cpk)}</th><td><span class="pt-swatch" style="background:#${row.cpk}" aria-hidden="true"></span>#${row.cpk}</td></tr>`
    : `<tr><th scope="row">${escapeHtml(l.cpk)}</th><td>${none}</td></tr>`;
  const note = hasStandardWeight(row.z) ? "" : `<p class="muted pt-note">${escapeHtml(m.values.massIsotope)}</p>`;
  return `<section class="pt-facts" aria-labelledby="pt-facts-title"><h2 id="pt-facts-title">${escapeHtml(fill(m.page.factsTitle, elementNameVars(locale, row.z)))}</h2>`
    + `<div class="table-wrap"><table class="pt-facts-table"><tbody>${body}${cpk}</tbody></table></div>${note}</section>`;
}

function configHtml(locale: Locale, slug: ElementSlug): string {
  const m = elementsMessages(locale);
  const row = elementRow(locale, slug);
  const vars = elementVars(locale, slug);
  const core = row.config.startsWith("[");
  const note = row.configNote === "predicted" ? m.page.configPredicted : row.configNote === "calculated" ? m.page.configCalculated : "";
  return `<section class="kb-section pt-config" aria-labelledby="pt-config-title"><h2 id="pt-config-title">${escapeHtml(m.page.configTitle)}</h2>`
    + `<p>${escapeHtml(fill(core ? m.page.configText : m.page.configPlain, vars))}${note ? ` ${escapeHtml(note)}` : ""}</p>`
    + `<p class="pt-config-line">${escapeHtml(configText(row.config))}</p>`
    + (core ? `<p><strong>${escapeHtml(m.page.configFull)}${colon(locale).trim()}</strong> <span class="pt-config-full">${escapeHtml(fullConfigText(row.config))}</span></p>` : "")
    + `<p><strong>${escapeHtml(m.page.shells)}${colon(locale).trim()}</strong> ${escapeHtml(shellsText(row.config))}</p></section>`;
}

/** A small map of the table with this element marked, and its group / period in words. */
function positionHtml(locale: Locale, slug: ElementSlug): string {
  const m = elementsMessages(locale);
  const z = atomicNumberOf(slug);
  const row = elementRow(locale, slug);
  const group = groupOf(z);
  const text = group === null
    ? fill(m.page.positionFBlock, { period: periodOf(z), category: categoryInText(locale, row.category) })
    : fill(m.page.positionText, { group, period: periodOf(z), block: blockOf(z) });
  const cells = Array.from({ length: ELEMENT_SLUGS.length }, (_, i) => {
    const { row: r, col } = cellOf(i + 1);
    return `<span${i + 1 === z ? ' class="on"' : ""} style="grid-area:${r}/${col}"></span>`;
  }).join("");
  return `<section class="kb-section pt-position" aria-labelledby="pt-position-title"><h2 id="pt-position-title">${escapeHtml(m.page.positionTitle)}</h2>`
    + `<p>${escapeHtml(text)}</p>`
    + `<div class="pt-map" role="img" aria-label="${escapeHtml(fill(m.page.mapLabel, elementNameVars(locale, z)))}">${cells}</div></section>`;
}

/** Previous and next element, then the rest of its group (or of its f-block row). */
function neighboursHtml(locale: Locale, slug: ElementSlug): string {
  const m = elementsMessages(locale);
  const z = atomicNumberOf(slug);
  const row = elementRow(locale, slug);
  const group = groupOf(z);
  const steps = [
    z > 1 ? `<li>${escapeHtml(m.page.previous)}${colon(locale)}${elementLink(locale, z - 1)}</li>` : "",
    z < ELEMENT_SLUGS.length ? `<li>${escapeHtml(m.page.next)}${colon(locale)}${elementLink(locale, z + 1)}</li>` : "",
  ].join("");
  const fRow = z <= 71 ? [57, 71] : [89, 103];
  const peers = group === null
    ? Array.from({ length: fRow[1] - fRow[0] + 1 }, (_, i) => fRow[0] + i)
    : groupMembers(group);
  const heading = group === null ? fill(m.page.sameRow, { category: m.categoryPlural[row.category] }) : fill(m.page.sameGroup, { group });
  const list = peers.filter((peer) => peer !== z).map((peer) => elementLink(locale, peer)).join(" · ");
  return `<section class="kb-section pt-neighbours" aria-labelledby="pt-neighbours-title"><h2 id="pt-neighbours-title">${escapeHtml(m.page.neighboursTitle)}</h2>`
    + `<ul>${steps}</ul><h3>${escapeHtml(heading)}</h3><p class="slang-jump">${list}</p></section>`;
}

function elementHtml(locale: Locale, slug: ElementSlug): string {
  const m = elementsMessages(locale);
  const row = elementRow(locale, slug);
  const vars = elementVars(locale, slug);
  const name = elementName(locale, row.z);
  const english = m.english[row.z - 1];
  const tile = `<div class="pt-tile pt-${row.category}" aria-hidden="true"><span class="pt-z">${row.z}</span><b>${escapeHtml(row.symbol)}</b><span class="pt-n">${escapeHtml(name)}</span><span class="pt-m">${escapeHtml(formatMass(locale, row.z, row.mass))}</span></div>`;
  return [
    crumbHtml(locale, slug),
    `<article class="pt-element">`,
    `<header class="tool-head"><p class="kicker">${escapeHtml(m.hub.h1)} · ${escapeHtml(categoryLabel(locale, row.category))}</p>`,
    `<h1>${escapeHtml(fill(m.page.h1, vars))}</h1>`,
    locale === "en" || english === name ? "" : `<p class="ref-aka">${escapeHtml(m.labels.englishName)}${colon(locale)}<span lang="en">${escapeHtml(english)}</span></p>`,
    `</header>`,
    `<section class="kb-answer pt-answer">${tile}<p>${escapeHtml(elementAnswer(locale, slug))}</p></section>`,
    factsHtml(locale, slug),
    configHtml(locale, slug),
    positionHtml(locale, slug),
    neighboursHtml(locale, slug),
    faqHtml(locale, slug),
    sourcesHtml(locale, row.z),
    `<p class="more"><a href="${escapeHtml(elementsHref(locale))}" data-nav="elements">${escapeHtml(m.hub.h1)}</a></p>`,
    `</article>`,
  ].join("");
}

/** The periodic table hub (null) or one element as HTML: the client mounts it as is, and the Worker serves it to crawlers. */
export function elementsPageHtml(locale: Locale, slug: ElementSlug | null): string {
  return slug ? elementHtml(locale, slug) : hubHtml(locale);
}
