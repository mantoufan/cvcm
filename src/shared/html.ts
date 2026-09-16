const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
};

export function encodeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => {
    if (ch === "&") return "&amp;";
    if (ch === "<") return "&lt;";
    if (ch === ">") return "&gt;";
    if (ch === '"') return "&quot;";
    return "&#39;";
  });
}

export function decodeHtml(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]+);/g, (full, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const n = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : full;
    }
    if (body.startsWith("#")) {
      const n = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : full;
    }
    return NAMED[body.toLowerCase()] ?? full;
  });
}
