import type { NostalgiaId } from "./nostalgia";
import META from "./nostalgia-meta.json";

// Pages read the meta from the nostalgia pack (`nostalgiaMeta(locale, id)` in nostalgia-i18n.ts), so the JSON never
// lands in the entry bundle; NOSTALGIA_META here is for tests and scripts only. Do not import it from client code.
export type NostalgiaSource = { name: string; url: string };

export type NostalgiaMeta = {
  /** The original name (Chinese for Chinese items, the brand name for global ones). */
  term: string;
  /** Mainly a Chinese childhood memory, an American / Western one, or remembered in many countries. */
  region: "cn" | "west" | "global";
  /** Year ("1990") or decade ("1990s") it appeared or became popular. */
  from: string;
  /** Year it ended (discontinued, abolished, shut down), or null. */
  to: string | null;
  /** Product status as of the last check; null for games, activities and places. */
  status: "available" | "revived" | "discontinued" | null;
  related: NostalgiaId[];
  /** Primary or well-known references; every URL was opened and checked. */
  sources: NostalgiaSource[];
};

/** Meta per entry, merged from the authoring sidecars (tests/nostalgia.test.ts checks the shape). */
export const NOSTALGIA_META = META as unknown as Record<NostalgiaId, NostalgiaMeta>;
