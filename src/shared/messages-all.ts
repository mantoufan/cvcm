// Registers every locale up front. The Worker and tests use this; the client loads one pack at a time.
import en from "../locales/packs/en";
import es from "../locales/packs/es";
import id from "../locales/packs/id";
import ja from "../locales/packs/ja";
import ko from "../locales/packs/ko";
import vi from "../locales/packs/vi";
import zhCN from "../locales/packs/zh-CN";
import zhTW from "../locales/packs/zh-TW";
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
import type { KbId } from "./kb";
import type { Locale } from "./locale";
import {
  registerGameMessages,
  registerKbArticle,
  registerKbMessages,
  registerLegalMessages,
  registerMessages,
  registerQuizMessages,
  registerDatasetMessages,
  type GameMessages,
  type KbMessages,
  type LegalMessages,
  type LocaleMessages,
  type QuizMessages,
  type DatasetMessages,
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
