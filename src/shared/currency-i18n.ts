/**
 * Exchange-rate channel: the currency pack registry, names, number formats, titles, descriptions, FAQ and JSON-LD
 * (main bundle, for the page head). Page HTML is in `currency-page.ts`, kept out of the main bundle (AGENTS.md,
 * seo.ts / seo-html.ts). Every figure comes from the ECB snapshot in the pack (`src/shared/currency-data.json`).
 */
import type { Locale } from "./locale";
import { fill } from "./fill";
import { currencyMessages, type CurrencyMessages } from "./messages";
import { appHref, currencyHref } from "./path";
import { dataCrumbItem } from "./channel-parent";
import { currencyName } from "./currency-names";
import { HREFLANG } from "./sitemap";
import { CURRENCY_PAIRS, CURRENCY_PUBLISHED, CURRENCY_SNAPSHOT, pairCodes, type CurrencyPair } from "./currency";

export { currencyMessages, type CurrencyMessages };

/** High, low, average, first day and first rate of one window (scripts/currency-snapshot.mjs). */
export type CurrencyStats = { from: string; open: number; hi: number; hiOn: string; lo: number; loOn: string; avg: number; n: number };
export const CURRENCY_WINDOWS = ["d30", "y1", "y5", "all"] as const;
export type CurrencyWindow = (typeof CURRENCY_WINDOWS)[number];

/** Per-pair window stats from the snapshot, and the day the pair's series begins. */
export type CurrencyPairStats = { start: string } & Record<CurrencyWindow, CurrencyStats>;

/**
 * src/shared/currency-data.json: rates once per currency, as the ECB publishes them (units per 1 EUR): every ECB
 * currency on `asOf`, the pairs' currencies on each day of the last 90 days and as monthly averages; and the window
 * stats per pair (they need the whole daily history, so scripts/currency-snapshot.mjs works them out).
 */
export type CurrencyData = {
  asOf: string;
  latest: Record<string, number>;
  stats: Record<CurrencyPair, CurrencyPairStats>;
  days: Record<string, Record<string, number>>;
  months: Record<string, Record<string, number>>;
};

/** One pair, derived from the per-currency rates: the latest rate (six digits), its stats, and chart points. */
export type CurrencyPairData = {
  rate: number;
  start: string;
  stats: Record<CurrencyWindow, CurrencyStats>;
  /** Every month from the pair's first to the last, with null where either currency had no rate that month. */
  monthly: [month: string, value: number | null][];
  /** Every ECB day of the last 90 days, null where either currency had no rate. */
  daily: [day: string, value: number | null][];
};

const ORIGIN = "https://cv.cm";
export const ECB_SOURCE = {
  url: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html",
  terms: "https://www.ecb.europa.eu/services/disclaimer/html/index.en.html",
};

export function currencyData(locale: Locale): CurrencyData {
  return currencyMessages(locale).data;
}

const sig6 = (value: number): number => Number(value.toPrecision(6));

/** units of `to` per unit of `from`, from two per-EUR rate tables; null when either is missing. */
function cross(rates: Record<string, number> | undefined, from: string, to: string): number | null {
  const a = from === "EUR" ? 1 : rates?.[from];
  const b = to === "EUR" ? 1 : rates?.[to];
  return a && b ? b / a : null;
}

const PAIRS = new WeakMap<CurrencyData, Map<CurrencyPair, CurrencyPairData>>();

export function pairData(locale: Locale, pair: CurrencyPair): CurrencyPairData {
  const data = currencyData(locale);
  let byPair = PAIRS.get(data);
  if (!byPair) PAIRS.set(data, byPair = new Map());
  let out = byPair.get(pair);
  if (!out) byPair.set(pair, out = buildPair(data, pair));
  return out;
}

function buildPair(data: CurrencyData, pair: CurrencyPair): CurrencyPairData {
  const [from, to] = pairCodes(pair);
  const { start, ...stats } = data.stats[pair];
  const months = Object.keys(data.months).sort();
  const first = start.slice(0, 7);
  return {
    rate: sig6(cross(data.latest, from, to)!),
    start,
    stats,
    // Months are stored by key, so a month with no rate is a gap here, never a shift.
    monthly: monthRange(first, months.at(-1)!).map((month) => {
      const v = cross(data.months[month], from, to);
      return [month, v === null ? null : Number(v.toPrecision(5))];
    }),
    daily: Object.keys(data.days).sort().map((day) => {
      const v = cross(data.days[day], from, to);
      return [day, v === null ? null : sig6(v)];
    }),
  };
}

/** Every "YYYY-MM" from `first` to `last`, both included. */
export function monthRange(first: string, last: string): string[] {
  const at = (m: string): number => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
  const out: string[] = [];
  for (let i = at(first); i <= at(last); i += 1) out.push(`${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`);
  return out;
}

/** Every ECB currency on the snapshot day, EUR first, then by code. */
export function ecbCodes(locale: Locale): string[] {
  return ["EUR", ...Object.keys(currencyData(locale).latest)];
}

/** Units of `code` per 1 EUR on the snapshot day. */
export function perEur(locale: Locale, code: string): number {
  return code === "EUR" ? 1 : currencyData(locale).latest[code];
}

/** 1 FROM in TO, through the euro (unrounded; pair pages show the snapshot's six-digit value). */
export function crossRate(locale: Locale, from: string, to: string): number {
  return perEur(locale, to) / perEur(locale, from);
}

export { currencyName };

const FORMATS = new Map<string, Intl.NumberFormat>();
function numberFormat(locale: Locale, key: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const id = `${locale}|${key}`;
  let format = FORMATS.get(id);
  if (!format) FORMATS.set(id, format = new Intl.NumberFormat(HREFLANG[locale], options));
  return format;
}

/** A rate: up to six significant digits, as the snapshot keeps them. */
export function formatRate(locale: Locale, value: number): string {
  return numberFormat(locale, "rate", { maximumSignificantDigits: 6 }).format(value);
}

/** A converted amount: two decimals from 1 up, else four significant digits (0.001 USD → 0.006666 CNY, never 0). */
export function formatMoney(locale: Locale, value: number): string {
  if (Math.abs(value) >= 1 || value === 0) return numberFormat(locale, "money", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return numberFormat(locale, "small", { maximumSignificantDigits: 4 }).format(value);
}

/** An amount typed or listed, grouped, with every decimal it was typed with (up to ten). */
export function formatAmount(locale: Locale, value: number): string {
  return numberFormat(locale, "amount", { maximumFractionDigits: 10 }).format(value);
}

export function formatPercent(locale: Locale, value: number): string {
  return numberFormat(locale, "pct", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: "exceptZero" }).format(value);
}

const DATES = new Map<Locale, Intl.DateTimeFormat>();
/** An ISO day as the locale writes it (UTC, so the day never moves). */
export function formatDate(locale: Locale, iso: string): string {
  let format = DATES.get(locale);
  if (!format) DATES.set(locale, format = new Intl.DateTimeFormat(HREFLANG[locale], { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }));
  return format.format(new Date(`${iso}T00:00:00Z`));
}

const MONTHS = new Map<Locale, Intl.DateTimeFormat>();
/** "2005-04" as the locale writes a month and year. */
export function formatMonth(locale: Locale, month: string): string {
  let format = MONTHS.get(locale);
  if (!format) MONTHS.set(locale, format = new Intl.DateTimeFormat(HREFLANG[locale], { year: "numeric", month: "long", timeZone: "UTC" }));
  return format.format(new Date(`${month}-01T00:00:00Z`));
}

/** Amounts a conversion table lists: 1 … 10,000, or ×100 when one unit is worth under 0.05 of the other currency. */
export function tableAmounts(rate: number): number[] {
  const scale = rate < 0.0005 ? 10_000 : rate < 0.05 ? 100 : 1;
  return [1, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000].map((n) => n * scale);
}

/** The amount the FAQ asks about: 100 units, scaled like the table. */
export function faqAmount(rate: number): number {
  return tableAmounts(rate)[5];
}

function capitalize(locale: Locale, text: string): string {
  return text ? text[0].toLocaleUpperCase(HREFLANG[locale]) + text.slice(1) : text;
}

/** Template values per pack and pair: a page fills a dozen templates from the same values. */
const VARS = new WeakMap<CurrencyMessages, Map<CurrencyPair, Record<string, string | number>>>();

export function pairVars(locale: Locale, pair: CurrencyPair): Record<string, string | number> {
  const pack = currencyMessages(locale);
  let byPair = VARS.get(pack);
  if (!byPair) VARS.set(pack, byPair = new Map());
  let vars = byPair.get(pair);
  if (!vars) byPair.set(pair, vars = buildVars(locale, pair));
  return vars;
}

function buildVars(locale: Locale, pair: CurrencyPair): Record<string, string | number> {
  const [fromCode, toCode] = pairCodes(pair);
  const d = pairData(locale, pair);
  const data = currencyData(locale);
  const fromName = currencyName(locale, fromCode);
  const toName = currencyName(locale, toCode);
  const amount = faqAmount(d.rate);
  const { y1, all } = d.stats;
  return {
    fromCode,
    toCode,
    fromName,
    toName,
    fromNameCap: capitalize(locale, fromName),
    toNameCap: capitalize(locale, toName),
    rate: formatRate(locale, d.rate),
    inverse: formatRate(locale, 1 / d.rate),
    date: formatDate(locale, data.asOf),
    start: formatDate(locale, d.start),
    startYear: d.start.slice(0, 4),
    amount: formatAmount(locale, amount),
    value: formatMoney(locale, amount * d.rate),
    y1High: formatRate(locale, y1.hi),
    y1HighOn: formatDate(locale, y1.hiOn),
    y1Low: formatRate(locale, y1.lo),
    y1LowOn: formatDate(locale, y1.loOn),
    y1Avg: formatRate(locale, y1.avg),
    allHigh: formatRate(locale, all.hi),
    allHighOn: formatDate(locale, all.hiOn),
    allLow: formatRate(locale, all.lo),
    allLowOn: formatDate(locale, all.loOn),
  };
}

export function currencyTitle(locale: Locale, pair: CurrencyPair | null): string {
  const m = currencyMessages(locale);
  if (!pair) return `${m.hub.title} — cv.cm`;
  const own = (m.titles as Record<string, string>)[pair];
  return `${fill(own ?? m.page.title, pairVars(locale, pair))} — cv.cm`;
}

function hubVars(locale: Locale): Record<string, string | number> {
  return { n: ecbCodes(locale).length, pairs: CURRENCY_PAIRS.length, date: formatDate(locale, currencyData(locale).asOf) };
}

export function currencyDescription(locale: Locale, pair: CurrencyPair | null): string {
  const m = currencyMessages(locale);
  return pair ? fill(m.page.description, pairVars(locale, pair)) : fill(m.hub.description, hubVars(locale));
}

export function currencyLede(locale: Locale): string {
  return fill(currencyMessages(locale).hub.lede, hubVars(locale));
}

/** The answer under a pair's heading: today's rate both ways. */
export function currencyAnswer(locale: Locale, pair: CurrencyPair): string {
  return fill(currencyMessages(locale).page.answer, pairVars(locale, pair));
}

/** Hub: three fixed questions. Pair: today's rate, an amount, and the 1-year and all-time range, all from the snapshot. */
export function currencyFaqItems(locale: Locale, pair: CurrencyPair | null): { q: string; a: string }[] {
  const m = currencyMessages(locale);
  if (!pair) return m.hub.faq.map((item) => ({ q: item.q, a: fill(item.a, hubVars(locale)) }));
  const vars = pairVars(locale, pair);
  return [m.page.faqToday, m.page.faqAmount, m.page.faqRange].map((item) => ({ q: fill(item.q, vars), a: fill(item.a, vars) }));
}

/** The pair's heading ("US Dollar to Chinese Yuan (USD/CNY)"): its name in search and the BreadcrumbList. */
export function currencyPairName(locale: Locale, pair: CurrencyPair): string {
  return fill(currencyMessages(locale).page.h1, pairVars(locale, pair));
}

/** "USD/CNY" as the trail and lists name a pair. */
export function pairLabel(pair: CurrencyPair): string {
  return pairCodes(pair).join("/");
}

export function currencyBreadcrumbJsonLd(locale: Locale, pair: CurrencyPair | null): Record<string, unknown> {
  const m = currencyMessages(locale);
  const items = [
    { name: m.crumbHome, item: `${ORIGIN}${appHref(locale, null)}` },
    dataCrumbItem(locale),
    { name: m.hub.h1, item: `${ORIGIN}${currencyHref(locale)}` },
  ];
  if (pair) items.push({ name: pairLabel(pair), item: `${ORIGIN}${currencyHref(locale, pair)}` });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, ...item })),
  };
}

export function currencyFaqJsonLd(locale: Locale, pair: CurrencyPair | null): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: currencyFaqItems(locale, pair).map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

const CITATION = {
  "@type": "Dataset",
  name: "ECB euro foreign exchange reference rates",
  url: ECB_SOURCE.url,
  publisher: { "@type": "Organization", name: "European Central Bank" },
};

const modified = (): string => [CURRENCY_PUBLISHED, CURRENCY_SNAPSHOT].sort().at(-1)!;

/** Hub: a CollectionPage listing every pair. Pair: a WebPage about an ExchangeRateSpecification. */
export function currencyPageJsonLd(locale: Locale, pair: CurrencyPair | null): Record<string, unknown> {
  const m = currencyMessages(locale);
  if (!pair) {
    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: m.hub.h1,
      description: currencyDescription(locale, null),
      url: `${ORIGIN}${currencyHref(locale)}`,
      inLanguage: HREFLANG[locale],
      datePublished: CURRENCY_PUBLISHED,
      dateModified: modified(),
      citation: CITATION,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: CURRENCY_PAIRS.length,
        itemListElement: CURRENCY_PAIRS.map((p, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: fill(m.page.h1, pairVars(locale, p)),
          url: `${ORIGIN}${currencyHref(locale, p)}`,
        })),
      },
    };
  }
  const [fromCode, toCode] = pairCodes(pair);
  const d = pairData(locale, pair);
  const vars = pairVars(locale, pair);
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: fill(m.page.h1, vars),
    description: currencyDescription(locale, pair),
    url: `${ORIGIN}${currencyHref(locale, pair)}`,
    inLanguage: HREFLANG[locale],
    datePublished: CURRENCY_PUBLISHED,
    dateModified: modified(),
    isPartOf: { "@type": "CollectionPage", name: m.hub.h1, url: `${ORIGIN}${currencyHref(locale)}` },
    citation: CITATION,
    mainEntity: {
      "@type": "ExchangeRateSpecification",
      currency: fromCode,
      currentExchangeRate: { "@type": "UnitPriceSpecification", price: d.rate, priceCurrency: toCode, validFrom: currencyData(locale).asOf },
    },
  };
}
