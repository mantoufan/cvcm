import en from "../locales/markets/en.json";
import es from "../locales/markets/es.json";
import id from "../locales/markets/id.json";
import ja from "../locales/markets/ja.json";
import ko from "../locales/markets/ko.json";
import vi from "../locales/markets/vi.json";
import zhCN from "../locales/markets/zh-CN.json";
import zhTW from "../locales/markets/zh-TW.json";
import type { MarketId } from "./markets";
import type { Locale } from "./locale";

export type MarketFaq = { q: string; a: string };

export type MarketPageCopy = {
  name: string;
  blurb: string;
  title: string;
  description: string;
  h1: string;
  lead: string;
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

export type MarketHubCopy = {
  name: string;
  title: string;
  description: string;
  h1: string;
  lead: string;
  menu: string;
  blurb: string;
  all: string;
  disclaimer: string;
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

export type MarketUi = {
  back: string;
  home: string;
  weight: string;
  unit: string;
  g: string;
  troyOz: string;
  hkTael: string;
  marketTael: string;
  twTael: string;
  price: string;
  priceHint: string;
  result: string;
  copy: string;
  copied: string;
  invalid: string;
  perGram: string;
  perTroyOz: string;
  perHk: string;
  perMarket: string;
  perTw: string;
  shares: string;
  eps: string;
  dividend: string;
  marketCap: string;
  pe: string;
  yield: string;
  blank: string;
  note: string;
  stockInvalid: string;
  loan: string;
  compound: string;
  percent: string;
  units: string;
  toSilver: string;
  toGold: string;
};

type MarketMessages = {
  nav: string;
  hub: MarketHubCopy;
  ui: MarketUi;
  pages: Record<MarketId, MarketPageCopy>;
};

const MESSAGES: Record<Locale, MarketMessages> = {
  en,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  ja,
  ko,
  vi,
  id,
  es,
};

export function marketNav(locale: Locale): string {
  return MESSAGES[locale].nav;
}

export function marketHub(locale: Locale): MarketHubCopy {
  return MESSAGES[locale].hub;
}

export function marketUi(locale: Locale): MarketUi {
  return MESSAGES[locale].ui;
}

export function marketCopy(locale: Locale, id: MarketId): MarketPageCopy {
  return MESSAGES[locale].pages[id];
}

function five(copy: { q1: string; a1: string; q2: string; a2: string; q3: string; a3: string; q4: string; a4: string; q5: string; a5: string }): MarketFaq[] {
  return [1, 2, 3, 4, 5].map((i) => ({
    q: copy[`q${i}` as "q1"],
    a: copy[`a${i}` as "a1"],
  }));
}

export function marketFaqItems(locale: Locale, id: MarketId): MarketFaq[] {
  return five(marketCopy(locale, id));
}

export function marketHubFaqItems(locale: Locale): MarketFaq[] {
  return five(marketHub(locale));
}
