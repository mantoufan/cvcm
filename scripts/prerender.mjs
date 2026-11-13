// Bundles scripts/prerender.ts (the client plus happy-dom) for Node, then runs it.
// Bundled first because happy-dom's globals break a live transformer such as vite-node.
import * as esbuild from "esbuild";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
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

// Fresh processes, one after another: memory grows with every page a process renders (see prerender.ts), so no
// process takes more than about PAGES_PER_PROCESS, however large the sitemap grows. Each child gets this process's
// heap limit; the counts are added up here into one summary.
const PAGES_PER_PROCESS = 2000;
const report = join(root, "node_modules/.cache", `cvcm-prerender-${process.pid}.json`);
const started = Date.now();
let written = 0;
const failed = [];
const errors = new Set();

// Node flags go to the children (the heap limit above all), except debugger flags: with --inspect-brk every child
// would wait for a debugger, and with --inspect they would clash on the port.
const childFlags = process.execArgv.filter((flag) => !/^--(inspect|debug)/.test(flag));

function child(label, env) {
  rmSync(report, { force: true });
  // The prerender variables are set here for each child, never inherited from the shell that ran the build.
  const base = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PRERENDER_")));
  const run = spawnSync(process.execPath, [...childFlags, outfile], { stdio: "inherit", env: { ...base, ...env, PRERENDER_REPORT: report } });
  if (run.error) throw new Error(`prerender: could not start the process for ${label}: ${run.error.message}`);
  if (run.status !== 0) throw new Error(`prerender: ${label} failed (${run.signal ?? `exit ${run.status}`})`);
  if (!existsSync(report)) throw new Error(`prerender: ${label} exited without writing its report`);
  return JSON.parse(readFileSync(report, "utf8"));
}

try {
  const { total } = child("the page count", { PRERENDER_COUNT_ONLY: "1" });
  const shards = Math.max(1, Math.ceil(total / PAGES_PER_PROCESS));
  for (let shard = 0; shard < shards; shard++) {
    const shardStarted = Date.now();
    const part = child(`shard ${shard + 1}/${shards}`, { PRERENDER_SHARD: `${shard}/${shards}` });
    console.log(`prerender: shard ${shard + 1}/${shards}: ${part.written} pages, ${part.failed.length} skipped in ${((Date.now() - shardStarted) / 1000).toFixed(1)}s`);
    written += part.written;
    failed.push(...part.failed);
    for (const error of part.errors) errors.add(error);
  }
  // Every page is either written or skipped by exactly one shard; anything else means the shards missed pages.
  if (written + failed.length !== total) throw new Error(`prerender: shards covered ${written + failed.length} of ${total} pages`);
} finally {
  rmSync(outfile, { force: true });
  rmSync(report, { force: true });
}
console.log(`prerender: ${written} pages in ${((Date.now() - started) / 1000).toFixed(1)}s, ${failed.length} skipped`);
if (failed.length) {
  console.log(`prerender: skipped (the Worker serves its text copy): ${failed.slice(0, 20).join(" ")}${failed.length > 20 ? " …" : ""}`);
  console.log(`prerender: first errors:\n  ${[...errors].slice(0, 8).join("\n  ")}`);
}
