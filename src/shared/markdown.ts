/**
 * Markdown to a document tree and to HTML, for the Markdown preview tool. Covers CommonMark's common syntax plus GitHub
 * tables, task lists, strikethrough and bare links. Raw HTML is kept as text (never run), and only http(s), mailto, tel
 * and relative links are linked, so a pasted document cannot run script in the page or in copied HTML.
 */

import { escapeHtml } from "./md";

export { escapeHtml };

export type Inline =
  | { t: "text"; v: string }
  | { t: "br" }
  | { t: "code"; v: string }
  | { t: "strong" | "em" | "del"; kids: Inline[] }
  | { t: "link"; href: string; title: string; kids: Inline[] }
  | { t: "img"; src: string; alt: string; title: string };

export type Align = "left" | "center" | "right" | null;

export type ListItem = { task: boolean | null; kids: Block[] };

export type Block =
  | { t: "h"; level: 1 | 2 | 3 | 4 | 5 | 6; kids: Inline[] }
  | { t: "p"; kids: Inline[] }
  | { t: "hr" }
  | { t: "code"; lang: string; text: string }
  | { t: "quote"; kids: Block[] }
  | { t: "list"; ordered: boolean; start: number; tight: boolean; items: ListItem[] }
  | { t: "table"; align: Align[]; head: Inline[][]; rows: Inline[][][] };

/** Longest document parsed (characters); longer text is cut so typing stays smooth. */
export const MAX_MARKDOWN = 200_000;
const MAX_NEST = 12;

const FENCE_LINE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*))?$/;
const HR = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE = /^ {0,3}>/;
const BULLET = /^( {0,3})([-*+]|\d{1,9}[.)])([ \t]+|$)(.*)$/;
const SETEXT = /^ {0,3}(=+|-+)[ \t]*$/;
/** Cells in one document's tables. A short table can pad very many rows to very many columns; no real table comes near this. */
const MAX_TABLE_CELLS = 100_000;
let cellsLeft = 0;

/** Removes trailing characters by scanning back: an end-anchored regex is quadratic on a long run inside a line. */
function trimEnd(s: string, chars: string): string {
  let e = s.length;
  while (e > 0 && chars.includes(s[e - 1])) e--;
  return s.slice(0, e);
}

const blank = (s: string | undefined) => s == null || /^[ \t]*$/.test(s);

/** Tabs in the indent become spaces, for block structure. Later tabs are content (a TSV sample, a Makefile line). */
function expandTabs(line: string): string {
  if (!line.includes("\t")) return line;
  let out = "";
  let i = 0;
  for (; line[i] === " " || line[i] === "\t"; i++) out += line[i] === "\t" ? " ".repeat(4 - (out.length % 4)) : " ";
  return out + line.slice(i);
}

/** Splits text into lines with their indents expanded, leaving the lines of a top-level fence exactly as typed. */
function toLines(text: string): string[] {
  const out: string[] = [];
  let close: RegExp | null = null;
  // A fence indented 2 or 3 spaces may sit in a list item, whose indent must still count, so only its definitions are skipped.
  let keepRaw = false;
  let afterFence = false;
  for (const raw of text.split("\n")) {
    const line = expandTabs(raw);
    if (close) {
      if (close.test(line)) {
        close = null;
        afterFence = true;
        out.push(line);
      } else {
        out.push(keepRaw ? raw : line);
      }
      continue;
    }
    // The opener can share a line with list markers ("- ```"); its closer is then indented to the item's text.
    const bare = line.replace(/^(?: {0,3}(?:[-*+]|\d{1,9}[.)]) +)+/, "");
    const fence = fenceOf(line) ?? fenceOf(bare);
    keepRaw = bare === line && indentOf(line) < 2;
    if (fence) close = new RegExp(`^ ${keepRaw ? "{0,3}" : "*"}${fence.mark[0] === "`" ? "`" : "~"}{${fence.mark.length},}[ \\t]*$`);
    // A reference definition ("[1]: https://…") is not shown. It cannot interrupt a paragraph.
    const prev = out[out.length - 1];
    if (!fence && line.includes("]:") && (prev === undefined || afterFence || !continuesParagraph(prev)) && addRef(line)) continue;
    afterFence = false;
    out.push(line);
  }
  return out;
}

/** Link reference definitions of the document being parsed, by normalized label. */
let refs = new Map<string, { href: string; title: string }>();

const refKey = (label: string) => label.trim().replace(/\s+/g, " ").toLowerCase();

function addRef(line: string): boolean {
  const m = /^ {0,3}\[([^\]\n]{1,200})\]:[ ]*(\S+)(?:\s+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)))?\s*$/.exec(line);
  if (!m) return false;
  const key = refKey(m[1]);
  // The first definition of a label wins, as in CommonMark.
  if (key && !refs.has(key)) refs.set(key, { href: decodeEntities(m[2].replace(/^<(.*)>$/, "$1")), title: decodeEntities(m[3] ?? m[4] ?? m[5] ?? "") });
  return key !== "";
}

/** The reference a bracket pair closing at `close` points to: "[a][b]", "[a][]" or "[a]". */
function refAt(s: string, open: number, close: number): { href: string; title: string; end: number } | null {
  if (refs.size === 0) return null;
  let label = s.slice(open + 1, close);
  let end = close + 1;
  if (s[end] === "[") {
    const stop = s.indexOf("]", end);
    if (stop > 0 && stop - end <= 1000) {
      const second = s.slice(end + 1, stop);
      if (second.trim()) label = second;
      end = stop + 1;
    }
  }
  if (label.length > 1000) return null;
  const ref = refs.get(refKey(label));
  return ref ? { ...ref, end } : null;
}

/** A delimiter row, cell by cell (a single regex for this backtracks badly on long runs of spaces). */
function isDelimRow(line: string): boolean {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").every((c) => /^:?-+:?$/.test(c.trim()));
}

/** A heading's text, without its optional closing #s ("## Title ##"). */
function atxText(raw: string | undefined): string {
  const s = trimEnd(raw ?? "", " \t");
  const body = trimEnd(s, "#");
  return body.length < s.length && (body.endsWith(" ") || body.endsWith("\t")) ? trimEnd(body, " \t") : s;
}

function indentOf(line: string): number {
  return /^ */.exec(line)![0].length;
}

/** Splits a table row into cells: outer pipes are optional, `\|` and pipes inside code spans stay in the cell. */
export function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = "";
  let tick = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && s[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (c === "`") {
      let run = 1;
      while (s[i + run] === "`") run++;
      // A run with no closing run is plain text, so it does not swallow the cells after it.
      tick = tick === run ? 0 : tick || (s.indexOf("`".repeat(run), i + run) >= 0 ? run : 0);
      cur += "`".repeat(run);
      i += run - 1;
    } else if (c === "|" && !tick) {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  cells.push(cur.trim());
  return cells;
}

function alignOf(cell: string): Align {
  const c = cell.trim();
  const l = c.startsWith(":");
  const r = c.endsWith(":");
  return l && r ? "center" : r ? "right" : l ? "left" : null;
}

/** An opening code fence: its marker and language. A backtick fence's info may not contain a backtick (CommonMark). */
function fenceOf(line: string): { mark: string; lang: string } | null {
  const m = FENCE_LINE.exec(line);
  if (!m || (m[1][0] === "`" && m[2].includes("`"))) return null;
  return { mark: m[1], lang: m[2].trim().split(/\s+/)[0] ?? "" };
}

/** Whether lines i and i + 1 are a table's header and delimiter rows (same number of cells). */
function startsTable(lines: string[], i: number): boolean {
  const head = lines[i];
  const delim = lines[i + 1];
  if (!head?.includes("|") || delim == null || !delim.includes("-") || !isDelimRow(delim)) return false;
  return splitRow(head).length === splitRow(delim).length;
}

/** Whether the line before a plain line is paragraph text, which is all a "lazy" line can continue. */
function continuesParagraph(last: string): boolean {
  return !blank(last) && !ATX.test(last) && !HR.test(last) && !SETEXT.test(last);
}

/** Whether a line starts a block that ends the paragraph above it. */
function interrupts(line: string): boolean {
  if (fenceOf(line) || ATX.test(line) || HR.test(line) || QUOTE.test(line)) return true;
  const m = BULLET.exec(line);
  // A list interrupts a paragraph only when the item has text and, if numbered, starts at 1 (so "2019. was a year" stays text).
  return !!m && m[4].trim() !== "" && (/^[-*+]$/.test(m[2]) || /^1[.)]$/.test(m[2]));
}

/**
 * Steps left for the forward scans that look for a closing `*`, `]` or backtick in one paragraph (or heading or cell).
 * Unclosed delimiters would make those scans quadratic (a pasted "*a *a *a…" froze the tab), so each paragraph gets a
 * budget in proportion to its length; past it, that paragraph's remaining delimiters are read as plain text. Ordinary
 * text uses a tiny fraction of it, and other paragraphs are not affected.
 */
let budget = 0;

export function parseMarkdown(src: string): Block[] {
  const text = src.slice(0, MAX_MARKDOWN).replace(/\r\n?/g, "\n").replace(/^﻿/, "").replace(/\0/g, "�");
  cellsLeft = MAX_TABLE_CELLS;
  refs = new Map();
  return blocks(toLines(text), 0);
}

function blocks(lines: string[], depth: number): Block[] {
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (blank(line)) {
      i++;
      continue;
    }
    const fence = fenceOf(line);
    if (fence) {
      const indent = indentOf(line);
      const mark = fence.mark;
      const body: string[] = [];
      const close = new RegExp(`^ {0,3}${mark[0] === "`" ? "`" : "~"}{${mark.length},}[ \\t]*$`);
      const strip = new RegExp(`^ {0,${indent}}`);
      i++;
      while (i < lines.length) {
        if (close.test(lines[i])) {
          i++;
          break;
        }
        // Lines inside a fence opened with an indent lose up to that much indent.
        body.push(lines[i].replace(strip, ""));
        i++;
      }
      out.push({ t: "code", lang: fence.lang, text: body.join("\n") });
      continue;
    }
    const atx = ATX.exec(line);
    if (atx) {
      out.push({ t: "h", level: atx[1].length as 1, kids: inline(atxText(atx[2])) });
      i++;
      continue;
    }
    if (HR.test(line)) {
      out.push({ t: "hr" });
      i++;
      continue;
    }
    if (QUOTE.test(line)) {
      const inner: string[] = [];
      let fenced = false;
      while (i < lines.length && !blank(lines[i])) {
        const l = lines[i];
        if (QUOTE.test(l)) inner.push(l.replace(/^ {0,3}> ?/, ""));
        // A plain line right after quoted text continues that paragraph ("lazy" continuation).
        else if (!fenced && !interrupts(l) && inner.length && continuesParagraph(inner[inner.length - 1])) inner.push(l);
        else break;
        if (fenceOf(inner[inner.length - 1])) fenced = true;
        i++;
      }
      out.push({ t: "quote", kids: depth < MAX_NEST ? blocks(inner, depth + 1) : [{ t: "p", kids: [{ t: "text", v: inner.join("\n") }] }] });
      continue;
    }
    if (BULLET.test(line)) {
      i = list(lines, i, depth, out);
      continue;
    }
    // Indented code: four spaces (after a blank line or at the start, never inside a paragraph).
    if (indentOf(line) >= 4) {
      const body: string[] = [];
      while (i < lines.length && (indentOf(lines[i]) >= 4 || blank(lines[i]))) {
        body.push(lines[i].slice(4));
        i++;
      }
      while (body.length && blank(body[body.length - 1])) body.pop();
      out.push({ t: "code", lang: "", text: body.join("\n") });
      continue;
    }
    // A table: a header row, then a delimiter row with the same number of cells.
    if (cellsLeft > 0 && startsTable(lines, i)) {
      const head = splitRow(line);
      cellsLeft -= head.length;
      const delim = splitRow(lines[i + 1]);
      const rows: Inline[][][] = [];
      i += 2;
      while (i < lines.length && cellsLeft > 0 && !blank(lines[i]) && !interrupts(lines[i])) {
        cellsLeft -= head.length;
        const cells = splitRow(lines[i]);
        rows.push(head.map((_, c) => inline(cells[c] ?? "")));
        i++;
      }
      out.push({ t: "table", align: delim.map(alignOf), head: head.map((c) => inline(c)), rows });
      continue;
    }
    // A paragraph, or a setext heading when the next line is ===== or -----.
    const para: string[] = [line.replace(/^[ \t]+/, "")];
    i++;
    let heading: 1 | 2 | 0 = 0;
    while (i < lines.length && !blank(lines[i])) {
      const s = SETEXT.exec(lines[i]);
      if (s) {
        heading = s[1][0] === "=" ? 1 : 2;
        i++;
        break;
      }
      if (interrupts(lines[i]) || startsTable(lines, i)) break;
      // Keep trailing spaces: two at the end of a line make a line break.
      para.push(lines[i].replace(/^[ \t]+/, ""));
      i++;
    }
    const body = para.join("\n");
    if (heading) out.push({ t: "h", level: heading, kids: inline(trimEnd(body, " \t")) });
    else out.push({ t: "p", kids: inline(trimEnd(body, " \t")) });
  }
  return out;
}

/** Whether a blank line separates an item's own blocks, not lines inside its code block or nested list. */
function hasOwnBlank(body: string[]): boolean {
  let inFence = false;
  let prev = "";
  for (let k = 0; k < body.length; k++) {
    const l = body[k];
    if (fenceOf(l)) inFence = !inFence;
    if (inFence) continue;
    if (!blank(l)) {
      prev = l;
      continue;
    }
    let n = k + 1;
    while (n < body.length && blank(body[n])) n++;
    if (n === body.length || !prev) {
      k = n - 1;
      continue;
    }
    const next = body[n];
    // Only after a nested list's own line: "- a\n\n    more" is a second paragraph of the item, however far it is indented.
    const nested = (BULLET.test(prev.trimStart()) || indentOf(prev) > 0) && (indentOf(next) > 0 || BULLET.test(next));
    if (!nested) return true;
    k = n - 1;
  }
  return false;
}

/** Reads a list starting at line i into `out`; returns the line after it. */
function list(lines: string[], start: number, depth: number, out: Block[]): number {
  const first = BULLET.exec(lines[start])!;
  const ordered = /\d/.test(first[2]);
  const kind = ordered ? first[2].slice(-1) : first[2];
  const items: ListItem[] = [];
  let tight = true;
  let i = start;
  while (i < lines.length) {
    const m = BULLET.exec(lines[i]);
    if (!m) break;
    const itemKind = /\d/.test(m[2]) ? m[2].slice(-1) : m[2];
    if (itemKind !== kind || /\d/.test(m[2]) !== ordered) break;
    // A marker followed by a rule ("- - -" or "* * *") is a horizontal rule, not an item.
    if (HR.test(lines[i])) break;
    const spaces = m[3].length;
    // More than four spaces after the marker means the text is indented code; count it as one space then.
    const pad = spaces > 4 || m[4] === "" ? 1 : spaces;
    const content = m[1].length + m[2].length + pad;
    const body: string[] = [spaces > 4 ? " ".repeat(spaces - 1) + m[4] : m[4]];
    let fenced = !!fenceOf(body[0] ?? "");
    i++;
    let sawBlank = false;
    while (i < lines.length) {
      const l = lines[i];
      if (blank(l)) {
        // A blank line stays in the item only if indented text follows.
        let j = i;
        while (j < lines.length && blank(lines[j])) j++;
        if (j < lines.length && indentOf(lines[j]) >= content) {
          for (; i < j; i++) body.push("");
          sawBlank = true;
          continue;
        }
        break;
      }
      if (indentOf(l) >= content) {
        body.push(l.slice(content));
        if (fenceOf(body[body.length - 1])) fenced = true;
        i++;
        continue;
      }
      // Lazy continuation of the item's last paragraph.
      if (!sawBlank && !fenced && !interrupts(l) && !BULLET.test(l) && continuesParagraph(body[body.length - 1])) {
        body.push(l.trim());
        i++;
        continue;
      }
      break;
    }
    let task: boolean | null = null;
    const tm = /^\[([ xX])\](?:[ \t]+|$)/.exec(body[0]);
    if (tm) {
      task = tm[1] !== " ";
      body[0] = body[0].slice(tm[0].length);
    }
    const kids = depth < MAX_NEST ? blocks(body, depth + 1) : [{ t: "p" as const, kids: [{ t: "text" as const, v: body.join("\n") }] }];
    // Blank lines between an item's own blocks make the list loose.
    if (kids.length > 1 && hasOwnBlank(body)) tight = false;
    items.push({ task, kids });
    // A blank line between two items also makes it loose.
    if (i < lines.length && blank(lines[i])) {
      let j = i;
      while (j < lines.length && blank(lines[j])) j++;
      const next = BULLET.exec(lines[j] ?? "");
      if (next && (/\d/.test(next[2]) ? next[2].slice(-1) : next[2]) === kind && indentOf(lines[j]) < content) {
        tight = false;
        i = j;
      }
    }
  }
  out.push({ t: "list", ordered, start: ordered ? Number.parseInt(first[2], 10) : 1, tight, items });
  return i;
}

// ---------- Inline ----------

const PUNCT = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;
const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", copy: "©", reg: "®", trade: "™",
  hellip: "…", mdash: "—", ndash: "–", laquo: "«", raquo: "»", middot: "·", times: "×", divide: "÷", deg: "°",
  euro: "€", pound: "£", yen: "¥", larr: "←", rarr: "→", uarr: "↑", darr: "↓", hearts: "♥", check: "✓",
};

/** Decodes `&amp;`, `&#169;`, `&#x1F600;` and the common named entities; others stay as typed. */
function entity(s: string, i: number): { v: string; len: number } | null {
  const m = /^&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-zA-Z]{2,8}));/.exec(s.slice(i, i + 12));
  if (!m) return null;
  if (m[3]) return Object.hasOwn(NAMED, m[3]) ? { v: NAMED[m[3]], len: m[0].length } : null;
  const cp = m[1] ? Number(m[1]) : parseInt(m[2], 16);
  const ok = cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff);
  return { v: ok ? String.fromCodePoint(cp) : "�", len: m[0].length };
}

function decodeEntities(s: string): string {
  if (!s.includes("&")) return s;
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const e = s[i] === "&" ? entity(s, i) : null;
    if (e) {
      out += e.v;
      i += e.len - 1;
    } else {
      out += s[i];
    }
  }
  return out;
}

/**
 * Links are kept only for http(s), mailto, tel, in-page and relative addresses; null for anything else
 * (javascript:, data:, vbscript: …), which is shown as plain text instead.
 */
export function safeHref(raw: string): string | null {
  // Browsers ignore tabs, newlines and leading control characters in a scheme, so strip them before checking.
  const url = raw.replace(/[\u0000- \u007f-\u009f]/g, (c) => (c === " " ? "%20" : "")).trim();
  if (!url) return null;
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(url);
  if (!scheme) return url;
  return ["http", "https", "mailto", "tel"].includes(scheme[1].toLowerCase()) ? url : null;
}

function codeSpanAt(s: string, i: number): { v: string; end: number } | null {
  let run = 0;
  while (s[i + run] === "`") run++;
  let j = i + run;
  while (j < s.length) {
    if (--budget < 0) return null;
    if (s[j] !== "`") {
      j++;
      continue;
    }
    let close = 0;
    while (s[j + close] === "`") close++;
    if (close === run) {
      let v = s.slice(i + run, j).replace(/\n/g, " ");
      if (v.length > 2 && v.startsWith(" ") && v.endsWith(" ") && v.trim()) v = v.slice(1, -1);
      return { v, end: j + close };
    }
    j += close;
  }
  return null;
}

/** The index of the "]" closing the "[" at i (brackets nest; code spans and escapes are skipped), or −1. */
function closeBracket(s: string, i: number): number {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (--budget < 0) return -1;
    const c = s[j];
    if (c === "\\") j++;
    else if (c === "`") {
      const code = codeSpanAt(s, j);
      if (code) j = code.end - 1;
      else while (s[j + 1] === "`") j++;
    } else if (c === "[") depth++;
    else if (c === "]" && --depth === 0) return j;
  }
  return -1;
}

/** Reads `(url "title")` after a link's text; parentheses in the url may nest one level deep, or use <url>. */
function destination(s: string, i: number): { href: string; title: string; end: number } | null {
  if (s[i] !== "(") return null;
  let j = i + 1;
  while (s[j] === " " || s[j] === "\n") j++;
  let href = "";
  if (s[j] === "<") {
    const close = s.indexOf(">", j);
    if (close < 0 || s.slice(j, close).includes("\n")) return null;
    href = s.slice(j + 1, close);
    j = close + 1;
  } else {
    let depth = 0;
    const startHref = j;
    for (; j < s.length; j++) {
      if (--budget < 0) return null;
      const c = s[j];
      if (c === "\\" && PUNCT.test(s[j + 1] ?? "")) {
        j++;
        continue;
      }
      if (c === " " || c === "\n") break;
      if (c === "(") depth++;
      if (c === ")") {
        if (depth === 0) break;
        depth--;
      }
    }
    href = s.slice(startHref, j).replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, "$1");
  }
  while (s[j] === " " || s[j] === "\n") j++;
  let title = "";
  const q = s[j];
  if (q === "\"" || q === "'" || q === "(") {
    const closeCh = q === "(" ? ")" : q;
    const close = s.indexOf(closeCh, j + 1);
    if (close < 0) return null;
    title = s.slice(j + 1, close);
    j = close + 1;
    while (s[j] === " " || s[j] === "\n") j++;
  }
  if (s[j] !== ")") return null;
  // Entities count here as in body text ("?a=1&amp;b=2"); safeHref checks the decoded address.
  return { href: decodeEntities(href), title: decodeEntities(title), end: j + 1 };
}

const isSpace = (c: string | undefined) => c == null || /\s/.test(c);
/** Chinese, Japanese and Korean run on without spaces, so a web address can follow one of these letters directly. */
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
/** What a bare web address may follow, as in GFM: not "ftp://www.a.com", "me@www.a.com" or "a.www.b.com". */
const BEFORE_URL = /[\s(*_~[{"'<>（【《「『：，。、；！？“‘]/;
const isWord = (c: string | undefined) => c != null && /[\p{L}\p{N}]/u.test(c);

/** Finds where an emphasis run of `delim` opened at i closes, or −1. */
function closeEmphasis(s: string, from: number, delim: string, failed: Map<string, number>, nested = false): number {
  // A run that found no closer from an earlier position finds none from a later one either.
  if (from >= (failed.get(delim) ?? Infinity)) return -1;
  for (let j = from; j < s.length; j++) {
    if (--budget < 0) return -1;
    const c = s[j];
    if (c === "\\") {
      j++;
      continue;
    }
    if (c === "`") {
      const code = codeSpanAt(s, j);
      if (code) j = code.end - 1;
      continue;
    }
    if (c === "[") {
      const close = closeBracket(s, j);
      if (close > 0) {
        const dest = destination(s, close + 1);
        if (dest) {
          j = dest.end - 1;
          continue;
        }
      }
    }
    // "*a **b** c*": a strong pair inside emphasis is skipped as a whole, so its "**" does not close the "*".
    if (delim.length === 1 && s.startsWith(delim + delim, j) && !isSpace(s[j + 2])) {
      const inner = closeEmphasis(s, j + 2, delim + delim, failed, true);
      if (inner > 0) {
        j = inner + 1;
        continue;
      }
    }
    // At the end of a longer run the closer is its last characters ("**bold *italic***"); a strong pair nested in
    // emphasis closes on the first ones instead ("*a **b***"), leaving the last "*" to close the emphasis.
    if (s.startsWith(delim, j) && !isSpace(s[j - 1]) && j > from && (nested || s[j + delim.length] !== delim[0])) {
      // "_" closes only at the end of a word, so snake_case_names stay as typed.
      if (delim[0] === "_" && isWord(s[j + delim.length])) continue;
      return j;
    }
  }
  if (budget >= 0 && !nested) failed.set(delim, Math.min(from, failed.get(delim) ?? Infinity));
  return -1;
}

const MAX_INLINE_DEPTH = 16;
const MAX_BARE_URL = 4096;

export function inline(src: string, depth = 0, inLink = false): Inline[] {
  const out: Inline[] = [];
  const failed = new Map<string, number>();
  if (depth === 0) budget = 20 * src.length + 20_000;
  let buf = "";
  const flush = () => {
    if (buf) out.push({ t: "text", v: buf });
    buf = "";
  };
  const s = src;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "\\") {
      if (s[i + 1] === "\n") {
        flush();
        out.push({ t: "br" });
        i += 2;
        continue;
      }
      if (PUNCT.test(s[i + 1] ?? "")) {
        buf += s[i + 1];
        i += 2;
        continue;
      }
      buf += c;
      i++;
      continue;
    }
    if (c === "&") {
      const e = entity(s, i);
      if (e) {
        buf += e.v;
        i += e.len;
        continue;
      }
    }
    if (c === "`") {
      const code = codeSpanAt(s, i);
      if (code) {
        flush();
        out.push({ t: "code", v: code.v });
        i = code.end;
        continue;
      }
      // An unmatched run of backticks is literal text.
      while (s[i] === "`") buf += s[i++];
      continue;
    }
    if (c === "\n") {
      // Two or more spaces before a line end make a hard line break; otherwise it is a soft break.
      // Text is flushed at every line end, so these checks only ever look at one line (not the whole paragraph).
      const kept = trimEnd(buf, " ");
      const hard = buf.length - kept.length >= 2;
      buf = kept;
      if (hard) {
        flush();
        out.push({ t: "br" });
      } else {
        buf += "\n";
        flush();
      }
      i++;
      while (s[i] === " ") i++;
      continue;
    }
    if ((c === "!" && s[i + 1] === "[") || (c === "[" && !inLink)) {
      const open = c === "!" ? i + 1 : i;
      const close = closeBracket(s, open);
      const dest = close > 0 ? destination(s, close + 1) ?? refAt(s, open, close) : null;
      if (dest) {
        const label = s.slice(open + 1, close);
        flush();
        if (c === "!") {
          const src2 = safeHref(dest.href);
          const alt = plain(inline(label, depth + 1, true));
          if (src2) out.push({ t: "img", src: src2, alt, title: dest.title });
          else out.push({ t: "text", v: alt });
        } else {
          const href = safeHref(dest.href);
          const kids = depth < MAX_INLINE_DEPTH ? inline(label, depth + 1, true) : [{ t: "text" as const, v: label }];
          if (href) out.push({ t: "link", href, title: dest.title, kids });
          else out.push(...kids);
        }
        i = dest.end;
        continue;
      }
    }
    if (c === "<") {
      // <https://…>, <mailto:…>, <tel:…>, or a bare e-mail address (no ":" or "/", so "<javascript:…//@x.y>" is not one).
      const auto = /^<(?:((?:https?|mailto|tel):[^\s<>]+)|([^\s<>@:/\\]+@[^\s<>@:/\\]+\.[^\s<>@:/\\]+))>/i.exec(s.slice(i, i + 2048));
      const href = auto ? safeHref(auto[1] ?? `mailto:${auto[2]}`) : null;
      if (auto && href && !inLink) {
        flush();
        out.push({ t: "link", href, title: "", kids: [{ t: "text", v: auto[1] ?? auto[2] }] });
        i += auto[0].length;
        continue;
      }
    }
    // A bare web address at the start of a word becomes a link (GitHub style).
    if ((c === "h" || c === "w" || c === "H" || c === "W") && !inLink && (i === 0 || BEFORE_URL.test(s[i - 1]) || CJK.test(s[i - 1]))) {
      // Bounded and budgeted: a failed candidate is scanned again from its next letter.
      const m = budget >= 0 ? /^(?:https?:\/\/|www\.)[^\s<>，。；：！？、）】》」』（【《「『”’…]+/i.exec(s.slice(i, i + MAX_BARE_URL)) : null;
      if (m) {
        budget -= m[0].length;
        // Inside quotes (raw HTML is text here: <a href="https://…">), the address ends at the closing quote.
        const quote = s[i - 1];
        if (quote === '"' || quote === "'") {
          const stop = m[0].indexOf(quote);
          if (stop >= 0) m[0] = m[0].slice(0, stop);
        }
        // Written straight after a CJK letter, with no spaces, the address also ends at the next one ("见a.com/x了解更多").
        if (CJK.test(s[i - 1] ?? "")) {
          const stop = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.exec(m[0]);
          if (stop) m[0] = m[0].slice(0, stop.index);
        }
        // Trailing punctuation belongs to the sentence; a ")" stays only if it closes a "(" in the address.
        const opens = m[0].split("(").length - 1;
        let closes = m[0].split(")").length - 1;
        let end = m[0].length;
        for (;;) {
          const last = m[0][end - 1];
          if (/[.,:;!?"'*_~\]}]/.test(last)) end--;
          else if (last === ")" && opens < closes) {
            closes--;
            end--;
          } else break;
        }
        const url = m[0].slice(0, end);
        // It needs a host: "https://" alone is text.
        if (/^(?:https?:\/\/[^\s/?#]+|www\.[^\s/?#.]+\.[^\s/?#]+)/i.test(url)) {
          flush();
          const shown = decodeEntities(url);
          out.push({ t: "link", href: safeHref(/^www\./i.test(shown) ? `http://${shown}` : shown) ?? "#", title: "", kids: [{ t: "text", v: shown }] });
          i += url.length;
          continue;
        }
      }
    }
    if ((c === "*" || c === "_" || c === "~") && depth < MAX_INLINE_DEPTH) {
      let run = 0;
      while (s[i + run] === c) run++;
      const canOpen = !isSpace(s[i + run]) && !(c === "_" && isWord(s[i - 1]));
      if (canOpen) {
        // "~~text~~" is strikethrough; "***text***" is bold italic.
        // A run of four or more ("****1234") is text, and a run only closes with a run of its own length.
        const tries: Array<{ delim: string; make: (kids: Inline[]) => Inline }> =
          c === "~"
            ? run === 2 ? [{ delim: "~~", make: (kids) => ({ t: "del", kids }) }] : []
            : run > 3
              ? []
              : run === 3
              ? [{ delim: c.repeat(3), make: (kids) => ({ t: "strong", kids: [{ t: "em", kids }] }) }]
              : run === 2
                ? [{ delim: c + c, make: (kids) => ({ t: "strong", kids }) }]
                : [{ delim: c, make: (kids) => ({ t: "em", kids }) }];
        let done = false;
        for (const tr of tries) {
          const end = closeEmphasis(s, i + tr.delim.length, tr.delim, failed);
          if (end > 0) {
            flush();
            out.push(tr.make(inline(s.slice(i + tr.delim.length, end), depth + 1, inLink)));
            i = end + tr.delim.length;
            done = true;
            break;
          }
        }
        if (done) continue;
      }
      buf += c.repeat(run);
      i += run;
      continue;
    }
    buf += c;
    i++;
  }
  flush();
  return out;
}

/** The text of inline content without formatting (an image's alt text, a heading's id). */
export function plain(nodes: readonly Inline[]): string {
  return nodes.map((n) => (n.t === "text" || n.t === "code" ? n.v : n.t === "br" ? "\n" : n.t === "img" ? n.alt : plain(n.kids))).join("");
}

// ---------- HTML ----------


function inlineHtml(nodes: readonly Inline[]): string {
  return nodes
    .map((n) => {
      switch (n.t) {
        case "text":
          return escapeHtml(n.v);
        case "br":
          return "<br>\n";
        case "code":
          return `<code>${escapeHtml(n.v)}</code>`;
        case "strong":
        case "em":
        case "del":
          return `<${n.t}>${inlineHtml(n.kids)}</${n.t}>`;
        case "link":
          return `<a href="${escapeHtml(n.href)}"${n.title ? ` title="${escapeHtml(n.title)}"` : ""}>${inlineHtml(n.kids)}</a>`;
        case "img":
          return `<img src="${escapeHtml(n.src)}" alt="${escapeHtml(n.alt)}"${n.title ? ` title="${escapeHtml(n.title)}"` : ""}>`;
      }
    })
    .join("");
}

function cellTag(tag: "th" | "td", align: Align, kids: Inline[]): string {
  return `<${tag}${align ? ` style="text-align: ${align}"` : ""}>${inlineHtml(kids)}</${tag}>`;
}

/** The document as HTML (a fragment: no <html> or <body>). Every text and attribute is escaped. */
export function toHtml(doc: readonly Block[], tight = false): string {
  return doc
    .map((b) => {
      switch (b.t) {
        case "h":
          return `<h${b.level}>${inlineHtml(b.kids)}</h${b.level}>`;
        case "p":
          return tight ? inlineHtml(b.kids) : `<p>${inlineHtml(b.kids)}</p>`;
        case "hr":
          return "<hr>";
        case "code":
          return `<pre><code${b.lang ? ` class="language-${escapeHtml(b.lang)}"` : ""}>${escapeHtml(b.text)}${b.text ? "\n" : ""}</code></pre>`;
        case "quote":
          return `<blockquote>\n${toHtml(b.kids)}\n</blockquote>`;
        case "list": {
          const tag = b.ordered ? "ol" : "ul";
          const start = b.ordered && b.start !== 1 ? ` start="${b.start}"` : "";
          const items = b.items
            .map((it) => {
              const box = it.task == null ? "" : `<input type="checkbox" disabled${it.task ? " checked" : ""}> `;
              // In a loose list the box goes inside the first paragraph, so it stays on the text's line.
              const body = toHtml(it.kids, b.tight);
              return body.startsWith("<p>") ? `<li><p>${box}${body.slice(3)}</li>` : `<li>${box}${body}</li>`;
            })
            .join("\n");
          return `<${tag}${start}>\n${items}\n</${tag}>`;
        }
        case "table": {
          const head = `<thead>\n<tr>${b.head.map((c, k) => cellTag("th", b.align[k], c)).join("")}</tr>\n</thead>`;
          const body = b.rows.length ? `\n<tbody>\n${b.rows.map((r) => `<tr>${r.map((c, k) => cellTag("td", b.align[k], c)).join("")}</tr>`).join("\n")}\n</tbody>` : "";
          return `<table>\n${head}${body}\n</table>`;
        }
      }
    })
    .join("\n");
}

/** The document's readable text (no Markdown syntax), one block per line, for word counts. */
export function docText(doc: readonly Block[]): string {
  return doc
    .map((b): string => {
      switch (b.t) {
        case "h":
        case "p":
          return plain(b.kids);
        case "code":
          return b.text;
        case "quote":
          return docText(b.kids);
        case "list":
          return b.items.map((it) => docText(it.kids)).join("\n");
        case "table":
          return [b.head, ...b.rows].map((r) => r.map(plain).join(" ")).join("\n");
        default:
          return "";
      }
    })
    .join("\n");
}
