import * as esbuild from "esbuild";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Per checkout and per run (like the prerender), so two syncs never run each other's bundle.
const cache = join(root, "node_modules/.cache");
mkdirSync(cache, { recursive: true });
const outfile = join(cache, `cvcm-ref-sync-${process.pid}.mjs`);

await esbuild.build({
  absWorkingDir: root,
  entryPoints: ["scripts/ref-sync.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  outfile,
  legalComments: "none",
});

process.chdir(root);
try {
  await import(pathToFileURL(outfile).href);
} finally {
  rmSync(outfile, { force: true });
}
