/**
 * Prerendered page bodies packed into a fixed number of files.
 *
 * Workers Free allows 20,000 static asset files per version, and one HTML file per page (over 10,000 pages and
 * growing) would use most of them. The build (scripts/pack-ssr.mjs) groups the bodies into SSR_BUCKETS files by a hash
 * of the page path; the Worker fetches the page's bucket and decodes only that page's bytes, so the cost per request
 * stays small however many pages share the file.
 *
 * File layout: the magic line, then one line of JSON mapping each path to [byte offset, byte length] within the
 * bodies that follow, then the bodies (UTF-8) back to back.
 */

/** Bucket count. Fixed so the asset file count no longer grows with pages; about 5–10 pages per file today. */
export const SSR_BUCKETS = 2048;
export const SSR_PACK_MAGIC = "cvcm-ssr-pack-1\n";

/** FNV-1a (32-bit) of the path, as a bucket file name: three hex digits, "000"–"7ff". */
export function ssrBucket(path: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < path.length; i++) {
    h ^= path.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h % SSR_BUCKETS).toString(16).padStart(3, "0");
}

/** Where a page's bucket lives among the static assets. */
export function ssrPackPath(pagePath: string): string {
  return `/_ssr/${ssrBucket(pagePath)}.pack`;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Packs [path, body] pairs (all of one bucket) into one file. */
export function encodePack(entries: ReadonlyArray<readonly [string, string]>): Uint8Array<ArrayBuffer> {
  const bodies = entries.map(([, body]) => encoder.encode(body));
  const index: Record<string, [number, number]> = {};
  let offset = 0;
  entries.forEach(([path], i) => {
    index[path] = [offset, bodies[i]!.length];
    offset += bodies[i]!.length;
  });
  const head = encoder.encode(`${SSR_PACK_MAGIC}${JSON.stringify(index)}\n`);
  const out = new Uint8Array(head.length + offset);
  out.set(head, 0);
  let at = head.length;
  for (const b of bodies) {
    out.set(b, at);
    at += b.length;
  }
  return out;
}

/** The body packed for `path`, or null (not a pack, or the page is not in it). */
export function readPack(buf: ArrayBuffer | Uint8Array, path: string): string | null {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const magic = encoder.encode(SSR_PACK_MAGIC);
  if (bytes.length < magic.length) return null;
  for (let i = 0; i < magic.length; i++) if (bytes[i] !== magic[i]) return null;
  const end = bytes.indexOf(10, magic.length);
  if (end < 0) return null;
  let index: Record<string, [number, number]>;
  try {
    index = JSON.parse(decoder.decode(bytes.subarray(magic.length, end)));
  } catch {
    return null;
  }
  const hit = index[path];
  if (!hit) return null;
  const start = end + 1 + hit[0];
  if (start + hit[1] > bytes.length) return null;
  return decoder.decode(bytes.subarray(start, start + hit[1]));
}
