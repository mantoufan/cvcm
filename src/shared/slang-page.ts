/**
 * The memes page HTML (hub and entries) with its trend and token panels, shared by the client page and the Worker's
 * crawler copy. Kept out of slang-i18n so the main bundle, which needs only titles, descriptions and JSON-LD, does not
 * carry it.
 */
import { CJK_LOCALES, type Locale } from "./locale";
import { escapeHtml } from "./device-i18n";
import { fill } from "./fill";
import { blockHtml, dateLabel, inline, linkListHtml } from "./article-html";
import { messages, slangMessages } from "./messages";
import { appHref, emojiHref, slangHref } from "./path";
import { SLANG_ENTRIES, SLANG_GROUPS, SLANG_META, isSong, slangGroupOf, type SlangId } from "./slang";
import { memeImage, memeImagePath } from "./meme-images";
import { compact, signed, usd } from "./number-format";
import { HREFLANG } from "./sitemap";
import { memeImageAlt, songArtists, slangUi, slangHub, slangCopy, slangName, slangFaqItems, slangUpdated, type MemeTrend, type MemeDir, type MemeCoin, type MemeData } from "./slang-i18n";

/**
 * The picture right under the answer, near the top of the page: loaded eagerly as the likely LCP element, with its size
 * fixed (no layout shift), alt in the reader's language and a credit linking the Commons file and the license.
 */
function imageHtml(locale: Locale, id: SlangId): string {
  const image = memeImage(id);
  if (!image) return "";
  const ui = slangUi(locale);
  const credit = image.author ? fill(ui.imageCredit, { author: image.author }) : ui.imageCreditAnon;
  return `<figure class="meme-figure"><img src="${escapeHtml(memeImagePath(id)!)}" width="${image.width}" height="${image.height}" alt="${escapeHtml(memeImageAlt(locale, id))}" fetchpriority="high" decoding="async">`
    + `<figcaption><a href="${escapeHtml(image.page)}" target="_blank" rel="noopener">${escapeHtml(credit)}</a> · <a href="${escapeHtml(image.licenseUrl)}" target="_blank" rel="noopener license">${escapeHtml(image.license)}</a></figcaption></figure>`;
}

const listFormats = new Map<Locale, Intl.ListFormat | null>();

/** Joins names the locale's way ("A、B和C", "A, B y C"); one cached formatter per locale. */
function joinNames(locale: Locale, names: string[]): string {
  if (!listFormats.has(locale)) {
    try {
      listFormats.set(locale, new Intl.ListFormat(HREFLANG[locale], { style: "long", type: "conjunction" }));
    } catch {
      listFormats.set(locale, null);
    }
  }
  return listFormats.get(locale)?.format(names) ?? names.join(", ");
}

/**
 * Artists as a list in the reader's language ("A, B y C", "A、B和C"), through a cached Intl.ListFormat. Korean takes
 * commas: its conjunction format uses the formal 및, which reads like a document here.
 */
export function songArtistsLabel(locale: Locale, id: SlangId): string {
  const names = songArtists(locale, id);
  return locale === "ko" ? names.join(", ") : joinNames(locale, names);
}

/** The snapshot comes with the slang pack (not the main bundle, which it would re-hash every day). */
function memeData(locale: Locale): MemeData {
  return slangMessages(locale).memes;
}

/**
 * Coin prices are never shown in Simplified Chinese: mainland rules (PBoC et al. 2021 notice) bar commercial display and
 * promotion of virtual currencies, and most zh-CN readers are in the mainland.
 */
export function showsCoins(locale: Locale): boolean {
  return locale !== "zh-CN";
}

export function memeTrend(locale: Locale, id: SlangId): MemeTrend | null {
  const t = memeData(locale).trend[id];
  return t && t.w.length && t.w.some((v) => v > 0) ? t : null;
}

/** Views over the last four weeks of a trend (the figure the page shows and the trending list weighs). */
export function recentViews(trend: MemeTrend): number {
  return trend.w.slice(-4).reduce((a, b) => a + b, 0);
}

/** Views over the four weeks before those. */
function priorViews(trend: MemeTrend): number {
  return trend.w.slice(-8, -4).reduce((a, b) => a + b, 0);
}

/** Rising when the last four weeks are a quarter above the four before, cooling off when a fifth below, else steady. */
export function memeDir(trend: MemeTrend): MemeDir {
  const recent = recentViews(trend);
  const before = priorViews(trend);
  // No views before (a new or renamed article): nothing to compare with, so not "rising".
  if (before === 0) return "flat";
  return recent >= before * 1.25 ? "up" : recent <= before * 0.8 ? "down" : "flat";
}

export function memeCoin(locale: Locale, id: SlangId): MemeCoin | null {
  return showsCoins(locale) ? memeData(locale).coins[id] ?? null : null;
}

/** An article needs this many views in four weeks to count as trending, so a tiny article's jump is not news. */
const TRENDING_FLOOR = 500;

/**
 * The hub's "popularity now" list: entries not cooling off, fastest-growing first (last four weeks over the four before).
 * Growth, not raw views, so memes measured on a smaller Wikipedia (zh) compete fairly with English ones; each keeps its
 * own rising/steady badge, so the list never claims a steady meme is rising.
 */
export function trendingIds(locale: Locale, limit: number): { id: SlangId; trend: MemeTrend; dir: MemeDir }[] {
  return SLANG_ENTRIES
    .flatMap((id) => {
      const trend = memeTrend(locale, id);
      if (!trend) return [];
      const recent = recentViews(trend);
      const prior = priorViews(trend);
      const dir = memeDir(trend);
      // Both windows need real traffic: a tiny or brand-new article's jump is not news.
      return recent >= TRENDING_FLOOR && prior >= TRENDING_FLOOR / 5 && dir !== "down" ? [{ id, trend, dir, recent, growth: recent / prior }] : [];
    })
    .sort((a, b) => b.growth - a.growth || b.recent - a.recent)
    .slice(0, limit)
    .map(({ id, trend, dir }) => ({ id, trend, dir }));
}

/** "2025-03" or "2025" as a month or a year in the reader's language. */
function bornLabel(locale: Locale, born: string): string {
  try {
    const [year, month] = born.split("-").map(Number);
    if (!month) return new Intl.DateTimeFormat(HREFLANG[locale], { year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, 0, 1)));
    return new Intl.DateTimeFormat(HREFLANG[locale], { year: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  } catch {
    return born;
  }
}

function changeHtml(locale: Locale, value: number): string {
  return `<span class="${value > 0 ? "up" : value < 0 ? "down" : ""}">${escapeHtml(signed(locale, value))}</span>`;
}

/** When the coin quotes were taken, "2026-11-13 05:37" (UTC). */
function coinsTime(locale: Locale): string {
  return memeData(locale).coinsAsOf?.replace("T", " ").replace("Z", "") ?? "";
}

function coinSourceHtml(locale: Locale, href: string): string {
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener nofollow">${escapeHtml(fill(slangUi(locale).coinSource, { time: coinsTime(locale) }))}</a>`;
}

function dirBadge(locale: Locale, dir: MemeDir): string {
  const ui = slangUi(locale);
  const label = { up: ui.trendUp, flat: ui.trendFlat, down: ui.trendDown }[dir];
  return `<span class="meme-dir meme-dir-${dir}">${escapeHtml(label)}</span>`;
}

/** Weekly views as an inline bar chart (no script, works in the crawler HTML too). */
function sparkHtml(locale: Locale, trend: MemeTrend): string {
  const max = Math.max(...trend.w, 1);
  const width = 6 * trend.w.length;
  const bars = trend.w.map((v, i) => {
    const h = Math.max(1, Math.round((v / max) * 30));
    return `<rect x="${i * 6}" y="${32 - h}" width="4" height="${h}" rx="1"><title>${escapeHtml(compact(locale, v))}</title></rect>`;
  }).join("");
  return `<svg class="meme-spark" viewBox="0 0 ${width} 32" width="${width * 2}" height="64" role="img" aria-label="${escapeHtml(slangUi(locale).trend)}">${bars}</svg>`;
}

function trendHtml(locale: Locale, id: SlangId): string {
  const trend = memeTrend(locale, id);
  if (!trend) return "";
  const ui = slangUi(locale);
  return `<section class="meme-trend" aria-labelledby="meme-trend-title"><h2 id="meme-trend-title">${escapeHtml(ui.trend)} ${dirBadge(locale, memeDir(trend))}</h2>`
    + `<div class="meme-trend-row">${sparkHtml(locale, trend)}<p><strong>${escapeHtml(compact(locale, recentViews(trend)))}</strong> <span>${escapeHtml(ui.recent)}</span></p></div>`
    + `<p class="meme-note">${escapeHtml(fill(ui.trendNote, { n: trend.w.length, date: dateLabel(locale, trend.to) }))}</p></section>`;
}

function coinHtml(locale: Locale, id: SlangId): string {
  const coin = memeCoin(locale, id);
  if (!coin) return "";
  const ui = slangUi(locale);
  const cells = [
    [ui.coinPrice, escapeHtml(usd(locale, coin.price))],
    [ui.coinCap, escapeHtml(usd(locale, coin.cap, true))],
    [ui.coinD1, changeHtml(locale, coin.d1)],
    [ui.coinD7, changeHtml(locale, coin.d7)],
    [ui.coinAdded, escapeHtml(dateLabel(locale, coin.added))],
  ].map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${v}</dd></div>`).join("");
  return `<section class="meme-coin" aria-labelledby="meme-coin-title"><h2 id="meme-coin-title">${escapeHtml(ui.coin)}</h2>`
    + `<p class="meme-coin-name"><strong>${escapeHtml(coin.name)}</strong> <span>${escapeHtml(coin.symbol)}</span></p>`
    + `<dl class="meme-coin-grid">${cells}</dl>`
    + `<p class="meme-note">${escapeHtml(ui.coinNote)}</p>`
    + `<p class="meme-note">${coinSourceHtml(locale, `https://coinmarketcap.com/currencies/${coin.slug}/`)}</p></section>`;
}

function hubTrendingHtml(locale: Locale): string {
  const list = trendingIds(locale, 10);
  if (!list.length) return "";
  const ui = slangUi(locale);
  const items = list.map(({ id, dir }) => {
    const { name, blurb } = slangName(locale, id);
    return `<li><a href="${escapeHtml(slangHref(locale, id))}" data-nav="slang-${id}"><strong>${escapeHtml(name)}</strong>${dirBadge(locale, dir)}<span>${escapeHtml(blurb)}</span></a></li>`;
  }).join("");
  return `<section class="wall meme-trending" id="trending"><h2>${escapeHtml(ui.trending)}</h2><ol class="links">${items}</ol><p class="meme-note">${escapeHtml(ui.trendingNote)}</p></section>`;
}

function hubCoinsHtml(locale: Locale): string {
  if (!showsCoins(locale)) return "";
  const coins = memeData(locale).coins;
  const ids = SLANG_ENTRIES.filter((id) => memeCoin(locale, id)).sort((a, b) => coins[b].cap - coins[a].cap);
  if (!ids.length) return "";
  const ui = slangUi(locale);
  const rows = ids.map((id) => {
    const c = coins[id];
    return `<tr><td><a href="${escapeHtml(slangHref(locale, id))}" data-nav="slang-${id}">${escapeHtml(slangName(locale, id).name)}</a></td><td>${escapeHtml(c.symbol)}</td><td>${escapeHtml(usd(locale, c.cap, true))}</td><td>${changeHtml(locale, c.d7)}</td></tr>`;
  }).join("");
  return `<section class="wall meme-coins" id="coins"><h2>${escapeHtml(ui.coins)}</h2><div class="table-wrap"><table><thead><tr><th>${escapeHtml(ui.coinMeme)}</th><th>${escapeHtml(ui.coinToken)}</th><th>${escapeHtml(ui.coinCap)}</th><th>${escapeHtml(ui.coinD7)}</th></tr></thead><tbody>${rows}</tbody></table></div>`
    + `<p class="meme-note">${escapeHtml(ui.coinNote)}</p><p class="meme-note">${coinSourceHtml(locale, "https://coinmarketcap.com/view/memes/")}</p></section>`;
}

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
      `<p class="slang-jump"><a href="${escapeHtml(appHref(locale, "meme"))}">${escapeHtml(ui.maker)}</a> · <a href="${escapeHtml(emojiHref(locale))}" data-nav="emoji">${escapeHtml(messages(locale).ui.nav.emoji)}</a></p>`,
      hubTrendingHtml(locale),
      groups,
      hubCoinsHtml(locale),
      `<section class="kb-about">${hub.about.map((p) => `<p>${inline(p)}</p>`).join("")}</section>`,
      faqHtml(locale, null),
    ].join("");
  }
  const copy = slangCopy(locale, id);
  const meta = SLANG_META[id];
  const cjk = CJK_LOCALES.has(locale);
  const toc = copy.sections.map((s, i) => `<li><a href="#slang-${i + 1}">${inline(s.h)}</a></li>`).join("");
  const sections = copy.sections.map((s, i) => (
    `<section class="kb-section" id="slang-${i + 1}"><h2>${inline(s.h)}</h2>${s.body.map(blockHtml).join("")}</section>`
  )).join("");
  // A song names its artists where other entries name the language they come from.
  const origin = isSong(id)
    ? songArtistsLabel(locale, id)
    : { zh: ui.originZh, en: ui.originEn, yue: ui.originYue, web: ui.originWeb }[meta.origin];
  const platform = meta.platform ? { douyin: ui.platformDouyin, tiktok: ui.platformTiktok, both: ui.platformBoth }[meta.platform] : null;
  return [
    crumbHtml(locale, id),
    `<article class="kb slang">`,
    `<header class="tool-head"><p class="kicker">${escapeHtml(ui.kicker)} · ${escapeHtml(groupLabels[slangGroupOf(id)])} · ${escapeHtml(origin)}</p>`,
    `<h1>${escapeHtml(copy.h1)}</h1>`,
    `<p class="kb-meta">${platform ? `<span class="meme-platform">${escapeHtml(platform)}</span> · ` : ""}${meta.born ? `<span class="meme-born">${escapeHtml(fill(isSong(id) ? ui.released : ui.born, { date: bornLabel(locale, meta.born) }))}</span> · ` : ""}<time datetime="${slangUpdated(id)}">${escapeHtml(fill(ui.updated, { date: dateLabel(locale, slangUpdated(id)) }))}</time></p>`,
    copy.aka.length ? `<p class="ref-aka">${escapeHtml(ui.also)}${cjk ? "：" : ": "}${escapeHtml(copy.aka.join(cjk ? "、" : ", "))}</p>` : "",
    `</header>`,
    `<section class="kb-answer" aria-label="${escapeHtml(ui.answer)}"><h2>${escapeHtml(ui.answer)}</h2><p>${inline(copy.answer)}</p></section>`,
    imageHtml(locale, id),
    trendHtml(locale, id),
    `<nav class="kb-toc" aria-label="${escapeHtml(ui.toc)}"><h2>${escapeHtml(ui.toc)}</h2><ol>${toc}</ol></nav>`,
    sections,
    coinHtml(locale, id),
    faqHtml(locale, id),
    sourcesHtml(locale, id),
    meta.related.length ? `<section class="learn-related"><h2>${escapeHtml(ui.related)}</h2>${linkListHtml(slangLinkItems(locale, meta.related))}</section>` : "",
    `<p class="more"><a href="${escapeHtml(slangHref(locale))}" data-nav="slang">${escapeHtml(ui.all)}</a></p>`,
    `</article>`,
  ].join("");
}
