/**
 * The Worker's page HTML: head tags (title, description, canonical, hreflang, Open Graph, JSON-LD) and the page body,
 * the prerendered markup when given, else a plain text copy built here. Kept out of seo.ts, which the main client
 * bundle imports for titles and descriptions: nothing on the client imports this module, so the page HTML builders it
 * uses (ideas-page.ts …) stay out of the main bundle.
 */
import { DEVICE_COVER, GAME_COVER, LEARN_COVER, MARKET_COVER, TOOL_COVER, coverUrl } from "./covers";
import { deviceBreadcrumbJsonLd, deviceFaqJsonLd, deviceStaticHtml, escapeHtml } from "./device-i18n";
import { gameById } from "./games";
import { toolHowToJsonLd } from "./guide";
import { legalBreadcrumbJsonLd, legalStaticHtml } from "./legal";
import { quizBreadcrumbJsonLd, quizFaqJsonLd, quizStaticHtml } from "./quiz-i18n";
import { datasetBreadcrumbJsonLd, datasetFaqJsonLd, datasetJsonLd, datasetStaticHtml } from "./datasets-i18n";
import { rankingBreadcrumbJsonLd, rankingFaqJsonLd, rankingJsonLd, rankingStaticHtml } from "./rankings-i18n";
import { kbArticleJsonLd, kbBreadcrumbJsonLd, kbFaqJsonLd } from "./kb-i18n";
import { kbPageHtml } from "./kb-page";
import { KB_SHELVES, kbArticleOf } from "./kb";
import { refArticleJsonLd, refBreadcrumbJsonLd, refFaqJsonLd } from "./ref-i18n";
import { refPageHtml } from "./ref-page";
import { slangArticleJsonLd, slangBreadcrumbJsonLd, slangFaqJsonLd } from "./slang-i18n";
import { slangPageHtml } from "./slang-page";
import { ideasArticleJsonLd, ideasBreadcrumbJsonLd, ideasFaqJsonLd } from "./ideas-i18n";
import { nostalgiaArticleJsonLd, nostalgiaBreadcrumbJsonLd, nostalgiaFaqJsonLd } from "./nostalgia-i18n";
import { nostalgiaPageHtml } from "./nostalgia-page";
import { summariesArticleJsonLd, summariesBreadcrumbJsonLd, summariesFaqJsonLd } from "./summaries-i18n";
import { scriptsArticleJsonLd, scriptsBreadcrumbJsonLd, scriptsFaqJsonLd } from "./scripts-i18n";
import { summariesPageHtml } from "./summaries-page";
import { scriptsPageHtml } from "./scripts-page";
import { countriesCollectionJsonLd, countryBreadcrumbJsonLd, countryFaqJsonLd } from "./countries-i18n";
import { countriesPageHtml } from "./countries-page";
import { caloriesBreadcrumbJsonLd, caloriesFaqJsonLd, caloriesPageJsonLd } from "./calories-i18n";
import { caloriesPageHtml } from "./calories-page";
import { elementsBreadcrumbJsonLd, elementsFaqJsonLd, elementsPageJsonLd } from "./elements-i18n";
import { elementsPageHtml } from "./elements-page";
import { emojiBreadcrumbJsonLd, emojiFaqJsonLd, emojiPageJsonLd } from "./emoji-i18n";
import { emojiPageHtml } from "./emoji-page";
import { currencyBreadcrumbJsonLd, currencyFaqJsonLd, currencyPageJsonLd } from "./currency-i18n";
import { currencyPageHtml } from "./currency-page";
import { currencyHref } from "./path";
import { lessonsForTool } from "./learn";
import { type Locale } from "./locale";
import { CATEGORIES, FEATURED_TUTORIALS, appHref, categoryOf, categoryLinks, deviceHref, gamesHref, learnHref, kbHref, legalHref, quizHref, datasetHref, rankingHref, refHref, slangHref, ideasHref, nostalgiaHref, summariesHref, scriptsHref, countriesHref, caloriesHref, elementsHref, calendarHref, emojiHref, type ToolId } from "./path";
import { calendarBreadcrumbJsonLd, calendarFaqJsonLd, calendarPageJsonLd } from "./calendar-i18n";
import { calendarPageHtml } from "./calendar-page";
import { ideasPageHtml } from "./ideas-page";
import { memeImagePath } from "./meme-images";
import { nostalgiaImagePath } from "./nostalgia-images";
import { BRANDED_TOOLS, faqJsonLd, flashHubHowToJsonLd, flashHubSoftwareJsonLd, gameBreadcrumbJsonLd, gameHowToJsonLd, gameVideoGameJsonLd, howToJsonLd, lookup, hreflangAlternates, marketBreadcrumbJsonLd, pageCanonical, pageDescription, pageTitle, toolBreadcrumbJsonLd, toolSoftwareJsonLd, tutorialBreadcrumbJsonLd, normalizeSeo, type SeoInput } from "./seo";

function ogImage(seo: SeoInput): string | null {
  if (seo.slang && seo.slangId) {
    const path = memeImagePath(seo.slangId);
    return path ? coverUrl(path) : null;
  }
  if (seo.nostalgia && seo.nostalgiaId) {
    const path = nostalgiaImagePath(seo.nostalgiaId);
    return path ? coverUrl(path) : null;
  }
  if (seo.learn && seo.tutorial) return coverUrl(LEARN_COVER[seo.tutorial]);
  if (seo.games && seo.game) return coverUrl(GAME_COVER[seo.game]);
  if (seo.markets && seo.market) return coverUrl(MARKET_COVER[seo.market]);
  if (seo.devicePage) return coverUrl(DEVICE_COVER);
  if (seo.tool) return coverUrl(TOOL_COVER[seo.tool]);
  return null;
}

/** Head tags for the page, and its body: the prerendered markup when given, else a plain text copy. */
export function applyHtmlSeo(
  html: string,
  locale: Locale,
  toolOrSeo: SeoInput | ToolId | null,
  clipId?: string | null,
  body?: string | null,
): string {
  const seo = normalizeSeo(toolOrSeo, clipId);
  const title = pageTitle(locale, seo);
  const description = pageDescription(locale, seo);
  const canonical = pageCanonical(locale, seo);
  const image = ogImage(seo);
  let out = html.replace(/<html\b[^>]*>/i, `<html lang="${escapeHtml(locale)}">`);
  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  out = out.replace(
    /(<meta\s+name="description"\s+content=")[^"]*(")/i,
    `$1${escapeHtml(description)}$2`,
  );
  if (/rel="canonical"/i.test(out)) {
    out = out.replace(
      /(<link\s+rel="canonical"\s+href=")[^"]*(")/i,
      `$1${escapeHtml(canonical)}$2`,
    );
  }
  out = out.replace(/<link\s+rel="alternate"\s+hreflang="[^"]*"\s+href="[^"]*"\s*\/?>\s*/gi, "");
  out = out.replace(/<meta property="og:(title|description|url|type|image|site_name|locale)"[^>]*>\s*/gi, "");
  out = out.replace(/<meta name="twitter:(card|title|description|image)"[^>]*>\s*/gi, "");
  out = out.replace(/<script type="application\/ld\+json" id="faq-jsonld">[\s\S]*?<\/script>\s*/gi, "");
  out = out.replace(/<script type="application\/ld\+json" id="howto-jsonld">[\s\S]*?<\/script>\s*/gi, "");
  out = out.replace(/<script type="application\/ld\+json" id="game-jsonld">[\s\S]*?<\/script>\s*/gi, "");
  out = out.replace(/<script type="application\/ld\+json" id="breadcrumb-jsonld">[\s\S]*?<\/script>\s*/gi, "");
  out = out.replace(/<script type="application\/ld\+json" id="software-jsonld">[\s\S]*?<\/script>\s*/gi, "");
  out = out.replace(/<script type="application\/ld\+json" id="dataset-jsonld">[\s\S]*?<\/script>\s*/gi, "");
  out = out.replace(/<script type="application\/ld\+json" id="article-jsonld">[\s\S]*?<\/script>\s*/gi, "");
  const tags = [
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:type" content="${(seo.learn && seo.tutorial) || seo.game || (seo.kb && kbArticleOf(seo.kbId ?? null)) || (seo.ref && seo.refId) || (seo.slang && seo.slangId) || (seo.ideas && seo.ideaId) || (seo.nostalgia && seo.nostalgiaId) || (seo.summaries && seo.summaryId) || (seo.scripts && seo.scriptId) ? "article" : "website"}" />`,
    `<meta property="og:site_name" content="cv.cm" />`,
    `<meta property="og:locale" content="${escapeHtml(locale.replace("-", "_"))}" />`,
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
  ];
  if (image) {
    tags.push(
      `<meta property="og:image" content="${escapeHtml(image)}" />`,
      `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    );
  }
  for (const alt of hreflangAlternates(seo)) {
    tags.push(`<link rel="alternate" hreflang="${escapeHtml(alt.hreflang)}" href="${escapeHtml(alt.href)}" />`);
  }
  const ld = faqJsonLd(
    locale,
    seo.tool ?? null,
    seo.learn ? seo.tutorial : null,
    seo.game ?? null,
    Boolean(seo.games && !seo.game),
    seo.convertJob,
    seo.resizeJob,
    seo.market ?? null,
    Boolean(seo.markets && !seo.market),
    seo.console,
  );
  if (seo.devicePage) {
    tags.push(
      `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(deviceBreadcrumbJsonLd(locale, seo.devicePage)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="faq-jsonld">${JSON.stringify(deviceFaqJsonLd(locale, seo.devicePage)).replace(/</g, "\\u003c")}</script>`,
    );
  } else if (seo.calories) {
    tags.push(
      `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(caloriesBreadcrumbJsonLd(locale, seo.foodId ?? null)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="faq-jsonld">${JSON.stringify(caloriesFaqJsonLd(locale, seo.foodId ?? null)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="article-jsonld">${JSON.stringify(caloriesPageJsonLd(locale, seo.foodId ?? null)).replace(/</g, "\\u003c")}</script>`,
    );
  } else if (seo.calendar) {
    const page = seo.calendarPage ?? "hub";
    tags.push(
      `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(calendarBreadcrumbJsonLd(locale, page)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="faq-jsonld">${JSON.stringify(calendarFaqJsonLd(locale, page)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="article-jsonld">${JSON.stringify(calendarPageJsonLd(locale, page)).replace(/</g, "\\u003c")}</script>`,
    );
  } else if (seo.nostalgia) {
    tags.push(
      `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(nostalgiaBreadcrumbJsonLd(locale, seo.nostalgiaId ?? null)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="faq-jsonld">${JSON.stringify(nostalgiaFaqJsonLd(locale, seo.nostalgiaId ?? null)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="article-jsonld">${JSON.stringify(nostalgiaArticleJsonLd(locale, seo.nostalgiaId ?? null)).replace(/</g, "\\u003c")}</script>`,
    );
  } else if (seo.summaries) {
    tags.push(
      `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(summariesBreadcrumbJsonLd(locale, seo.summaryId ?? null)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="faq-jsonld">${JSON.stringify(summariesFaqJsonLd(locale, seo.summaryId ?? null)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="article-jsonld">${JSON.stringify(summariesArticleJsonLd(locale, seo.summaryId ?? null)).replace(/</g, "\\u003c")}</script>`,
    );
  } else if (seo.currency) {
    tags.push(
      `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(currencyBreadcrumbJsonLd(locale, seo.currencyPair ?? null)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="faq-jsonld">${JSON.stringify(currencyFaqJsonLd(locale, seo.currencyPair ?? null)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="article-jsonld">${JSON.stringify(currencyPageJsonLd(locale, seo.currencyPair ?? null)).replace(/</g, "\\u003c")}</script>`,
    );
  } else if (seo.scripts) {
    tags.push(
      `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(scriptsBreadcrumbJsonLd(locale, seo.scriptId ?? null)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="faq-jsonld">${JSON.stringify(scriptsFaqJsonLd(locale, seo.scriptId ?? null)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="article-jsonld">${JSON.stringify(scriptsArticleJsonLd(locale, seo.scriptId ?? null)).replace(/</g, "\\u003c")}</script>`,
    );
  } else if (seo.emoji) {
    tags.push(
      `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(emojiBreadcrumbJsonLd(locale, seo.emojiSlug ?? null)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="faq-jsonld">${JSON.stringify(emojiFaqJsonLd(locale, seo.emojiSlug ?? null)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="article-jsonld">${JSON.stringify(emojiPageJsonLd(locale, seo.emojiSlug ?? null)).replace(/</g, "\\u003c")}</script>`,
    );
  } else if (seo.elements) {
    tags.push(
      `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(elementsBreadcrumbJsonLd(locale, seo.elementSlug ?? null)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="faq-jsonld">${JSON.stringify(elementsFaqJsonLd(locale, seo.elementSlug ?? null)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="article-jsonld">${JSON.stringify(elementsPageJsonLd(locale, seo.elementSlug ?? null)).replace(/</g, "\\u003c")}</script>`,
    );
  } else if (seo.slang) {
    tags.push(
      `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(slangBreadcrumbJsonLd(locale, seo.slangId ?? null)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="faq-jsonld">${JSON.stringify(slangFaqJsonLd(locale, seo.slangId ?? null)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="article-jsonld">${JSON.stringify(slangArticleJsonLd(locale, seo.slangId ?? null)).replace(/</g, "\\u003c")}</script>`,
    );
  } else if (seo.ideas) {
    tags.push(
      `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(ideasBreadcrumbJsonLd(locale, seo.ideaId ?? null)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="faq-jsonld">${JSON.stringify(ideasFaqJsonLd(locale, seo.ideaId ?? null)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="article-jsonld">${JSON.stringify(ideasArticleJsonLd(locale, seo.ideaId ?? null)).replace(/</g, "\\u003c")}</script>`,
    );
  } else if (seo.ref) {
    tags.push(
      `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(refBreadcrumbJsonLd(locale, seo.refId ?? null)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="faq-jsonld">${JSON.stringify(refFaqJsonLd(locale, seo.refId ?? null)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="article-jsonld">${JSON.stringify(refArticleJsonLd(locale, seo.refId ?? null)).replace(/</g, "\\u003c")}</script>`,
    );
  } else if (seo.kb) {
    tags.push(
      `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(kbBreadcrumbJsonLd(locale, seo.kbId ?? null)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="faq-jsonld">${JSON.stringify(kbFaqJsonLd(locale, seo.kbId ?? null)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="article-jsonld">${JSON.stringify(kbArticleJsonLd(locale, seo.kbId ?? null)).replace(/</g, "\\u003c")}</script>`,
    );
  } else if (seo.quiz) {
    tags.push(
      `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(quizBreadcrumbJsonLd(locale, seo.quizId ?? null)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="faq-jsonld">${JSON.stringify(quizFaqJsonLd(locale, seo.quizId ?? null)).replace(/</g, "\\u003c")}</script>`,
    );
  } else if (seo.ranking) {
    const id = seo.rankingId ?? null;
    tags.push(
      `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(rankingBreadcrumbJsonLd(locale, id)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="faq-jsonld">${JSON.stringify(rankingFaqJsonLd(locale, id)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="dataset-jsonld">${JSON.stringify(rankingJsonLd(locale, id)).replace(/</g, "\\u003c")}</script>`,
    );
  } else if (seo.dataset) {
    const id = seo.datasetId ?? null;
    tags.push(
      `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(datasetBreadcrumbJsonLd(locale, id)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="faq-jsonld">${JSON.stringify(datasetFaqJsonLd(locale, id)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="dataset-jsonld">${JSON.stringify(datasetJsonLd(locale, id)).replace(/</g, "\\u003c")}</script>`,
    );
  } else if (seo.legalPage) {
    tags.push(
      `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(legalBreadcrumbJsonLd(locale, seo.legalPage)).replace(/</g, "\\u003c")}</script>`,
    );
  } else if (seo.markets) {
    tags.push(
      `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(marketBreadcrumbJsonLd(locale, seo.market ?? null)).replace(/</g, "\\u003c")}</script>`,
    );
  } else if (seo.learn) {
    tags.push(
      `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(tutorialBreadcrumbJsonLd(locale, seo.tutorial ?? null)).replace(/</g, "\\u003c")}</script>`,
    );
  } else if (seo.games) {
    const consoleId = seo.game ? gameById(seo.game)?.console ?? null : seo.console ?? null;
    tags.push(
      `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(gameBreadcrumbJsonLd(locale, consoleId, seo.game ?? null)).replace(/</g, "\\u003c")}</script>`,
    );
  }
  if (ld && !seo.devicePage && !seo.legalPage && !seo.quiz && !seo.dataset && !seo.ranking && !seo.kb && !seo.ref && !seo.slang && !seo.ideas && !seo.nostalgia && !seo.summaries && !seo.scripts && !seo.countries && !seo.calories && !seo.elements && !seo.calendar && !seo.emoji && !seo.currency) {
    tags.push(
      `<script type="application/ld+json" id="faq-jsonld">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
    );
  }
  if (seo.countries) {
    const collection = countriesCollectionJsonLd(locale, seo.countryId ?? null);
    tags.push(
      `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(countryBreadcrumbJsonLd(locale, seo.countryId ?? null)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="faq-jsonld">${JSON.stringify(countryFaqJsonLd(locale, seo.countryId ?? null)).replace(/</g, "\\u003c")}</script>`,
      ...(collection ? [`<script type="application/ld+json" id="article-jsonld">${JSON.stringify(collection).replace(/</g, "\\u003c")}</script>`] : []),
    );
  }
  if (seo.game) {
    tags.push(
      `<script type="application/ld+json" id="howto-jsonld">${JSON.stringify(gameHowToJsonLd(locale, seo.game)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="game-jsonld">${JSON.stringify(gameVideoGameJsonLd(locale, seo.game)).replace(/</g, "\\u003c")}</script>`,
    );
  } else if (seo.games && seo.console === "flash") {
    tags.push(
      `<script type="application/ld+json" id="howto-jsonld">${JSON.stringify(flashHubHowToJsonLd(locale)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="software-jsonld">${JSON.stringify(flashHubSoftwareJsonLd(locale)).replace(/</g, "\\u003c")}</script>`,
    );
  }
  const howTo = seo.game
    ? null
    : seo.learn && seo.tutorial
      ? howToJsonLd(locale, seo.tutorial)
      : !seo.learn && !seo.games && !seo.markets && !seo.devicePage && !seo.legalPage && !seo.quiz && !seo.dataset && !seo.ranking && !seo.kb && !seo.ref && !seo.slang && !seo.ideas && !seo.nostalgia && !seo.summaries && !seo.scripts && !seo.elements && !seo.calendar && seo.tool && !seo.emoji && !seo.currency
        ? toolHowToJsonLd(locale, seo.tool)
        : null;
  if (howTo) {
    tags.push(
      `<script type="application/ld+json" id="howto-jsonld">${JSON.stringify(howTo).replace(/</g, "\\u003c")}</script>`,
    );
  }
  const isToolPage = !seo.learn && !seo.games && !seo.markets && !seo.devicePage && !seo.legalPage && !seo.quiz && !seo.dataset && !seo.ranking && !seo.kb && !seo.ref && !seo.slang && !seo.ideas && !seo.nostalgia && !seo.summaries && !seo.scripts && !seo.elements && !seo.calendar && seo.tool && !seo.clipId && !seo.emoji && !seo.currency && !seo.clipId;
  if (isToolPage && seo.tool) {
    tags.push(
      `<script type="application/ld+json" id="software-jsonld">${JSON.stringify(toolSoftwareJsonLd(locale, seo.tool)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(toolBreadcrumbJsonLd(locale, seo.tool)).replace(/</g, "\\u003c")}</script>`,
    );
    if (BRANDED_TOOLS.has(seo.tool)) {
      out = out.replace(/(<link\s+rel="icon"\s+href=")[^"]*("\s+type="image\/svg\+xml")/i, "$1/brand/safemark.svg$2");
      out = out.replace(/(<link\s+rel="apple-touch-icon"\s+href=")[^"]*(")/i, "$1/brand/safemark-180.png$2");
    }
  }
  out = out.replace("</head>", () => `${tags.join("\n    ")}\n  </head>`);
  const inner = body ? body : seo.devicePage
    ? deviceStaticHtml(locale, seo.devicePage)
    : seo.legalPage
    ? legalStaticHtml(locale, seo.legalPage)
    : seo.quiz
    ? quizStaticHtml(locale, seo.quizId ?? null)
    : seo.ranking
    ? rankingStaticHtml(locale, seo.rankingId ?? null)
    : seo.dataset
    ? datasetStaticHtml(locale, seo.datasetId ?? null)
    : seo.kb
    ? kbPageHtml(locale, seo.kbId ?? null)
    : seo.ref
    ? refPageHtml(locale, seo.refId ?? null)
    : seo.slang
    ? slangPageHtml(locale, seo.slangId ?? null)
    : seo.ideas
    ? ideasPageHtml(locale, seo.ideaId ?? null)
    : seo.nostalgia
    ? nostalgiaPageHtml(locale, seo.nostalgiaId ?? null)
    : seo.summaries
    ? summariesPageHtml(locale, seo.summaryId ?? null)
    : seo.scripts
    ? scriptsPageHtml(locale, seo.scriptId ?? null)
    : seo.countries
    ? countriesPageHtml(locale, seo.countryId ?? null)
    : seo.calories
    ? caloriesPageHtml(locale, seo.foodId ?? null)
    : seo.currency
    ? currencyPageHtml(locale, seo.currencyPair ?? null)
    : seo.elements
    ? elementsPageHtml(locale, seo.elementSlug ?? null)
    : seo.emoji
    ? emojiPageHtml(locale, seo.emojiSlug ?? null)
    : seo.calendar
    ? calendarPageHtml(locale, seo.calendarPage ?? "hub")
    : staticPageHtml(locale, seo, title, description, ld, howTo ?? (seo.game ? gameHowToJsonLd(locale, seo.game) : null));
  // A function replacement: page text may contain "$&" or "$1", which a string replacement would expand.
  out = out.replace(/<div id="app">[\s\S]*?<\/div>/, () => `<div id="app">${inner}</div>`);
  return out;
}

type LdStep = { name?: string; text?: string };
type LdQuestion = { name?: string; acceptedAnswer?: { text?: string } };

function linkText(title: string): string {
  return title.replace(/\s+[—|-]\s+cv\.cm$/i, "");
}

/** Every kb shelf hub (knowledge, coding, AI, photography…), in KB_SHELVES order. */
function kbHubLinks(locale: Locale): { href: string; text: string }[] {
  return Object.values(KB_SHELVES).map((shelf) => ({ href: kbHref(locale, shelf.hub), text: linkText(pageTitle(locale, { kb: true, kbId: shelf.hub })) }));
}

function linkList(items: { href: string; text: string }[]): string {
  if (items.length === 0) return "";
  return `<ul>${items.map((item) => `<li><a href="${escapeHtml(item.href)}">${escapeHtml(item.text)}</a></li>`).join("")}</ul>`;
}

function toolLinks(locale: Locale, tools: readonly ToolId[]): { href: string; text: string }[] {
  return tools.map((tool) => ({ href: appHref(locale, tool), text: linkText(pageTitle(locale, tool)) }));
}

/** Text-only page body for pages without prerendered markup (clip notes, a page the prerender skipped). */
function staticPageHtml(
  locale: Locale,
  seo: SeoInput,
  title: string,
  description: string,
  faq: Record<string, unknown> | null,
  howTo: Record<string, unknown> | null,
): string {
  const parts = [`<h1>${escapeHtml(linkText(title))}</h1>`, `<p>${escapeHtml(description)}</p>`];
  const steps = ((howTo?.step as LdStep[] | undefined) ?? []).filter((step) => step.name || step.text);
  if (steps.length > 0) {
    parts.push(`<ol>${steps.map((step) => `<li><strong>${escapeHtml(step.name ?? "")}</strong> ${escapeHtml(step.text ?? "")}</li>`).join("")}</ol>`);
  }
  const questions = (faq?.mainEntity as LdQuestion[] | undefined) ?? [];
  if (questions.length > 0) {
    parts.push(`<section>${questions.map((q) => `<h2>${escapeHtml(q.name ?? "")}</h2><p>${escapeHtml(q.acceptedAnswer?.text ?? "")}</p>`).join("")}</section>`);
  }
  const home = { href: appHref(locale, null), text: linkText(pageTitle(locale, null)) };
  if (seo.learn) {
    const tutorials = FEATURED_TUTORIALS
      .filter((id) => id !== seo.tutorial)
      .map((id) => ({ href: learnHref(locale, id), text: linkText(pageTitle(locale, { learn: true, tutorial: id })) }));
    const kbHubs = kbHubLinks(locale);
    parts.push(linkList(seo.tutorial ? [{ href: learnHref(locale, null), text: linkText(pageTitle(locale, { learn: true })) }, ...kbHubs, ...tutorials] : [...kbHubs, ...tutorials]));
  } else if (seo.games || seo.markets) {
    parts.push(linkList([home]));
  } else if (seo.tool) {
    const cat = categoryOf(seo.tool);
    const siblings = (CATEGORIES.find((c) => c.id === cat)?.tools ?? []).filter((id) => id !== seo.tool) as ToolId[];
    const lessons = lessonsForTool(seo.tool).map((id) => ({ href: learnHref(locale, id), text: linkText(pageTitle(locale, { learn: true, tutorial: id })) }));
    const extras = categoryLinks(cat).map((x) => ({ href: x.href(locale), text: lookup(locale, x.nameKey) }));
    parts.push(linkList([home, ...toolLinks(locale, siblings), ...extras, ...lessons]));
  } else {
    for (const cat of CATEGORIES) parts.push(linkList([...toolLinks(locale, cat.tools as readonly ToolId[]), ...categoryLinks(cat.id).map((x) => ({ href: x.href(locale), text: lookup(locale, x.nameKey) }))]));
    parts.push(linkList([
      { href: learnHref(locale, null), text: linkText(pageTitle(locale, { learn: true })) },
      { href: gamesHref(locale, null, null), text: linkText(pageTitle(locale, { games: true })) },
      { href: deviceHref(locale, "hub"), text: linkText(pageTitle(locale, { devicePage: "hub" })) },
      { href: quizHref(locale), text: linkText(pageTitle(locale, { quiz: true })) },
      { href: datasetHref(locale), text: linkText(pageTitle(locale, { dataset: true })) },
      { href: rankingHref(locale), text: linkText(pageTitle(locale, { ranking: true })) },
      ...kbHubLinks(locale),
      { href: refHref(locale), text: linkText(pageTitle(locale, { ref: true })) },
      { href: slangHref(locale), text: linkText(pageTitle(locale, { slang: true })) },
      { href: ideasHref(locale), text: linkText(pageTitle(locale, { ideas: true })) },
      { href: nostalgiaHref(locale), text: linkText(pageTitle(locale, { nostalgia: true })) },
      { href: summariesHref(locale), text: linkText(pageTitle(locale, { summaries: true })) },
      { href: scriptsHref(locale), text: linkText(pageTitle(locale, { scripts: true })) },
      { href: countriesHref(locale), text: linkText(pageTitle(locale, { countries: true })) },
      { href: caloriesHref(locale), text: linkText(pageTitle(locale, { calories: true })) },
      { href: elementsHref(locale), text: linkText(pageTitle(locale, { elements: true })) },
      { href: emojiHref(locale), text: linkText(pageTitle(locale, { emoji: true })) },
      { href: calendarHref(locale), text: linkText(pageTitle(locale, { calendar: true })) },
      { href: currencyHref(locale), text: linkText(pageTitle(locale, { currency: true })) },
      { href: legalHref(locale, "privacy"), text: linkText(pageTitle(locale, { legalPage: "privacy" })) },
      { href: legalHref(locale, "terms"), text: linkText(pageTitle(locale, { legalPage: "terms" })) },
    ]));
  }
  return `<div class="page"><header class="top"><a class="brand" href="${escapeHtml(appHref(locale, null))}">cv.cm</a></header><main id="main" class="tool-head">${parts.join("")}</main></div>`;
}
