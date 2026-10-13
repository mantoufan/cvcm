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

// Each page's lazy chunk plus the shared chunks it imports (the entry is already loading, so it is left out).
function chunkFiles(key, seen = new Set()) {
  const chunk = manifest[key];
  if (!chunk || chunk.isEntry || seen.has(key)) return [];
  seen.add(key);
  return [`/${chunk.file}`, ...(chunk.imports ?? []).flatMap((dep) => chunkFiles(dep, seen))];
}
const pageModules = {
  home: "src/client/home.ts",
  learn: "src/client/learn/ui.ts",
  games: "src/client/games/ui.ts",
  device: "src/client/device/ui.ts",
  markets: "src/client/markets/ui.ts",
};
const toolsSrc = readFileSync(resolve(root, "src/client/tools.ts"), "utf8");
for (const m of toolsSrc.matchAll(/^ {2}"([a-z0-9-]+)": async[^\n]*\n\s*const m = await import\("\.\/([^"]+)"\);/gm)) {
  pageModules[m[1]] = `src/client/${m[2]}.ts`;
}
const pageChunks = {};
for (const [page, src] of Object.entries(pageModules)) {
  const files = chunkFiles(src);
  if (!files.length) throw new Error(`no Vite chunk for ${src} (page ${page})`);
  pageChunks[page] = files;
}
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
  define: { __LOCALE_PACKS__: JSON.stringify(localePacks), __PAGE_CHUNKS__: JSON.stringify(pageChunks) },
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
