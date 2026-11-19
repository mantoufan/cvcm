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
/** Hyphens and en dashes inside a compound (self-esteem, 2010–2020). */
const HYPHEN = /([-‐–])/;
/** A separator standing on its own between words: a spaced en dash, hyphen or colon ("Learning – a guide"). */
const LONE_BREAK = /^[-‐–—:]+$/;

const isLink = (core: string) => /[@/]|^www\./i.test(core) || (/\.\w{2,}$/.test(core) && /\w\.\w/.test(core) && !DOTTED.test(core));

/** A part kept as written: acronyms (DNA, COVID), mixed case (iPhone, McDonald), initialisms (U.S). */
function keepPart(part: string): boolean {
  if (DOTTED.test(part) && UPPER.test(part)) return true;
  const letters = [...part].filter((c) => LETTER.test(c));
  return letters.length >= 2 && letters.slice(1).some((c) => UPPER.test(c));
}

const capFirst = (s: string): string => {
  const chars = [...s];
  const i = chars.findIndex((c) => LETTER.test(c));
  if (i >= 0) chars[i] = chars[i]!.toUpperCase();
  return chars.join("");
};

type Token = { lead: string; core: string; trail: string; space: string };

/** "(“Hello," → lead "(“", core "Hello", trail ","; the core keeps inner apostrophes, hyphens and dots. */
function splitToken(raw: string, space: string): Token {
  const m = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/su.exec(raw)!;
  return { lead: m[1]!, core: m[2]!, trail: m[3]!, space };
}

/** A subtitle starts after a colon, an em dash, a question or exclamation mark, or a sentence's full stop. */
function startsAfter(prev: Token | undefined, style: TitleStyle): boolean {
  if (!prev) return true;
  // Sentence case (APA references) capitalizes after a colon, not after a dash.
  if (/[:?!]/.test(prev.trail) || (style !== "sentence" && prev.space.includes("—"))) return true;
  return prev.trail.includes(".") && !ABBREVIATIONS.has(prev.core.toLowerCase()) && !/^\p{L}$/u.test(prev.core);
}

/** One word in a title style. Hyphenated compounds: the first part is always capitalized, the others judged on their own. */
function convertWord(core: string, style: Exclude<TitleStyle, "sentence">, start: boolean, end: boolean): string {
  if (isLink(core)) return core;
  const minor = MINOR[style];
  const parts = core.split(HYPHEN);
  const capLast = end && CAP_LAST.has(style);
  if (parts.length > 1) {
    return parts.map((part, i) => {
      if (i % 2 === 1 || !part) return part;
      if (keepPart(part)) return part;
      const lower = part.toLowerCase();
      if (i === 0) return capFirst(lower);
      if (style === "chicago" && PREFIXES.has(parts[0]!.toLowerCase())) return lower;
      return minor.has(lower) && !(capLast && i === parts.length - 1) ? lower : capFirst(lower);
    }).join("");
  }
  if (keepPart(core)) return core;
  const lower = core.toLowerCase();
  // APA and AP capitalize every word of four letters or more, whatever it is.
  return start || capLast || !minor.has(lower) ? capFirst(lower) : lower;
}

/** One word in sentence case: lowercase except the start, the pronoun I and parts kept as written. */
function sentenceWord(core: string, start: boolean): string {
  if (isLink(core)) return core;
  // The pronoun I stays capital (I, I'm, I've).
  if (/^i(['’]\p{L}+)?$/iu.test(core)) return capFirst(core.toLowerCase());
  return core.split(HYPHEN).map((part, i) => {
    if (keepPart(part)) return part;
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
  let prev: Token | undefined;
  let pending = false;
  const out = words.map((t, i) => {
    if (!t.core) {
      if (loneBreak(t)) pending = true;
      return t.lead + t.trail + t.space;
    }
    const rest = words.slice(i + 1);
    const nextAt = rest.findIndex((w) => w.core);
    const end = nextAt < 0 || /[:?!]/.test(t.trail) || t.space.includes("—") || rest.slice(0, nextAt).some(loneBreak);
    const start = pending || startsAfter(prev, style);
    pending = false;
    prev = t;
    const core = style === "sentence" ? sentenceWord(t.core, start) : convertWord(t.core, style, start, end);
    return t.lead + core + t.trail + t.space;
  });
  return indent + out.join("");
}

/** Every line converted on its own: paste a list of titles, get the list back. */
export function titleCase(text: string, style: TitleStyle): string {
  return text.split("\n").map((line) => convertLine(line, style)).join("\n");
}
