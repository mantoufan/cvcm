import { dirname, resolve } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { NAMES_FILTER, gameNamesSource, namesJsonPath } from "./scripts/game-names.mjs";

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

export default defineConfig({
  plugins: [{
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
