/**
 * Markdown to a document tree and to HTML, for the Markdown preview tool. Covers CommonMark's common syntax plus GitHub
 * tables, task lists, strikethrough and bare links. Raw HTML is kept as text (never run), and only http(s), mailto, tel
 * and relative links are linked, so a pasted document cannot run script in the page or in copied HTML.
 */

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

const FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*([^`\s]*)[^`]*$/;
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const HR = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE = /^ {0,3}>/;
const BULLET = /^( {0,3})([-*+]|\d{1,9}[.)])([ \t]+|$)(.*)$/;
const SETEXT = /^ {0,3}(=+|-+)[ \t]*$/;
const TABLE_DELIM = /^[ \t]*\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;

const blank = (s: string | undefined) => s == null || /^[ \t]*$/.test(s);

function expandTabs(line: string): string {
  if (!line.includes("\t")) return line;
  let out = "";
  for (const ch of line) out += ch === "\t" ? " ".repeat(4 - (out.length % 4)) : ch;
  return out;
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
      tick = tick === run ? 0 : tick || run;
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

/** Whether a line starts a block that ends the paragraph above it. */
function interrupts(line: string): boolean {
  if (FENCE.test(line) || ATX.test(line) || HR.test(line) || QUOTE.test(line)) return true;
  const m = BULLET.exec(line);
  // A list interrupts a paragraph only when the item has text and, if numbered, starts at 1 (so "2019. was a year" stays text).
  return !!m && m[4].trim() !== "" && (/^[-*+]$/.test(m[2]) || /^1[.)]$/.test(m[2]));
}

export function parseMarkdown(src: string): Block[] {
  const text = src.slice(0, MAX_MARKDOWN).replace(/\r\n?/g, "\n").replace(/^﻿/, "").replace(/\0/g, "�");
  return blocks(text.split("\n").map(expandTabs), 0);
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
    const fence = FENCE.exec(line);
    if (fence && !(fence[1][0] === "`" && fence[2].includes("`"))) {
      const indent = indentOf(line);
      const mark = fence[1];
      const body: string[] = [];
      i++;
      while (i < lines.length) {
        const close = new RegExp(`^ {0,3}${mark[0] === "`" ? "`" : "~"}{${mark.length},}[ \\t]*$`);
        if (close.test(lines[i])) {
          i++;
          break;
        }
        // Lines inside a fence opened with an indent lose up to that much indent.
        body.push(lines[i].replace(new RegExp(`^ {0,${indent}}`), ""));
        i++;
      }
      out.push({ t: "code", lang: fence[2], text: body.join("\n") });
      continue;
    }
    const atx = ATX.exec(line);
    if (atx) {
      out.push({ t: "h", level: atx[1].length as 1, kids: inline(atx[2] ?? "") });
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
      while (i < lines.length && !blank(lines[i])) {
        const l = lines[i];
        if (QUOTE.test(l)) inner.push(l.replace(/^ {0,3}> ?/, ""));
        // A plain line right after quoted text continues that paragraph ("lazy" continuation).
        else if (!interrupts(l) && inner.length && !blank(inner[inner.length - 1])) inner.push(l);
        else break;
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
    if (line.includes("|") && i + 1 < lines.length && TABLE_DELIM.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      const head = splitRow(line);
      const delim = splitRow(lines[i + 1]);
      if (head.length === delim.length) {
        const rows: Inline[][][] = [];
        i += 2;
        while (i < lines.length && !blank(lines[i]) && !interrupts(lines[i])) {
          const cells = splitRow(lines[i]);
          rows.push(head.map((_, c) => inline(cells[c] ?? "")));
          i++;
        }
        out.push({ t: "table", align: delim.map(alignOf), head: head.map((c) => inline(c)), rows });
        continue;
      }
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
      if (interrupts(lines[i])) break;
      // Keep trailing spaces: two at the end of a line make a line break.
      para.push(lines[i].replace(/^[ \t]+/, ""));
      i++;
    }
    const body = para.join("\n");
    if (heading) out.push({ t: "h", level: heading, kids: inline(body.replace(/[ \t]+$/, "")) });
    else out.push({ t: "p", kids: inline(body.replace(/[ \t]+$/, "")) });
  }
  return out;
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
        i++;
        continue;
      }
      // Lazy continuation of the item's last paragraph.
      if (!sawBlank && !interrupts(l) && !BULLET.test(l) && !blank(body[body.length - 1]) && !FENCE.test(body[0] ?? "")) {
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
    if (body.slice(0, -1).some((l, k) => blank(l) && k > 0 && !blank(body[k - 1])) && kids.length > 1) tight = false;
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
  if (m[3]) return NAMED[m[3]] ? { v: NAMED[m[3]], len: m[0].length } : null;
  const cp = m[1] ? Number(m[1]) : parseInt(m[2], 16);
  const ok = cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff);
  return { v: ok ? String.fromCodePoint(cp) : "�", len: m[0].length };
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
  return { href, title, end: j + 1 };
}

const isSpace = (c: string | undefined) => c == null || /\s/.test(c);
const isWord = (c: string | undefined) => c != null && /[\p{L}\p{N}]/u.test(c);

/** Finds where an emphasis run of `delim` opened at i closes, or −1. */
function closeEmphasis(s: string, from: number, delim: string): number {
  for (let j = from; j < s.length; j++) {
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
      const inner = closeEmphasis(s, j + 2, delim + delim);
      if (inner > 0) {
        j = inner + 1;
        continue;
      }
    }
    if (s.startsWith(delim, j) && !isSpace(s[j - 1]) && j > from) {
      // "_" closes only at the end of a word, so snake_case_names stay as typed.
      if (delim[0] === "_" && isWord(s[j + delim.length])) continue;
      return j;
    }
  }
  return -1;
}

const MAX_INLINE_DEPTH = 16;

export function inline(src: string, depth = 0, inLink = false): Inline[] {
  const out: Inline[] = [];
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
      if (/ {2,}$/.test(buf)) {
        buf = buf.replace(/ +$/, "");
        flush();
        out.push({ t: "br" });
      } else {
        buf = buf.replace(/ +$/, "") + "\n";
      }
      i++;
      while (s[i] === " ") i++;
      continue;
    }
    if ((c === "!" && s[i + 1] === "[") || (c === "[" && !inLink)) {
      const open = c === "!" ? i + 1 : i;
      const close = closeBracket(s, open);
      const dest = close > 0 ? destination(s, close + 1) : null;
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
      const auto = /^<((?:https?|mailto|tel):[^\s<>]+|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)>/i.exec(s.slice(i));
      if (auto && !inLink) {
        flush();
        const href = /^[a-z][a-z0-9+.-]*:/i.test(auto[1]) ? auto[1] : `mailto:${auto[1]}`;
        out.push({ t: "link", href, title: "", kids: [{ t: "text", v: auto[1] }] });
        i += auto[0].length;
        continue;
      }
    }
    // A bare web address at the start of a word becomes a link (GitHub style).
    if ((c === "h" || c === "w") && !inLink && !isWord(s[i - 1])) {
      const m = /^(?:https?:\/\/|www\.)[^\s<]+/i.exec(s.slice(i));
      if (m) {
        let url = m[0];
        // Trailing punctuation belongs to the sentence; a ")" stays only if it closes a "(" in the address.
        for (;;) {
          const last = url[url.length - 1];
          if (/[.,:;!?"'*_~]/.test(last)) url = url.slice(0, -1);
          else if (last === ")" && (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0)) url = url.slice(0, -1);
          else break;
        }
        if (url.length > 7 || /^www\.\S/.test(url)) {
          flush();
          out.push({ t: "link", href: url.startsWith("www.") ? `http://${url}` : url, title: "", kids: [{ t: "text", v: url }] });
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
        const tries: Array<{ delim: string; make: (kids: Inline[]) => Inline }> =
          c === "~"
            ? run === 2 ? [{ delim: "~~", make: (kids) => ({ t: "del", kids }) }] : []
            : run >= 3
              ? [{ delim: c.repeat(3), make: (kids) => ({ t: "strong", kids: [{ t: "em", kids }] }) }, { delim: c + c, make: (kids) => ({ t: "strong", kids }) }, { delim: c, make: (kids) => ({ t: "em", kids }) }]
              : run === 2
                ? [{ delim: c + c, make: (kids) => ({ t: "strong", kids }) }]
                : [{ delim: c, make: (kids) => ({ t: "em", kids }) }];
        let done = false;
        for (const tr of tries) {
          const end = closeEmphasis(s, i + tr.delim.length, tr.delim);
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

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

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
              return `<li>${box}${toHtml(it.kids, b.tight)}</li>`;
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

/** A heading's text and level, for the outline. */
export function headings(doc: readonly Block[]): Array<{ level: number; text: string }> {
  return doc.flatMap((b) => (b.t === "h" ? [{ level: b.level, text: plain(b.kids) }] : []));
}

/** Words in the source (CJK characters count one each), for the status line. */
export function countWords(src: string): number {
  const marked = src.replace(/[㐀-鿿豈-﫿぀-ヿ가-힯]/g, " $& ").replace(/[#>*_`~|[\]()!-]+/g, " ");
  const t = marked.trim();
  return t ? t.split(/\s+/).length : 0;
}
