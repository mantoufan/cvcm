/**
 * The summaries page HTML (hub and works), shared by the client page and the Worker's crawler copy. Kept out of
 * summaries-i18n so the main bundle, which needs only titles, descriptions and JSON-LD, does not carry it.
 */
import type { Locale } from "./locale";
import { escapeHtml } from "./device-i18n";
import { fill } from "./fill";
import { blockHtml, dateLabel, inline, linkListHtml } from "./article-html";
import { messages, summariesMessages } from "./messages";
import { appHref, summariesHref } from "./path";
import { SUMMARY_GROUPS, summaryGroupOf, summaryUpdated, type SummaryId } from "./summaries";
import { summariesUi, summariesHub, summaryCopy, summaryName, summariesFaqItems, summaryMeta, summaryCreators } from "./summaries-i18n";

const CJK = new Set<Locale>(["zh-CN", "zh-TW", "ja"]);

function crumbHtml(locale: Locale, id: SummaryId | null): string {
  const m = summariesMessages(locale);
  const sep = ` <span aria-hidden="true">/</span> `;
  const parts = [
    `<a href="${escapeHtml(appHref(locale, null))}" data-nav="home">${escapeHtml(m.crumbHome)}</a>`,
    id
      ? `<a href="${escapeHtml(summariesHref(locale))}" data-nav="summaries">${escapeHtml(m.hub.h1)}</a>`
      : `<span>${escapeHtml(m.hub.h1)}</span>`,
  ];
  if (id) parts.push(`<span>${escapeHtml(summaryName(locale, id).name)}</span>`);
  return `<nav class="device-crumb" aria-label="${escapeHtml(messages(locale).ui.nav.breadcrumb)}">${parts.join(sep)}</nav>`;
}

function faqHtml(locale: Locale, id: SummaryId | null): string {
  const items = summariesFaqItems(locale, id).map((item, index) => (
    `<details${index === 0 ? " open" : ""}><summary>${inline(item.q)}</summary><p>${inline(item.a)}</p></details>`
  )).join("");
  return `<section class="faq" aria-labelledby="faq-title"><h2 id="faq-title">${escapeHtml(summariesUi(locale).faq)}</h2>${items}</section>`;
}

/** "1603", "2016–2025" for a finished series, "2022–present" for one still running. */
export function summaryYears(locale: Locale, id: SummaryId): string {
  const { kind, year, end } = summaryMeta(locale, id);
  const ui = summariesUi(locale);
  if (kind !== "series" && kind !== "anime-series") return year;
  if (end && end !== year) return fill(ui.years, { from: year, to: end });
  return end ? year : fill(ui.ongoing, { from: year });
}

/** List items with "creator · year" above the name, for the hub and related links. */
export function summaryLinkItems(locale: Locale, ids: readonly SummaryId[]): { href: string; name: string; blurb: string; meta: string; nav: string }[] {
  return ids.map((id) => ({
    href: summariesHref(locale, id),
    ...summaryName(locale, id),
    meta: `${summaryCreators(locale, summaryMeta(locale, id).creator)} · ${summaryYears(locale, id)}`,
    nav: `summaries-${id}`,
  }));
}

function sourcesHtml(locale: Locale, id: SummaryId): string {
  const sources = summaryMeta(locale, id).sources;
  if (!sources.length) return "";
  const items = sources.map((s) => `<li><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.name)}</a></li>`).join("");
  return `<section class="learn-related"><h2>${escapeHtml(summariesUi(locale).sources)}</h2><ul>${items}</ul></section>`;
}

/**
 * "Did you get it?": each question with its three options in plain view and the answer in a closed <details>, so it
 * works without script and the answer is one click away. Not in JSON-LD.
 */
function checkHtml(locale: Locale, id: SummaryId): string {
  const ui = summariesUi(locale);
  const items = summaryCopy(locale, id).check.map((item) => (
    `<li><p class="summary-q">${inline(item.q)}</p>`
    + `<ol class="summary-options" type="A">${item.options.map((o) => `<li>${inline(o)}</li>`).join("")}</ol>`
    + `<details><summary>${escapeHtml(ui.checkShow)}</summary>`
    + `<p><strong>${escapeHtml(fill(ui.checkAnswer, { option: item.options[item.answer] ?? "" }))}</strong> ${inline(item.why)}</p></details></li>`
  )).join("");
  return `<section class="summary-check" aria-labelledby="summary-check-title"><h2 id="summary-check-title">${escapeHtml(ui.check)}</h2>`
    + `<p>${escapeHtml(ui.checkLede)}</p><ol>${items}</ol></section>`;
}

/** The summaries hub or one work as HTML: the client mounts it as is, and the Worker serves it to crawlers. */
export function summariesPageHtml(locale: Locale, id: SummaryId | null): string {
  const ui = summariesUi(locale);
  const hub = summariesHub(locale);
  const groupLabels = hub.groups as Record<string, string>;
  if (!id) {
    const jump = SUMMARY_GROUPS.map((group) => `<a href="#${group.id}">${escapeHtml(groupLabels[group.id])}</a>`).join(" · ");
    const groups = SUMMARY_GROUPS.map((group) => (
      `<section class="wall" id="${group.id}"><h2>${escapeHtml(groupLabels[group.id])} <span class="pill">${escapeHtml(fill(ui.count, { n: group.entries.length }))}</span></h2>`
      + `${linkListHtml(summaryLinkItems(locale, group.entries))}</section>`
    )).join("");
    return [
      crumbHtml(locale, null),
      `<header class="tool-head"><h1>${escapeHtml(hub.h1)}</h1><p class="lede">${escapeHtml(hub.lede)}</p></header>`,
      `<p class="slang-jump">${jump}</p>`,
      groups,
      `<section class="kb-about">${hub.about.map((p) => `<p>${inline(p)}</p>`).join("")}</section>`,
      faqHtml(locale, null),
    ].join("");
  }
  const copy = summaryCopy(locale, id);
  const meta = summaryMeta(locale, id);
  const cjk = CJK.has(locale);
  const kinds = ui.kinds as Record<string, string>;
  const badge = `<span class="pill summary-spoiler">${escapeHtml(ui.spoiler)}</span>`;
  const firstSpoiler = copy.sections.findIndex((s) => s.spoiler);
  const toc = copy.sections.map((s, i) => `<li><a href="#summary-${i + 1}">${inline(s.h)}</a></li>`).join("");
  // Spoiler sections stay open and indexable (readers come for the ending): a badge on each, one warning before the first.
  const sections = copy.sections.map((s, i) => (
    (i === firstSpoiler ? `<aside class="kb-note"><p>${escapeHtml(ui.spoilerNote)}</p></aside>` : "")
    + `<section class="kb-section" id="summary-${i + 1}"><h2>${inline(s.h)}${s.spoiler ? ` ${badge}` : ""}</h2>${s.body.map(blockHtml).join("")}</section>`
  )).join("");
  const facts = [
    `<span>${escapeHtml(summaryCreators(locale, meta.creator))}</span>`,
    `<span>${escapeHtml(summaryYears(locale, id))}</span>`,
    meta.original && meta.original !== copy.name ? `<span>${escapeHtml(fill(ui.original, { title: meta.original }))}</span>` : "",
    `<time datetime="${summaryUpdated(id)}">${escapeHtml(fill(ui.updated, { date: dateLabel(locale, summaryUpdated(id)) }))}</time>`,
  ].filter(Boolean).join(" · ");
  // The original title already has its own line in the facts above.
  const aka = copy.aka.filter((a) => a !== copy.name && a !== meta.original);
  return [
    crumbHtml(locale, id),
    `<article class="kb summary">`,
    // A film or TV series kind only restates its group ("Movies · Film"); books and anime keep it (play vs novel, series vs film).
    `<header class="tool-head"><p class="kicker">${[ui.kicker, groupLabels[summaryGroupOf(id)], ...(meta.kind === "film" || meta.kind === "series" ? [] : [kinds[meta.kind] ?? meta.kind])].map(escapeHtml).join(" · ")}</p>`,
    `<h1>${escapeHtml(copy.h1)}</h1>`,
    `<p class="kb-meta">${facts}</p>`,
    aka.length ? `<p class="ref-aka">${escapeHtml(ui.also)}${cjk ? "：" : ": "}${escapeHtml(aka.join(cjk ? "、" : ", "))}</p>` : "",
    `</header>`,
    `<section class="kb-answer" aria-label="${escapeHtml(ui.answer)}"><h2>${escapeHtml(ui.answer)}</h2><p>${inline(copy.answer)}</p></section>`,
    `<nav class="kb-toc" aria-label="${escapeHtml(ui.toc)}"><h2>${escapeHtml(ui.toc)}</h2><ol>${toc}</ol></nav>`,
    sections,
    checkHtml(locale, id),
    faqHtml(locale, id),
    sourcesHtml(locale, id),
    meta.related.length ? `<section class="learn-related"><h2>${escapeHtml(ui.related)}</h2>${linkListHtml(summaryLinkItems(locale, meta.related))}</section>` : "",
    `<p class="more"><a href="${escapeHtml(summariesHref(locale))}" data-nav="summaries">${escapeHtml(ui.all)}</a></p>`,
    `</article>`,
  ].join("");
}
