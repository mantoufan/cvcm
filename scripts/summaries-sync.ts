// `npm run summaries:sync`: after adding or editing summaries (src/locales/summaries/<locale>/<id>.json), regenerate the
// name/blurb lists, all.ts, the per-locale chunk loaders and the summaries packs (src/shared/summaries-sync.ts).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { summariesSyncFiles } from "../src/shared/summaries-sync";

const root = process.cwd();
const read = (path: string): string | null => {
  const file = resolve(root, path);
  return existsSync(file) ? readFileSync(file, "utf8") : null;
};
const { files, missing } = summariesSyncFiles(read);
// Start the generated folders empty, so a dropped work or locale leaves nothing behind.
for (const dir of ["src/locales/summaries/index", "src/locales/summaries/loaders"]) rmSync(resolve(root, dir), { recursive: true, force: true });
for (const [path, content] of Object.entries(files)) {
  const file = resolve(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}
const masters = missing.filter((path) => path.startsWith("src/locales/summaries/en/"));
if (masters.length) console.warn(`summaries:sync: ${masters.length} English masters missing, those works are left out: ${masters.map((p) => p.slice(25, -5)).join(" ")}`);
const others = missing.filter((path) => !masters.includes(path));
if (others.length) console.warn(`summaries:sync: ${others.length} locale files missing, English stands in: ${others.slice(0, 10).join(" ")}${others.length > 10 ? " …" : ""}`);
console.log(`summaries:sync: wrote ${Object.keys(files).length} files`);
