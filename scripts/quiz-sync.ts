// `npm run quiz:sync`: after adding or editing tests (src/locales/quiz/<locale>/<id>.json), regenerate all.ts and the
// per-locale chunk loaders (src/shared/quiz-sync.ts).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { quizSyncFiles } from "../src/shared/quiz-sync";

const root = process.cwd();
const read = (path: string): string | null => {
  const file = resolve(root, path);
  return existsSync(file) ? readFileSync(file, "utf8") : null;
};
const files = quizSyncFiles(read);
// Start the generated folder empty, so a dropped locale leaves nothing behind.
rmSync(resolve(root, "src/locales/quiz/loaders"), { recursive: true, force: true });
for (const [path, content] of Object.entries(files)) {
  const file = resolve(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}
console.log(`quiz:sync: wrote ${Object.keys(files).length} files`);
