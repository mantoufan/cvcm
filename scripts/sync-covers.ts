/**
 * Keep s3.cv.cm files/covers/ in step with public/covers/. Pages link the bucket directly and covers are not
 * deployed as Worker assets (scripts/cover-origin.mjs). The rules are in scripts/covers-manifest.ts:
 *
 *   node scripts/sync-covers.mjs [--dry-run]   before `wrangler deploy`: upload new covers; stop on an edited one
 *   node scripts/sync-covers.mjs --prune       after it: delete covers gone from public/covers for 7 days
 *
 * Needs S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY; CLOUDFLARE_API_TOKEN (optional) purges deleted or replaced URLs.
 * A cover is cached for a year, so it never changes in place: give an edited one a new versioned name
 * (`qr-sweet-v2.jpg`) and point the code at it. COVERS_ALLOW_OVERWRITE=1 replaces files in place anyway (to repair a
 * broken upload; returning visitors keep their cached copy).
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { presignS3Put, s3Delete, type S3Config } from "../src/s3-sign";
import { COVER_ORIGIN } from "../src/shared/covers";
import { dueForPrune, nextManifest, parseManifest, planSync, PRUNE_AFTER_DAYS, type Manifest } from "./covers-manifest";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
};
const CONCURRENCY = 8;
const MANIFEST = "covers/.manifest.json";
const ZONE_ID = "4c10d62fefca26eabfda88ebda06cf81"; // cv.cm
const dryRun = process.argv.includes("--dry-run");
const prune = process.argv.includes("--prune");
const allowOverwrite = process.env.COVERS_ALLOW_OVERWRITE === "1";

const dir = resolve(process.cwd(), "public/covers");
const accessKey = process.env.S3_ACCESS_KEY_ID;
const secret = process.env.S3_SECRET_ACCESS_KEY;
if (!dryRun && (!accessKey || !secret)) throw new Error("set S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY");
const cfg: S3Config = { accessKey: accessKey ?? "", secret: secret ?? "", host: "s3.cv.cm", bucket: "files", region: "us-east-1" };
const objectUrl = (key: string) => `${COVER_ORIGIN}/${key}`;

async function walk(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(entries.map((e) => (e.isDirectory() ? walk(join(path, e.name)) : [join(path, e.name)])));
  return nested.flat();
}

async function put(key: string, body: Buffer, type: string): Promise<void> {
  const url = await presignS3Put(cfg, key, new Date(), 600, type, body.length);
  const res = await fetch(url, { method: "PUT", headers: { "Content-Type": type }, body });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

async function retry(task: () => Promise<void>): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await task();
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((done) => setTimeout(done, 1000 * attempt));
    }
  }
}

async function pool<T>(items: T[], work: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await work(item);
  }));
}

async function loadManifest(): Promise<Manifest> {
  let manifest: Manifest | undefined;
  await retry(async () => {
    // The query string skips any edge copy: the manifest changes on every sync that changes something.
    const res = await fetch(`${objectUrl(MANIFEST)}?t=${Date.now()}`);
    if (res.status === 404) manifest = parseManifest(null);
    else if (!res.ok) throw new Error(`${MANIFEST}: HTTP ${res.status}`);
    else manifest = parseManifest(await res.json());
  });
  return manifest!;
}

async function saveManifest(manifest: Manifest): Promise<void> {
  if (!dryRun) await retry(() => put(MANIFEST, Buffer.from(JSON.stringify(manifest)), "application/json"));
}

async function purge(keys: string[]): Promise<void> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (dryRun || !token || !keys.length) return;
  for (let i = 0; i < keys.length; i += 30) {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ files: keys.slice(i, i + 30).map(objectUrl) }),
    });
    // A stale edge copy is not worth failing the deploy over.
    if (!res.ok) console.warn(`covers: cache purge HTTP ${res.status}`);
  }
}

const before = await loadManifest();

if (prune) {
  const due = dueForPrune(before, new Date());
  const deleted: string[] = [];
  const failed: string[] = [];
  await pool(due, async (rel) => {
    try {
      if (!dryRun) {
        await retry(async () => {
          // s3Delete does not read the answer: check the object is gone (the query skips the edge cache).
          await s3Delete(cfg, `covers/${rel}`);
          const head = await fetch(`${objectUrl(`covers/${rel}`)}?t=${Date.now()}`, { method: "HEAD" });
          if (head.status !== 404) throw new Error(`still there (HTTP ${head.status})`);
        });
      }
      deleted.push(rel);
    } catch (err) {
      failed.push(`covers/${rel}: ${(err as Error).message}`);
    }
  });
  if (deleted.length) {
    const removed = { ...before.removed };
    for (const rel of deleted) delete removed[rel];
    await saveManifest({ files: before.files, removed });
    await purge(deleted.map((rel) => `covers/${rel}`));
  }
  const waiting = Object.keys(before.removed).length - due.length;
  console.log(`covers prune: ${deleted.length} ${dryRun ? "to delete" : "deleted"}, ${waiting} waiting out ${PRUNE_AFTER_DAYS} days, ${failed.length} failed`);
  if (deleted.length) console.log(deleted.map((rel) => `covers/${rel}`).join("\n"));
  // The site no longer links these: a failed delete only leaves a file behind, retried on the next deploy.
  if (failed.length) console.warn(failed.join("\n"));
  process.exit(0);
}

const paths = (await walk(dir)).filter((path) => !path.endsWith(".DS_Store"));
const local: Record<string, string> = {};
const bodies = new Map<string, Buffer>();
for (const path of paths) {
  const rel = relative(dir, path).split("\\").join("/");
  const body = await readFile(path);
  local[rel] = createHash("sha256").update(body).digest("hex");
  bodies.set(rel, body);
}

const plan = planSync(before, local);
const failed: string[] = [];
for (const rel of [...plan.added, ...plan.edited]) {
  const ext = rel.slice(rel.lastIndexOf(".") + 1).toLowerCase();
  if (!TYPES[ext]) failed.push(`covers/${rel}: no content type for .${ext}`);
}
if (plan.edited.length && !allowOverwrite) {
  console.error(
    `covers: ${plan.edited.length} published cover(s) changed in place. Covers are cached for a year, so give the new ` +
      "version a new name (e.g. qr-sweet-v2.jpg), point the code at it and remove the old file (it is deleted from " +
      `the bucket ${PRUNE_AFTER_DAYS} days later). COVERS_ALLOW_OVERWRITE=1 replaces them anyway.\n` +
      plan.edited.map((rel) => `  covers/${rel}`).join("\n"),
  );
  process.exit(1);
}

const uploaded: string[] = [];
const replaced: string[] = [];
let alreadyThere = 0;
async function upload(rel: string, known: boolean): Promise<void> {
  const key = `covers/${rel}`;
  const body = bodies.get(rel)!;
  const type = TYPES[rel.slice(rel.lastIndexOf(".") + 1).toLowerCase()];
  if (!type) return;
  try {
    let exists = known;
    if (!known) {
      // identity: a compressed answer (SVG) carries no Content-Length to compare.
      const head = await fetch(objectUrl(key), { method: "HEAD", headers: { "Accept-Encoding": "identity" } });
      exists = head.ok;
      // Uploaded before the manifest knew it: trust a file of the same size.
      if (head.ok && Number(head.headers.get("content-length")) === body.length) {
        alreadyThere++;
        return;
      }
    }
    if (!dryRun) await retry(() => put(key, body, type));
    uploaded.push(key);
    if (exists) replaced.push(key);
  } catch (err) {
    failed.push(`${key}: ${(err as Error).message}`);
  }
}
await pool(plan.added, (rel) => upload(rel, false));
await pool(plan.edited, (rel) => upload(rel, true));

if (failed.length) {
  console.error(failed.slice(0, 20).join("\n"));
  // A cover missing from the bucket would 404 on the site. The manifest is left as it was, so the next run retries.
  process.exit(1);
}

const after = nextManifest(before, local, new Date());
if (JSON.stringify(after) !== JSON.stringify(before)) await saveManifest(after);
await purge(replaced);

console.log(
  `covers: ${paths.length} files, ${plan.unchanged.length + alreadyThere} unchanged, ${uploaded.length} ` +
    `${dryRun ? "to upload" : "uploaded"} (${replaced.length} replaced), ${plan.removed.length} newly removed, ` +
    `${Object.keys(after.removed).length} awaiting deletion`,
);
if (uploaded.length && (dryRun || uploaded.length <= 50)) console.log(uploaded.join("\n"));
if (plan.removed.length) console.log(plan.removed.map((rel) => `removed: covers/${rel}`).join("\n"));
