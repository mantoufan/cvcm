/**
 * The country profile HTML (hub and one country), shared by the client page and the Worker's crawler copy. Kept out of
 * countries-i18n so the main bundle, which needs only titles, descriptions and JSON-LD, does not carry it.
 */
import type { Locale } from "./locale";
import { escapeHtml } from "./device-i18n";
import { fill } from "./fill";
import { dateLabel, linkListHtml } from "./article-html";
import { messages } from "./messages";
import { DATASET_GROUPS } from "./datasets";
import { currencySymbol, utcOffset, zoneName } from "./datasets-i18n";
import { appHref, countriesHref, datasetHref, rankingHref } from "./path";
import { RANKINGS } from "./rankings";
import { COUNTRY_LIST, countryCode, countrySlug } from "./countries";
import { countriesMessages, countryDetail, type CountryDetail } from "./countries-store";
import {
  capitalNames,
  countriesUi,
  countryFaqItems,
  countryH1,
  countryName,
  countrySentences,
  countrySummary,
  currencies,
  figureText,
  formatCount,
  rankOf,
} from "./countries-i18n";

/** Continents in the order the hub lists them. */
const CONTINENTS = ["AS", "EU", "AF", "NA", "SA", "OC"] as const;

export function flagPath(code: string): string {
  return `/assets/flags/${code.toLowerCase()}.svg`;
}

/** A 4:3 flag with its size set (no layout shift); lazy unless it is the page's own flag at the top. */
function flagImg(locale: Locale, code: string, width: number, eager = false): string {
  if (!countrySummary(locale, code).flag) return "";
  const alt = fill(countriesUi(locale).flagAlt, { name: countryName(locale, code) });
  return `<img class="country-flag" src="${flagPath(code)}" width="${width}" height="${Math.round((width * 3) / 4)}" alt="${escapeHtml(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

function crumbHtml(locale: Locale, slug: string | null): string {
  const copy = countriesMessages(locale);
  const sep = ` <span aria-hidden="true">/</span> `;
  const parts = [
    `<a href="${escapeHtml(appHref(locale, null))}" data-nav="home">${escapeHtml(copy.crumbHome)}</a>`,
    slug
      ? `<a href="${escapeHtml(countriesHref(locale))}" data-nav="countries">${escapeHtml(copy.hub.h1)}</a>`
      : `<span>${escapeHtml(copy.hub.h1)}</span>`,
  ];
  if (slug) parts.push(`<span>${escapeHtml(countryName(locale, countryCode(slug)))}</span>`);
  return `<nav class="device-crumb" aria-label="${escapeHtml(messages(locale).ui.nav.breadcrumb)}">${parts.join(sep)}</nav>`;
}

function faqHtml(locale: Locale, slug: string | null): string {
  const items = countryFaqItems(locale, slug).map((item, index) => (
    `<details${index === 0 ? " open" : ""}><summary>${escapeHtml(item.q)}</summary><p>${escapeHtml(item.a)}</p></details>`
  )).join("");
  return `<section class="faq" aria-labelledby="faq-title"><h2 id="faq-title">${escapeHtml(countriesUi(locale).faq)}</h2>${items}</section>`;
}

function countryLink(locale: Locale, code: string): string {
  const slug = countrySlug(code)!;
  return `<a href="${escapeHtml(countriesHref(locale, slug))}" data-nav="countries-${slug}">${escapeHtml(countryName(locale, code))}</a>`;
}

function datasetLink(locale: Locale, id: string, text: string): string {
  return `<a href="${escapeHtml(datasetHref(locale, id as never))}" data-nav="dataset-${escapeHtml(id)}">${escapeHtml(text)}</a>`;
}

function byName(locale: Locale, codes: string[]): string[] {
  const collator = new Intl.Collator(locale);
  return codes.map((code) => ({ code, name: countryName(locale, code) })).sort((a, b) => collator.compare(a.name, b.name)).map((c) => c.code);
}

function continentOf(locale: Locale, code: string): string {
  return countrySummary(locale, code).c;
}

/** "UTC+09:00", "UTC−05:00 (summer UTC−04:00)", or "6 time zones: UTC−10:00 to UTC−05:00" for wide countries. */
function zonesText(locale: Locale, detail: CountryDetail): string {
  const ui = countriesUi(locale);
  if (!detail.tz.length) return "";
  if (detail.tz.length === 1) {
    const [, jan, jul] = detail.tz[0];
    const summer = Math.max(jan, jul);
    const winter = Math.min(jan, jul);
    return winter === summer ? utcOffset(winter) : `${utcOffset(winter)} (${fill(ui.dst, { offset: utcOffset(summer) })})`;
  }
  const offsets = detail.tz.flatMap(([, jan, jul]) => [jan, jul]);
  return `${fill(ui.zonesCount, { n: detail.tz.length })}: ${fill(ui.zoneRange, { from: utcOffset(Math.min(...offsets)), to: utcOffset(Math.max(...offsets)) })}`;
}

function row(head: string, cell: string): string {
  return `<tr><th scope="row">${head}</th><td>${cell}</td></tr>`;
}

/** One figure with its year and rank, linking to its table: "123,366,734 (2025) · 12th of 217". */
function figureCell(locale: Locale, id: string, detail: CountryDetail): string | null {
  const f = detail.v[id];
  if (!f) return null;
  return `${escapeHtml(figureText(locale, id, f))} <span class="muted">(${f[1]}) · ${datasetLink(locale, id, rankOf(locale, id, f))}</span>`;
}

function factsHtml(locale: Locale, code: string): string {
  const ui = countriesUi(locale);
  const copy = countriesMessages(locale);
  const detail = countryDetail(code);
  const caps = capitalNames(locale, code);
  const cur = currencies(locale, code);
  const rows = [
    caps.length ? row(escapeHtml(ui.capital), escapeHtml(caps.join(ui.sep))) : "",
    row(escapeHtml(ui.continent), escapeHtml((copy.continents as Record<string, string>)[continentOf(locale, code)] ?? "")),
    // Labels with their units ("Land area (km²)"), as in the full list below.
    ...(["population", "land-area", "population-density", "gdp", "gdp-per-capita"] as const).map((id) => {
      const label = (copy.labels as Record<string, string>)[id];
      const cell = figureCell(locale, id, detail);
      return cell ? row(escapeHtml(label), cell) : "";
    }),
    cur.length ? row(escapeHtml(ui.currency), cur.map((c) => escapeHtml(`${c.name} (${c.code})`)).join(escapeHtml(ui.sep))) : "",
    detail.dial ? row(escapeHtml(ui.dial), escapeHtml(detail.dial)) : "",
    detail.tz.length ? row(escapeHtml(ui.zones), escapeHtml(zonesText(locale, detail))) : "",
  ].join("");
  return `<section class="country-facts" aria-labelledby="facts-title"><h2 id="facts-title">${escapeHtml(ui.facts)}</h2><div class="kb-table"><table><tbody>${rows}</tbody></table></div></section>`;
}

/** Every World Bank figure, grouped like the data tables, each linking to its ranked table. */
function figuresHtml(locale: Locale, code: string): string {
  const ui = countriesUi(locale);
  const copy = countriesMessages(locale);
  const labels = copy.labels as Record<string, string>;
  const groups = copy.groups as Record<string, string>;
  const detail = countryDetail(code);
  const head = `<thead><tr><th scope="col">${escapeHtml(ui.indicator)}</th><th scope="col" class="num">${escapeHtml(ui.value)}</th><th scope="col" class="num">${escapeHtml(ui.year)}</th><th scope="col" class="num">${escapeHtml(ui.rank)}</th></tr></thead>`;
  const sections = DATASET_GROUPS.filter((g) => groups[g.id]).map((group) => {
    const ids = (group.sets as readonly string[]).filter((id) => labels[id] && detail.v[id]);
    if (!ids.length) return "";
    const body = ids.map((id) => {
      const f = detail.v[id];
      return `<tr><th scope="row">${datasetLink(locale, id, labels[id])}</th><td class="num">${escapeHtml(figureText(locale, id, f))}</td><td class="num">${f[1]}</td><td class="num">${escapeHtml(rankOf(locale, id, f))}</td></tr>`;
    }).join("");
    return `<h3>${escapeHtml(groups[group.id])}</h3><div class="kb-table"><table>${head}<tbody>${body}</tbody></table></div>`;
  }).join("");
  return `<section class="country-figures" aria-labelledby="figures-title"><h2 id="figures-title">${escapeHtml(ui.figures)}</h2><p class="muted">${escapeHtml(ui.figuresNote)}</p>${sections}</section>`;
}

function codesHtml(locale: Locale, code: string): string {
  const ui = countriesUi(locale);
  const detail = countryDetail(code);
  const rows = [
    detail.a3 ? row(datasetLink(locale, "country-codes", ui.iso), escapeHtml(`${code} · ${detail.a3} · ${detail.num}`)) : "",
    detail.tld ? row(escapeHtml(ui.tld), escapeHtml(detail.tld)) : "",
    detail.dial ? row(datasetLink(locale, "calling-codes", ui.dial), escapeHtml(detail.dial)) : "",
    ...currencies(locale, code).map((c) => {
      const symbol = currencySymbol(locale, c.code);
      return row(datasetLink(locale, "currency-codes", ui.currency), escapeHtml(`${c.name} · ${c.code}${symbol ? ` · ${symbol}` : ""}`));
    }),
    ...detail.tz.map(([zone, jan, jul]) => {
      const name = zoneName(locale, zone);
      const offsets = jan === jul ? utcOffset(jan) : `${utcOffset(Math.min(jan, jul))} / ${utcOffset(Math.max(jan, jul))}`;
      return row(datasetLink(locale, "time-zones", ui.zones), `<code>${escapeHtml(zone)}</code> ${escapeHtml([name, offsets].filter(Boolean).join(" · "))}`);
    }),
  ].join("");
  if (!rows) return "";
  return `<section class="country-codes" aria-labelledby="codes-title"><h2 id="codes-title">${escapeHtml(ui.codes)}</h2><div class="kb-table"><table><tbody>${rows}</tbody></table></div></section>`;
}

/** Rankings on cv.cm that list the country: place tables with how many entries, share tables, the currency table. */
function rankingsHtml(locale: Locale, code: string): string {
  const ui = countriesUi(locale);
  const detail = countryDetail(code);
  const names = messages(locale).ui.ranking as unknown as Record<string, { name: string; blurb: string }>;
  const name = countryName(locale, code);
  const items = RANKINGS.filter((id) => detail.rk[id] && names[id]).map((id) => {
    const n = detail.rk[id];
    const meta = id === "currency-strength"
      ? fill(ui.rankingCurrency, { currency: currencies(locale, code).map((c) => c.name).join(ui.sep) })
      : id.endsWith("-market-share") ? fill(ui.rankingShare, { name }) : fill(ui.rankingCount, { n });
    return { href: rankingHref(locale, id), name: names[id].name, blurb: meta, nav: `ranking-${id}` };
  });
  if (!items.length) return "";
  return `<section class="learn-related"><h2>${escapeHtml(ui.rankings)}</h2>${linkListHtml(items)}</section>`;
}

/** Neighbours in the list: the places in the same continent closest in population. */
function relatedHtml(locale: Locale, code: string): string {
  const ui = countriesUi(locale);
  const copy = countriesMessages(locale);
  const continent = continentOf(locale, code);
  const own = countrySummary(locale, code).pop?.[0] ?? 0;
  const near = COUNTRY_LIST.map(countryCode)
    .filter((c) => c !== code && continentOf(locale, c) === continent)
    .sort((a, b) => Math.abs(Math.log((countrySummary(locale, a).pop?.[0] ?? 1) / (own || 1))) - Math.abs(Math.log((countrySummary(locale, b).pop?.[0] ?? 1) / (own || 1))) || a.localeCompare(b))
    .slice(0, 8);
  if (!near.length) return "";
  const items = near.map((c) => {
    const pop = countrySummary(locale, c).pop;
    const caps = capitalNames(locale, c);
    return {
      href: countriesHref(locale, countrySlug(c)!),
      name: countryName(locale, c),
      blurb: [caps.length ? `${ui.capital}: ${caps.join(ui.sep)}` : "", pop ? `${ui.population}: ${formatCount(locale, pop[0])}` : ""].filter(Boolean).join(" · "),
      nav: `countries-${countrySlug(c)}`,
    };
  });
  return `<section class="learn-related"><h2>${escapeHtml(fill(ui.related, { continent: (copy.continents as Record<string, string>)[continent] ?? "" }))}</h2>${linkListHtml(items)}</section>`;
}

function sourcesHtml(locale: Locale, code: string): string {
  const ui = countriesUi(locale);
  const summary = countrySummary(locale, code);
  const items = [
    `<li><a href="https://datacatalog.worldbank.org/search/dataset/0037712/World-Development-Indicators" target="_blank" rel="noopener">${escapeHtml(ui.sourceWb)}</a></li>`,
    `<li>${escapeHtml(ui.sourceCodes)}</li>`,
    summary.cap.length ? `<li><a href="https://www.wikidata.org/wiki/Property:P36" target="_blank" rel="noopener">${escapeHtml(ui.sourceCapital)}</a></li>` : "",
    summary.flag ? `<li><a href="https://github.com/lipis/flag-icons" target="_blank" rel="noopener">${escapeHtml(ui.sourceFlag)}</a></li>` : "",
  ].join("");
  return `<section class="learn-related"><h2>${escapeHtml(ui.sources)}</h2><ul>${items}</ul><p class="muted">${escapeHtml(fill(ui.snapshot, { date: dateLabel(locale, countriesMessages(locale).summary.updated) }))}</p></section>`;
}

function hubHtml(locale: Locale): string {
  const copy = countriesMessages(locale);
  const ui = copy.ui;
  const continents = copy.continents as Record<string, string>;
  const codes = COUNTRY_LIST.map(countryCode);
  const jump = CONTINENTS.map((c) => `<a href="#c-${c.toLowerCase()}">${escapeHtml(continents[c])}</a>`).join(" · ");
  const head = `<thead><tr><th scope="col">${escapeHtml(ui.flag)}</th><th scope="col">${escapeHtml(copy.hub.name)}</th><th scope="col">${escapeHtml(ui.capital)}</th><th scope="col" class="num">${escapeHtml(ui.population)}</th></tr></thead>`;
  const sections = CONTINENTS.map((continent) => {
    const list = byName(locale, codes.filter((c) => continentOf(locale, c) === continent));
    if (!list.length) return "";
    const body = list.map((c) => {
      const pop = countrySummary(locale, c).pop;
      const caps = capitalNames(locale, c);
      return `<tr><td>${flagImg(locale, c, 40)}</td><th scope="row">${countryLink(locale, c)}</th><td>${escapeHtml(caps.length ? caps.join(ui.sep) : ui.noCapital)}</td><td class="num">${pop ? escapeHtml(formatCount(locale, pop[0])) : ""}</td></tr>`;
    }).join("");
    return `<section class="wall" id="c-${continent.toLowerCase()}"><h2>${escapeHtml(continents[continent])} <span class="pill">${escapeHtml(fill(ui.count, { n: list.length }))}</span></h2><div class="kb-table country-list"><table>${head}<tbody>${body}</tbody></table></div></section>`;
  }).join("");
  return [
    crumbHtml(locale, null),
    `<header class="tool-head"><h1>${escapeHtml(copy.hub.h1)}</h1><p class="lede">${escapeHtml(fill(copy.hub.lede, { n: COUNTRY_LIST.length }))}</p></header>`,
    `<p class="slang-jump">${jump}</p>`,
    sections,
    `<section class="kb-about">${copy.hub.about.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}</section>`,
    faqHtml(locale, null),
    `<p class="more"><a href="${escapeHtml(datasetHref(locale))}" data-nav="datasets">${escapeHtml(ui.datasets)}</a></p>`,
  ].join("");
}

/** The countries hub or one profile as HTML: the client mounts it as is, and the Worker serves it to crawlers. */
export function countriesPageHtml(locale: Locale, slug: string | null): string {
  if (!slug) return hubHtml(locale);
  const code = countryCode(slug);
  const ui = countriesUi(locale);
  const copy = countriesMessages(locale);
  const s = countrySentences(locale, code);
  const answer = [s.capital, s.population, s.gdp, s.perCapita, s.currency, s.dial].filter(Boolean).join(ui.join);
  const continent = (copy.continents as Record<string, string>)[continentOf(locale, code)] ?? "";
  return [
    crumbHtml(locale, slug),
    `<article class="kb country">`,
    `<header class="tool-head"><p class="kicker">${escapeHtml(ui.kicker)}${continent ? ` · ${escapeHtml(continent)}` : ""}</p>`,
    `<h1>${escapeHtml(countryH1(locale, code))}</h1>`,
    `</header>`,
    flagImg(locale, code, 240, true) ? `<figure class="country-figure">${flagImg(locale, code, 240, true)}</figure>` : "",
    `<section class="kb-answer" aria-label="${escapeHtml(ui.answer)}"><h2>${escapeHtml(ui.answer)}</h2><p>${escapeHtml(answer)}</p></section>`,
    factsHtml(locale, code),
    figuresHtml(locale, code),
    codesHtml(locale, code),
    rankingsHtml(locale, code),
    faqHtml(locale, slug),
    relatedHtml(locale, code),
    sourcesHtml(locale, code),
    `<p class="more"><a href="${escapeHtml(countriesHref(locale))}" data-nav="countries">${escapeHtml(ui.all)}</a></p>`,
    `</article>`,
  ].join("");
}
