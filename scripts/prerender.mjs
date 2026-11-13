// Bundles scripts/prerender.ts (the client plus happy-dom) for Node, then runs it.
// Bundled first because happy-dom's globals break a live transformer such as vite-node.
import * as esbuild from "esbuild";
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { getHeapStatistics } from "node:v8";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NAMES_FILTER, gameNamesSource, namesJsonPath } from "./game-names.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Inside the repo so the bundle resolves happy-dom and vitest from node_modules.
const outfile = join(root, "node_modules/.cache", `cvcm-prerender-${process.pid}.mjs`);

await esbuild.build({
  absWorkingDir: root,
  entryPoints: ["scripts/prerender.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  outfile,
  legalComments: "none",
  packages: "external",
  loader: { ".css": "empty" },
  define: {
    "import.meta.env.VITEST": "false",
    "import.meta.env.PROD": "false",
    "import.meta.env.DEV": "false",
    __PRERENDER_ROOT__: JSON.stringify(root),
  },
  plugins: [{
    name: "game-names",
    setup(build) {
      build.onResolve({ filter: NAMES_FILTER }, (args) => ({
        path: resolve(args.resolveDir, namesJsonPath(args.path)),
        namespace: "game-names",
      }));
      build.onLoad({ filter: /.*/, namespace: "game-names" }, (args) => ({ contents: gameNamesSource(args.path), loader: "json" }));
    },
  }],
});

// Each page leaves state in the heap that a process never frees: one process with an 8 GB heap ran out at about
// 7,400 pages (about 1.1 MB a page of heap), and a process rendering 2,470 pages peaked at 5.9 GB resident (about
// 2.4 MB a page, with the code, buffers and baseline). Split the pages over processes run one after another, each
// with this process's heap flag, sized from that heap at 4 MB a page, so peak memory stays well under the limit
// as the site grows.
// PRERENDER_SHARDS overrides the count.
const PAGES_PER_PROCESS = Math.max(200, Math.floor(getHeapStatistics().heap_size_limit / (4 << 20)));
const run = (env, opts = {}) => execFileSync(process.execPath, [...process.execArgv, outfile], { ...opts, env: { ...process.env, ...env } });
try {
  const pages = Number(/^PAGES (\d+)$/m.exec(run({ PRERENDER_COUNT: "1" }, { encoding: "utf8" }))?.[1]);
  if (!(pages > 0)) throw new Error("prerender: could not count the sitemap pages");
  const shards = process.env.PRERENDER_SHARDS === undefined ? Math.ceil(pages / PAGES_PER_PROCESS) : Number(process.env.PRERENDER_SHARDS);
  if (!(Number.isInteger(shards) && shards >= 1 && shards <= pages)) throw new Error(`PRERENDER_SHARDS must be a whole number from 1 to ${pages}, got ${JSON.stringify(process.env.PRERENDER_SHARDS)}`);
  console.log(`prerender: ${pages} pages in ${shards} processes`);
  let written = 0;
  const failed = [];
  for (let i = 0; i < shards; i++) {
    const result = `${outfile}.${i}.json`;
    run({ PRERENDER_SHARD: `${i}/${shards}`, PRERENDER_COUNT: "", PRERENDER_RESULT: result }, { stdio: "inherit" });
    const shard = JSON.parse(readFileSync(result, "utf8"));
    rmSync(result, { force: true });
    written += shard.written;
    failed.push(...shard.failed);
  }
  console.log(`prerender total: ${written} of ${pages} pages written, ${failed.length} skipped${failed.length ? `: ${failed.slice(0, 40).join(" ")}${failed.length > 40 ? " …" : ""}` : ""}`);
  // Every page skipped (a broken client, say) would ship a site without first paints while the build looks green.
  if (written === 0) throw new Error("prerender: no page was written");
} finally {
  rmSync(outfile, { force: true });
}
