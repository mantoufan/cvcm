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
function inline(text: string): string {
  const held: string[] = [];
  const hold = (html: string) => `\u0000h${held.push(html) - 1}\u0000`;
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt: string, href: string) => {
      const url = safeUrl(unescapeHtml(href));
      if (!url) return alt;
      if (isVideo(url)) return hold(`<video controls src="${escapeHtml(url)}"></video>`);
      return hold(`<img src="${escapeHtml(url)}" alt="${alt}">`);
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, href: string) => {
      const url = safeUrl(unescapeHtml(href));
      if (!url) return label;
      return `${hold(`<a href="${escapeHtml(url)}" rel="noreferrer">`)}${label}${hold("</a>")}`;
    })
    .replace(/`([^`]+)`/g, (_m, code: string) => hold(`<code>${code}</code>`))
    .replace(/\+\+([^+]+)\+\+/g, (_m, s) => `<u>${s}</u>`)
    .replace(/~~([^~]+)~~/g, (_m, s) => `<s>${s}</s>`)
    .replace(/\*\*([^*]+)\*\*/g, (_m, s) => `<strong>${s}</strong>`)
    .replace(/\*([^*]+)\*/g, (_m, s) => `<em>${s}</em>`)
    .replace(/\u0000h(\d+)\u0000/g, (_m, i: string) => held[Number(i)]);
}

// Backslash escapes (\* \# \< …) become NUL-delimited tokens so no rule below treats them as syntax.
const ESC_RE = /\\([\\`*_~\[\]()#+\-.!<>|])/g;

function tableRow(line: string): string[] | null {
  const m = line.trim().match(/^\|(.*)\|$/);
  if (!m) return null;
  return m[1].split("|").map((c) => c.trim());
}

function renderMarkdown(src: string): string {
  const fences: string[] = [];
  const codes: string[] = [];
  const protectedSrc = src.replace(/\u0000/g, "").replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const i = fences.length;
    fences.push(`<pre><code class="lang-${escapeHtml(lang)}">${highlight(code.replace(/\n$/, ""))}</code></pre>`);
    return `\n%%FENCE${i}%%\n`;
  })
    // Inline code keeps its backslashes: hold it before escapes are read.
    .replace(/`([^`\n]+)`/g, (_m, code: string) => `\u0000c${codes.push(code) - 1}\u0000`)
    .replace(ESC_RE, (_m, ch: string) => `\u0000${ch.charCodeAt(0)}\u0000`);
  const lines = protectedSrc.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let para: string[] = [];
  let group: { kind: "ul" | "ol" | "quote"; items: string[]; start: number } | null = null;
  const flushGroup = () => {
    if (!group) return;
    if (group.kind === "quote") html.push(`<blockquote>${group.items.join("<br>")}</blockquote>`);
    else {
      const start = group.kind === "ol" && group.start !== 1 ? ` start="${group.start}"` : "";
      html.push(`<${group.kind}${start}>${group.items.map((li) => `<li>${li}</li>`).join("")}</${group.kind}>`);
    }
    group = null;
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
    const cell = (tag: string, c: string) => `<${tag}>${inline(escapeHtml(c))}</${tag}>`;
    html.push(`<table><thead><tr>${t.head.map((c) => cell("th", c)).join("")}</tr></thead><tbody>${
      t.rows.map((r) => `<tr>${r.map((c) => cell("td", c)).join("")}</tr>`).join("")}</tbody></table>`);
  };
  const flush = () => {
    flushTable();
    flushGroup();
    if (!para.length) return;
    const text = para.join("\n");
    para = [];
    html.push(`<p>${inline(escapeHtml(text).replace(/\n/g, "<br>"))}</p>`);
  };
  // Read through a function: TS narrows the closure-assigned `group` to null inside the loop.
  const openList = () => group !== null && group.kind !== "quote";
  const addItem = (kind: "ul" | "ol" | "quote", text: string, start = 1) => {
    if (para.length) flush();
    if (group && group.kind !== kind) flushGroup();
    if (!group) group = { kind, items: [], start };
    group.items.push(inline(escapeHtml(text)));
  };
  for (const line of lines) {
    const fence = line.trim().match(/^%%FENCE(\d+)%%$/);
    if (fence) {
      flush();
      html.push(fences[Number(fence[1])]);
      continue;
    }
    if (/^\s*$/.test(line)) {
      // A blank line between list items keeps one (loose) list; it still ends quotes and paragraphs.
      if (openList() && !para.length) continue;
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
      html.push(`<h${n}>${inline(escapeHtml(heading[2]))}</h${n}>`);
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      addItem("ul", bullet[1]);
      continue;
    }
    const ordered = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (ordered) {
      addItem("ol", ordered[2], Number(ordered[1]));
      continue;
    }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      addItem("quote", quote[1]);
      continue;
    }
    flushGroup();
    para.push(line);
  }
  flush();
  return html.join("")
    .replace(/\u0000c(\d+)\u0000/g, (_m, i: string) => `<code>${escapeHtml(codes[Number(i)])}</code>`)
    .replace(/\u0000(\d+)\u0000/g, (_m, code: string) => escapeHtml(String.fromCharCode(Number(code))));
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
  return src.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^<>]*)\/?>|[<>]/g, (raw: string, name: string | undefined, attrs: string) => {
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
