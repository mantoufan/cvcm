/**
 * The knowledge-shelf page HTML (hub and articles), shared by the client page and the Worker's crawler copy. Kept out of
 * kb-i18n so the main bundle, which needs only titles, descriptions and JSON-LD, does not carry it; inline, blockHtml,
 * linkListHtml and dateLabel are the block helpers the other article channels reuse.
 */
import type { Locale } from "./locale";
import { escapeHtml } from "./device-i18n";
import { fill } from "./fill";
import { KB_SHELVES, kbArticleOf, kbGroupOf, kbGroupsOf, kbMeta, kbMinutesOf, kbShelfOfPage, type KbId, type KbPage, type KbShelf } from "./kb";
import { kbMessages, messages } from "./messages";
import { HREFLANG } from "./sitemap";
import { appHref, kbHref, learnHref, type ToolId } from "./path";
import { type KbBlock, type KbUi, kbHub, kbCopy, kbName, kbFaqItems, kbUpdated, kbHubOf, kbLinkItems } from "./kb-i18n";

export function kbUi(locale: Locale): KbUi {
  return kbMessages(locale).ui;
}

/** Reading time in minutes, precomputed by `npm run kb:sync` so lists need no article copy. */
export function kbMinutes(locale: Locale, id: KbId): number {
  return kbMinutesOf(id, locale);
}

/** Plain text with `code` spans; everything else escaped. Shared with the ref, slang, nostalgia and ideas page modules. */
export function inline(text: string): string {
  return text.split("`").map((part, i) => (i % 2 ? `<code>${escapeHtml(part)}</code>` : escapeHtml(part))).join("");
}

export function blockHtml(block: KbBlock): string {
  if (typeof block === "string") return `<p>${inline(block)}</p>`;
  if ("ul" in block) return `<ul>${block.ul.map((li) => `<li>${inline(li)}</li>`).join("")}</ul>`;
  if ("ol" in block) return `<ol>${block.ol.map((li) => `<li>${inline(li)}</li>`).join("")}</ol>`;
  if ("table" in block) {
    const head = `<thead><tr>${block.table.head.map((c) => `<th scope="col">${inline(c)}</th>`).join("")}</tr></thead>`;
    const rows = block.table.rows.map((row) => `<tr>${row.map((c, i) => (i === 0 ? `<th scope="row">${inline(c)}</th>` : `<td>${inline(c)}</td>`)).join("")}</tr>`).join("");
    return `<div class="kb-table"><table>${head}<tbody>${rows}</tbody></table></div>`;
  }
  if ("code" in block) return `<pre class="kb-code"><code data-lang="${escapeHtml(block.lang)}">${escapeHtml(block.code)}</code></pre>`;
  return `<aside class="kb-note"><p>${inline(block.note)}</p></aside>`;
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

export function linkListHtml(items: { href: string; name: string; blurb?: string; meta?: string; nav?: string }[]): string {
  return `<ul class="links">${items.map((item) => (
    `<li><a href="${escapeHtml(item.href)}"${item.nav ? ` data-nav="${escapeHtml(item.nav)}"` : ""}>`
    + (item.meta ? `<small>${escapeHtml(item.meta)}</small>` : "")
    + `<strong>${escapeHtml(item.name)}</strong>`
    + (item.blurb ? `<span>${escapeHtml(item.blurb)}</span>` : "")
    + `</a></li>`
  )).join("")}</ul>`;
}

function toolLinkItems(locale: Locale, tools: readonly ToolId[]): { href: string; name: string; blurb: string; nav: string }[] {
  const ui = messages(locale).ui.tools as unknown as Record<string, { name: string; blurb: string }>;
  return tools.map((tool) => ({ href: appHref(locale, tool), name: ui[tool].name, blurb: ui[tool].blurb, nav: tool }));
}

function tutorialLinkItems(locale: Locale, id: KbId): { href: string; name: string; blurb: string; nav: string }[] {
  const learn = messages(locale).ui.learn as unknown as Record<string, { name: string; blurb: string }>;
  return kbMeta(id).tutorials.map((tutorial) => ({ href: learnHref(locale, tutorial), name: learn[tutorial].name, blurb: learn[tutorial].blurb, nav: `learn-${tutorial}` }));
}

export function dateLabel(locale: Locale, iso: string): string {
  try {
    return new Intl.DateTimeFormat(HREFLANG[locale], { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  } catch {
    return iso;
  }
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
