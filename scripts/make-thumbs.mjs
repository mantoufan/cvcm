// Writes small WebP copies of the covers listed in src/shared/covers.ts to dist/thumbs/,
// at the URLs thumbSrc() builds. Menus and tiles show these instead of the 1280×720 originals.
// Production serves /covers/ from S3 first, so S3 is the source of truth: the git copy is used
// when it matches S3's size, otherwise (missing or out of date locally) the S3 file is fetched.
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { THUMB_WIDTHS, coverRefs, thumbFile } from "./thumbs-lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const S3 = "https://s3.cv.cm/files";
const refs = coverRefs(readFileSync(resolve(root, "src/shared/covers.ts"), "utf8"));

async function source(path) {
  const file = resolve(root, "public", path.slice(1));
  const local = existsSync(file) ? statSync(file).size : -1;
  let remote = -1;
  try {
    const head = await fetch(`${S3}${path}`, { method: "HEAD" });
    if (head.ok) remote = Number(head.headers.get("content-length") ?? -1);
  } catch {
    /* offline build: fall back to the git copy */
  }
  if (local >= 0 && (remote < 0 || remote === local)) return { input: file, from: "git" };
  if (remote < 0) return null;
  const res = await fetch(`${S3}${path}`);
  if (!res.ok) return null;
  return { input: Buffer.from(await res.arrayBuffer()), from: "s3" };
}

const counts = { git: 0, s3: 0, skipped: [] };
const queue = [...refs];
async function worker() {
  for (let ref = queue.shift(); ref; ref = queue.shift()) {
    const src = await source(ref.path);
    if (!src) {
      counts.skipped.push(ref.path);
      continue;
    }
    counts[src.from]++;
    const image = sharp(src.input);
    for (const width of THUMB_WIDTHS) {
      const out = resolve(root, "dist", thumbFile(ref.path, ref.v, width).slice(1));
      mkdirSync(dirname(out), { recursive: true });
      await image.clone().resize({ width, withoutEnlargement: true }).webp({ quality: width <= 160 ? 70 : 78 }).toFile(out);
    }
  }
}
await Promise.all(Array.from({ length: 12 }, worker));
console.log(`thumbs: ${refs.length} covers (${counts.git} from git, ${counts.s3} from S3)`);
// The Worker redirects these thumb URLs to the original cover.
if (counts.skipped.length) console.warn(`thumbs: no source for ${counts.skipped.join(", ")}`);
