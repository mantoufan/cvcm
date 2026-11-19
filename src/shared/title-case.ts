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

/** Words each style writes in lowercase (unless first, last where the style says so, or after a colon). */
const MINOR: Record<Exclude<TitleStyle, "sentence">, Set<string>> = {
  // APA 7 (6.17) and AP: articles, and conjunctions and prepositions of three letters or fewer.
  apa: new Set([...ARTICLES, ...COORDINATING, "as", "if", ...PREPOSITIONS.filter((w) => w.length <= 3)]),
  ap: new Set([...ARTICLES, ...COORDINATING, "as", "if", ...PREPOSITIONS.filter((w) => w.length <= 3)]),
  // MLA 9 (1.2): articles, all prepositions, coordinating conjunctions and the "to" of infinitives.
  mla: new Set([...ARTICLES, ...COORDINATING, ...PREPOSITIONS]),
  // Chicago 17 (8.159): articles, all prepositions, and/but/for/or/nor, to and as; yet, so and if are capitalized.
  chicago: new Set([...ARTICLES, "and", "but", "for", "or", "nor", ...PREPOSITIONS]),
};

/** Styles that always capitalize the last word of a title or subtitle. */
const CAP_LAST = new Set<TitleStyle>(["mla", "chicago", "ap"]);

/** Chicago lowercases the part after these prefixes in a hyphenated compound (Anti-inflammatory, Non-native). */
const PREFIXES = new Set(["anti", "co", "counter", "de", "extra", "inter", "intra", "mid", "multi", "non", "over", "post", "pre", "pro", "re", "semi", "sub", "super", "trans", "un", "under"]);

/** Abbreviations whose full stop does not end a sentence inside a title. */
const ABBREVIATIONS = new Set(["vs", "v", "e.g", "i.e", "etc", "al", "cf", "st", "dr", "mr", "mrs", "ms", "jr", "sr", "no", "vol", "ed", "eds", "u.s", "u.k"]);

const LETTER = /\p{L}/u;
const UPPER = /\p{Lu}/u;

/** Kept exactly as written: acronyms (DNA), mixed case (iPhone, McDonald), URLs and e-mail addresses. */
function keepAsWritten(core: string): boolean {
  if (/[@/]|^www\./i.test(core) || /\.\w{2,}$/.test(core) && /\w\.\w/.test(core)) return true;
  const letters = [...core].filter((c) => LETTER.test(c));
  if (letters.length < 2) return false;
  return letters.slice(1).some((c) => UPPER.test(c));
}

const capFirst = (s: string): string => {
  const i = [...s].findIndex((c) => LETTER.test(c));
  if (i < 0) return s;
  const chars = [...s];
  chars[i] = chars[i]!.toUpperCase();
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

/** A word ends a title or subtitle: it is last, or a colon, ? , ! or an em dash follows it. */
function endsBefore(token: Token, next: Token | undefined): boolean {
  return !next || /[:?!]/.test(token.trail) || token.space.includes("—");
}

function convertWord(core: string, style: Exclude<TitleStyle, "sentence">, start: boolean, end: boolean): string {
  if (keepAsWritten(core)) return core;
  const lower = core.toLowerCase();
  const minor = MINOR[style];
  // Hyphenated compounds: the first part follows the word's position, the others are judged on their own.
  const parts = lower.split(/([-‐–])/);
  if (parts.length > 1) {
    return parts.map((part, i) => {
      if (i % 2 === 1 || !part) return part;
      if (i === 0) return start || end || !minor.has(part) ? capFirst(part) : part;
      if (style === "chicago" && PREFIXES.has(parts[0]!)) return part;
      const lastPart = i === parts.length - 1;
      return minor.has(part) && !(end && lastPart && CAP_LAST.has(style)) ? part : capFirst(part);
    }).join("");
  }
  if (start) return capFirst(lower);
  if (end && CAP_LAST.has(style)) return capFirst(lower);
  // APA and AP capitalize every word of four letters or more, whatever it is.
  return minor.has(lower.replace(/\.$/, "")) ? lower : capFirst(lower);
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
  // A title typed in capitals says nothing about acronyms: start from lowercase.
  const letters = [...line].filter((c) => LETTER.test(c));
  const shouting = letters.length >= 6 && letters.filter((c) => UPPER.test(c)).length / letters.length > 0.8;
  const words = shouting ? tokens.map((t) => ({ ...t, core: t.core.toLowerCase() })) : tokens;
  let prev: Token | undefined;
  const out = words.map((t, i) => {
    if (!t.core) return t.lead + t.trail + t.space;
    const next = words.slice(i + 1).find((w) => w.core);
    const start = startsAfter(prev, style);
    prev = t;
    let core: string;
    if (style !== "sentence") core = convertWord(t.core, style, start, endsBefore(t, next));
    else if (keepAsWritten(t.core)) core = t.core;
    // The pronoun I stays capital (I, I'm, I've).
    else if (/^i(['’]\p{L}+)?$/iu.test(t.core)) core = capFirst(t.core.toLowerCase());
    else core = start ? capFirst(t.core.toLowerCase()) : t.core.toLowerCase();
    return t.lead + core + t.trail + t.space;
  });
  return indent + out.join("");
}

/** Every line converted on its own: paste a list of titles, get the list back. */
export function titleCase(text: string, style: TitleStyle): string {
  return text.split("\n").map((line) => convertLine(line, style)).join("\n");
}
