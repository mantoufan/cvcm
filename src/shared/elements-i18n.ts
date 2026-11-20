/**
 * Periodic table channel: the elements pack registry, titles, descriptions, FAQ and JSON-LD (main bundle, for the
 * page head). Page HTML is in `elements-page.ts`, kept out of the main bundle (AGENTS.md, seo.ts / seo-html.ts).
 */
import type { Locale } from "./locale";
import { fill } from "./fill";
import { elementsMessages, type ElementsMessages } from "./messages";
import { appHref, elementsHref } from "./path";
import { dataCrumbItem } from "./channel-parent";
import { HREFLANG } from "./sitemap";
import {
  ELEMENT_SLUGS,
  ELEMENTS_PUBLISHED,
  ELEMENTS_SNAPSHOT,
  atomicNumberOf,
  blockOf,
  groupOf,
  hasStandardWeight,
  periodOf,
  shellsOf,
  subshells,
  type ElementSlug,
} from "./elements";

/** One element as PubChem lists it (`src/shared/elements-data.json`, from scripts/fetch-elements.mjs). Numbers keep PubChem's digits. */
export type ElementRow = {
  z: number;
  symbol: string;
  pubchemName: string;
  mass: string | null;
  cpk: string | null;
  config: string;
  configNote: "predicted" | "calculated" | null;
  electronegativity: string | null;
  radius: string | null;
  ionization: string | null;
  affinity: string | null;
  oxidation: string[];
  state: "solid" | "liquid" | "gas";
  stateExpected: boolean;
  melting: string | null;
  boiling: string | null;
  density: string | null;
  category: ElementCategory;
  year: number | "ancient";
  wikidata: string;
};

export const ELEMENT_CATEGORIES = [
  "alkali-metal",
  "alkaline-earth-metal",
  "transition-metal",
  "post-transition-metal",
  "metalloid",
  "nonmetal",
  "halogen",
  "noble-gas",
  "lanthanide",
  "actinide",
] as const;
export type ElementCategory = (typeof ELEMENT_CATEGORIES)[number];

export { elementsMessages, type ElementsMessages };

const ORIGIN = "https://cv.cm";
const SOURCE = { pubchem: "https://pubchem.ncbi.nlm.nih.gov/periodic-table/", wikidata: "https://www.wikidata.org/" };

export function pubchemElementUrl(z: number): string {
  return `https://pubchem.ncbi.nlm.nih.gov/element/${z}`;
}

export function elementRow(locale: Locale, slug: ElementSlug): ElementRow {
  return elementsMessages(locale).data[atomicNumberOf(slug) - 1];
}

export function elementName(locale: Locale, z: number): string {
  return elementsMessages(locale).names[z - 1];
}

/** Locales that write element and category names in lower case inside a sentence. */
const CASED = new Set<Locale>(["en", "es", "id", "vi"]);

/**
 * `{name}` (as Wikidata gives it, capitalised: titles and sentence starts) and `{nameText}` (inside a sentence: lower
 * case where the language writes element names in lower case, "the atomic mass of carbon").
 */
export function elementNameVars(locale: Locale, z: number): { name: string; nameText: string } {
  const name = elementName(locale, z);
  return { name, nameText: CASED.has(locale) ? name.toLocaleLowerCase(HREFLANG[locale]) : name };
}

const NUMBER_FORMATS = new Map<string, Intl.NumberFormat>();

function numberFormat(locale: Locale, min: number, max: number): Intl.NumberFormat {
  const key = `${locale}|${min}|${max}`;
  let format = NUMBER_FORMATS.get(key);
  if (!format) NUMBER_FORMATS.set(key, format = new Intl.NumberFormat(HREFLANG[locale], { minimumFractionDigits: min, maximumFractionDigits: max }));
  return format;
}

const decimals = (value: string): number => value.split(".")[1]?.length ?? 0;

/** A PubChem number in the locale's notation, with exactly PubChem's digits. */
export function formatNumber(locale: Locale, value: string): string {
  const d = decimals(value);
  return numberFormat(locale, d, d).format(Number(value));
}

/** Kelvin (as PubChem gives it) to degrees Celsius: at least two decimals of the exact −273.15, trailing zeros dropped. */
export function kelvinToCelsius(locale: Locale, kelvin: string): string {
  const d = Math.max(decimals(kelvin), 2);
  const celsius = Number((Number(kelvin) - 273.15).toFixed(d));
  return numberFormat(locale, 0, d).format(Object.is(celsius, -0) ? 0 : celsius);
}

/** Atomic mass as shown: in brackets for an element with no standard atomic weight; "—" when PubChem has none. */
export function formatMass(locale: Locale, z: number, mass: string | null): string {
  if (!mass) return elementsMessages(locale).values.none;
  const shown = formatNumber(locale, mass);
  return hasStandardWeight(z) ? shown : `[${shown}]`;
}

const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (n: number): string => String(n).split("").map((d) => SUPERSCRIPT[Number(d)]).join("");

/** PubChem's shorthand configuration with superscripts: "[He] 2s² 2p²". */
export function configText(config: string): string {
  const core = /^\[(\w+)\]\s*/.exec(config);
  const rest = (core ? config.slice(core[0].length) : config).trim().split(/\s+/).map((part) => part.replace(/^(\d[spdf])(\d+)$/, (_, s: string, e: string) => `${s}${sup(Number(e))}`));
  return [...(core ? [`[${core[1]}]`] : []), ...rest].join(" ");
}

/** The configuration written out in full, in shell order: "1s² 2s² 2p²". */
export function fullConfigText(config: string): string {
  return subshells(config).map(({ n, l, e }) => `${n}${l}${sup(e)}`).join(" ");
}

export function shellsText(config: string): string {
  return shellsOf(config).join(", ");
}

/** Category label (singular), legend label (plural) and the in-sentence form. */
export function categoryLabel(locale: Locale, category: ElementCategory): string {
  return elementsMessages(locale).categories[category];
}

/** The plural category label inside running text (lower case where the language has case). */
export function categoryInText(locale: Locale, category: ElementCategory): string {
  const label = elementsMessages(locale).categoryPlural[category];
  return CASED.has(locale) ? label.toLocaleLowerCase(HREFLANG[locale]) : label;
}

export function statePhrase(locale: Locale, row: ElementRow): string {
  const p = elementsMessages(locale).statePhrase;
  if (!row.stateExpected) return p[row.state];
  return row.state === "solid" ? p.expectedSolid : row.state === "liquid" ? p.expectedLiquid : p.expectedGas;
}

/** Template values per pack and element: a page render fills a dozen templates from the same values. */
const VARS = new WeakMap<ElementsMessages, Map<ElementSlug, Record<string, string | number>>>();

/** Placeholder values shared by the page's templates (cached per locale pack and slug). */
export function elementVars(locale: Locale, slug: ElementSlug): Record<string, string | number> {
  const pack = elementsMessages(locale);
  let bySlug = VARS.get(pack);
  if (!bySlug) VARS.set(pack, bySlug = new Map());
  let vars = bySlug.get(slug);
  if (!vars) bySlug.set(slug, vars = buildVars(locale, slug));
  return vars;
}

function buildVars(locale: Locale, slug: ElementSlug): Record<string, string | number> {
  const row = elementRow(locale, slug);
  const m = elementsMessages(locale);
  const z = row.z;
  const group = groupOf(z);
  return {
    ...elementNameVars(locale, z),
    symbol: row.symbol,
    z,
    mass: formatMass(locale, z, row.mass),
    category: categoryLabel(locale, row.category),
    categoryIn: m.categoryIn[row.category],
    group: group ?? m.values.none,
    period: periodOf(z),
    block: blockOf(z),
    state: statePhrase(locale, row),
    config: configText(row.config),
    full: fullConfigText(row.config),
    shells: shellsText(row.config),
    mp: row.melting ? formatNumber(locale, row.melting) : m.values.none,
    mpC: row.melting ? kelvinToCelsius(locale, row.melting) : m.values.none,
    bp: row.boiling ? formatNumber(locale, row.boiling) : m.values.none,
    bpC: row.boiling ? kelvinToCelsius(locale, row.boiling) : m.values.none,
    density: row.density ? formatNumber(locale, row.density) : m.values.none,
  };
}

export function elementsTitle(locale: Locale, slug: ElementSlug | null): string {
  const m = elementsMessages(locale);
  return `${slug ? fill(m.page.title, elementVars(locale, slug)) : m.hub.title} — cv.cm`;
}

export function elementsDescription(locale: Locale, slug: ElementSlug | null): string {
  const m = elementsMessages(locale);
  if (!slug) return fill(m.hub.description, { n: ELEMENT_SLUGS.length });
  const vars = elementVars(locale, slug);
  const row = elementRow(locale, slug);
  return [
    fill(m.page.description, vars),
    row.melting ? fill(m.page.descriptionMelting, vars) : "",
    row.density ? fill(m.page.descriptionDensity, vars) : "",
  ].join("");
}

/** The answer under the heading: what the element is, where it sits, its mass and state. */
export function elementAnswer(locale: Locale, slug: ElementSlug): string {
  const m = elementsMessages(locale);
  const z = atomicNumberOf(slug);
  return fill(groupOf(z) === null ? m.page.answerFBlock : m.page.answer, elementVars(locale, slug));
}

/** Three questions answered from the data: atomic mass, electron configuration, melting point (or the symbol). */
export function elementsFaqItems(locale: Locale, slug: ElementSlug | null): { q: string; a: string }[] {
  const m = elementsMessages(locale);
  if (!slug) return m.hub.faq.map((item) => ({ q: item.q, a: fill(item.a, { n: ELEMENT_SLUGS.length }) }));
  const row = elementRow(locale, slug);
  const vars = elementVars(locale, slug);
  const mass = hasStandardWeight(row.z) ? m.page.faqMass : m.page.faqMassIsotope;
  const config = row.config.startsWith("[") ? m.page.faqConfig : m.page.faqConfigPlain;
  const heat = row.melting && row.boiling ? m.page.faqMeltBoil : row.melting ? m.page.faqMelt : m.page.faqSymbol;
  return [mass, config, heat].map((item) => ({ q: fill(item.q, vars), a: fill(item.a, vars) }));
}

export function elementsBreadcrumbJsonLd(locale: Locale, slug: ElementSlug | null): Record<string, unknown> {
  const m = elementsMessages(locale);
  const items = [
    { name: m.crumbHome, item: `${ORIGIN}${appHref(locale, null)}` },
    dataCrumbItem(locale),
    { name: m.hub.h1, item: `${ORIGIN}${elementsHref(locale)}` },
  ];
  if (slug) items.push({ name: elementName(locale, atomicNumberOf(slug)), item: `${ORIGIN}${elementsHref(locale, slug)}` });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, ...item })),
  };
}

export function elementsFaqJsonLd(locale: Locale, slug: ElementSlug | null): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: elementsFaqItems(locale, slug).map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

const CITATIONS = [
  { "@type": "CreativeWork", name: "PubChem Periodic Table of Elements", url: SOURCE.pubchem, publisher: { "@type": "Organization", name: "National Center for Biotechnology Information, U.S. National Library of Medicine" } },
  { "@type": "CreativeWork", name: "Wikidata", url: SOURCE.wikidata, license: "https://creativecommons.org/publicdomain/zero/1.0/" },
];

/**
 * The hub: a CollectionPage with every element as an ItemList. An element: a WebPage whose main entity is the
 * element as a ChemicalSubstance (name, symbol, English name, PubChem and Wikidata as sameAs).
 */
export function elementsPageJsonLd(locale: Locale, slug: ElementSlug | null): Record<string, unknown> {
  const m = elementsMessages(locale);
  if (!slug) {
    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: m.hub.h1,
      description: elementsDescription(locale, null),
      url: `${ORIGIN}${elementsHref(locale)}`,
      inLanguage: HREFLANG[locale],
      datePublished: ELEMENTS_PUBLISHED,
      dateModified: [ELEMENTS_PUBLISHED, ELEMENTS_SNAPSHOT].sort().at(-1),
      citation: CITATIONS,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: ELEMENT_SLUGS.length,
        itemListElement: ELEMENT_SLUGS.map((s, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: `${elementName(locale, index + 1)} (${m.data[index].symbol})`,
          url: `${ORIGIN}${elementsHref(locale, s)}`,
        })),
      },
    };
  }
  const row = elementRow(locale, slug);
  const url = `${ORIGIN}${elementsHref(locale, slug)}`;
  const name = elementName(locale, row.z);
  const english = m.english[row.z - 1];
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: fill(m.page.h1, elementVars(locale, slug)),
    description: elementsDescription(locale, slug),
    url,
    inLanguage: HREFLANG[locale],
    datePublished: ELEMENTS_PUBLISHED,
    dateModified: [ELEMENTS_PUBLISHED, ELEMENTS_SNAPSHOT].sort().at(-1),
    isPartOf: { "@type": "CollectionPage", name: m.hub.h1, url: `${ORIGIN}${elementsHref(locale)}` },
    citation: CITATIONS,
    mainEntity: {
      "@type": "ChemicalSubstance",
      name,
      alternateName: [...new Set([row.symbol, english])].filter((n) => n !== name),
      identifier: row.symbol,
      description: elementAnswer(locale, slug),
      url,
      sameAs: [pubchemElementUrl(row.z), `https://www.wikidata.org/wiki/${row.wikidata}`],
    },
  };
}

export const ELEMENTS_SOURCES = SOURCE;
