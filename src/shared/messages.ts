import type { Walkthrough } from "./game-walkthrough";
import type { GameCopy } from "./games-i18n";
import type { Locale } from "./locale";
import type { MarketMessages } from "./markets-i18n";

export type UiMessages = typeof import("../locales/en.json");
export type GuideMessages = typeof import("../locales/guides/en.json");
export type DeviceMessages = typeof import("../locales/device/en.json");
export type GameName = { name: string; blurb: string };
export type LegalMessages = typeof import("../locales/legal/en.json");

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
