import type { Locale } from "./locale";
import { escapeHtml } from "./device-i18n";
import { fill } from "./fill";
import { PUBLISHER, blockHtml, dateLabel, inline, linkListHtml, type KbBlock } from "./kb-i18n";
import { slangEntryMessages, slangMessages, type SlangMessages } from "./messages";
import { appHref, slangHref } from "./path";
import { SLANG_GROUPS, SLANG_META, SLANG_PUBLISHED, SLANG_UPDATED, slangGroupOf, type SlangId } from "./slang";
import { HREFLANG } from "./sitemap";

/** One entry's copy, `src/locales/slang/<locale>/<id>.json`. Blocks are the kb blocks (backticks are the only inline markup). */
export type SlangEntryCopy = {
  name: string;
  blurb: string;
  aka: string[];
  /** Without the " — cv.cm" suffix (slangTitle adds it). */
  title: string;
  description: string;
  h1: string;
  answer: string;
  sections: { h: string; body: KbBlock[] }[];
  faq: { q: string; a: string }[];
};

const ORIGIN = "https://cv.cm";

export type SlangUi = SlangMessages["ui"];

export function slangUi(locale: Locale): SlangUi {
  return slangMessages(locale).ui;
}

export function slangHub(locale: Locale): SlangMessages["hub"] {
  return slangMessages(locale).hub;
}

export function slangCopy(locale: Locale, id: SlangId): SlangEntryCopy {
  return slangEntryMessages(locale, id);
}

/** Name and one-line blurb from the slang pack (`npm run slang:sync`), so lists never load entry chunks. */
export function slangName(locale: Locale, id: SlangId): { name: string; blurb: string } {
  return slangMessages(locale).list[id];
}

export function slangTitle(locale: Locale, id: SlangId | null): string {
  return `${id ? slangCopy(locale, id).title : slangHub(locale).title} — cv.cm`;
}

export function slangDescription(locale: Locale, id: SlangId | null): string {
  return id ? slangCopy(locale, id).description : slangHub(locale).description;
}

export function slangFaqItems(locale: Locale, id: SlangId | null): { q: string; a: string }[] {
  return id ? slangCopy(locale, id).faq : slangHub(locale).faq;
}

export function slangUpdated(id: SlangId): string {
  return SLANG_UPDATED[id] ?? SLANG_PUBLISHED;
}

const CJK = new Set<Locale>(["zh-CN", "zh-TW", "ja"]);

function crumbHtml(locale: Locale, id: SlangId | null): string {
  const m = slangMessages(locale);
  const sep = ` <span aria-hidden="true">/</span> `;
  const parts = [
    `<a href="${escapeHtml(appHref(locale, null))}" data-nav="home">${escapeHtml(m.crumbHome)}</a>`,
    id
      ? `<a href="${escapeHtml(slangHref(locale))}" data-nav="slang">${escapeHtml(m.hub.h1)}</a>`
      : `<span>${escapeHtml(m.hub.h1)}</span>`,
  ];
  if (id) parts.push(`<span>${escapeHtml(slangName(locale, id).name)}</span>`);
  return `<nav class="device-crumb" aria-label="${escapeHtml(m.hub.h1)}">${parts.join(sep)}</nav>`;
}

function faqHtml(locale: Locale, id: SlangId | null): string {
  const items = slangFaqItems(locale, id).map((item, index) => (
    `<details${index === 0 ? " open" : ""}><summary>${inline(item.q)}</summary><p>${inline(item.a)}</p></details>`
  )).join("");
  return `<section class="faq" aria-labelledby="faq-title"><h2 id="faq-title">${escapeHtml(slangUi(locale).faq)}</h2>${items}</section>`;
}

export function slangLinkItems(locale: Locale, ids: readonly SlangId[]): { href: string; name: string; blurb: string; nav: string }[] {
  return ids.map((id) => ({ href: slangHref(locale, id), ...slangName(locale, id), nav: `slang-${id}` }));
}

function sourcesHtml(locale: Locale, id: SlangId): string {
  const sources = SLANG_META[id].sources;
  if (!sources.length) return "";
  const items = sources.map((s) => `<li><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.name)}</a></li>`).join("");
  return `<section class="learn-related"><h2>${escapeHtml(slangUi(locale).sources)}</h2><ul>${items}</ul></section>`;
}

/** The slang hub or one entry as HTML: the client mounts it as is, and the Worker serves it to crawlers. */
export function slangPageHtml(locale: Locale, id: SlangId | null): string {
  const ui = slangUi(locale);
  const hub = slangHub(locale);
  const groupLabels = hub.groups as Record<string, string>;
  if (!id) {
    const jump = SLANG_GROUPS.map((group) => `<a href="#${group.id}">${escapeHtml(groupLabels[group.id])}</a>`).join(" · ");
    const groups = SLANG_GROUPS.map((group) => (
      `<section class="wall" id="${group.id}"><h2>${escapeHtml(groupLabels[group.id])} <span class="pill">${escapeHtml(fill(ui.count, { n: group.entries.length }))}</span></h2>`
      + `${linkListHtml(slangLinkItems(locale, group.entries))}</section>`
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
  const copy = slangCopy(locale, id);
  const meta = SLANG_META[id];
  const cjk = CJK.has(locale);
  const toc = copy.sections.map((s, i) => `<li><a href="#slang-${i + 1}">${inline(s.h)}</a></li>`).join("");
  const sections = copy.sections.map((s, i) => (
    `<section class="kb-section" id="slang-${i + 1}"><h2>${inline(s.h)}</h2>${s.body.map(blockHtml).join("")}</section>`
  )).join("");
  const origin = { zh: ui.originZh, en: ui.originEn, yue: ui.originYue }[meta.origin];
  return [
    crumbHtml(locale, id),
    `<article class="kb slang">`,
    `<header class="tool-head"><p class="kicker">${escapeHtml(ui.kicker)} · ${escapeHtml(groupLabels[slangGroupOf(id)])} · ${escapeHtml(origin)}</p>`,
    `<h1>${escapeHtml(copy.h1)}</h1>`,
    `<p class="kb-meta"><time datetime="${slangUpdated(id)}">${escapeHtml(fill(ui.updated, { date: dateLabel(locale, slangUpdated(id)) }))}</time></p>`,
    copy.aka.length ? `<p class="ref-aka">${escapeHtml(ui.also)}${cjk ? "：" : ": "}${escapeHtml(copy.aka.join(cjk ? "、" : ", "))}</p>` : "",
    `</header>`,
    `<section class="kb-answer" aria-label="${escapeHtml(ui.answer)}"><h2>${escapeHtml(ui.answer)}</h2><p>${inline(copy.answer)}</p></section>`,
    `<nav class="kb-toc" aria-label="${escapeHtml(ui.toc)}"><h2>${escapeHtml(ui.toc)}</h2><ol>${toc}</ol></nav>`,
    sections,
    faqHtml(locale, id),
    sourcesHtml(locale, id),
    meta.related.length ? `<section class="learn-related"><h2>${escapeHtml(ui.related)}</h2>${linkListHtml(slangLinkItems(locale, meta.related))}</section>` : "",
    `<p class="more"><a href="${escapeHtml(slangHref(locale))}" data-nav="slang">${escapeHtml(ui.all)}</a></p>`,
    `</article>`,
  ].join("");
}

export function slangBreadcrumbJsonLd(locale: Locale, id: SlangId | null): Record<string, unknown> {
  const m = slangMessages(locale);
  const items = [
    { name: m.crumbHome, item: `${ORIGIN}${appHref(locale, null)}` },
    { name: m.hub.h1, item: `${ORIGIN}${slangHref(locale)}` },
  ];
  if (id) items.push({ name: slangName(locale, id).name, item: `${ORIGIN}${slangHref(locale, id)}` });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, ...item })),
  };
}

export function slangFaqJsonLd(locale: Locale, id: SlangId | null): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: slangFaqItems(locale, id).map((item) => ({
      "@type": "Question",
      name: item.q.replaceAll("`", ""),
      acceptedAnswer: { "@type": "Answer", text: item.a.replaceAll("`", "") },
    })),
  };
}

/** The dictionary as a DefinedTermSet (its id is the hub URL), so every entry's DefinedTerm can point back to it. */
function termSetRef(locale: Locale): Record<string, unknown> {
  return { "@type": "DefinedTermSet", "@id": `${ORIGIN}${slangHref(locale)}#terms`, name: slangHub(locale).h1 };
}

/** Article about a DefinedTerm for an entry; CollectionPage whose main entity is the DefinedTermSet for the hub. */
export function slangArticleJsonLd(locale: Locale, id: SlangId | null): Record<string, unknown> {
  if (!id) {
    const hub = slangHub(locale);
    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: hub.h1,
      description: hub.description,
      url: `${ORIGIN}${slangHref(locale)}`,
      inLanguage: HREFLANG[locale],
      mainEntity: {
        ...termSetRef(locale),
        hasDefinedTerm: SLANG_GROUPS.flatMap((group) => group.entries).map((entry) => ({
          "@type": "DefinedTerm",
          name: slangName(locale, entry).name,
          url: `${ORIGIN}${slangHref(locale, entry)}`,
        })),
      },
    };
  }
  const copy = slangCopy(locale, id);
  const url = `${ORIGIN}${slangHref(locale, id)}`;
  const answer = copy.answer.replaceAll("`", "");
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: copy.h1,
    description: copy.description,
    abstract: answer,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: HREFLANG[locale],
    datePublished: SLANG_PUBLISHED,
    dateModified: slangUpdated(id),
    author: PUBLISHER,
    publisher: PUBLISHER,
    isAccessibleForFree: true,
    articleSection: (slangHub(locale).groups as Record<string, string>)[slangGroupOf(id)],
    about: {
      "@type": "DefinedTerm",
      name: copy.name,
      description: answer,
      ...(copy.aka.length ? { alternateName: copy.aka } : {}),
      inDefinedTermSet: termSetRef(locale),
    },
    ...(SLANG_META[id].sources.length ? { citation: SLANG_META[id].sources.map((s) => ({ "@type": "CreativeWork", name: s.name, url: s.url })) } : {}),
  };
}
