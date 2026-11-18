import type { SummaryId } from "./summaries";
import META from "./summaries-meta.json";

// Pages read the meta from the summaries pack (`summaryMeta(locale, id)` in summaries-i18n.ts), so the JSON never
// lands in the entry bundle; SUMMARIES_META here is for tests and scripts only. Do not import it from client code.
export type SummarySource = { name: string; url: string };

/** What a work is: decides the kicker label and the schema.org type it is described as (Book, Movie or TVSeries). */
export const SUMMARY_KINDS = ["play", "novel", "novella", "short-story", "poem", "book", "film", "series", "anime-series", "anime-film"] as const;
export type SummaryKind = (typeof SUMMARY_KINDS)[number];

export type SummaryMeta = {
  kind: SummaryKind;
  /** The title in the original language and script ("千と千尋の神隠し", "Truyện Kiều", "Die Verwandlung"). */
  original: string;
  /** Author, director or creator(s), in English (the JSON-LD Person names). */
  creator: string;
  /** The same credit as each locale's readers know it (莎士比亚, シェイクスピア, 셰익스피어…); en uses `creator`. */
  creators: Record<string, string>;
  /** First publication, release or air year ("1603"). */
  year: string;
  /** Final year of a series; null for anything else or a series still running. */
  end: string | null;
  /** Original language code (en, de, ja, vi…). */
  language: string;
  /** Three other works, closest first. */
  related: SummaryId[];
  /** References the summary was checked against; every URL was opened. */
  sources: SummarySource[];
};

/** Meta per work, merged from the authoring sidecars (tests/summaries.test.ts checks the shape). */
export const SUMMARIES_META = META as unknown as Record<SummaryId, SummaryMeta>;
