import type { Locale } from "./locale";
import { fill } from "./fill";
import { PUBLISHER, type KbBlock } from "./kb-i18n";
import { scriptEntryMessages, scriptsMessages, type ScriptsMessages } from "./messages";
import { appHref, scriptsHref } from "./path";
import { SCRIPT_ENTRIES, scriptGroupOf, scriptPlayCount, scriptPublished, scriptUpdated, type ScriptId } from "./scripts";
import { HREFLANG } from "./sitemap";
import type { ScriptMeta } from "./scripts-meta";

/** One line of a script: a scene heading, an action, a spoken line, an on-screen caption, or a sound cue. */
export type ScriptLine =
  | { scene: string }
  | { action: string }
  | { who: string; say: string; how?: string }
  | { text: string }
  | { sfx: string };

type EntryHead = {
  name: string;
  blurb: string;
  /** Without the " — cv.cm" suffix (scriptsTitle adds it). */
  title: string;
  description: string;
  h1: string;
  sections: { h: string; body: KbBlock[] }[];
  faq: { q: string; a: string }[];
};

/** A script to film or perform, `src/locales/scripts/<locale>/<id>.json` (groups shorts, drama, skits, duets). */
export type ScriptPlayCopy = EntryHead & {
  logline: string;
  setting: string;
  roles: { name: string; note: string }[];
  script: ScriptLine[];
  /** Shot list or staging, performance tips, three variations. */
  prompts: { keyframe: string; shots: string[] };
};

/** A list of video ideas for one niche (group ideas). */
export type IdeasListCopy = EntryHead & {
  answer: string;
  groups: { h: string; items: { t: string; d: string; script?: string }[] }[];
};

/** The plot / video idea generator: a sentence template and the pools it draws from. */
export type GeneratorPools = { hero: string[]; want: string[]; obstacle: string[]; twist: string[]; setting: string[]; format: string[] };
export type GeneratorCopy = EntryHead & { answer: string; template: string; pools: GeneratorPools };

export type ScriptEntryCopy = ScriptPlayCopy | IdeasListCopy | GeneratorCopy;

export function isPlay(copy: ScriptEntryCopy): copy is ScriptPlayCopy {
  return "script" in copy;
}

export function isIdeasList(copy: ScriptEntryCopy): copy is IdeasListCopy {
  return "groups" in copy;
}

export function isGenerator(copy: ScriptEntryCopy): copy is GeneratorCopy {
  return "pools" in copy;
}

const ORIGIN = "https://cv.cm";
export const SCRIPTS_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";

export type ScriptsUi = ScriptsMessages["ui"];

export function scriptsUi(locale: Locale): ScriptsUi {
  return scriptsMessages(locale).ui;
}

export function scriptsHub(locale: Locale): ScriptsMessages["hub"] {
  return scriptsMessages(locale).hub;
}

export function scriptCopy(locale: Locale, id: ScriptId): ScriptEntryCopy {
  return scriptEntryMessages(locale, id);
}

/** Name and one-line blurb from the scripts pack (`npm run scripts:sync`), so lists never load entry chunks. */
export function scriptName(locale: Locale, id: ScriptId): { name: string; blurb: string } {
  return scriptsMessages(locale).list[id];
}

/** Cast, runtime, genres, format, uses and related ids, from the scripts pack. */
export function scriptMeta(locale: Locale, id: ScriptId): ScriptMeta {
  return scriptsMessages(locale).meta[id];
}

export function scriptsTitle(locale: Locale, id: ScriptId | null): string {
  return `${id ? scriptCopy(locale, id).title : scriptsHub(locale).title} — cv.cm`;
}

export function scriptsDescription(locale: Locale, id: ScriptId | null): string {
  return id ? scriptCopy(locale, id).description : fill(scriptsHub(locale).description, { n: scriptPlayCount() });
}

export function scriptsFaqItems(locale: Locale, id: ScriptId | null): { q: string; a: string }[] {
  return id ? scriptCopy(locale, id).faq : scriptsHub(locale).faq;
}

/** ISO 8601 duration for a runtime in seconds: PT45S, PT3M, PT2M30S. */
export function isoDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `PT${m ? `${m}M` : ""}${s || !m ? `${s}S` : ""}`;
}

export function scriptsBreadcrumbJsonLd(locale: Locale, id: ScriptId | null): Record<string, unknown> {
  const m = scriptsMessages(locale);
  const items = [
    { name: m.crumbHome, item: `${ORIGIN}${appHref(locale, null)}` },
    { name: m.hub.h1, item: `${ORIGIN}${scriptsHref(locale)}` },
  ];
  if (id) items.push({ name: scriptName(locale, id).name, item: `${ORIGIN}${scriptsHref(locale, id)}` });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, ...item })),
  };
}

export function scriptsFaqJsonLd(locale: Locale, id: ScriptId | null): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: scriptsFaqItems(locale, id).map((item) => ({
      "@type": "Question",
      name: item.q.replaceAll("`", ""),
      acceptedAnswer: { "@type": "Answer", text: item.a.replaceAll("`", "") },
    })),
  };
}

/**
 * Hub: CollectionPage with an ItemList of every entry. A script: Article about the script as a CreativeWork (genre,
 * runtime, CC BY 4.0 licence). An idea list: Article whose main entity is the ItemList of ideas. The generator: WebApplication.
 */
export function scriptsArticleJsonLd(locale: Locale, id: ScriptId | null): Record<string, unknown> {
  if (!id) {
    const hub = scriptsHub(locale);
    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: hub.h1,
      description: scriptsDescription(locale, null),
      url: `${ORIGIN}${scriptsHref(locale)}`,
      inLanguage: HREFLANG[locale],
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: SCRIPT_ENTRIES.length,
        itemListElement: SCRIPT_ENTRIES.map((entry, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: scriptName(locale, entry).name,
          url: `${ORIGIN}${scriptsHref(locale, entry)}`,
        })),
      },
    };
  }
  const copy = scriptCopy(locale, id);
  const url = `${ORIGIN}${scriptsHref(locale, id)}`;
  const ui = scriptsUi(locale);
  if (isGenerator(copy)) {
    return {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: copy.name,
      description: copy.description,
      url,
      inLanguage: HREFLANG[locale],
      applicationCategory: "EntertainmentApplication",
      operatingSystem: "Any",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: PUBLISHER,
    };
  }
  const base = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: copy.h1,
    description: copy.description,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: HREFLANG[locale],
    datePublished: scriptPublished(id),
    dateModified: scriptUpdated(id),
    author: PUBLISHER,
    publisher: PUBLISHER,
    isAccessibleForFree: true,
    articleSection: (scriptsHub(locale).groups as Record<string, string>)[scriptGroupOf(id)],
  };
  if (isIdeasList(copy)) {
    const items = copy.groups.flatMap((g) => g.items);
    return {
      ...base,
      abstract: copy.answer.replaceAll("`", ""),
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: items.length,
        itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.t })),
      },
    };
  }
  if (!isPlay(copy)) return base;
  const play = copy;
  const meta = scriptMeta(locale, id);
  const genres = ui.genres as Record<string, string>;
  return {
    ...base,
    abstract: play.logline.replaceAll("`", ""),
    license: SCRIPTS_LICENSE_URL,
    about: {
      "@type": "CreativeWork",
      name: play.name,
      genre: meta.genres.map((g) => genres[g] ?? g),
      timeRequired: isoDuration(meta.seconds),
      inLanguage: HREFLANG[locale],
      license: SCRIPTS_LICENSE_URL,
      creator: PUBLISHER,
      character: play.roles.map((r) => ({ "@type": "Person", name: r.name })),
    },
  };
}
