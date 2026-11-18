/**
 * The exchange-rate page HTML (hub and pair pages), shared by the client page and the Worker's crawler copy. Kept out
 * of currency-i18n so the main bundle, which needs only titles, descriptions and JSON-LD, does not carry it. Every
 * number is from the ECB snapshot in the currency pack; the charts are plain SVG drawn here.
 */
import type { Locale } from "./locale";
import { escapeHtml } from "./device-i18n";
import { fill } from "./fill";
import { messages } from "./messages";
import { appHref, currencyHref } from "./path";
import { dataCrumbHtml } from "./channel-parent";
import { HREFLANG } from "./sitemap";
import { CURRENCY_PAIRS, pairCodes, reversePair, type CurrencyPair } from "./currency";
import {
  CURRENCY_WINDOWS,
  ECB_SOURCE,
  crossRate,
  currencyAnswer,
  currencyData,
  currencyFaqItems,
  currencyLede,
  currencyMessages,
  currencyName,
  ecbCodes,
  formatAmount,
  formatDate,
  formatMoney,
  formatMonth,
  formatPercent,
  formatRate,
  pairData,
  pairLabel,
  pairVars,
  tableAmounts,
  type CurrencyWindow,
} from "./currency-i18n";

const sep = ` <span aria-hidden="true">/</span> `;

/** The hub converter's first pair per locale (the ECB has no TWD or VND). */
export const HUB_DEFAULT: Record<Locale, [string, string]> = {
  en: ["USD", "EUR"],
  "zh-CN": ["USD", "CNY"],
  "zh-TW": ["USD", "CNY"],
  ja: ["USD", "JPY"],
  ko: ["USD", "KRW"],
  vi: ["USD", "EUR"],
  id: ["USD", "IDR"],
  es: ["USD", "MXN"],
};
export const HUB_AMOUNT = 100;

function crumbHtml(locale: Locale, pair: CurrencyPair | null): string {
  const m = currencyMessages(locale);
  const parts = [
    `<a href="${escapeHtml(appHref(locale, null))}" data-nav="home">${escapeHtml(m.crumbHome)}</a>`,
    dataCrumbHtml(locale),
    pair ? `<a href="${escapeHtml(currencyHref(locale))}" data-nav="currency">${escapeHtml(m.hub.h1)}</a>` : `<span>${escapeHtml(m.hub.h1)}</span>`,
  ];
  if (pair) parts.push(`<span>${escapeHtml(pairLabel(pair))}</span>`);
  return `<nav class="device-crumb" aria-label="${escapeHtml(messages(locale).ui.nav.breadcrumb)}">${parts.join(sep)}</nav>`;
}

function pairLink(locale: Locale, pair: CurrencyPair, text = pairLabel(pair)): string {
  return `<a href="${escapeHtml(currencyHref(locale, pair))}" data-nav="currency-${pair}">${escapeHtml(text)}</a>`;
}

function faqHtml(locale: Locale, pair: CurrencyPair | null): string {
  const items = currencyFaqItems(locale, pair).map((item, index) => (
    `<details${index === 0 ? " open" : ""}><summary>${escapeHtml(item.q)}</summary><p>${escapeHtml(item.a)}</p></details>`
  )).join("");
  return `<section class="faq" aria-labelledby="faq-title"><h2 id="faq-title">${escapeHtml(currencyMessages(locale).page.faqTitle)}</h2>${items}</section>`;
}

function noticeHtml(locale: Locale): string {
  return `<p class="fx-notice">${escapeHtml(currencyMessages(locale).notice)}</p>`;
}

function sourcesHtml(locale: Locale): string {
  const s = currencyMessages(locale).sources;
  return `<section class="learn-related fx-sources"><h2>${escapeHtml(s.title)}</h2><ul>`
    + `<li><a href="${escapeHtml(ECB_SOURCE.url)}" target="_blank" rel="noopener">${escapeHtml(s.ecb)}</a></li>`
    + `<li><a href="${escapeHtml(ECB_SOURCE.terms)}" target="_blank" rel="noopener license">${escapeHtml(s.license)}</a></li></ul>`
    + `<p class="muted">${escapeHtml(fill(s.snapshot, { date: formatDate(locale, currencyData(locale).asOf) }))}</p></section>`;
}

/** "100 USD = 732.54 CNY": the converter's result line. */
export function resultText(locale: Locale, amount: number, from: string, to: string, rate: number): string {
  return `${formatAmount(locale, amount)} ${from} = ${formatMoney(locale, amount * rate)} ${to}`;
}

/** "1 USD = 7.3254 CNY · 1 CNY = 0.136511 USD". */
export function unitText(locale: Locale, from: string, to: string, rate: number): string {
  return `1 ${from} = ${formatRate(locale, rate)} ${to} · 1 ${to} = ${formatRate(locale, 1 / rate)} ${from}`;
}

function currencyOptions(locale: Locale, selected: string): string {
  return ecbCodes(locale).map((code) => (
    `<option value="${code}"${code === selected ? " selected" : ""}>${escapeHtml(`${code} · ${currencyName(locale, code)}`)}</option>`
  )).join("");
}

/** The hub converter: amount, from, swap, to. The result is filled here for the defaults and by the client after. */
function hubConverterHtml(locale: Locale): string {
  const m = currencyMessages(locale).hub;
  const [from, to] = HUB_DEFAULT[locale];
  const rate = crossRate(locale, from, to);
  return `<section class="fx-converter" aria-labelledby="fx-conv-title"><h2 id="fx-conv-title">${escapeHtml(m.converterTitle)}</h2>`
    + `<div class="fx-form">`
    + `<label class="field"><span>${escapeHtml(m.amount)}</span><input class="fx-amount" type="text" inputmode="decimal" autocomplete="off" value="${formatAmount(locale, HUB_AMOUNT)}"></label>`
    + `<label class="field"><span>${escapeHtml(m.from)}</span><select class="fx-from">${currencyOptions(locale, from)}</select></label>`
    + `<button type="button" class="btn ghost fx-swap">${escapeHtml(m.swap)}</button>`
    + `<label class="field"><span>${escapeHtml(m.to)}</span><select class="fx-to">${currencyOptions(locale, to)}</select></label>`
    + `</div>`
    + `<p class="fx-out" aria-live="polite">${escapeHtml(resultText(locale, HUB_AMOUNT, from, to, rate))}</p>`
    + `<p class="muted fx-unit">${escapeHtml(unitText(locale, from, to, rate))}</p>`
    + `<p class="muted fx-pairlink" hidden></p>`
    + `</section>`;
}

/** Pairs grouped by the currency they convert from, in the channel's order. */
function pairGroups(): [string, CurrencyPair[]][] {
  const groups = new Map<string, CurrencyPair[]>();
  for (const pair of CURRENCY_PAIRS) {
    const [from] = pairCodes(pair);
    groups.set(from, [...(groups.get(from) ?? []), pair]);
  }
  return [...groups];
}

function hubPairsHtml(locale: Locale): string {
  const m = currencyMessages(locale).hub;
  const groups = pairGroups().map(([from, pairs]) => {
    const items = pairs.map((pair) => {
      const [, to] = pairCodes(pair);
      return `<li>${pairLink(locale, pair)} <span class="muted">${escapeHtml(currencyName(locale, to))} · 1 ${from} = ${escapeHtml(formatRate(locale, pairData(locale, pair).rate))} ${to}</span></li>`;
    }).join("");
    return `<h3>${escapeHtml(fill(m.pairsFrom, { name: currencyName(locale, from), code: from }))}</h3><ul class="fx-pairs">${items}</ul>`;
  }).join("");
  return `<section class="fx-pair-list" aria-labelledby="fx-pairs-title"><h2 id="fx-pairs-title">${escapeHtml(m.pairsTitle)}</h2>${groups}</section>`;
}

function hubTableHtml(locale: Locale): string {
  const m = currencyMessages(locale).hub;
  const data = currencyData(locale);
  const rows = ecbCodes(locale).map((code) => (
    `<tr><th scope="row">${escapeHtml(currencyName(locale, code))}</th><td>${code}</td>`
    + `<td class="num">${escapeHtml(formatRate(locale, crossRate(locale, "EUR", code)))}</td>`
    + `<td class="num">${escapeHtml(formatRate(locale, crossRate(locale, "USD", code)))}</td></tr>`
  )).join("");
  const title = fill(m.tableTitle, { date: formatDate(locale, data.asOf) });
  return `<section class="fx-all" aria-labelledby="fx-all-title"><h2 id="fx-all-title">${escapeHtml(title)}</h2>`
    + `<div class="fx-wrap"><table class="fx-table"><caption class="sr-only">${escapeHtml(title)}</caption><thead><tr>`
    + `<th scope="col">${escapeHtml(m.colCurrency)}</th><th scope="col">ISO</th><th scope="col" class="num">${escapeHtml(m.colPerEur)}</th><th scope="col" class="num">${escapeHtml(m.colPerUsd)}</th>`
    + `</tr></thead><tbody>${rows}</tbody></table></div><p class="muted">${escapeHtml(m.missing)}</p></section>`;
}

function hubHtml(locale: Locale): string {
  const m = currencyMessages(locale);
  return [
    crumbHtml(locale, null),
    `<header class="tool-head"><h1>${escapeHtml(m.hub.h1)}</h1><p class="lede">${escapeHtml(currencyLede(locale))}</p></header>`,
    hubConverterHtml(locale),
    noticeHtml(locale),
    hubPairsHtml(locale),
    hubTableHtml(locale),
    faqHtml(locale, null),
    sourcesHtml(locale),
  ].join("");
}

/** The pair converter: two linked amounts, from and to. */
function pairConverterHtml(locale: Locale, pair: CurrencyPair): string {
  const m = currencyMessages(locale).page;
  const [from, to] = pairCodes(pair);
  const rate = pairData(locale, pair).rate;
  const vars = pairVars(locale, pair);
  return `<section class="fx-converter" aria-labelledby="fx-conv-title"><h2 id="fx-conv-title">${escapeHtml(fill(m.converterTitle, vars))}</h2>`
    + `<div class="fx-form">`
    + `<label class="field"><span>${escapeHtml(`${from} · ${currencyName(locale, from)}`)}</span><input class="fx-a" type="text" inputmode="decimal" autocomplete="off" value="1"></label>`
    + `<label class="field"><span>${escapeHtml(`${to} · ${currencyName(locale, to)}`)}</span><input class="fx-b" type="text" inputmode="decimal" autocomplete="off" value="${escapeHtml(formatMoney(locale, rate))}"></label>`
    + `</div><p class="fx-out" aria-live="polite">${escapeHtml(resultText(locale, 1, from, to, rate))}</p></section>`;
}

function conversionTable(locale: Locale, from: string, to: string, rate: number, title: string): string {
  const rows = tableAmounts(rate).map((amount) => (
    `<tr><td class="num">${escapeHtml(formatAmount(locale, amount))} ${from}</td><td class="num">${escapeHtml(formatMoney(locale, amount * rate))} ${to}</td></tr>`
  )).join("");
  return `<div class="fx-wrap"><table class="fx-table"><caption>${escapeHtml(title)}</caption><thead><tr><th scope="col" class="num">${from}</th><th scope="col" class="num">${to}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function tablesHtml(locale: Locale, pair: CurrencyPair): string {
  const m = currencyMessages(locale).page;
  const [from, to] = pairCodes(pair);
  const rate = pairData(locale, pair).rate;
  const vars = pairVars(locale, pair);
  return `<section class="fx-tables" aria-labelledby="fx-tables-title"><h2 id="fx-tables-title">${escapeHtml(m.tablesTitle)}</h2><div class="fx-two">`
    + conversionTable(locale, from, to, rate, fill(m.tableTitle, vars))
    + conversionTable(locale, to, from, 1 / rate, fill(m.tableBackTitle, vars))
    + `</div></section>`;
}

function windowLabel(locale: Locale, pair: CurrencyPair, key: CurrencyWindow): string {
  const m = currencyMessages(locale).page;
  return key === "all" ? fill(m.all, { year: pairData(locale, pair).start.slice(0, 4) }) : m[key];
}

function statsHtml(locale: Locale, pair: CurrencyPair): string {
  const m = currencyMessages(locale).page;
  const d = pairData(locale, pair);
  const rows = CURRENCY_WINDOWS.map((key) => {
    const s = d.stats[key];
    return `<tr><th scope="row">${escapeHtml(windowLabel(locale, pair, key))}</th>`
      + `<td class="num">${escapeHtml(formatRate(locale, s.hi))}<br><span class="muted">${escapeHtml(formatDate(locale, s.hiOn))}</span></td>`
      + `<td class="num">${escapeHtml(formatRate(locale, s.lo))}<br><span class="muted">${escapeHtml(formatDate(locale, s.loOn))}</span></td>`
      + `<td class="num">${escapeHtml(formatRate(locale, s.avg))}</td>`
      + `<td class="num">${escapeHtml(formatPercent(locale, d.rate / s.open - 1))}</td></tr>`;
  }).join("");
  const note = fill(m.statsNote, { from: formatDate(locale, d.start), date: formatDate(locale, currencyData(locale).asOf) });
  return `<section class="fx-stats" aria-labelledby="fx-stats-title"><h2 id="fx-stats-title">${escapeHtml(m.statsTitle)}</h2>`
    + `<div class="fx-wrap"><table class="fx-table"><caption class="sr-only">${escapeHtml(m.statsTitle)}</caption><thead><tr>`
    + `<th scope="col">${escapeHtml(m.period)}</th><th scope="col" class="num">${escapeHtml(m.high)}</th><th scope="col" class="num">${escapeHtml(m.low)}</th><th scope="col" class="num">${escapeHtml(m.average)}</th><th scope="col" class="num">${escapeHtml(m.change)}</th>`
    + `</tr></thead><tbody>${rows}</tbody></table></div><p class="muted">${escapeHtml(note)}</p></section>`;
}

const AXIS = new Map<Locale, Intl.NumberFormat>();
function axisNumber(locale: Locale, value: number): string {
  let format = AXIS.get(locale);
  if (!format) AXIS.set(locale, format = new Intl.NumberFormat(HREFLANG[locale], { maximumSignificantDigits: 4 }));
  return format.format(value);
}

/** One point of a chart: x label (a day or a month) and the value, null for a gap. */
type ChartPoint = { at: string; v: number | null };

const W = 640;
const H = 220;
const PAD = { left: 58, right: 12, top: 12, bottom: 26 };

/** A plain SVG line chart: four horizontal grid lines with values, x labels from `ticks`, one line (gaps break it). */
export function lineChartSvg(locale: Locale, points: ChartPoint[], ticks: { index: number; label: string }[], label: string): string {
  const values = points.map((p) => p.v).filter((v): v is number => v !== null);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.abs(max) * 0.01 || 1;
  const lo = min - span * 0.05;
  const hi = max + span * 0.05;
  const x = (i: number): number => PAD.left + (points.length === 1 ? 0 : (i / (points.length - 1)) * (W - PAD.left - PAD.right));
  const y = (v: number): number => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  let path = "";
  let pen = false;
  points.forEach((p, i) => {
    if (p.v === null) {
      pen = false;
      return;
    }
    path += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`;
    pen = true;
  });
  const grid = [0, 1, 2, 3].map((k) => {
    const v = lo + ((hi - lo) * (k + 0.5)) / 4;
    const gy = y(v).toFixed(1);
    return `<line class="fx-grid" x1="${PAD.left}" x2="${W - PAD.right}" y1="${gy}" y2="${gy}"/><text class="fx-ylab" x="${PAD.left - 6}" y="${gy}" text-anchor="end" dominant-baseline="middle">${escapeHtml(axisNumber(locale, v))}</text>`;
  }).join("");
  const xs = ticks.map((t) => `<text class="fx-xlab" x="${x(t.index).toFixed(1)}" y="${H - 8}" text-anchor="middle">${escapeHtml(t.label)}</text>`).join("");
  return `<svg class="fx-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(label)}"><title>${escapeHtml(label)}</title>`
    + `${grid}<line class="fx-axis" x1="${PAD.left}" x2="${W - PAD.right}" y1="${H - PAD.bottom}" y2="${H - PAD.bottom}"/>${xs}<path class="fx-line" d="${path}"/></svg>`;
}

function chartLabel(locale: Locale, pair: CurrencyPair, points: ChartPoint[], when: (at: string) => string): string {
  const shown = points.filter((p): p is { at: string; v: number } => p.v !== null);
  const values = shown.map((p) => p.v);
  return fill(currencyMessages(locale).page.chartLabel, {
    ...pairVars(locale, pair),
    first: formatRate(locale, shown[0].v),
    firstDate: when(shown[0].at),
    last: formatRate(locale, shown.at(-1)!.v),
    lastDate: when(shown.at(-1)!.at),
    high: formatRate(locale, Math.max(...values)),
    low: formatRate(locale, Math.min(...values)),
  });
}

/** Chart points and x labels from the stored months and days: each point keeps its own month or day, so a gap never moves a label. */
export function chartSeries(locale: Locale, pair: CurrencyPair): { monthly: ChartPoint[]; yearTicks: { index: number; label: string }[]; daily: ChartPoint[]; dayTicks: { index: number; label: string }[] } {
  const d = pairData(locale, pair);
  const monthly: ChartPoint[] = d.monthly.map(([at, v]) => ({ at, v }));
  // A year label every 1–5 years, at January.
  const years = Number(monthly.at(-1)!.at.slice(0, 4)) - Number(monthly[0].at.slice(0, 4));
  const step = years > 20 ? 5 : years > 10 ? 3 : years > 5 ? 2 : 1;
  const yearTicks = monthly.flatMap((p, index) => (p.at.endsWith("-01") && Number(p.at.slice(0, 4)) % step === 0 ? [{ index, label: p.at.slice(0, 4) }] : []));
  const daily: ChartPoint[] = d.daily.map(([at, v]) => ({ at, v }));
  const monthNames = new Intl.DateTimeFormat(HREFLANG[locale], { month: "short", timeZone: "UTC" });
  const dayTicks = daily.flatMap((p, index) => (index > 0 && p.at.slice(0, 7) !== daily[index - 1].at.slice(0, 7) ? [{ index, label: monthNames.format(new Date(`${p.at}T00:00:00Z`)) }] : []));
  return { monthly, yearTicks, daily, dayTicks };
}

function chartsHtml(locale: Locale, pair: CurrencyPair): string {
  const m = currencyMessages(locale).page;
  const vars = pairVars(locale, pair);
  const { monthly, yearTicks, daily, dayTicks } = chartSeries(locale, pair);
  return `<section class="fx-history" aria-labelledby="fx-chart-title"><h2 id="fx-chart-title">${escapeHtml(fill(m.chartTitle, vars))}</h2>`
    + `<h3>${escapeHtml(fill(m.chartMonthly, { start: formatMonth(locale, monthly[0].at) }))}</h3>`
    + lineChartSvg(locale, monthly, yearTicks, chartLabel(locale, pair, monthly, (at) => formatMonth(locale, at)))
    + `<h3>${escapeHtml(m.chartDaily)}</h3>`
    + lineChartSvg(locale, daily, dayTicks, chartLabel(locale, pair, daily, (at) => formatDate(locale, at)))
    + `<p class="muted">${escapeHtml(fill(m.method, vars))} ${escapeHtml(fill(m.monthlyNote, vars))}</p></section>`;
}

/** Pairs sharing a currency with this one (the reverse first when there is one). */
export function relatedPairs(pair: CurrencyPair): CurrencyPair[] {
  const [from, to] = pairCodes(pair);
  const back = reversePair(pair);
  const shared = CURRENCY_PAIRS.filter((other) => other !== pair && other !== back && pairCodes(other).some((code) => code === from || code === to));
  return shared.slice(0, 12);
}

function relatedHtml(locale: Locale, pair: CurrencyPair): string {
  const m = currencyMessages(locale).page;
  const back = reversePair(pair);
  const vars = pairVars(locale, pair);
  const reverse = back ? `<p>${pairLink(locale, back, fill(m.reverse, vars))}</p>` : "";
  const list = relatedPairs(pair).map((other) => pairLink(locale, other)).join(" · ");
  return `<section class="kb-section fx-related" aria-labelledby="fx-related-title"><h2 id="fx-related-title">${escapeHtml(m.related)}</h2>${reverse}<p class="slang-jump">${list}</p></section>`;
}

function pairHtml(locale: Locale, pair: CurrencyPair): string {
  const m = currencyMessages(locale);
  const [from, to] = pairCodes(pair);
  const d = pairData(locale, pair);
  const vars = pairVars(locale, pair);
  return [
    crumbHtml(locale, pair),
    `<article class="fx-page">`,
    `<header class="tool-head"><p class="kicker">${escapeHtml(m.hub.h1)} · ${escapeHtml(formatDate(locale, currencyData(locale).asOf))}</p><h1>${escapeHtml(fill(m.page.h1, vars))}</h1></header>`,
    `<section class="kb-answer fx-answer"><p class="fx-big">1 ${from} = ${escapeHtml(formatRate(locale, d.rate))} ${to}</p><p>${escapeHtml(currencyAnswer(locale, pair))}</p>${noticeHtml(locale)}</section>`,
    pairConverterHtml(locale, pair),
    tablesHtml(locale, pair),
    statsHtml(locale, pair),
    chartsHtml(locale, pair),
    relatedHtml(locale, pair),
    faqHtml(locale, pair),
    sourcesHtml(locale),
    `<p class="more"><a href="${escapeHtml(currencyHref(locale))}" data-nav="currency">${escapeHtml(m.hub.h1)}</a></p>`,
    `</article>`,
  ].join("");
}

/** The exchange-rate hub (null) or one pair as HTML: the client mounts it as is, and the Worker serves it to crawlers. */
export function currencyPageHtml(locale: Locale, pair: CurrencyPair | null): string {
  return pair ? pairHtml(locale, pair) : hubHtml(locale);
}
