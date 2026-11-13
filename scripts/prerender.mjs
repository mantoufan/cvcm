// Bundles scripts/prerender.ts (the client plus happy-dom) for Node, then runs it.
// Bundled first because happy-dom's globals break a live transformer such as vite-node.
import * as esbuild from "esbuild";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
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

// One process per shard, one after another: memory grows with every page rendered in a process (see prerender.ts),
// and a fresh process starts from zero. Each child gets this process's heap limit.
const SHARDS = 4;
try {
  for (let shard = 0; shard < SHARDS; shard++) {
    const run = spawnSync(process.execPath, [...process.execArgv, outfile], {
      stdio: "inherit",
      env: { ...process.env, PRERENDER_SHARD: `${shard}/${SHARDS}` },
    });
    if (run.status !== 0) throw new Error(`prerender shard ${shard + 1}/${SHARDS} failed (${run.signal ?? `exit ${run.status}`})`);
  }
} finally {
  rmSync(outfile, { force: true });
}
