import * as esbuild from "esbuild";
import { readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { NAMES_FILTER, gameNamesSource, namesJsonPath } from "./game-names.mjs";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Map each locale string pack to its hashed chunk so the Worker can preload it.
const manifestDir = resolve(root, "dist/.vite");
const manifestPath = resolve(manifestDir, "manifest.json");
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch {
  throw new Error(`${manifestPath} missing: run \`npm run build\` (vite build writes it, this script removes it)`);
}
const localePacks = {};
for (const [src, chunk] of Object.entries(manifest)) {
  const m = /^src\/locales\/packs\/(.+)\.ts$/.exec(src);
  if (m) localePacks[m[1]] = [chunk.file, ...(chunk.imports ?? []).map((key) => manifest[key].file)].map((f) => `/${f}`);
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

console.log("wrote dist/_worker.js");
