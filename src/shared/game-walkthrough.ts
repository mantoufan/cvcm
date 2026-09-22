import en from "../locales/games/walkthroughs/en.json";
import es from "../locales/games/walkthroughs/es.json";
import id from "../locales/games/walkthroughs/id.json";
import ja from "../locales/games/walkthroughs/ja.json";
import ko from "../locales/games/walkthroughs/ko.json";
import vi from "../locales/games/walkthroughs/vi.json";
import zhCN from "../locales/games/walkthroughs/zh-CN.json";
import zhTW from "../locales/games/walkthroughs/zh-TW.json";
import type { GameId } from "./games";
import type { Locale } from "./locale";

export type WalkthroughStep = {
  id: string;
  title: string;
  body: string;
  image?: string;
};

export type Walkthrough = {
  intro: string;
  steps: WalkthroughStep[];
};

const MESSAGES: Record<Locale, Record<string, Walkthrough>> = {
  en: en as Record<string, Walkthrough>,
  "zh-CN": zhCN as Record<string, Walkthrough>,
  "zh-TW": zhTW as Record<string, Walkthrough>,
  ja: ja as Record<string, Walkthrough>,
  ko: ko as Record<string, Walkthrough>,
  vi: vi as Record<string, Walkthrough>,
  id: id as Record<string, Walkthrough>,
  es: es as Record<string, Walkthrough>,
};

export function gameWalkthrough(locale: Locale, id: GameId): Walkthrough {
  return MESSAGES[locale][id] ?? MESSAGES.en[id];
}

export function gameGuideSteps(locale: Locale, id: GameId): WalkthroughStep[] {
  return gameWalkthrough(locale, id).steps;
}

export function walkthroughImage(gameId: GameId, slug: string): string {
  return `/covers/games/guides/${gameId}/${slug}.jpg?v=2`;
}
