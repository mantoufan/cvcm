// Registers every locale up front. The Worker and tests use this; the client loads one pack at a time.
import en from "../locales/packs/en";
import es from "../locales/packs/es";
import id from "../locales/packs/id";
import ja from "../locales/packs/ja";
import ko from "../locales/packs/ko";
import vi from "../locales/packs/vi";
import zhCN from "../locales/packs/zh-CN";
import zhTW from "../locales/packs/zh-TW";
import type { Locale } from "./locale";
import { registerMessages, type LocaleMessages } from "./messages";

const ALL: Record<Locale, LocaleMessages> = { en, "zh-CN": zhCN, "zh-TW": zhTW, ja, ko, vi, id, es };

for (const [locale, pack] of Object.entries(ALL)) registerMessages(locale as Locale, pack);
