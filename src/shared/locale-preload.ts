import type { Locale } from "./locale";

// Locale -> hashed string-pack chunk files, injected by scripts/build-worker.mjs (absent in tests).
declare const __LOCALE_PACKS__: Record<string, string[]> | undefined;

const LOCALE_PACKS: Record<string, string[]> = typeof __LOCALE_PACKS__ === "undefined" ? {} : __LOCALE_PACKS__;

/** Fetch the page locale's strings in parallel with the entry script instead of after it runs. */
export function preloadLocalePack(html: string, locale: Locale, packs: Record<string, string[]> = LOCALE_PACKS): string {
  const files = packs[locale];
  if (!files?.length) return html;
  const links = files.map((href) => `<link rel="modulepreload" crossorigin href="${href}">`).join("\n  ");
  return html.replace("</head>", `${links}\n  </head>`);
}
