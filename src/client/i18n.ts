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
  hasKbArticle,
  hasKbMessages,
  hasQuizMessages,
  hasDatasetMessages,
  messages,
  registerGameMessages,
  registerLegalMessages,
  registerMessages,
  registerKbArticle,
  registerKbMessages,
  registerQuizMessages,
  registerDatasetMessages,
  type GameMessages,
  type LegalMessages,
  type LocaleMessages,
  type KbMessages,
  type QuizMessages,
  type DatasetMessages,
} from "../shared/messages";
import type { KbArticleCopy } from "../shared/kb-i18n";
import type { KbPage } from "../shared/kb";

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

// Personality test copy, only for /tests/ pages.
const QUIZ_PACKS: Record<Locale, () => Promise<{ default: QuizMessages }>> = {
  en: () => import("../locales/packs/quiz-en"),
  "zh-CN": () => import("../locales/packs/quiz-zh-CN"),
  "zh-TW": () => import("../locales/packs/quiz-zh-TW"),
  ja: () => import("../locales/packs/quiz-ja"),
  ko: () => import("../locales/packs/quiz-ko"),
  vi: () => import("../locales/packs/quiz-vi"),
  id: () => import("../locales/packs/quiz-id"),
  es: () => import("../locales/packs/quiz-es"),
};

// Data table copy, only for /datasets/ pages.
const DATASET_PACKS: Record<Locale, () => Promise<{ default: DatasetMessages }>> = {
  en: () => import("../locales/packs/datasets-en"),
  "zh-CN": () => import("../locales/packs/datasets-zh-CN"),
  "zh-TW": () => import("../locales/packs/datasets-zh-TW"),
  ja: () => import("../locales/packs/datasets-ja"),
  ko: () => import("../locales/packs/datasets-ko"),
  vi: () => import("../locales/packs/datasets-vi"),
  id: () => import("../locales/packs/datasets-id"),
  es: () => import("../locales/packs/datasets-es"),
};

// Knowledge article copy, only for /learn/knowledge/ pages.
const KB_PACKS: Record<Locale, () => Promise<{ default: KbMessages }>> = {
  en: () => import("../locales/packs/kb-en"),
  "zh-CN": () => import("../locales/packs/kb-zh-CN"),
  "zh-TW": () => import("../locales/packs/kb-zh-TW"),
  ja: () => import("../locales/packs/kb-ja"),
  ko: () => import("../locales/packs/kb-ko"),
  vi: () => import("../locales/packs/kb-vi"),
  id: () => import("../locales/packs/kb-id"),
  es: () => import("../locales/packs/kb-es"),
};


/** One chunk per article and locale. The 144-entry loader table is itself a lazy chunk, kept out of the entry. */
async function loadKbArticle(next: Locale, id: Exclude<KbPage, "hub" | null>): Promise<void> {
  const { KB_LOADERS } = await import("../locales/kb/loaders");
  const m = (await KB_LOADERS[next][id]()) as { default: KbArticleCopy };
  registerKbArticle(next, id, m.default);
}

/** Whether the strings a page needs are loaded: the locale pack, plus the game, legal, quiz, dataset or kb pack on those pages. */
export function hasPageMessages(next: Locale, game: boolean, legal = false, quiz = false, dataset = false, kb: KbPage = null): boolean {
  return hasMessages(next) && (!game || hasGameMessages(next)) && (!legal || hasLegalMessages(next)) && (!quiz || hasQuizMessages(next)) && (!dataset || hasDatasetMessages(next))
    && (!kb || (hasKbMessages(next) && (kb === "hub" || hasKbArticle(next, kb))));
}

export async function loadPageMessages(next: Locale, game: boolean, legal = false, quiz = false, dataset = false, kb: KbPage = null): Promise<void> {
  await Promise.all([
    hasMessages(next) ? null : PACKS[next]().then((m) => registerMessages(next, m.default)),
    !game || hasGameMessages(next) ? null : GAME_PACKS[next]().then((m) => registerGameMessages(next, m.default)),
    !legal || hasLegalMessages(next) ? null : LEGAL_PACKS[next]().then((m) => registerLegalMessages(next, m.default)),
    !quiz || hasQuizMessages(next) ? null : QUIZ_PACKS[next]().then((m) => registerQuizMessages(next, m.default)),
    !dataset || hasDatasetMessages(next) ? null : DATASET_PACKS[next]().then((m) => registerDatasetMessages(next, m.default)),
    !kb || hasKbMessages(next) ? null : KB_PACKS[next]().then((m) => registerKbMessages(next, m.default)),
    !kb || kb === "hub" || hasKbArticle(next, kb) ? null : loadKbArticle(next, kb),
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
      // A replacer function keeps "$&" and friends in user text literal.
      text = text.replaceAll(`{${key}}`, () => String(value));
    }
  }
  return text;
}

export { LOCALES };
export type { Locale };
