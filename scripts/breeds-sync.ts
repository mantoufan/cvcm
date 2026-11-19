// `npm run breeds:sync`: after adding or editing breed copy (src/locales/breeds/<locale>/<kind>/<slug>.json), regenerate the
// blurb lists, all.ts, the per-locale chunk loaders and the breeds packs (src/shared/breeds-sync.ts).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { breedsSyncFiles } from "../src/shared/breeds-sync";

const root = process.cwd();
const read = (path: string): string | null => {
  const file = resolve(root, path);
  return existsSync(file) ? readFileSync(file, "utf8") : null;
};
const { files, missing } = breedsSyncFiles(read);
// Start the generated folders empty, so a dropped breed or locale leaves nothing behind.
for (const dir of ["src/locales/breeds/index", "src/locales/breeds/head", "src/locales/breeds/loaders"]) rmSync(resolve(root, dir), { recursive: true, force: true });
for (const [path, content] of Object.entries(files)) {
  const file = resolve(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}
if (missing.length) console.warn(`breeds:sync: ${missing.length} locale files missing, English stands in: ${missing.slice(0, 10).join(" ")}${missing.length > 10 ? " …" : ""}`);
console.log(`breeds:sync: wrote ${Object.keys(files).length} files`);
