/**
 * The breeds page HTML (hub and breeds), shared by the client page and the Worker's crawler copy. Kept out of
 * breeds-i18n so the main bundle, which needs only titles, descriptions and JSON-LD, does not carry it.
 */
import type { Locale } from "./locale";
import { escapeHtml } from "./device-i18n";
import { fill } from "./fill";
import { blockHtml, dateLabel, inline } from "./article-html";
import { messages } from "./messages";
import { appHref, breedsHref, quizHref } from "./path";
import { dataCrumbHtml } from "./channel-parent";
import { regionName } from "./datasets-i18n";
import { HREFLANG } from "./sitemap";
import { BREED_IDS, BREED_QUIZ, breedKindOf, quizOfBreed, type BreedId, type BreedKind } from "./breeds";
import { breedsMessages, type BreedFacts, type BreedRange } from "./breeds-store";
import {
  BREED_SIZES,
  breedBlurb,
  breedCopy,
  breedEnglishName,
  breedFacts,
  breedImage,
  breedImagePath,
  breedName,
  breedSize,
  breedSources,
  breedsFaqItems,
  breedsHub,
  breedsUi,
  breedsUpdated,
} from "./breeds-i18n";

const sep = ` <span aria-hidden="true">/</span> `;

function crumbHtml(locale: Locale, id: BreedId | null): string {
  const m = breedsMessages(locale);
  const parts = [
    `<a href="${escapeHtml(appHref(locale, null))}" data-nav="home">${escapeHtml(m.crumbHome)}</a>`,
    dataCrumbHtml(locale),
    id ? `<a href="${escapeHtml(breedsHref(locale))}" data-nav="breeds">${escapeHtml(m.hub.h1)}</a>` : `<span>${escapeHtml(m.hub.h1)}</span>`,
  ];
  if (id) parts.push(`<span>${escapeHtml(breedName(locale, id))}</span>`);
  return `<nav class="device-crumb" aria-label="${escapeHtml(messages(locale).ui.nav.breadcrumb)}">${parts.join(sep)}</nav>`;
}

function faqHtml(locale: Locale, id: BreedId | null): string {
  const items = breedsFaqItems(locale, id).map((item, index) => (
    `<details${index === 0 ? " open" : ""}><summary>${inline(item.q)}</summary><p>${inline(item.a)}</p></details>`
  )).join("");
  return `<section class="faq" aria-labelledby="faq-title"><h2 id="faq-title">${escapeHtml(breedsUi(locale).faq)}</h2>${items}</section>`;
}

/** "United Kingdom, Ireland": Intl names of the ISO codes, joined the locale's way. */
export function breedOrigin(locale: Locale, facts: BreedFacts): string {
  const names = facts.origin.map((code) => regionName(locale, code, code));
  try {
    return new Intl.ListFormat(HREFLANG[locale], { type: "conjunction" }).format(names);
  } catch {
    return names.join(", ");
  }
}

function rangeText(locale: Locale, range: BreedRange | null, many: string, one: string): string {
  if (!range) return breedsUi(locale).none;
  const nf = new Intl.NumberFormat(HREFLANG[locale], { maximumFractionDigits: 1 });
  return range.min === range.max ? fill(one, { v: nf.format(range.min) }) : fill(many, { min: nf.format(range.min), max: nf.format(range.max) });
}

/** A list item with the data the hub filter reads; same markup as `linkListHtml` (rule 7: text links). */
function itemHtml(locale: Locale, id: BreedId): string {
  const facts = breedFacts(locale, id);
  const kind = breedKindOf(id);
  const size = breedSize(facts, kind);
  const name = breedName(locale, id);
  const english = breedEnglishName(locale, id);
  const ui = breedsUi(locale);
  const meta = [breedOrigin(locale, facts), size ? (ui.sizes as Record<string, string>)[size] : ""].filter(Boolean).join(" · ");
  // Search text: the local and English names (lower case), so "golden", "ゴールデン" and "金毛" all find it.
  const words = [...new Set([name, english].map((n) => n.toLocaleLowerCase(HREFLANG[locale])))].join(" | ");
  return `<li data-kind="${kind}" data-size="${size ?? ""}" data-group="${facts.fci?.group ?? 0}" data-words="${escapeHtml(words)}">`
    + `<a href="${escapeHtml(breedsHref(locale, id))}" data-nav="breed-${escapeHtml(id)}"><small>${escapeHtml(meta)}</small><strong>${escapeHtml(name)}</strong>`
    + `${english !== name ? `<span class="breed-en">${escapeHtml(english)}</span>` : ""}<span>${escapeHtml(breedBlurb(locale, id))}</span></a></li>`;
}

export function breedLinkItems(locale: Locale, ids: readonly BreedId[]): string {
  return `<ul class="links">${ids.map((id) => itemHtml(locale, id)).join("")}</ul>`;
}

/** The hub's filters: one search box (both lists), size and FCI group selects. Wired by the client (breeds/ui.ts). */
function toolsHtml(locale: Locale): string {
  const hub = breedsHub(locale);
  const ui = breedsUi(locale);
  const sizes = BREED_SIZES.map((s) => `<option value="${s}">${escapeHtml((ui.sizes as Record<string, string>)[s])}</option>`).join("");
  const groups = Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">${escapeHtml(`${i + 1}. ${(ui.fciGroups as Record<string, string>)[String(i + 1)]}`)}</option>`).join("")
    + `<option value="0">${escapeHtml(hub.notFci)}</option>`;
  return `<div class="data-tools breed-tools"><input type="search" class="data-search breed-search" placeholder="${escapeHtml(hub.searchPlaceholder)}" aria-label="${escapeHtml(hub.search)}" autocomplete="off" enterkeyhint="search">`
    + `<select class="breed-size" aria-label="${escapeHtml(hub.size)}"><option value="">${escapeHtml(`${hub.size}: ${hub.any}`)}</option>${sizes}</select>`
    + `<select class="breed-group" aria-label="${escapeHtml(hub.group)}"><option value="">${escapeHtml(`${hub.group}: ${hub.any}`)}</option>${groups}</select></div>`;
}

function kindSection(locale: Locale, kind: BreedKind): string {
  const hub = breedsHub(locale);
  const ids = BREED_IDS.filter((id) => breedKindOf(id) === kind);
  const title = kind === "dogs" ? hub.dogs : hub.cats;
  return `<section class="wall breed-list" id="${kind}" data-kind="${kind}"><h2>${escapeHtml(title)} <span class="pill breed-count" aria-live="polite">${escapeHtml(fill(hub.shown, { n: ids.length, total: ids.length }))}</span></h2>`
    + `${breedLinkItems(locale, ids)}<p class="breed-none" hidden>${escapeHtml(hub.none)}</p></section>`;
}

function hubHtml(locale: Locale): string {
  const hub = breedsHub(locale);
  return [
    crumbHtml(locale, null),
    `<header class="tool-head"><h1>${escapeHtml(hub.h1)}</h1><p class="lede">${escapeHtml(hub.lede)}</p></header>`,
    `<p class="slang-jump"><a href="#dogs">${escapeHtml(hub.dogs)}</a> · <a href="#cats">${escapeHtml(hub.cats)}</a></p>`,
    toolsHtml(locale),
    kindSection(locale, "dogs"),
    kindSection(locale, "cats"),
    `<section class="kb-about"><p>${escapeHtml(hub.sizeRule)}</p>${hub.about.map((p) => `<p>${inline(p)}</p>`).join("")}</section>`,
    faqHtml(locale, null),
  ].join("");
}

/** Facts from Wikidata and the FCI: a dash where Wikidata lists nothing. */
function factsHtml(locale: Locale, id: BreedId): string {
  const ui = breedsUi(locale);
  const facts = breedFacts(locale, id);
  const kind = breedKindOf(id);
  const size = breedSize(facts, kind);
  const registries = ui.registries as Record<string, string>;
  const rows: [string, string][] = [
    [escapeHtml(ui.origin), escapeHtml(breedOrigin(locale, facts))],
    [escapeHtml(ui.height), escapeHtml(rangeText(locale, facts.height, ui.cm, ui.cmOne))],
    [escapeHtml(ui.weight), escapeHtml(rangeText(locale, facts.weight, ui.kg, ui.kgOne))],
    [escapeHtml(ui.life), escapeHtml(rangeText(locale, facts.life, ui.years, ui.yearsOne))],
    [escapeHtml(ui.size), escapeHtml(size ? (ui.sizes as Record<string, string>)[size] : ui.none)],
  ];
  if (kind === "dogs") {
    rows.push([escapeHtml(ui.fci), facts.fci
      ? `<a href="${escapeHtml(facts.fci.page)}" target="_blank" rel="noopener">${escapeHtml(fill(ui.fciGroup, { group: facts.fci.group, name: (ui.fciGroups as Record<string, string>)[String(facts.fci.group)], n: facts.fci.number }))}</a>`
      : escapeHtml(ui.notFci)]);
  }
  const standards = facts.registries.map((r) => `<a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${escapeHtml(registries[r.id] ?? r.id)}</a>`);
  rows.push([escapeHtml(ui.standards), standards.length ? standards.join(", ") : escapeHtml(ui.none)]);
  const body = rows.map(([label, value]) => `<tr><th scope="row">${label}</th><td>${value}</td></tr>`).join("");
  return `<section class="breed-facts" aria-labelledby="breed-facts-title"><h2 id="breed-facts-title">${escapeHtml(ui.facts)}</h2>`
    + `<div class="table-wrap"><table class="breed-facts-table"><tbody>${body}</tbody></table></div><p class="meme-note">${escapeHtml(ui.factsNote)}</p></section>`;
}

/** The picture under the answer: eager (likely LCP), fixed size, alt in the reader's language, credit + licence links. */
function imageHtml(locale: Locale, id: BreedId): string {
  const image = breedImage(locale, id);
  if (!image) return "";
  const ui = breedsUi(locale);
  const credit = image.author ? fill(ui.imageCredit, { author: image.author }) : ui.imageCreditAnon;
  return `<figure class="meme-figure"><img src="${escapeHtml(breedImagePath(locale, id)!)}" width="${image.width}" height="${image.height}" alt="${escapeHtml(fill(ui.imageAlt, { name: breedName(locale, id) }))}" fetchpriority="high" decoding="async">`
    + `<figcaption><a href="${escapeHtml(image.page)}" target="_blank" rel="noopener">${escapeHtml(credit)}</a> · <a href="${escapeHtml(image.licenseUrl)}" target="_blank" rel="noopener license">${escapeHtml(image.license)}</a></figcaption></figure>`;
}

/** Up to six breeds of the same kind: the same FCI group for dogs, else the same size group, in popularity order. */
export function relatedBreeds(locale: Locale, id: BreedId): BreedId[] {
  const kind = breedKindOf(id);
  const facts = breedFacts(locale, id);
  const size = breedSize(facts, kind);
  const others = BREED_IDS.filter((b) => b !== id && breedKindOf(b) === kind);
  const same = facts.fci ? others.filter((b) => breedFacts(locale, b).fci?.group === facts.fci!.group) : [];
  const bySize = others.filter((b) => !same.includes(b) && size && breedSize(breedFacts(locale, b), kind) === size);
  return [...same, ...bySize].slice(0, 6);
}

/** The breed quiz of this kind, saying so when this breed is one of its results. */
function quizHtml(locale: Locale, id: BreedId): string {
  const ui = breedsUi(locale);
  const kind = breedKindOf(id);
  const quiz = quizOfBreed(id);
  const isResult = (Object.values(BREED_QUIZ[quiz].results) as string[]).includes(id);
  return `<section class="learn-related breed-quiz"><h2>${escapeHtml(ui.quiz[kind])}</h2><ul class="links"><li><a href="${escapeHtml(quizHref(locale, quiz))}" data-nav="test-${quiz}">`
    + `<strong>${escapeHtml(ui.quiz[kind])}</strong><span>${escapeHtml(isResult ? `${ui.quizText[kind]} ${ui.quizResult}` : ui.quizText[kind])}</span></a></li></ul></section>`;
}

function sourcesHtml(locale: Locale, id: BreedId): string {
  const items = breedSources(locale, id).map((s) => `<li><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.name)}</a></li>`).join("");
  return `<section class="learn-related"><h2>${escapeHtml(breedsUi(locale).sources)}</h2><ul>${items}</ul></section>`;
}

function breedHtml(locale: Locale, id: BreedId): string {
  const ui = breedsUi(locale);
  const copy = breedCopy(locale, id);
  const facts = breedFacts(locale, id);
  const kind = breedKindOf(id);
  const name = breedName(locale, id);
  const english = breedEnglishName(locale, id);
  const updated = breedsUpdated(id);
  const kicker = [ui.kicker[kind], facts.fci ? `FCI ${facts.fci.group}` : ""].filter(Boolean).join(" · ");
  const toc = copy.sections.map((s, i) => `<li><a href="#breed-${i + 1}">${inline(s.h)}</a></li>`).join("");
  const sections = copy.sections.map((s, i) => `<section class="kb-section" id="breed-${i + 1}"><h2>${inline(s.h)}</h2>${s.body.map(blockHtml).join("")}</section>`).join("");
  const related = relatedBreeds(locale, id);
  const meta = [
    english !== name ? `<span lang="en">${escapeHtml(fill(ui.english, { name: english }))}</span>` : "",
    `<time datetime="${updated}">${escapeHtml(fill(ui.updated, { date: dateLabel(locale, updated) }))}</time>`,
  ].filter(Boolean).join(" · ");
  return [
    crumbHtml(locale, id),
    `<article class="kb breed">`,
    `<header class="tool-head"><p class="kicker">${escapeHtml(kicker)}</p><h1>${escapeHtml(name)}</h1><p class="kb-meta">${meta}</p></header>`,
    `<section class="kb-answer" aria-label="${escapeHtml(ui.answer)}"><h2>${escapeHtml(ui.answer)}</h2><p>${inline(copy.answer)}</p></section>`,
    imageHtml(locale, id),
    factsHtml(locale, id),
    `<nav class="kb-toc" aria-label="${escapeHtml(ui.toc)}"><h2>${escapeHtml(ui.toc)}</h2><ol>${toc}</ol></nav>`,
    sections,
    `<p class="meme-note">${escapeHtml(ui.notAdvice)}</p>`,
    faqHtml(locale, id),
    quizHtml(locale, id),
    related.length ? `<section class="learn-related"><h2>${escapeHtml(facts.fci && related.every((b) => breedFacts(locale, b).fci?.group === facts.fci!.group) ? fill(ui.relatedGroup, { group: facts.fci.group }) : ui.related)}</h2>${breedLinkItems(locale, related)}</section>` : "",
    sourcesHtml(locale, id),
    `<p class="more"><a href="${escapeHtml(breedsHref(locale))}" data-nav="breeds">${escapeHtml(ui.all)}</a></p>`,
    `</article>`,
  ].join("");
}

/** The breeds hub (null) or one breed as HTML: the client mounts it as is, and the Worker serves it to crawlers. */
export function breedsPageHtml(locale: Locale, id: BreedId | null): string {
  return id ? breedHtml(locale, id) : hubHtml(locale);
}
