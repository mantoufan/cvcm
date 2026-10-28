// Bundles scripts/ai/mirror.ts (it imports the app's TypeScript) and runs it. See that file for usage.
import * as esbuild from "esbuild";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outfile = join(tmpdir(), "cvcm-ai-mirror.mjs");

await esbuild.build({
  absWorkingDir: root,
  entryPoints: ["scripts/ai/mirror.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  outfile,
  legalComments: "none",
});

await import(pathToFileURL(outfile).href);
