import { escapeHtml } from "./device-i18n";
import { fill, type DatasetTable } from "./datasets-i18n";
import type { Locale } from "./locale";
import { datasetMessages, messages, type DatasetMessages } from "./messages";
import { appHref, rankingHref } from "./path";
import {
  RANKINGS,
  RANKING_GROUPS,
  RANKING_REGIONS,
  RANKING_SOURCE,
  rankingCsvHref,
  rankingKind,
  rankingMeta,
  type ArenaRow,
  type CommodityRow,
  type CompanyRow,
  type CryptoRow,
  type FxRow,
  type RankingId,
  type ShareRow,
  type UsageRow,
} from "./rankings";

type RankingMessages = DatasetMessages["rankings"];
export type RankingHubCopy = RankingMessages["hub"];
export type RankingUi = RankingMessages["ui"];
export type RankingCopy = { title: string; description: string; h1: string; lede: string; facts: string[]; about: string[]; faq: { q: string; a: string }[] };

const ORIGIN = "https://cv.cm";

export function rankingHub(locale: Locale): RankingHubCopy {
  return datasetMessages(locale).rankings.hub;
}

export function rankingUi(locale: Locale): RankingUi {
  return datasetMessages(locale).rankings.ui;
}

/** Name and blurb from the core pack: nav and footer need them without the data pack. */
export function rankingName(locale: Locale, id: RankingId): { name: string; blurb: string } {
  return messages(locale).ui.ranking[id];
}

function compact(locale: Locale, value: number): string {
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function plain(locale: Locale, value: number, digits = 0): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

/** "2026-10" as "October 2026" (or the locale's own form); a full date likewise. */
export function rankingDate(locale: Locale, asOf: string): string {
  const parts = asOf.split("-").map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] ?? 1));
  return new Intl.DateTimeFormat(locale, parts[2] ? { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" } : { year: "numeric", month: "long", timeZone: "UTC" }).format(date);
}

function regionName(locale: Locale, code: string): string {
  return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
}

function percent(locale: Locale, value: number): string {
  return `${plain(locale, value, 1)}%`;
}

function usd(locale: Locale, value: number, compactForm = false): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD", notation: compactForm ? "compact" : "standard", maximumFractionDigits: compactForm ? 2 : value >= 1 ? 2 : 8 }).format(value);
}

function signed(locale: Locale, value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${sign}${plain(locale, Math.abs(rounded), 1)}%`;
}

function currencyName(locale: Locale, code: string): string {
  return new Intl.DisplayNames([locale], { type: "currency" }).of(code) ?? code;
}

function commodityName(locale: Locale, id: string): string {
  return (rankingUi(locale).commodities as Record<string, string>)[id] ?? id;
}

/** What a row's name reads as in this locale: commodities and currencies are stored as ids. */
function displayName(locale: Locale, id: RankingId, name: string): string {
  const kind = rankingKind(id);
  if (kind === "commodity") return commodityName(locale, name);
  if (kind === "fx") return `${currencyName(locale, name)} (${name})`;
  return name;
}

function vars(locale: Locale, id: RankingId): Record<string, string | number> {
  const meta = rankingMeta(id);
  const out: Record<string, string | number> = { rows: meta.rows, date: rankingDate(locale, meta.asOf), year: meta.asOf.slice(0, 4) };
  const kind = rankingKind(id);
  const shown = (value: number) => (kind === "arena" ? plain(locale, value) : kind === "crypto" ? usd(locale, value, true) : kind === "commodity" || kind === "fx" ? signed(locale, value) : percent(locale, value));
  meta.top.forEach(([name, value], index) => {
    out[`top${index + 1}`] = displayName(locale, id, name);
    out[`v${index + 1}`] = shown(value);
  });
  meta.bottom?.forEach(([name, value], index) => {
    out[`low${index + 1}`] = displayName(locale, id, name);
    out[`lv${index + 1}`] = shown(value);
    // For sentences that already say "down": the size of the drop, without a sign.
    out[`ld${index + 1}`] = percent(locale, Math.abs(value));
  });
  if (meta.total !== undefined) out.total = usd(locale, meta.total, true);
  if (meta.dominance !== undefined) out.dominance = percent(locale, meta.dominance);
  if (meta.yearAgo) out.yearAgo = rankingDate(locale, meta.yearAgo);
  if (meta.leadOrg) {
    out.leadOrg = meta.leadOrg;
    out.leadCount = meta.leadCount ?? 0;
  }
  if (meta.leaders) {
    for (const [region, [name, value]] of Object.entries(meta.leaders)) {
      out[`${region}Top`] = name;
      out[`${region}V`] = percent(locale, value);
    }
  }
  return out;
}

export function rankingPageCopy(locale: Locale, id: RankingId): RankingCopy {
  const copy = datasetMessages(locale).rankings.sets[id] as RankingCopy;
  const values = vars(locale, id);
  return {
    title: fill(copy.title, values),
    description: fill(copy.description, values),
    h1: fill(copy.h1, values),
    lede: fill(copy.lede, values),
    facts: copy.facts.map((text) => fill(text, values)),
    about: copy.about.map((text) => fill(text, values)),
    faq: copy.faq.map((item) => ({ q: fill(item.q, values), a: fill(item.a, values) })),
  };
}

export function rankingTitle(locale: Locale, id: RankingId | null): string {
  return id ? rankingPageCopy(locale, id).title : rankingHub(locale).title;
}

export function rankingDescription(locale: Locale, id: RankingId | null): string {
  return id ? rankingPageCopy(locale, id).description : rankingHub(locale).description;
}

export function rankingFaqItems(locale: Locale, id: RankingId | null): { q: string; a: string }[] {
  return id ? rankingPageCopy(locale, id).faq : rankingHub(locale).faq;
}

/** The first-place line under a link: who leads, without opening the table. */
export function rankingLinkMeta(locale: Locale, id: RankingId): string {
  const values = vars(locale, id);
  return `${values.top1} · ${values.v1}`;
}

const NO_VALUE = "—";
/** Below any real change, and plain enough not to match a text filter. */
const NOT_LISTED = -1000;
const text = (value: string) => ({ text: value || NO_VALUE, sort: value });
const num = (shown: string, value: number) => ({ text: shown, sort: value });

export function rankingTable(locale: Locale, id: RankingId, rows: unknown[]): DatasetTable {
  const ui = rankingUi(locale);
  const kind = rankingKind(id);
  const rank = (value: number) => num(plain(locale, value), value);
  if (kind === "arena") {
    return {
      columns: [{ label: ui.rank, num: true }, { label: ui.model, head: true }, { label: ui.organization }, { label: ui.licence }, { label: ui.score, num: true }, { label: ui.votes, num: true }],
      rows: (rows as ArenaRow[]).map(([place, model, org, licence, score, votes]) => [rank(place), text(model), text(org), text(licence), num(plain(locale, score), score), num(plain(locale, votes), votes)]),
    };
  }
  if (kind === "usage") {
    return {
      columns: [{ label: ui.rank, num: true }, { label: ui.model, head: true }, { label: ui.organization }, { label: ui.tokens, num: true }, { label: ui.shareOfTokens, num: true }],
      rows: (rows as UsageRow[]).map(([place, model, author, tokens, share]) => [rank(place), text(model), text(author), num(compact(locale, tokens), tokens), num(percent(locale, share), share)]),
    };
  }
  if (kind === "crypto") {
    return {
      columns: [{ label: ui.rank, num: true }, { label: ui.name, head: true }, { label: ui.symbol }, { label: ui.price, num: true }, { label: ui.change24h, num: true }, { label: ui.change7d, num: true }, { label: ui.marketCap, num: true }, { label: ui.volume24h, num: true }],
      rows: (rows as CryptoRow[]).map(([place, name, symbol, price, day, week, cap, volume]) => [rank(place), text(name), text(symbol), num(usd(locale, price), price), num(signed(locale, day), day), num(signed(locale, week), week), num(usd(locale, cap, true), cap), num(usd(locale, volume, true), volume)]),
    };
  }
  if (kind === "commodity") {
    return {
      columns: [{ label: ui.rank, num: true }, { label: ui.commodity, head: true }, { label: ui.unit }, { label: ui.price, num: true }, { label: ui.change1m, num: true }, { label: ui.change1y, num: true }],
      rows: (rows as CommodityRow[]).map(([place, id, unit, price, month, year]) => [rank(place), text(commodityName(locale, id)), text(unit), num(plain(locale, price, 2), price), num(signed(locale, month), month), num(signed(locale, year), year)]),
    };
  }
  if (kind === "fx") {
    return {
      columns: [{ label: ui.rank, num: true }, { label: ui.currency, head: true }, { label: ui.code }, { label: ui.perUsd, num: true }, { label: ui.change1m, num: true }, { label: ui.change1y, num: true }],
      rows: (rows as FxRow[]).map(([place, code, perUsd, month, year]) => [rank(place), text(currencyName(locale, code)), text(code), num(new Intl.NumberFormat(locale, { maximumSignificantDigits: 6 }).format(perUsd), perUsd), num(signed(locale, month), month), num(signed(locale, year), year)]),
    };
  }
  if (kind === "companies") {
    return {
      columns: [{ label: ui.rank, num: true }, { label: ui.organization, head: true }, { label: ui.tokens, num: true }, { label: ui.shareOfTokens, num: true }, { label: ui.modelsListed, num: true }],
      rows: (rows as CompanyRow[]).map(([place, company, tokens, share, models]) => [rank(place), text(company), num(compact(locale, tokens), tokens), num(percent(locale, share), share), num(plain(locale, models), models)]),
    };
  }
  return {
    columns: [
      { label: ui.rank, num: true },
      { label: ui.name, head: true },
      { label: ui.world, num: true },
      { label: ui.change, num: true },
      ...RANKING_REGIONS.map((region) => ({ label: regionName(locale, region), num: true })),
    ],
    rows: (rows as ShareRow[]).map(([place, name, before, world, ...regions]) => {
      // Rounded to what is shown, so a tiny change reads 0.0 rather than −0.0. Not listed a year ago: no change to show.
      const change = before === null ? null : Math.round((world - before) * 10) / 10;
      const sign = change === null ? "" : change > 0 ? "+" : change < 0 ? "−" : "";
      return [
        rank(place),
        text(name),
        num(percent(locale, world), world),
        change === null ? num(NO_VALUE, NOT_LISTED) : num(`${sign}${plain(locale, Math.abs(change), 1)}`, change),
        ...regions.map((value) => num(percent(locale, value), value)),
      ];
    }),
  };
}

// --- JSON-LD ----------------------------------------------------------------

export function rankingBreadcrumbJsonLd(locale: Locale, id: RankingId | null): Record<string, unknown> {
  const items = [
    { name: datasetMessages(locale).crumbHome, href: `${ORIGIN}${appHref(locale, null)}` },
    { name: rankingHub(locale).h1, href: `${ORIGIN}${rankingHref(locale)}` },
  ];
  if (id) items.push({ name: rankingName(locale, id).name, href: `${ORIGIN}${rankingHref(locale, id)}` });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: item.href })),
  };
}

export function rankingFaqJsonLd(locale: Locale, id: RankingId | null): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: rankingFaqItems(locale, id).map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
  };
}

export function rankingJsonLd(locale: Locale, id: RankingId | null): Record<string, unknown> {
  const hub = rankingHub(locale);
  if (!id) {
    return {
      "@context": "https://schema.org",
      "@type": "DataCatalog",
      name: hub.h1,
      description: hub.description,
      url: `${ORIGIN}${rankingHref(locale)}`,
      inLanguage: locale,
      publisher: { "@type": "Organization", name: "cv.cm", url: ORIGIN },
      dataset: RANKINGS.map((set) => ({ "@type": "Dataset", name: rankingName(locale, set).name, description: rankingPageCopy(locale, set).description, url: `${ORIGIN}${rankingHref(locale, set)}` })),
    };
  }
  const copy = rankingPageCopy(locale, id);
  const source = RANKING_SOURCE[id];
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": `${ORIGIN}${rankingHref(locale, id)}#dataset`,
    name: copy.h1,
    description: `${copy.description} ${copy.lede}`,
    url: `${ORIGIN}${rankingHref(locale, id)}`,
    inLanguage: locale,
    isAccessibleForFree: true,
    license: source.licenseUrl,
    dateModified: rankingMeta(id).updated,
    temporalCoverage: rankingMeta(id).asOf,
    keywords: [rankingName(locale, id).name],
    creator: { "@type": "Organization", name: source.name, url: source.url },
    isBasedOn: source.url,
    publisher: { "@type": "Organization", name: "cv.cm", url: ORIGIN },
    ...(rankingCsvHref(id) ? { distribution: [{ "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `${ORIGIN}${rankingCsvHref(id)}` }] } : {}),
    size: `${rankingMeta(id).rows} rows`,
    includedInDataCatalog: { "@type": "DataCatalog", name: hub.h1, url: `${ORIGIN}${rankingHref(locale)}` },
  };
}

// --- Crawler fallback ---------------------------------------------------------

function faqHtml(locale: Locale, id: RankingId | null): string {
  const items = rankingFaqItems(locale, id).map((item, index) => (
    `<details${index === 0 ? " open" : ""}><summary>${escapeHtml(item.q)}</summary><p>${escapeHtml(item.a)}</p></details>`
  )).join("");
  return `<section class="faq" aria-labelledby="faq-title"><h2 id="faq-title">${escapeHtml(rankingUi(locale).faq)}</h2>${items}</section>`;
}

/** Text copy of a ranking page for when the prerendered body is missing: everything but the table, which links to the CSV. */
export function rankingStaticHtml(locale: Locale, id: RankingId | null): string {
  const ui = rankingUi(locale);
  const hub = rankingHub(locale);
  const sep = `<span aria-hidden="true">/</span>`;
  const home = `<a href="${escapeHtml(appHref(locale, null))}">${escapeHtml(datasetMessages(locale).crumbHome)}</a>`;
  if (!id) {
    const groups = RANKING_GROUPS.map((group) => {
      const links = group.sets.map((set) => {
        const name = rankingName(locale, set);
        return `<li><a href="${escapeHtml(rankingHref(locale, set))}">${escapeHtml(name.name)}</a> ${escapeHtml(name.blurb)}</li>`;
      }).join("");
      return `<h2>${escapeHtml(hub.groups[group.id])}</h2><ul>${links}</ul>`;
    }).join("");
    return [
      `<nav class="device-crumb">${home} ${sep} <span>${escapeHtml(hub.h1)}</span></nav>`,
      `<h1>${escapeHtml(hub.h1)}</h1>`,
      `<p class="lede">${escapeHtml(hub.lede)}</p>`,
      groups,
      hub.about.map((p) => `<p>${escapeHtml(p)}</p>`).join(""),
      faqHtml(locale, null),
    ].join("");
  }
  const copy = rankingPageCopy(locale, id);
  const source = RANKING_SOURCE[id];
  return [
    `<nav class="device-crumb">${home} ${sep} <a href="${escapeHtml(rankingHref(locale))}">${escapeHtml(hub.h1)}</a> ${sep} <span>${escapeHtml(rankingName(locale, id).name)}</span></nav>`,
    `<h1>${escapeHtml(copy.h1)}</h1>`,
    `<p class="lede">${escapeHtml(copy.lede)}</p>`,
    `<h2>${escapeHtml(ui.facts)}</h2><ul>${copy.facts.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>`,
    `<p>${rankingCsvHref(id) ? `<a href="${escapeHtml(rankingCsvHref(id)!)}">${escapeHtml(ui.download)}</a> · ` : ""}${escapeHtml(ui.source)}: <a href="${escapeHtml(source.url)}" rel="noopener">${escapeHtml(source.name)}</a> · ${escapeHtml(ui.license)}: ${escapeHtml(source.license)}</p>`,
    `<section><h2>${escapeHtml(ui.about)}</h2>${copy.about.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}</section>`,
    faqHtml(locale, id),
    `<p><a href="${escapeHtml(rankingHref(locale))}">${escapeHtml(ui.all)}</a></p>`,
  ].join("");
}
