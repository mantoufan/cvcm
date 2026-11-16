import type { Locale } from "./locale";
import { escapeHtml } from "./device-i18n";
import { fill } from "./fill";
import { PUBLISHER, blockHtml, dateLabel, inline, linkListHtml, type KbBlock } from "./kb-i18n";
import { messages, nostalgiaEntryMessages, nostalgiaMessages, type NostalgiaMessages } from "./messages";
import { appHref, gamesHref, nostalgiaHref } from "./path";
import {
  NOSTALGIA_ENTRIES,
  NOSTALGIA_GROUPS,
  NOSTALGIA_LINKS,
  nostalgiaGroupOf,
  nostalgiaPublished,
  nostalgiaUpdated,
  type NostalgiaId,
} from "./nostalgia";
import { HREFLANG } from "./sitemap";
import type { NostalgiaMeta } from "./nostalgia-meta";

/** One entry's copy, `src/locales/nostalgia/<locale>/<id>.json`. Blocks are the kb blocks. */
export type NostalgiaEntryCopy = {
  name: string;
  blurb: string;
  aka: string[];
  /** Without the " — cv.cm" suffix (nostalgiaTitle adds it). */
  title: string;
  description: string;
  h1: string;
  answer: string;
  sections: { h: string; body: KbBlock[] }[];
  faq: { q: string; a: string }[];
};

const ORIGIN = "https://cv.cm";

/** The decades the hub groups entries by, from each entry's `from`. */
export const NOSTALGIA_DECADES = ["1980s", "1990s", "2000s"] as const;
export type NostalgiaDecade = (typeof NOSTALGIA_DECADES)[number];

export type NostalgiaUi = NostalgiaMessages["ui"];

export function nostalgiaUi(locale: Locale): NostalgiaUi {
  return nostalgiaMessages(locale).ui;
}

export function nostalgiaHub(locale: Locale): NostalgiaMessages["hub"] {
  return nostalgiaMessages(locale).hub;
}

export function nostalgiaCopy(locale: Locale, id: NostalgiaId): NostalgiaEntryCopy {
  return nostalgiaEntryMessages(locale, id);
}

/** Name and one-line blurb from the nostalgia pack (`npm run nostalgia:sync`), so lists never load entry chunks. */
export function nostalgiaName(locale: Locale, id: NostalgiaId): { name: string; blurb: string } {
  return nostalgiaMessages(locale).list[id];
}

export function nostalgiaTitle(locale: Locale, id: NostalgiaId | null): string {
  return `${id ? nostalgiaCopy(locale, id).title : nostalgiaHub(locale).title} — cv.cm`;
}

export function nostalgiaDescription(locale: Locale, id: NostalgiaId | null): string {
  return id ? nostalgiaCopy(locale, id).description : fill(nostalgiaHub(locale).description, { n: NOSTALGIA_ENTRIES.length });
}

export function nostalgiaFaqItems(locale: Locale, id: NostalgiaId | null): { q: string; a: string }[] {
  return id ? nostalgiaCopy(locale, id).faq : nostalgiaHub(locale).faq;
}

/**
 * Still sold without a break: the only status a page may describe as lasting "to today". A revived item (QQ秀,
 * 北冰洋, Nokia 3310) had a gap, so it reads "from X" with its "brought back" status and gets no interval.
 */
function stillAround(status: NostalgiaMeta["status"]): boolean {
  return status === "available";
}

/** An entry's years, status, related ids and sources, from the nostalgia pack. */
export function nostalgiaMeta(locale: Locale, id: NostalgiaId): NostalgiaMeta {
  return nostalgiaMessages(locale).meta[id];
}

/**
 * The childhood decade an entry belongs to on the hub: the decade it appeared in, with anything older (ration coupons,
 * cassettes, White Rabbit, marbles) under the 1980s, the earliest childhoods the channel covers.
 */
export function nostalgiaDecade(locale: Locale, id: NostalgiaId): NostalgiaDecade {
  const year = Number.parseInt(nostalgiaMeta(locale, id).from, 10);
  if (year < 1990) return "1980s";
  if (year < 2000) return "1990s";
  return "2000s";
}

/** "1983" → "1983", "1990s" → the locale's decade label, so years read naturally in every language. */
function yearLabel(locale: Locale, value: string): string {
  const decade = /^(\d{4})s$/.exec(value);
  return decade ? fill(nostalgiaUi(locale).decade, { y: decade[1] }) : value;
}

/** First letter upper-cased, for labels that start a line ("los años 1990" → "Los años 1990"); CJK is unchanged. */
function capitalize(locale: Locale, text: string): string {
  return text.charAt(0).toLocaleUpperCase(HREFLANG[locale]) + text.slice(1);
}

export function nostalgiaYears(locale: Locale, id: NostalgiaId): string {
  return capitalize(locale, yearsText(locale, id));
}

/** "1983–2003", "1983 to today" (still sold, never stopped) or "from 1991" (anything else with no end year), shown under the heading. */
function yearsText(locale: Locale, id: NostalgiaId): string {
  const { from, to, status } = nostalgiaMeta(locale, id);
  const ui = nostalgiaUi(locale);
  if (to) return fill(ui.years, { from: yearLabel(locale, from), to: yearLabel(locale, to) });
  // "To today" only for things still sold without a break (stillAround); anything else without an end year (a revived
  // QQ秀, a discontinued VCD, a 2000s fad, an old game) shows just its start.
  return fill(stillAround(status) ? ui.since : ui.from, { from: yearLabel(locale, from) });
}

function statusLabel(locale: Locale, id: NostalgiaId): string | null {
  const status = nostalgiaMeta(locale, id).status;
  if (!status) return null;
  const ui = nostalgiaUi(locale);
  return { available: ui.statusAvailable, revived: ui.statusRevived, discontinued: ui.statusDiscontinued }[status];
}

const CJK = new Set<Locale>(["zh-CN", "zh-TW", "ja"]);

function crumbHtml(locale: Locale, id: NostalgiaId | null): string {
  const m = nostalgiaMessages(locale);
  const sep = ` <span aria-hidden="true">/</span> `;
  const parts = [
    `<a href="${escapeHtml(appHref(locale, null))}" data-nav="home">${escapeHtml(m.crumbHome)}</a>`,
    id
      ? `<a href="${escapeHtml(nostalgiaHref(locale))}" data-nav="nostalgia">${escapeHtml(m.hub.h1)}</a>`
      : `<span>${escapeHtml(m.hub.h1)}</span>`,
  ];
  if (id) parts.push(`<span>${escapeHtml(nostalgiaName(locale, id).name)}</span>`);
  return `<nav class="device-crumb" aria-label="${escapeHtml(messages(locale).ui.nav.breadcrumb)}">${parts.join(sep)}</nav>`;
}

function faqHtml(locale: Locale, id: NostalgiaId | null): string {
  const items = nostalgiaFaqItems(locale, id).map((item, index) => (
    `<details${index === 0 ? " open" : ""}><summary>${inline(item.q)}</summary><p>${inline(item.a)}</p></details>`
  )).join("");
  return `<section class="faq" aria-labelledby="faq-title"><h2 id="faq-title">${escapeHtml(nostalgiaUi(locale).faq)}</h2>${items}</section>`;
}

export function nostalgiaLinkItems(locale: Locale, ids: readonly NostalgiaId[]): { href: string; name: string; blurb: string; nav: string }[] {
  return ids.map((id) => ({ href: nostalgiaHref(locale, id), ...nostalgiaName(locale, id), nav: `nostalgia-${id}` }));
}

function sourcesHtml(locale: Locale, id: NostalgiaId): string {
  const sources = nostalgiaMeta(locale, id).sources;
  if (!sources.length) return "";
  const items = sources.map((s) => `<li><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.name)}</a></li>`).join("");
  return `<section class="learn-related"><h2>${escapeHtml(nostalgiaUi(locale).sources)}</h2><ul>${items}</ul></section>`;
}

/** Tools and game consoles on cv.cm that go with an entry (play Famicom games in the page, record yourself like a repeater). */
function playHtml(locale: Locale, id: NostalgiaId): string {
  const links = NOSTALGIA_LINKS[id];
  if (!links) return "";
  const ui = messages(locale).ui;
  const consoles = ui.games.consoles as Record<string, string>;
  const tools = ui.tools as unknown as Record<string, { name: string; blurb: string }>;
  const items = [
    ...(links.consoles ?? []).map((c) => ({ href: gamesHref(locale, c, null), name: consoles[c], blurb: nostalgiaUi(locale).playConsole, nav: `games-${c}` })),
    ...(links.tools ?? []).map((tool) => ({ href: appHref(locale, tool), name: tools[tool].name, blurb: tools[tool].blurb, nav: tool })),
  ];
  return `<section class="learn-related"><h2>${escapeHtml(nostalgiaUi(locale).play)}</h2>${linkListHtml(items)}</section>`;
}

/**
 * "Did you have one?": a question and two buttons, hidden until the client wires them (`.ready`, styles.css) and always
 * in the Worker's prerendered copy (`.page.ssr`), so no reader meets buttons that do nothing. Nothing is fetched at mount; the client
 * (nostalgia/ui.ts) posts an
 * answer on click and shows the share that the API returns, or the reader's earlier answer from this browser.
 */
function voteHtml(locale: Locale, id: NostalgiaId): string {
  const vote = nostalgiaUi(locale).vote;
  const group = nostalgiaGroupOf(id);
  return `<section class="nostalgia-vote" aria-labelledby="nostalgia-vote-title"><h2 id="nostalgia-vote-title">${escapeHtml(vote.title)}</h2>`
    + `<p>${escapeHtml(vote.ask[group])}</p>`
    + `<p class="nostalgia-vote-buttons"><button type="button" class="btn ghost" data-answer="yes">${escapeHtml(vote.yes[group])}</button> `
    + `<button type="button" class="btn ghost" data-answer="no">${escapeHtml(vote.no)}</button></p>`
    + `<p class="nostalgia-vote-result" aria-live="polite" hidden></p>`
    + `<p class="meme-note">${escapeHtml(vote.note)}</p></section>`;
}

/** The share line after answering: "73% chose “I ate it” · 1,234 answers". */
export function nostalgiaVoteResult(locale: Locale, id: NostalgiaId, tally: { yes: number; no: number }): string {
  const vote = nostalgiaUi(locale).vote;
  const n = tally.yes + tally.no;
  // Never 0% or 100% while the other answer has votes: a reader who just said "No" must not vanish from the share.
  const raw = n ? Math.round((tally.yes / n) * 100) : 0;
  const p = tally.yes && tally.no ? Math.min(99, Math.max(1, raw)) : raw;
  return fill(vote.result, { p, n: n.toLocaleString(HREFLANG[locale]), yes: vote.yes[nostalgiaGroupOf(id)] });
}

/** The nostalgia hub or one entry as HTML: the client mounts it as is, and the Worker serves it to crawlers. */
export function nostalgiaPageHtml(locale: Locale, id: NostalgiaId | null): string {
  const ui = nostalgiaUi(locale);
  const hub = nostalgiaHub(locale);
  const groupLabels = hub.groups as Record<string, string>;
  if (!id) {
    const decades = NOSTALGIA_DECADES
      .map((decade) => ({ decade, ids: NOSTALGIA_ENTRIES.filter((entry) => nostalgiaDecade(locale, entry) === decade) }))
      .filter((d) => d.ids.length);
    const jump = [
      ...NOSTALGIA_GROUPS.map((group) => `<a href="#${group.id}">${escapeHtml(groupLabels[group.id])}</a>`),
      ...decades.map((d) => `<a href="#d${d.decade}">${escapeHtml(capitalize(locale, yearLabel(locale, d.decade)))}</a>`),
    ].join(" · ");
    const groups = NOSTALGIA_GROUPS.map((group) => (
      `<section class="wall" id="${group.id}"><h2>${escapeHtml(groupLabels[group.id])} <span class="pill">${escapeHtml(fill(ui.count, { n: group.entries.length }))}</span></h2>`
      + `${linkListHtml(nostalgiaLinkItems(locale, group.entries))}</section>`
    )).join("");
    // By decade: plain name links (the blurbs are in the group lists above), so the hub also answers "things from the 90s".
    const byDecade = decades.map((d) => (
      `<section class="wall" id="d${d.decade}"><h2>${escapeHtml(fill(ui.byDecade, { decade: yearLabel(locale, d.decade) }))}</h2>`
      + `<p class="slang-jump">${d.ids.map((entry) => `<a href="${escapeHtml(nostalgiaHref(locale, entry))}" data-nav="nostalgia-${entry}">${escapeHtml(nostalgiaName(locale, entry).name)}</a>`).join(" · ")}</p></section>`
    )).join("");
    return [
      crumbHtml(locale, null),
      `<header class="tool-head"><h1>${escapeHtml(hub.h1)}</h1><p class="lede">${escapeHtml(hub.lede)}</p></header>`,
      `<p class="slang-jump">${jump}</p>`,
      groups,
      byDecade,
      `<section class="kb-about">${hub.about.map((p) => `<p>${inline(p)}</p>`).join("")}</section>`,
      faqHtml(locale, null),
    ].join("");
  }
  const copy = nostalgiaCopy(locale, id);
  const meta = nostalgiaMeta(locale, id);
  const cjk = CJK.has(locale);
  const status = statusLabel(locale, id);
  const toc = copy.sections.map((s, i) => `<li><a href="#nostalgia-${i + 1}">${inline(s.h)}</a></li>`).join("");
  const sections = copy.sections.map((s, i) => (
    `<section class="kb-section" id="nostalgia-${i + 1}"><h2>${inline(s.h)}</h2>${s.body.map(blockHtml).join("")}</section>`
  )).join("");
  const facts = [
    `<span>${escapeHtml(nostalgiaYears(locale, id))}</span>`,
    status ? `<span>${escapeHtml(fill(ui.status, { status }))}</span>` : "",
    `<time datetime="${nostalgiaUpdated(id)}">${escapeHtml(fill(ui.updated, { date: dateLabel(locale, nostalgiaUpdated(id)) }))}</time>`,
  ].filter(Boolean).join(" · ");
  return [
    crumbHtml(locale, id),
    `<article class="kb nostalgia">`,
    `<header class="tool-head"><p class="kicker">${escapeHtml(ui.kicker)} · ${escapeHtml(groupLabels[nostalgiaGroupOf(id)])} · ${escapeHtml({ cn: ui.regionCn, west: ui.regionWest, global: ui.regionGlobal }[meta.region])}</p>`,
    `<h1>${escapeHtml(copy.h1)}</h1>`,
    `<p class="kb-meta">${facts}</p>`,
    copy.aka.length ? `<p class="ref-aka">${escapeHtml(ui.also)}${cjk ? "：" : ": "}${escapeHtml(copy.aka.join(cjk ? "、" : ", "))}</p>` : "",
    `</header>`,
    `<section class="kb-answer" aria-label="${escapeHtml(ui.answer)}"><h2>${escapeHtml(ui.answer)}</h2><p>${inline(copy.answer)}</p></section>`,
    `<nav class="kb-toc" aria-label="${escapeHtml(ui.toc)}"><h2>${escapeHtml(ui.toc)}</h2><ol>${toc}</ol></nav>`,
    sections,
    playHtml(locale, id),
    faqHtml(locale, id),
    sourcesHtml(locale, id),
    meta.related.length ? `<section class="learn-related"><h2>${escapeHtml(ui.related)}</h2>${linkListHtml(nostalgiaLinkItems(locale, meta.related))}</section>` : "",
    // Last in the article: it appears only once the client wires it, so nothing below it moves.
    voteHtml(locale, id),
    `<p class="more"><a href="${escapeHtml(nostalgiaHref(locale))}" data-nav="nostalgia">${escapeHtml(ui.all)}</a></p>`,
    `</article>`,
  ].join("");
}

export function nostalgiaBreadcrumbJsonLd(locale: Locale, id: NostalgiaId | null): Record<string, unknown> {
  const m = nostalgiaMessages(locale);
  const items = [
    { name: m.crumbHome, item: `${ORIGIN}${appHref(locale, null)}` },
    { name: m.hub.h1, item: `${ORIGIN}${nostalgiaHref(locale)}` },
  ];
  if (id) items.push({ name: nostalgiaName(locale, id).name, item: `${ORIGIN}${nostalgiaHref(locale, id)}` });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, ...item })),
  };
}

export function nostalgiaFaqJsonLd(locale: Locale, id: NostalgiaId | null): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: nostalgiaFaqItems(locale, id).map((item) => ({
      "@type": "Question",
      name: item.q.replaceAll("`", ""),
      acceptedAnswer: { "@type": "Answer", text: item.a.replaceAll("`", "") },
    })),
  };
}

/**
 * temporalCoverage as an ISO 8601 interval, only where the page states it: "1983/.." while it is still sold without a
 * break, "1983/2003" for a known run that is over (never for a revived item, which had a gap). Without an end year (a fad, a corner shop, a VCD
 * whose last year is undocumented) there is none: a lone year or decade would claim it existed only then.
 */
function coverage(locale: Locale, id: NostalgiaId): string | null {
  const { from, to, status } = nostalgiaMeta(locale, id);
  const start = from.slice(0, 4);
  if (stillAround(status)) return to ? null : `${start}/..`;
  // Revived after a gap (and Nokia 3310's known first run, then a remake): neither open nor closed, so none.
  if (!to || status === "revived") return null;
  return `${start}/${/^\d{4}s$/.test(to) ? Number(to.slice(0, 4)) + 9 : to}`;
}

/** Other names for the Thing: the original term and the copy's aka, without repeating the name; omitted when empty. */
function alternateNames(term: string, copy: NostalgiaEntryCopy): { alternateName?: string[] } {
  const names = [...new Set([term, ...copy.aka])].filter((n) => n !== copy.name);
  return names.length ? { alternateName: names } : {};
}

/** Article about a Thing for an entry; CollectionPage with an ItemList of every entry for the hub. */
export function nostalgiaArticleJsonLd(locale: Locale, id: NostalgiaId | null): Record<string, unknown> {
  if (!id) {
    const hub = nostalgiaHub(locale);
    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: hub.h1,
      description: nostalgiaDescription(locale, null),
      url: `${ORIGIN}${nostalgiaHref(locale)}`,
      inLanguage: HREFLANG[locale],
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: NOSTALGIA_ENTRIES.length,
        itemListElement: NOSTALGIA_ENTRIES.map((entry, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: nostalgiaName(locale, entry).name,
          url: `${ORIGIN}${nostalgiaHref(locale, entry)}`,
        })),
      },
    };
  }
  const copy = nostalgiaCopy(locale, id);
  const url = `${ORIGIN}${nostalgiaHref(locale, id)}`;
  const answer = copy.answer.replaceAll("`", "");
  const meta = nostalgiaMeta(locale, id);
  const period = coverage(locale, id);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: copy.h1,
    description: copy.description,
    abstract: answer,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: HREFLANG[locale],
    datePublished: nostalgiaPublished(id),
    dateModified: nostalgiaUpdated(id),
    author: PUBLISHER,
    publisher: PUBLISHER,
    isAccessibleForFree: true,
    articleSection: (nostalgiaHub(locale).groups as Record<string, string>)[nostalgiaGroupOf(id)],
    ...(period ? { temporalCoverage: period } : {}),
    about: {
      "@type": "Thing",
      name: copy.name,
      description: answer,
      ...alternateNames(meta.term, copy),
    },
    ...(meta.sources.length ? { citation: meta.sources.map((s) => ({ "@type": "CreativeWork", name: s.name, url: s.url })) } : {}),
  };
}
