import * as esbuild from "esbuild";
import { readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Map each locale string pack to its hashed chunk so the Worker can preload it.
const manifestDir = resolve(root, "dist/.vite");
const manifest = JSON.parse(readFileSync(resolve(manifestDir, "manifest.json"), "utf8"));
const localePacks = {};
for (const [src, chunk] of Object.entries(manifest)) {
  const m = /^src\/locales\/packs\/(.+)\.ts$/.exec(src);
  if (m) localePacks[m[1]] = `/${chunk.file}`;
}
if (!Object.keys(localePacks).length) throw new Error("no locale packs in Vite manifest");
rmSync(manifestDir, { recursive: true, force: true });

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
  define: { __LOCALE_PACKS__: JSON.stringify(localePacks) },
});

console.log("wrote dist/_worker.js");
