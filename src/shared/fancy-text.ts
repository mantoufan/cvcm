/**
 * Fancy text: maps plain A–Z, a–z and 0–9 onto look-alike Unicode letters (Mathematical Alphanumeric Symbols,
 * enclosed and fullwidth forms) that paste as text into bios, posts and names. Other characters pass through.
 */

export const FANCY_STYLES = [
  "bold",
  "italic",
  "boldItalic",
  "script",
  "boldScript",
  "fraktur",
  "boldFraktur",
  "doubleStruck",
  "sansBold",
  "sansItalic",
  "monospace",
  "circled",
  "circledNegative",
  "squared",
  "fullwidth",
  "smallCaps",
  "upsideDown",
  "strike",
  "underline",
] as const;

export type FancyStyle = (typeof FANCY_STYLES)[number];

/** Longest input transformed (characters); the rest is cut so 19 styles stay quick to redraw while typing. */
export const MAX_FANCY = 2000;

type Alphabet = { upper?: number; lower?: number; digit?: number; holes?: Record<string, number> };

// First code point of A, a and 0 in each block. Letters Unicode already had elsewhere are "holes" in the block.
const ALPHABETS: Partial<Record<FancyStyle, Alphabet>> = {
  bold: { upper: 0x1d400, lower: 0x1d41a, digit: 0x1d7ce },
  italic: { upper: 0x1d434, lower: 0x1d44e, holes: { h: 0x210e } },
  boldItalic: { upper: 0x1d468, lower: 0x1d482 },
  script: {
    upper: 0x1d49c,
    lower: 0x1d4b6,
    holes: { B: 0x212c, E: 0x2130, F: 0x2131, H: 0x210b, I: 0x2110, L: 0x2112, M: 0x2133, R: 0x211b, e: 0x212f, g: 0x210a, o: 0x2134 },
  },
  boldScript: { upper: 0x1d4d0, lower: 0x1d4ea },
  fraktur: { upper: 0x1d504, lower: 0x1d51e, holes: { C: 0x212d, H: 0x210c, I: 0x2111, R: 0x211c, Z: 0x2128 } },
  boldFraktur: { upper: 0x1d56c, lower: 0x1d586 },
  doubleStruck: {
    upper: 0x1d538,
    lower: 0x1d552,
    digit: 0x1d7d8,
    holes: { C: 0x2102, H: 0x210d, N: 0x2115, P: 0x2119, Q: 0x211a, R: 0x211d, Z: 0x2124 },
  },
  sansBold: { upper: 0x1d5d4, lower: 0x1d5ee, digit: 0x1d7ec },
  sansItalic: { upper: 0x1d608, lower: 0x1d622 },
  monospace: { upper: 0x1d670, lower: 0x1d68a, digit: 0x1d7f6 },
  fullwidth: { upper: 0xff21, lower: 0xff41, digit: 0xff10 },
};

const SMALL_CAPS = "ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ";

// Upside-down look-alikes; the text is also reversed so it reads correctly when the screen is turned over.
const FLIP: Record<string, string> = {
  a: "ɐ", b: "q", c: "ɔ", d: "p", e: "ǝ", f: "ɟ", g: "ƃ", h: "ɥ", i: "ᴉ", j: "ɾ", k: "ʞ", l: "l", m: "ɯ",
  n: "u", o: "o", p: "d", q: "b", r: "ɹ", s: "s", t: "ʇ", u: "n", v: "ʌ", w: "ʍ", x: "x", y: "ʎ", z: "z",
  A: "∀", B: "ꓭ", C: "Ɔ", D: "ꓷ", E: "Ǝ", F: "Ⅎ", G: "⅁", H: "H", I: "I", J: "ſ", K: "ꓘ", L: "⅂", M: "W",
  N: "N", O: "O", P: "Ԁ", Q: "Ό", R: "ꓤ", S: "S", T: "⊥", U: "∩", V: "Λ", W: "M", X: "X", Y: "⅄", Z: "Z",
  "0": "0", "1": "Ɩ", "2": "ᄅ", "3": "Ɛ", "4": "ㄣ", "5": "ϛ", "6": "9", "7": "ㄥ", "8": "8", "9": "6",
  ".": "˙", ",": "'", "'": ",", "\"": "„", "?": "¿", "!": "¡", "(": ")", ")": "(", "[": "]", "]": "[",
  "{": "}", "}": "{", "<": ">", ">": "<", "_": "‾", "&": "⅋", ";": "؛",
};

function fromAlphabet(ch: string, a: Alphabet): string {
  if (a.holes && a.holes[ch] != null) return String.fromCodePoint(a.holes[ch]);
  const c = ch.charCodeAt(0);
  if (a.upper != null && c >= 65 && c <= 90) return String.fromCodePoint(a.upper + c - 65);
  if (a.lower != null && c >= 97 && c <= 122) return String.fromCodePoint(a.lower + c - 97);
  if (a.digit != null && c >= 48 && c <= 57) return String.fromCodePoint(a.digit + c - 48);
  return ch;
}

function circled(ch: string): string {
  const c = ch.charCodeAt(0);
  if (c >= 65 && c <= 90) return String.fromCodePoint(0x24b6 + c - 65);
  if (c >= 97 && c <= 122) return String.fromCodePoint(0x24d0 + c - 97);
  if (c === 48) return "⓪";
  if (c >= 49 && c <= 57) return String.fromCodePoint(0x2460 + c - 49);
  return ch;
}

/** A–Z or a–z only: toUpperCase() would also turn ß into "SS" and ı, ſ into I, S. */
const ASCII_LETTER = /^[A-Za-z]$/;

function circledNegative(ch: string): string {
  if (!ASCII_LETTER.test(ch) && !/^[0-9]$/.test(ch)) return ch;
  const c = ch.toUpperCase().charCodeAt(0);
  if (c >= 65 && c <= 90) return String.fromCodePoint(0x1f150 + c - 65);
  if (ch === "0") return "⓿";
  if (c >= 49 && c <= 57) return String.fromCodePoint(0x2776 + c - 49);
  return ch;
}

function squared(ch: string): string {
  if (!ASCII_LETTER.test(ch)) return ch;
  const c = ch.toUpperCase().charCodeAt(0);
  if (c >= 65 && c <= 90) return String.fromCodePoint(0x1f130 + c - 65);
  return ch;
}

function smallCap(ch: string): string {
  const c = ch.charCodeAt(0);
  if (c >= 97 && c <= 122) return SMALL_CAPS[c - 97];
  return ch;
}

/** Emoji and flags: a combining line would split them. */
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/** What a reader sees as one character: a flag, a skin-tone emoji or e + an accent stay together. */
function graphemes(text: string): string[] {
  return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text), (g) => g.segment);
}

/** Restyles `text` (cut to MAX_FANCY characters). Characters a style has no look-alike for are kept as typed. */
export function fancy(text: string, style: FancyStyle): string {
  const chars = Array.from(text).slice(0, MAX_FANCY);
  const alphabet = ALPHABETS[style];
  if (alphabet) return chars.map((ch) => fromAlphabet(ch, alphabet)).join("");
  switch (style) {
    case "circled":
      return chars.map(circled).join("");
    case "circledNegative":
      return chars.map(circledNegative).join("");
    case "squared":
      return chars.map(squared).join("");
    case "smallCaps":
      return chars.map(smallCap).join("");
    case "upsideDown":
      // Each line is flipped on its own, and the lines are reversed too: the whole block reads turned over.
      return chars.join("").split("\n").map((line) => graphemes(line).reverse().map((ch) => FLIP[ch] ?? ch).join("")).reverse().join("\n");
    case "strike":
      return graphemes(chars.join("")).map((ch) => (/\s/.test(ch) || EMOJI.test(ch) ? ch : `${ch}̶`)).join("");
    case "underline":
      return graphemes(chars.join("")).map((ch) => (ch === "\n" || EMOJI.test(ch) ? ch : `${ch}̲`)).join("");
    default:
      return chars.join("");
  }
}
