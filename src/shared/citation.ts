/**
 * Citation generator: a source (journal article, book, book chapter or web page) formatted in APA 7, MLA 9, Chicago 17
 * (notes and bibliography), Harvard (Cite Them Right), IEEE, Vancouver and GB/T 7714-2015, plus BibTeX / RIS import
 * and export and the mapping from Crossref and Open Library records. Pure functions: no DOM, no network.
 *
 * Output is a list of segments so italics survive: the page renders them as <i>, copies them as HTML for word
 * processors, and joins them as plain text.
 */

export const STYLES = ["apa", "mla", "chicago", "harvard", "ieee", "vancouver", "gbt"] as const;
export type Style = (typeof STYLES)[number];

export const SOURCE_TYPES = ["article", "book", "chapter", "webpage"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/** A person (family + given, and a suffix such as Jr. or III) or a group author such as an organization (literal). */
export type Person = { family: string; given: string; suffix?: string } | { literal: string };

export type Work = {
  type: SourceType;
  authors: Person[];
  /** Editors of the book a chapter is in. */
  editors: Person[];
  title: string;
  /** Journal (article), book (chapter) or website (web page) name. */
  container: string;
  year: string;
  /** 1–12, or 0 when unknown. */
  month: number;
  day: number;
  volume: string;
  issue: string;
  pages: string;
  /** Edition number ("2"), empty for a first edition. */
  edition: string;
  publisher: string;
  place: string;
  doi: string;
  url: string;
  /** Date a web page was read, YYYY-MM-DD. */
  accessed: string;
  /** A book whose people are its editors (an edited volume): every style marks them as editors. */
  edited: boolean;
};

export type Segment = { t: string; i?: boolean };

export function emptyWork(type: SourceType = "article"): Work {
  return { type, authors: [], editors: [], title: "", container: "", year: "", month: 0, day: 0, volume: "", issue: "", pages: "", edition: "", publisher: "", place: "", doi: "", url: "", accessed: "", edited: false };
}

export const plainText = (segs: readonly Segment[]): string => segs.map((s) => s.t).join("");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const html = (segs: readonly Segment[]): string => segs.map((s) => (s.i ? `<i>${esc(s.t)}</i>` : esc(s.t))).join("");

// ---------- names ----------

const CJK = /[぀-ヿ㐀-鿿가-힯]/;

/**
 * One author as typed: "Family, Given" or "Given Family"; a name in {braces} (or a single word) is a group author.
 * A CJK name with no comma is kept whole as written ("张三").
 */
export function parsePerson(raw: string): Person | null {
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) return null;
  const braced = /^\{(.+)\}$/.exec(s);
  if (braced) return { literal: braced[1]!.trim() };
  if (s.includes(",")) {
    // "Family, Given" or "Family, Given, Jr." (a trailing suffix keeps its own place).
    const [family, ...rest] = s.split(",").map((x) => x.trim());
    const last = rest[rest.length - 1] ?? "";
    if (rest.length >= 2 && SUFFIXES.test(last)) return { family: family!, given: rest.slice(0, -1).join(", "), suffix: last };
    const given = rest.join(", ").trim();
    return given ? { family: family!, given } : { literal: family! };
  }
  if (CJK.test(s) || !s.includes(" ")) return { literal: s };
  return splitGivenFamily(s.split(" "));
}

const SUFFIXES = /^(jr|sr|ii|iii|iv|v)\.?$/i;
const PARTICLES = new Set(["van", "von", "de", "der", "den", "del", "della", "di", "da", "du", "dos", "das", "la", "le", "ter", "ten", "bin", "al"]);

/**
 * "Given … Family" words to a person: a trailing Jr./Sr./III becomes the suffix (APA: "King, M. L., Jr."), and lowercase
 * particles before it join the family name ("Ludwig van Beethoven" → van Beethoven, Ludwig).
 */
export function splitGivenFamily(words: string[]): Person {
  const w = [...words];
  const suffix = w.length > 2 && SUFFIXES.test(w[w.length - 1]!) ? w.pop()! : "";
  let start = w.length - 1;
  while (start > 1 && PARTICLES.has(w[start - 1]!)) start--;
  const p: Person = { family: w.slice(start).join(" "), given: w.slice(0, start).join(" ") };
  return suffix ? { ...p, suffix } : p;
}

/** One person per line (or per ";" outside braces: "{Dept. A; Dept. B}" stays one group author). */
export function parsePeople(text: string): Person[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of text) {
    if (ch === "{") depth++;
    else if (ch === "}") depth = Math.max(0, depth - 1);
    if (ch === "\n" || (ch === ";" && depth === 0)) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out.map(parsePerson).filter((p): p is Person => p !== null);
}

export function personToText(p: Person): string {
  // A group author goes back in braces unless it is one word or CJK with no comma (parsePerson keeps those whole).
  if (!("literal" in p)) return `${p.family}, ${p.given}${p.suffix ? `, ${p.suffix}` : ""}`;
  return !/[,;]/.test(p.literal) && (CJK.test(p.literal) || !p.literal.includes(" ")) ? p.literal : `{${p.literal}}`;
}

/** Initials of given names: "Ludwig Josef" → ["L", "J"]; "Jean-Paul" → ["J.-P"] (joined by the caller). */
function initials(given: string): string[] {
  // "J.R.R." and "J. R. R." are three initials; "J.-P." stays one hyphenated initial.
  return given.replace(/\.-/g, "-").split(/[\s.]+/).filter(Boolean).map((g) => g.split("-").map((part) => part.replace(/\./g, "").charAt(0).toUpperCase()).filter(Boolean).join(".-"));
}

const isLiteral = (p: Person): p is { literal: string } => "literal" in p;
const familyOf = (p: Person) => (isLiteral(p) ? p.literal : p.family);

/** ", Jr." after a name that has a suffix (APA, MLA, Chicago, Harvard). */
const sfx = (p: Person, sep = ", ") => (!isLiteral(p) && p.suffix ? `${sep}${p.suffix}` : "");
/** "Family, G. M." (APA). */
const apaName = (p: Person) => (isLiteral(p) ? p.literal : `${p.family}, ${initials(p.given).map((x) => `${x}.`).join(" ")}${sfx(p)}`);
/** "G. M. Family" (APA editors, IEEE). */
const initialsFirst = (p: Person) => (isLiteral(p) ? p.literal : `${initials(p.given).map((x) => `${x}.`).join(" ")} ${p.family}${sfx(p, " ")}`);
/** "Family, G.M." (Harvard, Cite Them Right). */
const harvardName = (p: Person) => (isLiteral(p) ? p.literal : `${p.family}, ${initials(p.given).map((x) => `${x}.`).join("")}${sfx(p)}`);
/** "Family, Given" / "Given Family" (MLA, Chicago). */
const inverted = (p: Person) => (isLiteral(p) ? p.literal : `${p.family}, ${p.given}${sfx(p)}`);
const natural = (p: Person) => (isLiteral(p) ? p.literal : `${p.given} ${p.family}${sfx(p, " ")}`);
/** "Family GM" (Vancouver). */
const vancouverName = (p: Person) => (isLiteral(p) ? p.literal : `${p.family} ${initials(p.given).join("").replace(/[.-]/g, "")}${!isLiteral(p) && p.suffix ? ` ${p.suffix.replace(/\./g, "")}` : ""}`);
/** "FAMILY G M" for Western names, as written for CJK names (GB/T 7714). */
const gbtName = (p: Person) => {
  if (isLiteral(p)) return p.literal;
  if (CJK.test(p.family) || CJK.test(p.given)) return `${p.family}${p.given}`;
  return `${p.family.toUpperCase()} ${initials(p.given).join(" ").replace(/[.-]+/g, " ").replace(/\s+/g, " ")}`;
};

/** "A, B, and C" with a choice of final joiner and serial comma. */
function joinList(items: string[], last: string, serial = true): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]}${last}${items[1]}`;
  return `${items.slice(0, -1).join(", ")}${serial ? "," : ""}${last}${items[items.length - 1]}`;
}

// ---------- small text helpers ----------

/** Ends with a period unless it already ends with . ? or ! */
const stop = (s: string) => (/[.?!]$/.test(s) ? s : `${s}.`);
/** The mark to put after an italic title: nothing when it already ends with . ? or ! ("Why?" never becomes "Why?."). */
const endMark = (title: string, mark = ".") => (/[.?!]$/.test(title) ? "" : mark);
/** Ends with a comma, unless the text already ends with ? or ! (a title such as "Why?" takes no extra comma). */
const commaAfter = (s: string) => (/[?!]$/.test(s) ? s : `${s},`);

const EN_DASH = "–";
/** A page range with the dash a style wants: "123-9" stays as typed apart from the dash. */
const pageRange = (pages: string, dash: string) => pages.trim().replace(/\s*[-–—]+\s*/g, dash);
const isRange = (pages: string) => /[-–—]/.test(pages);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MLA_MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
const IEEE_MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
const NLM_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function ordinal(n: string): string {
  const k = Number(n);
  if (!Number.isInteger(k) || k <= 0) return n;
  const teen = k % 100 >= 11 && k % 100 <= 13;
  return `${k}${teen ? "th" : ["th", "st", "nd", "rd"][k % 10] ?? "th"}`;
}

/** "10.1000/xyz" from a DOI typed with or without its https://doi.org/ prefix. */
export function cleanDoi(doi: string): string {
  return doi.trim().replace(/^(https?:\/\/)?((dx|www)\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
}
const doiUrl = (doi: string) => `https://doi.org/${cleanDoi(doi)}`;

function parseAccessed(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
}

// ---------- styles ----------

type Out = Segment[];
const seg = (t: string, i = false): Segment => (i ? { t, i } : { t });

/** Merges neighbouring plain segments and drops empty ones. */
function tidy(out: Out): Out {
  const res: Out = [];
  for (const s of out) {
    if (!s.t) continue;
    const prev = res[res.length - 1];
    if (prev && !!prev.i === !!s.i) prev.t += s.t;
    else res.push({ ...s });
  }
  // Optional parts each bring their own spaces: "Title. " followed by " https://…" must not leave two.
  for (let i = 0; i < res.length; i++) {
    res[i]!.t = res[i]!.t.replace(/ {2,}/g, " ");
    if (i > 0 && res[i - 1]!.t.endsWith(" ") && res[i]!.t.startsWith(" ")) res[i]!.t = res[i]!.t.slice(1);
  }
  return res;
}

/** Final clean-up shared by the styles: merged segments with no trailing space. */
const finish = (out: Out): Out => tidy(out).map((s, i, a) => (i === a.length - 1 ? { ...s, t: s.t.trimEnd() } : s));

/** The label a numbered style writes before an entry in its list: [1] (IEEE, GB/T 7714) or "1." (Vancouver). */
export function numberLabel(style: Style, i: number): string {
  if (!NUMBERED.has(style)) return "";
  return style === "vancouver" ? `${i + 1}. ` : `[${i + 1}] `;
}

/** Whether the people leading this entry are editors (an edited book). */
const isEdited = (w: Work) => w.type === "book" && w.edited && w.authors.length > 0;

/** A date typed or imported as Y-M-D or Y/M/D, written YYYY-MM-DD; anything else becomes "". */
export function normDate(v: string): string {
  const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(v.trim());
  if (!m) return "";
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(mo)}-${pad(d)}` : "";
}

// APA 7

function apaAuthors(people: Person[]): string {
  const names = people.map(apaName);
  // 21 or more: the first 19, an ellipsis, then the last author.
  if (names.length > 20) return `${names.slice(0, 19).join(", ")}, . . . ${names[names.length - 1]}`;
  // Two or more: commas between all, "&" before the last (with a comma, even for two: "Smith, J., & Lee, K.").
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
}

function apaDate(w: Work): string {
  if (!w.year) return "n.d.";
  if (w.type === "webpage" && w.month) return `${w.year}, ${MONTHS[w.month - 1]}${w.day ? ` ${w.day}` : ""}`;
  return w.year;
}

function apaLink(w: Work): string {
  return w.doi ? doiUrl(w.doi) : w.url;
}

function apa(w: Work): Out {
  const out: Out = [];
  const date = `(${apaDate(w)}). `;
  // Editors of an edited book: "Smith, J., & Lee, K. (Eds.)."
  const eds = isEdited(w) ? ` (${w.authors.length > 1 ? "Eds." : "Ed."})` : "";
  const lead = w.authors.length ? `${stop(apaAuthors(w.authors) + eds)} ` : "";
  const link = apaLink(w);
  if (w.type === "article") {
    // With no author the title moves to the author position, before the date.
    out.push(seg(lead ? lead + date + stop(w.title) + " " : stop(w.title) + " " + date));
    out.push(seg(w.container, true));
    if (w.volume) out.push(seg(", "), seg(w.volume, true));
    // With no volume the issue still needs its comma: "Journal, (3)".
    if (w.issue) out.push(seg(`${w.volume ? "" : ", "}(${w.issue})`));
    if (w.pages) out.push(seg(`, ${pageRange(w.pages, EN_DASH)}`));
    // A journal name ending in ? or ! with nothing after it takes no extra period.
    const bare = !w.volume && !w.issue && !w.pages;
    out.push(seg(`${bare ? endMark(w.container) : "."}${link ? ` ${link}` : ""}`));
  } else if (w.type === "book") {
    const ed = w.edition ? ` (${ordinal(w.edition)} ed.)` : "";
    const after = ed ? `${ed}. ` : `${endMark(w.title)} `;
    if (lead) out.push(seg(lead + date), seg(w.title, true), seg(after));
    else out.push(seg(w.title, true), seg(`${after}${date}`));
    if (w.publisher) out.push(seg(`${stop(w.publisher)}`));
    if (link) out.push(seg(` ${link}`));
  } else if (w.type === "chapter") {
    out.push(seg(lead ? lead + date + stop(w.title) + " " : stop(w.title) + " " + date));
    const eds = w.editors.length ? `${apaEditorList(w.editors)} (${w.editors.length > 1 ? "Eds." : "Ed."}), ` : "";
    out.push(seg(`In ${eds}`), seg(w.container, true));
    // Edition and pages share one parenthesis after the book title: (2nd ed., pp. 12–34).
    const inside = [w.edition ? `${ordinal(w.edition)} ed.` : "", w.pages ? `${isRange(w.pages) ? "pp." : "p."} ${pageRange(w.pages, EN_DASH)}` : ""].filter(Boolean).join(", ");
    out.push(seg(inside ? ` (${inside}).` : endMark(w.container)));
    if (w.publisher) out.push(seg(` ${stop(w.publisher)}`));
    if (link) out.push(seg(` ${link}`));
  } else {
    if (lead) out.push(seg(lead + date), seg(w.title, true), seg(`${endMark(w.title)} `));
    else out.push(seg(w.title, true), seg(`${endMark(w.title)} ${date}`));
    // The site name is left out when it is the same as the author.
    if (w.container && !(w.authors.length === 1 && familyOf(w.authors[0]!) === w.container)) out.push(seg(`${stop(w.container)} `));
    if (link) out.push(seg(link));
  }
  return finish(out);
}

function apaEditorList(people: Person[]): string {
  const names = people.map(initialsFirst);
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
}

function apaInText(w: Work): string {
  const year = w.year || "n.d.";
  const a = w.authors;
  const who = !a.length ? (w.type === "article" || w.type === "chapter" ? `"${w.title}"` : w.title)
    : a.length === 1 ? familyOf(a[0]!)
    : a.length === 2 ? `${familyOf(a[0]!)} & ${familyOf(a[1]!)}`
    : `${familyOf(a[0]!)} et al.`;
  return `(${who}, ${year})`;
}

// MLA 9

function mlaAuthors(people: Person[]): string {
  if (!people.length) return "";
  if (people.length === 1) return inverted(people[0]!);
  if (people.length === 2) return `${inverted(people[0]!)}, and ${natural(people[1]!)}`;
  return `${inverted(people[0]!)}, et al.`;
}

const noProtocol = (url: string) => url.replace(/^https?:\/\//, "");

function mlaDate(w: Work): string {
  if (!w.year) return "";
  if (w.month) return `${w.day ? `${w.day} ` : ""}${MLA_MONTHS[w.month - 1]} ${w.year}`;
  return w.year;
}

function mla(w: Work): Out {
  const out: Out = [];
  // Editors: "Smith, John, editor." / "Smith, John, and Kim Lee, editors."
  const mlaEds = isEdited(w) ? `, ${w.authors.length > 1 ? "editors" : "editor"}` : "";
  if (w.authors.length) out.push(seg(`${stop(mlaAuthors(w.authors) + mlaEds)} `));
  const link = w.doi ? doiUrl(w.doi) : w.url ? noProtocol(w.url) : "";
  const pp = w.pages ? `${isRange(w.pages) ? "pp." : "p."} ${pageRange(w.pages, "-")}` : "";
  if (w.type === "book") {
    out.push(seg(w.title, true), seg(`${endMark(w.title)} `));
    // Edition, publisher, year and link, each only when given; with none the title's own period ends the entry.
    const parts = [w.edition ? `${ordinal(w.edition)} ed.` : "", w.publisher, w.year, link].filter(Boolean);
    if (parts.length) out.push(seg(stop(parts.join(", "))));
  } else {
    // A title already ending in ? or ! takes no period inside the quotes.
    out.push(seg(`"${stop(w.title)}"`));
    if (w.container) out.push(seg(" "), seg(w.container, true));
    const tail: string[] = [];
    if (w.type === "chapter" && w.editors.length) tail.push(`edited by ${joinList(w.editors.map(natural), " and ", true)}`);
    if (w.type === "chapter" && w.edition) tail.push(`${ordinal(w.edition)} ed.`);
    if (w.type === "article") {
      if (w.volume) tail.push(`vol. ${w.volume}`);
      if (w.issue) tail.push(`no. ${w.issue}`);
    }
    if (w.type === "chapter" && w.publisher) tail.push(w.publisher);
    const date = mlaDate(w);
    if (date) tail.push(date);
    if (pp) tail.push(pp);
    if (link) tail.push(link);
    // An undated web page ends with the date it was read (MLA 9: "Accessed 2 Jan. 2024.").
    const acc = w.type === "webpage" && !date ? parseAccessed(w.accessed) : null;
    // With no container the parts follow the title's own period: "Title." 27 May 2015, url.
    out.push(seg(tail.length ? `${w.container ? "," : ""} ${stop(tail.join(", "))}` : w.container ? endMark(w.container) : ""));
    if (acc) out.push(seg(` Accessed ${acc.d} ${MLA_MONTHS[acc.m - 1]} ${acc.y}.`));
  }
  return finish(out);
}

function mlaInText(w: Work): string {
  const a = w.authors;
  const page = w.pages ? ` ${w.pages.split(/[-–—]/)[0]!.trim()}` : "";
  const who = !a.length ? `"${w.title}"` : a.length === 1 ? familyOf(a[0]!) : a.length === 2 ? `${familyOf(a[0]!)} and ${familyOf(a[1]!)}` : `${familyOf(a[0]!)} et al.`;
  return `(${who}${page})`;
}

// Chicago 17, notes and bibliography (the bibliography entry)

function chicagoAuthors(people: Person[]): string {
  if (!people.length) return "";
  // More than ten: the first seven, then et al.
  if (people.length > 10) return `${[inverted(people[0]!), ...people.slice(1, 7).map(natural)].join(", ")}, et al.`;
  // The first name is inverted, so even two authors take a comma before "and": "Ward, Geoffrey C., and Ken Burns".
  if (people.length === 2) return `${inverted(people[0]!)}, and ${natural(people[1]!)}`;
  const names = [inverted(people[0]!), ...people.slice(1).map(natural)];
  return joinList(names, " and ", true);
}

function chicago(w: Work): Out {
  const out: Out = [];
  const chiEds = isEdited(w) ? `, ${w.authors.length > 1 ? "eds" : "ed"}` : "";
  if (w.authors.length) out.push(seg(`${stop(chicagoAuthors(w.authors) + chiEds)} `));
  const link = w.doi ? doiUrl(w.doi) : w.url;
  const pub = [w.place && w.publisher ? `${w.place}: ${w.publisher}` : w.publisher || w.place, w.year].filter(Boolean).join(", ");
  if (w.type === "article") {
    out.push(seg(`"${stop(w.title)}" `), seg(w.container, true));
    if (w.volume) out.push(seg(` ${w.volume}`));
    if (w.issue) out.push(seg(`, no. ${w.issue}`));
    if (w.year) out.push(seg(` (${w.year})`));
    out.push(seg(w.pages ? `: ${pageRange(w.pages, EN_DASH)}.` : "."));
    if (link) out.push(seg(` ${stop(link)}`));
  } else if (w.type === "book") {
    out.push(seg(w.title, true), seg(`${endMark(w.title)} `));
    if (w.edition) out.push(seg(`${ordinal(w.edition)} ed. `));
    if (pub) out.push(seg(`${stop(pub)}`));
    if (link) out.push(seg(` ${stop(link)}`));
  } else if (w.type === "chapter") {
    out.push(seg(`"${stop(w.title)}" In `), seg(w.container, true));
    // "In Book, edited by A, 2nd ed., 12–34." — the edition's own period ends the part when nothing follows it.
    const parts = [w.editors.length ? `edited by ${joinList(w.editors.map(natural), " and ", true)}` : "", w.edition ? `${ordinal(w.edition)} ed.` : "", w.pages ? pageRange(w.pages, EN_DASH) : ""].filter(Boolean);
    const after = parts.length ? `, ${parts.join(", ")}` : "";
    out.push(seg(`${after}${after ? endMark(after) : endMark(w.container)} `));
    if (pub) out.push(seg(stop(pub)));
    if (link) out.push(seg(` ${stop(link)}`));
  } else {
    out.push(seg(`"${stop(w.title)}" `));
    // Website, Month Day, Year. — or, with no date, Website. Accessed Month Day, Year.
    const date = w.year ? (w.month ? `${MONTHS[w.month - 1]}${w.day ? ` ${w.day},` : ""} ${w.year}` : w.year) : "";
    if (date) out.push(seg(`${w.container ? `${w.container}, ` : ""}${date}. `));
    else {
      if (w.container) out.push(seg(`${stop(w.container)} `));
      const acc = parseAccessed(w.accessed);
      if (acc) out.push(seg(`Accessed ${MONTHS[acc.m - 1]} ${acc.d}, ${acc.y}. `));
    }
    if (link) out.push(seg(stop(link)));
  }
  return finish(out);
}

/** Chicago short note: Family, Title (article and chapter titles in quotes). */
function chicagoNote(w: Work): Out {
  const a = w.authors;
  const who = !a.length ? "" : a.length === 1 ? familyOf(a[0]!) : a.length <= 3 ? joinList(a.map(familyOf), " and ", true) : `${familyOf(a[0]!)} et al.`;
  const lead = who ? `${who}, ` : "";
  return w.type === "book" ? tidy([seg(lead), seg(w.title, true), seg(endMark(w.title))]) : [seg(`${lead}"${stop(w.title)}"`)];
}

// Harvard (Cite Them Right, 12th edition)

function harvardAuthors(people: Person[]): string {
  const names = people.map(harvardName);
  if (names.length >= 4) return `${names[0]} et al.`;
  return joinList(names, " and ", false);
}

function harvard(w: Work): Out {
  const out: Out = [];
  const year = w.year ? `(${w.year})` : "(no date)";
  const harEds = isEdited(w) ? ` (${w.authors.length > 1 ? "eds" : "ed."})` : "";
  const lead = w.authors.length ? `${harvardAuthors(w.authors)}${harEds} ${year} ` : "";
  const acc = parseAccessed(w.accessed);
  const accessed = acc ? ` (Accessed: ${acc.d} ${MONTHS[acc.m - 1]} ${acc.y})` : "";
  const available = w.doi ? `Available at: ${doiUrl(w.doi)}` : w.url ? `Available at: ${w.url}${accessed}` : "";
  const pub = w.place && w.publisher ? `${w.place}: ${w.publisher}` : w.publisher || w.place;
  if (w.type === "article") {
    out.push(seg(lead ? `${lead}'${w.title}', ` : `'${w.title}' ${year}, `), seg(w.container, true));
    const vol = w.volume ? `, ${w.volume}${w.issue ? `(${w.issue})` : ""}` : w.issue ? `, (${w.issue})` : "";
    out.push(seg(vol));
    if (w.pages) out.push(seg(`, ${isRange(w.pages) ? "pp." : "p."} ${pageRange(w.pages, EN_DASH)}`));
    // The journal name ends the part when nothing follows it: then its own ? or ! stands in for the period.
    const mark = vol || w.pages ? "." : endMark(w.container);
    out.push(seg(available ? `${mark} ${available}.` : mark));
  } else if (w.type === "book") {
    out.push(seg(lead || ""), seg(w.title, true), seg(lead ? `${endMark(w.title)} ` : ` ${year}. `));
    if (w.edition) out.push(seg(`${ordinal(w.edition)} edn. `));
    if (pub) out.push(seg(`${pub}.`));
    if (available) out.push(seg(` ${available}.`));
  } else if (w.type === "chapter") {
    out.push(seg(lead ? `${lead}'${w.title}', in ` : `'${w.title}' ${year}, in `));
    if (w.editors.length) out.push(seg(`${joinList(w.editors.map(harvardName), " and ", false)} (${w.editors.length > 1 ? "eds" : "ed."}) `));
    out.push(seg(w.container, true));
    if (w.edition) out.push(seg(`${endMark(w.container)} ${ordinal(w.edition)} edn`));
    // Publisher and pages each only when given: "in Book. London: Press, pp. 1–2." or just "in Book."
    const rest = [pub, w.pages ? `${isRange(w.pages) ? "pp." : "p."} ${pageRange(w.pages, EN_DASH)}` : ""].filter(Boolean);
    if (rest.length) out.push(seg(`${w.edition ? "." : endMark(w.container)} ${rest.join(", ")}`));
    const mark = rest.length || w.edition ? "." : endMark(w.container);
    out.push(seg(available ? `${mark} ${available}.` : mark));
  } else {
    out.push(seg(lead || ""), seg(w.title, true), seg(lead ? "" : ` ${year}`));
    const mark = lead ? endMark(w.title) : ".";
    out.push(seg(available ? `${mark} ${available}.` : mark));
  }
  return finish(out);
}

function harvardInText(w: Work): string {
  const a = w.authors;
  const year = w.year || "no date";
  const who = !a.length ? w.title : a.length === 1 ? familyOf(a[0]!) : a.length <= 3 ? joinList(a.map(familyOf), " and ", false) : `${familyOf(a[0]!)} et al.`;
  return `(${who}, ${year})`;
}

// IEEE

function ieeeAuthors(people: Person[]): string {
  const names = people.map(initialsFirst);
  if (names.length > 6) return `${names[0]} et al.`;
  return joinList(names, " and ", true);
}

function ieee(w: Work): Out {
  const out: Out = [];
  const lead = w.authors.length ? `${ieeeAuthors(w.authors)}${isEdited(w) ? `, ${w.authors.length > 1 ? "Eds" : "Ed"}.` : ""}, ` : "";
  const pub = [w.place && w.publisher ? `${w.place}: ${w.publisher}` : w.publisher || w.place, w.year].filter(Boolean).join(", ");
  if (w.type === "article") {
    out.push(seg(`${lead}"${commaAfter(w.title)}" `), seg(w.container, true));
    const tail = [w.volume && `vol. ${w.volume}`, w.issue && `no. ${w.issue}`, w.pages && `${isRange(w.pages) ? "pp." : "p."} ${pageRange(w.pages, EN_DASH)}`, [w.month ? IEEE_MONTHS[w.month - 1] : "", w.year].filter(Boolean).join(" ")].filter(Boolean);
    out.push(seg(tail.length ? `, ${tail.join(", ")}` : ""));
    // An online-only article with a URL and no DOI keeps its link.
    out.push(seg(w.doi ? `, doi: ${cleanDoi(w.doi)}.` : w.url ? `. [Online]. Available: ${w.url}` : "."));
  } else if (w.type === "book") {
    out.push(seg(lead), seg(w.title, true), seg(w.edition ? `, ${ordinal(w.edition)} ed. ` : `${endMark(w.title)} `));
    if (pub) out.push(seg(`${pub}.`));
    if (w.doi) out.push(seg(` doi: ${cleanDoi(w.doi)}.`));
    else if (w.url) out.push(seg(` [Online]. Available: ${w.url}`));
  } else if (w.type === "chapter") {
    out.push(seg(`${lead}"${commaAfter(w.title)}" in `), seg(w.container, true));
    // "in Book, 2nd ed., A. Lee, Ed. City: Pub, 2015, pp. 1–20." — the head (edition, editors) ends with its own period;
    // without one the book title takes a period before the publisher, or a comma before bare pages.
    const pp = w.pages ? `${isRange(w.pages) ? "pp." : "p."} ${pageRange(w.pages, EN_DASH)}` : "";
    const head = [w.edition ? `${ordinal(w.edition)} ed.` : "", w.editors.length ? `${ieeeAuthors(w.editors)}, ${w.editors.length > 1 ? "Eds" : "Ed"}.` : ""].filter(Boolean);
    const tail = [pub, pp].filter(Boolean).join(", ");
    if (head.length) out.push(seg(`, ${head.join(", ")}${pub ? ` ${tail}.` : pp ? `, ${pp}.` : ""}`));
    else out.push(seg(pub ? `${endMark(w.container)} ${tail}.` : pp ? `, ${pp}.` : endMark(w.container)));
    if (w.doi) out.push(seg(` doi: ${cleanDoi(w.doi)}.`));
    else if (w.url) out.push(seg(` [Online]. Available: ${w.url}`));
  } else {
    const acc0 = parseAccessed(w.accessed);
    // With nothing after the title it closes with a period, not a dangling comma.
    // "Title," Site. — with no site name the title closes with a period before Accessed / [Online].
    out.push(seg(w.container ? `${lead}"${commaAfter(w.title)}" ` : acc0 || w.url ? `${lead}"${stop(w.title)}" ` : `${lead}"${stop(w.title)}"`));
    if (w.container) out.push(seg(`${w.container}. `));
    if (acc0) out.push(seg(`Accessed: ${IEEE_MONTHS[acc0.m - 1]} ${acc0.d}, ${acc0.y}. `));
    if (w.url) out.push(seg(`[Online]. Available: ${w.url}`));
    else if (w.doi) out.push(seg(`doi: ${cleanDoi(w.doi)}.`));
  }
  return finish(out);
}

// Vancouver (ICMJE / NLM)

function vancouverAuthors(people: Person[]): string {
  const names = people.map(vancouverName);
  return names.length > 6 ? `${names.slice(0, 6).join(", ")}, et al.` : names.join(", ");
}

function vancouver(w: Work): Out {
  // Parts are joined only when present, so a missing year or publisher never leaves ". ." behind.
  const parts = (...xs: (string | false)[]) => [seg(xs.filter(Boolean).join(" "))];
  const lead = w.authors.length ? stop(vancouverAuthors(w.authors) + (isEdited(w) ? `, ${w.authors.length > 1 ? "editors" : "editor"}` : "")) : "";
  const pub = [w.place && w.publisher ? `${w.place}: ${w.publisher}` : w.publisher || w.place, w.year].filter(Boolean).join("; ");
  const ed = w.edition ? ` ${ordinal(w.edition)} ed.` : "";
  if (w.type === "article") {
    const date = [w.year, w.month ? NLM_MONTHS[w.month - 1] : ""].filter(Boolean).join(" ");
    const vi = `${w.volume}${w.issue ? `(${w.issue})` : ""}`;
    const base = [date, vi].filter(Boolean).join(";");
    const loc = base + (w.pages ? `${base ? ":" : ""}${pageRange(w.pages, "-")}` : "");
    return parts(lead, stop(w.title), stop(w.container), !!loc && stop(loc), !!w.doi && `doi:${cleanDoi(w.doi)}`, !w.doi && !!w.url && `Available from: ${w.url}`);
  }
  const link = w.doi ? `doi:${cleanDoi(w.doi)}` : w.url ? `Available from: ${w.url}` : "";
  if (w.type === "book") return parts(lead, stop(w.title) + ed, !!pub && stop(pub), !!link && link);
  if (w.type === "chapter") {
    const eds = w.editors.length ? ` ${vancouverAuthors(w.editors)}, ${w.editors.length > 1 ? "editors" : "editor"}.` : "";
    return parts(lead, stop(w.title), `In:${eds}`, stop(w.container) + ed, !!pub && stop(pub), !!w.pages && `p. ${pageRange(w.pages, "-")}.`, !!link && link);
  }
  const acc = parseAccessed(w.accessed);
  const cited = acc ? `[cited ${acc.y} ${NLM_MONTHS[acc.m - 1]} ${acc.d}]` : "";
  const site = [w.container, w.year].filter(Boolean).join("; ");
  const where = [site, cited].filter(Boolean).join(" ");
  return parts(lead, `${w.title} [Internet].`, !!where && `${where}.`, !!w.url && `Available from: ${w.url}`, !!w.doi && `doi:${cleanDoi(w.doi)}`);
}

// GB/T 7714-2015 (numeric system)

function gbtAuthors(people: Person[]): string {
  const names = people.map(gbtName);
  if (names.length > 3) {
    const chinese = people.some((p) => CJK.test(familyOf(p)));
    return `${names.slice(0, 3).join(", ")}, ${chinese ? "等" : "et al"}`;
  }
  return names.join(", ");
}

const pad = (n: number) => String(n).padStart(2, "0");

function gbt(w: Work): Out {
  const zh = w.authors.some((p) => CJK.test(familyOf(p)));
  const lead = w.authors.length ? `${gbtAuthors(w.authors)}${isEdited(w) ? `, ${zh ? "主编" : "ed"}` : ""}. ` : "";
  const pub = [w.place && w.publisher ? `${w.place}: ${w.publisher}` : w.publisher || w.place, w.year].filter(Boolean).join(", ");
  // Chinese sources write "2版"; Western ones "2nd ed." (GB/T 7714-2015, 8.3); a word edition stays as written.
  const ed = !w.edition ? "" : /^\d+$/.test(w.edition) ? (zh || CJK.test(w.title) ? ` ${w.edition}版.` : ` ${ordinal(w.edition)} ed.`) : ` ${stop(w.edition)}`;
  const doi = w.doi ? ` DOI:${cleanDoi(w.doi)}.` : "";
  const pp = w.pages ? `: ${pageRange(w.pages, "-")}` : "";
  if (w.type === "article") {
    const vi = `${w.volume}${w.issue ? `(${w.issue})` : ""}`;
    const loc = [w.year, vi].filter(Boolean).join(", ");
    // Online articles are [J/OL] with the link after the DOI (GB/T 7714-2015, 8.1).
    const online = w.url ? ` ${w.url}.` : "";
    return [seg(`${lead}${w.title}[${w.url ? "J/OL" : "J"}]. ${w.container}${loc ? `, ${loc}` : ""}${pp}.${online}${doi}`)];
  }
  // An online book is [M/OL] with its link (GB/T 7714-2015, 8.1).
  if (w.type === "book") return [seg(`${lead}${w.title}[${w.url ? "M/OL" : "M"}].${ed}${pub ? ` ${pub}.` : ""}${w.url ? ` ${w.url}.` : ""}${doi}`)];
  if (w.type === "chapter") {
    const eds = w.editors.length ? `${gbtAuthors(w.editors)}. ` : "";
    // Pages with no publisher or year follow the book title directly: "//Book: 12-34."
    if (!pub && pp && !ed) return [seg(`${lead}${w.title}[M]//${eds}${w.container}${pp}.${doi}`)];
    const tail = pub ? ` ${pub}${pp}.` : pp ? ` ${pp.slice(2)}.` : "";
    return [seg(`${lead}${w.title}[M]//${eds}${w.container}${endMark(w.container)}${ed}${tail}${doi}`)];
  }
  const published = w.year ? (w.month ? `${w.year}-${pad(w.month)}${w.day ? `-${pad(w.day)}` : ""}` : w.year) : "";
  const acc = w.accessed.trim();
  const dates = `${published ? `(${published})` : ""}${acc ? `[${acc}]` : ""}`;
  return [seg(`${lead}${w.title}[EB/OL]. ${dates ? `${dates}. ` : ""}${w.url}${w.url ? "." : ""}${doi}`.trim())];
}

// ---------- public API ----------

export function formatReference(w: Work, style: Style): Segment[] {
  switch (style) {
    case "apa": return apa(w);
    case "mla": return mla(w);
    case "chicago": return chicago(w);
    case "harvard": return harvard(w);
    case "ieee": return ieee(w);
    case "vancouver": return vancouver(w);
    case "gbt": return gbt(w);
  }
}

/** The in-text citation (or note) for a source; numbered styles use its position in the list (1-based). */
export function formatInText(w: Work, style: Style, n = 1): Segment[] {
  switch (style) {
    case "apa": {
      // With no author APA uses the title: quoted for articles and chapters, italic for books and web pages.
      if (!w.authors.length && (w.type === "book" || w.type === "webpage")) return [seg("("), seg(w.title, true), seg(`, ${w.year || "n.d."})`)];
      return [seg(apaInText(w))];
    }
    case "mla": {
      // With no author MLA uses the title: quoted for articles and chapters, italic for books and web pages.
      if (!w.authors.length && (w.type === "book" || w.type === "webpage")) {
        const page = w.pages ? ` ${w.pages.split(/[-–—]/)[0]!.trim()}` : "";
        return [seg("("), seg(w.title, true), seg(`${page})`)];
      }
      return [seg(mlaInText(w))];
    }
    case "chicago": return chicagoNote(w);
    case "harvard": return [seg(harvardInText(w))];
    case "ieee": return [seg(`[${n}]`)];
    case "vancouver": return [seg(`(${n})`)];
    case "gbt": return [seg(`[${n}]`)];
  }
}

/** Numbered styles list sources in citation order; the others alphabetically by their reference text. */
export const NUMBERED: ReadonlySet<Style> = new Set<Style>(["ieee", "vancouver", "gbt"]);

/** The list in the style's order with each reference formatted once (numbered styles keep citation order). */
export function sortedEntries(works: readonly Work[], style: Style): { w: Work; segs: Segment[] }[] {
  const entries = works.map((w) => ({ w, segs: formatReference(w, style) }));
  if (NUMBERED.has(style)) return entries;
  const keyed = entries.map((e) => ({ e, k: plainText(e.segs).toLocaleLowerCase("en").replace(/^["'“‘]/, "") }));
  return keyed.sort((a, b) => a.k.localeCompare(b.k, "en")).map((x) => x.e);
}


/** Whether a source has enough to cite: a title, plus a container for articles and chapters. */
export function isComplete(w: Work): boolean {
  if (!w.title.trim()) return false;
  if ((w.type === "article" || w.type === "chapter") && !w.container.trim()) return false;
  return true;
}

// ---------- BibTeX ----------

const BIB_TYPE: Record<string, SourceType> = { article: "article", book: "book", phdthesis: "book", mastersthesis: "book", thesis: "book", techreport: "book", report: "book", manual: "book", booklet: "book", unpublished: "book", inbook: "chapter", incollection: "chapter", inproceedings: "chapter", conference: "chapter", online: "webpage", misc: "webpage", webpage: "webpage", electronic: "webpage" };

/** Reads the value after "key =": {balanced braces}, "quotes" or a bare word/number. */
function readBibValue(s: string, i: number): { value: string; end: number } {
  while (/\s/.test(s[i] ?? "")) i++;
  const open = s[i];
  if (open === "{") {
    let depth = 0;
    let j = i;
    for (; j < s.length; j++) {
      if (s[j] === "{") depth++;
      else if (s[j] === "}" && --depth === 0) break;
    }
    return { value: s.slice(i + 1, j), end: j + 1 };
  }
  if (open === '"') {
    let j = i + 1;
    let depth = 0;
    for (; j < s.length; j++) {
      if (s[j] === "{") depth++;
      else if (s[j] === "}") depth--;
      else if (s[j] === '"' && depth === 0 && s[j - 1] !== "\\") break;
    }
    return { value: s.slice(i + 1, j), end: j + 1 };
  }
  const m = /^[^,})\s]+/.exec(s.slice(i));
  return { value: m ? m[0] : "", end: i + (m ? m[0].length : 0) };
}

/** LaTeX accent commands as Unicode combining marks: \'e, \v{c}, \H{o}, \={a}, \k{a} … become é, č, ő, ā, ą. */
const LATEX_MARKS: Record<string, string> = {
  "'": "\u0301", "`": "\u0300", '"': "\u0308", "^": "\u0302", "~": "\u0303", "=": "\u0304", ".": "\u0307",
  v: "\u030C", u: "\u0306", H: "\u030B", c: "\u0327", k: "\u0328", r: "\u030A", d: "\u0323", b: "\u0331",
};
/** An accent over a dotless \i or \j sits on the ordinary letter (\"{\i} → ï). */
const dotted = (ch: string) => (ch === "ı" ? "i" : ch === "ȷ" ? "j" : ch);
/** Commands that stand for a letter: S{\o}ren, {\L}ódź, \aa, \ae, \oe, \ss, dotless \i. */
const LATEX_LETTERS: Record<string, string> = {
  o: "ø", O: "Ø", aa: "å", AA: "Å", l: "ł", L: "Ł", ae: "æ", AE: "Æ", oe: "œ", OE: "Œ", ss: "ß", i: "ı", j: "ȷ",
};

/** Plain text from a BibTeX value: accents like {\"o} or \'e, protective braces and \& dropped. */
export function delatex(s: string): string {
  // Escaped braces and backslashes are text, not grouping: hold them aside while the grouping braces are dropped.
  const LB = "\uE000";
  const RB = "\uE001";
  const BS = "\uE002";
  return s
    .replace(/\\textbackslash\{\}/g, BS)
    .replace(/\\textasciitilde\{\}/g, "\uE003")
    .replace(/\\textasciicircum\{\}/g, "^")
    // A bare ~ is BibTeX's non-breaking space.
    .replace(/(?<!\\)~/g, " ")
    .replace(/\\\{/g, LB)
    .replace(/\\\}/g, RB)
    // Letter commands first (\L\'od: the \L must not swallow the accented o), then symbol accents (\'e, \'{e},
    // {\'e}, \'{\i}) and letter accents (\v{c}, \v c, \H{o}). Only spaces inside the braces are dropped, never the
    // one after: "Ren\'e Descartes" keeps its space.
    .replace(/\\(aa|AA|ae|AE|oe|OE|ss|[oOlLij])(?![a-zA-Z])\s?(\{\})?/g, (_m, l: string) => LATEX_LETTERS[l] ?? l)
    .replace(/\{?\\([`'"^~=.])(?:\{\s*\\?([A-Za-zıȷ])\s*\}|\s*\\?([A-Za-zıȷ]))\}?/g, (_m, acc: string, a1?: string, a2?: string) => dotted(a1 ?? a2 ?? "") + LATEX_MARKS[acc]!)
    .replace(/\{?\\([vuHckrdb])(?:\s*\{\s*\\?([A-Za-zıȷ])\s*\}|\s+\\?([A-Za-zıȷ]))\}?/g, (_m, acc: string, a1?: string, a2?: string) => dotted(a1 ?? a2 ?? "") + LATEX_MARKS[acc]!)
    // Common text commands, then any other command name (\emph{x} keeps x; braces go below).
    .replace(/\\textendash\b\s*(\{\})?/g, "–")
    .replace(/\\textemdash\b\s*(\{\})?/g, "—")
    .replace(/\\(ldots|dots)\b\s*(\{\})?/g, "…")
    .replace(/\\textquoteright\b\s*(\{\})?/g, "’")
    .replace(/\\([a-zA-Z]+)\*?\s*(?=\{)/g, "")
    .replace(/\\([a-zA-Z]+)\b\s?/g, "")
    .replace(/\\([&%$#_])/g, "$1")
    .replace(/---/g, "—")
    .replace(/--/g, "–")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .replace(new RegExp(LB, "g"), "{")
    .replace(new RegExp(RB, "g"), "}")
    .replace(new RegExp(BS, "g"), "\\")
    .replace(/\uE003/g, "~")
    .normalize("NFC")
    .trim();
}

/** Whether "{…}" is one brace group (its first brace closes only at the very end). */
function singleGroup(t: string): boolean {
  let depth = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "{") depth++;
    else if (t[i] === "}" && --depth === 0 && i < t.length - 1) return false;
  }
  return true;
}

/** Splits on a separator outside braces (commas, or spaces between name tokens). */
function splitTop(s: string, sep: RegExp): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    if (depth === 0 && sep.test(ch)) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

/**
 * One BibTeX name, read before braces are dropped so they still protect: "{World Health Organization}" is a group,
 * "Charles {de Gaulle}" has the family name "de Gaulle", "King, Jr., Martin Luther" is Last, Jr, First.
 */
function bibPerson(t: string): Person | null {
  if (!t) return null;
  if (/^\{.*\}$/.test(t) && singleGroup(t)) return { literal: delatex(t) };
  const commas = splitTop(t, /,/);
  if (commas.length >= 3) return { family: delatex(commas[0]!), given: delatex(commas.slice(2).join(", ")), suffix: delatex(commas[1]!) };
  if (commas.length === 2) return { family: delatex(commas[0]!), given: delatex(commas[1]!) };
  const words = splitTop(t, /\s/);
  if (words.length === 1) return { literal: delatex(words[0]!) };
  return splitGivenFamily(words.map(delatex));
}

function bibPeople(value: string): Person[] {
  // Split on " and " only outside braces: {Food and Agriculture Organization} is one group author.
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (depth === 0 && /\s/.test(ch!)) {
      const m = /^\s+and\s+/i.exec(value.slice(i));
      if (m) { parts.push(value.slice(start, i)); i += m[0].length - 1; start = i + 1; }
    }
  }
  parts.push(value.slice(start));
  return parts.map((raw) => bibPerson(raw.trim())).filter((p): p is Person => p !== null && (!("literal" in p) || p.literal !== "others"));
}

const EDITION_WORDS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
/** "2nd", "2nd ed.", "Second", "second edition" → "2"; a first edition → ""; anything else is kept as typed. */
export function editionNumber(v: string): string {
  const t = v.trim().toLowerCase().replace(/\s*(edn?\.?|edition)$/, "").trim();
  // A first edition is not cited: "1", "1st", "First" → "".
  const word = EDITION_WORDS.indexOf(t);
  if (word >= 0) return word === 0 ? "" : String(word + 1);
  const m = /^(\d+)(st|nd|rd|th)?$/.exec(t);
  // A word edition keeps its word without "edition" ("Revised edition" → "Revised"): each style adds its own "ed.".
  return m ? (m[1] === "1" ? "" : m[1]!) : v.trim().replace(/\s*(edn?\.?|edition)$/i, "");
}

const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
function monthOf(v: string): number {
  const n = Number(v);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return n;
  const i = MONTH_KEYS.indexOf(v.trim().slice(0, 3).toLowerCase());
  return i >= 0 ? i + 1 : 0;
}

/**
 * A field value: one or more parts joined by # ({braced}, "quoted", a number, or an @string macro name), concatenated.
 * Month macros (jan … dec) stay as their abbreviation for monthOf.
 */
function readBibField(s: string, i: number, macros: Record<string, string>): { value: string; end: number } {
  let value = "";
  for (;;) {
    const part = readBibValue(s, i);
    const bare = !/^\s*["{]/.test(s.slice(i));
    value += bare ? macros[part.value.toLowerCase()] ?? part.value : part.value;
    i = part.end;
    const hash = /^\s*#/.exec(s.slice(i));
    if (!hash) return { value, end: i };
    i += hash[0].length;
  }
}

/** Every @entry in a BibTeX text (comments and @preamble are skipped; @string macros are read and used). */
export function parseBibtex(text: string): Work[] {
  const works: Work[] = [];
  const macros: Record<string, string> = {};
  text = text.replace(/^\uFEFF/, "");
  const re = /@(\w+)\s*[{(]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const kind = m[1]!.toLowerCase();
    if (kind === "comment" || kind === "preamble") {
      // Skip the whole body: an @entry written inside a comment is not an entry. Only the delimiter that opened it
      // counts, so a lone "(" inside @comment{…} does not swallow the rest of the file.
      const open = m[0].trim().slice(-1);
      const close = open === "{" ? "}" : ")";
      let depth = 1;
      let j = m.index + m[0].length;
      for (; j < text.length && depth > 0; j++) {
        if (text[j] === open) depth++;
        else if (text[j] === close) depth--;
      }
      re.lastIndex = j;
      continue;
    }
    if (kind === "string") {
      const sm = /^\s*([\w-]+)\s*=/.exec(text.slice(m.index + m[0].length));
      if (sm) {
        const { value, end } = readBibField(text, m.index + m[0].length + sm[0].length, macros);
        macros[sm[1]!.toLowerCase()] = value;
        re.lastIndex = end;
      }
      continue;
    }
    let i = m.index + m[0].length;
    // Skip the citation key: up to its comma, unless the entry closes first (an entry with no fields).
    const keyEnd = /[,})]/.exec(text.slice(i));
    if (!keyEnd) break;
    if (keyEnd[0] !== ",") { re.lastIndex = i + keyEnd.index + 1; continue; }
    i = i + keyEnd.index + 1;
    const fields: Record<string, string> = {};
    while (i < text.length) {
      const km = /^\s*([\w-]+)\s*=/.exec(text.slice(i));
      if (!km) break;
      const { value, end } = readBibField(text, i + km[0].length, macros);
      fields[km[1]!.toLowerCase()] = value;
      i = end;
      const next = /^\s*,?/.exec(text.slice(i));
      i += next ? next[0].length : 0;
      if (/^\s*[})]/.test(text.slice(i))) break;
    }
    re.lastIndex = i;
    // Unknown kinds become an article when they name a journal, otherwise a book (publisher-style fields).
    const type = BIB_TYPE[kind] ?? (fields.journal || fields.journaltitle ? "article" : "book");
    const w = emptyWork(type);
    w.authors = fields.author ? bibPeople(fields.author) : [];
    w.editors = fields.editor ? bibPeople(fields.editor) : [];
    w.title = delatex(fields.title ?? "");
    w.container = delatex(fields.journal ?? fields.journaltitle ?? fields.booktitle ?? fields.howpublished ?? fields.organization ?? "");
    // Classic @inbook: `title` is the book and `chapter` the chapter (its title, or just a number: then cite the book).
    if (kind === "inbook" && !fields.booktitle) {
      const chapter = delatex(fields.chapter ?? "");
      if (chapter && !/^\d+$/.test(chapter)) { w.container = w.title; w.title = chapter; }
      else w.type = "book";
    }
    const date = fields.date ?? "";
    w.year = delatex(fields.year ?? date.slice(0, 4));
    w.month = monthOf(fields.month ?? date.slice(5, 7));
    const day = Number(date.slice(8, 10));
    w.day = w.month && day >= 1 && day <= 31 ? day : 0;
    w.volume = delatex(fields.volume ?? "");
    w.issue = delatex(fields.number ?? fields.issue ?? "");
    w.pages = delatex(fields.pages ?? "");
    w.edition = editionNumber(delatex(fields.edition ?? ""));
    w.publisher = delatex(fields.publisher ?? fields.institution ?? fields.school ?? "");
    w.place = delatex(fields.address ?? fields.location ?? "");
    // Links are taken literally (only braces and \url{} removed): "--" in a URL is two hyphens, not a dash.
    const literal = (v: string | undefined) => (v ?? "").replace(/\\url/g, "").replace(/[{}]/g, "").trim();
    w.doi = cleanDoi(literal(fields.doi));
    w.url = literal(fields.url);
    w.accessed = normDate(delatex(fields.urldate ?? ""));
    // A book with editors and no authors is an edited volume: the editors lead it.
    if (w.type === "book" && !w.authors.length && w.editors.length) { w.authors = w.editors; w.editors = []; w.edited = true; }
    works.push(w);
  }
  return works;
}

const BIB_OUT: Record<SourceType, string> = { article: "article", book: "book", chapter: "incollection", webpage: "online" };

function bibKey(w: Work, used: Set<string>): string {
  const fam = w.authors[0] ? familyOf(w.authors[0]) : w.title;
  const base = `${fam.normalize("NFD").replace(/[^A-Za-z]/g, "").toLowerCase() || "ref"}${w.year.replace(/\D/g, "")}`;
  let key = base;
  // a–z first, then numbers: a key must stay letters and digits (ref2020{ would break the file).
  for (let n = 0; used.has(key); n++) key = `${base}${n < 26 ? String.fromCharCode(97 + n) : String(n - 24)}`;
  used.add(key);
  return key;
}

/** Escapes a value so the braces around it stay balanced: a stray { } or \ would swallow the rest of the file. */
const BIB_SPECIAL: Record<string, string> = { "\\": "\\textbackslash{}", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}" };
const bibEsc = (s: string) => s.replace(/[\\{}&%$#_~^]/g, (ch) => BIB_SPECIAL[ch] ?? `\\${ch}`);
/** A name for the author/editor field, already escaped: a group author keeps its protective braces. */
const bibName = (p: Person) => (isLiteral(p) ? `{${bibEsc(p.literal)}}` : p.suffix ? `${bibEsc(p.family)}, ${bibEsc(p.suffix)}, ${bibEsc(p.given)}` : `${bibEsc(p.family)}, ${bibEsc(p.given)}`);

export function toBibtex(works: readonly Work[]): string {
  const used = new Set<string>();
  return works.map((w) => {
    const f: [string, string][] = [];
    if (w.authors.length) f.push([isEdited(w) ? "editor" : "author", w.authors.map(bibName).join(" and ")]);
    if (w.editors.length) f.push(["editor", w.editors.map(bibName).join(" and ")]);
    f.push(["title", w.title]);
    if (w.container) f.push([w.type === "article" ? "journal" : w.type === "chapter" ? "booktitle" : "howpublished", w.container]);
    if (w.year) f.push(["year", w.year]);
    if (w.month) f.push(["month", MONTH_KEYS[w.month - 1]!]);
    // BibLaTeX's date keeps the day (web pages); classic BibTeX tools ignore the field.
    if (w.year && w.month && w.day) f.push(["date", `${w.year}-${pad(w.month)}-${pad(w.day)}`]);
    for (const [k, v] of [["volume", w.volume], ["number", w.issue], ["pages", w.pages.replace(/[–—]/g, "--").replace(/(\d)-(\d)/g, "$1--$2")], ["edition", w.edition], ["publisher", w.publisher], ["address", w.place], ["doi", cleanDoi(w.doi)], ["url", w.url], ["urldate", w.accessed]] as const) {
      if (v) f.push([k, v]);
    }
    // Names are escaped part by part in bibName; links are written as they are.
    const raw = new Set(["url", "doi", "author", "editor"]);
    // The month is a bare macro (month = may) so BibTeX styles print the month name, not the word in braces.
    const body = f.map(([k, v]) => (k === "month" ? `  month = ${v}` : `  ${k} = {${raw.has(k) ? v : bibEsc(v)}}`)).join(",\n");
    return `@${BIB_OUT[w.type]}{${bibKey(w, used)},\n${body}\n}`;
  }).join("\n\n");
}

// ---------- RIS ----------

const RIS_TYPE: Record<string, SourceType> = { EDBOOK: "book", THES: "book", RPRT: "book", GEN: "book", MANSCPT: "book", UNPB: "book", STAND: "book", REPORT: "book", JOUR: "article", JFULL: "article", MGZN: "article", NEWS: "article", EJOUR: "article", BOOK: "book", EBOOK: "book", CHAP: "chapter", ECHAP: "chapter", CONF: "chapter", CPAPER: "chapter", ELEC: "webpage", WEB: "webpage", BLOG: "webpage" };

const risPerson = (v: string): Person | null => (v.trim() ? (v.includes(",") || /^\{.*\}$/.test(v.trim()) ? parsePerson(v) : { literal: v.trim() }) : null);

export function parseRis(text: string): Work[] {
  const works: Work[] = [];
  text = text.replace(/^\uFEFF/, "");
  let w: Work | null = null;
  let sp = "";
  let ep = "";
  let unknownType = false;
  /** Finishes a record: settles an unknown type, promotes the editors of an edited book, joins the page range. */
  const settle = (r: Work): Work => {
    if (unknownType && !r.container) r.type = "book";
    if (r.type === "book" && !r.authors.length && r.editors.length) { r.authors = r.editors; r.editors = []; r.edited = true; }
    if (r.type !== "chapter") r.editors = [];
    r.pages = sp && ep ? `${sp}–${ep}` : sp;
    sp = ep = "";
    return r;
  };
  for (const line of text.replace(/\r/g, "").split("\n")) {
    const m = /^([A-Z][A-Z0-9])  - ?(.*)$/.exec(line);
    if (!m) continue;
    const [, tag, raw] = m;
    const v = raw!.trim();
    if (tag === "TY") {
      // A record that never got its ER line is still kept.
      if (w) works.push(settle(w));
      // Unknown kinds are settled at the end: an article when a journal was named, otherwise a book.
      w = emptyWork(RIS_TYPE[v] ?? "article");
      unknownType = !(v in RIS_TYPE);
      continue;
    }
    if (!w) continue;
    switch (tag) {
      // RIS writes people as "Family, Given": a name with no comma is a group author (an organization).
      case "AU": case "A1": { const p = risPerson(v); if (p) w.authors.push(p); break; }
      // Kept for every type: an unknown one is only settled at ER (an EDBOOK may become a book).
      case "ED": case "A2": { const p = risPerson(v); if (p) w.editors.push(p); break; }
      case "TI": case "T1": w.title = v; break;
      case "T2": case "JO": case "JF": case "BT": if (!w.container || tag === "T2") w.container = v; break;
      case "PY": case "Y1": case "DA": {
        const d = /^(\d{4})(?:\/(\d{1,2})?(?:\/(\d{1,2}))?)?/.exec(v);
        if (d) {
          w.year ||= d[1]!;
          // Out-of-range parts (2015/13/40) are dropped, not printed as "undefined 40".
          const mo = Number(d[2] ?? 0);
          const da = Number(d[3] ?? 0);
          if (mo >= 1 && mo <= 12) w.month ||= mo;
          if (da >= 1 && da <= 31 && mo >= 1 && mo <= 12) w.day ||= da;
        }
        break;
      }
      case "VL": w.volume = v; break;
      case "IS": w.issue = v; break;
      case "SP": sp = v; break;
      case "EP": ep = v; break;
      case "ET": w.edition = editionNumber(v); break;
      case "PB": w.publisher = v; break;
      case "CY": w.place = v; break;
      case "DO": w.doi = cleanDoi(v); break;
      case "UR": w.url ||= v; break;
      case "Y2": w.accessed = normDate(v.replace(/\/$/, "")); break;
      case "ER": {
        works.push(settle(w));
        w = null;
        break;
      }
    }
  }
  if (w) works.push(settle(w));
  return works;
}

/** RIS writes "Family, Given, Suffix"; a group author with a comma keeps braces so it is not read back as a person. */
const risName = (p: Person) => (isLiteral(p) ? (p.literal.includes(",") ? `{${p.literal}}` : p.literal) : `${p.family}, ${p.given}${p.suffix ? `, ${p.suffix}` : ""}`);

const RIS_OUT: Record<SourceType, string> = { article: "JOUR", book: "BOOK", chapter: "CHAP", webpage: "ELEC" };

export function toRis(works: readonly Work[]): string {
  return works.map((w) => {
    const lines = [`TY  - ${RIS_OUT[w.type]}`];
    for (const p of w.authors) lines.push(`${isEdited(w) ? "ED" : "AU"}  - ${risName(p)}`);
    for (const p of w.editors) lines.push(`ED  - ${risName(p)}`);
    lines.push(`TI  - ${w.title}`);
    if (w.container) lines.push(`T2  - ${w.container}`);
    if (w.year) lines.push(`PY  - ${w.year}`);
    if (w.year && w.month) lines.push(`DA  - ${w.year}/${pad(w.month)}${w.day ? `/${pad(w.day)}` : ""}`);
    if (w.volume) lines.push(`VL  - ${w.volume}`);
    if (w.issue) lines.push(`IS  - ${w.issue}`);
    if (w.pages) {
      const [a, b] = w.pages.split(/\s*[-–—]+\s*/);
      lines.push(`SP  - ${a}`);
      if (b) lines.push(`EP  - ${b}`);
    }
    if (w.edition) lines.push(`ET  - ${w.edition}`);
    if (w.publisher) lines.push(`PB  - ${w.publisher}`);
    if (w.place) lines.push(`CY  - ${w.place}`);
    if (w.doi) lines.push(`DO  - ${cleanDoi(w.doi)}`);
    if (w.url) lines.push(`UR  - ${w.url}`);
    if (w.accessed) lines.push(`Y2  - ${w.accessed.replace(/-/g, "/")}`);
    lines.push("ER  - ");
    return lines.join("\n");
  }).join("\n\n");
}

/** BibTeX or RIS, whichever the text looks like. */
export function parseImport(text: string): Work[] {
  text = text.replace(/^\uFEFF/, "");
  if (/^\s*TY  - /m.test(text)) return parseRis(text);
  return parseBibtex(text);
}

// ---------- lookups (records from Crossref and Open Library) ----------

/** What the lookup box holds: a DOI (10.x/…, or a doi.org link) or an ISBN (10 or 13 digits). */
export function classifyLookup(raw: string): { kind: "doi"; value: string } | { kind: "isbn"; value: string } | null {
  const s = raw.trim();
  // A DOI copied from the end of a sentence or reference brings its full stop or bracket along: drop it.
  const doi = cleanDoi(s).replace(/[.,;:)\]}>]+$/, "");
  if (/^10\.\d{4,9}\/\S+$/.test(doi)) return { kind: "doi", value: doi };
  // "ISBN-13: 978-…" / "ISBN 0-306-…": drop the label first, then spaces and hyphens.
  const digits = s.replace(/^isbn(-?1[03])?\s*:?\s*/i, "").replace(/[\s-]/g, "");
  if (/^\d{9}[\dXx]$/.test(digits) && isbn10Ok(digits)) return { kind: "isbn", value: digits.toUpperCase() };
  if (/^97[89]\d{10}$/.test(digits) && isbn13Ok(digits)) return { kind: "isbn", value: digits };
  return null;
}

function isbn10Ok(d: string): boolean {
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += (10 - i) * (d[i] === "X" || d[i] === "x" ? 10 : Number(d[i]));
  return sum % 11 === 0;
}

function isbn13Ok(d: string): boolean {
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(d[i]) * (i % 2 ? 3 : 1);
  return sum % 10 === 0;
}

/** The request URL for a lookup (GET only; the DOI or ISBN is the only thing sent). */
export function lookupUrl(q: { kind: "doi" | "isbn"; value: string }): string {
  return q.kind === "doi"
    ? `https://api.crossref.org/works/${encodeURIComponent(q.value)}`
    : `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(q.value)}&format=json&jscmd=data`;
}

type CrossrefPerson = { family?: string; given?: string; name?: string };
type CrossrefWork = {
  type?: string;
  title?: string[];
  subtitle?: string[];
  "container-title"?: string[];
  author?: CrossrefPerson[];
  editor?: CrossrefPerson[];
  issued?: { "date-parts"?: number[][] };
  published?: { "date-parts"?: number[][] };
  volume?: string;
  issue?: string;
  page?: string;
  publisher?: string;
  "publisher-location"?: string;
  institution?: { name?: string }[];
  "group-title"?: string;
  "edition-number"?: string;
  DOI?: string;
  URL?: string;
};

const CROSSREF_TYPE: Record<string, SourceType> = { "journal-article": "article", "proceedings-article": "chapter", "book-chapter": "chapter", "book-section": "chapter", book: "book", monograph: "book", "edited-book": "book", "reference-book": "book", "posted-content": "article", dissertation: "book", report: "book", standard: "book", dataset: "book" };

/** Crossref titles may carry JATS markup such as <i> or <sub>: kept as plain text. */
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const stripTags = (s: string) => s
  .replace(/<[^>]+>/g, "")
  // Crossref titles carry HTML entities too ("Business &amp; Economics"); html() escapes the plain text again.
  .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] !== "#") return ENTITIES[e.toLowerCase()] ?? m;
    const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1));
    // An out-of-range entity is left as written rather than failing the whole lookup.
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
  })
  .replace(/\s+/g, " ")
  .trim();

function crossrefPerson(p: CrossrefPerson): Person | null {
  if (p.family) return p.given ? { family: p.family, given: p.given } : { literal: p.family };
  return p.name ? { literal: p.name } : null;
}

export function fromCrossref(json: unknown): Work | null {
  const m = (json as { message?: CrossrefWork } | null)?.message;
  if (!m || !m.title?.length) return null;
  // Types the tool has no form for are read as an article when they name a container, otherwise as a book.
  const w = emptyWork(CROSSREF_TYPE[m.type ?? ""] ?? (m["container-title"]?.length ? "article" : "book"));
  const sub = m.subtitle?.[0] ? stripTags(m.subtitle[0]) : "";
  w.title = stripTags(m.title[0]!) + (sub ? `: ${sub}` : "");
  // A chapter's container titles may list the series first ("Lecture Notes in Computer Science", "ECCV 2016"): the book
  // is the last one. A preprint names its server as the institution or group title instead.
  const ct = m["container-title"] ?? [];
  w.container = stripTags((w.type === "chapter" ? ct[ct.length - 1] : ct[0]) ?? m.institution?.[0]?.name ?? m["group-title"] ?? "");
  // A chapter or proceedings paper with no book title cannot be completed as a chapter: cite it as a book.
  if (w.type === "chapter" && !w.container) w.type = "book";
  w.authors = (m.author ?? []).map(crossrefPerson).filter((p): p is Person => p !== null);
  w.editors = (m.editor ?? []).map(crossrefPerson).filter((p): p is Person => p !== null);
  // An edited book has editors and no authors; the book form has no editor field, so they lead the entry instead.
  if (w.type === "book" && !w.authors.length && w.editors.length) { w.authors = w.editors; w.editors = []; w.edited = true; }
  const parts = m.issued?.["date-parts"]?.[0] ?? m.published?.["date-parts"]?.[0] ?? [];
  w.year = parts[0] ? String(parts[0]) : "";
  w.month = parts[1] ?? 0;
  w.day = parts[2] ?? 0;
  w.volume = m.volume ?? "";
  w.issue = m.issue ?? "";
  w.pages = (m.page ?? "").replace(/-/g, "–");
  w.publisher = w.type === "article" ? "" : m.publisher ?? m.institution?.[0]?.name ?? "";
  w.place = w.type === "article" ? "" : m["publisher-location"] ?? "";
  w.edition = editionNumber(m["edition-number"] ?? "");
  w.doi = cleanDoi(m.DOI ?? "");
  return w;
}

type DataCiteRecord = {
  data?: {
    attributes?: {
      doi?: string;
      url?: string;
      titles?: { title?: string; titleType?: string }[];
      creators?: { name?: string; nameType?: string; givenName?: string; familyName?: string }[];
      publisher?: string | { name?: string };
      publicationYear?: number | string;
      types?: { resourceTypeGeneral?: string };
      container?: { title?: string; volume?: string; issue?: string; firstPage?: string; lastPage?: string };
    };
  };
};

const DATACITE_TYPE: Record<string, SourceType> = { JournalArticle: "article", Preprint: "article", Book: "book", BookChapter: "chapter", ConferencePaper: "chapter", Dissertation: "book", Report: "book" };

/**
 * A DataCite record (arXiv, Zenodo, Figshare, datasets: DOIs Crossref does not hold). Preprints name their server
 * (arXiv) as the container; types with no form of their own (datasets, software) become web pages with their link.
 */
export function fromDataCite(json: unknown): Work | null {
  const a = (json as DataCiteRecord | null)?.data?.attributes;
  const title = a?.titles?.find((t) => !t.titleType)?.title ?? a?.titles?.[0]?.title;
  if (!a || !title) return null;
  const w = emptyWork(DATACITE_TYPE[a.types?.resourceTypeGeneral ?? ""] ?? "webpage");
  const publisher = typeof a.publisher === "string" ? a.publisher : a.publisher?.name ?? "";
  w.title = stripTags(title);
  w.authors = (a.creators ?? []).map((c) => (c.familyName ? (c.givenName ? { family: c.familyName, given: c.givenName } : { literal: c.familyName }) : c.name ? (c.nameType === "Personal" ? parsePerson(c.name) : { literal: c.name }) : null)).filter((p): p is Person => p !== null);
  w.year = a.publicationYear ? String(a.publicationYear) : "";
  w.container = a.container?.title ?? (w.type === "article" || w.type === "webpage" ? publisher : "");
  w.volume = a.container?.volume ?? "";
  w.issue = a.container?.issue ?? "";
  w.pages = a.container?.firstPage ? `${a.container.firstPage}${a.container.lastPage ? `–${a.container.lastPage}` : ""}` : "";
  // A chapter DataCite gives no book title for cannot be completed as a chapter: cite it as a book instead.
  if (w.type === "chapter" && !w.container) w.type = "book";
  if (w.type === "book" || w.type === "chapter") w.publisher = publisher;
  w.doi = cleanDoi(a.doi ?? "");
  if (w.type === "webpage") w.url = a.url ?? "";
  return w;
}

/** The DataCite lookup for a DOI Crossref does not know (GET only; the DOI is the only thing sent). */
export function dataciteUrl(doi: string): string {
  return `https://api.datacite.org/dois/${encodeURIComponent(doi)}`;
}

type OpenLibraryBook = {
  title?: string;
  subtitle?: string;
  authors?: { name?: string }[];
  publishers?: { name?: string }[];
  publish_places?: { name?: string }[];
  publish_date?: string;
  url?: string;
};

export function fromOpenLibrary(json: unknown, isbn: string): Work | null {
  const rec = (json as Record<string, OpenLibraryBook> | null)?.[`ISBN:${isbn}`];
  if (!rec?.title) return null;
  const w = emptyWork("book");
  w.title = rec.subtitle ? `${rec.title}: ${rec.subtitle}` : rec.title;
  w.authors = (rec.authors ?? []).map((a) => (a.name ? parsePerson(a.name) : null)).filter((p): p is Person => p !== null);
  w.publisher = rec.publishers?.[0]?.name ?? "";
  w.place = rec.publish_places?.[0]?.name ?? "";
  w.year = /\b(1[5-9]\d\d|20\d\d)\b/.exec(rec.publish_date ?? "")?.[1] ?? "";
  return w;
}
