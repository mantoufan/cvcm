// `npm run nostalgia:sync`: after adding or editing nostalgia entries (src/locales/nostalgia/<locale>/<id>.json), regenerate the
// name/blurb lists, all.ts, the per-locale chunk loaders and the nostalgia packs (src/shared/nostalgia-sync.ts).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { nostalgiaSyncFiles } from "../src/shared/nostalgia-sync";

const root = process.cwd();
const read = (path: string): string | null => {
  const file = resolve(root, path);
  return existsSync(file) ? readFileSync(file, "utf8") : null;
};
const { files, missing } = nostalgiaSyncFiles(read);
// Start the generated folders empty, so a dropped entry or locale leaves nothing behind.
for (const dir of ["src/locales/nostalgia/index", "src/locales/nostalgia/loaders"]) rmSync(resolve(root, dir), { recursive: true, force: true });
for (const [path, content] of Object.entries(files)) {
  const file = resolve(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}
if (missing.length) console.warn(`nostalgia:sync: ${missing.length} locale files missing, English stands in: ${missing.slice(0, 10).join(" ")}${missing.length > 10 ? " …" : ""}`);
console.log(`nostalgia:sync: wrote ${Object.keys(files).length} files`);
