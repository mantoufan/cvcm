import { escapeHtml } from "./device-i18n";
import {
  DATASET_GROUPS,
  DATASET_SNAPSHOT,
  DATASET_SOURCE,
  DATASETS,
  INDICATOR_SPEC,
  csvHref,
  datasetMeta,
  indicatorMeta,
  isIndicator,
  type AsciiRow,
  type CountryRow,
  type CurrencyRow,
  type DatasetId,
  type DatasetRows,
  type IndicatorId,
  type IndicatorRow,
  type PaperRow,
  type ZoneRow,
} from "./datasets";
import type { Locale } from "./locale";
import { datasetMessages, messages, type DatasetMessages } from "./messages";
import { appHref, datasetHref } from "./path";

export type DatasetHubCopy = DatasetMessages["hub"];
export type DatasetUi = DatasetMessages["ui"];
export type DatasetCopy = {
  name: string;
  title: string;
  description: string;
  h1: string;
  lede: string;
  value?: string;
  cols?: Record<string, string>;
  facts: string[];
  about: string[];
  faq: { q: string; a: string }[];
};

const ORIGIN = "https://cv.cm";

export function datasetHub(locale: Locale): DatasetHubCopy {
  return datasetMessages(locale).hub;
}

export function datasetUi(locale: Locale): DatasetUi {
  return datasetMessages(locale).ui;
}

export function datasetCopy(locale: Locale, id: DatasetId): DatasetCopy {
  return datasetMessages(locale).sets[id] as DatasetCopy;
}

/** Name and blurb from the core pack: home, nav and footer need them without the dataset pack. */
export function datasetName(locale: Locale, id: DatasetId): { name: string; blurb: string } {
  return messages(locale).ui.dataset[id];
}

export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (all, key: string) => (key in vars ? String(vars[key]) : all));
}

// --- Formatting -------------------------------------------------------------

const cache = new Map<string, unknown>();
function memo<T>(key: string, make: () => T): T {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key) as T;
}

function numberFormat(locale: Locale, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  return memo(`nf:${locale}:${JSON.stringify(options)}`, () => new Intl.NumberFormat(locale, options));
}

/** The region's name in the page language, or the source's English name when the runtime has none (Channel Islands). */
export function regionName(locale: Locale, code: string, fallback: string): string {
  try {
    const names = memo(`dn:region:${locale}`, () => new Intl.DisplayNames([locale], { type: "region", fallback: "none" }));
    return names.of(code) || fallback;
  } catch {
    return fallback;
  }
}

export function currencyName(locale: Locale, code: string, fallback: string): string {
  try {
    const names = memo(`dn:currency:${locale}`, () => new Intl.DisplayNames([locale], { type: "currency", fallback: "none" }));
    return names.of(code) || fallback;
  } catch {
    return fallback;
  }
}

export function currencySymbol(locale: Locale, code: string): string {
  try {
    const parts = numberFormat(locale, { style: "currency", currency: code, currencyDisplay: "narrowSymbol" }).formatToParts(0);
    const symbol = parts.find((part) => part.type === "currency")?.value ?? "";
    return symbol === code ? "" : symbol;
  } catch {
    return "";
  }
}

export function zoneName(locale: Locale, zone: string): string {
  try {
    const format = memo(`tz:${locale}:${zone}`, () => new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: "longGeneric" }));
    return format.formatToParts(new Date(Date.UTC(2026, 0, 15, 12))).find((part) => part.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

export function utcOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

export function formatIndicator(locale: Locale, id: IndicatorId, value: number): string {
  const { decimals, format } = INDICATOR_SPEC[id];
  if (format === "usd-compact") return numberFormat(locale, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(value);
  if (format === "usd") return numberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: decimals }).format(value);
  return numberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}

function formatShare(locale: Locale, share: number): string {
  return numberFormat(locale, { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(share);
}

function formatCount(locale: Locale, n: number): string {
  return numberFormat(locale, { maximumFractionDigits: 0 }).format(n);
}

/** Placeholders the copy may use: {rows} {from} {to} {year} {tz} {world} {worldYear} {top1} {v1} {year1} … {last} {vlast}. */
export function datasetVars(locale: Locale, id: DatasetId): Record<string, string | number> {
  const meta = datasetMeta(id);
  const vars: Record<string, string | number> = { rows: formatCount(locale, meta.rows), date: DATASET_SNAPSHOT };
  if (meta.year) vars.year = meta.year;
  if (meta.tzdata) vars.tz = meta.tzdata;
  if (meta.west !== undefined && meta.east !== undefined) {
    vars.west = utcOffset(meta.west);
    vars.east = utcOffset(meta.east);
  }
  if (!isIndicator(id)) return vars;
  const m = indicatorMeta(id);
  vars.from = m.from;
  vars.to = m.asOf;
  if (m.world) {
    vars.world = formatIndicator(locale, id, m.world[0]);
    vars.worldYear = m.world[1];
  }
  m.top.forEach(([code, value, en, year], index) => {
    vars[`top${index + 1}`] = regionName(locale, code, en);
    vars[`v${index + 1}`] = formatIndicator(locale, id, value);
    vars[`year${index + 1}`] = year;
  });
  const list = memo(`lfc:${locale}`, () => new Intl.ListFormat(locale, { type: "conjunction" }));
  const names = m.bottom.map(([code, , en]) => regionName(locale, code, en));
  if (m.tiedLast > names.length) names.push(fill(datasetUi(locale).others, { n: m.tiedLast - names.length }));
  vars.last = list.format(names);
  vars.vlast = formatIndicator(locale, id, m.bottom[0][1]);
  return vars;
}

function filled(locale: Locale, id: DatasetId): DatasetCopy {
  const copy = datasetCopy(locale, id);
  const vars = datasetVars(locale, id);
  return {
    ...copy,
    title: fill(copy.title, vars),
    description: fill(copy.description, vars),
    h1: fill(copy.h1, vars),
    lede: fill(copy.lede, vars),
    facts: copy.facts.map((f) => fill(f, vars)),
    about: copy.about.map((p) => fill(p, vars)),
    faq: copy.faq.map((item) => ({ q: fill(item.q, vars), a: fill(item.a, vars) })),
  };
}

/** Copy with every placeholder filled from the snapshot. */
export function datasetPageCopy(locale: Locale, id: DatasetId): DatasetCopy {
  return memo(`copy:${locale}:${id}`, () => filled(locale, id));
}

export function datasetTitle(locale: Locale, id: DatasetId | null): string {
  return id ? datasetPageCopy(locale, id).title : datasetHub(locale).title;
}

export function datasetDescription(locale: Locale, id: DatasetId | null): string {
  return id ? datasetPageCopy(locale, id).description : datasetHub(locale).description;
}

export function datasetFaqItems(locale: Locale, id: DatasetId | null): { q: string; a: string }[] {
  return id ? datasetPageCopy(locale, id).faq : datasetHub(locale).faq;
}

/** Row count, then the snapshot date: the small line under each link. */
export function datasetLinkMeta(locale: Locale, id: DatasetId): string {
  return fill(datasetUi(locale).rows, { n: formatCount(locale, datasetMeta(id).rows) });
}

// --- Table ------------------------------------------------------------------

/** `head` marks the column that names the row (rendered as a row header); `wide` holds long lists. */
export type DatasetColumn = { label: string; num?: boolean; mono?: boolean; head?: boolean; wide?: boolean };
/** `text` is what the cell shows; `sort` is what the column sorts by. */
export type DatasetCell = { text: string; sort: string | number };
export type DatasetTable = { columns: DatasetColumn[]; rows: DatasetCell[][] };

/** "+1-809, +1-829" sorts as 1.0809: by country code, then by the area code after it. */
function dialSort(dial: string): number {
  const [code, area = "0"] = dial.split(",")[0].replace("+", "").split("-");
  return Number(code) + Number(area) / 10000;
}

const cell = (text: string | number, sort: string | number = typeof text === "number" ? text : String(text)): DatasetCell => ({ text: String(text), sort });

/** `countries` names the users of each currency (the currency table only). */
export function datasetTable(locale: Locale, id: DatasetId, data: DatasetRows, countries: readonly CountryRow[] = []): DatasetTable {
  const ui = datasetUi(locale);
  const copy = datasetCopy(locale, id);
  const cols = copy.cols ?? {};
  const collator = memo(`coll:${locale}`, () => new Intl.Collator(locale));
  const byName = <T>(rows: T[], name: (row: T) => string): { row: T; name: string }[] =>
    rows.map((row) => ({ row, name: name(row) })).sort((a, b) => collator.compare(a.name, b.name));

  if (isIndicator(id)) {
    const rows = data as IndicatorRow[];
    const { world, worlds = {} } = indicatorMeta(id);
    // Totals have a share of the world; rates and averages do not.
    const share = INDICATOR_SPEC[id].total && world;
    // The world total of the row's year, else the nearest earlier one (land area: world 2023, rows 2024).
    const worldIn = (year: number): number | undefined => {
      for (let y = year; y >= year - 5; y--) if (worlds[y] !== undefined) return worlds[y];
      return undefined;
    };
    // Rows come sorted by value; equal values share a rank (four countries at 100% internet use are all #1).
    const ranks: number[] = [];
    rows.forEach((row, index) => ranks.push(index > 0 && row[2] === rows[index - 1][2] ? ranks[index - 1] : index + 1));
    return {
      columns: [
        { label: ui.rank, num: true },
        { label: ui.country, head: true },
        { label: copy.value ?? "", num: true },
        ...(share ? [{ label: ui.share, num: true }] : []),
        { label: ui.year, num: true },
      ],
      rows: rows.map(([code, , value, year, en], index) => [
        cell(ranks[index]),
        cell(regionName(locale, code, en)),
        cell(formatIndicator(locale, id, value), value),
        // A share divides by the world total of the same year (exports: the US reports a year after China).
        ...(share ? [worldIn(year) ? cell(formatShare(locale, value / worldIn(year)!), value) : cell("–", value)] : []),
        cell(year),
      ]),
    };
  }
  if (id === "country-codes") {
    const continents = ui.continents as Record<string, string>;
    return {
      columns: [{ label: cols.name, head: true }, { label: cols.alpha2, mono: true }, { label: cols.alpha3, mono: true }, { label: cols.numeric, mono: true }, { label: cols.tld, mono: true }, { label: cols.continent }],
      rows: byName(data as CountryRow[], (r) => regionName(locale, r[0], r[7])).map(({ row, name }) => [
        cell(name), cell(row[0]), cell(row[1]), cell(row[2]), cell(row[3]), cell(continents[row[4]] ?? row[4]),
      ]),
    };
  }
  if (id === "calling-codes") {
    return {
      columns: [{ label: cols.name, head: true }, { label: cols.dial, mono: true }, { label: cols.alpha2, mono: true }],
      rows: byName((data as CountryRow[]).filter((r) => r[5]), (r) => regionName(locale, r[0], r[7])).map(({ row, name }) => [
        cell(name), cell(row[5], dialSort(row[5])), cell(row[0]),
      ]),
    };
  }
  if (id === "currency-codes") {
    const list = memo(`lf:${locale}`, () => new Intl.ListFormat(locale, { style: "narrow", type: "unit" }));
    const english = new Map(countries.map((r) => [r[0], r[7]]));
    return {
      columns: [{ label: cols.code, mono: true, head: true }, { label: cols.name }, { label: cols.symbol }, { label: cols.numeric, mono: true }, { label: cols.minor, num: true }, { label: cols.used, wide: true }],
      rows: (data as CurrencyRow[]).map(([code, numeric, minor, users, en]) => [
        cell(code),
        cell(currencyName(locale, code, en)),
        cell(currencySymbol(locale, code)),
        cell(numeric),
        cell(minor === null ? "–" : minor, minor ?? -1),
        cell(list.format(users.map((c) => regionName(locale, c, english.get(c) ?? c)))),
      ]),
    };
  }
  if (id === "time-zones") {
    return {
      columns: [{ label: cols.id, mono: true, head: true }, { label: ui.country }, { label: cols.name }, { label: cols.jan, num: true }, { label: cols.jul, num: true }],
      rows: (data as ZoneRow[]).map(([zone, jan, jul, country]) => [
        cell(zone), cell(regionName(locale, country, country)), cell(zoneName(locale, zone)), cell(utcOffset(jan), jan), cell(utcOffset(jul), jul),
      ]),
    };
  }
  if (id === "paper-sizes") {
    const series = ui.series as Record<string, string>;
    const mm = numberFormat(locale, { maximumFractionDigits: 2 });
    const inch = numberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const px = (v: number, dpi: number): number => Math.round((v / 25.4) * dpi);
    return {
      columns: [{ label: cols.size, head: true }, { label: cols.series }, { label: cols.mm, num: true }, { label: cols.in, num: true }, { label: cols.px300, num: true }, { label: cols.px96, num: true }],
      rows: (data as PaperRow[]).map(([name, s, w, h]) => [
        cell(name, name.replace(/\d+$/, (n) => n.padStart(2, "0"))),
        cell(series[s] ?? s),
        cell(`${mm.format(w)} × ${mm.format(h)}`, w * h),
        cell(`${inch.format(w / 25.4)} × ${inch.format(h / 25.4)}`, w * h),
        cell(`${px(w, 300)} × ${px(h, 300)}`, w * h),
        cell(`${px(w, 96)} × ${px(h, 96)}`, w * h),
      ]),
    };
  }
  return {
    columns: [{ label: cols.dec, num: true, head: true }, { label: cols.hex, mono: true }, { label: cols.oct, mono: true }, { label: cols.bin, mono: true }, { label: cols.char, mono: true }, { label: cols.name }],
    rows: (data as AsciiRow[]).map(([code, char, name]) => [
      cell(code),
      cell(code.toString(16).toUpperCase().padStart(2, "0"), code),
      cell(code.toString(8).padStart(3, "0"), code),
      cell(code.toString(2).padStart(7, "0"), code),
      cell(char, code),
      cell(name),
    ]),
  };
}

// --- JSON-LD ----------------------------------------------------------------

export function datasetBreadcrumbJsonLd(locale: Locale, id: DatasetId | null): Record<string, unknown> {
  const items = [
    { name: datasetMessages(locale).crumbHome, href: `${ORIGIN}${appHref(locale, null)}` },
    { name: datasetHub(locale).h1, href: `${ORIGIN}${datasetHref(locale)}` },
  ];
  if (id) items.push({ name: datasetName(locale, id).name, href: `${ORIGIN}${datasetHref(locale, id)}` });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: item.href })),
  };
}

export function datasetFaqJsonLd(locale: Locale, id: DatasetId | null): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: datasetFaqItems(locale, id).map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

function datasetNode(locale: Locale, id: DatasetId): Record<string, unknown> {
  const copy = datasetPageCopy(locale, id);
  const source = DATASET_SOURCE[id];
  const meta = datasetMeta(id);
  const node: Record<string, unknown> = {
    "@type": "Dataset",
    "@id": `${ORIGIN}${datasetHref(locale, id)}#dataset`,
    name: copy.h1,
    description: `${copy.description} ${copy.lede}`,
    url: `${ORIGIN}${datasetHref(locale, id)}`,
    inLanguage: locale,
    isAccessibleForFree: true,
    license: source.licenseUrl,
    dateModified: DATASET_SNAPSHOT,
    keywords: [datasetName(locale, id).name, ...(copy.cols ? Object.values(copy.cols) : [copy.value ?? ""])].filter(Boolean),
    creator: { "@type": "Organization", name: source.name, url: source.url },
    isBasedOn: source.url,
    publisher: { "@type": "Organization", name: "cv.cm", url: ORIGIN },
    distribution: [{ "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `${ORIGIN}${csvHref(id)}` }],
    variableMeasured: copy.value ?? Object.values(copy.cols ?? {}).join(", "),
    size: `${meta.rows} rows`,
  };
  if (isIndicator(id)) {
    const m = indicatorMeta(id);
    node.temporalCoverage = m.from === m.to ? String(m.to) : `${m.from}/${m.to}`;
    node.spatialCoverage = { "@type": "Place", name: "World" };
  }
  return node;
}

/** Dataset on a table page (Google Dataset Search); DataCatalog listing every table on the hub. */
export function datasetJsonLd(locale: Locale, id: DatasetId | null): Record<string, unknown> {
  if (id) return { "@context": "https://schema.org", ...datasetNode(locale, id), includedInDataCatalog: { "@type": "DataCatalog", name: datasetHub(locale).h1, url: `${ORIGIN}${datasetHref(locale)}` } };
  return {
    "@context": "https://schema.org",
    "@type": "DataCatalog",
    name: datasetHub(locale).h1,
    description: datasetHub(locale).description,
    url: `${ORIGIN}${datasetHref(locale)}`,
    inLanguage: locale,
    publisher: { "@type": "Organization", name: "cv.cm", url: ORIGIN },
    dataset: DATASETS.map((set) => ({ "@type": "Dataset", name: datasetName(locale, set).name, description: datasetPageCopy(locale, set).description, url: `${ORIGIN}${datasetHref(locale, set)}` })),
  };
}

// --- Crawler fallback ---------------------------------------------------------

function faqHtml(locale: Locale, id: DatasetId | null): string {
  const items = datasetFaqItems(locale, id).map((item, index) => (
    `<details${index === 0 ? " open" : ""}><summary>${escapeHtml(item.q)}</summary><p>${escapeHtml(item.a)}</p></details>`
  )).join("");
  return `<section class="faq" aria-labelledby="faq-title"><h2 id="faq-title">${escapeHtml(datasetUi(locale).faq)}</h2>${items}</section>`;
}

/** Text copy of a data page for when the prerendered body is missing: everything but the table, which links to the CSV. */
export function datasetStaticHtml(locale: Locale, id: DatasetId | null): string {
  const ui = datasetUi(locale);
  const hub = datasetHub(locale);
  const home = `<a href="${escapeHtml(appHref(locale, null))}">${escapeHtml(datasetMessages(locale).crumbHome)}</a>`;
  if (!id) {
    const groups = DATASET_GROUPS.map((group) => {
      const links = group.sets.map((set) => {
        const name = datasetName(locale, set);
        return `<li><a href="${escapeHtml(datasetHref(locale, set))}">${escapeHtml(name.name)}</a> ${escapeHtml(name.blurb)}</li>`;
      }).join("");
      return `<h2>${escapeHtml(hub.groups[group.id])}</h2><ul>${links}</ul>`;
    }).join("");
    return [
      `<nav class="device-crumb">${home} <span aria-hidden="true">/</span> <span>${escapeHtml(hub.h1)}</span></nav>`,
      `<h1>${escapeHtml(hub.h1)}</h1>`,
      `<p class="lede">${escapeHtml(hub.lede)}</p>`,
      groups,
      hub.about.map((p) => `<p>${escapeHtml(p)}</p>`).join(""),
      faqHtml(locale, null),
    ].join("");
  }
  const copy = datasetPageCopy(locale, id);
  const source = DATASET_SOURCE[id];
  return [
    `<nav class="device-crumb">${home} <span aria-hidden="true">/</span> <a href="${escapeHtml(datasetHref(locale))}">${escapeHtml(hub.h1)}</a> <span aria-hidden="true">/</span> <span>${escapeHtml(datasetName(locale, id).name)}</span></nav>`,
    `<h1>${escapeHtml(copy.h1)}</h1>`,
    `<p class="lede">${escapeHtml(copy.lede)}</p>`,
    `<h2>${escapeHtml(ui.facts)}</h2><ul>${copy.facts.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>`,
    `<p><a href="${escapeHtml(csvHref(id))}">${escapeHtml(ui.download)}</a> · ${escapeHtml(ui.source)}: <a href="${escapeHtml(source.url)}" rel="noopener">${escapeHtml(source.name)}</a> · ${escapeHtml(ui.license)}: ${escapeHtml(source.license)}</p>`,
    `<section><h2>${escapeHtml(ui.about)}</h2>${copy.about.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}</section>`,
    faqHtml(locale, id),
    `<p><a href="${escapeHtml(datasetHref(locale))}">${escapeHtml(ui.all)}</a></p>`,
  ].join("");
}
