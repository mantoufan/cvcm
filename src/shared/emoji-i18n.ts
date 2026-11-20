/**
 * Emoji meanings channel: the emoji pack registry, names, titles, descriptions, FAQ and JSON-LD (main bundle, for the
 * page head). Page HTML is in `emoji-page.ts`, kept out of the main bundle (AGENTS.md, seo.ts / seo-html.ts).
 */
import type { Locale } from "./locale";
import { fill } from "./fill";
import { emojiMessages, type EmojiMessages } from "./messages";
import { appHref, emojiHref } from "./path";
import { dataCrumbItem } from "./channel-parent";
import { HREFLANG } from "./sitemap";
import { EMOJI_PUBLISHED, EMOJI_SLUGS, emojiUpdated, type EmojiSlug } from "./emoji";

/** One covered emoji as emoji-test.txt lists it (`src/shared/emoji-data.json`, from scripts/fetch-emoji.mjs). */
export type EmojiRow = {
  slug: string;
  /** The fully-qualified emoji (with VS16 where the RGI form has one). */
  emoji: string;
  /** Code points in hex, upper case, without "U+". */
  cp: string[];
  /** Emoji version, e.g. "1.0" (E0.6 / E0.7 are the emoji of Unicode 6.0 / 7.0). */
  v: string;
  /** Release year of that emoji version. */
  year: number;
  group: string;
  subgroup: string;
  /** Fully-qualified skin-tone and gender forms, in CLDR order. */
  variants: string[];
};

export { emojiMessages, type EmojiMessages };

const ORIGIN = "https://cv.cm";

export const EMOJI_SOURCES = {
  cldr: "https://cldr.unicode.org/",
  test: "https://unicode.org/Public/17.0.0/emoji/emoji-test.txt",
  license: "https://www.unicode.org/license.txt",
  cldrVersion: "49",
  testVersion: "17.0",
};

/** Locales whose names are written in lower case mid-sentence (CLDR gives them so) and capitalised at a start. */
const CASED = new Set<Locale>(["en", "es", "id", "vi"]);

const INDEX = new Map<string, number>(EMOJI_SLUGS.map((slug, i) => [slug, i]));

export function emojiIndex(slug: EmojiSlug): number {
  return INDEX.get(slug)!;
}

export function emojiRow(locale: Locale, slug: EmojiSlug): EmojiRow {
  return emojiMessages(locale).data[emojiIndex(slug)];
}

/** The CLDR short name in the locale, as CLDR writes it ("loudly crying face", "大泣き"). */
export function emojiName(locale: Locale, slug: EmojiSlug): string {
  return emojiMessages(locale).names[slug];
}

function capitalise(locale: Locale, text: string): string {
  if (!CASED.has(locale) || !text) return text;
  return text[0].toLocaleUpperCase(HREFLANG[locale]) + text.slice(1);
}

/** The name at the start of a heading or a list item: "Loudly crying face". */
export function emojiLabel(locale: Locale, slug: EmojiSlug): string {
  return capitalise(locale, emojiName(locale, slug));
}

/** The emoji and its name, as links and the breadcrumb show it: "😭 Loudly crying face". */
export function emojiWithName(locale: Locale, slug: EmojiSlug): string {
  return `${emojiRow(locale, slug).emoji} ${emojiLabel(locale, slug)}`;
}

const SMALL_WORDS = new Set(["a", "an", "and", "at", "but", "for", "from", "in", "of", "on", "or", "the", "to", "with"]);

/** English title case for page titles: "face with tears of joy" → "Face with Tears of Joy". */
export function titleCase(text: string): string {
  return text.split(" ").map((word, i) => (i > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1))).join(" ");
}

/** "U+1F62D", or for a sequence "U+2764 U+FE0F". */
export function codepointText(row: EmojiRow): string {
  return row.cp.map((c) => `U+${c}`).join(" ");
}

/** The HTML numeric references that write the emoji: "&#x1F62D;". */
export function htmlCode(row: EmojiRow): string {
  return row.cp.map((c) => `&#x${c};`).join("");
}

export function groupLabel(locale: Locale, group: string): string {
  return (emojiMessages(locale).groups as Record<string, string>)[group];
}

export function subgroupLabel(locale: Locale, subgroup: string): string {
  return (emojiMessages(locale).subgroups as Record<string, string>)[subgroup];
}

/** Template values per pack and slug (titles, descriptions, FAQ and the page all fill from the same values). */
const VARS = new WeakMap<EmojiMessages, Map<EmojiSlug, Record<string, string | number>>>();

export function emojiVars(locale: Locale, slug: EmojiSlug): Record<string, string | number> {
  const pack = emojiMessages(locale);
  let bySlug = VARS.get(pack);
  if (!bySlug) VARS.set(pack, bySlug = new Map());
  let vars = bySlug.get(slug);
  if (!vars) {
    const row = emojiRow(locale, slug);
    const name = emojiName(locale, slug);
    const keywords = pack.keywords[slug] ?? [];
    bySlug.set(slug, vars = {
      emoji: row.emoji,
      name,
      Name: capitalise(locale, name),
      title: locale === "en" ? titleCase(name) : name,
      usage: pack.usage[slug],
      cp: codepointText(row),
      v: row.v,
      year: row.year,
      n: row.variants.length,
      keyword: keywords[0] ?? name,
      group: groupLabel(locale, row.group),
      subgroup: subgroupLabel(locale, row.subgroup),
    });
  }
  return vars;
}

export function emojiTitle(locale: Locale, slug: EmojiSlug | null): string {
  const m = emojiMessages(locale);
  return `${slug ? fill(m.page.title, emojiVars(locale, slug)) : fill(m.hub.title, { n: EMOJI_SLUGS.length })} — cv.cm`;
}

export function emojiDescription(locale: Locale, slug: EmojiSlug | null): string {
  const m = emojiMessages(locale);
  if (!slug) return fill(m.hub.description, { n: EMOJI_SLUGS.length });
  return fill(m.page.description, emojiVars(locale, slug));
}

/** Three questions answered from the data and the usage sentence: meaning, year added, how to copy. */
export function emojiFaqItems(locale: Locale, slug: EmojiSlug | null): { q: string; a: string }[] {
  const m = emojiMessages(locale);
  if (!slug) return m.hub.faq.map((item) => ({ q: item.q, a: fill(item.a, { n: EMOJI_SLUGS.length }) }));
  const row = emojiRow(locale, slug);
  const vars = emojiVars(locale, slug);
  const year = row.cp.length > 1 ? m.page.faqYearSequence : m.page.faqYear;
  const copy = row.variants.length ? m.page.faqCopyVariants : m.page.faqCopy;
  return [m.page.faqMeaning, year, copy].map((item) => ({ q: fill(item.q, vars), a: fill(item.a, vars) }));
}

export function emojiBreadcrumbJsonLd(locale: Locale, slug: EmojiSlug | null): Record<string, unknown> {
  const m = emojiMessages(locale);
  const items = [
    { name: m.crumbHome, item: `${ORIGIN}${appHref(locale, null)}` },
    dataCrumbItem(locale),
    { name: m.hub.h1, item: `${ORIGIN}${emojiHref(locale)}` },
  ];
  if (slug) items.push({ name: emojiWithName(locale, slug), item: `${ORIGIN}${emojiHref(locale, slug)}` });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, ...item })),
  };
}

export function emojiFaqJsonLd(locale: Locale, slug: EmojiSlug | null): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: emojiFaqItems(locale, slug).map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

const CITATIONS = [
  { "@type": "CreativeWork", name: "Unicode CLDR emoji annotations", url: EMOJI_SOURCES.cldr, license: EMOJI_SOURCES.license, publisher: { "@type": "Organization", name: "Unicode, Inc." } },
  { "@type": "CreativeWork", name: "Unicode emoji-test.txt", url: EMOJI_SOURCES.test, license: EMOJI_SOURCES.license, publisher: { "@type": "Organization", name: "Unicode, Inc." } },
];

function termSet(locale: Locale): Record<string, unknown> {
  const m = emojiMessages(locale);
  return { "@type": "DefinedTermSet", name: m.hub.h1, url: `${ORIGIN}${emojiHref(locale)}` };
}

/**
 * The hub: a CollectionPage whose main entity is the DefinedTermSet of every covered emoji. An emoji page: a
 * DefinedTerm (CLDR name, the emoji and the English name as alternates, the code points as termCode) in that set.
 */
export function emojiPageJsonLd(locale: Locale, slug: EmojiSlug | null): Record<string, unknown> {
  const m = emojiMessages(locale);
  if (!slug) {
    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: m.hub.h1,
      description: emojiDescription(locale, null),
      url: `${ORIGIN}${emojiHref(locale)}`,
      inLanguage: HREFLANG[locale],
      datePublished: EMOJI_PUBLISHED,
      dateModified: emojiUpdated(),
      citation: CITATIONS,
      mainEntity: {
        ...termSet(locale),
        hasDefinedTerm: EMOJI_SLUGS.map((s) => ({
          "@type": "DefinedTerm",
          name: emojiWithName(locale, s),
          termCode: codepointText(emojiRow(locale, s)),
          url: `${ORIGIN}${emojiHref(locale, s)}`,
        })),
      },
    };
  }
  const row = emojiRow(locale, slug);
  const name = emojiLabel(locale, slug);
  const english = m.english[slug];
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name,
    alternateName: [...new Set([row.emoji, english])].filter((n) => n !== name),
    termCode: codepointText(row),
    description: m.usage[slug],
    url: `${ORIGIN}${emojiHref(locale, slug)}`,
    inLanguage: HREFLANG[locale],
    inDefinedTermSet: termSet(locale),
  };
}
