/**
 * The emoji meanings page HTML (hub and emoji pages), shared by the client page and the Worker's crawler copy. Kept out
 * of emoji-i18n so the main bundle, which needs only titles, descriptions and JSON-LD, does not carry it. Emoji are
 * plain text in the reader's own emoji font: no images.
 */
import { CJK_LOCALES, type Locale } from "./locale";
import { escapeHtml } from "./device-i18n";
import { fill } from "./fill";
import { messages } from "./messages";
import { appHref, emojiHref } from "./path";
import { dataCrumbHtml } from "./channel-parent";
import { HREFLANG } from "./sitemap";
import { EMOJI_SLUGS, EMOJI_SNAPSHOT, type EmojiSlug } from "./emoji";
import {
  EMOJI_SOURCES,
  codepointText,
  emojiFaqItems,
  emojiLabel,
  emojiMessages,
  emojiName,
  emojiRow,
  emojiVars,
  emojiWithName,
  groupLabel,
  htmlCode,
  subgroupLabel,
  type EmojiRow,
} from "./emoji-i18n";

const sep = ` <span aria-hidden="true">/</span> `;

/** A label's colon: full-width in Chinese and Japanese. */
const colon = (locale: Locale): string => (CJK_LOCALES.has(locale) ? "：" : ": ");

function crumbHtml(locale: Locale, slug: EmojiSlug | null): string {
  const m = emojiMessages(locale);
  const parts = [
    `<a href="${escapeHtml(appHref(locale, null))}" data-nav="home">${escapeHtml(m.crumbHome)}</a>`,
    dataCrumbHtml(locale),
    slug ? `<a href="${escapeHtml(emojiHref(locale))}" data-nav="emoji">${escapeHtml(m.hub.h1)}</a>` : `<span>${escapeHtml(m.hub.h1)}</span>`,
  ];
  if (slug) parts.push(`<span>${escapeHtml(emojiWithName(locale, slug))}</span>`);
  return `<nav class="device-crumb" aria-label="${escapeHtml(messages(locale).ui.nav.breadcrumb)}">${parts.join(sep)}</nav>`;
}

/**
 * A Copy button for one emoji; the client copies `data-copy` (the page works as text without it). No aria-label, so
 * the flashed "Copied" / "Copy failed" is what the button reads; the result is also announced in `.emoji-status`.
 */
function copyButton(locale: Locale, emoji: string, label: string | null = null): string {
  const m = emojiMessages(locale);
  return `<button type="button" class="emoji-copy" data-copy="${escapeHtml(emoji)}">${escapeHtml(label ?? m.copy)}</button>`;
}

/** Where the client announces a copy result to screen readers. */
const STATUS = `<p class="sr-only emoji-status" role="status" aria-live="polite"></p>`;

function faqHtml(locale: Locale, slug: EmojiSlug | null): string {
  const items = emojiFaqItems(locale, slug).map((item, index) => (
    `<details${index === 0 ? " open" : ""}><summary>${escapeHtml(item.q)}</summary><p>${escapeHtml(item.a)}</p></details>`
  )).join("");
  return `<section class="faq" aria-labelledby="faq-title"><h2 id="faq-title">${escapeHtml(emojiMessages(locale).page.faqTitle)}</h2>${items}</section>`;
}

function emojiLink(locale: Locale, slug: EmojiSlug): string {
  const row = emojiRow(locale, slug);
  return `<a href="${escapeHtml(emojiHref(locale, slug))}" data-nav="emoji-${slug}"><span class="emoji-glyph" aria-hidden="true">${escapeHtml(row.emoji)}</span> ${escapeHtml(emojiLabel(locale, slug))}</a>`;
}

/** Sources and the Unicode licence: a short credit on every page, the full notice on the hub. */
function sourcesHtml(locale: Locale, full: boolean): string {
  const s = emojiMessages(locale).sources;
  const link = (href: string, text: string): string => `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(text)}</a>`;
  const names = escapeHtml(fill(s.names, { version: EMOJI_SOURCES.cldrVersion })).replace("{cldr}", link(EMOJI_SOURCES.cldr, s.cldr));
  const data = escapeHtml(fill(s.data, { version: EMOJI_SOURCES.testVersion })).replace("{test}", link(EMOJI_SOURCES.test, s.test));
  const notice = escapeHtml(s.notice).replace("{license}", link(EMOJI_SOURCES.license, s.license));
  const text = full ? `<details class="emoji-notice"><summary>${escapeHtml(s.noticeTitle)}</summary><pre lang="en">${escapeHtml(UNICODE_NOTICE)}</pre></details>` : "";
  return `<section class="learn-related emoji-sources"><h2>${escapeHtml(s.title)}</h2><ul><li>${names}</li><li>${data}</li><li>${escapeHtml(s.usage)}</li></ul>`
    + `<p class="muted">${notice} ${escapeHtml(fill(s.snapshot, { date: EMOJI_SNAPSHOT }))}</p>${text}</section>`;
}

/** Hub: the search box, then each Unicode group with its emoji as links plus a Copy button. */
function hubHtml(locale: Locale): string {
  const m = emojiMessages(locale);
  const groups: { group: string; slugs: EmojiSlug[] }[] = [];
  for (const slug of EMOJI_SLUGS) {
    const row = emojiRow(locale, slug);
    const last = groups.at(-1);
    if (last?.group === row.group) last.slugs.push(slug);
    else groups.push({ group: row.group, slugs: [slug] });
  }
  const sections = groups.map(({ group, slugs }) => (
    `<section class="emoji-group" data-group="${escapeHtml(group)}"><h2>${escapeHtml(groupLabel(locale, group))}</h2><ul class="emoji-list">`
    + slugs.map((slug) => `<li data-slug="${slug}">${emojiLink(locale, slug)} ${copyButton(locale, emojiRow(locale, slug).emoji)}</li>`).join("")
    + `</ul></section>`
  )).join("");
  return [
    crumbHtml(locale, null),
    `<header class="tool-head"><h1>${escapeHtml(m.hub.h1)}</h1><p class="lede">${escapeHtml(fill(m.hub.lede, { n: EMOJI_SLUGS.length }))}</p></header>`,
    `<div class="data-tools emoji-tools"><input type="search" class="data-search emoji-search" placeholder="${escapeHtml(m.hub.searchPlaceholder)}" aria-label="${escapeHtml(m.hub.search)}" autocomplete="off" enterkeyhint="search"></div>`,
    `<p class="data-count emoji-count" aria-live="polite">${escapeHtml(fill(m.hub.shown, { n: EMOJI_SLUGS.length, total: EMOJI_SLUGS.length }))}</p>`,
    `<p class="emoji-none muted" hidden>${escapeHtml(m.hub.none)}</p>`,
    sections,
    STATUS,
    `<section class="kb-about"><h2>${escapeHtml(m.hub.aboutTitle)}</h2>${m.hub.about.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}</section>`,
    faqHtml(locale, null),
    sourcesHtml(locale, true),
  ].join("");
}

function factsHtml(locale: Locale, slug: EmojiSlug, row: EmojiRow): string {
  const m = emojiMessages(locale);
  const l = m.labels;
  const facts: [string, string][] = [
    [l.emoji, row.emoji],
    [l.name, emojiName(locale, slug)],
    ...(locale === "en" ? [] : [[l.englishName, m.english[slug]] as [string, string]]),
    [row.cp.length > 1 ? l.codepoints : l.codepoint, codepointText(row)],
    [l.html, htmlCode(row)],
    [l.version, fill(m.values.version, { v: row.v })],
    [l.year, String(row.year)],
    [l.group, groupLabel(locale, row.group)],
    [l.subgroup, subgroupLabel(locale, row.subgroup)],
  ];
  const body = facts.map(([label, value]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join("");
  return `<section class="emoji-facts" aria-labelledby="emoji-facts-title"><h2 id="emoji-facts-title">${escapeHtml(fill(m.page.factsTitle, emojiVars(locale, slug)))}</h2>`
    + `<div class="table-wrap"><table class="pt-facts-table"><tbody>${body}</tbody></table></div></section>`;
}

function keywordsHtml(locale: Locale, slug: EmojiSlug): string {
  const m = emojiMessages(locale);
  const words = m.keywords[slug] ?? [];
  if (!words.length) return "";
  return `<section class="kb-section emoji-keywords" aria-labelledby="emoji-keywords-title"><h2 id="emoji-keywords-title">${escapeHtml(m.page.keywordsTitle)}</h2>`
    + `<p>${escapeHtml(fill(m.page.keywordsText, emojiVars(locale, slug)))}</p><ul class="emoji-tags">${words.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul></section>`;
}

function variantsHtml(locale: Locale, slug: EmojiSlug, row: EmojiRow): string {
  if (!row.variants.length) return "";
  const m = emojiMessages(locale);
  const items = row.variants.map((v) => (
    `<li><span class="emoji-glyph" aria-hidden="true">${escapeHtml(v)}</span> ${escapeHtml(m.variants[v])} ${copyButton(locale, v)}</li>`
  )).join("");
  return `<section class="kb-section emoji-variants" aria-labelledby="emoji-variants-title"><h2 id="emoji-variants-title">${escapeHtml(m.page.variantsTitle)}</h2>`
    + `<p>${escapeHtml(fill(m.page.variantsText, emojiVars(locale, slug)))}</p><ul class="emoji-list">${items}</ul></section>`;
}

const SIMILAR_MAX = 8;

/** Up to 8 other covered emoji of the same subgroup, the nearest in CLDR order; when it has none, of the same group. */
export function similarSlugs(locale: Locale, slug: EmojiSlug): EmojiSlug[] {
  const row = emojiRow(locale, slug);
  const others = EMOJI_SLUGS.filter((s) => s !== slug);
  const same = others.filter((s) => emojiRow(locale, s).subgroup === row.subgroup);
  const pool = same.length ? same : others.filter((s) => emojiRow(locale, s).group === row.group);
  // The nearest in CLDR order (which keeps like with like: 😢 next to 😭), listed in that order.
  const at = EMOJI_SLUGS.indexOf(slug);
  const near = new Set([...pool].sort((a, b) => Math.abs(EMOJI_SLUGS.indexOf(a) - at) - Math.abs(EMOJI_SLUGS.indexOf(b) - at)).slice(0, SIMILAR_MAX));
  return pool.filter((s) => near.has(s));
}

function similarHtml(locale: Locale, slug: EmojiSlug): string {
  const m = emojiMessages(locale);
  const list = similarSlugs(locale, slug);
  if (!list.length) return "";
  const row = emojiRow(locale, slug);
  // Alone in its subgroup: the list is the rest of its group, so the sentence names the group.
  const own = emojiRow(locale, list[0]).subgroup === row.subgroup;
  const set = own ? subgroupLabel(locale, row.subgroup) : groupLabel(locale, row.group).toLocaleLowerCase(HREFLANG[locale]);
  return `<section class="kb-section emoji-similar" aria-labelledby="emoji-similar-title"><h2 id="emoji-similar-title">${escapeHtml(m.page.similarTitle)}</h2>`
    + `<p>${escapeHtml(fill(m.page.similarText, { ...emojiVars(locale, slug), subgroup: set }))}</p><ul class="emoji-list">${list.map((s) => `<li>${emojiLink(locale, s)}</li>`).join("")}</ul></section>`;
}

function emojiHtml(locale: Locale, slug: EmojiSlug): string {
  const m = emojiMessages(locale);
  const row = emojiRow(locale, slug);
  const vars = emojiVars(locale, slug);
  const english = m.english[slug];
  return [
    crumbHtml(locale, slug),
    `<article class="emoji-page">`,
    `<header class="tool-head"><p class="kicker">${escapeHtml(m.hub.h1)} · ${escapeHtml(groupLabel(locale, row.group))}</p>`,
    `<h1>${escapeHtml(fill(m.page.h1, vars))}</h1>`,
    locale === "en" || english === emojiName(locale, slug) ? "" : `<p class="ref-aka">${escapeHtml(m.labels.englishName)}${colon(locale)}<span lang="en">${escapeHtml(english)}</span></p>`,
    `</header>`,
    `<section class="kb-answer emoji-answer"><span class="emoji-big" aria-hidden="true">${escapeHtml(row.emoji)}</span>`,
    `<div><p><strong>${escapeHtml(m.page.meaning)}${colon(locale).trim()}</strong> ${escapeHtml(m.usage[slug])}</p>`,
    `<p>${copyButton(locale, row.emoji, fill(m.copyLabel, { emoji: row.emoji }))} <span class="muted">${escapeHtml(codepointText(row))}</span></p></div></section>`,
    factsHtml(locale, slug, row),
    variantsHtml(locale, slug, row),
    keywordsHtml(locale, slug),
    similarHtml(locale, slug),
    faqHtml(locale, slug),
    sourcesHtml(locale, false),
    STATUS,
    `<p class="more"><a href="${escapeHtml(emojiHref(locale))}" data-nav="emoji">${escapeHtml(m.hub.h1)}</a></p>`,
    `</article>`,
  ].join("");
}

/** The emoji hub (null) or one emoji as HTML: the client mounts it as is, and the Worker serves it to crawlers. */
export function emojiPageHtml(locale: Locale, slug: EmojiSlug | null): string {
  return slug ? emojiHtml(locale, slug) : hubHtml(locale);
}

/** The Unicode License v3 notice, reproduced as its condition (b) asks; shown on the hub. */
const UNICODE_NOTICE = `UNICODE LICENSE V3

COPYRIGHT AND PERMISSION NOTICE

Copyright © 1991-2026 Unicode, Inc.

NOTICE TO USER: Carefully read the following legal agreement. BY
DOWNLOADING, INSTALLING, COPYING OR OTHERWISE USING DATA FILES, AND/OR
SOFTWARE, YOU UNEQUIVOCALLY ACCEPT, AND AGREE TO BE BOUND BY, ALL OF THE
TERMS AND CONDITIONS OF THIS AGREEMENT. IF YOU DO NOT AGREE, DO NOT
DOWNLOAD, INSTALL, COPY, DISTRIBUTE OR USE THE DATA FILES OR SOFTWARE.

Permission is hereby granted, free of charge, to any person obtaining a
copy of data files and any associated documentation (the "Data Files") or
software and any associated documentation (the "Software") to deal in the
Data Files or Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, and/or sell
copies of the Data Files or Software, and to permit persons to whom the
Data Files or Software are furnished to do so, provided that either (a)
this copyright and permission notice appear with all copies of the Data
Files or Software, or (b) this copyright and permission notice appear in
associated Documentation.

THE DATA FILES AND SOFTWARE ARE PROVIDED "AS IS", WITHOUT WARRANTY OF ANY
KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF
THIRD PARTY RIGHTS.

IN NO EVENT SHALL THE COPYRIGHT HOLDER OR HOLDERS INCLUDED IN THIS NOTICE
BE LIABLE FOR ANY CLAIM, OR ANY SPECIAL INDIRECT OR CONSEQUENTIAL DAMAGES,
OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS,
WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION,
ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THE DATA
FILES OR SOFTWARE.

Except as contained in this notice, the name of a copyright holder shall
not be used in advertising or otherwise to promote the sale, use or other
dealings in these Data Files or Software without prior written
authorization of the copyright holder.`;
