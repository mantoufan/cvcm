// Bundles scripts/prerender.ts (the client plus happy-dom) for Node, then runs it.
// Bundled first because happy-dom's globals break a live transformer such as vite-node.
import * as esbuild from "esbuild";
import { spawn } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { availableParallelism, totalmem } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { coverOriginEsbuild } from "./cover-origin.mjs";

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
// a set number of pages, however large the sitemap grows. Several shards run at once, one per core while memory
// allows: MEMORY_PER_PROCESS is what one child of PAGES_PER_PARALLEL_PROCESS pages needs (peak RSS 3.33 GiB measured
// in November 2026), so a "16 GB" runner, which reports about 15.6 GiB, takes 4. PRERENDER_JOBS overrides the
// count. Each child gets this process's heap limit and its own report; the counts are added up here, in shard order,
// into one summary.
const PAGES_PER_PROCESS = 2000;
// Shards are halved only when they run side by side; one at a time, fewer processes start faster.
const PAGES_PER_PARALLEL_PROCESS = 1000;
const MEMORY_PER_PROCESS = 3.5 * 1024 ** 3;
const reportBase = join(root, "node_modules/.cache", `cvcm-prerender-${process.pid}`);
const started = Date.now();
let written = 0;
const failed = [];
const errors = new Set();

// Node flags go to the children (the heap limit above all), except debugger flags: with --inspect-brk every child
// would wait for a debugger, and with --inspect they would clash on the port.
const childFlags = process.execArgv.filter((flag) => !/^--(inspect|debug)/.test(flag));
const running = new Set();
const reports = [];
// Stopping the build (Ctrl+C, a cancelled CI job) stops the shards too instead of leaving them rendering. The shards
// it kills then look failed to the code below, which waits for this instead of reporting them.
let interrupted;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => (interrupted ??= (async () => {
    // A process that never started emits no "exit".
    const exits = [...running].filter((run) => run.pid !== undefined).map((run) => new Promise((exited) => run.once("exit", exited)));
    for (const run of running) run.kill();
    const late = await Promise.race([Promise.all(exits).then(() => false), new Promise((r) => setTimeout(r, 5000, true))]);
    if (late) for (const run of running) run.kill("SIGKILL");
    rmSync(outfile, { force: true });
    for (const report of reports) rmSync(report, { force: true });
    process.exit(signal === "SIGINT" ? 130 : 143);
  })()));
}

function child(label, env) {
  // Once interrupted, no new shard starts: the signal handler only stops the ones already running.
  if (interrupted) return Promise.reject(new Error(`prerender: interrupted before ${label}`));
  const report = `${reportBase}-${reports.length}.json`;
  reports.push(report);
  rmSync(report, { force: true });
  // The prerender variables are set here for each child, never inherited from the shell that ran the build.
  const base = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PRERENDER_")));
  return new Promise((done, fail) => {
    const run = spawn(process.execPath, [...childFlags, outfile], { stdio: "inherit", env: { ...base, ...env, PRERENDER_REPORT: report } });
    running.add(run);
    // An error once the process is up (a failed kill) is not its end: its "exit" still settles the promise.
    run.on("error", (error) => {
      if (run.pid !== undefined) return;
      running.delete(run);
      fail(new Error(`prerender: could not start the process for ${label}: ${error.message}`));
    });
    run.on("exit", (status, signal) => {
      running.delete(run);
      if (status !== 0) return fail(new Error(`prerender: ${label} failed (${signal ?? `exit ${status}`})`));
      try {
        done(JSON.parse(readFileSync(report, "utf8")));
      } catch (error) {
        fail(new Error(`prerender: ${label} left no readable report: ${error.message}`));
      }
    });
  });
}

// The machine's memory, or less when a container or cgroup caps this process (0 or a huge number means no cap).
function memory() {
  const cap = process.constrainedMemory?.() ?? 0;
  return cap > 0 ? Math.min(cap, totalmem()) : totalmem();
}

function jobLimit() {
  const set = process.env.PRERENDER_JOBS;
  if (set && !/^[1-9]\d*$/.test(set)) throw new Error(`prerender: PRERENDER_JOBS=${set} is not a positive integer`);
  return set ? Number(set) : Math.max(1, Math.min(availableParallelism(), Math.floor(memory() / MEMORY_PER_PROCESS)));
}

try {
  const limit = jobLimit();
  const { total } = await child("the page count", { PRERENDER_COUNT_ONLY: "1" });
  // Side by side, a whole number of rounds: no core sits idle while the last few shards finish.
  const shards = limit > 1
    ? limit * Math.max(1, Math.ceil(total / (limit * PAGES_PER_PARALLEL_PROCESS)))
    : Math.max(1, Math.ceil(total / PAGES_PER_PROCESS));
  const jobs = limit;
  console.log(`prerender: ${total} pages in ${shards} shards, ${jobs} at a time`);
  const parts = [];
  let next = 0;
  let stopped;
  async function worker() {
    while (!stopped && next < shards) {
      const shard = next++;
      const shardStarted = Date.now();
      let part;
      try {
        part = await child(`shard ${shard + 1}/${shards}`, { PRERENDER_SHARD: `${shard}/${shards}` });
      } catch (error) {
        // One failed shard fails the build: stop the others rather than let them finish for nothing.
        if (!stopped) {
          stopped = error;
          for (const run of running) run.kill();
        }
        return;
      }
      parts[shard] = part;
      console.log(`prerender: shard ${shard + 1}/${shards}: ${part.written} pages, ${part.failed.length} skipped in ${((Date.now() - shardStarted) / 1000).toFixed(1)}s`);
    }
  }
  // Every worker returns only once its child has exited, so nothing is still writing when this throws or cleans up.
  await Promise.all(Array.from({ length: jobs }, worker));
  if (stopped) throw stopped;
  for (const part of parts) {
    written += part.written;
    failed.push(...part.failed);
    for (const error of part.errors) errors.add(error);
  }
  // Every page is either written or skipped by exactly one shard; anything else means the shards missed pages.
  if (written + failed.length !== total) throw new Error(`prerender: shards covered ${written + failed.length} of ${total} pages`);
} catch (error) {
  // Shards killed by an interrupt are not the build failing: let the signal handler finish and exit. Ctrl+C reaches the
  // shards too, so one may die before this process runs its handler: give the handler a moment to start.
  if (!interrupted) await new Promise((r) => setTimeout(r, 100));
  if (interrupted) await interrupted;
  throw error;
} finally {
  rmSync(outfile, { force: true });
  for (const report of reports) rmSync(report, { force: true });
}
console.log(`prerender: ${written} pages in ${((Date.now() - started) / 1000).toFixed(1)}s, ${failed.length} skipped`);
if (failed.length) {
  console.log(`prerender: skipped (the Worker serves its text copy): ${failed.slice(0, 20).join(" ")}${failed.length > 20 ? " …" : ""}`);
  console.log(`prerender: first errors:\n  ${[...errors].slice(0, 8).join("\n  ")}`);
}
