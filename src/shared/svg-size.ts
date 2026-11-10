/**
 * SVG to PNG: the size an SVG file draws at, and a copy of the file with an explicit pixel size so it can be drawn
 * sharp at any scale (Firefox will not draw an SVG without one, and an SVG without a viewBox does not scale).
 */

/** CSS pixels per unit, as browsers resolve them (1in = 96px). Relative units fall back to a 16px font. */
const PX: Record<string, number> = { "": 1, px: 1, pt: 96 / 72, pc: 16, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, q: 96 / 101.6, em: 16, rem: 16 };

/** The largest edge a rasterised SVG may have. */
export const MAX_SVG_EDGE = 8192;
/** The most pixels one: iOS Safari will not draw a canvas larger than 16,777,216 pixels (4096 × 4096). */
export const MAX_SVG_PIXELS = 16_777_216;

export type SvgInfo = { width: number; height: number; tag: string; tagStart: number; tagEnd: number; hasViewBox: boolean };

function attr(tag: string, name: string): string | null {
  // XML attribute names are case-sensitive: browsers ignore a lowercase "viewbox".
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(tag);
  return m ? (m[1] ?? m[2] ?? "") : null;
}

/** A length attribute in px, or null for a missing, percentage or unreadable one. */
export function svgLength(value: string | null): number | null {
  if (value === null) return null;
  const m = /^\s*([+]?\d*\.?\d+(?:e[+-]?\d+)?)\s*(px|pt|pc|in|cm|mm|q|em|rem)?\s*$/i.exec(value);
  if (!m) return null;
  const n = Number(m[1]) * PX[(m[2] ?? "").toLowerCase()]!;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Reads the root <svg> tag. The size is width/height when both are absolute lengths; one of them with the viewBox
 * ratio; the viewBox size when neither is given; else 300 × 150, the CSS default for a replaced element.
 */
export function readSvg(text: string): SvgInfo | null {
  // Blank out comments, CDATA and the DOCTYPE (same length, so offsets still match) before looking for the root tag.
  const masked = text.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<!DOCTYPE[^>[]*(?:\[[\s\S]*?\])?\s*>/gi, (x) => " ".repeat(x.length));
  // A plain <svg> root only: a prefixed <svg:svg> is left to the browser (rewriting it would break the markup).
  const m = /<svg(?=[\s/>])(?:"[^"]*"|'[^']*'|[^'">])*>/i.exec(masked);
  if (!m) return null;
  const tag = text.slice(m.index, m.index + m[0].length);
  const vb = (attr(tag, "viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
  const vbw = vb.length === 4 && vb[2]! > 0 ? vb[2]! : null;
  const vbh = vb.length === 4 && vb[3]! > 0 ? vb[3]! : null;
  let width = svgLength(attr(tag, "width"));
  let height = svgLength(attr(tag, "height"));
  const ratio = vbw && vbh ? vbw / vbh : null;
  if (width && !height) height = ratio ? width / ratio : 150;
  if (height && !width) width = ratio ? height * ratio : 300;
  if (!width || !height) {
    width = vbw && vbh ? vbw : 300;
    height = vbw && vbh ? vbh : 150;
  }
  return { width, height, tag, tagStart: m.index, tagEnd: m.index + tag.length, hasViewBox: ratio !== null };
}

/** Pixel size at `scale`, shrunk to fit MAX_SVG_EDGE and MAX_SVG_PIXELS, never under 1 px. */
export function svgPixelSize(info: Pick<SvgInfo, "width" | "height">, scale: number): { width: number; height: number } {
  const fit = Math.min(scale, MAX_SVG_EDGE / Math.max(info.width, info.height), Math.sqrt(MAX_SVG_PIXELS / (info.width * info.height)));
  // Rounding up could cross the pixel cap by a row; floor keeps it under.
  return { width: Math.max(1, Math.floor(info.width * fit + 1e-9)), height: Math.max(1, Math.floor(info.height * fit + 1e-9)) };
}

/**
 * The SVG text with width/height set to the target pixels. Without a viewBox one is added from the original size, so
 * the drawing scales with the new width and height instead of staying put in the corner.
 */
export function sizedSvg(text: string, info: SvgInfo, width: number, height: number): string {
  let tag = info.tag.replace(/\s(width|height)\s*=\s*(?:"[^"]*"|'[^']*')/g, "");
  const extra = ` width="${width}" height="${height}"${info.hasViewBox ? "" : ` viewBox="0 0 ${info.width} ${info.height}"`}`;
  if (!info.hasViewBox) tag = tag.replace(/\sviewBox\s*=\s*(?:"[^"]*"|'[^']*')/, "");
  tag = tag.replace(/^<svg\b/i, `<svg${extra}`);
  return text.slice(0, info.tagStart) + tag + text.slice(info.tagEnd);
}

export function isSvgFile(file: { name: string; type: string }): boolean {
  return file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
}

/**
 * An SVG file's bytes as text, decoded the way an XML parser would (byte-order mark, else the encoding declaration,
 * else UTF-8), with the declaration rewritten to UTF-8 because the text is saved again as UTF-8 for drawing.
 */
export function svgText(bytes: ArrayBuffer): string {
  const b = new Uint8Array(bytes);
  let label = "utf-8";
  if (b[0] === 0xfe && b[1] === 0xff) label = "utf-16be";
  else if (b[0] === 0xff && b[1] === 0xfe) label = "utf-16le";
  else {
    const head = String.fromCharCode(...b.subarray(0, 200));
    const m = /^(?:\uFEFF|\xEF\xBB\xBF)?<\?xml[^>]*\sencoding\s*=\s*["']([A-Za-z0-9._-]+)["']/.exec(head);
    if (m) label = m[1]!;
  }
  let text: string;
  try {
    text = new TextDecoder(label).decode(b);
  } catch {
    text = new TextDecoder("utf-8").decode(b);
  }
  return text.replace(/^(\uFEFF?<\?xml[^>]*\sencoding\s*=\s*)(["'])[^"']*\2/, "$1$2UTF-8$2");
}
