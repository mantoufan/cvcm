const ALLOWED = new Set([
  "p", "br", "h1", "h2", "h3", "h4", "pre", "code", "ul", "ol", "li",
  "a", "img", "video", "source", "blockquote", "strong", "em", "b", "i",
  "u", "s", "strike", "del", "hr", "span", "div", "table", "thead", "tbody", "tr", "th", "td",
]);

const ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title"]),
  img: new Set(["src", "alt"]),
  video: new Set(["src", "controls", "poster"]),
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

function tableRow(line: string): string[] | null {
  const m = line.trim().match(/^\|(.*)\|$/);
  if (!m) return null;
  return m[1].split("|").map((c) => c.trim());
}

const MAX_DEPTH = 8;
const FENCE_OPEN = /^(`{3,})(\w*)\s*$/;

/** Index of the line that closes the fence opened at `i` (same or longer backtick run), or -1. */
function fenceEnd(lines: string[], i: number): number {
  const run = (lines[i].match(FENCE_OPEN)?.[1] ?? "").length;
  for (let j = i + 1; j < lines.length; j++) {
    const close = lines[j].match(/^(`{3,})\s*$/);
    if (close && close[1].length >= run) return j;
  }
  return -1;
}

/**
 * Split into quote blocks (runs of lines starting with ">") and everything else. A quote's
 * inside is rendered again, so it can hold code blocks, lists and paragraphs. Fenced code is
 * never read as a quote. Nesting stops at MAX_DEPTH so hostile input cannot exhaust the stack.
 */
function renderMarkdown(src: string, depth = 0): string {
  const lines = src.replace(/[\u0001\u0002]/g, "").replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let buf: string[] = [];
  const flushBuf = () => {
    if (buf.length) out.push(renderBlocks(buf));
    buf = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const end = FENCE_OPEN.test(lines[i]) ? fenceEnd(lines, i) : -1;
    if (end > 0) {
      buf.push(...lines.slice(i, end + 1));
      i = end;
      continue;
    }
    if (depth < MAX_DEPTH && lines[i].startsWith(">")) {
      flushBuf();
      const quoted: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) quoted.push(lines[i++].replace(/^> ?/, ""));
      i--;
      const inner = renderMarkdown(quoted.join("\n"), depth + 1);
      // A one-paragraph quote stays compact: <blockquote>a<br>b</blockquote>.
      const single = inner.match(/^<p>((?:(?!<\/?p>)[\s\S])*)<\/p>$/);
      out.push(`<blockquote>${single ? single[1] : inner}</blockquote>`);
      continue;
    }
    buf.push(lines[i]);
  }
  flushBuf();
  return out.join("");
}

type ListItem = { indent: number; kind: "ul" | "ol"; start: number; text: string };

/** Build nested <ul>/<ol> from items by indentation; a deeper item nests in the previous one. */
function renderList(items: ListItem[], codes: string[]): string {
  let i = 0;
  const build = (indent: number, depth: number): string => {
    const { kind, start } = items[i];
    const lis: string[] = [];
    while (i < items.length && items[i].indent >= indent) {
      const it = items[i];
      if (it.indent > indent && depth < MAX_DEPTH) {
        const sub = build(it.indent, depth + 1);
        if (lis.length) lis[lis.length - 1] += sub;
        else lis.push(sub);
        continue;
      }
      if (it.kind !== kind) break;
      lis.push(inline(escapeHtml(it.text), codes));
      i++;
    }
    const attr = kind === "ol" && start !== 1 ? ` start="${start}"` : "";
    return `<${kind}${attr}>${lis.map((li) => `<li>${li}</li>`).join("")}</${kind}>`;
  };
  let html = "";
  while (i < items.length) html += build(items[i].indent, 0);
  return html;
}

function renderBlocks(src: string[]): string {
  const fences: string[] = [];
  const codes: string[] = [];
  const kept: string[] = [];
  for (let i = 0; i < src.length; i++) {
    const open = src[i].match(FENCE_OPEN);
    const end = open ? fenceEnd(src, i) : -1;
    if (open && end > 0) {
      const code = src.slice(i + 1, end).join("\n");
      const n = fences.push(`<pre><code class="lang-${escapeHtml(open[2])}">${highlight(code)}</code></pre>`) - 1;
      kept.push(`\u0001f${n}\u0002`);
      i = end;
    } else kept.push(src[i]);
  }
  const protectedSrc = kept.join("\n")
    // Inline code keeps its backslashes: hold it before escapes are read.
    // An escaped backtick (\`) is literal, not a code-span delimiter.
    .replace(/(?<![\\`])(`+)(?!`)([^\n]*?[^`\n])\1(?!`)/g, (_m, _ticks, code: string) =>
      `\u0001c${codes.push(/^ .* $/.test(code) ? code.slice(1, -1) : code) - 1}\u0002`)
    .replace(ESC_RE, (_m, ch: string) => `\u0001e${ch.charCodeAt(0)}\u0002`);
  const lines = protectedSrc.split("\n");
  const html: string[] = [];
  let para: string[] = [];
  let list: ListItem[] = [];
  const flushList = () => {
    if (list.length) html.push(renderList(list, codes));
    list = [];
  };
  let table: { head: string[]; rows: string[][]; sep: boolean; raw: string[] } | null = null;
  const flushTable = () => {
    if (!table) return;
    const t = table;
    table = null;
    if (!t.sep) {
      // Not a real table (no |---| line): keep the lines as a paragraph.
      para.push(...t.raw);
      return;
    }
    const cell = (tag: string, c: string) => `<${tag}>${inline(escapeHtml(c), codes)}</${tag}>`;
    html.push(`<table><thead><tr>${t.head.map((c) => cell("th", c)).join("")}</tr></thead><tbody>${
      t.rows.map((r) => `<tr>${r.map((c) => cell("td", c)).join("")}</tr>`).join("")}</tbody></table>`);
  };
  const flush = () => {
    flushTable();
    flushList();
    if (!para.length) return;
    const text = para.join("\n");
    para = [];
    html.push(`<p>${inline(escapeHtml(text).replace(/\n/g, "<br>"), codes)}</p>`);
  };
  for (const line of lines) {
    const fence = line.trim().match(/^\u0001f(\d+)\u0002$/);
    if (fence) {
      flush();
      html.push(fences[Number(fence[1])]);
      continue;
    }
    if (/^\s*$/.test(line)) {
      // A blank line between list items keeps one (loose) list; it still ends paragraphs.
      if (list.length && !para.length) continue;
      flush();
      continue;
    }
    const cells = tableRow(line);
    if (cells) {
      if (table) table.raw.push(line);
      if (!table) {
        flush();
        table = { head: cells, rows: [], sep: false, raw: [line] };
      } else if (!table.sep && cells.every((c) => /^:?-{1,}:?$/.test(c))) table.sep = true;
      else table.rows.push(cells);
      continue;
    }
    flushTable();
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flush();
      const n = heading[1].length;
      html.push(`<h${n}>${inline(escapeHtml(heading[2]), codes)}</h${n}>`);
      continue;
    }
    const item = line.match(/^([ \t]*)(?:([-*])|(\d+)[.)])\s+(.*)$/);
    if (item) {
      if (para.length) flush();
      list.push({
        indent: item[1].replace(/\t/g, "    ").length,
        kind: item[2] ? "ul" : "ol",
        start: item[3] ? Number(item[3]) : 1,
        text: item[4],
      });
      continue;
    }
    flushList();
    para.push(line);
  }
  flush();
  return html.join("")
    .replace(/\u0001c(\d+)\u0002/g, (_m, i: string) => `<code>${escapeHtml(codes[Number(i)] ?? "")}</code>`)
    .replace(/\u0001e(\d+)\u0002/g, (_m, code: string) => escapeHtml(String.fromCharCode(Number(code))));
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
    out += selfClose && tag !== "video" ? " />" : ">";
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
