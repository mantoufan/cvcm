/**
 * Country profiles: names, numbers, the templated sentences, titles, descriptions and JSON-LD. In the main bundle
 * (seo.ts reads titles); the page HTML is in countries-page.ts. Every sentence is filled from the data: no prose
 * beyond the templates in src/locales/countries/<locale>.json.
 */
import type { Locale } from "./locale";
import { fill, fill as fillText } from "./fill";
import { formatIndicator, currencyName, regionName } from "./datasets-i18n";
import type { IndicatorId } from "./datasets";
import { appHref, countriesHref } from "./path";
import { HREFLANG } from "./sitemap";
import { COUNTRY_LIST, countryCode } from "./countries";
import { countriesMessages, countryDetail, type CountriesMessages, type CountryFigure, type CountrySummary } from "./countries-store";

const ORIGIN = "https://cv.cm";

export type CountriesUi = CountriesMessages["ui"];

export function countriesUi(locale: Locale): CountriesUi {
  return countriesMessages(locale).ui;
}

export function countrySummary(locale: Locale, code: string): CountrySummary {
  return countriesMessages(locale).summary.countries[code];
}

/** The place's name in the page language (Intl), or the World Bank's English name where Intl has none. */
export function countryName(locale: Locale, code: string): string {
  return regionName(locale, code, countrySummary(locale, code)?.en ?? code);
}

/** English names that take "the" inside a sentence ("the capital of the Netherlands"). */
const EN_THE = new Set(["US", "GB", "NL", "PH", "BS", "GM", "AE", "CF", "CD", "CG", "DO", "MH", "SB", "KY", "VG", "VI", "TC", "FO", "MP", "MV", "SC", "KM", "JG"]);

/** {the} / {The}: the name as it reads inside / at the start of a sentence (only English adds an article). */
function articleVars(locale: Locale, code: string): { name: string; the: string; The: string } {
  const name = countryName(locale, code);
  if (locale === "en" && EN_THE.has(code)) return { name, the: `the ${name}`, The: `The ${name}` };
  return { name, the: name, The: name.charAt(0).toLocaleUpperCase(HREFLANG[locale]) + name.slice(1) };
}

const formats = new Map<string, Intl.NumberFormat>();
function nf(locale: Locale, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}:${JSON.stringify(options)}`;
  let format = formats.get(key);
  if (!format) formats.set(key, (format = new Intl.NumberFormat(locale, options)));
  return format;
}

/** "123.4 million", "1.234亿"; under a million in full ("9,492"). */
export function peopleLong(locale: Locale, value: number): string {
  return value < 1e6 ? nf(locale, { maximumFractionDigits: 0 }).format(value) : nf(locale, { notation: "compact", compactDisplay: "long", maximumSignificantDigits: 4 }).format(value);
}

/** "$4.44 trillion", "4.44万亿美元". */
export function usdLong(locale: Locale, value: number): string {
  return fill(countriesUi(locale).usdLong, { v: nf(locale, { notation: "compact", compactDisplay: "long", maximumSignificantDigits: 3 }).format(value) });
}

export function formatCount(locale: Locale, n: number): string {
  return nf(locale, { maximumFractionDigits: 0 }).format(n);
}

const EN_ORDINAL: Record<string, string> = { one: "st", two: "nd", few: "rd", other: "th" };
let enPlural: Intl.PluralRules | null = null;

/** "12th", "第12", "12位" … */
export function ordinal(locale: Locale, n: number): string {
  if (locale === "en") {
    enPlural ??= new Intl.PluralRules("en", { type: "ordinal" });
    return `${n}${EN_ORDINAL[enPlural.select(n)]}`;
  }
  return fill(countriesUi(locale).ord, { n: formatCount(locale, n) });
}

/** "12th of 217". */
export function rankOf(locale: Locale, id: string, figure: CountryFigure): string {
  return fill(countriesUi(locale).rankOf, { rank: ordinal(locale, figure[2]), n: formatCount(locale, countriesMessages(locale).summary.rows[id]) });
}

export function figureText(locale: Locale, id: string, figure: CountryFigure): string {
  return formatIndicator(locale, id as IndicatorId, figure[0]);
}

export function capitalNames(locale: Locale, code: string): string[] {
  return countrySummary(locale, code).cap.map((labels) => labels[locale] ?? labels.en ?? "").filter(Boolean);
}

export function listText(locale: Locale, items: string[]): string {
  try {
    return new Intl.ListFormat(locale, { type: "conjunction" }).format(items);
  } catch {
    return items.join(countriesUi(locale).sep);
  }
}

/** "Japanese Yen (JPY)" for each currency the country uses. */
export function currencies(locale: Locale, code: string): { code: string; name: string }[] {
  return (countryDetail(code).cur ?? []).map((c) => ({ code: c, name: currencyName(locale, c, c) }));
}

/** First dialing code only ("+1-809, +1-829" → "+1-809"); the facts table lists them all. */
function firstDial(code: string): string | null {
  const dial = countryDetail(code).dial;
  return dial ? dial.split(",")[0].trim() : null;
}

/** The answer sentences, each filled from the data; one per fact the data has. */
export function countrySentences(locale: Locale, code: string): { capital: string | null; population: string | null; gdp: string | null; perCapita: string | null; currency: string | null; dial: string | null } {
  const copy = countriesMessages(locale);
  const s = copy.sentences;
  const vars = articleVars(locale, code);
  const detail = countryDetail(code);
  const caps = capitalNames(locale, code);
  const pop = detail.v.population;
  const gdp = detail.v.gdp;
  const pc = detail.v["gdp-per-capita"];
  const cur = currencies(locale, code);
  const dial = firstDial(code);
  // "Washington, D.C." ends a sentence with its own full stop.
  const fill = (text: string, vars: Record<string, string | number>): string => fillText(text, vars).replace(/(?<!\.)\.\.(?!\.)/g, ".");
  return {
    capital: caps.length === 1 ? fill(s.capital, { ...vars, capital: caps[0] }) : caps.length > 1 ? fill(s.capitals, { ...vars, n: caps.length, capitals: listText(locale, caps) }) : null,
    population: pop ? fill(s.population, { ...vars, pop: peopleLong(locale, pop[0]), year: pop[1], rank: ordinal(locale, pop[2]), n: formatCount(locale, copy.summary.rows.population) }) : null,
    gdp: gdp ? fill(s.gdp, { ...vars, gdp: usdLong(locale, gdp[0]), year: gdp[1], rank: ordinal(locale, gdp[2]), n: formatCount(locale, copy.summary.rows.gdp) }) : null,
    perCapita: pc ? fill(s.perCapita, { ...vars, pc: figureText(locale, "gdp-per-capita", pc), year: pc[1] }) : null,
    currency: cur.length === 1 ? fill(s.currency, { ...vars, currency: cur[0].name, code: cur[0].code }) : cur.length > 1 ? fill(s.currencies, { ...vars, list: listText(locale, cur.map((c) => `${c.name} (${c.code})`)) }) : null,
    dial: dial ? fill(s.dial, { ...vars, dial }) : null,
  };
}

/** Whether the profile has both a capital and a flag to name in its title. */
function full(locale: Locale, code: string): boolean {
  const summary = countrySummary(locale, code);
  return summary.flag && summary.cap.length > 0;
}

/** The year the title names: the population figure's (most figures are from it), else the newest figure's. */
function titleYear(code: string): number {
  const detail = countryDetail(code);
  return detail.v.population?.[1] ?? Math.max(...Object.values(detail.v).map((f) => f[1]));
}

export function countryTitle(locale: Locale, slug: string | null): string {
  const copy = countriesMessages(locale);
  if (!slug) return `${copy.hub.title} — cv.cm`;
  const code = countryCode(slug);
  return `${fill(full(locale, code) ? copy.title : copy.titleShort, { name: countryName(locale, code), year: titleYear(code) })} — cv.cm`;
}

export function countryH1(locale: Locale, code: string): string {
  const copy = countriesMessages(locale);
  return fill(full(locale, code) ? copy.h1 : copy.h1Short, { name: countryName(locale, code) });
}

export function countryDescription(locale: Locale, slug: string | null): string {
  const copy = countriesMessages(locale);
  if (!slug) return fill(copy.hub.description, { n: COUNTRY_LIST.length });
  const code = countryCode(slug);
  const d = copy.descFacts;
  const detail = countryDetail(code);
  const caps = capitalNames(locale, code);
  const pop = detail.v.population;
  const gdp = detail.v.gdp;
  const pc = detail.v["gdp-per-capita"];
  const cur = currencies(locale, code);
  const dial = firstDial(code);
  const facts = [
    caps.length ? fill(d.capital, { v: listText(locale, caps) }) : null,
    pop ? fill(d.population, { v: peopleLong(locale, pop[0]), year: pop[1] }) : null,
    gdp ? fill(d.gdp, { v: usdLong(locale, gdp[0]) }) : null,
    pc ? fill(d.perCapita, { v: figureText(locale, "gdp-per-capita", pc) }) : null,
    cur.length ? fill(d.currency, { v: listText(locale, cur.map((c) => c.name)) }) : null,
    dial ? fill(d.dial, { v: dial }) : null,
  ].filter((f): f is string => Boolean(f));
  return fill(copy.description, { name: countryName(locale, code), facts: facts.join(copy.ui.sep) });
}

/** Three questions answered from the data: capital, population and GDP, or currency and calling code where one is missing. */
export function countryFaqItems(locale: Locale, slug: string | null): { q: string; a: string }[] {
  const copy = countriesMessages(locale);
  if (!slug) return copy.hub.faq.map((item) => ({ q: item.q, a: fill(item.a, { n: COUNTRY_LIST.length }) }));
  const code = countryCode(slug);
  const vars = articleVars(locale, code);
  const s = countrySentences(locale, code);
  const answers: [keyof typeof copy.faq, string | null][] = [
    ["capital", s.capital],
    ["population", s.population],
    ["gdp", s.gdp && s.perCapita ? `${s.gdp}${copy.ui.join}${s.perCapita}` : s.gdp],
    ["currency", s.currency],
    ["dial", s.dial],
  ];
  return answers
    .filter((entry): entry is [keyof typeof copy.faq, string] => Boolean(entry[1]))
    .slice(0, 3)
    .map(([key, a]) => ({ q: fill(copy.faq[key].q, vars), a }));
}

export function countryBreadcrumbJsonLd(locale: Locale, slug: string | null): Record<string, unknown> {
  const copy = countriesMessages(locale);
  const items = [
    { name: copy.crumbHome, item: `${ORIGIN}${appHref(locale, null)}` },
    { name: copy.hub.h1, item: `${ORIGIN}${countriesHref(locale)}` },
  ];
  if (slug) items.push({ name: countryName(locale, countryCode(slug)), item: `${ORIGIN}${countriesHref(locale, slug)}` });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, ...item })),
  };
}

export function countryFaqJsonLd(locale: Locale, slug: string | null): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: countryFaqItems(locale, slug).map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
  };
}

/** The hub: a CollectionPage with an ItemList of every profile. Profiles have breadcrumb and FAQ data only. */
export function countriesCollectionJsonLd(locale: Locale, slug: string | null): Record<string, unknown> | null {
  if (slug) return null;
  const copy = countriesMessages(locale);
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: copy.hub.h1,
    description: countryDescription(locale, null),
    url: `${ORIGIN}${countriesHref(locale)}`,
    inLanguage: HREFLANG[locale],
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: COUNTRY_LIST.length,
      itemListElement: COUNTRY_LIST.map((entry, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: countryName(locale, countryCode(entry)),
        url: `${ORIGIN}${countriesHref(locale, entry)}`,
      })),
    },
  };
}
