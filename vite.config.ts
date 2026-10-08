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
