// Covers (public/covers/**) are served straight from s3.cv.cm, not as Worker assets. The source keeps them as site
// paths ("/covers/x.jpg"): `npm run dev` serves those from public/, and the tests read them as written. Production
// builds (Vite, the prerender, the Worker) rewrite every string literal that starts with "/covers/" to the bucket
// URL instead. scripts/sync-covers.mjs puts the files there before each deploy. Same value as COVER_ORIGIN in
// src/shared/covers.ts (tests/covers.test.ts checks).
export const COVER_ORIGIN = "https://s3.cv.cm/files";

const LITERAL = /(["'`])\/covers\//g;

/** Source with each "/covers/…", '/covers/…' and `/covers/…` literal pointed at the bucket. */
export function rewriteCoverPaths(code) {
  return code.replace(LITERAL, `$1${COVER_ORIGIN}/covers/`);
}

// The app's own TypeScript only: not node_modules, not scripts/.
const SOURCE = /[\\/]src[\\/].*\.ts$/;

/** Vite plugin for `vite build` (not the dev server, not Vitest). */
export const coverOriginVite = {
  name: "cover-origin",
  apply: "build",
  enforce: "pre",
  transform(code, id) {
    if (!SOURCE.test(id) || id.includes("node_modules") || !code.includes("/covers/")) return null;
    return { code: rewriteCoverPaths(code), map: null };
  },
};

/** esbuild plugin for the prerender and Worker bundles. */
export const coverOriginEsbuild = {
  name: "cover-origin",
  setup(build) {
    build.onLoad({ filter: SOURCE, namespace: "file" }, async (args) => {
      if (args.path.includes("node_modules")) return undefined;
      const { readFile } = await import("node:fs/promises");
      return { contents: rewriteCoverPaths(await readFile(args.path, "utf8")), loader: "ts" };
    });
  },
};
