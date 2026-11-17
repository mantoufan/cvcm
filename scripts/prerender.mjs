// Bundles scripts/prerender.ts (the client plus happy-dom) for Node, then runs it.
// Bundled first because happy-dom's globals break a live transformer such as vite-node.
import * as esbuild from "esbuild";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { availableParallelism, totalmem } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { coverOriginEsbuild } from "./cover-origin.mjs";
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
  plugins: [coverOriginEsbuild, {
    name: "game-names",
    setup(build) {
      build.onResolve({ filter: NAMES_FILTER }, (args) => ({
        path: resolve(args.resolveDir, namesJsonPath(args.path)),
        namespace: "game-names",
      }));
      build.onLoad({ filter: /.*/, namespace: "game-names" }, (args) => ({ contents: gameNamesSource(args.path), loader: "json" }));
    },
  }, {
    // The browser's core packs and copy buckets (vite.config.ts builds them). The prerender never loads them: it
    // registers the full packs and cuts each page's client pack from those (clientPack in src/shared/page-copy.ts).
    name: "page-copy-stub",
    setup(build) {
      build.onResolve({ filter: /^virtual:page-copy\// }, (args) => ({ path: args.path, namespace: "page-copy-stub" }));
      build.onLoad({ filter: /.*/, namespace: "page-copy-stub" }, () => ({ contents: "export default {}; export const copy = { tools: [], tutorials: [] };", loader: "js" }));
    },
  }],
});

// Fresh processes: memory grows with every page a process renders (see prerender.ts), so no process takes more than
// about PAGES_PER_PROCESS, however large the sitemap grows. Several shards run at once, one per core while memory
// allows (each needs up to MEMORY_PER_PROCESS); PRERENDER_JOBS overrides that. Each child gets this process's heap
// limit and its own report; the counts are added up here into one summary.
const PAGES_PER_PROCESS = 1000;
const MEMORY_PER_PROCESS = 4 * 1024 ** 3;
const reportBase = join(root, "node_modules/.cache", `cvcm-prerender-${process.pid}`);
const started = Date.now();
let written = 0;
const failed = [];
const errors = new Set();

// Node flags go to the children (the heap limit above all), except debugger flags: with --inspect-brk every child
// would wait for a debugger, and with --inspect they would clash on the port.
const childFlags = process.execArgv.filter((flag) => !/^--(inspect|debug)/.test(flag));
const running = new Set();
const reports = new Set();

function child(label, env) {
  const report = `${reportBase}-${reports.size}.json`;
  reports.add(report);
  rmSync(report, { force: true });
  // The prerender variables are set here for each child, never inherited from the shell that ran the build.
  const base = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PRERENDER_")));
  return new Promise((done, fail) => {
    const run = spawn(process.execPath, [...childFlags, outfile], { stdio: "inherit", env: { ...base, ...env, PRERENDER_REPORT: report } });
    running.add(run);
    run.on("error", (error) => {
      running.delete(run);
      fail(new Error(`prerender: could not start the process for ${label}: ${error.message}`));
    });
    run.on("exit", (status, signal) => {
      running.delete(run);
      if (status !== 0) return fail(new Error(`prerender: ${label} failed (${signal ?? `exit ${status}`})`));
      if (!existsSync(report)) return fail(new Error(`prerender: ${label} exited without writing its report`));
      done(JSON.parse(readFileSync(report, "utf8")));
    });
  });
}

function jobCount(shards) {
  const set = process.env.PRERENDER_JOBS;
  if (set !== undefined && !/^[1-9]\d*$/.test(set)) throw new Error(`prerender: PRERENDER_JOBS=${set} is not a positive integer`);
  const limit = set ? Number(set) : Math.min(availableParallelism(), Math.floor(totalmem() / MEMORY_PER_PROCESS));
  return Math.max(1, Math.min(shards, limit));
}

try {
  const { total } = await child("the page count", { PRERENDER_COUNT_ONLY: "1" });
  const shards = Math.max(1, Math.ceil(total / PAGES_PER_PROCESS));
  const jobs = jobCount(shards);
  console.log(`prerender: ${total} pages in ${shards} shards, ${jobs} at a time`);
  let next = 0;
  async function worker() {
    while (next < shards) {
      const shard = next++;
      const shardStarted = Date.now();
      const part = await child(`shard ${shard + 1}/${shards}`, { PRERENDER_SHARD: `${shard}/${shards}` });
      console.log(`prerender: shard ${shard + 1}/${shards}: ${part.written} pages, ${part.failed.length} skipped in ${((Date.now() - shardStarted) / 1000).toFixed(1)}s`);
      written += part.written;
      failed.push(...part.failed);
      for (const error of part.errors) errors.add(error);
    }
  }
  // One failed shard fails the build: stop the others rather than let them finish for nothing.
  await Promise.all(Array.from({ length: jobs }, worker)).catch((error) => {
    next = shards;
    for (const run of running) run.kill();
    throw error;
  });
  // Every page is either written or skipped by exactly one shard; anything else means the shards missed pages.
  if (written + failed.length !== total) throw new Error(`prerender: shards covered ${written + failed.length} of ${total} pages`);
} finally {
  rmSync(outfile, { force: true });
  for (const report of reports) rmSync(report, { force: true });
}
console.log(`prerender: ${written} pages in ${((Date.now() - started) / 1000).toFixed(1)}s, ${failed.length} skipped`);
if (failed.length) {
  console.log(`prerender: skipped (the Worker serves its text copy): ${failed.slice(0, 20).join(" ")}${failed.length > 20 ? " …" : ""}`);
  console.log(`prerender: first errors:\n  ${[...errors].slice(0, 8).join("\n  ")}`);
}
