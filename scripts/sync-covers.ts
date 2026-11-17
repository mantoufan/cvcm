/**
 * Put every cover (public/covers/**) on s3.cv.cm under files/covers/. Pages link to the bucket directly and the
 * covers are not deployed as Worker assets (see scripts/cover-origin.mjs), so CI runs this before `wrangler deploy`
 * and fails the deploy if any file did not make it:
 *
 *   S3_ACCESS_KEY_ID=… S3_SECRET_ACCESS_KEY=… node scripts/sync-covers.mjs [--dry-run]
 *
 * files/covers/.manifest.json records the SHA-256 of each file uploaded, so an edited cover is put again even at the
 * same size. A file the manifest does not know is checked by size (HEAD). Overwritten files are purged from the
 * Cloudflare cache when CLOUDFLARE_API_TOKEN is set; pages still bump `?v=` when a cover changes.
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { presignS3Put, type S3Config } from "../src/s3-sign";
import { COVER_ORIGIN } from "../src/shared/covers";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  json: "application/json",
};
const CONCURRENCY = 8;
const MANIFEST = "covers/.manifest.json";
const ZONE_ID = "4c10d62fefca26eabfda88ebda06cf81"; // cv.cm
const dryRun = process.argv.includes("--dry-run");

const dir = resolve(process.cwd(), "public/covers");

async function walk(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(entries.map((e) => (e.isDirectory() ? walk(join(path, e.name)) : [join(path, e.name)])));
  return nested.flat();
}

const accessKey = process.env.S3_ACCESS_KEY_ID;
const secret = process.env.S3_SECRET_ACCESS_KEY;
if (!dryRun && (!accessKey || !secret)) throw new Error("set S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY");
const cfg: S3Config = { accessKey: accessKey ?? "", secret: secret ?? "", host: "s3.cv.cm", bucket: "files", region: "us-east-1" };
const objectUrl = (key: string) => `${COVER_ORIGIN}/${key}`;

async function put(key: string, body: Buffer, type: string): Promise<void> {
  const url = await presignS3Put(cfg, key, new Date(), 600, type, body.length);
  const res = await fetch(url, { method: "PUT", headers: { "Content-Type": type }, body });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

async function loadManifest(): Promise<Record<string, string>> {
  // Bypass any cached copy: the manifest changes on every sync that uploads something.
  const res = await fetch(`${objectUrl(MANIFEST)}?t=${Date.now()}`);
  if (res.status === 404) return {};
  if (!res.ok) throw new Error(`${MANIFEST}: HTTP ${res.status}`);
  return (await res.json()) as Record<string, string>;
}

const files = (await walk(dir)).filter((path) => !path.endsWith(".DS_Store"));
const before = await loadManifest();
const after: Record<string, string> = {};
const uploaded: string[] = [];
const overwritten: string[] = [];
const failed: string[] = [];
let unchanged = 0;

async function sync(path: string): Promise<void> {
  const rel = relative(dir, path).split("\\").join("/");
  const ext = rel.slice(rel.lastIndexOf(".") + 1).toLowerCase();
  const type = TYPES[ext];
  if (!type) {
    failed.push(`covers/${rel}: no content type for .${ext}`);
    return;
  }
  const key = `covers/${rel}`;
  const body = await readFile(path);
  const hash = createHash("sha256").update(body).digest("hex");
  if (before[rel] === hash) {
    after[rel] = hash;
    unchanged++;
    return;
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      let exists = false;
      if (!before[rel]) {
        // identity: a compressed answer (SVG) carries no Content-Length to compare.
        const head = await fetch(objectUrl(key), { method: "HEAD", headers: { "Accept-Encoding": "identity" } });
        exists = head.ok;
        // Put there before the manifest existed: trust a file of the same size.
        if (head.ok && Number(head.headers.get("content-length")) === body.length) {
          after[rel] = hash;
          unchanged++;
          return;
        }
      } else exists = true;
      if (!dryRun) await put(key, body, type);
      after[rel] = hash;
      uploaded.push(key);
      if (exists) overwritten.push(key);
      return;
    } catch (err) {
      if (attempt === 3) failed.push(`${key}: ${(err as Error).message}`);
    }
  }
}

const queue = [...files];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  for (let path = queue.shift(); path; path = queue.shift()) await sync(path);
}));

// Files removed from public/covers stay in the bucket (older pages and image search may still link them); they only
// leave the manifest.
const changed =
  uploaded.length > 0 ||
  Object.keys(after).some((rel) => before[rel] !== after[rel]) ||
  Object.keys(before).some((rel) => !(rel in after));
if (!dryRun && changed && !failed.length) {
  const sorted = Object.fromEntries(Object.entries(after).sort(([a], [b]) => a.localeCompare(b)));
  await put(MANIFEST, Buffer.from(JSON.stringify(sorted)), "application/json");
}

const token = process.env.CLOUDFLARE_API_TOKEN;
if (!dryRun && token && overwritten.length) {
  for (let i = 0; i < overwritten.length; i += 30) {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ files: overwritten.slice(i, i + 30).map(objectUrl) }),
    });
    // A stale edge copy is not worth failing the deploy over: the next ?v= bump fetches the new file anyway.
    if (!res.ok) console.warn(`covers: cache purge HTTP ${res.status}`);
  }
}

console.log(
  `covers: ${files.length} files, ${unchanged} unchanged, ${uploaded.length} ${dryRun ? "to upload" : "uploaded"}` +
    ` (${overwritten.length} replaced), ${failed.length} failed`,
);
if (uploaded.length && (dryRun || uploaded.length <= 50)) console.log(uploaded.join("\n"));
if (failed.length) {
  console.error(failed.slice(0, 20).join("\n"));
  // A cover missing from the bucket would 404 on the site: covers are not deployed as Worker assets.
  process.exit(1);
}
