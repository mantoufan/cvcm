/**
 * Site search: the index format, matching and the rules for what a recorded query or email may be.
 * Shared by the header search box (client), the search API (Worker), the build that writes the index,
 * and the demand / notify scripts, so all of them normalise a query the same way.
 */

/** Channels a result can belong to; the label is the core-pack key `nav.<SEARCH_CHANNEL_NAV[channel]>`. */
export const SEARCH_CHANNELS = ["tool", "learn", "kb", "tests", "datasets", "rankings", "reference", "slang", "ideas", "nostalgia", "games"] as const;
export type SearchChannel = (typeof SEARCH_CHANNELS)[number];

export const SEARCH_CHANNEL_NAV = {
  tool: "tools",
  learn: "learn",
  kb: "learn",
  tests: "tests",
  datasets: "data",
  rankings: "rankings",
  reference: "reference",
  slang: "slang",
  ideas: "ideas",
  nostalgia: "nostalgia",
  games: "games",
} as const satisfies Record<SearchChannel, string>;

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
  // Cut by code points, so an emoji at the limit is not split into a lone surrogate.
  return [...raw.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim()].slice(0, SEARCH_QUERY_MAX).join("").trim();
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
const UNSPACED = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}ー]/u;

/** Hyphens, slashes and other punctuation separate words ("pdf-to-jpg", "bmi?"); + and # stay (C++, C#). */
function spaced(query: string): string {
  // "1920x1080" / "1920×1080" are two sizes: the pages write them apart ("1920 by 1080").
  return foldText(query).replace(/(\d)\s*[x×]\s*(?=\d)/gu, "$1 ").replace(/[^\p{L}\p{N}\p{M}+#ー]+/gu, " ").trim();
}

/**
 * Query terms. A term that mixes CJK and other letters ("合并pdf") is split into runs, so it still finds
 * "合并 PDF" and "PDF 合并".
 */
function terms(query: string): string[] {
  const out: string[] = [];
  for (const word of spaced(query).split(" ")) {
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
  if (UNSPACED.test(text)) return { text, start: null };
  return { text, start: new RegExp(`(^|[^\\p{Script=Latin}\\p{Script=Cyrillic}\\p{Script=Greek}\\p{N}])${escapeRegExp(text)}`, "u") };
}

/** Where a term occurs in folded text: -1 none, 0 inside a word, 1 at a word start, 2 at the very start. */
function hit(text: string, term: Term): number {
  if (!text) return -1;
  if (text.startsWith(term.text)) return 2;
  if (!term.start) return text.includes(term.text) ? 0 : -1;
  return term.start.test(text) ? 1 : -1;
}

/**
 * A CJK run written in another word order ("图片压缩" for 压缩图片): true when it splits into two parts of 2+
 * characters that both occur in the text. Scored below a real hit.
 */
function splitHit(text: string, term: Term): boolean {
  if (term.start) return false;
  const chars = [...term.text];
  for (let i = 2; i <= chars.length - 2; i++) {
    if (text.includes(chars.slice(0, i).join("")) && text.includes(chars.slice(i).join(""))) return true;
  }
  return false;
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

/** Folded name, English name and blurb of every entry, computed once per index array. */
const folded = new WeakMap<readonly SearchEntry[], Array<[name: string, alt: string, blurb: string, compact: string]>>();

/** A name with spaces and punctuation removed, for the whole-query bonus ("Rock-Paper-Scissors" = "rock paper scissors"). */
function compactOf(text: string): string {
  return text.replace(/[^\p{L}\p{N}\p{M}+#ー]+/gu, "");
}

function foldedOf(entries: readonly SearchEntry[]): Array<[string, string, string, string]> {
  let table = folded.get(entries);
  if (!table) {
    table = entries.map((e) => {
      const name = foldText(e[2]);
      return [name, e[4] ? foldText(e[4]) : "", foldText(e[3]), compactOf(name)];
    });
    folded.set(entries, table);
  }
  return table;
}

type Scored = { entry: SearchEntry; score: number; order: number };

/**
 * Every term must appear in the name, the blurb or the English name. Name hits weigh most, a name that
 * starts with the query most of all; ties keep index order (tools before tutorials before the rest).
 */
export function searchEntries(entries: readonly SearchEntry[], query: string, limit = SEARCH_MAX_RESULTS): SearchEntry[] {
  const whole = spaced(normalizeQuery(query));
  const words = terms(whole).map(compile);
  if (words.length === 0) return [];
  const scored: Scored[] = [];
  const table = foldedOf(entries);
  const wholeCompact = compactOf(whole);
  entries.forEach((entry, order) => {
    const [name, alt, blurb, compact] = table[order];
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
      else if (splitHit(`${name} ${alt}`, word)) score += 4;
      else if (splitHit(blurb, word)) score += 1;
      else return;
    }
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
  const points = [...query].length;
  if (points < 1 || points > SEARCH_QUERY_MAX) return false;
  if (!/[\p{L}\p{N}]/u.test(query)) return false;
  if (/@|https?:|www\.|:\/\//i.test(query)) return false;
  // IP addresses (someone looking up their own): never stored. Four-part versions (3.12.0.1) look the same and go
  // too. IPv6 needs whole hex groups, so C++/Rust paths (std::vector, Vec::new) stay.
  if (/\b\d{1,3}(?:\.\d{1,3}){3}\b/.test(query)) return false;
  if (/(^|[^0-9a-z:])(?:[0-9a-f]{1,4}:){4,7}[0-9a-f]{1,4}(?![0-9a-z:])|(^|[^0-9a-z:])(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4})*)?::[0-9a-f]{1,4}(?::[0-9a-f]{1,4})*(?![0-9a-z:])/i.test(query) && /\d/.test(query)) return false;
  // Bare links: a host followed by a path (example.com/reset?token=…), or a link shortener on its own (bit.ly, t.me).
  // Plain names with a dot (draw.io, asp.net, node.js) stay: they are real topics.
  if (/[a-z0-9-]+\.[a-z]{2,}\/\S/i.test(query)) return false;
  if (/(^|[^a-z0-9.-])(bit\.ly|t\.me|t\.co|wa\.me|goo\.gl|tinyurl\.com|b23\.tv|dwz\.cn|url\.cn)\b/i.test(query)) return false;
  // Phone, ID and card numbers: an unbroken run of 7+ digits, or 10+ once spaces, dashes, dots and brackets are gone
  // (555 123 4567, (415) 555-0199, 4111 1111 1111 1111). One size or date (1920 1080, 2026-11-15) and sizes written
  // with x (1920x1080 to 3840x2160) stay; a string of several spaced numbers is dropped, like a card number would be. Known number slang (520, 334424044) has a page, so it never
  // reaches this check as a miss.
  if (/\d{7,}/.test(query) || /\d{10,}/.test(query.replace(/[\s\-().+]/g, ""))) return false;
  return true;
}

/** A plain address check: one @, a dot in the domain, no spaces. The real test is the email we send. */
export function isValidEmail(email: string): boolean {
  return email.length <= SEARCH_EMAIL_MAX && /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/.test(email);
}
