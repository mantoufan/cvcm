import type { Walkthrough } from "./game-walkthrough";
import type { GameCopy } from "./games-i18n";
import type { Locale } from "./locale";
import type { KbId } from "./kb";
import type { KbArticleCopy } from "./kb-i18n";
import type { MarketMessages } from "./markets-i18n";

export type UiMessages = typeof import("../locales/en.json");
export type GuideMessages = typeof import("../locales/guides/en.json");
export type DeviceMessages = typeof import("../locales/device/en.json");
export type GameName = { name: string; blurb: string };
export type LegalMessages = typeof import("../locales/legal/en.json");
export type QuizMessages = typeof import("../locales/quiz/en.json");
export type DatasetMessages = typeof import("../locales/datasets/en.json");
export type KbMessages = typeof import("../locales/kb/en.json");

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
