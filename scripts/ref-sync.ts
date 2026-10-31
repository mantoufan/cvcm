// `npm run ref:sync`: after adding or editing reference entries (src/locales/ref/<locale>/<id>.json), regenerate the
// name/blurb lists, the names table, all.ts, the per-locale chunk loaders and the ref packs (src/shared/ref-sync.ts).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { refSyncFiles } from "../src/shared/ref-sync";

const root = process.cwd();
const read = (path: string): string | null => {
  const file = resolve(root, path);
  return existsSync(file) ? readFileSync(file, "utf8") : null;
};
const { files, missing } = refSyncFiles(read);
// Start the generated folders empty, so a dropped entry or locale leaves nothing behind.
for (const dir of ["src/locales/ref/index", "src/locales/ref/loaders"]) rmSync(resolve(root, dir), { recursive: true, force: true });
for (const [path, content] of Object.entries(files)) {
  const file = resolve(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}
if (missing.length) console.warn(`ref:sync: ${missing.length} locale files missing, English stands in: ${missing.slice(0, 10).join(" ")}${missing.length > 10 ? " …" : ""}`);
console.log(`ref:sync: wrote ${Object.keys(files).length} files`);
