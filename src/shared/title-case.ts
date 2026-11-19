/**
 * Title case for academic and press styles (APA 7, MLA 9, Chicago 17, AP) and sentence case (APA reference titles).
 * Each line is one title. Acronyms and mixed-case words (DNA, COVID-19, iPhone, McDonald) are kept as written,
 * unless the whole title is in capitals. Proper nouns cannot be detected, so sentence case lowercases them.
 */

export const TITLE_STYLES = ["apa", "mla", "chicago", "ap", "sentence"] as const;
export type TitleStyle = (typeof TITLE_STYLES)[number];

const ARTICLES = ["a", "an", "the"];
const COORDINATING = ["and", "but", "for", "nor", "or", "so", "yet"];
const PREPOSITIONS = [
  "about", "above", "across", "after", "against", "along", "alongside", "amid", "among", "amongst", "around", "as", "at", "atop",
  "before", "behind", "below", "beneath", "beside", "besides", "between", "beyond", "by", "concerning", "despite", "down", "during",
  "except", "for", "from", "in", "inside", "into", "like", "minus", "near", "of", "off", "on", "onto", "opposite", "out", "outside",
  "over", "past", "per", "plus", "regarding", "since", "than", "through", "throughout", "till", "to", "toward", "towards", "under",
  "underneath", "unlike", "until", "unto", "up", "upon", "versus", "vs", "v", "via", "with", "within", "without",
];

/** APA 7 (6.17) and AP: articles, and conjunctions and prepositions of three letters or fewer. */
const SHORT_MINOR = new Set([...ARTICLES, ...COORDINATING, "as", "if", ...PREPOSITIONS.filter((w) => w.length <= 3)]);

/** Words each style writes in lowercase (unless first, last where the style says so, or after a colon). */
const MINOR: Record<Exclude<TitleStyle, "sentence">, Set<string>> = {
  apa: SHORT_MINOR,
  ap: SHORT_MINOR,
  // MLA 9 (1.2): articles, all prepositions, coordinating conjunctions and the "to" of infinitives.
  mla: new Set([...ARTICLES, ...COORDINATING, ...PREPOSITIONS]),
  // Chicago 17 (8.159): articles, all prepositions, and/but/for/or/nor, to and as; yet, so and if are capitalized.
  chicago: new Set([...ARTICLES, "and", "but", "for", "or", "nor", ...PREPOSITIONS]),
};

/** Styles that always capitalize the last word of a title or subtitle. */
const CAP_LAST = new Set<TitleStyle>(["mla", "chicago", "ap"]);

/**
 * Chicago lowercases the part after these bound prefixes in a hyphenated compound (Anti-inflammatory, Non-native).
 * Not over- or under-, which are also words: Over-the-Counter.
 */
const PREFIXES = new Set(["anti", "co", "counter", "de", "extra", "inter", "intra", "mid", "multi", "non", "post", "pre", "pro", "re", "semi", "sub", "super", "trans", "un"]);

/** Abbreviations whose full stop does not end a sentence inside a title. */
const ABBREVIATIONS = new Set([
  "vs", "v", "e.g", "i.e", "etc", "al", "cf", "ca", "st", "dr", "mr", "mrs", "ms", "jr", "sr", "no", "vol", "ed", "eds", "fig", "approx",
  "est", "dept", "univ", "inc", "co", "corp", "ltd", "ph.d", "u.s", "u.k",
]);

const LETTER = /\p{L}/u;
const UPPER = /\p{Lu}/u;
/** Initialisms written with full stops: U.S, U.K, Ph.D (the last full stop is punctuation, outside the core). */
const DOTTED = /^(\p{L}{1,2}\.)+\p{L}{1,2}$/u;
/** Hyphens, en dashes and slashes inside a compound (self-esteem, 2010–2020, input/output). */
const HYPHEN = /([-‐–/])/;
/** A separator standing on its own between words: a spaced en dash, hyphen or colon ("Learning – a guide"). */
const LONE_BREAK = /^[-‐–—:]+$/;

/** URLs and e-mail addresses are kept as typed. */
const isLink = (core: string) => /:\/\/|@|^www\./i.test(core) || (/\.\w{2,}(\/|$)/.test(core) && /\w\.\w/.test(core) && !DOTTED.test(core));

/** A part kept as written: acronyms (DNA, COVID), mixed case (iPhone, McDonald), initialisms (U.S). */
function keepPart(part: string): boolean {
  if (DOTTED.test(part) && UPPER.test(part)) return true;
  const letters = [...part].filter((c) => LETTER.test(c));
  return letters.length >= 2 && letters.slice(1).some((c) => UPPER.test(c));
}

/** Capitalizes the first letter, unless the word starts with a digit (21st, 1990s stay as they are). */
/** Dotted abbreviations written in lowercase on purpose (e.g., i.e., a.m.). */
const LOWER_DOTTED = new Set(["e.g", "i.e", "a.m", "p.m", "et al"]);
/** Roman numerals written in lowercase (world war ii, part iii); not vi or xi, which are also words and names. */
const ROMAN = new Set(["ii", "iii", "iv", "vii", "viii", "ix", "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx", "xxi"]);
/** Proper adjectives Chicago keeps capitalized after a prefix (Anti-American, Non-English). */
const PROPER = new Set(["african", "american", "arab", "asian", "british", "catholic", "chinese", "christian", "english", "european", "french", "german", "greek", "hispanic", "indian", "islamic", "italian", "japanese", "jewish", "korean", "latin", "muslim", "roman", "russian", "semitic", "spanish", "western", "eastern"]);

/** Words that keep a fixed form whatever the style: u.s. → U.S., ph.d. → Ph.D., world war ii → II. */
function fixedForm(part: string): string | undefined {
  if (DOTTED.test(part) && !LOWER_DOTTED.has(part.toLowerCase())) return part.split(".").map((seg) => capFirst(seg.toLowerCase())).join(".");
  if (ROMAN.has(part.toLowerCase())) return part.toUpperCase();
  return undefined;
}

const capFirst = (s: string): string => {
  const chars = [...s];
  const i = chars.findIndex((c) => /[\p{L}\p{N}]/u.test(c));
  if (i >= 0 && LETTER.test(chars[i]!)) chars[i] = chars[i]!.toUpperCase();
  return chars.join("");
};

type Token = { lead: string; core: string; trail: string; space: string };

/** "(“Hello," → lead "(“", core "Hello", trail ","; the core keeps inner apostrophes, hyphens and dots. */
function splitToken(raw: string, space: string): Token {
  const m = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/su.exec(raw)!;
  return { lead: m[1]!, core: m[2]!, trail: m[3]!, space };
}

/** A subtitle starts after a colon, an em dash, a question or exclamation mark, or a sentence's full stop (not an ellipsis). */
function startsAfter(prev: Token | undefined, style: TitleStyle): boolean {
  if (!prev) return true;
  if (/\.\.|…/.test(prev.trail)) return false;
  // Sentence case (APA references) capitalizes after a colon, not after a dash.
  if (/[:?!]/.test(prev.trail) || (style !== "sentence" && prev.space.includes("—"))) return true;
  // Not after an abbreviation, an initial or an initialism like U.N. or U.S.A.
  return prev.trail.includes(".") && !ABBREVIATIONS.has(prev.core.toLowerCase()) && !/^\p{L}$/u.test(prev.core) && !DOTTED.test(prev.core);
}

/** One word in a title style. Compounds: a hyphenated one's first part is always capitalized, the other parts judged on their own. */
function convertWord(core: string, style: Exclude<TitleStyle, "sentence">, start: boolean, end: boolean, keep: boolean): string {
  if (isLink(core) || keep) return core;
  const minor = MINOR[style];
  const parts = core.split(HYPHEN);
  const capLast = end && CAP_LAST.has(style);
  if (parts.length > 1) {
    return parts.map((part, i) => {
      if (i % 2 === 1 || !part) return part;
      if (keepPart(part)) return part;
      const fixed = fixedForm(part);
      if (fixed) return fixed;
      const lower = part.toLowerCase();
      const slash = parts[1] === "/";
      // A hyphenated compound's first part is always capitalized; a slash pair (and/or, in/out) is cased as one word.
      if (slash) return start || capLast || !minor.has(lower) ? capFirst(lower) : lower;
      if (i === 0) return capFirst(lower);
      // Chicago: the part right after a bound prefix is lowercase (Anti-inflammatory), a proper adjective is not (Anti-American).
      if (style === "chicago" && i === 2 && PREFIXES.has(parts[0]!.toLowerCase())) return PROPER.has(lower) ? capFirst(lower) : lower;
      return minor.has(lower) && !(capLast && i === parts.length - 1) ? lower : capFirst(lower);
    }).join("");
  }
  if (keepPart(core)) return core;
  const fixed = fixedForm(core);
  if (fixed) return fixed;
  const lower = core.toLowerCase();
  // APA and AP capitalize every word of four letters or more, whatever it is.
  return start || capLast || !minor.has(lower) ? capFirst(lower) : lower;
}

/** One word in sentence case: lowercase except the start, the pronoun I and parts kept as written. */
function sentenceWord(core: string, start: boolean, keep: boolean): string {
  if (isLink(core) || keep) return core;
  // The pronoun I stays capital (I, I'm, I've).
  if (/^i(['’]\p{L}+)?$/iu.test(core)) return capFirst(core.toLowerCase());
  return core.split(HYPHEN).map((part, i) => {
    if (keepPart(part)) return part;
    const fixed = fixedForm(part);
    if (fixed) return fixed;
    const lower = part.toLowerCase();
    return start && i === 0 ? capFirst(lower) : lower;
  }).join("");
}

function convertLine(line: string, style: TitleStyle): string {
  if (!line.trim()) return line;
  // Words are separated by spaces and by em dashes ("Learning—A Guide"); separators are kept as written.
  const pieces = line.split(/(\s*—\s*|\s+)/);
  const indent = pieces[0] === "" ? pieces[1] ?? "" : "";
  const tokens: Token[] = [];
  for (let i = pieces[0] === "" ? 2 : 0; i < pieces.length; i += 2) {
    if (pieces[i]) tokens.push(splitToken(pieces[i]!, pieces[i + 1] ?? ""));
    else if (tokens.length) tokens[tokens.length - 1]!.space += pieces[i + 1] ?? "";
  }
  // A title typed in capitals says nothing about acronyms: start from lowercase, keeping only dotted initialisms (U.S.).
  const letters = [...line].filter((c) => LETTER.test(c));
  const shouting = letters.length >= 6 && letters.filter((c) => UPPER.test(c)).length / letters.length > 0.8;
  const words = shouting ? tokens.map((t) => (DOTTED.test(t.core) ? t : { ...t, core: t.core.toLowerCase() })) : tokens;
  // A lone dash or colon between words ("Learning – a guide") ends one part and starts the next.
  const loneBreak = (t: Token) => !t.core && LONE_BREAK.test(t.lead + t.trail) && (style !== "sentence" || (t.lead + t.trail).includes(":"));
  // Index of the next word for every token, found in one pass from the end.
  const nextWord: number[] = new Array(words.length).fill(-1);
  for (let i = words.length - 2, next = words[words.length - 1]?.core ? words.length - 1 : -1; i >= 0; i--) {
    nextWord[i] = next;
    if (words[i]!.core) next = i;
  }
  // A lone capital letter that names something (Vitamin A, Type B, Plan C) is kept. "A" is kept only before a
  // lowercase word or at the end, since in a title-cased line it is usually the article.
  const keepSingle = (i: number): boolean => {
    const core = words[i]!.core;
    if (shouting || !/^\p{Lu}$/u.test(core) || core === "I" || i === 0) return false;
    if (core !== "A") return true;
    const n = nextWord[i]!;
    return n < 0 || !UPPER.test([...words[n]!.core][0] ?? "");
  };
  let prev: Token | undefined;
  let pending = false;
  const out = words.map((t, i) => {
    if (!t.core) {
      if (loneBreak(t)) pending = true;
      return t.lead + t.trail + t.space;
    }
    const n = nextWord[i]!;
    // The last word before a subtitle, a dash or a sentence's full stop ends a part.
    const end = n < 0 || startsAfter(t, "apa") || words.slice(i + 1, n).some(loneBreak);
    const start = pending || startsAfter(prev, style);
    pending = false;
    prev = t;
    const keep = !start && keepSingle(i);
    const core = style === "sentence" ? sentenceWord(t.core, start, keep) : convertWord(t.core, style, start, end, keep);
    return t.lead + core + t.trail + t.space;
  });
  return indent + out.join("");
}

/** Every line converted on its own: paste a list of titles, get the list back. */
export function titleCase(text: string, style: TitleStyle): string {
  return text.split("\n").map((line) => convertLine(line, style)).join("\n");
}
