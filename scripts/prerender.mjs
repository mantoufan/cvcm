// Bundles scripts/prerender.ts (the client plus happy-dom) for Node, then runs it.
// Bundled first because happy-dom's globals break a live transformer such as vite-node.
import * as esbuild from "esbuild";
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
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

// Each page leaves about 2.4 MB in the heap (measured: 5.9 GB for 2,470 pages) that a process never frees; one
// process ran out of an 8 GB heap at about 7,400 pages. Split the pages over processes run one after another, each
// with this process's heap flag, sized from that heap at 4 MB a page for headroom, so the split grows with the site.
// PRERENDER_SHARDS overrides the count.
const PAGES_PER_PROCESS = Math.max(200, Math.floor(getHeapStatistics().heap_size_limit / (4 << 20)));
const run = (env, opts = {}) => execFileSync(process.execPath, [...process.execArgv, outfile], { ...opts, env: { ...process.env, ...env } });
try {
  const pages = Number(/^PAGES (\d+)$/m.exec(run({ PRERENDER_COUNT: "1" }, { encoding: "utf8" }))?.[1]);
  if (!(pages > 0)) throw new Error("prerender: could not count the sitemap pages");
  const shards = process.env.PRERENDER_SHARDS === undefined ? Math.ceil(pages / PAGES_PER_PROCESS) : Number(process.env.PRERENDER_SHARDS);
  if (!(Number.isInteger(shards) && shards >= 1 && shards <= pages)) throw new Error(`PRERENDER_SHARDS must be a whole number from 1 to ${pages}, got ${JSON.stringify(process.env.PRERENDER_SHARDS)}`);
  console.log(`prerender: ${pages} pages in ${shards} processes`);
  for (let i = 0; i < shards; i++) run({ PRERENDER_SHARD: `${i}/${shards}`, PRERENDER_COUNT: "" }, { stdio: "inherit" });
} finally {
  rmSync(outfile, { force: true });
}
