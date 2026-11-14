/**
 * Site search: the index format, matching and the rules for what a recorded query or email may be.
 * Shared by the header search box (client), the search API (Worker), the build that writes the index,
 * and the demand / notify scripts, so all of them normalise a query the same way.
 */

/** Channels a result can belong to; the label is a core-pack `nav.*` key. */
export const SEARCH_CHANNELS = ["tool", "learn", "kb", "tests", "datasets", "rankings", "reference", "slang", "games"] as const;
export type SearchChannel = (typeof SEARCH_CHANNELS)[number];

export const SEARCH_CHANNEL_LABEL: Record<SearchChannel, string> = {
  tool: "nav.tools",
  learn: "nav.learn",
  kb: "nav.learn",
  tests: "nav.tests",
  datasets: "nav.data",
  rankings: "nav.rankings",
  reference: "nav.reference",
  slang: "nav.slang",
  games: "nav.games",
};

/** One page in a locale's index: channel, href, name, blurb, and the English name as extra keywords. */
export type SearchEntry = [channel: SearchChannel, href: string, name: string, blurb: string, alt?: string];

export const SEARCH_MAX_RESULTS = 8;
/** Longest query that is matched or recorded (in characters, after normalising). */
export const SEARCH_QUERY_MAX = 60;
export const SEARCH_EMAIL_MAX = 254;
/** Blurbs in the index are cut to this many characters; the dropdown shows two lines at most. */
export const SEARCH_BLURB_MAX = 110;

/**
 * Lowercase, NFKC (full-width letters and digits become ASCII), collapse whitespace, cut to the max.
 * Used for both matching and the stored key, so "ＰＤＦ  合并" and "pdf 合并" count as one query.
 */
export function normalizeQuery(raw: string): string {
  return raw.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim().slice(0, SEARCH_QUERY_MAX).trim();
}

/** Text compared against queries: normalised, accents removed (so "tieng viet" finds "Tiếng Việt"). */
export function foldText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Letters that are written without spaces between words: a query term is matched inside them as a substring. */
const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/u;

/**
 * Query terms. A term that mixes CJK and other letters ("合并pdf") is split into runs, so it still finds
 * "合并 PDF" and "PDF 合并".
 */
function terms(query: string): string[] {
  const out: string[] = [];
  for (const word of foldText(query).split(" ")) {
    if (!word) continue;
    const runs = word.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}ー]+|[^\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}ー]+/gu) ?? [word];
    out.push(...runs);
  }
  return out;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type Term = { text: string; start: RegExp | null };

/**
 * Latin, Cyrillic and other spaced scripts match only at a word start ("ps" does not find "CPS", "pdf" still
 * finds "合并pdf"); CJK, kana and Hangul match anywhere.
 */
function compile(text: string): Term {
  if (UNSPACED.test(text[0])) return { text, start: null };
  return { text, start: new RegExp(`(^|[^\\p{Script=Latin}\\p{Script=Cyrillic}\\p{Script=Greek}\\p{N}])${escapeRegExp(text)}`, "u") };
}

/** Where a term occurs in folded text: -1 none, 0 inside a word, 1 at a word start, 2 at the very start. */
function hit(text: string, term: Term): number {
  if (!text) return -1;
  if (text.startsWith(term.text)) return 2;
  if (!term.start) return text.includes(term.text) ? 0 : -1;
  return term.start.test(text) ? 1 : -1;
}

/** The part of a page title before " | cv.cm", " — " and the like: the page's name. */
export function nameFromTitle(title: string): string {
  const base = title.replace(/\s*[|｜]\s*cv\.cm\s*$/i, "").replace(/\s*[—–]\s*cv\.cm\s*$/i, "");
  const cut = base.split(/\s*[|｜—–]\s*|\s+-\s+|[：，]|(?<=\S):\s/)[0];
  return (cut || base).trim();
}

export function shortBlurb(text: string, max = SEARCH_BLURB_MAX): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).trimEnd() + "…";
}

type Scored = { entry: SearchEntry; score: number; order: number };

/**
 * Every term must appear in the name, the blurb or the English name. Name hits weigh most, a name that
 * starts with the query most of all; ties keep index order (tools before tutorials before the rest).
 */
export function searchEntries(entries: readonly SearchEntry[], query: string, limit = SEARCH_MAX_RESULTS): SearchEntry[] {
  const whole = foldText(normalizeQuery(query));
  const words = terms(whole).map(compile);
  if (words.length === 0) return [];
  const scored: Scored[] = [];
  entries.forEach((entry, order) => {
    const name = foldText(entry[2]);
    const alt = entry[4] ? foldText(entry[4]) : "";
    const blurb = foldText(entry[3]);
    let score = 0;
    for (const word of words) {
      const inName = hit(name, word);
      if (inName >= 0) {
        score += 8 + inName * 2;
        continue;
      }
      const inAlt = hit(alt, word);
      if (inAlt >= 0) {
        score += 5 + inAlt;
        continue;
      }
      if (hit(blurb, word) >= 0) score += 2;
      else return;
    }
    const compact = name.replace(/ /g, "");
    const wholeCompact = whole.replace(/ /g, "");
    if (name === whole || alt === whole || compact === wholeCompact) score += 30;
    else if (compact.startsWith(wholeCompact)) score += 10;
    else if (compact.includes(wholeCompact)) score += 4;
    // Hubs and short names are the better landing page for a short query.
    score -= Math.min(name.length, 60) / 60;
    scored.push({ entry, score, order });
  });
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return scored.slice(0, limit).map((s) => s.entry);
}

/**
 * Whether a no-result query may be stored. Rejects what is likely personal data or noise:
 * links, email addresses, long digit runs (phone and ID numbers), and strings with no letter or digit.
 */
export function isRecordableQuery(query: string): boolean {
  if (query.length < 1 || query.length > SEARCH_QUERY_MAX) return false;
  if (!/[\p{L}\p{N}]/u.test(query)) return false;
  if (/@|https?:|www\.|:\/\//i.test(query)) return false;
  if (/\d{11,}/.test(query.replace(/[\s-]/g, ""))) return false;
  return true;
}

/** A plain address check: one @, a dot in the domain, no spaces. The real test is the email we send. */
export function isValidEmail(email: string): boolean {
  return email.length <= SEARCH_EMAIL_MAX && /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/.test(email);
}
