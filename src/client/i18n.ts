import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALES,
  parseLocale,
  type Locale,
} from "../shared/locale";
import { hasMessages, messages, registerMessages, type LocaleMessages } from "../shared/messages";

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

export { hasMessages };

export async function loadLocale(next: Locale): Promise<void> {
  if (hasMessages(next)) return;
  registerMessages(next, (await PACKS[next]()).default);
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
