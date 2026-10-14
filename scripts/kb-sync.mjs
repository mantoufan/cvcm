import * as esbuild from "esbuild";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outfile = join(tmpdir(), "cvcm-kb-sync.mjs");

await esbuild.build({
  absWorkingDir: root,
  entryPoints: ["scripts/kb-sync.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  outfile,
  legalComments: "none",
});

process.chdir(root);
await import(pathToFileURL(outfile).href);
