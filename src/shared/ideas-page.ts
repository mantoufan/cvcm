/**
 * The ideas pages as HTML: hub, idea guide, valuation panel and chart. Separate from ideas-i18n (titles, descriptions,
 * JSON-LD), which the main bundle needs for every page's head: only the ideas UI chunk and the Worker's fallback body
 * (seo-html.ts) import this, so the renderers stay out of the main bundle.
 */
import { LOCALES, type Locale } from "./locale";
import { escapeHtml } from "./device-i18n";
import { fill } from "./fill";
import { blockHtml, dateLabel, inline, linkListHtml } from "./kb-i18n";
import { ideasMessages, messages } from "./messages";
import { appHref, ideasHref } from "./path";
import { IDEA_GROUPS, IDEA_META, ideaGroupOf, ideaModified, type IdeaId } from "./ideas";
import { plain } from "./number-format";
import { HREFLANG } from "./sitemap";
import { ideaCopy, ideaData, ideaFaqItems, ideaName, ideaSources, ideasData, ideasHub, rankedIdeas, type IdeaData, type IdeasUi } from "./ideas-i18n";

export function ideasUi(locale: Locale): IdeasUi {
  return ideasMessages(locale).ui;
}

export type IdeaOutlook = "up" | "flat" | "down";

/** Growing or shrinking by the momentum score (50 = flat), with a dead zone so small moves read as steady. */
export function ideaOutlook(data: IdeaData): IdeaOutlook {
  const m = data.scores.momentum;
  return m >= 58 ? "up" : m <= 42 ? "down" : "flat";
}

/** "+12%", "−5%", "0%". */
export function pct(locale: Locale, value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${plain(locale, Math.abs(value))}%`;
}

function changeHtml(locale: Locale, value: number): string {
  return `<span class="${value > 0 ? "up" : value < 0 ? "down" : ""}">${escapeHtml(pct(locale, value))}</span>`;
}

function outlookBadge(locale: Locale, outlook: IdeaOutlook): string {
  const ui = ideasUi(locale);
  const label = { up: ui.outlookUp, flat: ui.outlookFlat, down: ui.outlookDown }[outlook];
  return `<span class="idea-outlook idea-outlook-${outlook}">${escapeHtml(label)}</span>`;
}

function scoreTier(score: number): "high" | "mid" | "low" {
  return score >= 65 ? "high" : score >= 45 ? "mid" : "low";
}

/** Intl objects are slow to build: one per locale and kind, kept for the process's life. */
const intlCache = new Map<string, Intl.DateTimeFormat | Intl.DisplayNames>();

/** "2022-11" as a short month and year in the reader's language. */
function monthLabel(locale: Locale, ym: string, style: "short" | "year" = "short"): string {
  const [year, month] = ym.split("-").map(Number);
  try {
    const key = `date|${locale}|${style}`;
    let format = intlCache.get(key) as Intl.DateTimeFormat | undefined;
    if (!format) {
      format = new Intl.DateTimeFormat(HREFLANG[locale], style === "year" ? { year: "numeric", timeZone: "UTC" } : { year: "numeric", month: "short", timeZone: "UTC" });
      intlCache.set(key, format);
    }
    return format.format(new Date(Date.UTC(year, month - 1, 1)));
  } catch {
    return ym;
  }
}

/** The month `offset` months after "YYYY-MM". */
function addMonths(ym: string, offset: number): string {
  const [year, month] = ym.split("-").map(Number);
  const total = year * 12 + (month - 1) + offset;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** The site locale's language name in the reader's language ("Japanese", "日语"). */
function languageName(reader: Locale, language: Locale): string {
  const code = language === "zh-CN" ? "zh-Hans" : language === "zh-TW" ? "zh-Hant" : language;
  try {
    const key = `lang|${reader}`;
    let names = intlCache.get(key) as Intl.DisplayNames | undefined;
    if (!names) {
      names = new Intl.DisplayNames([HREFLANG[reader]], { type: "language" });
      intlCache.set(key, names);
    }
    return names.of(code) ?? language;
  } catch {
    return language;
  }
}

/**
 * Four years of searches and the forecast as an inline SVG line chart (no script, so crawlers see it too). The y axis
 * is the index (peak = 100); the forecast may run above it.
 */
export function ideaChartSvg(locale: Locale, data: IdeaData, from: string): string {
  const ui = ideasUi(locale);
  const history = data.idx;
  const months = history.length + data.fc.length;
  const W = 640;
  const H = 220;
  const left = 34;
  const right = 8;
  const top = 10;
  const bottom = 26;
  // A fast-growing idea's band can reach 2x the peak: cap the axis so the history keeps most of the height, and pin
  // anything above it to the top edge.
  const yMax = Math.min(150, Math.max(100, ...data.fcHi));
  const x = (i: number): number => left + (i * (W - left - right)) / (months - 1);
  const y = (v: number): number => top + (1 - Math.min(v, yMax) / yMax) * (H - top - bottom);
  const pt = (i: number, v: number): string => `${x(i).toFixed(1)},${y(v).toFixed(1)}`;
  const last = history.length - 1;
  const line = history.map((v, i) => pt(i, v)).join(" ");
  const fc = [pt(last, history[last]), ...data.fc.map((v, i) => pt(last + 1 + i, v))].join(" ");
  const band = [
    pt(last, history[last]),
    ...data.fcHi.map((v, i) => pt(last + 1 + i, v)),
    ...data.fcLo.map((v, i) => pt(last + 1 + i, v)).reverse(),
  ].join(" ");
  // When the band was cut at the top, the top label says so ("150+").
  const capped = Math.max(...data.fcHi, ...data.fc) > yMax;
  const ticks: [number, string][] = [[0, "0"], [50, "50"], [100, "100"], ...(yMax >= 115 ? [[yMax, capped ? `${yMax}+` : String(yMax)] as [number, string]] : [])];
  const grid = ticks
    .map(([v, label]) => `<line class="idea-grid" x1="${left}" x2="${W - right}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="idea-axis" x="${left - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${escapeHtml(label)}</text>`)
    .join("");
  // A label under every January.
  const years = Array.from({ length: months }, (_, i) => i)
    .filter((i) => addMonths(from, i).endsWith("-01"))
    .map((i) => `<line class="idea-tick" x1="${x(i).toFixed(1)}" x2="${x(i).toFixed(1)}" y1="${H - bottom}" y2="${H - bottom + 4}"/><text class="idea-axis" x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${escapeHtml(monthLabel(locale, addMonths(from, i), "year"))}</text>`)
    .join("");
  const label = fill(ui.chart, { from: monthLabel(locale, from), to: monthLabel(locale, addMonths(from, last)) });
  return `<figure class="idea-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(label)}">`
    + grid
    + `<line class="idea-now" x1="${x(last).toFixed(1)}" x2="${x(last).toFixed(1)}" y1="${top}" y2="${H - bottom}"/>`
    + `<polygon class="idea-band" points="${band}"/>`
    + `<polyline class="idea-line" points="${line}"/>`
    + `<polyline class="idea-fc" points="${fc}"/>`
    + years
    + `</svg><figcaption>${escapeHtml(label)}<span class="idea-legend"><span class="idea-key idea-key-line">${escapeHtml(ui.chartHistory)}</span><span class="idea-key idea-key-fc">${escapeHtml(ui.chartForecast)}</span><span class="idea-key idea-key-band">${escapeHtml(ui.chartBand)}</span></span></figcaption></figure>`;
}

/** One sub-score as a labelled bar (an SVG rect, so no inline style is needed). */
function partHtml(label: string, value: number): string {
  return `<div class="idea-part"><dt>${escapeHtml(label)}</dt><dd><svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect class="idea-part-bg" width="100" height="8" rx="4"/><rect class="idea-part-fg idea-tier-${scoreTier(value)}" width="${Math.max(2, value)}" height="8" rx="4"/></svg><span>${value}</span></dd></div>`;
}

function panelHtml(locale: Locale, id: IdeaId): string {
  const data = ideaData(locale, id);
  if (!data) return "";
  const ui = ideasUi(locale);
  const all = ideasData(locale);
  const s = data.scores;
  const facts: [string, string][] = [
    [ui.demand, escapeHtml(ui.demandBands[data.demand] ?? "")],
    ...(data.yoy !== null ? [[ui.yoy, changeHtml(locale, data.yoy)] as [string, string]] : []),
    ...(data.fourYear !== null ? [[ui.fourYear, escapeHtml(fill(ui.times, { n: plain(locale, data.fourYear, 1) }))] as [string, string]] : []),
    [ui.next12, changeHtml(locale, data.next12)],
    ...(data.cpc !== null ? [[ui.cpc, escapeHtml(ui.cpcBands[data.cpc] ?? "")] as [string, string]] : []),
    ...(data.value !== null ? [[ui.value, escapeHtml(ui.valueBands[data.value] ?? "")] as [string, string]] : []),
    ...(data.competition ? [[ui.competition, escapeHtml({ low: ui.compLow, medium: ui.compMedium, high: ui.compHigh }[data.competition])] as [string, string]] : []),
  ];
  const langs = (Object.entries(data.langs) as [Locale, { demand: number; yoy: number | null }][])
    .sort((a, b) => b[1].demand - a[1].demand)
    .map(([lang, row]) => `<li><span>${escapeHtml(languageName(locale, lang))}</span><strong>${escapeHtml(ui.demandBands[row.demand] ?? "")}</strong>${row.yoy !== null ? changeHtml(locale, row.yoy) : ""}</li>`)
    .join("");
  return `<section class="idea-panel" aria-labelledby="idea-panel-title"><h2 id="idea-panel-title">${escapeHtml(ui.panel)}</h2>`
    + `<div class="idea-head"><p class="idea-score idea-tier-${scoreTier(s.total)}"><strong>${s.total}</strong><span>${escapeHtml(ui.scoreOf)}</span><small>${escapeHtml(ui.score)}</small>${outlookBadge(locale, ideaOutlook(data))}</p>`
    + `<dl class="idea-parts" aria-label="${escapeHtml(ui.parts)}">${partHtml(ui.partDemand, s.demand)}${partHtml(ui.partMomentum, s.momentum)}${partHtml(ui.partValue, s.value)}${partHtml(ui.partOpenness, s.openness)}</dl></div>`
    + `<dl class="idea-facts">${facts.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${v}</dd></div>`).join("")}</dl>`
    + ideaChartSvg(locale, data, all.from)
    + (langs ? `<h3>${escapeHtml(ui.langs)}</h3><ul class="idea-langs">${langs}</ul>` : "")
    + `<p class="idea-note">${escapeHtml(fill(ui.dataNote, { from: monthLabel(locale, all.from), to: monthLabel(locale, all.to), n: LOCALES.length }))} <a href="${escapeHtml(ideasHref(locale))}#method" data-nav="ideas">${escapeHtml(ui.method)}</a></p>`
    + `<p class="idea-note">${escapeHtml(ui.disclaimer)}</p></section>`;
}

const CJK = new Set<Locale>(["zh-CN", "zh-TW", "ja"]);

function crumbHtml(locale: Locale, id: IdeaId | null): string {
  const m = ideasMessages(locale);
  const sep = ` <span aria-hidden="true">/</span> `;
  const parts = [
    `<a href="${escapeHtml(appHref(locale, null))}" data-nav="home">${escapeHtml(m.crumbHome)}</a>`,
    id
      ? `<a href="${escapeHtml(ideasHref(locale))}" data-nav="ideas">${escapeHtml(m.hub.h1)}</a>`
      : `<span>${escapeHtml(m.hub.h1)}</span>`,
  ];
  if (id) parts.push(`<span>${escapeHtml(ideaName(locale, id).name)}</span>`);
  return `<nav class="device-crumb" aria-label="${escapeHtml(messages(locale).ui.nav.breadcrumb)}">${parts.join(sep)}</nav>`;
}

function faqHtml(locale: Locale, id: IdeaId | null): string {
  const items = ideaFaqItems(locale, id).map((item, index) => (
    `<details${index === 0 ? " open" : ""}><summary>${inline(item.q)}</summary><p>${inline(item.a)}</p></details>`
  )).join("");
  return `<section class="faq" aria-labelledby="faq-title"><h2 id="faq-title">${escapeHtml(ideasUi(locale).faq)}</h2>${items}</section>`;
}

function ideaLinkItems(locale: Locale, ids: readonly IdeaId[]): { href: string; name: string; blurb: string; nav: string; meta?: string }[] {
  const ui = ideasUi(locale);
  return ids.map((id) => {
    const data = ideaData(locale, id);
    return { href: ideasHref(locale, id), ...ideaName(locale, id), nav: `ideas-${id}`, ...(data ? { meta: `${ui.score} ${data.scores.total}` } : {}) };
  });
}

function sourcesHtml(locale: Locale, id: IdeaId): string {
  const sources = ideaSources(locale, id);
  if (!sources.length) return "";
  const items = sources.map((s) => `<li><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.name)}</a></li>`).join("");
  return `<section class="learn-related"><h2>${escapeHtml(ideasUi(locale).sources)}</h2><ul>${items}</ul></section>`;
}

function rankingHtml(locale: Locale): string {
  const ui = ideasUi(locale);
  const data = ideasData(locale);
  const rows = rankedIdeas(locale).map(({ id, data }, index) => (
    `<tr><td>${index + 1}</td><td><a href="${escapeHtml(ideasHref(locale, id))}" data-nav="ideas-${id}">${escapeHtml(ideaName(locale, id).name)}</a></td>`
    + `<td><span class="idea-pill idea-tier-${scoreTier(data.scores.total)}">${data.scores.total}</span></td>`
    + `<td>${escapeHtml(ui.demandBands[data.demand] ?? "")}</td><td>${data.yoy !== null ? changeHtml(locale, data.yoy) : "—"}</td><td>${outlookBadge(locale, ideaOutlook(data))}</td></tr>`
  )).join("");
  if (!rows) return "";
  return `<section class="wall idea-ranking" id="ranking"><h2>${escapeHtml(ui.ranking)}</h2><div class="table-wrap"><table><thead><tr><th>#</th><th>${escapeHtml(ui.colIdea)}</th><th>${escapeHtml(ui.colScore)}</th><th>${escapeHtml(ui.colDemand)}</th><th>${escapeHtml(ui.colYoy)}</th><th>${escapeHtml(ui.colOutlook)}</th></tr></thead><tbody>${rows}</tbody></table></div>`
    + `<p class="idea-note">${escapeHtml(fill(ui.dataNote, { from: monthLabel(locale, data.from), to: monthLabel(locale, data.to), n: LOCALES.length }))}</p></section>`;
}

/** The ideas hub or one idea as HTML: the client mounts it as is, and the Worker serves it to crawlers. */
export function ideasPageHtml(locale: Locale, id: IdeaId | null): string {
  const ui = ideasUi(locale);
  const hub = ideasHub(locale);
  const groupLabels = hub.groups as Record<string, string>;
  if (!id) {
    const jump = [
      `<a href="#ranking">${escapeHtml(ui.ranking)}</a>`,
      ...IDEA_GROUPS.map((group) => `<a href="#${group.id}">${escapeHtml(groupLabels[group.id])}</a>`),
      `<a href="#method">${escapeHtml(ui.method)}</a>`,
    ].join(" · ");
    const groups = IDEA_GROUPS.map((group) => (
      `<section class="wall" id="${group.id}"><h2>${escapeHtml(groupLabels[group.id])} <span class="pill">${escapeHtml(fill(ui.count, { n: group.entries.length }))}</span></h2>`
      + `${linkListHtml(ideaLinkItems(locale, group.entries))}</section>`
    )).join("");
    return [
      crumbHtml(locale, null),
      `<header class="tool-head"><h1>${escapeHtml(hub.h1)}</h1><p class="lede">${escapeHtml(hub.lede)}</p></header>`,
      `<p class="slang-jump">${jump}</p>`,
      `<p class="slang-jump"><a href="${escapeHtml(appHref(locale, "idea-validator"))}" data-nav="idea-validator">${escapeHtml(ui.validate)}</a></p>`,
      rankingHtml(locale),
      groups,
      `<section class="kb-about idea-method" id="method"><h2>${escapeHtml(hub.method.h)}</h2><ul>${hub.method.items.map((p) => `<li>${inline(p)}</li>`).join("")}</ul><p class="idea-note">${escapeHtml(ui.disclaimer)}</p></section>`,
      `<section class="kb-about">${hub.about.map((p) => `<p>${inline(p)}</p>`).join("")}</section>`,
      faqHtml(locale, null),
    ].join("");
  }
  const copy = ideaCopy(locale, id);
  const meta = IDEA_META[id];
  const toc = copy.sections.map((s, i) => `<li><a href="#idea-${i + 1}">${inline(s.h)}</a></li>`).join("");
  const sections = copy.sections.map((s, i) => (
    `<section class="kb-section" id="idea-${i + 1}"><h2>${inline(s.h)}</h2>${s.body.map(blockHtml).join("")}</section>`
  )).join("");
  const startup = { 1: ui.startup1, 2: ui.startup2, 3: ui.startup3 }[meta.startup];
  const where = meta.where === "online" ? ui.online : ui.local;
  const colon = CJK.has(locale) ? "：" : ": ";
  return [
    crumbHtml(locale, id),
    `<article class="kb idea">`,
    `<header class="tool-head"><p class="kicker">${escapeHtml(ui.kicker)} · ${escapeHtml(groupLabels[ideaGroupOf(id)])} · ${escapeHtml(where)}</p>`,
    `<h1>${escapeHtml(copy.h1)}</h1>`,
    `<p class="kb-meta"><span>${escapeHtml(ui.startup)}${colon}${escapeHtml(startup)}</span> · <time datetime="${ideaModified(id)}">${escapeHtml(fill(ui.updated, { date: dateLabel(locale, ideaModified(id)) }))}</time></p>`,
    `</header>`,
    `<section class="kb-answer" aria-label="${escapeHtml(ui.answer)}"><h2>${escapeHtml(ui.answer)}</h2><p>${inline(copy.answer)}</p></section>`,
    panelHtml(locale, id),
    `<p class="slang-jump"><a href="${escapeHtml(`${appHref(locale, "idea-validator")}?idea=${id}`)}" data-nav="idea-validator">${escapeHtml(ui.validateIdea)}</a></p>`,
    `<nav class="kb-toc" aria-label="${escapeHtml(ui.toc)}"><h2>${escapeHtml(ui.toc)}</h2><ol>${toc}</ol></nav>`,
    sections,
    faqHtml(locale, id),
    sourcesHtml(locale, id),
    meta.related.length ? `<section class="learn-related"><h2>${escapeHtml(ui.related)}</h2>${linkListHtml(ideaLinkItems(locale, meta.related))}</section>` : "",
    `<p class="more"><a href="${escapeHtml(ideasHref(locale))}" data-nav="ideas">${escapeHtml(ui.all)}</a></p>`,
    `</article>`,
  ].join("");
}

