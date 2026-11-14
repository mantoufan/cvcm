import type { Locale } from "./locale";
import { isKbHub } from "./kb";

// Locale -> hashed string-pack chunk files, injected by scripts/build-worker.mjs (absent in tests).
declare const __LOCALE_PACKS__: Record<string, string[]> | undefined;

const LOCALE_PACKS: Record<string, string[]> = typeof __LOCALE_PACKS__ === "undefined" ? {} : __LOCALE_PACKS__;

/**
 * Fetch the page's strings (plus the game, quiz, dataset, kb or ref pack on those pages; `kb` is "hub", "code", "ai" or the
 * article id, `ref` and `slang` "hub" or the entry id; `copy` the key of the page's copy bucket) in parallel with the
 * entry script instead of after it runs.
 */
export function preloadLocalePack(html: string, locale: Locale, game = false, packs: Record<string, string[]> = LOCALE_PACKS, quiz = false, dataset = false, kb: string | null = null, ref: string | null = null, slang: string | null = null, copy: string | null = null): string {
  const files = [...new Set([
    ...(packs[locale] ?? []),
    // The page's own copy bucket (`copyChunkKey`: a tool's FAQ and how-to, or a tutorial's text) and the locale's loader table.
    ...(copy ? [...(packs[`copy-${locale}`] ?? []), ...(packs[copy] ?? [])] : []),
    ...(game ? packs[`games-${locale}`] ?? [] : []),
    ...(quiz ? packs[`quiz-${locale}`] ?? [] : []),
    ...(dataset ? packs[`datasets-${locale}`] ?? [] : []),
    ...(kb ? packs[`kb-${locale}`] ?? [] : []),
    ...(kb && !isKbHub(kb) ? [...(packs[`kb-${locale}/loaders`] ?? []), ...(packs[`kb-${locale}/${kb}`] ?? [])] : []),
    ...(ref ? packs[`ref-${locale}`] ?? [] : []),
    ...(ref && ref !== "hub" ? [...(packs[`ref-${locale}/loaders`] ?? []), ...(packs[`ref-${locale}/${ref}`] ?? [])] : []),
    ...(slang ? packs[`slang-${locale}`] ?? [] : []),
    ...(slang && slang !== "hub" ? [...(packs[`slang-${locale}/loaders`] ?? []), ...(packs[`slang-${locale}/${slang}`] ?? [])] : []),
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
