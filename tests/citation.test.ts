import { describe, expect, it } from "vitest";
import {
  STYLES, classifyLookup, cleanDoi, dataciteUrl, delatex, fromDataCite, emptyWork, formatInText, formatReference, fromCrossref, fromOpenLibrary, html,
  editionNumber, lookupUrl, normDate, parseBibtex, personToText, parseImport, parsePeople, parsePerson, parseRis, plainText, sortedEntries, toBibtex, toRis, type Work,
} from "../src/shared/citation";

const art: Work = { ...emptyWork("article"), authors: parsePeople("LeCun, Yann\nYoshua Bengio\nHinton, Geoffrey"), title: "Deep learning", container: "Nature", year: "2015", month: 5, day: 27, volume: "521", issue: "7553", pages: "436-444", doi: "https://doi.org/10.1038/nature14539" };
const book: Work = { ...emptyWork("book"), authors: parsePeople("Kahneman, Daniel"), title: "Thinking, fast and slow", year: "2011", publisher: "Farrar, Straus and Giroux", place: "New York", edition: "2" };
const chap: Work = { ...emptyWork("chapter"), authors: parsePeople("Smith, Jane A."), editors: parsePeople("Lee, Kim\nPark, Min-Jun"), title: "Why does it matter?", container: "Handbook of examples", year: "2020", pages: "10-25", publisher: "Example Press", place: "London" };
const web: Work = { ...emptyWork("webpage"), authors: parsePeople("{World Health Organization}"), title: "Malaria", container: "WHO", year: "2023", month: 12, day: 4, url: "https://www.who.int/news-room/fact-sheets/detail/malaria", accessed: "2026-11-18" };

/** Each style's reference and in-text citation for the article, book, chapter and web page (checked by hand against the style guides). */
const EXPECTED: Record<string, string[]> = {
  "apa": [
    "LeCun, Y., Bengio, Y., &amp; Hinton, G. (2015). Deep learning. <i>Nature</i>, <i>521</i>(7553), 436–444. https://doi.org/10.1038/nature14539",
    "(LeCun et al., 2015)",
    "Kahneman, D. (2011). <i>Thinking, fast and slow</i> (2nd ed.). Farrar, Straus and Giroux.",
    "(Kahneman, 2011)",
    "Smith, J. A. (2020). Why does it matter? In K. Lee &amp; M.-J. Park (Eds.), <i>Handbook of examples</i> (pp. 10–25). Example Press.",
    "(Smith, 2020)",
    "World Health Organization. (2023, December 4). <i>Malaria</i>. WHO. https://www.who.int/news-room/fact-sheets/detail/malaria",
    "(World Health Organization, 2023)"
  ],
  "mla": [
    "LeCun, Yann, et al. \"Deep learning.\" <i>Nature</i>, vol. 521, no. 7553, 27 May 2015, pp. 436-44, https://doi.org/10.1038/nature14539.",
    "(LeCun et al. 436)",
    "Kahneman, Daniel. <i>Thinking, fast and slow</i>. 2nd ed., Farrar, Straus and Giroux, 2011.",
    "(Kahneman)",
    "Smith, Jane A. \"Why does it matter?\" <i>Handbook of examples</i>, edited by Kim Lee and Min-Jun Park, Example Press, 2020, pp. 10-25.",
    "(Smith 10)",
    "World Health Organization. \"Malaria.\" <i>WHO</i>, 4 Dec. 2023, www.who.int/news-room/fact-sheets/detail/malaria.",
    "(World Health Organization)"
  ],
  "chicago": [
    "LeCun, Yann, Yoshua Bengio, and Geoffrey Hinton. \"Deep learning.\" <i>Nature</i> 521, no. 7553 (2015): 436–444. https://doi.org/10.1038/nature14539.",
    "LeCun, Bengio, and Hinton, \"Deep learning.\"",
    "Kahneman, Daniel. <i>Thinking, fast and slow</i>. 2nd ed. New York: Farrar, Straus and Giroux, 2011.",
    "Kahneman, <i>Thinking, fast and slow</i>.",
    "Smith, Jane A. \"Why does it matter?\" In <i>Handbook of examples</i>, edited by Kim Lee and Min-Jun Park, 10–25. London: Example Press, 2020.",
    "Smith, \"Why does it matter?\"",
    "World Health Organization. \"Malaria.\" WHO, December 4, 2023. https://www.who.int/news-room/fact-sheets/detail/malaria.",
    "World Health Organization, \"Malaria.\""
  ],
  "harvard": [
    "LeCun, Y., Bengio, Y. and Hinton, G. (2015) 'Deep learning', <i>Nature</i>, 521(7553), pp. 436–444. Available at: https://doi.org/10.1038/nature14539.",
    "(LeCun, Bengio and Hinton, 2015)",
    "Kahneman, D. (2011) <i>Thinking, fast and slow</i>. 2nd edn. New York: Farrar, Straus and Giroux.",
    "(Kahneman, 2011)",
    "Smith, J.A. (2020) 'Why does it matter?', in Lee, K. and Park, M.-J. (eds) <i>Handbook of examples</i>. London: Example Press, pp. 10–25.",
    "(Smith, 2020)",
    "World Health Organization (2023) <i>Malaria</i>. Available at: https://www.who.int/news-room/fact-sheets/detail/malaria (Accessed: 18 November 2026).",
    "(World Health Organization, 2023)"
  ],
  "ieee": [
    "Y. LeCun, Y. Bengio, and G. Hinton, \"Deep learning,\" <i>Nature</i>, vol. 521, no. 7553, pp. 436–444, May 2015, doi: 10.1038/nature14539.",
    "[1]",
    "D. Kahneman, <i>Thinking, fast and slow</i>, 2nd ed. New York: Farrar, Straus and Giroux, 2011.",
    "[1]",
    "J. A. Smith, \"Why does it matter?\" in <i>Handbook of examples</i>, K. Lee and M.-J. Park, Eds. London: Example Press, 2020, pp. 10–25.",
    "[1]",
    "World Health Organization, \"Malaria,\" WHO. Accessed: Nov. 18, 2026. [Online]. Available: https://www.who.int/news-room/fact-sheets/detail/malaria",
    "[1]"
  ],
  "vancouver": [
    "LeCun Y, Bengio Y, Hinton G. Deep learning. Nature. 2015 May;521(7553):436-444. doi:10.1038/nature14539",
    "(1)",
    "Kahneman D. Thinking, fast and slow. 2nd ed. New York: Farrar, Straus and Giroux; 2011.",
    "(1)",
    "Smith JA. Why does it matter? In: Lee K, Park MJ, editors. Handbook of examples. London: Example Press; 2020. p. 10-25.",
    "(1)",
    "World Health Organization. Malaria [Internet]. WHO; 2023 [cited 2026 Nov 18]. Available from: https://www.who.int/news-room/fact-sheets/detail/malaria",
    "(1)"
  ],
  "gbt": [
    "LECUN Y, BENGIO Y, HINTON G. Deep learning[J]. Nature, 2015, 521(7553): 436-444. DOI:10.1038/nature14539.",
    "[1]",
    "KAHNEMAN D. Thinking, fast and slow[M]. 2nd ed. New York: Farrar, Straus and Giroux, 2011.",
    "[1]",
    "SMITH J A. Why does it matter?[M]//LEE K, PARK M J. Handbook of examples. London: Example Press, 2020: 10-25.",
    "[1]",
    "World Health Organization. Malaria[EB/OL]. (2023-12-04)[2026-11-18]. https://www.who.int/news-room/fact-sheets/detail/malaria.",
    "[1]"
  ]
};

describe("citation styles", () => {
  it.each(STYLES)("%s", (style) => {
    const got = [art, book, chap, web].flatMap((w) => [html(formatReference(w, style)), html(formatInText(w, style))]);
    expect(got).toEqual(EXPECTED[style]);
  });

  it("shortens MLA page ranges past 99 to the digits that change, never fewer than two (MLA 9's own examples)", () => {
    const pages = (p: string) => html(formatReference({ ...art, pages: p }, "mla")).match(/pp?\. [^,]+/)?.[0];
    expect(["436-444", "103-104", "395-401", "1003-1005", "1608-1774", "1099-1100", "923-1003", "96-101", "10-25", "200-200", "A12-A15", "436"].map(pages)).toEqual([
      "pp. 436-44", "pp. 103-04", "pp. 395-401", "pp. 1003-05", "pp. 1608-774", "pp. 1099-100", "pp. 923-1003", "pp. 96-101", "pp. 10-25", "pp. 200-200", "pp. A12-A15", "p. 436",
    ]);
    // Each range in a list is shortened on its own.
    expect(html(formatReference({ ...art, pages: "1-5, 103-104" }, "mla"))).toContain("pp. 1-5, 103-04,");
    // Other styles keep the full range.
    expect(html(formatReference(art, "apa"))).toContain("436–444");
  });

  it("handles many authors per style", () => {
    const many = (n: number): Work => ({ ...art, authors: Array.from({ length: n }, (_, i) => ({ family: `F${i + 1}`, given: "Ann" })) });
    expect(plainText(formatReference(many(21), "apa"))).toMatch(/^F1, A\., .*F19, A\., \. \. \. F21, A\. \(2015\)/);
    expect(plainText(formatReference(many(20), "apa"))).toContain("F19, A., & F20, A. (2015)");
    expect(plainText(formatReference(many(2), "apa"))).toMatch(/^F1, A\., & F2, A\. \(2015\)/);
    expect(plainText(formatReference(many(4), "harvard"))).toMatch(/^F1, A\. et al\. \(2015\)/);
    expect(plainText(formatReference(many(7), "ieee"))).toMatch(/^A\. F1 et al\., /);
    expect(plainText(formatReference(many(7), "vancouver"))).toMatch(/^F1 A, F2 A, F3 A, F4 A, F5 A, F6 A, et al\. /);
    expect(plainText(formatReference(many(11), "chicago"))).toMatch(/^F1, Ann, Ann F2, .*Ann F7, et al\. /);
    expect(plainText(formatReference(many(4), "gbt"))).toMatch(/^F1 A, F2 A, F3 A, et al\. /);
    expect(plainText(formatInText(many(2), "apa"))).toBe("(F1 & F2, 2015)");
  });

  it("puts the title first with no author, and n.d. with no date", () => {
    const anon = { ...art, authors: [], year: "" };
    expect(plainText(formatReference(anon, "apa"))).toMatch(/^Deep learning\. \(n\.d\.\)\. Nature/);
    expect(plainText(formatInText(anon, "apa"))).toBe('("Deep learning", n.d.)');
    expect(plainText(formatReference(anon, "harvard"))).toMatch(/^'Deep learning' \(no date\), Nature/);
  });

  it("writes Chinese authors as written, with 等 after three", () => {
    const zh: Work = { ...emptyWork("article"), authors: parsePeople("张三\n李四\n王五\n赵六"), title: "深度学习综述", container: "计算机学报", year: "2020", volume: "43", issue: "2", pages: "1-20" };
    expect(plainText(formatReference(zh, "gbt"))).toBe("张三, 李四, 王五, 等. 深度学习综述[J]. 计算机学报, 2020, 43(2): 1-20.");
  });

  it("sorts alphabetically, or keeps citation order for numbered styles", () => {
    expect(sortedEntries([web, art, book], "apa").map((e) => e.w.title)).toEqual(["Thinking, fast and slow", "Deep learning", "Malaria"]);
    expect(sortedEntries([web, art, book], "ieee").map((e) => e.w.title)).toEqual(["Malaria", "Deep learning", "Thinking, fast and slow"]);
  });
});

describe("names", () => {
  it("reads family-first, given-first, groups and CJK names", () => {
    expect(parsePerson("Smith, Jane")).toEqual({ family: "Smith", given: "Jane" });
    expect(parsePerson("Jane van Smith")).toEqual({ family: "van Smith", given: "Jane" });
    expect(parsePerson("{NASA Team}")).toEqual({ literal: "NASA Team" });
    expect(parsePerson("UNESCO")).toEqual({ literal: "UNESCO" });
    expect(parsePerson("张三")).toEqual({ literal: "张三" });
    expect(parsePeople("A, B; C, D\n\n")).toHaveLength(2);
  });
});

describe("BibTeX and RIS", () => {
  const bib = `% a comment
@string{nat = "Nature"}
@article{lecun2015,
  author = {LeCun, Yann and Bengio, Yoshua and Hinton, Geoffrey},
  title = {Deep {L}earning},
  journal = {Nature},
  year = 2015, month = may,
  volume = {521}, number = {7553},
  pages = {436--444},
  doi = {10.1038/nature14539}
}
@book{k, author = "Kahneman, Daniel", title = {Thinking, Fast and Slow}, publisher = {Farrar, Straus and Giroux}, address = {New York}, year = {2011}, edition = {2nd}}`;

  it("imports BibTeX", () => {
    const [a, b] = parseBibtex(bib);
    expect(a!.authors).toHaveLength(3);
    expect(a!.title).toBe("Deep Learning");
    expect(a!.month).toBe(5);
    expect(a!.pages).toBe("436–444");
    expect(b!.type).toBe("book");
    expect(b!.edition).toBe("2");
    expect(delatex("Schr{\\\"o}dinger \\& G\\'eza")).toBe("Schrödinger & Géza");
  });

  it("round-trips through BibTeX and RIS", () => {
    for (const w of [art, book, chap, web]) {
      const fromBib = parseBibtex(toBibtex([w]))[0]!;
      const fromRis = parseRis(toRis([w]))[0]!;
      for (const back of [fromBib, fromRis]) {
        expect(html(formatReference(back, "apa"))).toBe(html(formatReference({ ...w, doi: cleanDoi(w.doi) }, "apa")));
      }
    }
    expect(toBibtex([art, art])).toContain("@article{lecun2015a,");
  });

  it("detects the format", () => {
    expect(parseImport("TY  - JOUR\nAU  - Doe, Jane\nTI  - A title\nT2  - J\nPY  - 2001\nSP  - 5\nEP  - 9\nER  - ")[0]!.pages).toBe("5–9");
    expect(parseImport(bib)).toHaveLength(2);
  });
});

describe("lookups", () => {
  it("tells a DOI from an ISBN and checks ISBN check digits", () => {
    expect(classifyLookup("https://doi.org/10.1038/nature14539")).toEqual({ kind: "doi", value: "10.1038/nature14539" });
    expect(classifyLookup("978-0-262-03561-3")).toEqual({ kind: "isbn", value: "9780262035613" });
    expect(classifyLookup("0-306-40615-2")).toEqual({ kind: "isbn", value: "0306406152" });
    expect(classifyLookup("978-0-262-03561-4")).toBeNull();
    expect(classifyLookup("hello")).toBeNull();
    expect(lookupUrl({ kind: "doi", value: "10.1000/a b" })).toBe("https://api.crossref.org/works/10.1000%2Fa%20b");
  });

  it("maps a Crossref record", () => {
    const w = fromCrossref({ message: { type: "journal-article", title: ["Deep <i>learning</i>"], "container-title": ["Nature"], author: [{ given: "Yann", family: "LeCun" }, { name: "Some Consortium" }], issued: { "date-parts": [[2015, 5, 27]] }, volume: "521", issue: "7553", page: "436-444", DOI: "10.1038/nature14539", publisher: "Springer" } })!;
    expect(w.title).toBe("Deep learning");
    expect(w.authors).toEqual([{ family: "LeCun", given: "Yann" }, { literal: "Some Consortium" }]);
    expect([w.year, w.month, w.day, w.pages, w.publisher]).toEqual(["2015", 5, 27, "436–444", ""]);
    expect(fromCrossref({ message: {} })).toBeNull();
  });

  it("maps an Open Library record", () => {
    const w = fromOpenLibrary({ "ISBN:9780262035613": { title: "Deep learning", authors: [{ name: "Ian Goodfellow" }, { name: "Yoshua Bengio" }], publishers: [{ name: "The MIT Press" }], publish_places: [{ name: "Cambridge, Massachusetts" }], publish_date: "November 18, 2016" } }, "9780262035613")!;
    expect(w.authors[0]).toEqual({ family: "Goodfellow", given: "Ian" });
    expect([w.type, w.year, w.publisher]).toEqual(["book", "2016", "The MIT Press"]);
    expect(fromOpenLibrary({}, "1")).toBeNull();
  });
});

describe("review fixes", () => {
  it("keeps braced group authors whole and URLs literal in BibTeX", () => {
    const [w] = parseBibtex("@online{x, author = {{Food and Agriculture Organization} and Smith, Ann}, title = {T}, url = {https://example.com/a--b}, doi = {10.1000/a--b}}");
    expect(w!.authors).toEqual([{ literal: "Food and Agriculture Organization" }, { family: "Smith", given: "Ann" }]);
    expect(w!.url).toBe("https://example.com/a--b");
    expect(w!.doi).toBe("10.1000/a--b");
    const back = parseBibtex(toBibtex([w!]))[0]!;
    expect(back.authors[0]).toEqual({ literal: "Food and Agriculture Organization" });
  });

  it("leaves no stray punctuation or double spaces when parts are missing", () => {
    const page: Work = { ...emptyWork("webpage"), title: "About us", year: "2015", month: 5, day: 27, url: "https://example.com/about" };
    expect(plainText(formatReference(page, "mla"))).toBe('"About us." 27 May 2015, example.com/about.');
    const chapter: Work = { ...emptyWork("chapter"), authors: parsePeople("Doe, Jo"), title: "T", container: "Deep Learning Handbook", publisher: "Springer", place: "New York", year: "2015", pages: "1-20" };
    expect(plainText(formatReference(chapter, "ieee"))).toBe('J. Doe, "T," in Deep Learning Handbook. New York: Springer, 2015, pp. 1–20.');
    const bookDoi: Work = { ...emptyWork("book"), authors: parsePeople("LeCun, Yann"), title: "Title", year: "2015", doi: "10.1000/x" };
    for (const style of STYLES) expect(plainText(formatReference(bookDoi, style))).not.toMatch(/ {2}/);
    expect(plainText(formatReference(bookDoi, "apa"))).toBe("LeCun, Y. (2015). Title. https://doi.org/10.1000/x");
  });

  it("decodes HTML entities in Crossref titles", () => {
    const w = fromCrossref({ message: { type: "journal-article", title: ["Prices &amp; <i>wages</i> &#8212; a test"], "container-title": ["Journal of Business &amp; Economic Statistics"] } })!;
    expect(w.title).toBe("Prices & wages — a test");
    expect(w.container).toBe("Journal of Business & Economic Statistics");
  });
});

describe("second review fixes", () => {
  it("never doubles a title's ? or ! and leaves no stray punctuation when parts are missing", () => {
    const why: Work = { ...emptyWork("book"), authors: parsePeople("Smith, John"), title: "Why?", year: "2020", publisher: "Pub" };
    for (const style of STYLES) expect(plainText(formatReference(why, style)), style).not.toMatch(/[?!]\./);
    const ch: Work = { ...emptyWork("chapter"), authors: parsePeople("Smith, John"), title: "Ch", container: "Book", year: "2020", pages: "1-2" };
    expect(plainText(formatReference(ch, "harvard"))).toBe("Smith, J. (2020) 'Ch', in Book. pp. 1–2.");
    expect(plainText(formatReference({ ...ch, pages: "" }, "harvard"))).toBe("Smith, J. (2020) 'Ch', in Book.");
    const bare: Work = { ...emptyWork("book"), authors: parsePeople("Smith, John"), title: "T" };
    expect(plainText(formatReference(bare, "vancouver"))).toBe("Smith J. T.");
    expect(plainText(formatReference(bare, "gbt"))).toBe("SMITH J. T[M].");
    const art: Work = { ...emptyWork("article"), authors: parsePeople("Smith, John"), title: "T", container: "J" };
    expect(plainText(formatReference(art, "vancouver"))).toBe("Smith J. T. J.");
    expect(plainText(formatReference(art, "gbt"))).toBe("SMITH J. T[J]. J.");
    for (const style of STYLES) for (const w of [why, ch, bare, art]) expect(plainText(formatReference(w, style)), style).not.toMatch(/\. \.|, \.|  /);
  });

  it("reads ISBN labels and escapes BibTeX braces and backslashes", () => {
    expect(classifyLookup("ISBN-13: 978-0-306-40615-7")).toEqual({ kind: "isbn", value: "9780306406157" });
    expect(classifyLookup("ISBN 0-306-40615-2")).toEqual({ kind: "isbn", value: "0306406152" });
    const w: Work = { ...emptyWork("book"), title: "50% of {x} \\ y & z_1", year: "2020" };
    const bib = toBibtex([w]);
    expect(bib).toContain("title = {50\\% of \\{x\\} \\textbackslash{} y \\& z\\_1}");
    expect(parseBibtex(bib)[0]!.title).toBe(w.title);
    expect(toRis([{ ...w, year: "", month: 5 }])).not.toContain("DA  -");
  });
});

describe("third review fixes", () => {
  it("keeps group authors brace-protected in BibTeX, reads spelled editions and LaTeX commands", () => {
    const bib = toBibtex([{ ...emptyWork("book"), authors: [{ literal: "Food and Agriculture Organization" }, { family: "O'Neil", given: "C_D" }], title: "T" }]);
    expect(bib).toContain("author = {{Food and Agriculture Organization} and O'Neil, C\\_D}");
    expect(["Second", "2nd", "2nd ed.", "third edition", "4", "Rev."].map(editionNumber)).toEqual(["2", "2", "2", "3", "4", "Rev."]);
    expect(delatex("The \\emph{E. coli} genome \\textendash{} x")).toBe("The E. coli genome – x");
    expect(parseBibtex("@misc{key}\n@article{a, title={T}, journal={J}}").map((w) => w.title)).toEqual(["T"]);
  });

  it("joins IEEE chapter parts and APA issue-only articles cleanly", () => {
    const ch: Work = { ...emptyWork("chapter"), title: "Ch", container: "Book", pages: "12-34" };
    expect(plainText(formatReference(ch, "ieee"))).toBe('"Ch," in Book, pp. 12–34.');
    expect(plainText(formatReference({ ...ch, editors: parsePeople("Lee, Kim") }, "ieee"))).toBe('"Ch," in Book, K. Lee, Ed., pp. 12–34.');
    expect(plainText(formatReference({ ...ch, publisher: "P", year: "2020" }, "ieee"))).toBe('"Ch," in Book. P, 2020, pp. 12–34.');
    expect(plainText(formatReference({ ...emptyWork("article"), title: "T", container: "J", issue: "3", year: "2020" }, "apa"))).toBe("T. (2020). J, (3).");
  });
});

describe("fourth review fixes", () => {
  it("reads dotted initials, www.doi.org links and braced family/given names", () => {
    const tolkien: Work = { ...emptyWork("book"), authors: parsePeople("Tolkien, J.R.R."), title: "The Hobbit", year: "1937", publisher: "Allen & Unwin" };
    expect(plainText(formatReference(tolkien, "apa"))).toMatch(/^Tolkien, J\. R\. R\. \(1937\)/);
    expect(plainText(formatReference({ ...tolkien, authors: parsePeople("Sartre, J.-P.") }, "apa"))).toMatch(/^Sartre, J\.-P\. /);
    expect(cleanDoi("https://www.doi.org/10.1038/nature14539")).toBe("10.1038/nature14539");
    expect(classifyLookup("https://www.doi.org/10.1038/nature14539")).toEqual({ kind: "doi", value: "10.1038/nature14539" });
    expect(parseBibtex("@book{k, author = {{van Beethoven}, {Ludwig}}, title = {T}}")[0]!.authors).toEqual([{ family: "van Beethoven", given: "Ludwig" }]);
  });

  it("imports theses and reports, maps preprints, and keeps chapter editions and article links", () => {
    const [thesis] = parseBibtex("@phdthesis{k, author={A, B}, title={T}, school={MIT}, year=2000}");
    expect([thesis!.type, thesis!.publisher]).toEqual(["book", "MIT"]);
    const pre = fromCrossref({ message: { type: "posted-content", title: ["P"], institution: [{ name: "bioRxiv" }], issued: { "date-parts": [[2021]] } } })!;
    expect([pre.type, pre.container]).toEqual(["article", "bioRxiv"]);
    const ch: Work = { ...emptyWork("chapter"), authors: parsePeople("Smith, John"), title: "Ch", container: "Book", edition: "2", pages: "12-34", publisher: "P", year: "2000" };
    expect(plainText(formatReference(ch, "apa"))).toBe("Smith, J. (2000). Ch. In Book (2nd ed., pp. 12–34). P.");
    for (const style of ["mla", "chicago", "harvard", "ieee", "vancouver"] as const) expect(plainText(formatReference(ch, style)), style).toMatch(/2nd ed|2nd edn/);
    const online: Work = { ...emptyWork("article"), authors: parsePeople("Smith, John"), title: "T", container: "J", year: "2000", url: "https://j.example/t" };
    for (const style of STYLES) expect(plainText(formatReference(online, style)), style).toContain("j.example/t");
  });
});

describe("fifth review fixes", () => {
  it("reads LaTeX letters and every accent command", () => {
    expect(delatex("S{\\o}ren")).toBe("Søren");
    expect(delatex("{\\L}{\\'o}d{\\'z}")).toBe("Łódź");
    expect(delatex("\\v{c}api\\v c Erd{\\H{o}}s \\={a} \\.{z} \\k{a} na\\\"{\\i}ve")).toBe("čapič Erdős ā ż ą naïve");
  });

  it("keeps BibTeX keys valid past z", () => {
    const works = Array.from({ length: 30 }, () => ({ ...emptyWork("article"), title: "研究", container: "J", year: "2020" }));
    const keys = [...toBibtex(works).matchAll(/@article\{([^,]+),/g)].map((m) => m[1]!);
    expect(new Set(keys).size).toBe(30);
    for (const k of keys) expect(k).toMatch(/^[a-z0-9]+$/);
  });

  it("ends chapter and journal entries with one period", () => {
    const ch: Work = { ...emptyWork("chapter"), authors: parsePeople("Smith, John"), editors: parsePeople("Lee, Kim"), title: "A chapter", container: "The Book", edition: "2", year: "2015" };
    expect(plainText(formatReference(ch, "chicago"))).toBe('Smith, John. "A chapter." In The Book, edited by Kim Lee, 2nd ed. 2015.');
    expect(plainText(formatReference(ch, "ieee"))).toBe('J. Smith, "A chapter," in The Book, 2nd ed., K. Lee, Ed. 2015.');
    const q: Work = { ...emptyWork("article"), title: "Why?", container: "Nature?", year: "2015" };
    expect(plainText(formatReference(q, "harvard"))).toBe("'Why?' (2015), Nature?");
    for (const style of STYLES) for (const w of [ch, q]) expect(plainText(formatReference(w, style)), style).not.toMatch(/\.\.|[?!]\./);
  });

  it("joins Crossref subtitles and leads edited books with their editors", () => {
    const w = fromCrossref({ message: { type: "edited-book", title: ["Thinking in Systems"], subtitle: ["A Primer"], editor: [{ given: "Diana", family: "Wright" }], publisher: "Chelsea Green" } })!;
    expect(w.title).toBe("Thinking in Systems: A Primer");
    expect(w.authors).toEqual([{ family: "Wright", given: "Diana" }]);
  });
});

describe("sixth review fixes", () => {
  it("keeps spaces after unbraced accents and reads braced BibTeX names", () => {
    expect(delatex("Ren\\'e Descartes and Caf\\'e society")).toBe("René Descartes and Café society");
    expect(delatex("\\L\\'od\\'z, na\\\"{\\i}ve")).toBe("Łódź, naïve");
    const people = parseBibtex("@book{k, author = {Ren\\'e Descartes and Charles {de Gaulle} and King, Jr., Martin Luther}, title={T}}")[0]!.authors;
    expect(people).toEqual([{ family: "Descartes", given: "René" }, { family: "de Gaulle", given: "Charles" }, { family: "King", given: "Martin Luther", suffix: "Jr." }]);
  });

  it("ends entries with one mark and no dangling commas or colons", () => {
    const why: Work = { ...emptyWork("book"), authors: parsePeople("Smith, John"), title: "Why?", year: "2020", edition: "2" };
    expect(plainText(formatReference({ ...why, year: "" }, "mla"))).toBe("Smith, John. Why? 2nd ed.");
    expect(plainText(formatInText(why, "chicago"))).toBe("Smith, Why?");
    expect(plainText(formatReference({ ...emptyWork("webpage"), authors: parsePeople("Smith, John"), title: "Why?", year: "2020" }, "harvard"))).toBe("Smith, J. (2020) Why?");
    expect(plainText(formatReference({ ...emptyWork("webpage"), authors: parsePeople("Smith, John"), title: "Hello" }, "ieee"))).toBe('J. Smith, "Hello."');
    expect(plainText(formatReference({ ...emptyWork("article"), title: "T", container: "J", pages: "1-5" }, "vancouver"))).toBe("T. J. 1-5.");
    expect(plainText(formatReference({ ...emptyWork("chapter"), title: "T", container: "Book?", publisher: "P" }, "ieee"))).toBe('"T," in Book? P.');
  });

  it("reads Crossref's edition-number", () => {
    expect(fromCrossref({ message: { type: "book", title: ["B"], "edition-number": "3" } })!.edition).toBe("3");
  });
});

describe("seventh review fixes", () => {
  it("marks the editors of an edited book in every style", () => {
    const ed: Work = { ...emptyWork("book"), authors: parsePeople("Smith, John\nLee, Kim"), edited: true, title: "Handbook", year: "2020", publisher: "P" };
    const got = Object.fromEntries(STYLES.map((st) => [st, plainText(formatReference(ed, st))]));
    expect(got.apa).toBe("Smith, J., & Lee, K. (Eds.). (2020). Handbook. P.");
    expect(got.mla).toMatch(/^Smith, John, and Kim Lee, editors\. /);
    expect(got.chicago).toMatch(/^Smith, John, and Kim Lee, eds\. /);
    expect(got.harvard).toMatch(/^Smith, J\. and Lee, K\. \(eds\) \(2020\)/);
    expect(got.ieee).toMatch(/^J\. Smith and K\. Lee, Eds\., /);
    expect(got.vancouver).toMatch(/^Smith J, Lee K, editors\. /);
    expect(got.gbt).toMatch(/^SMITH J, LEE K, ed\. /);
    const bib = parseBibtex(toBibtex([ed]))[0]!;
    expect([bib.edited, bib.authors.length]).toEqual([true, 2]);
    expect(parseRis(toRis([ed]))[0]!.edited).toBe(true);
  });

  it("imports RIS theses, normalizes access dates, escapes ~ and ^, writes the month as a macro", () => {
    expect(parseRis("TY  - THES\nAU  - Doe, J\nTI  - My thesis\nPY  - 2020\nPB  - Uni\nER  - ")[0]!.type).toBe("book");
    expect(parseRis("TY  - XYZ\nTI  - T\nT2  - J\nER  - ")[0]!.type).toBe("article");
    expect(normDate("2020/5/1")).toBe("2020-05-01");
    expect(parseBibtex("@online{k, title={T}, urldate={2020/05/01}}")[0]!.accessed).toBe("2020-05-01");
    const w: Work = { ...emptyWork("article"), title: "Scaling to ~1B with x^2", container: "J", year: "2020", month: 5 };
    const bib = toBibtex([w]);
    expect(bib).toContain("\\textasciitilde{}1B with x\\textasciicircum{}2");
    expect(bib).toContain("  month = may");
    expect(parseBibtex(bib)[0]!.title).toBe(w.title);
  });

  it("closes an IEEE page title with a period when no site follows, and survives bad entities", () => {
    const page: Work = { ...emptyWork("webpage"), title: "Page", url: "https://x.org/a", accessed: "2024-05-01" };
    expect(plainText(formatReference(page, "ieee"))).toBe('"Page." Accessed: May 1, 2024. [Online]. Available: https://x.org/a');
    expect(fromCrossref({ message: { title: ["A &#x110000; b"] } })!.title).toBe("A &#x110000; b");
  });
});

describe("eighth review fixes", () => {
  it("reads # concatenation, @string macros and classic @inbook", () => {
    const [a] = parseBibtex('@string{jgr = "J. Geophys. Res."}\n@article{k, title = "A" # " B", journal = jgr, year = 2020, month = jan # "~15"}');
    expect([a!.title, a!.container, a!.year, a!.month]).toEqual(["A B", "J. Geophys. Res.", "2020", 1]);
    const [ch] = parseBibtex("@inbook{k, author={A, B}, title={The Book}, chapter={Origins}, publisher={P}, year=2001}");
    expect([ch!.type, ch!.title, ch!.container]).toEqual(["chapter", "Origins", "The Book"]);
    const [bk] = parseBibtex("@inbook{k, author={A, B}, title={The Book}, chapter={3}, publisher={P}, year=2001}");
    expect([bk!.type, bk!.title]).toEqual(["book", "The Book"]);
  });

  it("keeps RIS editors of unknown types, skips a BOM, and writes GB/T editions by language", () => {
    const [ed] = parseRis("\uFEFFTY  - EDBOOK\nED  - Smith, John\nTI  - Handbook\nPY  - 2020\nER  - ");
    expect([ed!.type, ed!.edited, ed!.authors.length]).toEqual(["book", true, 1]);
    expect(parseImport("\uFEFFTY  - JOUR\nTI  - T\nT2  - J\nER  - ")).toHaveLength(1);
    const book: Work = { ...emptyWork("book"), authors: parsePeople("Smith, John"), title: "Book", edition: "2", publisher: "P", year: "2020" };
    expect(plainText(formatReference(book, "gbt"))).toBe("SMITH J. Book[M]. 2nd ed. P, 2020.");
    expect(plainText(formatReference({ ...book, authors: parsePeople("张三"), title: "书名" }, "gbt"))).toBe("张三. 书名[M]. 2版. P, 2020.");
    expect(plainText(formatReference({ ...emptyWork("chapter"), title: "Chap", container: "Book", pages: "12-34" }, "gbt"))).toBe("Chap[M]//Book: 12-34.");
  });

  it("keeps a group author with a comma whole when the form refills", () => {
    expect(parsePerson(personToText({ literal: "Google,Inc" }))).toEqual({ literal: "Google,Inc" });
  });
});

describe("medium review fixes", () => {
  it("takes the book, not the series, as a Crossref chapter's container", () => {
    const w = fromCrossref({ message: { type: "book-chapter", title: ["Ch"], "container-title": ["Lecture Notes in Computer Science", "Computer Vision – ECCV 2016"] } })!;
    expect(w.container).toBe("Computer Vision – ECCV 2016");
  });

  it("keeps suffixes and particles with the family name", () => {
    expect(parsePerson("Martin Luther King Jr.")).toEqual({ family: "King", given: "Martin Luther", suffix: "Jr." });
    expect(parsePerson("Ludwig van Beethoven")).toEqual({ family: "van Beethoven", given: "Ludwig" });
    expect(parseBibtex("@book{k, author = {Ludwig van Beethoven}, title = {T}}")[0]!.authors).toEqual([{ family: "van Beethoven", given: "Ludwig" }]);
  });

  it("does not double a book title's mark in APA or GB/T chapters", () => {
    const ch: Work = { ...emptyWork("chapter"), authors: parsePeople("Smith, John"), title: "A", container: "Why?", year: "2020", publisher: "P" };
    expect(plainText(formatReference(ch, "apa"))).toBe("Smith, J. (2020). A. In Why? P.");
    expect(plainText(formatReference(ch, "gbt"))).toBe("SMITH J. A[M]//Why? P, 2020.");
  });

  it("italicizes an author-less book title in MLA in-text citations", () => {
    expect(html(formatInText({ ...emptyWork("book"), title: "Beowulf" }, "mla"))).toBe("(<i>Beowulf</i>)");
    expect(html(formatInText({ ...emptyWork("article"), title: "Deep learning", container: "J" }, "mla"))).toBe('("Deep learning")');
  });
});

describe("second medium review fixes", () => {
  it("leaves out first editions and impossible RIS dates", () => {
    expect(["1", "1st", "First", "first edition"].map(editionNumber)).toEqual(["", "", "", ""]);
    const [w] = parseRis("TY  - JOUR\nTI  - T\nT2  - J\nDA  - 2015/13/40\nER  - ");
    expect([w!.year, w!.month, w!.day]).toEqual(["2015", 0, 0]);
  });

  it("puts name suffixes where each style wants them", () => {
    const mlk: Work = { ...emptyWork("book"), authors: parsePeople("Martin Luther King Jr."), title: "Why We Can't Wait", year: "1964", publisher: "Harper" };
    expect(mlk.authors[0]).toEqual({ family: "King", given: "Martin Luther", suffix: "Jr." });
    expect(plainText(formatReference(mlk, "apa"))).toMatch(/^King, M\. L\., Jr\. \(1964\)/);
    expect(plainText(formatInText(mlk, "apa"))).toBe("(King, 1964)");
    expect(plainText(formatReference(mlk, "mla"))).toMatch(/^King, Martin Luther, Jr\. /);
    expect(parsePerson(personToText(mlk.authors[0]!))).toEqual(mlk.authors[0]);
    expect(parseBibtex("@book{k, author = {King, Jr., Martin Luther}, title = {T}}")[0]!.authors[0]).toEqual(mlk.authors[0]);
    expect(parseBibtex("@book{k, author = {Smith, John AND Lee, Kim}, title = {T}}")[0]!.authors).toHaveLength(2);
  });

  it("keeps book and chapter links in IEEE, Vancouver and GB/T", () => {
    const ch: Work = { ...emptyWork("chapter"), authors: parsePeople("Smith, John"), title: "C", container: "B", year: "2016", publisher: "Springer", doi: "10.1007/978-3-319-46448-0_2" };
    for (const style of ["ieee", "vancouver", "gbt"] as const) expect(plainText(formatReference(ch, style)), style).toContain("10.1007/978-3-319-46448-0_2");
    const ebook: Work = { ...emptyWork("book"), authors: parsePeople("Smith, John"), title: "E", year: "2020", url: "https://e.example/book" };
    for (const style of ["ieee", "vancouver", "gbt"] as const) expect(plainText(formatReference(ebook, style)), style).toContain("e.example/book");
    expect(plainText(formatReference(ebook, "gbt"))).toContain("[M/OL]");
  });

  it("maps DataCite records (arXiv preprints)", () => {
    expect(dataciteUrl("10.48550/arXiv.1706.03762")).toBe("https://api.datacite.org/dois/10.48550%2FarXiv.1706.03762");
    const w = fromDataCite({ data: { attributes: { doi: "10.48550/arXiv.1706.03762", titles: [{ title: "Attention Is All You Need" }], creators: [{ name: "Vaswani, Ashish", nameType: "Personal", givenName: "Ashish", familyName: "Vaswani" }], publisher: "arXiv", publicationYear: 2017, types: { resourceTypeGeneral: "Preprint" } } } })!;
    expect([w.type, w.container, w.year, w.doi]).toEqual(["article", "arXiv", "2017", "10.48550/arXiv.1706.03762"]);
    expect(plainText(formatReference(w, "apa"))).toBe("Vaswani, A. (2017). Attention Is All You Need. arXiv. https://doi.org/10.48550/arXiv.1706.03762");
  });
});

describe("third medium review fixes", () => {
  it("round-trips name suffixes and comma group authors through BibTeX and RIS", () => {
    const w: Work = { ...emptyWork("book"), authors: [{ family: "King", given: "Martin Luther", suffix: "Jr." }, { literal: "Smith, Jones & Co" }], title: "T", year: "1964" };
    expect(toBibtex([w])).toContain("King, Jr., Martin Luther");
    expect(parseBibtex(toBibtex([w]))[0]!.authors).toEqual(w.authors);
    expect(parseRis(toRis([w]))[0]!.authors).toEqual(w.authors);
  });

  it("keeps the period of et al. before an editor label", () => {
    const ed: Work = { ...emptyWork("book"), authors: parsePeople("A, Ann\nB, Bo\nC, Cy"), edited: true, title: "T", year: "2020", publisher: "P" };
    expect(plainText(formatReference(ed, "mla"))).toMatch(/^A, Ann, et al\., editors\. /);
    const many: Work = { ...ed, authors: Array.from({ length: 7 }, (_, i) => ({ family: `F${i}`, given: "Ann" })) };
    expect(plainText(formatReference(many, "vancouver"))).toMatch(/et al\., editors\. /);
  });

  it("cites a DataCite chapter with no book title as a book", () => {
    const w = fromDataCite({ data: { attributes: { titles: [{ title: "Ch" }], publisher: "Zenodo", publicationYear: 2021, types: { resourceTypeGeneral: "BookChapter" } } } })!;
    expect([w.type, w.publisher]).toEqual(["book", "Zenodo"]);
  });
});

describe("fourth medium review fixes", () => {
  it("handles word editions, trailing DOI punctuation and RIS records without ER", () => {
    expect(editionNumber("Revised edition")).toBe("Revised");
    const book: Work = { ...emptyWork("book"), authors: parsePeople("Smith, John"), title: "Book", year: "2020", publisher: "Pub", edition: editionNumber("Revised edition") };
    expect(plainText(formatReference(book, "apa"))).toBe("Smith, J. (2020). Book (Revised ed.). Pub.");
    expect(classifyLookup("https://doi.org/10.1038/nature14539.")).toEqual({ kind: "doi", value: "10.1038/nature14539" });
    expect(classifyLookup("(doi:10.1038/nature14539)")).toBeNull();
    expect(parseRis("TY  - JOUR\nTI  - A\nT2  - J\nTY  - JOUR\nTI  - B\nT2  - J\n").map((w) => w.title)).toEqual(["A", "B"]);
  });

  it("gives MLA's access date for undated pages and skips entries inside @comment", () => {
    const page: Work = { ...emptyWork("webpage"), title: "Page", container: "Site", url: "https://x.org", accessed: "2024-01-02" };
    expect(plainText(formatReference(page, "mla"))).toBe('"Page." Site, x.org. Accessed 2 Jan. 2024.');
    expect(parseBibtex("@comment{ @article{old, title={Draft}, journal={J}} }\n@article{a, title={Real}, journal={J}}").map((w) => w.title)).toEqual(["Real"]);
  });
});

describe("fifth medium review fixes", () => {
  it("parses parenthesized entries and lone parentheses in comments, and range-checks BibTeX days", () => {
    expect(parseBibtex("@comment{see (draft} @article{b, title={T2}, journal={J}}").map((w) => w.title)).toEqual(["T2"]);
    expect(parseBibtex("@article(a, title={T}, journal={J}, year=2020)")[0]!.year).toBe("2020");
    expect(parseBibtex("@online{k, title={T}, date={2020-05-99}}")[0]!.day).toBe(0);
  });

  it("keeps a web page's DOI in every style and italicizes an author-less APA title", () => {
    const data: Work = { ...emptyWork("webpage"), title: "Data", container: "Zenodo", year: "2020", doi: "10.5281/zenodo.1" };
    for (const style of STYLES) expect(plainText(formatReference(data, style)), style).toContain("10.5281/zenodo.1");
    expect(html(formatInText({ ...emptyWork("webpage"), title: "Home" }, "apa"))).toBe("(<i>Home</i>, n.d.)");
  });

  it("cites a Crossref chapter with no book title as a book, and keeps ; inside a group author", () => {
    expect(fromCrossref({ message: { type: "proceedings-article", title: ["P"] } })!.type).toBe("book");
    const g = { literal: "Dept. A; Dept. B" };
    expect(parsePeople(personToText(g))).toEqual([g]);
  });
});

