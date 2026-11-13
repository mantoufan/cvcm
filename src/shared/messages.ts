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

export type UiMessages = typeof import("../locales/en.json");
export type GuideMessages = typeof import("../locales/guides/en.json");
export type DeviceMessages = typeof import("../locales/device/en.json");
export type GameName = { name: string; blurb: string };
export type LegalMessages = typeof import("../locales/legal/en.json");
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

/** Strings every page of one locale needs. The client loads only the active locale's pack. */
export type LocaleMessages = {
  ui: UiMessages;
  gameNames: Record<string, GameName>;
  guides: GuideMessages;
  device: DeviceMessages;
  markets: MarketMessages;
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
const loadedDatasets: Partial<Record<Locale, DatasetMessages>> = {};
const loadedKb: Partial<Record<Locale, KbMessages>> = {};
const loadedKbArticles: Partial<Record<Locale, Partial<Record<KbId, KbArticleCopy>>>> = {};
const loadedRef: Partial<Record<Locale, RefMessages>> = {};
const loadedRefEntries: Partial<Record<Locale, Partial<Record<RefId, RefEntryCopy>>>> = {};
const loadedSlang: Partial<Record<Locale, SlangMessages>> = {};
const loadedSlangEntries: Partial<Record<Locale, Partial<Record<SlangId, SlangEntryCopy>>>> = {};

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

/** Personality test copy; on the client only after the quiz pack is loaded (test pages). */
export function quizMessages(locale: Locale): QuizMessages {
  return pick(loadedQuiz, locale, "quiz messages");
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
