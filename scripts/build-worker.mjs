import * as esbuild from "esbuild";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  // Not the entry: the page loads it itself (a chunk with dynamic imports takes Vite's preload helper from it).
  if (m) localePacks[m[1]] = [chunk.file, ...(chunk.imports ?? []).filter((key) => !manifest[key].isEntry).map((key) => manifest[key].file)].map((f) => `/${f}`);
  // One knowledge article in one locale: preloaded as "kb-<locale>/<id>".
  const article = /^src\/locales\/kb\/([^/]+)\/([a-z0-9-]+)\.json$/.exec(src);
  if (article) localePacks[`kb-${article[1]}/${article[2]}`] = [`/${chunk.file}`];
  // A locale's article loader table, fetched before any article in that locale: preloaded as "kb-<locale>/loaders".
  const loaders = /^src\/locales\/kb\/loaders\/([^/]+)\.ts$/.exec(src);
  if (loaders) localePacks[`kb-${loaders[1]}/loaders`] = [`/${chunk.file}`];
  // Reference entries and loader tables, the same way: "ref-<locale>/<id>" and "ref-<locale>/loaders" (the pack itself is "ref-<locale>" above).
  const entry = /^src\/locales\/ref\/([a-zA-Z-]+)\/([a-z0-9-]+)\.json$/.exec(src);
  if (entry && entry[1] !== "index") localePacks[`ref-${entry[1]}/${entry[2]}`] = [`/${chunk.file}`];
  const refLoaders = /^src\/locales\/ref\/loaders\/([^/]+)\.ts$/.exec(src);
  if (refLoaders) localePacks[`ref-${refLoaders[1]}/loaders`] = [`/${chunk.file}`];
  // Slang entries and loader tables: "slang-<locale>/<id>" and "slang-<locale>/loaders" (the pack is "slang-<locale>").
  const slangEntry = /^src\/locales\/slang\/([a-zA-Z-]+)\/([a-z0-9-]+)\.json$/.exec(src);
  if (slangEntry && slangEntry[1] !== "index") localePacks[`slang-${slangEntry[1]}/${slangEntry[2]}`] = [`/${chunk.file}`];
  const slangLoaders = /^src\/locales\/slang\/loaders\/([^/]+)\.ts$/.exec(src);
  if (slangLoaders) localePacks[`slang-${slangLoaders[1]}/loaders`] = [`/${chunk.file}`];
}
if (!Object.keys(localePacks).length) throw new Error("no locale packs in Vite manifest");
// Page-copy buckets (a tool's FAQ and how-to, a tutorial's text): "copy-<locale>/<tools|tutorials>-<bucket>", written
// by the page-copy plugin in vite.config.ts because virtual modules have no usable manifest key.
const { buckets: copyBuckets, chunks: copyChunks } = JSON.parse(readFileSync(resolve(manifestDir, "page-copy.json"), "utf8"));
// Per locale: the loader table ("copy-<locale>") and every bucket of tools and of tutorials.
for (const file of readdirSync(resolve(root, "src/locales/packs/full")).filter((name) => name.endsWith(".ts"))) {
  const locale = file.replace(/\.ts$/, "");
  const keys = [`copy-${locale}`];
  for (const kind of ["tools", "tutorials"]) for (let n = 0; n < copyBuckets; n++) keys.push(`copy-${locale}/${kind}-${n}`);
  for (const key of keys) {
    if (!copyChunks[key]) throw new Error(`build-worker: no chunk for ${key} (page-copy plugin, vite.config.ts)`);
    localePacks[key] = [copyChunks[key]];
  }
}

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
  quiz: "src/client/quiz/ui.ts",
  dataset: "src/client/datasets/ui.ts",
  ranking: "src/client/rankings/ui.ts",
  kb: "src/client/kb/ui.ts",
  ref: "src/client/ref/ui.ts",
  slang: "src/client/slang/ui.ts",
};
const hubs = Object.keys(pageModules).length;
const toolsSrc = readFileSync(resolve(root, "src/client/tools.ts"), "utf8");
for (const m of toolsSrc.matchAll(/^ {2}"([a-z0-9-]+)": async[^\n]*\n\s*const m = await import\("\.\/([^"]+)"\);/gm)) {
  pageModules[m[1]] = `src/client/${m[2]}.ts`;
}
const loaderCount = (toolsSrc.match(/^ {2}"[a-z0-9-]+": /gm) ?? []).length;
const matched = Object.keys(pageModules).length - hubs;
if (matched !== loaderCount) throw new Error(`build-worker: read ${matched} of ${loaderCount} tool loaders in src/client/tools.ts; keep each as "id": async (host, ctx) => { const m = await import("./x/ui"); ... }`);
const pageChunks = {};
for (const [page, src] of Object.entries(pageModules)) {
  const files = chunkFiles(src);
  if (!files.length) throw new Error(`no Vite chunk for ${src} (page ${page})`);
  pageChunks[page] = files;
}
// Data tables: each table's rows are their own lazy chunk, preloaded as "rows-<file>" next to the dataset page chunk.
for (const file of readdirSync(resolve(root, "src/data"))) {
  const m = /^(.+)\.json$/.exec(file);
  // ref-photos.json is not a table: the reference pages import it whole.
  if (!m || m[1] === "meta" || m[1] === "ref-photos") continue;
  const files = chunkFiles(`src/data/${file}`);
  if (!files.length) throw new Error(`no Vite chunk for src/data/${file}`);
  pageChunks[`rows-${m[1]}`] = files;
}
// Ranking rows: one chunk for the small tables, one per geography table, preloaded the same way.
const rankingRowFiles = [["rows-rankings", "src/shared/rankings-rows.json"], ...readdirSync(resolve(root, "src/shared/rankings-geo")).filter((f) => f.endsWith(".json")).map((f) => [`rows-ranking-${f.slice(0, -5)}`, `src/shared/rankings-geo/${f}`])];
for (const [chunk, file] of rankingRowFiles) {
  pageChunks[chunk] = chunkFiles(file);
  if (!pageChunks[chunk].length) throw new Error(`no Vite chunk for ${file}`);
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
  // Raw UTF-8 instead of \uXXXX escapes: CJK copy is 3 bytes a character, not 6, which keeps the Worker small.
  charset: "utf8",
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

// The Worker script is deployed as `main`, not as a static asset (an asset may be at most 25 MiB).
writeFileSync(resolve(root, "dist/.assetsignore"), "_worker.js\n");

console.log("wrote dist/_worker.js");
