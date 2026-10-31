import { LOCALES, type Locale } from "./locale";
import type { KbBlock, KbArticleCopy } from "./kb-i18n";
import type { KbSource } from "./kb";

/**
 * What `npm run kb:sync` writes to src/locales/kb/meta.json, per article and locale: a fingerprint of that page's
 * copy (plus the article's sources), when it last changed, and its reading time. A test recomputes the fingerprints,
 * so editing an article without running the sync fails CI. The page code reads only the dates and minutes, from the
 * generated src/locales/kb/meta.ts.
 */
export type KbSyncEntry = {
  hash: Record<Locale, string>;
  updated: Record<Locale, string>;
  minutes: Record<Locale, number>;
};

/** Prose of a block; code samples are counted apart (see readingMinutes). */
function blockText(block: KbBlock): string {
  if (typeof block === "string") return block;
  if ("ul" in block) return block.ul.join(" ");
  if ("ol" in block) return block.ol.join(" ");
  if ("table" in block) return [...block.table.head, ...block.table.rows.flat()].join(" ");
  if ("code" in block) return "";
  return block.note;
}

const words = (text: string): number => text.split(/\s+/).filter(Boolean).length;

/**
 * Reading time: ~220 words a minute, or ~400 characters for Chinese, Japanese and Korean.
 * Code samples are the same in every locale, so they count as English words (a token between spaces) everywhere.
 */
export function readingMinutes(locale: Locale, copy: KbArticleCopy): number {
  const text = [copy.answer, ...copy.sections.flatMap((s) => [s.h, ...s.body.map(blockText)]), ...copy.faq.flatMap((f) => [f.q, f.a])].join(" ");
  const code = copy.sections.flatMap((s) => s.body.map((block) => (typeof block === "object" && "code" in block ? block.code : ""))).join(" ");
  const cjk = locale === "zh-CN" || locale === "zh-TW" || locale === "ja" || locale === "ko";
  const units = (cjk ? text.replace(/\s+/g, "").length / 400 : words(text) / 220) + words(code) / 220;
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

/** Fingerprint of one locale's page: its copy, plus the sources every locale shows (a fixed source is a fact change). */
export function pageHash(copy: KbArticleCopy, sources: readonly KbSource[]): string {
  return cyrb53(JSON.stringify([copy, sources]));
}

/**
 * New sync entry for one article. A locale's date moves to `today` when its fingerprint changed,
 * or when `touch` is set (facts re-checked with no edit).
 */
export function syncEntry(
  copies: Record<Locale, KbArticleCopy>,
  sources: readonly KbSource[],
  previous: KbSyncEntry | undefined,
  today: string,
  touch = false,
): KbSyncEntry {
  const entry: KbSyncEntry = { hash: {} as Record<Locale, string>, updated: {} as Record<Locale, string>, minutes: {} as Record<Locale, number> };
  for (const locale of LOCALES) {
    const hash = pageHash(copies[locale], sources);
    const same = previous?.hash?.[locale] === hash && Boolean(previous?.updated?.[locale]);
    entry.hash[locale] = hash;
    entry.updated[locale] = same && !touch ? previous!.updated[locale] : today;
    entry.minutes[locale] = readingMinutes(locale, copies[locale]);
  }
  return entry;
}
