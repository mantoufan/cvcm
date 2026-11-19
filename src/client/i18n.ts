import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALES,
  parseLocale,
  type Locale,
} from "../shared/locale";
import {
  hasGameMessages,
  hasLegalMessages,
  hasMessages,
  hasKbArticle,
  hasKbMessages,
  hasQuizMessages,
  hasQuizTest,
  hasDatasetMessages,
  hasRefEntry,
  hasRefMessages,
  messages,
  registerGameMessages,
  registerLegalMessages,
  registerMessages,
  registerKbArticle,
  registerKbMessages,
  registerQuizMessages,
  registerQuizTest,
  registerDatasetMessages,
  registerRefEntry,
  registerRefMessages,
  type GameMessages,
  type LegalMessages,
  type CopyLoaders,
  type LocaleMessages,
  type KbMessages,
  type QuizMessages,
  type DatasetMessages,
  type RefMessages,
  type SlangMessages,
  hasSlangEntry,
  hasSlangMessages,
  registerSlangEntry,
  registerSlangMessages,
  type IdeasMessages,
  hasIdeaEntry,
  hasIdeasMessages,
  registerIdeaEntry,
  registerIdeasMessages,
  type NostalgiaMessages,
  hasNostalgiaEntry,
  hasNostalgiaMessages,
  registerNostalgiaEntry,
  registerNostalgiaMessages,
  type SummariesMessages,
  hasSummaryEntry,
  hasSummariesMessages,
  registerSummaryEntry,
  registerSummariesMessages,
  hasCalendarMessages,
  registerCalendarMessages,
  type CalendarMessages,
} from "../shared/messages";
import type { KbArticleCopy } from "../shared/kb-i18n";
import { kbArticleOf, type KbId, type KbPage } from "../shared/kb";
import type { RefEntryCopy } from "../shared/ref-i18n";
import type { RefId, RefPage } from "../shared/ref";
import type { SlangEntryCopy } from "../shared/slang-i18n";
import type { SlangId, SlangPage } from "../shared/slang";
import { copyBucket, hasToolCopy, hasTutorialCopy, mergeToolCopy, mergeTutorialCopy, type PageCopy } from "../shared/page-copy";
import type { IdeaEntryCopy } from "../shared/ideas-i18n";
import type { IdeaId, IdeaPage } from "../shared/ideas";
import type { NostalgiaEntryCopy } from "../shared/nostalgia-i18n";
import type { NostalgiaId, NostalgiaPage } from "../shared/nostalgia";
import type { SummaryEntryCopy } from "../shared/summaries-i18n";
import type { SummaryId, SummaryPage } from "../shared/summaries";
import { hasElementsMessages, registerElementsMessages, type ElementsMessages } from "../shared/messages";
import { hasEmojiMessages, registerEmojiMessages, type EmojiMessages } from "../shared/messages";
import { hasCurrencyMessages, registerCurrencyMessages, type CurrencyMessages } from "../shared/messages";
import type { QuizId, QuizPage } from "../shared/quiz";
import type { QuizCopy } from "../shared/quiz-i18n";
import { countryBucket, countryCode, type CountryPage } from "../shared/countries";
import { hasCountriesMessages, hasCountryBucket, registerCountriesMessages, registerCountryBucket, type CountriesMessages, type CountryDetail } from "../shared/countries-store";
import { COUNTRY_BUCKET_LOADERS } from "../shared/countries/loaders";
import { hasCaloriesMessages, registerCaloriesMessages, type CaloriesMessages } from "../shared/messages";
import type { CaloriesPage } from "../shared/calories";

export type { PageCopy };

// One chunk per locale, so a page downloads only the strings it shows. A pack leaves out the copy only one page
// shows (a tool's FAQ and how-to, a tutorial's text): that is in bucket chunks, found through COPY_LOADERS.
const PACKS: Record<Locale, () => Promise<{ default: LocaleMessages }>> = {
  en: () => import("../locales/packs/en"),
  "zh-CN": () => import("../locales/packs/zh-CN"),
  "zh-TW": () => import("../locales/packs/zh-TW"),
  ja: () => import("../locales/packs/ja"),
  ko: () => import("../locales/packs/ko"),
  vi: () => import("../locales/packs/vi"),
  id: () => import("../locales/packs/id"),
  es: () => import("../locales/packs/es"),
};

// A locale's page-copy bucket loaders (a small lazy chunk, kept out of the entry and out of the pack).
const COPY_LOADERS: Record<Locale, () => Promise<{ copy: CopyLoaders }>> = {
  en: () => import("virtual:page-copy/loaders/en"),
  "zh-CN": () => import("virtual:page-copy/loaders/zh-CN"),
  "zh-TW": () => import("virtual:page-copy/loaders/zh-TW"),
  ja: () => import("virtual:page-copy/loaders/ja"),
  ko: () => import("virtual:page-copy/loaders/ko"),
  vi: () => import("virtual:page-copy/loaders/vi"),
  id: () => import("virtual:page-copy/loaders/id"),
  es: () => import("virtual:page-copy/loaders/es"),
};

// Full game copy and walkthroughs, only for game pages.
const GAME_PACKS: Record<Locale, () => Promise<{ default: GameMessages }>> = {
  en: () => import("../locales/packs/games-en"),
  "zh-CN": () => import("../locales/packs/games-zh-CN"),
  "zh-TW": () => import("../locales/packs/games-zh-TW"),
  ja: () => import("../locales/packs/games-ja"),
  ko: () => import("../locales/packs/games-ko"),
  vi: () => import("../locales/packs/games-vi"),
  id: () => import("../locales/packs/games-id"),
  es: () => import("../locales/packs/games-es"),
};

// Privacy policy and terms, only for those two pages.
const LEGAL_PACKS: Record<Locale, () => Promise<{ default: LegalMessages }>> = {
  en: () => import("../locales/legal/en.json"),
  "zh-CN": () => import("../locales/legal/zh-CN.json"),
  "zh-TW": () => import("../locales/legal/zh-TW.json"),
  ja: () => import("../locales/legal/ja.json"),
  ko: () => import("../locales/legal/ko.json"),
  vi: () => import("../locales/legal/vi.json"),
  id: () => import("../locales/legal/id.json"),
  es: () => import("../locales/legal/es.json"),
};

// Personality test copy, only for /tests/ pages.
const QUIZ_PACKS: Record<Locale, () => Promise<{ default: QuizMessages }>> = {
  en: () => import("../locales/packs/quiz-en"),
  "zh-CN": () => import("../locales/packs/quiz-zh-CN"),
  "zh-TW": () => import("../locales/packs/quiz-zh-TW"),
  ja: () => import("../locales/packs/quiz-ja"),
  ko: () => import("../locales/packs/quiz-ko"),
  vi: () => import("../locales/packs/quiz-vi"),
  id: () => import("../locales/packs/quiz-id"),
  es: () => import("../locales/packs/quiz-es"),
};

// One chunk per test and locale, through that locale's generated loader table (`npm run quiz:sync`).
const QUIZ_LOADER_TABLES: Record<Locale, () => Promise<{ QUIZ_LOADERS: Record<QuizId, () => Promise<unknown>> }>> = {
  en: () => import("../locales/quiz/loaders/en"),
  "zh-CN": () => import("../locales/quiz/loaders/zh-CN"),
  "zh-TW": () => import("../locales/quiz/loaders/zh-TW"),
  ja: () => import("../locales/quiz/loaders/ja"),
  ko: () => import("../locales/quiz/loaders/ko"),
  vi: () => import("../locales/quiz/loaders/vi"),
  id: () => import("../locales/quiz/loaders/id"),
  es: () => import("../locales/quiz/loaders/es"),
};

async function loadQuizTest(next: Locale, id: QuizId): Promise<void> {
  const { QUIZ_LOADERS } = await QUIZ_LOADER_TABLES[next]();
  const m = (await QUIZ_LOADERS[id]()) as { default: QuizCopy };
  registerQuizTest(next, id, m.default);
}

// Data table copy, only for /datasets/ pages.
const DATASET_PACKS: Record<Locale, () => Promise<{ default: DatasetMessages }>> = {
  en: () => import("../locales/packs/datasets-en"),
  "zh-CN": () => import("../locales/packs/datasets-zh-CN"),
  "zh-TW": () => import("../locales/packs/datasets-zh-TW"),
  ja: () => import("../locales/packs/datasets-ja"),
  ko: () => import("../locales/packs/datasets-ko"),
  vi: () => import("../locales/packs/datasets-vi"),
  id: () => import("../locales/packs/datasets-id"),
  es: () => import("../locales/packs/datasets-es"),
};

// Kb hub copy and the coding, AI and photography shelf meta, only for /learn/knowledge/, /learn/code/, /learn/ai/ and /learn/photography/ pages.
const KB_PACKS: Record<Locale, () => Promise<{ default: KbMessages }>> = {
  en: () => import("../locales/packs/kb-en"),
  "zh-CN": () => import("../locales/packs/kb-zh-CN"),
  "zh-TW": () => import("../locales/packs/kb-zh-TW"),
  ja: () => import("../locales/packs/kb-ja"),
  ko: () => import("../locales/packs/kb-ko"),
  vi: () => import("../locales/packs/kb-vi"),
  id: () => import("../locales/packs/kb-id"),
  es: () => import("../locales/packs/kb-es"),
};


// One chunk per article and locale, found through that locale's loader table (itself a lazy chunk, kept out of the entry).
const KB_LOADER_TABLES: Record<Locale, () => Promise<{ KB_LOADERS: Record<KbId, () => Promise<unknown>> }>> = {
  en: () => import("../locales/kb/loaders/en"),
  "zh-CN": () => import("../locales/kb/loaders/zh-CN"),
  "zh-TW": () => import("../locales/kb/loaders/zh-TW"),
  ja: () => import("../locales/kb/loaders/ja"),
  ko: () => import("../locales/kb/loaders/ko"),
  vi: () => import("../locales/kb/loaders/vi"),
  id: () => import("../locales/kb/loaders/id"),
  es: () => import("../locales/kb/loaders/es"),
};

async function loadKbArticle(next: Locale, id: KbId): Promise<void> {
  const { KB_LOADERS } = await KB_LOADER_TABLES[next]();
  const m = (await KB_LOADERS[id]()) as { default: KbArticleCopy };
  registerKbArticle(next, id, m.default);
}

// Reference hub copy plus entry names (`npm run ref:sync`), only for /reference/ pages.
const REF_PACKS: Record<Locale, () => Promise<{ default: RefMessages }>> = {
  en: () => import("../locales/packs/ref-en"),
  "zh-CN": () => import("../locales/packs/ref-zh-CN"),
  "zh-TW": () => import("../locales/packs/ref-zh-TW"),
  ja: () => import("../locales/packs/ref-ja"),
  ko: () => import("../locales/packs/ref-ko"),
  vi: () => import("../locales/packs/ref-vi"),
  id: () => import("../locales/packs/ref-id"),
  es: () => import("../locales/packs/ref-es"),
};

// One chunk per reference entry and locale, through that locale's generated loader table (like kb articles).
const REF_LOADER_TABLES: Record<Locale, () => Promise<{ REF_LOADERS: Record<RefId, () => Promise<unknown>> }>> = {
  en: () => import("../locales/ref/loaders/en"),
  "zh-CN": () => import("../locales/ref/loaders/zh-CN"),
  "zh-TW": () => import("../locales/ref/loaders/zh-TW"),
  ja: () => import("../locales/ref/loaders/ja"),
  ko: () => import("../locales/ref/loaders/ko"),
  vi: () => import("../locales/ref/loaders/vi"),
  id: () => import("../locales/ref/loaders/id"),
  es: () => import("../locales/ref/loaders/es"),
};

async function loadRefEntry(next: Locale, id: RefId): Promise<void> {
  const { REF_LOADERS } = await REF_LOADER_TABLES[next]();
  const m = (await REF_LOADERS[id]()) as { default: RefEntryCopy };
  registerRefEntry(next, id, m.default);
}

// Slang hub copy plus entry names (`npm run slang:sync`), only for /memes/ pages.
const SLANG_PACKS: Record<Locale, () => Promise<{ default: SlangMessages }>> = {
  en: () => import("../locales/packs/slang-en"),
  "zh-CN": () => import("../locales/packs/slang-zh-CN"),
  "zh-TW": () => import("../locales/packs/slang-zh-TW"),
  ja: () => import("../locales/packs/slang-ja"),
  ko: () => import("../locales/packs/slang-ko"),
  vi: () => import("../locales/packs/slang-vi"),
  id: () => import("../locales/packs/slang-id"),
  es: () => import("../locales/packs/slang-es"),
};

// One chunk per slang entry and locale, through that locale's generated loader table.
const SLANG_LOADER_TABLES: Record<Locale, () => Promise<{ SLANG_LOADERS: Record<SlangId, () => Promise<unknown>> }>> = {
  en: () => import("../locales/slang/loaders/en"),
  "zh-CN": () => import("../locales/slang/loaders/zh-CN"),
  "zh-TW": () => import("../locales/slang/loaders/zh-TW"),
  ja: () => import("../locales/slang/loaders/ja"),
  ko: () => import("../locales/slang/loaders/ko"),
  vi: () => import("../locales/slang/loaders/vi"),
  id: () => import("../locales/slang/loaders/id"),
  es: () => import("../locales/slang/loaders/es"),
};

async function loadSlangEntry(next: Locale, id: SlangId): Promise<void> {
  const { SLANG_LOADERS } = await SLANG_LOADER_TABLES[next]();
  const m = (await SLANG_LOADERS[id]()) as { default: SlangEntryCopy };
  registerSlangEntry(next, id, m.default);
}

// Ideas hub copy, idea names and the search-data snapshot (`npm run ideas:sync`), only for /ideas/ pages.
const IDEAS_PACKS: Record<Locale, () => Promise<{ default: IdeasMessages }>> = {
  en: () => import("../locales/packs/ideas-en"),
  "zh-CN": () => import("../locales/packs/ideas-zh-CN"),
  "zh-TW": () => import("../locales/packs/ideas-zh-TW"),
  ja: () => import("../locales/packs/ideas-ja"),
  ko: () => import("../locales/packs/ideas-ko"),
  vi: () => import("../locales/packs/ideas-vi"),
  id: () => import("../locales/packs/ideas-id"),
  es: () => import("../locales/packs/ideas-es"),
};

// One chunk per idea and locale, through that locale's generated loader table.
const IDEA_LOADER_TABLES: Record<Locale, () => Promise<{ IDEA_LOADERS: Record<IdeaId, () => Promise<unknown>> }>> = {
  en: () => import("../locales/ideas/loaders/en"),
  "zh-CN": () => import("../locales/ideas/loaders/zh-CN"),
  "zh-TW": () => import("../locales/ideas/loaders/zh-TW"),
  ja: () => import("../locales/ideas/loaders/ja"),
  ko: () => import("../locales/ideas/loaders/ko"),
  vi: () => import("../locales/ideas/loaders/vi"),
  id: () => import("../locales/ideas/loaders/id"),
  es: () => import("../locales/ideas/loaders/es"),
};

async function loadIdeaEntry(next: Locale, id: IdeaId): Promise<void> {
  const { IDEA_LOADERS } = await IDEA_LOADER_TABLES[next]();
  const m = (await IDEA_LOADERS[id]()) as { default: IdeaEntryCopy };
  registerIdeaEntry(next, id, m.default);
}

// Buckets merged into a locale's pack ("<locale>/tools/<n>"). Once a bucket is in, its ids are settled even if
// one of them has no copy there (an id without a how-to): the page then renders as it would with the full pack.
const mergedBuckets = new Set<string>();
// Bucket downloads under way, so a hover prefetch and the page's own load share one request and one merge.
const bucketLoads = new Map<string, Promise<void>>();

function hasPageCopy(next: Locale, copy: PageCopy): boolean {
  if (!copy.tool && !copy.tutorial) return true;
  if (!hasMessages(next)) return false;
  const pack = messages(next);
  return (!copy.tool || hasToolCopy(pack, copy.tool) || mergedBuckets.has(`${next}/tools/${copyBucket(copy.tool)}`))
    && (!copy.tutorial || hasTutorialCopy(pack, copy.tutorial) || mergedBuckets.has(`${next}/tutorials/${copyBucket(copy.tutorial)}`));
}

function loadBucket(next: Locale, kind: "tools" | "tutorials", id: string, core: Promise<void> | null): Promise<void> {
  const key = `${next}/${kind}/${copyBucket(id)}`;
  let load = bucketLoads.get(key);
  if (!load) {
    const bucket = copyBucket(id);
    // The pack and the bucket download side by side; the bucket is merged once the pack is registered.
    const merged = kind === "tools"
      ? Promise.all([COPY_LOADERS[next]().then((m) => m.copy.tools[bucket]()), core]).then(([m]) => mergeToolCopy(messages(next), m.default))
      : Promise.all([COPY_LOADERS[next]().then((m) => m.copy.tutorials[bucket]()), core]).then(([m]) => mergeTutorialCopy(messages(next), m.default));
    load = merged.then(() => {
      mergedBuckets.add(key);
    }).finally(() => bucketLoads.delete(key));
    bucketLoads.set(key, load);
  }
  return load;
}

const coreLoads = new Map<Locale, Promise<void>>();

/** Loads the core pack if needed, and with it the buckets for this page's tool and tutorial, merged into the pack. */
async function loadCore(next: Locale, copy: PageCopy): Promise<void> {
  let core = hasMessages(next) ? null : coreLoads.get(next) ?? null;
  if (!core && !hasMessages(next)) {
    core = PACKS[next]().then((m) => {
      // Never re-register: a registered pack may already hold merged buckets.
      if (!hasMessages(next)) registerMessages(next, m.default);
    }).finally(() => coreLoads.delete(next));
    coreLoads.set(next, core);
  }
  const { tool, tutorial } = copy;
  await Promise.all([
    core,
    tool && !hasPageCopy(next, { tool }) ? loadBucket(next, "tools", tool, core) : null,
    tutorial && !hasPageCopy(next, { tutorial }) ? loadBucket(next, "tutorials", tutorial, core) : null,
  ]);
}

// Nostalgia hub copy plus entry names (`npm run nostalgia:sync`), only for /nostalgia/ pages.
const NOSTALGIA_PACKS: Record<Locale, () => Promise<{ default: NostalgiaMessages }>> = {
  en: () => import("../locales/packs/nostalgia-en"),
  "zh-CN": () => import("../locales/packs/nostalgia-zh-CN"),
  "zh-TW": () => import("../locales/packs/nostalgia-zh-TW"),
  ja: () => import("../locales/packs/nostalgia-ja"),
  ko: () => import("../locales/packs/nostalgia-ko"),
  vi: () => import("../locales/packs/nostalgia-vi"),
  id: () => import("../locales/packs/nostalgia-id"),
  es: () => import("../locales/packs/nostalgia-es"),
};

// Calendar copy and data, only for /calendar/ pages.
const CALENDAR_PACKS: Record<Locale, () => Promise<{ default: CalendarMessages }>> = {
  en: () => import("../locales/packs/calendar-en"),
  "zh-CN": () => import("../locales/packs/calendar-zh-CN"),
  "zh-TW": () => import("../locales/packs/calendar-zh-TW"),
  ja: () => import("../locales/packs/calendar-ja"),
  ko: () => import("../locales/packs/calendar-ko"),
  vi: () => import("../locales/packs/calendar-vi"),
  id: () => import("../locales/packs/calendar-id"),
  es: () => import("../locales/packs/calendar-es"),
};

// One chunk per nostalgia entry and locale, through that locale's generated loader table.
const NOSTALGIA_LOADER_TABLES: Record<Locale, () => Promise<{ NOSTALGIA_LOADERS: Record<NostalgiaId, () => Promise<unknown>> }>> = {
  en: () => import("../locales/nostalgia/loaders/en"),
  "zh-CN": () => import("../locales/nostalgia/loaders/zh-CN"),
  "zh-TW": () => import("../locales/nostalgia/loaders/zh-TW"),
  ja: () => import("../locales/nostalgia/loaders/ja"),
  ko: () => import("../locales/nostalgia/loaders/ko"),
  vi: () => import("../locales/nostalgia/loaders/vi"),
  id: () => import("../locales/nostalgia/loaders/id"),
  es: () => import("../locales/nostalgia/loaders/es"),
};

// Periodic table copy, element names and the PubChem rows, only for /periodic-table/ pages.
const ELEMENTS_PACKS: Record<Locale, () => Promise<{ default: ElementsMessages }>> = {
  en: () => import("../locales/packs/elements-en"),
  "zh-CN": () => import("../locales/packs/elements-zh-CN"),
  "zh-TW": () => import("../locales/packs/elements-zh-TW"),
  ja: () => import("../locales/packs/elements-ja"),
  ko: () => import("../locales/packs/elements-ko"),
  vi: () => import("../locales/packs/elements-vi"),
  id: () => import("../locales/packs/elements-id"),
  es: () => import("../locales/packs/elements-es"),
};

// Emoji meanings copy, CLDR names and keywords, usage sentences and the emoji-test rows, only for /emoji/ pages.
const EMOJI_PACKS: Record<Locale, () => Promise<{ default: EmojiMessages }>> = {
  en: () => import("../locales/packs/emoji-en"),
  "zh-CN": () => import("../locales/packs/emoji-zh-CN"),
  "zh-TW": () => import("../locales/packs/emoji-zh-TW"),
  ja: () => import("../locales/packs/emoji-ja"),
  ko: () => import("../locales/packs/emoji-ko"),
  vi: () => import("../locales/packs/emoji-vi"),
  id: () => import("../locales/packs/emoji-id"),
  es: () => import("../locales/packs/emoji-es"),
};

async function loadNostalgiaEntry(next: Locale, id: NostalgiaId): Promise<void> {
  const { NOSTALGIA_LOADERS } = await NOSTALGIA_LOADER_TABLES[next]();
  const m = (await NOSTALGIA_LOADERS[id]()) as { default: NostalgiaEntryCopy };
  registerNostalgiaEntry(next, id, m.default);
}

// Summaries hub copy plus work names (`npm run summaries:sync`), only for /summaries/ pages.
const SUMMARIES_PACKS: Record<Locale, () => Promise<{ default: SummariesMessages }>> = {
  en: () => import("../locales/packs/summaries-en"),
  "zh-CN": () => import("../locales/packs/summaries-zh-CN"),
  "zh-TW": () => import("../locales/packs/summaries-zh-TW"),
  ja: () => import("../locales/packs/summaries-ja"),
  ko: () => import("../locales/packs/summaries-ko"),
  vi: () => import("../locales/packs/summaries-vi"),
  id: () => import("../locales/packs/summaries-id"),
  es: () => import("../locales/packs/summaries-es"),
};

// One chunk per summary and locale, through that locale's generated loader table.
const SUMMARY_LOADER_TABLES: Record<Locale, () => Promise<{ SUMMARY_LOADERS: Record<SummaryId, () => Promise<unknown>> }>> = {
  en: () => import("../locales/summaries/loaders/en"),
  "zh-CN": () => import("../locales/summaries/loaders/zh-CN"),
  "zh-TW": () => import("../locales/summaries/loaders/zh-TW"),
  ja: () => import("../locales/summaries/loaders/ja"),
  ko: () => import("../locales/summaries/loaders/ko"),
  vi: () => import("../locales/summaries/loaders/vi"),
  id: () => import("../locales/summaries/loaders/id"),
  es: () => import("../locales/summaries/loaders/es"),
};

async function loadSummaryEntry(next: Locale, id: SummaryId): Promise<void> {
  const { SUMMARY_LOADERS } = await SUMMARY_LOADER_TABLES[next]();
  const m = (await SUMMARY_LOADERS[id]()) as { default: SummaryEntryCopy };
  registerSummaryEntry(next, id, m.default);
}

// Countries copy and the list data, only for /countries/ pages; a profile also loads the data bucket holding its figures.
const COUNTRIES_PACKS: Record<Locale, () => Promise<{ default: CountriesMessages }>> = {
  en: () => import("../locales/packs/countries-en"),
  "zh-CN": () => import("../locales/packs/countries-zh-CN"),
  "zh-TW": () => import("../locales/packs/countries-zh-TW"),
  ja: () => import("../locales/packs/countries-ja"),
  ko: () => import("../locales/packs/countries-ko"),
  vi: () => import("../locales/packs/countries-vi"),
  id: () => import("../locales/packs/countries-id"),
  es: () => import("../locales/packs/countries-es"),
};

function countryBucketOf(page: CountryPage): number | null {
  return page && page !== "hub" ? countryBucket(countryCode(page)) : null;
}

// Calories copy, food names and the USDA snapshot, only for /calories/ pages.
const CALORIES_PACKS: Record<Locale, () => Promise<{ default: CaloriesMessages }>> = {
  en: () => import("../locales/packs/calories-en"),
  "zh-CN": () => import("../locales/packs/calories-zh-CN"),
  "zh-TW": () => import("../locales/packs/calories-zh-TW"),
  ja: () => import("../locales/packs/calories-ja"),
  ko: () => import("../locales/packs/calories-ko"),
  vi: () => import("../locales/packs/calories-vi"),
  id: () => import("../locales/packs/calories-id"),
  es: () => import("../locales/packs/calories-es"),
};

// Exchange-rate copy and the ECB snapshot, only for /currency/ pages.
const CURRENCY_PACKS: Record<Locale, () => Promise<{ default: CurrencyMessages }>> = {
  en: () => import("../locales/packs/currency-en"),
  "zh-CN": () => import("../locales/packs/currency-zh-CN"),
  "zh-TW": () => import("../locales/packs/currency-zh-TW"),
  ja: () => import("../locales/packs/currency-ja"),
  ko: () => import("../locales/packs/currency-ko"),
  vi: () => import("../locales/packs/currency-vi"),
  id: () => import("../locales/packs/currency-id"),
  es: () => import("../locales/packs/currency-es"),
};

/** Whether the strings a page needs are loaded: the locale pack, plus the game, legal, quiz, dataset or kb pack on those pages and the page's own copy. */
export function hasPageMessages(next: Locale, game: boolean, legal = false, quiz: QuizPage = null, dataset = false, kb: KbPage = null, ref: RefPage = null, slang: SlangPage = null, copy: PageCopy = {}, ideas: IdeaPage = null, nostalgia: NostalgiaPage = null, countries: CountryPage = null, calories: CaloriesPage = null, elements = false, calendar = false, summaries: SummaryPage = null, emoji = false, currency = false): boolean {
  const test = quiz && quiz !== "hub" ? quiz : null;
  const article = kbArticleOf(kb);
  const entry = ref && ref !== "hub" ? ref : null;
  const term = slang && slang !== "hub" ? slang : null;
  const idea = ideas && ideas !== "hub" ? ideas : null;
  const memory = nostalgia && nostalgia !== "hub" ? nostalgia : null;
  const work = summaries && summaries !== "hub" ? summaries : null;
  return hasMessages(next) && hasPageCopy(next, copy) && (!game || hasGameMessages(next)) && (!legal || hasLegalMessages(next)) && (!quiz || (hasQuizMessages(next) && (!test || hasQuizTest(next, test)))) && (!dataset || hasDatasetMessages(next))
    && (!kb || (hasKbMessages(next) && (!article || hasKbArticle(next, article))))
    && (!ref || (hasRefMessages(next) && (!entry || hasRefEntry(next, entry))))
    && (!slang || (hasSlangMessages(next) && (!term || hasSlangEntry(next, term))))
    && (!ideas || (hasIdeasMessages(next) && (!idea || hasIdeaEntry(next, idea))))
    && (!nostalgia || (hasNostalgiaMessages(next) && (!memory || hasNostalgiaEntry(next, memory))))
    && (!summaries || (hasSummariesMessages(next) && (!work || hasSummaryEntry(next, work))))
    && (!countries || (hasCountriesMessages(next) && (countryBucketOf(countries) === null || hasCountryBucket(countryBucketOf(countries)!))))
    && (!calories || hasCaloriesMessages(next))
    && (!elements || hasElementsMessages(next))
    && (!calendar || hasCalendarMessages(next))
    && (!emoji || hasEmojiMessages(next))
    && (!currency || hasCurrencyMessages(next));
}

export async function loadPageMessages(next: Locale, game: boolean, legal = false, quiz: QuizPage = null, dataset = false, kb: KbPage = null, ref: RefPage = null, slang: SlangPage = null, copy: PageCopy = {}, ideas: IdeaPage = null, nostalgia: NostalgiaPage = null, countries: CountryPage = null, calories: CaloriesPage = null, elements = false, calendar = false, summaries: SummaryPage = null, emoji = false, currency = false): Promise<void> {
  const bucket = countryBucketOf(countries);
  const test = quiz && quiz !== "hub" ? quiz : null;
  const article = kbArticleOf(kb);
  const entry = ref && ref !== "hub" ? ref : null;
  const term = slang && slang !== "hub" ? slang : null;
  const idea = ideas && ideas !== "hub" ? ideas : null;
  const memory = nostalgia && nostalgia !== "hub" ? nostalgia : null;
  const work = summaries && summaries !== "hub" ? summaries : null;
  await Promise.all([
    hasMessages(next) && hasPageCopy(next, copy) ? null : loadCore(next, copy),
    !game || hasGameMessages(next) ? null : GAME_PACKS[next]().then((m) => registerGameMessages(next, m.default)),
    !legal || hasLegalMessages(next) ? null : LEGAL_PACKS[next]().then((m) => registerLegalMessages(next, m.default)),
    !quiz || hasQuizMessages(next) ? null : QUIZ_PACKS[next]().then((m) => registerQuizMessages(next, m.default)),
    !test || hasQuizTest(next, test) ? null : loadQuizTest(next, test),
    !dataset || hasDatasetMessages(next) ? null : DATASET_PACKS[next]().then((m) => registerDatasetMessages(next, m.default)),
    !kb || hasKbMessages(next) ? null : KB_PACKS[next]().then((m) => registerKbMessages(next, m.default)),
    !article || hasKbArticle(next, article) ? null : loadKbArticle(next, article),
    !ref || hasRefMessages(next) ? null : REF_PACKS[next]().then((m) => registerRefMessages(next, m.default)),
    !entry || hasRefEntry(next, entry) ? null : loadRefEntry(next, entry),
    !slang || hasSlangMessages(next) ? null : SLANG_PACKS[next]().then((m) => registerSlangMessages(next, m.default)),
    !term || hasSlangEntry(next, term) ? null : loadSlangEntry(next, term),
    !ideas || hasIdeasMessages(next) ? null : IDEAS_PACKS[next]().then((m) => registerIdeasMessages(next, m.default)),
    !idea || hasIdeaEntry(next, idea) ? null : loadIdeaEntry(next, idea),
    !nostalgia || hasNostalgiaMessages(next) ? null : NOSTALGIA_PACKS[next]().then((m) => registerNostalgiaMessages(next, m.default)),
    !memory || hasNostalgiaEntry(next, memory) ? null : loadNostalgiaEntry(next, memory),
    !summaries || hasSummariesMessages(next) ? null : SUMMARIES_PACKS[next]().then((m) => registerSummariesMessages(next, m.default)),
    !work || hasSummaryEntry(next, work) ? null : loadSummaryEntry(next, work),
    !countries || hasCountriesMessages(next) ? null : COUNTRIES_PACKS[next]().then((m) => registerCountriesMessages(next, m.default)),
    bucket === null || hasCountryBucket(bucket) ? null : COUNTRY_BUCKET_LOADERS[bucket]().then((m) => registerCountryBucket(bucket, m.default as Record<string, CountryDetail>)),
    !calories || hasCaloriesMessages(next) ? null : CALORIES_PACKS[next]().then((m) => registerCaloriesMessages(next, m.default)),
    !elements || hasElementsMessages(next) ? null : ELEMENTS_PACKS[next]().then((m) => registerElementsMessages(next, m.default)),
    !calendar || hasCalendarMessages(next) ? null : CALENDAR_PACKS[next]().then((m) => registerCalendarMessages(next, m.default)),
    !emoji || hasEmojiMessages(next) ? null : EMOJI_PACKS[next]().then((m) => registerEmojiMessages(next, m.default)),
    !currency || hasCurrencyMessages(next) ? null : CURRENCY_PACKS[next]().then((m) => registerCurrencyMessages(next, m.default)),
  ]);
}

let current: Locale = DEFAULT_LOCALE;

export function locale(): Locale {
  return current;
}

export function setLocale(next: Locale): void {
  current = next;
  document.documentElement.lang = next;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LOCALE_COOKIE}=${next}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
  try {
    localStorage.setItem(LOCALE_COOKIE, next);
  } catch {
    /* private mode */
  }
}

export function readStoredLocale(): Locale | null {
  try {
    const stored = parseLocale(localStorage.getItem(LOCALE_COOKIE));
    if (stored) return stored;
  } catch {
    /* ignore */
  }
  return null;
}

export function t(path: string, vars?: Record<string, string | number>): string {
  const parts = path.split(".");
  let node: unknown = messages(current).ui;
  for (const part of parts) {
    if (typeof node !== "object" || node === null || !(part in node)) {
      node = undefined;
      break;
    }
    node = (node as Record<string, unknown>)[part];
  }
  let text = typeof node === "string" ? node : path;
  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      // A replacer function keeps "$&" and friends in user text literal.
      text = text.replaceAll(`{${key}}`, () => String(value));
    }
  }
  return text;
}

export { LOCALES };
export type { Locale };
