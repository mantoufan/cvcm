import type { Locale } from "./locale";

export type UiMessages = typeof import("../locales/en.json");
export type GuideMessages = typeof import("../locales/guides/en.json");
export type DeviceMessages = typeof import("../locales/device/en.json");

/** Every string bundle for one locale. The client loads only the active one. */
export type LocaleMessages = {
  ui: UiMessages;
  games: Record<string, unknown>;
  walkthroughs: Record<string, unknown>;
  guides: GuideMessages;
  device: DeviceMessages;
  markets: Record<string, unknown>;
};

const loaded: Partial<Record<Locale, LocaleMessages>> = {};

export function registerMessages(locale: Locale, pack: LocaleMessages): void {
  loaded[locale] = pack;
}

export function hasMessages(locale: Locale): boolean {
  return Boolean(loaded[locale]);
}

export function messages(locale: Locale): LocaleMessages {
  const pack = loaded[locale] ?? loaded.en ?? Object.values(loaded)[0];
  if (!pack) throw new Error(`messages not loaded: ${locale}`);
  return pack;
}
