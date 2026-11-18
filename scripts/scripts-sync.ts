// `npm run scripts:sync`: after adding or editing scripts (src/locales/scripts/<locale>/<id>.json), regenerate the
// name/blurb lists, all.ts, the per-locale chunk loaders and the scripts packs (src/shared/scripts-sync.ts).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { scriptsSyncFiles } from "../src/shared/scripts-sync";

const root = process.cwd();
const read = (path: string): string | null => {
  const file = resolve(root, path);
  return existsSync(file) ? readFileSync(file, "utf8") : null;
};
const { files, missing } = scriptsSyncFiles(read);
// Start the generated folders empty, so a dropped entry or locale leaves nothing behind.
for (const dir of ["src/locales/scripts/index", "src/locales/scripts/loaders"]) rmSync(resolve(root, dir), { recursive: true, force: true });
for (const [path, content] of Object.entries(files)) {
  const file = resolve(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}
if (missing.length) console.warn(`scripts:sync: ${missing.length} locale files missing, English stands in: ${missing.slice(0, 10).join(" ")}${missing.length > 10 ? " …" : ""}`);
console.log(`scripts:sync: wrote ${Object.keys(files).length} files`);
