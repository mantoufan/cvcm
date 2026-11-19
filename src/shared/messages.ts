import type { Walkthrough } from "./game-walkthrough";
import type { GameCopy } from "./games-i18n";
import type { Locale } from "./locale";
import type { KbId } from "./kb";
import type { KbArticleCopy } from "./kb-i18n";
import type { MarketMessages } from "./markets-i18n";
import type { RefId } from "./ref";
import type { RefEntryCopy, RefPhoto } from "./ref-i18n";
import type { SlangId } from "./slang";
import type { SlangEntryCopy } from "./slang-i18n";
import type { ToolCopy, TutorialCopy } from "./page-copy";
import type { IdeaId } from "./ideas";
import type { IdeaEntryCopy, IdeasData } from "./ideas-i18n";
import type { NostalgiaId } from "./nostalgia";
import type { NostalgiaEntryCopy } from "./nostalgia-i18n";
import type { QuizId } from "./quiz";
import type { QuizCopy } from "./quiz-i18n";

export type UiMessages = typeof import("../locales/en.json");
export type GuideMessages = typeof import("../locales/guides/en.json");
export type DeviceMessages = typeof import("../locales/device/en.json");
export type GameName = { name: string; blurb: string };
export type LegalMessages = typeof import("../locales/legal/en.json");
/** The quiz pack: UI strings and hub copy. Each test's own copy is a separate chunk (`registerQuizTest`). */
export type QuizMessages = typeof import("../locales/quiz/en.json");
export type DatasetMessages = typeof import("../locales/datasets/en.json");
export type KbMessages = typeof import("../locales/kb/en.json");
/** Reference hub copy plus every entry's name and blurb (`list`) and its name in every locale (`names`), from `npm run ref:sync`. */
export type RefMessages = typeof import("../locales/ref/en.json") & {
  list: Record<RefId, { name: string; blurb: string }>;
  names: Record<RefId, Record<Locale, string>>;
  /** src/data/ref-photos.json (the same module in every locale's pack). */
  photos: Partial<Record<RefId, RefPhoto[]>>;
};

/** Slang hub copy plus every entry's name and blurb (`list`) and the meme data snapshot, from `npm run slang:sync`. */
export type SlangMessages = typeof import("../locales/slang/en.json") & {
  list: Record<SlangId, { name: string; blurb: string }>;
  /** Daily snapshot from scripts/fetch-meme.mjs (trends and coins). */
  memes: import("./slang-i18n").MemeData;
};

/** Ideas hub copy plus every idea's name and blurb (`list`) and the derived search-data snapshot, from `npm run ideas:sync`. */
export type IdeasMessages = typeof import("../locales/ideas/en.json") & {
  list: Record<IdeaId, { name: string; blurb: string }>;
  /** src/shared/ideas-data.json, written monthly by scripts/ideas/fetch_kp.py. */
  data: IdeasData;
  /** src/shared/ideas-sources.json: checked references per idea. */
  sources: Record<IdeaId, import("./ideas").IdeaSource[]>;
};

/** Nostalgia hub copy plus every entry's name and blurb (`list`), from `npm run nostalgia:sync`. */
export type NostalgiaMessages = typeof import("../locales/nostalgia/en.json") & {
  list: Record<NostalgiaId, { name: string; blurb: string }>;
  /** src/shared/nostalgia-meta.json (years, status, related, sources): rides in the nostalgia pack, never the entry bundle. */
  meta: Record<NostalgiaId, import("./nostalgia-meta").NostalgiaMeta>;
};

/** Periodic table copy plus this locale's element names, the English names and the PubChem rows (one pack per locale). */
export type ElementsMessages = typeof import("../locales/elements/en.json") & {
  /** Names by atomic number − 1 (Wikidata labels). */
  names: string[];
  /** English (IUPAC) names, shown next to the local name outside English. */
  english: string[];
  data: import("./elements-i18n").ElementRow[];
};

/** Calendar copy plus the astronomy tables and official holiday lists (the same modules in every locale's pack). */
export type CalendarMessages = typeof import("../locales/calendar/en.json") & {
  /** src/shared/calendar-data.json (scripts/build-calendar-data.mjs). */
  astro: unknown;
  /** src/shared/calendar-holidays.json. */
  holidayData: unknown;
};

/** Strings every page of one locale needs. The client loads only the active locale's pack. */
export type LocaleMessages = {
  ui: UiMessages;
  gameNames: Record<string, GameName>;
  guides: GuideMessages;
  device: DeviceMessages;
  markets: MarketMessages;
};

/** A core pack's page-copy chunks, one loader per bucket (src/shared/page-copy.ts). */
export type CopyLoaders = {
  tools: Array<() => Promise<{ default: ToolCopy }>>;
  tutorials: Array<() => Promise<{ default: TutorialCopy }>>;
};

/** Full game copy and walkthroughs. The client loads these only on a game page. */
export type GameMessages = {
  games: Record<string, GameCopy>;
  walkthroughs: Record<string, Walkthrough>;
};

const loaded: Partial<Record<Locale, LocaleMessages>> = {};
const loadedGames: Partial<Record<Locale, GameMessages>> = {};
const loadedLegal: Partial<Record<Locale, LegalMessages>> = {};
const loadedQuiz: Partial<Record<Locale, QuizMessages>> = {};
const loadedQuizTests: Partial<Record<Locale, Partial<Record<QuizId, QuizCopy>>>> = {};
const loadedDatasets: Partial<Record<Locale, DatasetMessages>> = {};
const loadedKb: Partial<Record<Locale, KbMessages>> = {};
const loadedKbArticles: Partial<Record<Locale, Partial<Record<KbId, KbArticleCopy>>>> = {};
const loadedRef: Partial<Record<Locale, RefMessages>> = {};
const loadedRefEntries: Partial<Record<Locale, Partial<Record<RefId, RefEntryCopy>>>> = {};
const loadedSlang: Partial<Record<Locale, SlangMessages>> = {};
const loadedSlangEntries: Partial<Record<Locale, Partial<Record<SlangId, SlangEntryCopy>>>> = {};
const loadedIdeas: Partial<Record<Locale, IdeasMessages>> = {};
const loadedIdeaEntries: Partial<Record<Locale, Partial<Record<IdeaId, IdeaEntryCopy>>>> = {};
const loadedNostalgia: Partial<Record<Locale, NostalgiaMessages>> = {};
const loadedCalendar: Partial<Record<Locale, CalendarMessages>> = {};
const loadedNostalgiaEntries: Partial<Record<Locale, Partial<Record<NostalgiaId, NostalgiaEntryCopy>>>> = {};
const loadedElements: Partial<Record<Locale, ElementsMessages>> = {};

function pick<T>(table: Partial<Record<Locale, T>>, locale: Locale, what: string): T {
  const pack = table[locale] ?? table.en ?? Object.values(table)[0];
  if (!pack) throw new Error(`${what} not loaded: ${locale}`);
  return pack;
}

export function registerMessages(locale: Locale, pack: LocaleMessages): void {
  loaded[locale] = pack;
}

export function hasMessages(locale: Locale): boolean {
  return Boolean(loaded[locale]);
}

export function messages(locale: Locale): LocaleMessages {
  return pick(loaded, locale, "messages");
}

export function registerGameMessages(locale: Locale, pack: GameMessages): void {
  loadedGames[locale] = pack;
}

export function hasGameMessages(locale: Locale): boolean {
  return Boolean(loadedGames[locale]);
}

export function gameMessages(locale: Locale): GameMessages {
  return pick(loadedGames, locale, "game messages");
}

export function registerLegalMessages(locale: Locale, pack: LegalMessages): void {
  loadedLegal[locale] = pack;
}

export function hasLegalMessages(locale: Locale): boolean {
  return Boolean(loadedLegal[locale]);
}

/** Privacy policy and terms; on the client only after the legal pack is loaded (legal pages). */
export function legalMessages(locale: Locale): LegalMessages {
  return pick(loadedLegal, locale, "legal messages");
}

export function registerQuizMessages(locale: Locale, pack: QuizMessages): void {
  loadedQuiz[locale] = pack;
}

export function hasQuizMessages(locale: Locale): boolean {
  return Boolean(loadedQuiz[locale]);
}

/** Test UI strings and hub copy; on the client only after the quiz pack is loaded (test pages). */
export function quizMessages(locale: Locale): QuizMessages {
  return pick(loadedQuiz, locale, "quiz messages");
}

/** One test's copy. The client loads each test on its own. */
export function registerQuizTest(locale: Locale, id: QuizId, copy: QuizCopy): void {
  (loadedQuizTests[locale] ??= {})[id] = copy;
}

export function hasQuizTest(locale: Locale, id: QuizId): boolean {
  return Boolean(loadedQuizTests[locale]?.[id]);
}

/** One test's copy, falling back to English if that is all that is loaded (as the other entry getters do). */
export function quizTestMessages(locale: Locale, id: QuizId): QuizCopy {
  const copy = loadedQuizTests[locale]?.[id] ?? loadedQuizTests.en?.[id];
  if (!copy) throw new Error(`quiz test not loaded: ${locale} ${id}`);
  return copy;
}

export function registerDatasetMessages(locale: Locale, pack: DatasetMessages): void {
  loadedDatasets[locale] = pack;
}

export function hasDatasetMessages(locale: Locale): boolean {
  return Boolean(loadedDatasets[locale]);
}

/** Data table copy; on the client only after the dataset pack is loaded (data pages). */
export function datasetMessages(locale: Locale): DatasetMessages {
  return pick(loadedDatasets, locale, "dataset messages");
}

export function registerKbMessages(locale: Locale, pack: KbMessages): void {
  loadedKb[locale] = pack;
}

export function hasKbMessages(locale: Locale): boolean {
  return Boolean(loadedKb[locale]);
}

/** Knowledge hub copy and labels; on the client only after the kb pack is loaded (knowledge pages). */
export function kbMessages(locale: Locale): KbMessages {
  return pick(loadedKb, locale, "kb messages");
}

/** One knowledge article's copy. The client loads each article on its own. */
export function registerKbArticle(locale: Locale, id: KbId, copy: KbArticleCopy): void {
  (loadedKbArticles[locale] ??= {})[id] = copy;
}

export function hasKbArticle(locale: Locale, id: KbId): boolean {
  return Boolean(loadedKbArticles[locale]?.[id]);
}

export function kbArticleMessages(locale: Locale, id: KbId): KbArticleCopy {
  const copy = loadedKbArticles[locale]?.[id] ?? loadedKbArticles.en?.[id];
  if (!copy) throw new Error(`kb article not loaded: ${locale} ${id}`);
  return copy;
}

export function registerRefMessages(locale: Locale, pack: RefMessages): void {
  loadedRef[locale] = pack;
}

export function hasRefMessages(locale: Locale): boolean {
  return Boolean(loadedRef[locale]);
}

/** Reference hub copy, labels and entry names; on the client only after the ref pack is loaded (reference pages). */
export function refMessages(locale: Locale): RefMessages {
  return pick(loadedRef, locale, "ref messages");
}

/** One reference entry's copy. The client loads each entry on its own. */
export function registerRefEntry(locale: Locale, id: RefId, copy: RefEntryCopy): void {
  (loadedRefEntries[locale] ??= {})[id] = copy;
}

export function hasRefEntry(locale: Locale, id: RefId): boolean {
  return Boolean(loadedRefEntries[locale]?.[id]);
}

export function refEntryMessages(locale: Locale, id: RefId): RefEntryCopy {
  const copy = loadedRefEntries[locale]?.[id] ?? loadedRefEntries.en?.[id];
  if (!copy) throw new Error(`reference entry not loaded: ${locale} ${id}`);
  return copy;
}

export function registerSlangMessages(locale: Locale, pack: SlangMessages): void {
  loadedSlang[locale] = pack;
}

export function hasSlangMessages(locale: Locale): boolean {
  return Boolean(loadedSlang[locale]);
}

/** Slang hub copy, labels and entry names; on the client only after the slang pack is loaded (slang pages). */
export function slangMessages(locale: Locale): SlangMessages {
  return pick(loadedSlang, locale, "slang messages");
}

/** One slang entry's copy. The client loads each entry on its own. */
export function registerSlangEntry(locale: Locale, id: SlangId, copy: SlangEntryCopy): void {
  (loadedSlangEntries[locale] ??= {})[id] = copy;
}

export function hasSlangEntry(locale: Locale, id: SlangId): boolean {
  return Boolean(loadedSlangEntries[locale]?.[id]);
}

export function slangEntryMessages(locale: Locale, id: SlangId): SlangEntryCopy {
  const copy = loadedSlangEntries[locale]?.[id] ?? loadedSlangEntries.en?.[id];
  if (!copy) throw new Error(`slang entry not loaded: ${locale} ${id}`);
  return copy;
}

export function registerIdeasMessages(locale: Locale, pack: IdeasMessages): void {
  loadedIdeas[locale] = pack;
}

export function hasIdeasMessages(locale: Locale): boolean {
  return Boolean(loadedIdeas[locale]);
}

/** Ideas hub copy, labels, idea names and the data snapshot; on the client only after the ideas pack is loaded. */
export function ideasMessages(locale: Locale): IdeasMessages {
  return pick(loadedIdeas, locale, "ideas messages");
}

/** One idea's copy. The client loads each idea on its own. */
export function registerIdeaEntry(locale: Locale, id: IdeaId, copy: IdeaEntryCopy): void {
  (loadedIdeaEntries[locale] ??= {})[id] = copy;
}

export function hasIdeaEntry(locale: Locale, id: IdeaId): boolean {
  return Boolean(loadedIdeaEntries[locale]?.[id]);
}

export function ideaEntryMessages(locale: Locale, id: IdeaId): IdeaEntryCopy {
  const copy = loadedIdeaEntries[locale]?.[id] ?? loadedIdeaEntries.en?.[id];
  if (!copy) throw new Error(`idea not loaded: ${locale} ${id}`);
  return copy;
}

export function registerNostalgiaMessages(locale: Locale, pack: NostalgiaMessages): void {
  loadedNostalgia[locale] = pack;
}

export function hasNostalgiaMessages(locale: Locale): boolean {
  return Boolean(loadedNostalgia[locale]);
}

/** Nostalgia hub copy, labels and entry names; on the client only after the nostalgia pack is loaded (nostalgia pages). */
export function nostalgiaMessages(locale: Locale): NostalgiaMessages {
  return pick(loadedNostalgia, locale, "nostalgia messages");
}

/** One nostalgia entry's copy. The client loads each entry on its own. */
export function registerNostalgiaEntry(locale: Locale, id: NostalgiaId, copy: NostalgiaEntryCopy): void {
  (loadedNostalgiaEntries[locale] ??= {})[id] = copy;
}

export function hasNostalgiaEntry(locale: Locale, id: NostalgiaId): boolean {
  return Boolean(loadedNostalgiaEntries[locale]?.[id]);
}

export function nostalgiaEntryMessages(locale: Locale, id: NostalgiaId): NostalgiaEntryCopy {
  const copy = loadedNostalgiaEntries[locale]?.[id] ?? loadedNostalgiaEntries.en?.[id];
  if (!copy) throw new Error(`nostalgia entry not loaded: ${locale} ${id}`);
  return copy;
}

/** Calories hub and page copy plus food names (`src/locales/calories/<locale>.json`) and the USDA snapshot (`data`). */
export type CaloriesMessages = Omit<typeof import("../locales/calories/en.json"), "units"> & {
  /** Serving units: one string, or singular and plural forms (en, es). */
  units: Record<string, string | { one: string; other: string }>;
  data: import("./calories-i18n").CaloriesData;
};

const loadedCalories: Partial<Record<Locale, CaloriesMessages>> = {};

export function registerCaloriesMessages(locale: Locale, pack: CaloriesMessages): void {
  loadedCalories[locale] = pack;
}

export function hasCaloriesMessages(locale: Locale): boolean {
  return Boolean(loadedCalories[locale]);
}

/** Calories copy, food names and numbers; on the client only after the calories pack is loaded (calories pages). */
export function caloriesMessages(locale: Locale): CaloriesMessages {
  return pick(loadedCalories, locale, "calories messages");
}
export function registerElementsMessages(locale: Locale, pack: ElementsMessages): void {
  loadedElements[locale] = pack;
}

export function hasElementsMessages(locale: Locale): boolean {
  return Boolean(loadedElements[locale]);
}

/** Periodic table copy, names and rows; on the client only after the elements pack is loaded (periodic table pages). */
export function elementsMessages(locale: Locale): ElementsMessages {
  return pick(loadedElements, locale, "elements messages");
}

export function registerCalendarMessages(locale: Locale, pack: CalendarMessages): void {
  loadedCalendar[locale] = pack;
}

export function hasCalendarMessages(locale: Locale): boolean {
  return Boolean(loadedCalendar[locale]);
}

/** Calendar copy and data; on the client only after the calendar pack is loaded (calendar pages). */
export function calendarMessages(locale: Locale): CalendarMessages {
  return pick(loadedCalendar, locale, "calendar messages");
}

/**
 * Emoji meanings copy plus this locale's CLDR names, keywords and variant names, the English names, the usage
 * sentences and the emoji-test rows (one pack per locale).
 */
export type EmojiMessages = typeof import("../locales/emoji/en.json") & {
  /** CLDR short names by slug. */
  names: Record<string, string>;
  /** CLDR keywords by slug (the name itself left out). */
  keywords: Record<string, string[]>;
  /** CLDR names of the skin-tone and gender forms, by emoji. */
  variants: Record<string, string>;
  /** English CLDR names by slug, shown next to the local name outside English. */
  english: Record<string, string>;
  /** What people use each emoji for (written by cv.cm), by slug. */
  usage: Record<string, string>;
  data: import("./emoji-i18n").EmojiRow[];
};

const loadedEmoji: Partial<Record<Locale, EmojiMessages>> = {};

export function registerEmojiMessages(locale: Locale, pack: EmojiMessages): void {
  loadedEmoji[locale] = pack;
}

export function hasEmojiMessages(locale: Locale): boolean {
  return Boolean(loadedEmoji[locale]);
}

/** Emoji copy, names and rows; on the client only after the emoji pack is loaded (emoji pages). */
export function emojiMessages(locale: Locale): EmojiMessages {
  return pick(loadedEmoji, locale, "emoji messages");
}

/** Exchange-rate copy (`src/locales/currency/<locale>.json`) plus the ECB snapshot (`data`, the same in every locale's pack). */
export type CurrencyMessages = typeof import("../locales/currency/en.json") & {
  data: import("./currency-i18n").CurrencyData;
};

const loadedCurrency: Partial<Record<Locale, CurrencyMessages>> = {};

export function registerCurrencyMessages(locale: Locale, pack: CurrencyMessages): void {
  loadedCurrency[locale] = pack;
}

export function hasCurrencyMessages(locale: Locale): boolean {
  return Boolean(loadedCurrency[locale]);
}

/** Exchange-rate copy and the ECB snapshot; on the client only after the currency pack is loaded (currency pages). */
export function currencyMessages(locale: Locale): CurrencyMessages {
  return pick(loadedCurrency, locale, "currency messages");
}
