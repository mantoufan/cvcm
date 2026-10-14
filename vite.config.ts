import { dirname, resolve } from "node:path";
import { defineConfig } from "vitest/config";
import { NAMES_FILTER, gameNamesSource, namesJsonPath } from "./scripts/game-names.mjs";

// Virtual id without a .json ending, so Vite's JSON plugin leaves the generated module alone.
const NAMES_ID = "\0game-names:";

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
  }],
  resolve: {
    alias: [
      // ONNX Runtime's default web bundle pulls its 27 MB .wasm into dist/ (over Pages' 25 MiB file limit).
      // The extern-wasm build loads it from the URL the AI worker sets (/ai/ort/, mirrored on s3.cv.cm).
      { find: /^onnxruntime-web\/webgpu$/, replacement: resolve("node_modules/onnxruntime-web/dist/ort.webgpu.min.mjs") },
    ],
  },
  worker: { format: "es" },
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    modulePreload: { polyfill: false },
    assetsInlineLimit: 0,
    // Read by scripts/build-worker.mjs to preload the page locale's string pack.
    manifest: true,
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
