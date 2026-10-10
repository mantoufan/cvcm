const ALLOWED = new Set([
  "p", "br", "h1", "h2", "h3", "h4", "pre", "code", "ul", "ol", "li",
  "a", "img", "video", "audio", "source", "blockquote", "strong", "em", "b", "i",
  "u", "s", "strike", "del", "hr", "span", "div", "table", "thead", "tbody", "tr", "th", "td",
]);

const ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title"]),
  img: new Set(["src", "alt"]),
  video: new Set(["src", "controls", "poster"]),
  audio: new Set(["src", "controls"]),
  source: new Set(["src", "type"]),
  code: new Set(["class"]),
  ol: new Set(["start"]),
  span: new Set(["class"]),
  pre: new Set(["class"]),
};

const KEYWORDS = new Set(`
  if else for while do return class const let var function async await
  import export from default try catch throw new this typeof break continue
  switch case true false null undefined in of as interface type public
  private static void int string bool def elif except lambda yield pass
  package func struct map chan go defer select echo fi then
`.trim().split(/\s+/));

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  const lower = url.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return null;
  }
  if (lower.startsWith("https://") || lower.startsWith("http://") || lower.startsWith("/") || lower.startsWith("#")) {
    return url;
  }
  return null;
}

function isAudio(url: string): boolean {
  return /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|weba)(\?|$)/i.test(url);
}

function isVideo(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

export function highlight(code: string): string {
  const src = escapeHtml(code);
  let out = "";
  let i = 0;
  while (i < src.length) {
    if (src[i] === "/" && src[i + 1] === "/") {
      const end = src.indexOf("\n", i);
      const cut = end === -1 ? src.length : end;
      out += `<span class="c">${src.slice(i, cut)}</span>`;
      i = cut;
      continue;
    }
    if (src[i] === "#" && (i === 0 || src[i - 1] === "\n")) {
      const end = src.indexOf("\n", i);
      const cut = end === -1 ? src.length : end;
      out += `<span class="c">${src.slice(i, cut)}</span>`;
      i = cut;
      continue;
    }
    if (src[i] === "&" && src.startsWith("&quot;", i)) {
      const close = src.indexOf("&quot;", i + 6);
      const cut = close === -1 ? src.length : close + 6;
      out += `<span class="s">${src.slice(i, cut)}</span>`;
      i = cut;
      continue;
    }
    if (src[i] === "'" || src[i] === "`") {
      const q = src[i];
      let j = i + 1;
      while (j < src.length && src[j] !== q) j++;
      out += `<span class="s">${src.slice(i, Math.min(src.length, j + 1))}</span>`;
      i = Math.min(src.length, j + 1);
      continue;
    }
    const word = src.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (word) {
      out += KEYWORDS.has(word[0]) ? `<span class="k">${word[0]}</span>` : word[0];
      i += word[0].length;
      continue;
    }
    out += src[i];
    i++;
  }
  return out;
}

function unescapeHtml(text: string): string {
  return text.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

/** `text` is already HTML-escaped. Generated tags are held as tokens so later rules never rewrite them. */
function inline(text: string, codes: string[] = []): string {
  const held: string[] = [];
  // Code-span tokens inside an attribute become plain text, not <code> markup.
  const plain = (v: string) => v.replace(/\u0001c(\d+)\u0002/g, (_m, i: string) => escapeHtml(codes[Number(i)] ?? ""));
  const hold = (html: string) => `\u0001h${held.push(html) - 1}\u0002`;
  return text
    // Bounded lengths keep a run of unmatched "[" from going quadratic.
    .replace(/!\[([^\]\n]{0,500})\]\(([^)\s]{1,2048})\)/g, (_m, rawAlt: string, href: string) => {
      const alt = plain(rawAlt);
      const url = safeUrl(unescapeHtml(plain(href)));
      if (!url) return alt;
      if (isVideo(url)) return hold(`<video controls src="${escapeHtml(url)}"></video>`);
      if (isAudio(url)) return hold(`<audio controls src="${escapeHtml(url)}"></audio>`);
      return hold(`<img src="${escapeHtml(url)}" alt="${alt}">`);
    })
    .replace(/\[([^\]\n]{1,500})\]\(([^)\s]{1,2048})\)/g, (_m, label: string, href: string) => {
      const url = safeUrl(unescapeHtml(plain(href)));
      if (!url) return label;
      return `${hold(`<a href="${escapeHtml(url)}" rel="noreferrer">`)}${label}${hold("</a>")}`;
    })
    .replace(/`([^`]+)`/g, (_m, code: string) => hold(`<code>${code}</code>`))
    .replace(/\+\+([^+]+)\+\+/g, (_m, s) => `<u>${s}</u>`)
    .replace(/~~([^~]+)~~/g, (_m, s) => `<s>${s}</s>`)
    .replace(/\*\*([^\n]+?)\*\*/g, (_m, s) => `<strong>${s}</strong>`)
    .replace(/\*([^*\n]+)\*/g, (_m, s) => `<em>${s}</em>`)
    .replace(/\u0001h(\d+)\u0002/g, (_m, i: string) => held[Number(i)] ?? "");
}

// Internal tokens are \u0001<kind><n>\u0002. Open and close differ, so two adjacent tokens can never
// read as a third one; both characters are stripped from the input first.
// Backslash escapes (\* \# \< …) become tokens so no rule below treats them as syntax.
const ESC_RE = /\\([\\`*_~\[\]()#+\-.!<>|])/g;

/** Cells of a "| a | b |" line. An escaped "\|" or a "|" inside `code` does not split a cell. */
function tableRow(line: string): string[] | null {
  const t = line.trim();
  if (t.length < 2 || t[0] !== "|" || t[t.length - 1] !== "|" || t[t.length - 2] === "\\") return null;
  const cells: string[] = [];
  let cell = "";
  let tick = 0; // length of the open code span's backtick run, 0 when outside code
  for (let i = 1; i < t.length - 1; i++) {
    const ch = t[i];
    if (ch === "\\" && !tick && i + 1 < t.length - 1) {
      cell += ch + t[++i];
      continue;
    }
    if (ch === "`") {
      let run = 1;
      while (t[i + run] === "`") run++;
      if (!tick) tick = run;
      else if (run === tick) tick = 0;
      cell += t.slice(i, i + run);
      i += run - 1;
      continue;
    }
    if (ch === "|" && !tick) {
      cells.push(cell.trim());
      cell = "";
      continue;
    }
    cell += ch;
  }
  cells.push(cell.trim());
  return cells;
}

const MAX_DEPTH = 8;
const FENCE_OPEN = /^([ \t]*)(`{3,})(\w*)\s*$/;
const QUOTE_LINE = /^ {0,3}>/;
const LIST_ITEM = /^([ \t]*)(?:([-*])|(\d+)[.)])(?:\s+(.*))?$/;
const HEADING = /^(#{1,4})\s+(.+)$/;

function indentOf(line: string): number {
  return (line.match(/^[ \t]*/)?.[0] ?? "").replace(/\t/g, "    ").length;
}

function dedent(line: string, n: number): string {
  let i = 0;
  let col = 0;
  while (i < line.length && col < n && (line[i] === " " || line[i] === "\t")) {
    col += line[i] === "\t" ? 4 : 1;
    i++;
  }
  return line.slice(i);
}

/**
 * A list marker at line `i`. "1." needs a space after it. A bare "-" or "*" (no space, no text)
 * is an empty item only when an indented line follows, so a lone "-" stays text.
 */
function listItemAt(lines: string[], i: number): RegExpMatchArray | null {
  const m = lines[i].match(LIST_ITEM);
  if (!m) return null;
  if (m[4] !== undefined) return m;
  if (!m[2]) return null;
  const next = lines[i + 1];
  return next !== undefined && next.trim() && indentOf(next) > indentOf(lines[i]) ? m : null;
}

/** Inline formatting for one leaf (paragraph, heading, cell, item text). Tokens never leave it. */
function inlineText(text: string): string {
  const codes: string[] = [];
  const held = text
    // Inline code keeps its backslashes: hold it before escapes are read.
    // An escaped backtick (\`) is literal, not a code-span delimiter.
    .replace(/(?<![\\`])(`+)(?!`)([^\n]*?[^`\n])\1(?!`)/g, (_m, _ticks, code: string) =>
      `\u0001c${codes.push(/^ .* $/.test(code) ? code.slice(1, -1) : code) - 1}\u0002`)
    .replace(ESC_RE, (_m, ch: string) => `\u0001e${ch.charCodeAt(0)}\u0002`);
  return inline(escapeHtml(held).replace(/\n/g, "<br>"), codes)
    .replace(/\u0001c(\d+)\u0002/g, (_m, i: string) => `<code>${escapeHtml(codes[Number(i)] ?? "")}</code>`)
    .replace(/\u0001e(\d+)\u0002/g, (_m, code: string) => escapeHtml(String.fromCharCode(Number(code))));
}

/** Length of the backtick run that ends `line` (ignoring trailing spaces), or 0 if under 3. */
function closingRun(line: string): number {
  let j = line.length - 1;
  while (j >= 0 && (line[j] === " " || line[j] === "\t")) j--;
  let run = 0;
  while (j >= 0 && line[j] === "`") {
    run++;
    j--;
  }
  return run >= 3 ? run : 0;
}

type Closer = (i: number) => { end: number; tail: string } | null;

/**
 * Fence closers for a block of lines, computed once. A closer is a line ending in a backtick
 * run: bare ("```") or after code ("x = 1```", as the old renderer allowed). `suffixMax` lets
 * an unclosed opener be rejected in O(1), so many unclosed fences stay linear.
 */
function fenceCloser(lines: string[]): Closer {
  const run = lines.map(closingRun);
  const suffixMax = new Array<number>(lines.length + 1).fill(0);
  for (let j = lines.length - 1; j >= 0; j--) suffixMax[j] = Math.max(run[j], suffixMax[j + 1]);
  return (i) => {
    const need = (lines[i].match(FENCE_OPEN)?.[2] ?? "").length;
    if (!need || suffixMax[i + 1] < need) return null;
    for (let j = i + 1; j < lines.length; j++) {
      if (run[j] >= need) return { end: j, tail: lines[j].replace(/\s*`{3,}\s*$/, "") };
    }
    return null;
  };
}

/** Can line `i` start a new block, i.e. interrupt a paragraph or an item's text? */
function startsBlock(lines: string[], i: number, closer: Closer, nested: boolean): boolean {
  const line = lines[i];
  if ((FENCE_OPEN.test(line) && closer(i)) || HEADING.test(line) || tableRow(line)) return true;
  if (nested && QUOTE_LINE.test(line)) return true;
  // Only an unindented "-", "*" or "1." may interrupt, so "  2024. was great" and indented
  // notes or YAML ("steps:\n  - run: a") stay text.
  const item = nested && indentOf(line) === 0 ? listItemAt(lines, i) : null;
  return Boolean(item && item[4] && (item[2] || item[3] === "1"));
}

/** "Text ```" + later "```": the fence opened at the end of a text line, as the old renderer read it. */
function splitTrailingFences(lines: string[]): string[] {
  const run = lines.map(closingRun);
  const suffixMax = new Array<number>(lines.length + 1).fill(0);
  for (let j = lines.length - 1; j >= 0; j--) suffixMax[j] = Math.max(run[j], suffixMax[j + 1]);
  const out: string[] = [];
  lines.forEach((line, i) => {
    const m = line.match(/^([^`]*\S)[ \t]*(`{3,}\w*)[ \t]*$/);
    // Quote and list lines are not split: "> ```js" opens a fence inside the quote.
    if (m && !FENCE_OPEN.test(line) && !QUOTE_LINE.test(line) && !LIST_ITEM.test(line) && suffixMax[i + 1] >= m[2].match(/^`+/)![0].length) out.push(m[1], m[2]);
    else out.push(line);
  });
  return out;
}

function renderMarkdown(src: string): string {
  return renderBlocks(src.replace(/[\u0001\u0002]/g, "").replace(/\r\n?/g, "\n").split("\n"), 0);
}

/**
 * Block structure on raw lines. Quotes and list items cut out their own lines and are rendered
 * recursively, so either can hold code blocks, quotes, lists and paragraphs. Nesting stops at
 * MAX_DEPTH (deeper markers read as text), so hostile input cannot exhaust the stack.
 */
function renderBlocks(raw: string[], depth: number): string {
  // Per level, so "a ```" inside a quote or an item's body opens a fence there too.
  const lines = splitTrailingFences(raw);
  const html: string[] = [];
  const closer = fenceCloser(lines);
  const nested = depth < MAX_DEPTH;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }
    const fence = FENCE_OPEN.test(line) ? closer(i) : null;
    if (fence) {
      const open = line.match(FENCE_OPEN)!;
      const pad = indentOf(open[1]);
      const body = lines.slice(i + 1, fence.end).map((l) => dedent(l, pad));
      if (fence.tail.trim()) body.push(dedent(fence.tail, pad));
      html.push(`<pre><code class="lang-${escapeHtml(open[3])}">${highlight(body.join("\n"))}</code></pre>`);
      i = fence.end + 1;
      continue;
    }
    if (nested && QUOTE_LINE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && QUOTE_LINE.test(lines[i])) quoted.push(lines[i++].replace(/^ {0,3}> ?/, ""));
      const inner = renderBlocks(quoted, depth + 1);
      // A one-paragraph quote stays compact: <blockquote>a<br>b</blockquote>.
      const single = inner.match(/^<p>((?:(?!<\/?p>)[\s\S])*)<\/p>$/);
      html.push(`<blockquote>${single ? single[1] : inner}</blockquote>`);
      continue;
    }
    if (tableRow(line)) {
      const rows: string[] = [];
      while (i < lines.length && tableRow(lines[i])) rows.push(lines[i++]);
      const cells = rows.map((r) => tableRow(r)!);
      if (rows.length >= 2 && cells[1].every((c) => /^:?-{1,}:?$/.test(c))) {
        const cell = (tag: string, c: string) => `<${tag}>${inlineText(c)}</${tag}>`;
        html.push(`<table><thead><tr>${cells[0].map((c) => cell("th", c)).join("")}</tr></thead><tbody>${
          cells.slice(2).map((r) => `<tr>${r.map((c) => cell("td", c)).join("")}</tr>`).join("")}</tbody></table>`);
      } else {
        // Not a real table (no |---| line): keep the lines verbatim as a paragraph.
        html.push(`<p>${inlineText(rows.join("\n"))}</p>`);
      }
      continue;
    }
    const heading = line.match(HEADING);
    if (heading) {
      const n = heading[1].length;
      html.push(`<h${n}>${inlineText(heading[2])}</h${n}>`);
      i++;
      continue;
    }
    // At the top level a marker indented 4+ is not a list start (indented notes, CLI output);
    // inside a quote or an item's body any indent nests.
    if (nested && (depth > 0 || indentOf(line) < 4) && listItemAt(lines, i)) {
      i = renderList(lines, i, depth, html);
      continue;
    }
    const start = i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !startsBlock(lines, i, closer, nested)) i++;
    html.push(`<p>${inlineText(lines.slice(start, i).join("\n"))}</p>`);
  }
  return html.join("");
}

/**
 * One list starting at line `i`; returns the index after it. Lines indented past the item's
 * marker (and blank lines followed by such lines) belong to that item and are rendered as its
 * body; a fenced block opened in the body runs to its closer even if that closer is outdented.
 * A later marker at the same or a smaller indent is the next sibling if it is the same kind of
 * list; a different kind ends the list.
 */
/**
 * Closer for a fence opened at line `j` inside an item whose marker is at indent `own`: the
 * first line ending in a long enough backtick run, unless a non-blank line at or left of the
 * marker comes first (the item ended, so the fence is unclosed). `noCloserBefore` remembers a
 * scan that met no closer at all, so many unclosed fences in one item stay linear.
 */
function itemFenceEnd(lines: string[], j: number, own: number, memo: { noCloserBefore: number }): number {
  const need = (lines[j].match(FENCE_OPEN)?.[2] ?? "").length;
  if (j < memo.noCloserBefore) return -1;
  let sawRun = false;
  for (let k = j + 1; k < lines.length; k++) {
    const run = closingRun(lines[k]);
    if (run >= need) return k;
    if (run) sawRun = true;
    if (lines[k].trim() && indentOf(lines[k]) <= own) {
      if (!sawRun) memo.noCloserBefore = k;
      return -1;
    }
  }
  if (!sawRun) memo.noCloserBefore = lines.length;
  return -1;
}

function renderList(lines: string[], i: number, depth: number, html: string[]): number {
  const memo = { noCloserBefore: -1 };
  const first = listItemAt(lines, i)!;
  const kind = first[2] ? "ul" : "ol";
  const start = first[3] ? Number(first[3]) : 1;
  const base = indentOf(lines[i]);
  const lis: string[] = [];
  while (i < lines.length) {
    const m = listItemAt(lines, i);
    if (!m || indentOf(lines[i]) > base || (m[2] ? "ul" : "ol") !== kind) break;
    const own = indentOf(lines[i]);
    const contentCol = own + (m[2] ?? `${m[3]}.`).length + 1;
    const take = (l: string) => dedent(l, Math.min(contentCol, indentOf(l)));
    const body: string[] = [];
    let j = i + 1;
    while (j < lines.length) {
      if (/^\s*$/.test(lines[j])) {
        let k = j;
        while (k < lines.length && /^\s*$/.test(lines[k])) k++;
        if (k < lines.length && indentOf(lines[k]) > own) {
          for (; j < k; j++) body.push("");
          continue;
        }
        break;
      }
      if (indentOf(lines[j]) <= own) break;
      const fenceEnd = FENCE_OPEN.test(lines[j]) ? itemFenceEnd(lines, j, own, memo) : -1;
      if (fenceEnd > 0) {
        for (let f = j; f <= fenceEnd; f++) body.push(take(lines[f]));
        j = fenceEnd + 1;
        continue;
      }
      body.push(take(lines[j]));
      j++;
    }
    // "- a ```" + an indented body: the fence opened at the end of the marker line.
    let first = m[4];
    const trailing = first?.match(/^([^`]*\S)[ \t]*(`{3,}\w*)[ \t]*$/);
    if (trailing && fenceCloser([trailing[2], ...body])(0)) {
      first = trailing[1];
      body.unshift(trailing[2]);
    }
    // Plain lines right under the item continue its text ("- a\n  more" is one item, two lines).
    const bodyCloser = fenceCloser(body);
    let cut = 0;
    // A marker indented past the item's text is a nested list whatever its number; one level
    // with the text follows the paragraph rule ("- Our year\n  2024. was great" stays text).
    const nestedList = (k: number) => indentOf(body[k]) > 0 && Boolean(listItemAt(body, k));
    if (first) {
      while (cut < body.length && body[cut].trim() && !nestedList(cut)
        && !startsBlock(body, cut, bodyCloser, depth + 1 < MAX_DEPTH)) cut++;
    }
    const text = first ? [first, ...body.slice(0, cut)].join("\n") : "";
    const rest = body.slice(cut);
    lis.push(`<li>${text ? inlineText(text) : ""}${rest.length ? renderBlocks(rest, depth + 1) : ""}</li>`);
    i = j;
    // A blank line between siblings keeps one (loose) list.
    let k = i;
    while (k < lines.length && /^\s*$/.test(lines[k])) k++;
    const next = k < lines.length ? listItemAt(lines, k) : null;
    if (next && indentOf(lines[k]) <= base && (next[2] ? "ul" : "ol") === kind) i = k;
    else break;
  }
  const attr = kind === "ol" && start !== 1 ? ` start="${start}"` : "";
  html.push(`<${kind}${attr}>${lis.join("")}</${kind}>`);
  return i;
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|#39);/gi, (_m, ent: string) => {
    const e = ent.toLowerCase();
    if (e === "amp") return "&";
    if (e === "lt") return "<";
    if (e === "gt") return ">";
    if (e === "quot") return '"';
    if (e === "apos" || e === "#39") return "'";
    const code = e.startsWith("#x") ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
  });
}

export function sanitizeHtml(src: string): string {
  // One pass over tags *and* stray angle brackets: a stray "<" is escaped, so dropping a
  // disallowed tag can never glue the text around it into a new tag (e.g. "<<x>img onerror=…>").
  return src
    .replace(/<(style|title|noscript|template|iframe|object|xmp)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^<>]*)\/?>|[<>]/g, (raw: string, name: string | undefined, attrs: string) => {
    if (raw === "<") return "&lt;";
    if (raw === ">") return "&gt;";
    const tag = (name || "").toLowerCase();
    const close = raw.startsWith("</");
    if (!ALLOWED.has(tag)) return "";
    if (close) return `</${tag}>`;
    const selfClose = raw.endsWith("/>") || tag === "br" || tag === "img" || tag === "hr";
    let out = `<${tag}`;
    const allowed = ATTRS[tag];
    if (allowed) {
      const re = /([a-zA-Z:-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(attrs))) {
        const attr = m[1].toLowerCase();
        if (!allowed.has(attr)) continue;
        if (m[2] === undefined && attr !== "controls") continue;
        const value = decodeEntities(m[3] ?? m[4] ?? m[5] ?? "");
        if (attr === "href" || attr === "src" || attr === "poster") {
          const url = safeUrl(value);
          if (!url) continue;
          out += ` ${attr}="${escapeHtml(url)}"`;
        } else if (attr === "controls") {
          out += " controls";
        } else if (attr === "start") {
          const n = parseInt(value, 10);
          if (Number.isFinite(n)) out += ` start="${n}"`;
        } else {
          out += ` ${attr}="${escapeHtml(value)}"`;
        }
      }
    }
    if (tag === "a") out += ' rel="noreferrer"';
    out += selfClose && tag !== "video" && tag !== "audio" ? " />" : ">";
    return out;
  });
}

function looksLikeHtml(src: string): boolean {
  return /^\s*</.test(src) && /<\/?[a-zA-Z]/.test(src);
}

export function renderClip(src: string): string {
  const text = src.replace(/^\uFEFF/, "");
  if (looksLikeHtml(text)) return sanitizeHtml(text);
  return renderMarkdown(text);
}
