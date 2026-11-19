/**
 * One document model for the letter tools (resignation letter, cover letter): the page preview, the printed PDF, the
 * copied text and the Word file are all built from the same lines, so they never disagree.
 */
import { zipStore } from "./zip";

export type Paper = "a4" | "letter";
/** Along the line: left / centre / right in horizontal text, top / middle / bottom in vertical Japanese. */
export type Align = "start" | "center" | "end";
export type LineSize = "title" | "body" | "small";

export type DocLine = {
  /** May hold "\n" for a block of short lines (an address); long text wraps. */
  text: string;
  align?: Align;
  bold?: boolean;
  size?: LineSize;
  /** Blank lines before this one. */
  gap?: number;
  /** A first-line indent of one character (Chinese and Japanese body paragraphs). */
  indent?: boolean;
  /**
   * A two-column form table (label, value) instead of text, for forms such as the Korean 사직서 or the Indonesian
   * data diri block; `text` is then ignored. Copy writes "label: value" lines.
   */
  table?: readonly (readonly [string, string])[];
};

export type LetterDoc = {
  lines: DocLine[];
  /** Japanese 縦書き: columns from right to left. */
  vertical?: boolean;
  /** BCP 47 tag for the page (lang attribute) and the Word file's language. */
  lang: string;
  /** Mincho / Song style for East Asian letters; sans for the rest. */
  serif?: boolean;
};

/** Point sizes for the printed page and the Word file. */
export const LINE_PT: Record<LineSize, number> = { title: 16, body: 11, small: 10 };

/** Plain text, for Copy and for pasting into an email. Alignment is dropped; blank lines are kept. */
export function letterText(doc: LetterDoc): string {
  const out: string[] = [];
  for (const line of doc.lines) {
    for (let i = 0; i < (line.gap ?? 0); i++) out.push("");
    if (line.table) {
      for (const [k, v] of line.table) out.push(`${k}: ${v}`);
      continue;
    }
    // The indent is an ideographic space, as Chinese and Japanese letters are typed.
    out.push(line.indent ? `　${line.text}` : line.text);
  }
  // Blank lines are kept as the preview shows them (a gap of 2 leaves room for a signature).
  return out.join("\n").trim() + "\n";
}

function xml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Characters XML 1.0 forbids (control codes pasted from elsewhere) would make Word refuse the file.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "");
}

const JC: Record<Align, string> = { start: "left", center: "center", end: "right" };

/** Fonts Word picks for each script; every one ships with Windows and Office for Mac. */
function fontsOf(lang: string, serif: boolean): { latin: string; eastAsia: string } {
  const base = lang.toLowerCase();
  if (base.startsWith("ja")) return { latin: serif ? "Yu Mincho" : "Yu Gothic", eastAsia: serif ? "Yu Mincho" : "Yu Gothic" };
  if (base === "zh-tw" || base.startsWith("zh-hant")) return { latin: "Times New Roman", eastAsia: serif ? "PMingLiU" : "Microsoft JhengHei" };
  if (base.startsWith("zh")) return { latin: "Times New Roman", eastAsia: serif ? "SimSun" : "Microsoft YaHei" };
  if (base.startsWith("ko")) return { latin: "Malgun Gothic", eastAsia: serif ? "Batang" : "Malgun Gothic" };
  return { latin: serif ? "Times New Roman" : "Calibri", eastAsia: serif ? "Times New Roman" : "Calibri" };
}

function cell(text: string, width: number, bold: boolean): string {
  const runs = text.split("\n").map((part, i) => `${i ? "<w:br/>" : ""}<w:t xml:space="preserve">${xml(part)}</w:t>`).join("");
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr>${bold ? "<w:b/>" : ""}</w:rPr>${runs}</w:r></w:p></w:tc>`;
}

/** A bordered two-column table filling the text width (`total` twips). */
function table(rows: readonly (readonly [string, string])[], total: number): string {
  const first = Math.round(total * 0.3);
  const border = '<w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
  const body = rows.map(([k, v]) => `<w:tr>${cell(k, first, true)}${cell(v, total - first, false)}</w:tr>`).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/><w:tblBorders>${border}</w:tblBorders><w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="${first}"/><w:gridCol w:w="${total - first}"/></w:tblGrid>${body}</w:tbl><w:p/>`;
}

function paragraph(line: DocLine, vertical: boolean): string {
  const pPr: string[] = [];
  if (line.align && line.align !== "start") pPr.push(`<w:jc w:val="${JC[line.align]}"/>`);
  if (line.indent) pPr.push(`<w:ind w:firstLineChars="100" w:firstLine="${vertical ? 210 : 220}"/>`);
  const size = LINE_PT[line.size ?? "body"] * 2;
  const rPr = `<w:rPr>${line.bold ? "<w:b/>" : ""}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr>`;
  const runs = line.text.split("\n").map((part, i) =>
    `${i ? "<w:br/>" : ""}<w:t xml:space="preserve">${xml(part)}</w:t>`).join("");
  return `<w:p>${pPr.length ? `<w:pPr>${pPr.join("")}</w:pPr>` : ""}<w:r>${rPr}${runs}</w:r></w:p>`;
}

/** Page size and margins in twentieths of a point. */
const PAGE: Record<Paper, { w: number; h: number }> = { a4: { w: 11906, h: 16838 }, letter: { w: 12240, h: 15840 } };

export function letterDocxXml(doc: LetterDoc, paper: Paper): string {
  const { w, h } = PAGE[paper];
  const margin = paper === "letter" ? 1440 : 1418;
  const body: string[] = [];
  for (const line of doc.lines) {
    for (let i = 0; i < (line.gap ?? 0); i++) body.push("<w:p/>");
    body.push(line.table ? table(line.table, w - 2 * margin) : paragraph(line, Boolean(doc.vertical)));
  }
  const sect = `<w:sectPr><w:pgSz w:w="${w}" w:h="${h}"/><w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" w:header="720" w:footer="720" w:gutter="0"/>${doc.vertical ? '<w:textDirection w:val="tbRl"/>' : ""}</w:sectPr>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join("")}${sect}</w:body></w:document>`;
}

function stylesXml(doc: LetterDoc): string {
  const f = fontsOf(doc.lang, Boolean(doc.serif));
  const lang = xml(doc.lang);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${f.latin}" w:hAnsi="${f.latin}" w:eastAsia="${f.eastAsia}" w:cs="${f.latin}"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="${lang}" w:eastAsia="${lang}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

/** A Word (.docx) file: four XML parts in a stored ZIP, opened by Word, Pages, LibreOffice and Google Docs. */
export function letterDocx(doc: LetterDoc, paper: Paper, now?: Date): Uint8Array {
  const enc = new TextEncoder();
  return zipStore([
    { name: "[Content_Types].xml", data: enc.encode(CONTENT_TYPES) },
    { name: "_rels/.rels", data: enc.encode(ROOT_RELS) },
    { name: "word/_rels/document.xml.rels", data: enc.encode(DOC_RELS) },
    { name: "word/document.xml", data: enc.encode(letterDocxXml(doc, paper)) },
    { name: "word/styles.xml", data: enc.encode(stylesXml(doc)) },
  ], now);
}

/** A file name stem from typed words: letters, digits and dashes in any script, never a path. */
export function docStem(stem: string, fallback: string): string {
  const clean = stem.normalize("NFC").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return clean || fallback;
}

/** A file name from typed words (see docStem) with its extension. */
export function docFilename(stem: string, ext: string, fallback: string): string {
  return `${docStem(stem, fallback)}.${ext}`;
}
