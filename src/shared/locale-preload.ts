import type { Locale } from "./locale";
import { isKbHub } from "./kb";
import type { QuizPage } from "./quiz";

// Locale -> hashed string-pack chunk files, injected by scripts/build-worker.mjs (absent in tests).
declare const __LOCALE_PACKS__: Record<string, string[]> | undefined;

const LOCALE_PACKS: Record<string, string[]> = typeof __LOCALE_PACKS__ === "undefined" ? {} : __LOCALE_PACKS__;

/**
 * Fetch the page's strings (plus the game, quiz, dataset, kb or ref pack on those pages; `quiz` is "hub" or the test id,
 * `kb` "hub", "code", "ai", "photo", "love" or the article id, `ref`, `slang`, `idea`, `nostalgia`, `summaries` and `scripts` "hub" or the entry id; `copy` the key of the page's copy bucket) in
 * parallel with the entry script instead of after it runs.
 */
export function preloadLocalePack(html: string, locale: Locale, game = false, packs: Record<string, string[]> = LOCALE_PACKS, quiz: QuizPage | false = false, dataset = false, kb: string | null = null, ref: string | null = null, slang: string | null = null, copy: string | null = null, idea: string | null = null, nostalgia: string | null = null, countries: string | null = null, calories = false, elements = false, calendar = false, summaries: string | null = null, scripts: string | null = null, emoji = false, currency = false): string {
  const files = [...new Set([
    ...(packs[locale] ?? []),
    // The page's own copy bucket (`copyChunkKey`: a tool's FAQ and how-to, or a tutorial's text) and the locale's loader table.
    ...(copy ? [...(packs[`copy-${locale}`] ?? []), ...(packs[copy] ?? [])] : []),
    ...(game ? packs[`games-${locale}`] ?? [] : []),
    ...(quiz ? packs[`quiz-${locale}`] ?? [] : []),
    ...(quiz && quiz !== "hub" ? [...(packs[`quiz-${locale}/loaders`] ?? []), ...(packs[`quiz-${locale}/${quiz}`] ?? [])] : []),
    ...(dataset ? packs[`datasets-${locale}`] ?? [] : []),
    ...(kb ? packs[`kb-${locale}`] ?? [] : []),
    ...(kb && !isKbHub(kb) ? [...(packs[`kb-${locale}/loaders`] ?? []), ...(packs[`kb-${locale}/${kb}`] ?? [])] : []),
    ...(ref ? packs[`ref-${locale}`] ?? [] : []),
    ...(ref && ref !== "hub" ? [...(packs[`ref-${locale}/loaders`] ?? []), ...(packs[`ref-${locale}/${ref}`] ?? [])] : []),
    ...(slang ? packs[`slang-${locale}`] ?? [] : []),
    ...(slang && slang !== "hub" ? [...(packs[`slang-${locale}/loaders`] ?? []), ...(packs[`slang-${locale}/${slang}`] ?? [])] : []),
    ...(idea ? packs[`ideas-${locale}`] ?? [] : []),
    ...(idea && idea !== "hub" ? [...(packs[`ideas-${locale}/loaders`] ?? []), ...(packs[`ideas-${locale}/${idea}`] ?? [])] : []),
    ...(nostalgia ? packs[`nostalgia-${locale}`] ?? [] : []),
    ...(nostalgia && nostalgia !== "hub" ? [...(packs[`nostalgia-${locale}/loaders`] ?? []), ...(packs[`nostalgia-${locale}/${nostalgia}`] ?? [])] : []),
    ...(summaries ? packs[`summaries-${locale}`] ?? [] : []),
    ...(scripts ? packs[`scripts-${locale}`] ?? [] : []),
    ...(summaries && summaries !== "hub" ? [...(packs[`summaries-${locale}/loaders`] ?? []), ...(packs[`summaries-${locale}/${summaries}`] ?? [])] : []),
    ...(scripts && scripts !== "hub" ? [...(packs[`scripts-${locale}/loaders`] ?? []), ...(packs[`scripts-${locale}/${scripts}`] ?? [])] : []),
    // Country profiles: the countries pack, and on a profile ("hub" or the data bucket number) its bucket of figures.
    ...(countries ? packs[`countries-${locale}`] ?? [] : []),
    ...(countries && countries !== "hub" ? packs[`countries-data/${countries}`] ?? [] : []),
    // One calories pack per locale (copy, names and the USDA snapshot) serves the hub and every food.
    ...(calories ? packs[`calories-${locale}`] ?? [] : []),
    // The periodic table pack (one for the hub and every element page) and the PubChem rows chunk it imports.
    ...(elements ? packs[`elements-${locale}`] ?? [] : []),
    ...(calendar ? packs[`calendar-${locale}`] ?? [] : []),
    // One emoji pack per locale (copy, CLDR names, usage sentences and the emoji-test rows) serves the hub and every emoji.
    ...(emoji ? packs[`emoji-${locale}`] ?? [] : []),
    // One currency pack per locale (copy and the ECB snapshot chunk it imports) serves the hub and every pair.
    ...(currency ? packs[`currency-${locale}`] ?? [] : []),
  ])];
  if (!files.length) return html;
  const links = files.map((href) => `<link rel="modulepreload" crossorigin href="${href}">`).join("\n  ");
  return html.replace("</head>", `${links}\n  </head>`);
}

// Page key (tool id, or home / learn / games / device / markets / quiz) -> the lazy chunk that page mounts, from the same manifest.
declare const __PAGE_CHUNKS__: Record<string, string[]> | undefined;

const PAGE_CHUNKS: Record<string, string[]> = typeof __PAGE_CHUNKS__ === "undefined" ? {} : __PAGE_CHUNKS__;

/** Fetch the page's own chunk (its tool, or the hub module) alongside the entry script. */
export function preloadPageChunk(html: string, key: string | null, chunks: Record<string, string[]> = PAGE_CHUNKS): string {
  const files = key ? chunks[key] ?? [] : [];
  if (!files.length) return html;
  const links = files.map((href) => `<link rel="modulepreload" crossorigin href="${href}">`).join("\n  ");
  return html.replace("</head>", `${links}\n  </head>`);
}
