import type { Locale } from "./locale";
import { escapeHtml } from "./device-i18n";
import { fill } from "./fill";
import { kbArticleOf, kbGroupOf, kbGroupsOf, kbMeta, kbMinutesOf, kbShelfOf, kbShelfOfPage, kbUpdatedOn, type KbId, type KbPage, type KbShelf } from "./kb";
import { kbArticleMessages, kbMessages, messages, type KbMessages } from "./messages";
import { HREFLANG } from "./sitemap";
import { appHref, kbHref, learnHref, type ToolId } from "./path";

export type KbBlock =
  | string
  | { ul: string[] }
  | { ol: string[] }
  | { table: { head: string[]; rows: string[][] } }
  | { note: string }
  /** A multi-line code sample, the same in every locale. */
  | { code: string; lang: string };

export type KbSection = { h: string; body: KbBlock[] };

export type KbArticleCopy = {
  title: string;
  description: string;
  h1: string;
  answer: string;
  sections: KbSection[];
  faq: { q: string; a: string }[];
};

export type KbUi = KbMessages["ui"];
export type KbHubCopy = Omit<KbMessages["hub"], "groups"> & { groups: Record<string, string>; kicker?: string; all?: string };

const ORIGIN = "https://cv.cm";

export function kbUi(locale: Locale): KbUi {
  return kbMessages(locale).ui;
}

/** Hub copy of a shelf: `hub` for knowledge, `codeHub` for coding. */
export function kbHub(locale: Locale, shelf: KbShelf = "knowledge"): KbHubCopy {
  const m = kbMessages(locale);
  return shelf === "code" ? m.codeHub : m.hub;
}

export function kbCopy(locale: Locale, id: KbId): KbArticleCopy {
  return kbArticleMessages(locale, id);
}

/** Name and one-line blurb, from the core pack: the tutorial hub and tool pages list articles without the kb pack. */
export function kbName(locale: Locale, id: KbId): { name: string; blurb: string } {
  return (messages(locale).ui.kb as unknown as Record<KbId, { name: string; blurb: string }>)[id];
}

export function kbTitle(locale: Locale, page: KbPage): string {
  const id = kbArticleOf(page);
  return id ? kbCopy(locale, id).title : kbHub(locale, kbShelfOfPage(page)).title;
}

export function kbDescription(locale: Locale, page: KbPage): string {
  const id = kbArticleOf(page);
  return id ? kbCopy(locale, id).description : kbHub(locale, kbShelfOfPage(page)).description;
}

export function kbFaqItems(locale: Locale, page: KbPage): { q: string; a: string }[] {
  const id = kbArticleOf(page);
  return id ? kbCopy(locale, id).faq : kbHub(locale, kbShelfOfPage(page)).faq;
}


/** When this locale's page last changed (copy or sources), from `npm run kb:sync`. */
export function kbUpdated(locale: Locale, id: KbId): string {
  return kbUpdatedOn(id, locale);
}

/** Reading time in minutes, precomputed by `npm run kb:sync` so lists need no article copy. */
export function kbMinutes(locale: Locale, id: KbId): number {
  return kbMinutesOf(id, locale);
}

/** Plain text with `code` spans; everything else escaped. */
function inline(text: string): string {
  return text.split("`").map((part, i) => (i % 2 ? `<code>${escapeHtml(part)}</code>` : escapeHtml(part))).join("");
}

function blockHtml(block: KbBlock): string {
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
  return shelf === "code" ? "coding" : "knowledge";
}

function hubOf(shelf: KbShelf): KbPage {
  return shelf === "code" ? "code" : "hub";
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
      ? `<a href="${escapeHtml(kbHref(locale, hubOf(shelf)))}" data-nav="${kbHubNav(shelf)}">${escapeHtml(hub.h1)}</a>`
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

function linkListHtml(items: { href: string; name: string; blurb?: string; meta?: string; nav?: string }[]): string {
  return `<ul class="links">${items.map((item) => (
    `<li><a href="${escapeHtml(item.href)}"${item.nav ? ` data-nav="${escapeHtml(item.nav)}"` : ""}>`
    + (item.meta ? `<small>${escapeHtml(item.meta)}</small>` : "")
    + `<strong>${escapeHtml(item.name)}</strong>`
    + (item.blurb ? `<span>${escapeHtml(item.blurb)}</span>` : "")
    + `</a></li>`
  )).join("")}</ul>`;
}

export function kbLinkItems(locale: Locale, ids: readonly KbId[]): { href: string; name: string; blurb: string; nav: string }[] {
  return ids.map((id) => ({ href: kbHref(locale, id), ...kbName(locale, id), nav: `kb-${id}` }));
}

function toolLinkItems(locale: Locale, tools: readonly ToolId[]): { href: string; name: string; blurb: string; nav: string }[] {
  const ui = messages(locale).ui.tools as unknown as Record<string, { name: string; blurb: string }>;
  return tools.map((tool) => ({ href: appHref(locale, tool), name: ui[tool].name, blurb: ui[tool].blurb, nav: tool }));
}

function tutorialLinkItems(locale: Locale, id: KbId): { href: string; name: string; blurb: string; nav: string }[] {
  const learn = messages(locale).ui.learn as unknown as Record<string, { name: string; blurb: string }>;
  return kbMeta(id).tutorials.map((tutorial) => ({ href: learnHref(locale, tutorial), name: learn[tutorial].name, blurb: learn[tutorial].blurb, nav: `learn-${tutorial}` }));
}

function dateLabel(locale: Locale, iso: string): string {
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
  const hubHref = kbHref(locale, hubOf(shelf));
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

export function kbBreadcrumbJsonLd(locale: Locale, page: KbPage): Record<string, unknown> {
  const m = kbMessages(locale);
  const id = kbArticleOf(page);
  const shelf = kbShelfOfPage(page);
  const items = [
    { name: m.crumbHome, item: `${ORIGIN}${appHref(locale, null)}` },
    { name: m.ui.learn, item: `${ORIGIN}${learnHref(locale)}` },
    { name: kbHub(locale, shelf).h1, item: `${ORIGIN}${kbHref(locale, hubOf(shelf))}` },
  ];
  if (id) items.push({ name: kbName(locale, id).name, item: `${ORIGIN}${kbHref(locale, id)}` });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, ...item })),
  };
}

export function kbFaqJsonLd(locale: Locale, page: KbPage): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: kbFaqItems(locale, page).map((item) => ({
      "@type": "Question",
      name: item.q.replaceAll("`", ""),
      acceptedAnswer: { "@type": "Answer", text: item.a.replaceAll("`", "") },
    })),
  };
}

const PUBLISHER = {
  "@type": "Organization",
  name: "cv.cm",
  url: `${ORIGIN}/`,
  logo: { "@type": "ImageObject", url: `${ORIGIN}/favicon-512.png` },
};

/** TechArticle for an article; CollectionPage + ItemList for the hub. */
export function kbArticleJsonLd(locale: Locale, page: KbPage): Record<string, unknown> {
  const id = kbArticleOf(page);
  if (!id) {
    const shelf = kbShelfOfPage(page);
    const hub = kbHub(locale, shelf);
    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: hub.h1,
      description: hub.description,
      url: `${ORIGIN}${kbHref(locale, hubOf(shelf))}`,
      inLanguage: HREFLANG[locale],
      mainEntity: {
        "@type": "ItemList",
        itemListElement: kbGroupsOf(shelf).flatMap((group) => group.articles).map((article, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${ORIGIN}${kbHref(locale, article)}`,
          name: kbName(locale, article).name,
        })),
      },
    };
  }
  const copy = kbCopy(locale, id);
  const meta = kbMeta(id);
  const url = `${ORIGIN}${kbHref(locale, id)}`;
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: copy.h1,
    description: copy.description,
    abstract: copy.answer.replaceAll("`", ""),
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: HREFLANG[locale],
    datePublished: meta.published,
    dateModified: kbUpdated(locale, id),
    author: PUBLISHER,
    publisher: PUBLISHER,
    isAccessibleForFree: true,
    articleSection: kbHub(locale, kbShelfOf(id)).groups[kbGroupOf(id)],
    ...(meta.sources.length ? { citation: meta.sources.map((s) => ({ "@type": "CreativeWork", name: s.title, url: s.href })) } : {}),
  };
}
