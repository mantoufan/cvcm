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
import type { Locale } from "./locale";
import {
  registerGameMessages,
  registerLegalMessages,
  registerMessages,
  type GameMessages,
  type LegalMessages,
  type LocaleMessages,
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

for (const [locale, pack] of Object.entries(ALL)) registerMessages(locale as Locale, pack);
for (const [locale, pack] of Object.entries(GAMES)) registerGameMessages(locale as Locale, pack);
for (const [locale, pack] of Object.entries(LEGAL)) registerLegalMessages(locale as Locale, pack);
