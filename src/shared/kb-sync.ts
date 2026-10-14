import { LOCALES, type Locale } from "./locale";
import type { KbBlock, KbArticleCopy } from "./kb-i18n";

/**
 * What `npm run kb:sync` writes to src/locales/kb/meta.json, per article: when its copy last changed,
 * a fingerprint of that copy in every locale, and the reading time per locale.
 * A test recomputes these, so editing an article without running the sync fails CI.
 */
export type KbSyncEntry = { updated: string; hash: string; minutes: Record<Locale, number> };

function blockText(block: KbBlock): string {
  if (typeof block === "string") return block;
  if ("ul" in block) return block.ul.join(" ");
  if ("ol" in block) return block.ol.join(" ");
  if ("table" in block) return [...block.table.head, ...block.table.rows.flat()].join(" ");
  return block.note;
}

/** Reading time: ~220 words a minute, or ~400 characters for Chinese, Japanese and Korean. */
export function readingMinutes(locale: Locale, copy: KbArticleCopy): number {
  const text = [copy.answer, ...copy.sections.flatMap((s) => [s.h, ...s.body.map(blockText)]), ...copy.faq.flatMap((f) => [f.q, f.a])].join(" ");
  const cjk = locale === "zh-CN" || locale === "zh-TW" || locale === "ja" || locale === "ko";
  const units = cjk ? text.replace(/\s+/g, "").length / 400 : text.split(/\s+/).filter(Boolean).length / 220;
  return Math.max(1, Math.round(units));
}

/** cyrb53: a small, stable 53-bit string hash (not for security; it only detects edits). */
function cyrb53(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Fingerprint of one article's copy across every locale. */
export function articleHash(copies: Record<Locale, KbArticleCopy>): string {
  return cyrb53(LOCALES.map((locale) => `${locale}\n${JSON.stringify(copies[locale])}`).join("\n"));
}

export function syncEntry(copies: Record<Locale, KbArticleCopy>, previous: KbSyncEntry | undefined, today: string): KbSyncEntry {
  const hash = articleHash(copies);
  const minutes = Object.fromEntries(LOCALES.map((locale) => [locale, readingMinutes(locale, copies[locale])])) as Record<Locale, number>;
  return { updated: previous && previous.hash === hash ? previous.updated : today, hash, minutes };
}
