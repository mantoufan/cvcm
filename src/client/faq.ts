import type { RankingId } from "../shared/rankings";
import { rankingBreadcrumbJsonLd, rankingFaqJsonLd, rankingJsonLd } from "../shared/rankings-i18n";
import { h } from "./dom";
import { t } from "./i18n";
import { toolHowToJsonLd } from "../shared/guide";
import {
  convertJobFaqItems,
  faqItems,
  resizeJobFaqItems,
  faqJsonLd,
  flashHubHowToJsonLd,
  flashHubSoftwareJsonLd,
  gameBreadcrumbJsonLd,
  gameHowToJsonLd,
  gameVideoGameJsonLd,
  howToJsonLd,
  learnFaqItems,
  marketBreadcrumbJsonLd,
  toolBreadcrumbJsonLd,
  toolSoftwareJsonLd,
  tutorialBreadcrumbJsonLd,
  type FaqItem,
} from "../shared/seo";
import type { Locale } from "../shared/locale";
import { gameById, type GameConsoleId, type GameId } from "../shared/games";
import type { MarketId } from "../shared/markets";
import { deviceBreadcrumbJsonLd, deviceFaqJsonLd } from "../shared/device-i18n";
import { quizBreadcrumbJsonLd, quizFaqJsonLd } from "../shared/quiz-i18n";
import type { QuizId } from "../shared/quiz";
import { datasetBreadcrumbJsonLd, datasetFaqJsonLd, datasetJsonLd } from "../shared/datasets-i18n";
import type { DatasetId } from "../shared/datasets";
import { kbArticleJsonLd, kbBreadcrumbJsonLd, kbFaqJsonLd } from "../shared/kb-i18n";
import type { KbPage } from "../shared/kb";
import { refArticleJsonLd, refBreadcrumbJsonLd, refFaqJsonLd } from "../shared/ref-i18n";
import type { RefPage } from "../shared/ref";
import { slangArticleJsonLd, slangBreadcrumbJsonLd, slangFaqJsonLd } from "../shared/slang-i18n";
import type { SlangPage } from "../shared/slang";
import { ideasArticleJsonLd, ideasBreadcrumbJsonLd, ideasFaqJsonLd } from "../shared/ideas-i18n";
import type { IdeaPage } from "../shared/ideas";
import { nostalgiaArticleJsonLd, nostalgiaBreadcrumbJsonLd, nostalgiaFaqJsonLd } from "../shared/nostalgia-i18n";
import type { NostalgiaPage } from "../shared/nostalgia";
import { summariesArticleJsonLd, summariesBreadcrumbJsonLd, summariesFaqJsonLd } from "../shared/summaries-i18n";
import { scriptsArticleJsonLd, scriptsBreadcrumbJsonLd, scriptsFaqJsonLd } from "../shared/scripts-i18n";
import type { SummaryPage } from "../shared/summaries";
import type { ScriptPage } from "../shared/scripts";
import { countriesCollectionJsonLd, countryBreadcrumbJsonLd, countryFaqJsonLd } from "../shared/countries-i18n";
import type { CountryPage } from "../shared/countries";
import { caloriesBreadcrumbJsonLd, caloriesFaqJsonLd, caloriesPageJsonLd } from "../shared/calories-i18n";
import type { CaloriesPage } from "../shared/calories";
import { elementsBreadcrumbJsonLd, elementsFaqJsonLd, elementsPageJsonLd } from "../shared/elements-i18n";
import type { ElementsPage } from "../shared/elements";
import { emojiBreadcrumbJsonLd, emojiFaqJsonLd, emojiPageJsonLd } from "../shared/emoji-i18n";
import type { EmojiPage } from "../shared/emoji";
import { calendarBreadcrumbJsonLd, calendarFaqJsonLd, calendarPageJsonLd } from "../shared/calendar-i18n";
import type { CalendarPage } from "../shared/calendar";
import type { DevicePageId } from "../shared/device";
import { legalBreadcrumbJsonLd } from "../shared/legal";
import type { ConvertJobId, LegalPageId, ResizeJobId, ToolId, TutorialId } from "../shared/path";

function renderFaq(items: FaqItem[]): HTMLElement {
  if (items.length === 0) return h("section", { class: "faq", hidden: true });
  return h("section", { class: "faq", "aria-labelledby": "faq-title" },
    h("h2", { id: "faq-title" }, t("faq.title")),
    ...items.map((item, i) =>
      h("details", i === 0 ? { open: true } : null,
        h("summary", null, item.q),
        h("p", null, item.a),
      ),
    ),
  );
}

export function faqSection(
  locale: Locale,
  tool: ToolId,
  convertJob?: ConvertJobId | null,
  resizeJob?: ResizeJobId | null,
): HTMLElement {
  syncPageJsonLd(locale, tool, null, null, false, convertJob, resizeJob);
  const items = tool === "convert" && convertJob
    ? convertJobFaqItems(locale, convertJob)
    : tool === "resize" && resizeJob
      ? resizeJobFaqItems(locale, resizeJob)
      : faqItems(locale, tool);
  return renderFaq(items);
}

export function learnFaqSection(locale: Locale, tutorial: TutorialId): HTMLElement {
  syncPageJsonLd(locale, null, tutorial);
  return renderFaq(learnFaqItems(locale, tutorial));
}

export function syncFaqJsonLd(locale: Locale, tool: ToolId | null): void {
  syncPageJsonLd(locale, tool, null);
}

export function syncPageJsonLd(
  locale: Locale,
  tool: ToolId | null,
  tutorial: TutorialId | null,
  game: GameId | null = null,
  gamesHub = false,
  convertJob: ConvertJobId | null = null,
  resizeJob: ResizeJobId | null = null,
  market: MarketId | null = null,
  marketsHub = false,
  devicePage: DevicePageId | null = null,
  gamesConsole: GameConsoleId | null = null,
  legalPage: LegalPageId | null = null,
  quizPage: QuizId | "hub" | null = null,
  datasetPage: DatasetId | "hub" | null = null,
  kbPage: KbPage = null,
  refPage: RefPage = null,
  rankingPage: RankingId | "hub" | null = null,
  slangPage: SlangPage = null,
  learnHub = false,
  ideasPage: IdeaPage = null,
  nostalgiaPage: NostalgiaPage = null,
  countriesPage: CountryPage = null,
  caloriesPage: CaloriesPage = null,
  elementsPage: ElementsPage = null,
  calendarPage: CalendarPage | null = null,
  summariesPage: SummaryPage = null,
  scriptsPage: ScriptPage = null,
  emojiPage: EmojiPage = null,
): void {
  if (emojiPage) {
    const slug = emojiPage === "hub" ? null : emojiPage;
    for (const key of ["howto-jsonld", "game-jsonld", "software-jsonld", "dataset-jsonld"]) writeJsonLd(key, null);
    writeJsonLd("article-jsonld", emojiPageJsonLd(locale, slug));
    writeJsonLd("faq-jsonld", emojiFaqJsonLd(locale, slug));
    writeJsonLd("breadcrumb-jsonld", emojiBreadcrumbJsonLd(locale, slug));
    return;
  }
  if (elementsPage) {
    const slug = elementsPage === "hub" ? null : elementsPage;
    for (const key of ["howto-jsonld", "game-jsonld", "software-jsonld", "dataset-jsonld"]) writeJsonLd(key, null);
    writeJsonLd("article-jsonld", elementsPageJsonLd(locale, slug));
    writeJsonLd("faq-jsonld", elementsFaqJsonLd(locale, slug));
    writeJsonLd("breadcrumb-jsonld", elementsBreadcrumbJsonLd(locale, slug));
    return;
  }
  const refId = refPage === "hub" ? null : refPage;
  const slangId = slangPage === "hub" ? null : slangPage;
  const ideaId = ideasPage === "hub" ? null : ideasPage;
  const nostalgiaId = nostalgiaPage === "hub" ? null : nostalgiaPage;
  const summaryId = summariesPage === "hub" ? null : summariesPage;
  const scriptId = scriptsPage === "hub" ? null : scriptsPage;
  writeJsonLd("article-jsonld", kbPage ? kbArticleJsonLd(locale, kbPage) : refPage ? refArticleJsonLd(locale, refId) : slangPage ? slangArticleJsonLd(locale, slangId) : ideasPage ? ideasArticleJsonLd(locale, ideaId) : nostalgiaPage ? nostalgiaArticleJsonLd(locale, nostalgiaId) : summariesPage ? summariesArticleJsonLd(locale, summaryId) : scriptsPage ? scriptsArticleJsonLd(locale, scriptId) : calendarPage ? calendarPageJsonLd(locale, calendarPage) : null);
  if (datasetPage) {
    const id = datasetPage === "hub" ? null : datasetPage;
    for (const key of ["howto-jsonld", "game-jsonld", "software-jsonld"]) writeJsonLd(key, null);
    writeJsonLd("faq-jsonld", datasetFaqJsonLd(locale, id));
    writeJsonLd("breadcrumb-jsonld", datasetBreadcrumbJsonLd(locale, id));
    writeJsonLd("dataset-jsonld", datasetJsonLd(locale, id));
    return;
  }
  if (rankingPage) {
    const id = rankingPage === "hub" ? null : rankingPage;
    for (const key of ["howto-jsonld", "game-jsonld", "software-jsonld"]) writeJsonLd(key, null);
    writeJsonLd("faq-jsonld", rankingFaqJsonLd(locale, id));
    writeJsonLd("breadcrumb-jsonld", rankingBreadcrumbJsonLd(locale, id));
    writeJsonLd("dataset-jsonld", rankingJsonLd(locale, id));
    return;
  }
  writeJsonLd("dataset-jsonld", null);
  if (countriesPage) {
    const slug = countriesPage === "hub" ? null : countriesPage;
    for (const key of ["howto-jsonld", "game-jsonld", "software-jsonld"]) writeJsonLd(key, null);
    writeJsonLd("faq-jsonld", countryFaqJsonLd(locale, slug));
    writeJsonLd("breadcrumb-jsonld", countryBreadcrumbJsonLd(locale, slug));
    writeJsonLd("article-jsonld", countriesCollectionJsonLd(locale, slug));
    return;
  }
  if (caloriesPage) {
    const foodId = caloriesPage === "hub" ? null : caloriesPage;
    for (const key of ["howto-jsonld", "game-jsonld", "software-jsonld"]) writeJsonLd(key, null);
    writeJsonLd("faq-jsonld", caloriesFaqJsonLd(locale, foodId));
    writeJsonLd("breadcrumb-jsonld", caloriesBreadcrumbJsonLd(locale, foodId));
    writeJsonLd("article-jsonld", caloriesPageJsonLd(locale, foodId));
    return;
  }
  if (ideasPage) {
    for (const key of ["howto-jsonld", "game-jsonld", "software-jsonld"]) writeJsonLd(key, null);
    writeJsonLd("faq-jsonld", ideasFaqJsonLd(locale, ideaId));
    writeJsonLd("breadcrumb-jsonld", ideasBreadcrumbJsonLd(locale, ideaId));
    return;
  }
  if (calendarPage) {
    for (const key of ["howto-jsonld", "game-jsonld", "software-jsonld"]) writeJsonLd(key, null);
    writeJsonLd("faq-jsonld", calendarFaqJsonLd(locale, calendarPage));
    writeJsonLd("breadcrumb-jsonld", calendarBreadcrumbJsonLd(locale, calendarPage));
    return;
  }
  if (nostalgiaPage) {
    for (const key of ["howto-jsonld", "game-jsonld", "software-jsonld"]) writeJsonLd(key, null);
    writeJsonLd("faq-jsonld", nostalgiaFaqJsonLd(locale, nostalgiaId));
    writeJsonLd("breadcrumb-jsonld", nostalgiaBreadcrumbJsonLd(locale, nostalgiaId));
    return;
  }
  if (summariesPage) {
    for (const key of ["howto-jsonld", "game-jsonld", "software-jsonld"]) writeJsonLd(key, null);
    writeJsonLd("faq-jsonld", summariesFaqJsonLd(locale, summaryId));
    writeJsonLd("breadcrumb-jsonld", summariesBreadcrumbJsonLd(locale, summaryId));
    return;
  }
  if (scriptsPage) {
    for (const key of ["howto-jsonld", "game-jsonld", "software-jsonld"]) writeJsonLd(key, null);
    writeJsonLd("faq-jsonld", scriptsFaqJsonLd(locale, scriptId));
    writeJsonLd("breadcrumb-jsonld", scriptsBreadcrumbJsonLd(locale, scriptId));
    return;
  }
  if (slangPage) {
    for (const key of ["howto-jsonld", "game-jsonld", "software-jsonld"]) writeJsonLd(key, null);
    writeJsonLd("faq-jsonld", slangFaqJsonLd(locale, slangId));
    writeJsonLd("breadcrumb-jsonld", slangBreadcrumbJsonLd(locale, slangId));
    return;
  }
  if (refPage) {
    for (const key of ["howto-jsonld", "game-jsonld", "software-jsonld"]) writeJsonLd(key, null);
    writeJsonLd("faq-jsonld", refFaqJsonLd(locale, refId));
    writeJsonLd("breadcrumb-jsonld", refBreadcrumbJsonLd(locale, refId));
    return;
  }
  if (kbPage) {
    for (const key of ["howto-jsonld", "game-jsonld", "software-jsonld"]) writeJsonLd(key, null);
    writeJsonLd("faq-jsonld", kbFaqJsonLd(locale, kbPage));
    writeJsonLd("breadcrumb-jsonld", kbBreadcrumbJsonLd(locale, kbPage));
    return;
  }
  if (quizPage) {
    const id = quizPage === "hub" ? null : quizPage;
    for (const key of ["howto-jsonld", "game-jsonld", "software-jsonld"]) writeJsonLd(key, null);
    writeJsonLd("faq-jsonld", quizFaqJsonLd(locale, id));
    writeJsonLd("breadcrumb-jsonld", quizBreadcrumbJsonLd(locale, id));
    return;
  }
  if (legalPage) {
    for (const id of ["faq-jsonld", "howto-jsonld", "game-jsonld", "software-jsonld"]) writeJsonLd(id, null);
    writeJsonLd("breadcrumb-jsonld", legalBreadcrumbJsonLd(locale, legalPage));
    return;
  }
  const flashHub = gamesHub && gamesConsole === "flash";
  // Mirror applyHtmlSeo: plain tool pages carry WebApplication + BreadcrumbList.
  const toolPage = Boolean(tool) && !tutorial && !game && !gamesHub && !market && !marketsHub && !devicePage;
  const faq = devicePage
    ? deviceFaqJsonLd(locale, devicePage)
    : faqJsonLd(locale, tool, tutorial, game, gamesHub, convertJob, resizeJob, market, marketsHub, gamesConsole);
  writeJsonLd("faq-jsonld", faq);
  writeJsonLd(
    "breadcrumb-jsonld",
    devicePage
      ? deviceBreadcrumbJsonLd(locale, devicePage)
      : marketsHub || market
        ? marketBreadcrumbJsonLd(locale, market)
        : game
          ? gameBreadcrumbJsonLd(locale, gameById(game)?.console ?? null, game)
          : gamesHub
            ? gameBreadcrumbJsonLd(locale, gamesConsole)
            : tutorial || learnHub
              ? tutorialBreadcrumbJsonLd(locale, tutorial)
              : toolPage && tool
                ? toolBreadcrumbJsonLd(locale, tool)
                : null,
  );
  writeJsonLd(
    "howto-jsonld",
    devicePage
      ? null
      : game
        ? gameHowToJsonLd(locale, game)
        : flashHub
          ? flashHubHowToJsonLd(locale)
          : tutorial
            ? howToJsonLd(locale, tutorial)
            : tool
              ? toolHowToJsonLd(locale, tool)
              : null,
  );
  writeJsonLd("game-jsonld", game ? gameVideoGameJsonLd(locale, game) : null);
  writeJsonLd(
    "software-jsonld",
    flashHub ? flashHubSoftwareJsonLd(locale) : toolPage && tool ? toolSoftwareJsonLd(locale, tool) : null,
  );
}

function writeJsonLd(id: string, data: Record<string, unknown> | null): void {
  const existing = document.getElementById(id);
  if (!data) {
    existing?.remove();
    return;
  }
  const json = JSON.stringify(data);
  if (existing) {
    existing.textContent = json;
    return;
  }
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.id = id;
  script.textContent = json;
  document.head.append(script);
}
