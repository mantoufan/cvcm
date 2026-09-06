import * as esbuild from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

await esbuild.build({
  absWorkingDir: root,
  entryPoints: ["src/worker.ts"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  outfile: "dist/_worker.js",
  legalComments: "none",
  minify: true,
});

console.log("wrote dist/_worker.js");
