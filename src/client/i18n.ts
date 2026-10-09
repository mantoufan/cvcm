import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALES,
  parseLocale,
  type Locale,
} from "../shared/locale";
import {
  hasGameMessages,
  hasLegalMessages,
  hasMessages,
  messages,
  registerGameMessages,
  registerLegalMessages,
  registerMessages,
  type GameMessages,
  type LegalMessages,
  type LocaleMessages,
} from "../shared/messages";

// One chunk per locale, so a page downloads only the strings it shows.
const PACKS: Record<Locale, () => Promise<{ default: LocaleMessages }>> = {
  en: () => import("../locales/packs/en"),
  "zh-CN": () => import("../locales/packs/zh-CN"),
  "zh-TW": () => import("../locales/packs/zh-TW"),
  ja: () => import("../locales/packs/ja"),
  ko: () => import("../locales/packs/ko"),
  vi: () => import("../locales/packs/vi"),
  id: () => import("../locales/packs/id"),
  es: () => import("../locales/packs/es"),
};

// Full game copy and walkthroughs, only for game pages.
const GAME_PACKS: Record<Locale, () => Promise<{ default: GameMessages }>> = {
  en: () => import("../locales/packs/games-en"),
  "zh-CN": () => import("../locales/packs/games-zh-CN"),
  "zh-TW": () => import("../locales/packs/games-zh-TW"),
  ja: () => import("../locales/packs/games-ja"),
  ko: () => import("../locales/packs/games-ko"),
  vi: () => import("../locales/packs/games-vi"),
  id: () => import("../locales/packs/games-id"),
  es: () => import("../locales/packs/games-es"),
};

// Privacy policy and terms, only for those two pages.
const LEGAL_PACKS: Record<Locale, () => Promise<{ default: LegalMessages }>> = {
  en: () => import("../locales/legal/en.json"),
  "zh-CN": () => import("../locales/legal/zh-CN.json"),
  "zh-TW": () => import("../locales/legal/zh-TW.json"),
  ja: () => import("../locales/legal/ja.json"),
  ko: () => import("../locales/legal/ko.json"),
  vi: () => import("../locales/legal/vi.json"),
  id: () => import("../locales/legal/id.json"),
  es: () => import("../locales/legal/es.json"),
};

/** Whether the strings a page needs are loaded: the locale pack, plus the game or legal pack on those pages. */
export function hasPageMessages(next: Locale, game: boolean, legal = false): boolean {
  return hasMessages(next) && (!game || hasGameMessages(next)) && (!legal || hasLegalMessages(next));
}

export async function loadPageMessages(next: Locale, game: boolean, legal = false): Promise<void> {
  await Promise.all([
    hasMessages(next) ? null : PACKS[next]().then((m) => registerMessages(next, m.default)),
    !game || hasGameMessages(next) ? null : GAME_PACKS[next]().then((m) => registerGameMessages(next, m.default)),
    !legal || hasLegalMessages(next) ? null : LEGAL_PACKS[next]().then((m) => registerLegalMessages(next, m.default)),
  ]);
}

let current: Locale = DEFAULT_LOCALE;

export function locale(): Locale {
  return current;
}

export function setLocale(next: Locale): void {
  current = next;
  document.documentElement.lang = next;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LOCALE_COOKIE}=${next}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
  try {
    localStorage.setItem(LOCALE_COOKIE, next);
  } catch {
    /* private mode */
  }
}

export function readStoredLocale(): Locale | null {
  try {
    const stored = parseLocale(localStorage.getItem(LOCALE_COOKIE));
    if (stored) return stored;
  } catch {
    /* ignore */
  }
  return null;
}

export function t(path: string, vars?: Record<string, string | number>): string {
  const parts = path.split(".");
  let node: unknown = messages(current).ui;
  for (const part of parts) {
    if (typeof node !== "object" || node === null || !(part in node)) {
      node = undefined;
      break;
    }
    node = (node as Record<string, unknown>)[part];
  }
  let text = typeof node === "string" ? node : path;
  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${key}}`, String(value));
    }
  }
  return text;
}

export { LOCALES };
export type { Locale };
