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
  hasRefEntry,
  hasRefMessages,
  messages,
  registerGameMessages,
  registerLegalMessages,
  registerMessages,
  registerKbArticle,
  registerKbMessages,
  registerQuizMessages,
  registerDatasetMessages,
  registerRefEntry,
  registerRefMessages,
  type GameMessages,
  type LegalMessages,
  type CopyLoaders,
  type LocaleMessages,
  type KbMessages,
  type QuizMessages,
  type DatasetMessages,
  type RefMessages,
  type SlangMessages,
  hasSlangEntry,
  hasSlangMessages,
  registerSlangEntry,
  registerSlangMessages,
} from "../shared/messages";
import type { KbArticleCopy } from "../shared/kb-i18n";
import { kbArticleOf, type KbId, type KbPage } from "../shared/kb";
import type { RefEntryCopy } from "../shared/ref-i18n";
import type { RefId, RefPage } from "../shared/ref";
import type { SlangEntryCopy } from "../shared/slang-i18n";
import type { SlangId, SlangPage } from "../shared/slang";
import { copyBucket, hasToolCopy, hasTutorialCopy, mergeToolCopy, mergeTutorialCopy, type PageCopy } from "../shared/page-copy";

export type { PageCopy };

// One chunk per locale, so a page downloads only the strings it shows. A pack leaves out the copy only one page
// shows (a tool's FAQ and how-to, a tutorial's text): that is in bucket chunks, found through COPY_LOADERS.
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

// A locale's page-copy bucket loaders (a small lazy chunk, kept out of the entry and out of the pack).
const COPY_LOADERS: Record<Locale, () => Promise<{ copy: CopyLoaders }>> = {
  en: () => import("virtual:page-copy/loaders/en"),
  "zh-CN": () => import("virtual:page-copy/loaders/zh-CN"),
  "zh-TW": () => import("virtual:page-copy/loaders/zh-TW"),
  ja: () => import("virtual:page-copy/loaders/ja"),
  ko: () => import("virtual:page-copy/loaders/ko"),
  vi: () => import("virtual:page-copy/loaders/vi"),
  id: () => import("virtual:page-copy/loaders/id"),
  es: () => import("virtual:page-copy/loaders/es"),
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

// Kb hub copy and the coding and AI shelf meta, only for /learn/knowledge/, /learn/code/ and /learn/ai/ pages.
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


// One chunk per article and locale, found through that locale's loader table (itself a lazy chunk, kept out of the entry).
const KB_LOADER_TABLES: Record<Locale, () => Promise<{ KB_LOADERS: Record<KbId, () => Promise<unknown>> }>> = {
  en: () => import("../locales/kb/loaders/en"),
  "zh-CN": () => import("../locales/kb/loaders/zh-CN"),
  "zh-TW": () => import("../locales/kb/loaders/zh-TW"),
  ja: () => import("../locales/kb/loaders/ja"),
  ko: () => import("../locales/kb/loaders/ko"),
  vi: () => import("../locales/kb/loaders/vi"),
  id: () => import("../locales/kb/loaders/id"),
  es: () => import("../locales/kb/loaders/es"),
};

async function loadKbArticle(next: Locale, id: KbId): Promise<void> {
  const { KB_LOADERS } = await KB_LOADER_TABLES[next]();
  const m = (await KB_LOADERS[id]()) as { default: KbArticleCopy };
  registerKbArticle(next, id, m.default);
}

// Reference hub copy plus entry names (`npm run ref:sync`), only for /reference/ pages.
const REF_PACKS: Record<Locale, () => Promise<{ default: RefMessages }>> = {
  en: () => import("../locales/packs/ref-en"),
  "zh-CN": () => import("../locales/packs/ref-zh-CN"),
  "zh-TW": () => import("../locales/packs/ref-zh-TW"),
  ja: () => import("../locales/packs/ref-ja"),
  ko: () => import("../locales/packs/ref-ko"),
  vi: () => import("../locales/packs/ref-vi"),
  id: () => import("../locales/packs/ref-id"),
  es: () => import("../locales/packs/ref-es"),
};

// One chunk per reference entry and locale, through that locale's generated loader table (like kb articles).
const REF_LOADER_TABLES: Record<Locale, () => Promise<{ REF_LOADERS: Record<RefId, () => Promise<unknown>> }>> = {
  en: () => import("../locales/ref/loaders/en"),
  "zh-CN": () => import("../locales/ref/loaders/zh-CN"),
  "zh-TW": () => import("../locales/ref/loaders/zh-TW"),
  ja: () => import("../locales/ref/loaders/ja"),
  ko: () => import("../locales/ref/loaders/ko"),
  vi: () => import("../locales/ref/loaders/vi"),
  id: () => import("../locales/ref/loaders/id"),
  es: () => import("../locales/ref/loaders/es"),
};

async function loadRefEntry(next: Locale, id: RefId): Promise<void> {
  const { REF_LOADERS } = await REF_LOADER_TABLES[next]();
  const m = (await REF_LOADERS[id]()) as { default: RefEntryCopy };
  registerRefEntry(next, id, m.default);
}

// Slang hub copy plus entry names (`npm run slang:sync`), only for /memes/ pages.
const SLANG_PACKS: Record<Locale, () => Promise<{ default: SlangMessages }>> = {
  en: () => import("../locales/packs/slang-en"),
  "zh-CN": () => import("../locales/packs/slang-zh-CN"),
  "zh-TW": () => import("../locales/packs/slang-zh-TW"),
  ja: () => import("../locales/packs/slang-ja"),
  ko: () => import("../locales/packs/slang-ko"),
  vi: () => import("../locales/packs/slang-vi"),
  id: () => import("../locales/packs/slang-id"),
  es: () => import("../locales/packs/slang-es"),
};

// One chunk per slang entry and locale, through that locale's generated loader table.
const SLANG_LOADER_TABLES: Record<Locale, () => Promise<{ SLANG_LOADERS: Record<SlangId, () => Promise<unknown>> }>> = {
  en: () => import("../locales/slang/loaders/en"),
  "zh-CN": () => import("../locales/slang/loaders/zh-CN"),
  "zh-TW": () => import("../locales/slang/loaders/zh-TW"),
  ja: () => import("../locales/slang/loaders/ja"),
  ko: () => import("../locales/slang/loaders/ko"),
  vi: () => import("../locales/slang/loaders/vi"),
  id: () => import("../locales/slang/loaders/id"),
  es: () => import("../locales/slang/loaders/es"),
};

async function loadSlangEntry(next: Locale, id: SlangId): Promise<void> {
  const { SLANG_LOADERS } = await SLANG_LOADER_TABLES[next]();
  const m = (await SLANG_LOADERS[id]()) as { default: SlangEntryCopy };
  registerSlangEntry(next, id, m.default);
}

// Buckets merged into a locale's pack ("<locale>/tools/<n>"). Once a bucket is in, its ids are settled even if
// one of them has no copy there (an id without a how-to): the page then renders as it would with the full pack.
const mergedBuckets = new Set<string>();
// Bucket downloads under way, so a hover prefetch and the page's own load share one request and one merge.
const bucketLoads = new Map<string, Promise<void>>();

function hasPageCopy(next: Locale, copy: PageCopy): boolean {
  if (!copy.tool && !copy.tutorial) return true;
  if (!hasMessages(next)) return false;
  const pack = messages(next);
  return (!copy.tool || hasToolCopy(pack, copy.tool) || mergedBuckets.has(`${next}/tools/${copyBucket(copy.tool)}`))
    && (!copy.tutorial || hasTutorialCopy(pack, copy.tutorial) || mergedBuckets.has(`${next}/tutorials/${copyBucket(copy.tutorial)}`));
}

function loadBucket(next: Locale, kind: "tools" | "tutorials", id: string, core: Promise<void> | null): Promise<void> {
  const key = `${next}/${kind}/${copyBucket(id)}`;
  let load = bucketLoads.get(key);
  if (!load) {
    const bucket = copyBucket(id);
    // The pack and the bucket download side by side; the bucket is merged once the pack is registered.
    const merged = kind === "tools"
      ? Promise.all([COPY_LOADERS[next]().then((m) => m.copy.tools[bucket]()), core]).then(([m]) => mergeToolCopy(messages(next), m.default))
      : Promise.all([COPY_LOADERS[next]().then((m) => m.copy.tutorials[bucket]()), core]).then(([m]) => mergeTutorialCopy(messages(next), m.default));
    load = merged.then(() => {
      mergedBuckets.add(key);
    }).finally(() => bucketLoads.delete(key));
    bucketLoads.set(key, load);
  }
  return load;
}

const coreLoads = new Map<Locale, Promise<void>>();

/** Loads the core pack if needed, and with it the buckets for this page's tool and tutorial, merged into the pack. */
async function loadCore(next: Locale, copy: PageCopy): Promise<void> {
  let core = hasMessages(next) ? null : coreLoads.get(next) ?? null;
  if (!core && !hasMessages(next)) {
    core = PACKS[next]().then((m) => {
      // Never re-register: a registered pack may already hold merged buckets.
      if (!hasMessages(next)) registerMessages(next, m.default);
    }).finally(() => coreLoads.delete(next));
    coreLoads.set(next, core);
  }
  const { tool, tutorial } = copy;
  await Promise.all([
    core,
    tool && !hasPageCopy(next, { tool }) ? loadBucket(next, "tools", tool, core) : null,
    tutorial && !hasPageCopy(next, { tutorial }) ? loadBucket(next, "tutorials", tutorial, core) : null,
  ]);
}

/** Whether the strings a page needs are loaded: the locale pack, plus the game, legal, quiz, dataset or kb pack on those pages and the page's own copy. */
export function hasPageMessages(next: Locale, game: boolean, legal = false, quiz = false, dataset = false, kb: KbPage = null, ref: RefPage = null, slang: SlangPage = null, copy: PageCopy = {}): boolean {
  const article = kbArticleOf(kb);
  const entry = ref && ref !== "hub" ? ref : null;
  const term = slang && slang !== "hub" ? slang : null;
  return hasMessages(next) && hasPageCopy(next, copy) && (!game || hasGameMessages(next)) && (!legal || hasLegalMessages(next)) && (!quiz || hasQuizMessages(next)) && (!dataset || hasDatasetMessages(next))
    && (!kb || (hasKbMessages(next) && (!article || hasKbArticle(next, article))))
    && (!ref || (hasRefMessages(next) && (!entry || hasRefEntry(next, entry))))
    && (!slang || (hasSlangMessages(next) && (!term || hasSlangEntry(next, term))));
}

export async function loadPageMessages(next: Locale, game: boolean, legal = false, quiz = false, dataset = false, kb: KbPage = null, ref: RefPage = null, slang: SlangPage = null, copy: PageCopy = {}): Promise<void> {
  const article = kbArticleOf(kb);
  const entry = ref && ref !== "hub" ? ref : null;
  const term = slang && slang !== "hub" ? slang : null;
  await Promise.all([
    hasMessages(next) && hasPageCopy(next, copy) ? null : loadCore(next, copy),
    !game || hasGameMessages(next) ? null : GAME_PACKS[next]().then((m) => registerGameMessages(next, m.default)),
    !legal || hasLegalMessages(next) ? null : LEGAL_PACKS[next]().then((m) => registerLegalMessages(next, m.default)),
    !quiz || hasQuizMessages(next) ? null : QUIZ_PACKS[next]().then((m) => registerQuizMessages(next, m.default)),
    !dataset || hasDatasetMessages(next) ? null : DATASET_PACKS[next]().then((m) => registerDatasetMessages(next, m.default)),
    !kb || hasKbMessages(next) ? null : KB_PACKS[next]().then((m) => registerKbMessages(next, m.default)),
    !article || hasKbArticle(next, article) ? null : loadKbArticle(next, article),
    !ref || hasRefMessages(next) ? null : REF_PACKS[next]().then((m) => registerRefMessages(next, m.default)),
    !entry || hasRefEntry(next, entry) ? null : loadRefEntry(next, entry),
    !slang || hasSlangMessages(next) ? null : SLANG_PACKS[next]().then((m) => registerSlangMessages(next, m.default)),
    !term || hasSlangEntry(next, term) ? null : loadSlangEntry(next, term),
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
