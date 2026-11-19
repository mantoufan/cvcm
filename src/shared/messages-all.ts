// Registers every locale up front. The Worker and tests use this; the client loads one pack at a time.
import en from "../locales/packs/full/en";
import es from "../locales/packs/full/es";
import id from "../locales/packs/full/id";
import ja from "../locales/packs/full/ja";
import ko from "../locales/packs/full/ko";
import vi from "../locales/packs/full/vi";
import zhCN from "../locales/packs/full/zh-CN";
import zhTW from "../locales/packs/full/zh-TW";
import enGames from "../locales/packs/games-en";
import esGames from "../locales/packs/games-es";
import idGames from "../locales/packs/games-id";
import jaGames from "../locales/packs/games-ja";
import koGames from "../locales/packs/games-ko";
import viGames from "../locales/packs/games-vi";
import zhCNGames from "../locales/packs/games-zh-CN";
import zhTWGames from "../locales/packs/games-zh-TW";
import enLegal from "../locales/legal/en.json";
import esLegal from "../locales/legal/es.json";
import idLegal from "../locales/legal/id.json";
import jaLegal from "../locales/legal/ja.json";
import koLegal from "../locales/legal/ko.json";
import viLegal from "../locales/legal/vi.json";
import zhCNLegal from "../locales/legal/zh-CN.json";
import zhTWLegal from "../locales/legal/zh-TW.json";
import enQuiz from "../locales/packs/quiz-en";
import esQuiz from "../locales/packs/quiz-es";
import idQuiz from "../locales/packs/quiz-id";
import jaQuiz from "../locales/packs/quiz-ja";
import koQuiz from "../locales/packs/quiz-ko";
import viQuiz from "../locales/packs/quiz-vi";
import zhCNQuiz from "../locales/packs/quiz-zh-CN";
import zhTWQuiz from "../locales/packs/quiz-zh-TW";
import enDatasets from "../locales/packs/datasets-en";
import esDatasets from "../locales/packs/datasets-es";
import idDatasets from "../locales/packs/datasets-id";
import jaDatasets from "../locales/packs/datasets-ja";
import koDatasets from "../locales/packs/datasets-ko";
import viDatasets from "../locales/packs/datasets-vi";
import zhCNDatasets from "../locales/packs/datasets-zh-CN";
import zhTWDatasets from "../locales/packs/datasets-zh-TW";
import enKb from "../locales/packs/kb-en";
import esKb from "../locales/packs/kb-es";
import idKb from "../locales/packs/kb-id";
import jaKb from "../locales/packs/kb-ja";
import koKb from "../locales/packs/kb-ko";
import viKb from "../locales/packs/kb-vi";
import zhCNKb from "../locales/packs/kb-zh-CN";
import zhTWKb from "../locales/packs/kb-zh-TW";
import { KB_ALL } from "../locales/kb/all";
import enRef from "../locales/packs/ref-en";
import esRef from "../locales/packs/ref-es";
import idRef from "../locales/packs/ref-id";
import jaRef from "../locales/packs/ref-ja";
import koRef from "../locales/packs/ref-ko";
import viRef from "../locales/packs/ref-vi";
import zhCNRef from "../locales/packs/ref-zh-CN";
import zhTWRef from "../locales/packs/ref-zh-TW";
import { REF_ALL } from "../locales/ref/all";
import enSlang from "../locales/packs/slang-en";
import esSlang from "../locales/packs/slang-es";
import idSlang from "../locales/packs/slang-id";
import jaSlang from "../locales/packs/slang-ja";
import koSlang from "../locales/packs/slang-ko";
import viSlang from "../locales/packs/slang-vi";
import zhCNSlang from "../locales/packs/slang-zh-CN";
import zhTWSlang from "../locales/packs/slang-zh-TW";
import { SLANG_ALL } from "../locales/slang/all";
import enIdeas from "../locales/packs/ideas-en";
import esIdeas from "../locales/packs/ideas-es";
import idIdeas from "../locales/packs/ideas-id";
import jaIdeas from "../locales/packs/ideas-ja";
import koIdeas from "../locales/packs/ideas-ko";
import viIdeas from "../locales/packs/ideas-vi";
import zhCNIdeas from "../locales/packs/ideas-zh-CN";
import zhTWIdeas from "../locales/packs/ideas-zh-TW";
import { IDEAS_ALL } from "../locales/ideas/all";
import type { IdeaId } from "./ideas";
import type { SlangId } from "./slang";
import enCalendar from "../locales/packs/calendar-en";
import esCalendar from "../locales/packs/calendar-es";
import idCalendar from "../locales/packs/calendar-id";
import jaCalendar from "../locales/packs/calendar-ja";
import koCalendar from "../locales/packs/calendar-ko";
import viCalendar from "../locales/packs/calendar-vi";
import zhCNCalendar from "../locales/packs/calendar-zh-CN";
import zhTWCalendar from "../locales/packs/calendar-zh-TW";
import enNostalgia from "../locales/packs/nostalgia-en";
import esNostalgia from "../locales/packs/nostalgia-es";
import idNostalgia from "../locales/packs/nostalgia-id";
import jaNostalgia from "../locales/packs/nostalgia-ja";
import koNostalgia from "../locales/packs/nostalgia-ko";
import viNostalgia from "../locales/packs/nostalgia-vi";
import zhCNNostalgia from "../locales/packs/nostalgia-zh-CN";
import zhTWNostalgia from "../locales/packs/nostalgia-zh-TW";
import { NOSTALGIA_ALL } from "../locales/nostalgia/all";
import { QUIZ_ALL } from "../locales/quiz/all";
import type { QuizId } from "./quiz";
import type { NostalgiaId } from "./nostalgia";
import type { RefId } from "./ref";
import type { KbId } from "./kb";
import type { Locale } from "./locale";
import {
  registerGameMessages,
  registerKbArticle,
  registerKbMessages,
  registerLegalMessages,
  registerMessages,
  registerQuizMessages,
  registerQuizTest,
  registerDatasetMessages,
  registerRefEntry,
  registerRefMessages,
  registerSlangEntry,
  registerSlangMessages,
  registerIdeaEntry,
  registerIdeasMessages,
  registerNostalgiaEntry,
  registerNostalgiaMessages,
  registerCalendarMessages,
  type GameMessages,
  type KbMessages,
  type LegalMessages,
  type LocaleMessages,
  type QuizMessages,
  type DatasetMessages,
  type RefMessages,
  type SlangMessages,
  type IdeasMessages,
  type NostalgiaMessages,
  type CalendarMessages,
} from "./messages";

const ALL: Record<Locale, LocaleMessages> = { en, "zh-CN": zhCN, "zh-TW": zhTW, ja, ko, vi, id, es };
const GAMES: Record<Locale, GameMessages> = {
  en: enGames,
  "zh-CN": zhCNGames,
  "zh-TW": zhTWGames,
  ja: jaGames,
  ko: koGames,
  vi: viGames,
  id: idGames,
  es: esGames,
};

const LEGAL: Record<Locale, LegalMessages> = {
  en: enLegal,
  "zh-CN": zhCNLegal,
  "zh-TW": zhTWLegal,
  ja: jaLegal,
  ko: koLegal,
  vi: viLegal,
  id: idLegal,
  es: esLegal,
};

const QUIZ: Record<Locale, QuizMessages> = {
  en: enQuiz,
  "zh-CN": zhCNQuiz,
  "zh-TW": zhTWQuiz,
  ja: jaQuiz,
  ko: koQuiz,
  vi: viQuiz,
  id: idQuiz,
  es: esQuiz,
};

const KB: Record<Locale, KbMessages> = {
  en: enKb,
  "zh-CN": zhCNKb,
  "zh-TW": zhTWKb,
  ja: jaKb,
  ko: koKb,
  vi: viKb,
  id: idKb,
  es: esKb,
};

for (const [locale, pack] of Object.entries(ALL)) registerMessages(locale as Locale, pack);
for (const [locale, pack] of Object.entries(GAMES)) registerGameMessages(locale as Locale, pack);
for (const [locale, pack] of Object.entries(LEGAL)) registerLegalMessages(locale as Locale, pack);
for (const [locale, pack] of Object.entries(QUIZ)) registerQuizMessages(locale as Locale, pack);
for (const [locale, tests] of Object.entries(QUIZ_ALL)) {
  for (const [id, copy] of Object.entries(tests)) registerQuizTest(locale as Locale, id as QuizId, copy);
}

const DATASETS: Record<Locale, DatasetMessages> = {
  en: enDatasets,
  "zh-CN": zhCNDatasets,
  "zh-TW": zhTWDatasets,
  ja: jaDatasets,
  ko: koDatasets,
  vi: viDatasets,
  id: idDatasets,
  es: esDatasets,
};
for (const [locale, pack] of Object.entries(DATASETS)) registerDatasetMessages(locale as Locale, pack);
for (const [locale, pack] of Object.entries(KB)) registerKbMessages(locale as Locale, pack);
for (const [locale, articles] of Object.entries(KB_ALL)) {
  for (const [id, copy] of Object.entries(articles)) registerKbArticle(locale as Locale, id as KbId, copy);
}

const REF: Record<Locale, RefMessages> = {
  en: enRef,
  "zh-CN": zhCNRef,
  "zh-TW": zhTWRef,
  ja: jaRef,
  ko: koRef,
  vi: viRef,
  id: idRef,
  es: esRef,
};
for (const [locale, pack] of Object.entries(REF)) registerRefMessages(locale as Locale, pack);
for (const [locale, entries] of Object.entries(REF_ALL)) {
  for (const [id, copy] of Object.entries(entries)) registerRefEntry(locale as Locale, id as RefId, copy);
}

const SLANG: Record<Locale, SlangMessages> = {
  en: enSlang,
  "zh-CN": zhCNSlang,
  "zh-TW": zhTWSlang,
  ja: jaSlang,
  ko: koSlang,
  vi: viSlang,
  id: idSlang,
  es: esSlang,
};
for (const [locale, pack] of Object.entries(SLANG)) registerSlangMessages(locale as Locale, pack);
for (const [locale, entries] of Object.entries(SLANG_ALL)) {
  for (const [id, copy] of Object.entries(entries)) registerSlangEntry(locale as Locale, id as SlangId, copy);
}

const IDEAS: Record<Locale, IdeasMessages> = {
  en: enIdeas,
  "zh-CN": zhCNIdeas,
  "zh-TW": zhTWIdeas,
  ja: jaIdeas,
  ko: koIdeas,
  vi: viIdeas,
  id: idIdeas,
  es: esIdeas,
};
for (const [locale, pack] of Object.entries(IDEAS)) registerIdeasMessages(locale as Locale, pack);
for (const [locale, entries] of Object.entries(IDEAS_ALL)) {
  for (const [id, copy] of Object.entries(entries)) registerIdeaEntry(locale as Locale, id as IdeaId, copy);
}

const NOSTALGIA: Record<Locale, NostalgiaMessages> = {
  en: enNostalgia,
  "zh-CN": zhCNNostalgia,
  "zh-TW": zhTWNostalgia,
  ja: jaNostalgia,
  ko: koNostalgia,
  vi: viNostalgia,
  id: idNostalgia,
  es: esNostalgia,
};
for (const [locale, pack] of Object.entries(NOSTALGIA)) registerNostalgiaMessages(locale as Locale, pack);
const CALENDAR: Record<Locale, CalendarMessages> = {
  en: enCalendar,
  "zh-CN": zhCNCalendar,
  "zh-TW": zhTWCalendar,
  ja: jaCalendar,
  ko: koCalendar,
  vi: viCalendar,
  id: idCalendar,
  es: esCalendar,
};
for (const [locale, pack] of Object.entries(CALENDAR)) registerCalendarMessages(locale as Locale, pack);
for (const [locale, entries] of Object.entries(NOSTALGIA_ALL)) {
  for (const [id, copy] of Object.entries(entries)) registerNostalgiaEntry(locale as Locale, id as NostalgiaId, copy);
}

// Country profiles keep their own store (countries-store.ts).
import "./countries-all";

import enCalories from "../locales/packs/calories-en";
import esCalories from "../locales/packs/calories-es";
import idCalories from "../locales/packs/calories-id";
import jaCalories from "../locales/packs/calories-ja";
import koCalories from "../locales/packs/calories-ko";
import viCalories from "../locales/packs/calories-vi";
import zhCNCalories from "../locales/packs/calories-zh-CN";
import zhTWCalories from "../locales/packs/calories-zh-TW";
import { registerCaloriesMessages, type CaloriesMessages } from "./messages";

const CALORIES: Record<Locale, CaloriesMessages> = {
  en: enCalories,
  "zh-CN": zhCNCalories,
  "zh-TW": zhTWCalories,
  ja: jaCalories,
  ko: koCalories,
  vi: viCalories,
  id: idCalories,
  es: esCalories,
};
for (const [locale, pack] of Object.entries(CALORIES)) registerCaloriesMessages(locale as Locale, pack);
// Periodic table packs (copy, names and PubChem rows).
import enElements from "../locales/packs/elements-en";
import esElements from "../locales/packs/elements-es";
import idElements from "../locales/packs/elements-id";
import jaElements from "../locales/packs/elements-ja";
import koElements from "../locales/packs/elements-ko";
import viElements from "../locales/packs/elements-vi";
import zhCNElements from "../locales/packs/elements-zh-CN";
import zhTWElements from "../locales/packs/elements-zh-TW";
import { registerElementsMessages, type ElementsMessages } from "./messages";

const ELEMENTS: Record<Locale, ElementsMessages> = {
  en: enElements,
  "zh-CN": zhCNElements,
  "zh-TW": zhTWElements,
  ja: jaElements,
  ko: koElements,
  vi: viElements,
  id: idElements,
  es: esElements,
};
for (const [locale, pack] of Object.entries(ELEMENTS)) registerElementsMessages(locale as Locale, pack);
// Emoji meanings packs (copy, CLDR names and keywords, usage sentences, emoji-test rows).
import enEmoji from "../locales/packs/emoji-en";
import esEmoji from "../locales/packs/emoji-es";
import idEmoji from "../locales/packs/emoji-id";
import jaEmoji from "../locales/packs/emoji-ja";
import koEmoji from "../locales/packs/emoji-ko";
import viEmoji from "../locales/packs/emoji-vi";
import zhCNEmoji from "../locales/packs/emoji-zh-CN";
import zhTWEmoji from "../locales/packs/emoji-zh-TW";
import { registerEmojiMessages, type EmojiMessages } from "./messages";

const EMOJI: Record<Locale, EmojiMessages> = {
  en: enEmoji,
  "zh-CN": zhCNEmoji,
  "zh-TW": zhTWEmoji,
  ja: jaEmoji,
  ko: koEmoji,
  vi: viEmoji,
  id: idEmoji,
  es: esEmoji,
};
for (const [locale, pack] of Object.entries(EMOJI)) registerEmojiMessages(locale as Locale, pack);

import enCurrency from "../locales/packs/currency-en";
import esCurrency from "../locales/packs/currency-es";
import idCurrency from "../locales/packs/currency-id";
import jaCurrency from "../locales/packs/currency-ja";
import koCurrency from "../locales/packs/currency-ko";
import viCurrency from "../locales/packs/currency-vi";
import zhCNCurrency from "../locales/packs/currency-zh-CN";
import zhTWCurrency from "../locales/packs/currency-zh-TW";
import { registerCurrencyMessages, type CurrencyMessages } from "./messages";

const CURRENCY: Record<Locale, CurrencyMessages> = {
  en: enCurrency,
  "zh-CN": zhCNCurrency,
  "zh-TW": zhTWCurrency,
  ja: jaCurrency,
  ko: koCurrency,
  vi: viCurrency,
  id: idCurrency,
  es: esCurrency,
};
for (const [locale, pack] of Object.entries(CURRENCY)) registerCurrencyMessages(locale as Locale, pack);
