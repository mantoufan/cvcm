/**
 * The knowledge-shelf page HTML (hub and articles), shared by the client page and the Worker's crawler copy. Kept out of
 * kb-i18n so the main bundle, which needs only titles, descriptions and JSON-LD, does not carry it.
 */
import type { Locale } from "./locale";
import { escapeHtml } from "./device-i18n";
import { fill } from "./fill";
import { blockHtml, dateLabel, inline, linkListHtml } from "./article-html";
import { KB_SHELVES, kbArticleOf, kbGroupOf, kbGroupsOf, kbMeta, kbMinutesOf, kbShelfOfPage, type KbId, type KbPage, type KbShelf } from "./kb";
import { kbMessages, messages } from "./messages";
import { appHref, kbHref, learnHref, type ToolId } from "./path";
import { type KbUi, kbHub, kbCopy, kbName, kbFaqItems, kbUpdated, kbHubOf, kbLinkItems } from "./kb-i18n";

export function kbUi(locale: Locale): KbUi {
  return kbMessages(locale).ui;
}

/** Reading time in minutes, precomputed by `npm run kb:sync` so lists need no article copy. */
export function kbMinutes(locale: Locale, id: KbId): number {
  return kbMinutesOf(id, locale);
}

/** data-nav of a shelf's hub links (main.ts prefetches the kb pack on hover). */
export function kbHubNav(shelf: KbShelf): string {
  return KB_SHELVES[shelf].nav;
}

function crumbHtml(locale: Locale, page: KbPage): string {
  const m = kbMessages(locale);
  const id = kbArticleOf(page);
  const shelf = kbShelfOfPage(page);
  const hub = kbHub(locale, shelf);
  const sep = ` <span aria-hidden="true">/</span> `;
  const parts = [
    `<a href="${escapeHtml(appHref(locale, null))}" data-nav="home">${escapeHtml(m.crumbHome)}</a>`,
    `<a href="${escapeHtml(learnHref(locale))}" data-nav="learn">${escapeHtml(m.ui.learn)}</a>`,
    id
      ? `<a href="${escapeHtml(kbHref(locale, kbHubOf(shelf)))}" data-nav="${kbHubNav(shelf)}">${escapeHtml(hub.h1)}</a>`
      : `<span>${escapeHtml(hub.h1)}</span>`,
  ];
  if (id) parts.push(`<span>${escapeHtml(kbName(locale, id).name)}</span>`);
  return `<nav class="device-crumb" aria-label="${escapeHtml(hub.h1)}">${parts.join(sep)}</nav>`;
}

function faqHtml(locale: Locale, page: KbPage): string {
  const items = kbFaqItems(locale, page).map((item, index) => (
    `<details${index === 0 ? " open" : ""}><summary>${inline(item.q)}</summary><p>${inline(item.a)}</p></details>`
  )).join("");
  return `<section class="faq" aria-labelledby="faq-title"><h2 id="faq-title">${escapeHtml(kbUi(locale).faq)}</h2>${items}</section>`;
}

function toolLinkItems(locale: Locale, tools: readonly ToolId[]): { href: string; name: string; blurb: string; nav: string }[] {
  const ui = messages(locale).ui.tools as unknown as Record<string, { name: string; blurb: string }>;
  return tools.map((tool) => ({ href: appHref(locale, tool), name: ui[tool].name, blurb: ui[tool].blurb, nav: tool }));
}

function tutorialLinkItems(locale: Locale, id: KbId): { href: string; name: string; blurb: string; nav: string }[] {
  const learn = messages(locale).ui.learn as unknown as Record<string, { name: string; blurb: string }>;
  return kbMeta(id).tutorials.map((tutorial) => ({ href: learnHref(locale, tutorial), name: learn[tutorial].name, blurb: learn[tutorial].blurb, nav: `learn-${tutorial}` }));
}

/** A kb hub or one article as HTML: the client mounts it as is, and the Worker serves it to crawlers. */
export function kbPageHtml(locale: Locale, page: KbPage): string {
  const ui = kbUi(locale);
  const id = kbArticleOf(page);
  const shelf = kbShelfOfPage(page);
  const hub = kbHub(locale, shelf);
  const hubHref = kbHref(locale, kbHubOf(shelf));
  const nav = kbHubNav(shelf);
  if (!id) {
    const groups = kbGroupsOf(shelf).map((group) => (
      `<section class="wall" id="${group.id}"><h2>${escapeHtml(hub.groups[group.id])}</h2>${linkListHtml(kbLinkItems(locale, group.articles).map((item, i) => ({ ...item, meta: fill(ui.minutes, { n: kbMinutes(locale, group.articles[i]) }) })))}</section>`
    )).join("");
    return [
      crumbHtml(locale, page),
      `<header class="tool-head"><h1>${escapeHtml(hub.h1)}</h1><p class="lede">${escapeHtml(hub.lede)}</p></header>`,
      groups,
      `<section class="kb-about">${hub.about.map((p) => `<p>${inline(p)}</p>`).join("")}</section>`,
      faqHtml(locale, page),
    ].join("");
  }
  const copy = kbCopy(locale, id);
  const meta = kbMeta(id);
  const toc = copy.sections.map((s, i) => `<li><a href="#kb-${i + 1}">${inline(s.h)}</a></li>`).join("");
  const sections = copy.sections.map((s, i) => (
    `<section class="kb-section" id="kb-${i + 1}"><h2>${inline(s.h)}</h2>${s.body.map(blockHtml).join("")}</section>`
  )).join("");
  const [mainTool] = meta.tools;
  const toolName = mainTool ? (messages(locale).ui.tools as unknown as Record<string, { name: string }>)[mainTool].name : "";
  const tutorials = tutorialLinkItems(locale, id);
  return [
    crumbHtml(locale, page),
    `<article class="kb">`,
    `<header class="tool-head"><p class="kicker">${escapeHtml(hub.kicker ?? ui.kicker)} · ${escapeHtml(hub.groups[kbGroupOf(id)])}</p>`,
    `<h1>${escapeHtml(copy.h1)}</h1>`,
    `<p class="kb-meta"><span class="pill">${escapeHtml(fill(ui.minutes, { n: kbMinutes(locale, id) }))}</span> <time datetime="${kbUpdated(locale, id)}">${escapeHtml(fill(ui.updated, { date: dateLabel(locale, kbUpdated(locale, id)) }))}</time></p></header>`,
    `<section class="kb-answer" aria-label="${escapeHtml(ui.answer)}"><h2>${escapeHtml(ui.answer)}</h2><p>${inline(copy.answer)}</p>`,
    mainTool ? `<a class="btn" href="${escapeHtml(appHref(locale, mainTool))}" data-nav="${escapeHtml(mainTool)}">${escapeHtml(fill(ui.open, { name: toolName }))}</a>` : "",
    `</section>`,
    `<nav class="kb-toc" aria-label="${escapeHtml(ui.toc)}"><h2>${escapeHtml(ui.toc)}</h2><ol>${toc}</ol></nav>`,
    sections,
    faqHtml(locale, page),
    meta.tools.length ? `<section class="learn-related"><h2>${escapeHtml(ui.tools)}</h2>${linkListHtml(toolLinkItems(locale, meta.tools))}</section>` : "",
    tutorials.length ? `<section class="learn-related"><h2>${escapeHtml(ui.tutorials)}</h2>${linkListHtml(tutorials)}</section>` : "",
    meta.related.length ? `<section class="learn-related"><h2>${escapeHtml(ui.related)}</h2>${linkListHtml(kbLinkItems(locale, meta.related))}</section>` : "",
    meta.sources.length
      ? `<section class="learn-related kb-sources"><h2>${escapeHtml(ui.sources)}</h2><ul>${meta.sources.map((s) => `<li><a href="${escapeHtml(s.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title)}</a></li>`).join("")}</ul></section>`
      : "",
    `<p class="more"><a href="${escapeHtml(hubHref)}" data-nav="${nav}">${escapeHtml(hub.all ?? ui.all)}</a></p>`,
    `</article>`,
  ].join("");
}
