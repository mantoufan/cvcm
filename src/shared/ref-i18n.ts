import type { Locale } from "./locale";
import { LOCALES } from "./locale";
import { escapeHtml } from "./device-i18n";
import { fill } from "./fill";
import { PUBLISHER, blockHtml, inline, linkListHtml, type KbBlock } from "./kb-i18n";
import { messages, refEntryMessages, refMessages, type RefMessages } from "./messages";
import { appHref, refHref } from "./path";
import { REF_GROUPS, REF_META, REF_PUBLISHED, mfan8Href, refGroupOf, type RefId } from "./ref";
import { HREFLANG } from "./sitemap";

/** One entry's copy, `src/locales/ref/<locale>/<id>.json`. Blocks are the kb blocks (backticks are the only inline markup). */
export type RefEntryCopy = {
  name: string;
  blurb: string;
  aka: string[];
  /** Without the " — cv.cm" suffix (refTitle adds it). */
  title: string;
  description: string;
  h1: string;
  answer: string;
  sections: { h: string; body: KbBlock[] }[];
  faq: { q: string; a: string }[];
};

/** A photo on mfan8.com: image id on s1.mtf6.com, the photo set's page id, its size, and who made it. */
export type RefPhoto = { img: string; item: string; w: number; h: number; photo?: string; model?: string };

const ORIGIN = "https://cv.cm";
const SITE = "mfan8.com";

export type RefUi = RefMessages["ui"];

export function refUi(locale: Locale): RefUi {
  return refMessages(locale).ui;
}

export function refHub(locale: Locale): RefMessages["hub"] {
  return refMessages(locale).hub;
}

export function refCopy(locale: Locale, id: RefId): RefEntryCopy {
  return refEntryMessages(locale, id);
}

/** Name and one-line blurb from the ref pack (`npm run ref:sync`), so lists never load entry chunks. */
export function refName(locale: Locale, id: RefId): { name: string; blurb: string } {
  return refMessages(locale).list[id];
}

/**
 * Photos for an entry, in display order (hotlinked from s1.mtf6.com, never copied). src/data/ref-photos.json rides in
 * the ref pack, so it loads only on reference pages (this module is in the entry chunk through seo.ts).
 */
export function refPhotos(locale: Locale, id: RefId): RefPhoto[] {
  return (refMessages(locale).photos as Partial<Record<RefId, RefPhoto[]>>)[id] ?? [];
}

export function refImageUrl(photo: RefPhoto, width: 300 | 600): string {
  return `https://s1.mtf6.com/${encodeURIComponent(photo.img)}_c_w_${width}_ext_jpg.webp`;
}

export function refPhotoPage(photo: RefPhoto): string {
  return `https://www.mfan8.com/${encodeURIComponent(photo.item)}`;
}

export function refTitle(locale: Locale, id: RefId | null): string {
  return `${id ? refCopy(locale, id).title : refHub(locale).title} — cv.cm`;
}

export function refDescription(locale: Locale, id: RefId | null): string {
  return id ? refCopy(locale, id).description : refHub(locale).description;
}

export function refFaqItems(locale: Locale, id: RefId | null): { q: string; a: string }[] {
  return id ? refCopy(locale, id).faq : refHub(locale).faq;
}

const CJK = new Set<Locale>(["zh-CN", "zh-TW", "ja"]);

function crumbHtml(locale: Locale, id: RefId | null): string {
  const m = refMessages(locale);
  const sep = ` <span aria-hidden="true">/</span> `;
  const parts = [
    `<a href="${escapeHtml(appHref(locale, null))}" data-nav="home">${escapeHtml(m.crumbHome)}</a>`,
    id
      ? `<a href="${escapeHtml(refHref(locale))}" data-nav="reference">${escapeHtml(m.hub.h1)}</a>`
      : `<span>${escapeHtml(m.hub.h1)}</span>`,
  ];
  if (id) parts.push(`<span>${escapeHtml(refName(locale, id).name)}</span>`);
  return `<nav class="device-crumb" aria-label="${escapeHtml(m.hub.h1)}">${parts.join(sep)}</nav>`;
}

function faqHtml(locale: Locale, id: RefId | null): string {
  const items = refFaqItems(locale, id).map((item, index) => (
    `<details${index === 0 ? " open" : ""}><summary>${inline(item.q)}</summary><p>${inline(item.a)}</p></details>`
  )).join("");
  return `<section class="faq" aria-labelledby="faq-title"><h2 id="faq-title">${escapeHtml(refUi(locale).faq)}</h2>${items}</section>`;
}

export function refLinkItems(locale: Locale, ids: readonly RefId[]): { href: string; name: string; blurb: string; nav: string }[] {
  return ids.map((id) => ({ href: refHref(locale, id), ...refName(locale, id), nav: `ref-${id}` }));
}

function photoCredit(ui: RefUi, photo: RefPhoto): string {
  return [
    photo.photo ? fill(ui.photoBy, { name: photo.photo }) : "",
    photo.model ? fill(ui.modelBy, { name: photo.model }) : "",
  ].filter(Boolean).join(" · ");
}

/** The photo strip: hotlinked thumbnails, each linking to its set on mfan8.com, then the "more photos" tag link. */
function photosHtml(locale: Locale, id: RefId): string {
  const ui = refUi(locale);
  const name = refName(locale, id).name;
  const list = refPhotos(locale, id);
  const more = `<p class="more"><a href="${escapeHtml(mfan8Href(REF_META[id].mfan8))}" target="_blank" rel="noopener">${escapeHtml(fill(ui.more, { name, site: SITE }))}</a></p>`;
  if (!list.length) {
    return `<section class="ref-photos" aria-labelledby="ref-photos-title"><h2 id="ref-photos-title">${escapeHtml(ui.photos)}</h2><p>${escapeHtml(ui.noPhotos)}</p>${more}</section>`;
  }
  const figures = list.map((photo, i) => {
    const height = Math.round((300 * photo.h) / photo.w);
    const credit = photoCredit(ui, photo);
    return `<figure><a href="${escapeHtml(refPhotoPage(photo))}" target="_blank" rel="noopener">`
      + `<img src="${escapeHtml(refImageUrl(photo, 300))}" srcset="${escapeHtml(refImageUrl(photo, 600))} 2x" width="300" height="${height}" loading="lazy" decoding="async" alt="${escapeHtml(fill(ui.photoAlt, { name, n: i + 1 }))}">`
      + `</a>${credit ? `<figcaption>${escapeHtml(credit)}</figcaption>` : ""}</figure>`;
  }).join("");
  return `<section class="ref-photos" aria-labelledby="ref-photos-title"><h2 id="ref-photos-title">${escapeHtml(ui.photos)}</h2>`
    + `<div class="ref-grid">${figures}</div>`
    + `<p class="ref-note">${escapeHtml(fill(ui.photosNote, { site: SITE }))}</p>${more}</section>`;
}

/** Each entry's name in every locale, from the names map the ref pack carries (no other locale's pack is loaded). */
function namesHtml(locale: Locale, id: RefId): string {
  const ui = refUi(locale);
  const names = refMessages(locale).names[id];
  const langs = messages(locale).ui.lang as unknown as Record<Locale, string>;
  const rows = LOCALES.map((code) => (
    `<tr><th scope="row" lang="${HREFLANG[code]}">${escapeHtml(langs[code])}</th><td lang="${HREFLANG[code]}">${escapeHtml(names[code])}</td></tr>`
  )).join("");
  return `<section class="learn-related ref-names"><h2>${escapeHtml(ui.names)}</h2><div class="kb-table"><table>`
    + `<thead><tr><th scope="col">${escapeHtml(ui.language)}</th><th scope="col">${escapeHtml(ui.name)}</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

/** The reference hub or one entry as HTML: the client mounts it as is, and the Worker serves it to crawlers. */
export function refPageHtml(locale: Locale, id: RefId | null): string {
  const ui = refUi(locale);
  const hub = refHub(locale);
  const groupLabels = hub.groups as Record<string, string>;
  if (!id) {
    const groups = REF_GROUPS.map((group) => (
      `<section class="wall" id="${group.id}"><h2>${escapeHtml(groupLabels[group.id])} <span class="pill">${escapeHtml(fill(ui.count, { n: group.entries.length }))}</span></h2>`
      + `${linkListHtml(refLinkItems(locale, group.entries))}</section>`
    )).join("");
    return [
      crumbHtml(locale, null),
      `<header class="tool-head"><h1>${escapeHtml(hub.h1)}</h1><p class="lede">${escapeHtml(hub.lede)}</p></header>`,
      groups,
      `<section class="kb-about">${hub.about.map((p) => `<p>${inline(p)}</p>`).join("")}</section>`,
      faqHtml(locale, null),
    ].join("");
  }
  const copy = refCopy(locale, id);
  const meta = REF_META[id];
  const cjk = CJK.has(locale);
  const toc = copy.sections.map((s, i) => `<li><a href="#ref-${i + 1}">${inline(s.h)}</a></li>`).join("");
  const sections = copy.sections.map((s, i) => (
    `<section class="kb-section" id="ref-${i + 1}"><h2>${inline(s.h)}</h2>${s.body.map(blockHtml).join("")}</section>`
  )).join("");
  return [
    crumbHtml(locale, id),
    `<article class="kb ref">`,
    `<header class="tool-head"><p class="kicker">${escapeHtml(ui.kicker)} · ${escapeHtml(groupLabels[refGroupOf(id)])}</p>`,
    `<h1>${escapeHtml(copy.h1)}</h1>`,
    copy.aka.length ? `<p class="ref-aka">${escapeHtml(ui.also)}${cjk ? "：" : ": "}${escapeHtml(copy.aka.join(cjk ? "、" : ", "))}</p>` : "",
    `</header>`,
    `<section class="kb-answer" aria-label="${escapeHtml(ui.answer)}"><h2>${escapeHtml(ui.answer)}</h2><p>${inline(copy.answer)}</p></section>`,
    photosHtml(locale, id),
    `<nav class="kb-toc" aria-label="${escapeHtml(ui.toc)}"><h2>${escapeHtml(ui.toc)}</h2><ol>${toc}</ol></nav>`,
    sections,
    `<section class="learn-related ref-prompt"><h2>${escapeHtml(ui.prompt)}</h2><ul class="ref-tags">${meta.prompt.map((k) => `<li><code>${escapeHtml(k)}</code></li>`).join("")}</ul><p class="ref-note">${escapeHtml(ui.promptNote)}</p></section>`,
    namesHtml(locale, id),
    faqHtml(locale, id),
    meta.related.length ? `<section class="learn-related"><h2>${escapeHtml(ui.related)}</h2>${linkListHtml(refLinkItems(locale, meta.related))}</section>` : "",
    `<p class="more"><a href="${escapeHtml(refHref(locale))}" data-nav="reference">${escapeHtml(ui.all)}</a></p>`,
    `</article>`,
  ].join("");
}

export function refBreadcrumbJsonLd(locale: Locale, id: RefId | null): Record<string, unknown> {
  const m = refMessages(locale);
  const items = [
    { name: m.crumbHome, item: `${ORIGIN}${appHref(locale, null)}` },
    { name: m.hub.h1, item: `${ORIGIN}${refHref(locale)}` },
  ];
  if (id) items.push({ name: refName(locale, id).name, item: `${ORIGIN}${refHref(locale, id)}` });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, ...item })),
  };
}

export function refFaqJsonLd(locale: Locale, id: RefId | null): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: refFaqItems(locale, id).map((item) => ({
      "@type": "Question",
      name: item.q.replaceAll("`", ""),
      acceptedAnswer: { "@type": "Answer", text: item.a.replaceAll("`", "") },
    })),
  };
}

/** Article (with the look as a DefinedTerm and its photos as credited ImageObjects) for an entry; CollectionPage + ItemList for the hub. */
export function refArticleJsonLd(locale: Locale, id: RefId | null): Record<string, unknown> {
  if (!id) {
    const hub = refHub(locale);
    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: hub.h1,
      description: hub.description,
      url: `${ORIGIN}${refHref(locale)}`,
      inLanguage: HREFLANG[locale],
      mainEntity: {
        "@type": "ItemList",
        itemListElement: REF_GROUPS.flatMap((group) => group.entries).map((entry, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${ORIGIN}${refHref(locale, entry)}`,
          name: refName(locale, entry).name,
        })),
      },
    };
  }
  const copy = refCopy(locale, id);
  const url = `${ORIGIN}${refHref(locale, id)}`;
  const images = refPhotos(locale, id).map((photo) => {
    const credit = [photo.photo, photo.model].filter(Boolean).join(" / ");
    return {
      "@type": "ImageObject",
      contentUrl: refImageUrl(photo, 600),
      ...(credit ? { creditText: credit } : {}),
    };
  });
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: copy.h1,
    description: copy.description,
    abstract: copy.answer.replaceAll("`", ""),
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: HREFLANG[locale],
    datePublished: REF_PUBLISHED,
    dateModified: REF_PUBLISHED,
    author: PUBLISHER,
    publisher: PUBLISHER,
    isAccessibleForFree: true,
    articleSection: (refHub(locale).groups as Record<string, string>)[refGroupOf(id)],
    about: { "@type": "DefinedTerm", name: refName(locale, id).name, ...(copy.aka.length ? { alternateName: copy.aka } : {}) },
    ...(images.length ? { image: images } : {}),
  };
}
