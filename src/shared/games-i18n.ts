import en from "../locales/games/en.json";
import es from "../locales/games/es.json";
import id from "../locales/games/id.json";
import ja from "../locales/games/ja.json";
import ko from "../locales/games/ko.json";
import vi from "../locales/games/vi.json";
import zhCN from "../locales/games/zh-CN.json";
import zhTW from "../locales/games/zh-TW.json";
import type { GameId } from "./games";
import type { Locale } from "./locale";

export type GameCopy = {
  name: string;
  blurb: string;
  title: string;
  description: string;
  lead: string;
  cheatsLead: string;
  cheat1?: string;
  cheat2?: string;
  cheat3?: string;
  cheat4?: string;
  cheat5?: string;
  cheat6?: string;
  s1t: string;
  s1b: string;
  s2t: string;
  s2b: string;
  s3t: string;
  s3b: string;
  s4t: string;
  s4b: string;
  s5t: string;
  s5b: string;
  q1: string;
  a1: string;
  q2: string;
  a2: string;
  q3: string;
  a3: string;
  q4: string;
  a4: string;
  q5: string;
  a5: string;
};

const MESSAGES: Record<Locale, Record<string, GameCopy>> = {
  en: en as Record<string, GameCopy>,
  "zh-CN": zhCN as Record<string, GameCopy>,
  "zh-TW": zhTW as Record<string, GameCopy>,
  ja: ja as Record<string, GameCopy>,
  ko: ko as Record<string, GameCopy>,
  vi: vi as Record<string, GameCopy>,
  id: id as Record<string, GameCopy>,
  es: es as Record<string, GameCopy>,
};

export function gameCopy(locale: Locale, id: GameId): GameCopy {
  return MESSAGES[locale][id] ?? MESSAGES.en[id];
}

function field(copy: GameCopy, key: keyof GameCopy): string | undefined {
  const value = copy[key];
  return typeof value === "string" && value ? value : undefined;
}

export function gameFaqItems(locale: Locale, id: GameId): { q: string; a: string }[] {
  const copy = gameCopy(locale, id);
  const items = [];
  for (let i = 1; i <= 5; i++) {
    const q = field(copy, `q${i}` as keyof GameCopy);
    const a = field(copy, `a${i}` as keyof GameCopy);
    if (!q || !a) break;
    items.push({ q, a });
  }
  return items;
}

export { gameGuideSteps, gameWalkthrough, walkthroughImage } from "./game-walkthrough";

export function gameCheatLabels(locale: Locale, id: GameId): string[] {
  const copy = gameCopy(locale, id);
  const labels = [];
  for (let i = 1; i <= 6; i++) {
    const label = field(copy, `cheat${i}` as keyof GameCopy);
    if (!label) break;
    labels.push(label);
  }
  return labels;
}
