/**
 * Put every built cover (dist/covers/**) on s3.cv.cm under files/covers/, skipping files already there at the same
 * size. The Worker serves /covers/* from that bucket (proxyCovers), so dist/covers is not uploaded as a static asset
 * (see the .assetsignore written by build-worker.mjs). Run after `npm run build`, before `wrangler deploy`:
 *
 *   S3_ACCESS_KEY_ID=… S3_SECRET_ACCESS_KEY=… node scripts/sync-covers.mjs
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { presignS3Put, type S3Config } from "../src/s3-sign";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
};
const CONCURRENCY = 8;

const root = resolve(process.cwd());
const dir = join(root, "dist/covers");

async function walk(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(entries.map((e) => (e.isDirectory() ? walk(join(path, e.name)) : [join(path, e.name)])));
  return nested.flat();
}

const accessKey = process.env.S3_ACCESS_KEY_ID;
const secret = process.env.S3_SECRET_ACCESS_KEY;
if (!accessKey || !secret) throw new Error("set S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY");
const cfg: S3Config = { accessKey, secret, host: "s3.cv.cm", bucket: "files", region: "us-east-1" };

const files = await walk(dir);
let uploaded = 0;
let present = 0;
const failed: string[] = [];

async function sync(path: string): Promise<void> {
  const rel = relative(dir, path).split("\\").join("/");
  const ext = rel.slice(rel.lastIndexOf(".") + 1).toLowerCase();
  const type = TYPES[ext];
  if (!type) throw new Error(`no content type for covers/${rel}`);
  const key = `covers/${rel}`;
  const bytes = (await stat(path)).size;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const head = await fetch(`https://${cfg.host}/${cfg.bucket}/${key}`, { method: "HEAD" });
      if (head.ok && Number(head.headers.get("content-length")) === bytes) {
        present++;
        return;
      }
      const url = await presignS3Put(cfg, key, new Date(), 600, type, bytes);
      const put = await fetch(url, { method: "PUT", headers: { "Content-Type": type }, body: await readFile(path) });
      if (!put.ok) throw new Error(`HTTP ${put.status}`);
      uploaded++;
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

console.log(`covers: ${files.length} files, ${present} already on s3.cv.cm, ${uploaded} uploaded, ${failed.length} failed`);
if (failed.length) {
  console.error(failed.slice(0, 20).join("\n"));
  // A cover missing from the bucket would 404 on the site, since dist/covers is not deployed as an asset.
  process.exit(1);
}
