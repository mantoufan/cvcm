// Packs dist/_ssr/<path>/index.html (one file per prerendered page) into SSR_BUCKETS files dist/_ssr/<bucket>.pack,
// then removes the per-page files, so the Worker's static asset count no longer grows with the page count
// (Workers Free: 20,000 files per version). Format and bucket hash: src/shared/ssr-pack.ts. Runs after the prerender.
import * as esbuild from "esbuild";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ssrDir = join(root, "dist/_ssr");
const outfile = join(root, "node_modules/.cache", `cvcm-ssr-pack-${process.pid}.mjs`);

await esbuild.build({ absWorkingDir: root, entryPoints: ["src/shared/ssr-pack.ts"], bundle: true, format: "esm", platform: "node", target: "node20", outfile, logLevel: "error" });
const { encodePack, ssrBucket, SSR_BUCKETS } = await import(pathToFileURL(outfile).href);
rmSync(outfile, { force: true });

/** Every index.html under dir, as [page path, body]. */
function pages(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...pages(full));
    else if (name === "index.html") out.push(["/" + relative(ssrDir, dir).split(sep).join("/") + "/", readFileSync(full, "utf8")]);
  }
  return out;
}

const all = pages(ssrDir);
if (!all.length) throw new Error("pack-ssr: no prerendered pages in dist/_ssr (run the prerender first)");
const buckets = new Map();
for (const entry of all) {
  const b = ssrBucket(entry[0]);
  if (!buckets.has(b)) buckets.set(b, []);
  buckets.get(b).push(entry);
}

// Replace the per-page tree with the packs.
for (const name of readdirSync(ssrDir)) rmSync(join(ssrDir, name), { recursive: true, force: true });
mkdirSync(ssrDir, { recursive: true });
let bytes = 0;
let largest = 0;
for (const [b, entries] of buckets) {
  entries.sort((a, c) => (a[0] < c[0] ? -1 : 1));
  const data = encodePack(entries);
  writeFileSync(join(ssrDir, `${b}.pack`), data);
  bytes += data.length;
  largest = Math.max(largest, data.length);
}
// A single asset may be at most 25 MiB.
if (largest > 25 * 1024 * 1024) throw new Error(`pack-ssr: a pack is ${largest} bytes, over the 25 MiB asset limit; raise SSR_BUCKETS`);
console.log(`pack-ssr: ${all.length} pages in ${buckets.size} of ${SSR_BUCKETS} packs, ${(bytes / 1048576).toFixed(1)} MiB, largest ${(largest / 1024).toFixed(0)} KiB`);
