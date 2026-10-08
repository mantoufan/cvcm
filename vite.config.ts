import { dirname, resolve } from "node:path";
import { defineConfig } from "vitest/config";
import { NAMES_SUFFIX, gameNamesSource } from "./scripts/game-names.mjs";

// Virtual id without a .json ending, so Vite's JSON plugin leaves the generated module alone.
const NAMES_ID = "\0game-names:";

export default defineConfig({
  plugins: [{
    name: "game-names",
    enforce: "pre",
    resolveId(source, importer) {
      if (!source.endsWith(NAMES_SUFFIX) || !importer) return null;
      return NAMES_ID + resolve(dirname(importer), source.slice(0, -NAMES_SUFFIX.length));
    },
    load(id) {
      if (!id.startsWith(NAMES_ID)) return null;
      return `export default ${gameNamesSource(`${id.slice(NAMES_ID.length)}.json`)};`;
    },
  }],
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
