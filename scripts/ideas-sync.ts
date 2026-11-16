// `npm run ideas:sync`: after adding or editing ideas (src/locales/ideas/<locale>/<id>.json), regenerate the
// name/blurb lists, all.ts, the per-locale chunk loaders and the ideas packs (src/shared/ideas-sync.ts).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ideasSyncFiles } from "../src/shared/ideas-sync";

const root = process.cwd();
const read = (path: string): string | null => {
  const file = resolve(root, path);
  return existsSync(file) ? readFileSync(file, "utf8") : null;
};
const { files, missing } = ideasSyncFiles(read);
// Start the generated folders empty, so a dropped entry or locale leaves nothing behind.
for (const dir of ["src/locales/ideas/index", "src/locales/ideas/loaders"]) rmSync(resolve(root, dir), { recursive: true, force: true });
for (const [path, content] of Object.entries(files)) {
  const file = resolve(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}
if (missing.length) console.warn(`ideas:sync: ${missing.length} locale files missing, English stands in: ${missing.slice(0, 10).join(" ")}${missing.length > 10 ? " …" : ""}`);
console.log(`ideas:sync: wrote ${Object.keys(files).length} files`);
