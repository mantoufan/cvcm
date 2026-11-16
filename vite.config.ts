import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { NAMES_FILTER, gameNamesSource, namesJsonPath } from "./scripts/game-names.mjs";
import { COPY_BUCKETS, copyLoadersSource, pageCopyModule } from "./src/shared/page-copy";

// Virtual id without a .json ending, so Vite's JSON plugin leaves the generated module alone.
const NAMES_ID = "\0game-names:";

/**
 * seedrandom (under TensorFlow.js 2, used by the music generator) finds the global object with `(0, eval)('this')`,
 * which the AI pages' CSP forbids (no 'unsafe-eval'). globalThis is the same object. If a copy still has eval after
 * the replacement, fail the build rather than ship a model that cannot load.
 */
const seedrandomNoEval: Plugin = {
  name: "seedrandom-no-eval",
  transform(code, id) {
    if (!/[\\/]seedrandom[\\/]seedrandom\.js$/.test(id)) return null;
    // Older copies (nested under some TF.js packages) never used eval: leave those alone.
    if (!/\beval\b/.test(code)) return null;
    const out = code.replace(/\(0,\s*eval\)\(\s*['"]this['"]\s*\)/, "globalThis");
    if (/\beval\b/.test(out)) this.error(`seedrandom-no-eval: eval left in ${id}`);
    return out;
  },
};

// `virtual:page-copy/<part>/<locale>[/<bucket>]`: the browser's core `ui` and `guides` for a locale, and the bucket
// chunks with each tool's FAQ and how-to and each tutorial's text (src/shared/page-copy.ts), all cut from the same
// src/locales/<locale>.json and guides/<locale>.json the Worker bundles whole.
const COPY_PREFIX = "virtual:page-copy/";
const COPY_ID = "\0page-copy/";
const COPY_ROOT = dirname(fileURLToPath(import.meta.url));
const copySources = new Map<string, Record<string, unknown>>();

/** A page-copy module id: "<part>/<locale>[/<bucket>]". */
function copyParts(id: string): { part: string; locale: string; bucket: string | undefined } {
  const [part, locale, bucket] = id.slice(COPY_ID.length).split("/");
  return { part, locale, bucket };
}

function copySource(file: string): Record<string, unknown> {
  let data = copySources.get(file);
  if (!data) copySources.set(file, data = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>);
  return data;
}

const pageCopy: Plugin = {
  name: "page-copy",
  resolveId(source) {
    return source.startsWith(COPY_PREFIX) ? COPY_ID + source.slice(COPY_PREFIX.length) : null;
  },
  load(id) {
    if (!id.startsWith(COPY_ID)) return null;
    const { part, locale, bucket } = copyParts(id);
    // The locale's loader table: its own small chunk, so the packs stay data only.
    if (part === "loaders") return copyLoadersSource(locale);
    const files = [resolve(COPY_ROOT, `src/locales/${locale}.json`), resolve(COPY_ROOT, `src/locales/guides/${locale}.json`)];
    for (const file of files) this.addWatchFile(file);
    const data = pageCopyModule(part, copySource(files[0]), copySource(files[1]), Number(bucket));
    // JSON.parse of one string, as Vite does for large JSON files: far quicker to start than an object literal.
    return `export default JSON.parse(${JSON.stringify(JSON.stringify(data))});`;
  },
  // A dev server keeps running while the copy is edited.
  watchChange(file) {
    copySources.delete(file);
  },
  // Bucket -> hashed chunk, for scripts/build-worker.mjs to preload (virtual modules have no usable manifest key).
  generateBundle(_options, bundle) {
    const chunks: Record<string, string> = {};
    for (const chunk of Object.values(bundle)) {
      if (chunk.type !== "chunk" || !chunk.facadeModuleId?.startsWith(COPY_ID)) continue;
      const { part, locale, bucket } = copyParts(chunk.facadeModuleId);
      if (part === "loaders") chunks[`copy-${locale}`] = `/${chunk.fileName}`;
      else if (bucket !== undefined) chunks[`copy-${locale}/${part}-${bucket}`] = `/${chunk.fileName}`;
    }
    if (Object.keys(chunks).length) this.emitFile({ type: "asset", fileName: ".vite/page-copy.json", source: JSON.stringify({ buckets: COPY_BUCKETS, chunks }) });
  },
};

export default defineConfig({
  plugins: [pageCopy, {
    name: "game-names",
    enforce: "pre",
    resolveId(source, importer) {
      if (!NAMES_FILTER.test(source) || !importer) return null;
      return NAMES_ID + resolve(dirname(importer), namesJsonPath(source)).replace(/\.json$/, "");
    },
    load(id) {
      if (!id.startsWith(NAMES_ID)) return null;
      const file = `${id.slice(NAMES_ID.length)}.json`;
      this.addWatchFile(file);
      return `export default ${gameNamesSource(file)};`;
    },
  }, seedrandomNoEval],
  resolve: {
    alias: [
      // ONNX Runtime's default web bundle pulls its 27 MB .wasm into dist/ (over Pages' 25 MiB file limit).
      // The extern-wasm build loads it from the URL the AI worker sets (/ai/ort/, mirrored on s3.cv.cm).
      { find: /^onnxruntime-web\/webgpu$/, replacement: resolve("node_modules/onnxruntime-web/dist/ort.webgpu.min.mjs") },
    ],
  },
  // The music generator's model worker bundles TensorFlow.js too: same transform there.
  worker: { format: "es", plugins: () => [seedrandomNoEval] },
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    modulePreload: { polyfill: false },
    assetsInlineLimit: 0,
    // Read by scripts/build-worker.mjs to preload the page locale's string pack.
    manifest: true,
    rollupOptions: {
      output: {
        // The music generator's page and its lazy model / synth chunks share this module. Left to Rollup it is
        // folded into the page chunk, which then loses its own manifest entry (build-worker needs it to preload).
        manualChunks: (id) => (id.endsWith("/src/shared/music-gen.ts") ? "music-gen" : undefined),
        // A page-copy bucket would otherwise be named after its last path segment ("3-<hash>.js").
        chunkFileNames: (chunk) => {
          const id = chunk.facadeModuleId;
          if (!id?.startsWith(COPY_ID)) return "assets/[name]-[hash].js";
          const { part, locale, bucket } = copyParts(id);
          return part === "loaders" ? `assets/copy-${locale}-[hash].js` : `assets/copy-${part}-${locale}-${bucket}-[hash].js`;
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // VITE_COI=1 serves every dev page cross-origin isolated, like the Worker does for AI tools (threaded WASM).
    headers: process.env.VITE_COI
      ? { "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "credentialless" }
      : undefined,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
});
