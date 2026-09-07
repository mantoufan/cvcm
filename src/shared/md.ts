const ALLOWED = new Set([
  "p", "br", "h1", "h2", "h3", "h4", "pre", "code", "ul", "ol", "li",
  "a", "img", "video", "source", "blockquote", "strong", "em", "b", "i",
  "u", "hr", "span", "div", "table", "thead", "tbody", "tr", "th", "td",
]);

const ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title"]),
  img: new Set(["src", "alt"]),
  video: new Set(["src", "controls", "poster"]),
  source: new Set(["src", "type"]),
  code: new Set(["class"]),
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

function inline(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, href) => {
      const url = safeUrl(href);
      if (!url) return escapeHtml(alt);
      if (isVideo(url)) {
        return `<video controls src="${escapeHtml(url)}"></video>`;
      }
      return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}">`;
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
      const url = safeUrl(href);
      if (!url) return escapeHtml(label);
      return `<a href="${escapeHtml(url)}" rel="noreferrer">${escapeHtml(label)}</a>`;
    })
    .replace(/`([^`]+)`/g, (_m, code) => `<code>${escapeHtml(code)}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, (_m, s) => `<strong>${s}</strong>`)
    .replace(/\*([^*]+)\*/g, (_m, s) => `<em>${s}</em>`);
}

function renderMarkdown(src: string): string {
  const fences: string[] = [];
  const protectedSrc = src.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const i = fences.length;
    fences.push(`<pre><code class="lang-${escapeHtml(lang)}">${highlight(code.replace(/\n$/, ""))}</code></pre>`);
    return `\n%%FENCE${i}%%\n`;
  });
  const lines = protectedSrc.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (!para.length) return;
    const text = para.join("\n");
    para = [];
    if (/^%%FENCE\d+%%$/.test(text.trim())) {
      html.push(text.trim());
      return;
    }
    html.push(`<p>${inline(escapeHtml(text).replace(/\n/g, "<br>"))}</p>`);
  };
  for (const line of lines) {
    const fence = line.trim().match(/^%%FENCE(\d+)%%$/);
    if (fence) {
      flush();
      html.push(fences[Number(fence[1])]);
      continue;
    }
    if (/^\s*$/.test(line)) {
      flush();
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flush();
      const n = heading[1].length;
      html.push(`<h${n}>${inline(escapeHtml(heading[2]))}</h${n}>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flush();
      html.push(`<ul><li>${inline(escapeHtml(line.replace(/^[-*]\s+/, "")))}</li></ul>`);
      continue;
    }
    para.push(line);
  }
  flush();
  return html.join("").replace(/<\/ul><ul>/g, "");
}

function sanitizeHtml(src: string): string {
  return src.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)\/?>/g, (raw, name: string, attrs: string) => {
    const tag = name.toLowerCase();
    const close = raw.startsWith("</");
    if (!ALLOWED.has(tag)) return "";
    if (close) return `</${tag}>`;
    const selfClose = raw.endsWith("/>") || tag === "br" || tag === "img" || tag === "hr";
    let out = `<${tag}`;
    const allowed = ATTRS[tag];
    if (allowed) {
      const re = /([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(attrs))) {
        const attr = m[1].toLowerCase();
        if (!allowed.has(attr)) continue;
        const value = m[3] ?? m[4] ?? m[5] ?? "";
        if (attr === "href" || attr === "src" || attr === "poster") {
          const url = safeUrl(value);
          if (!url) continue;
          out += ` ${attr}="${escapeHtml(url)}"`;
        } else if (attr === "controls") {
          out += " controls";
        } else {
          out += ` ${attr}="${escapeHtml(value)}"`;
        }
      }
    }
    if (tag === "a") out += ' rel="noreferrer"';
    out += selfClose && tag !== "video" ? " />" : ">";
    return out;
  }).replace(/on[a-z]+\s*=/gi, "");
}

function looksLikeHtml(src: string): boolean {
  return /^\s*</.test(src) && /<\/?[a-zA-Z]/.test(src);
}

export function renderClip(src: string): string {
  const text = src.replace(/^\uFEFF/, "");
  if (looksLikeHtml(text)) return sanitizeHtml(text);
  return renderMarkdown(text);
}
