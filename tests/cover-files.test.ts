import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";
import { LEARN_COVER, LEARN_FIG } from "../src/shared/covers";
import memeImages from "../src/shared/meme-images.json";
import nostalgiaImages from "../src/shared/nostalgia-images.json";
import { isPublishedTutorial, type TutorialId } from "../src/shared/path";
import { catalog } from "../src/shared/portrait-sim";
import { REF_MANNEQUINS, refMannequinUrl, type RefId } from "../src/shared/ref";

// Covers live only on s3.cv.cm, and scripts/sync-covers.mjs --prune deletes what leaves public/covers: every cover the
// code links must stay there, or its page 404s a week later.
const root = resolve(__dirname, "..");
const exists = (path: string) => existsSync(join(root, "public", path.split("?")[0]));

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}

// Lessons that are not published keep their map entry but have no page (their files were dropped in 893b6738).
const unpublished = new Set(
  [...Object.entries(LEARN_COVER), ...Object.entries(LEARN_FIG)]
    .filter(([id]) => !isPublishedTutorial(id as TutorialId))
    .map(([, path]) => path!.split("?")[0]),
);

it("has a file in public/covers for every cover path written in src/", () => {
  const missing: string[] = [];
  for (const file of walk(join(root, "src")).filter((f) => f.endsWith(".ts"))) {
    for (const [, path] of readFileSync(file, "utf8").matchAll(/["'`](\/covers\/[A-Za-z0-9._/-]+\.(?:jpe?g|png|webp|svg|avif))/g)) {
      if (!exists(path) && !unpublished.has(path)) missing.push(`${file.slice(root.length + 1)}: ${path}`);
    }
  }
  expect(missing).toEqual([]);
});

/** Every "/covers/…" string anywhere inside a value (catalog objects built from template literals). */
function coverStrings(value: unknown): string[] {
  if (typeof value === "string") return value.startsWith("/covers/") ? [value] : [];
  if (value && typeof value === "object") return Object.values(value).flatMap(coverStrings);
  return [];
}

it("has a file for every portrait simulator plate, cutout and thumbnail", () => {
  const paths = coverStrings(catalog);
  expect(paths.length).toBeGreaterThan(30);
  expect(paths.filter((path) => !exists(path))).toEqual([]);
});

it("has a file for every meme, nostalgia and mannequin picture", () => {
  const paths = [
    ...Object.values(memeImages as Record<string, { src: string }>).map((image) => `/covers/${image.src}`),
    ...Object.values(nostalgiaImages as Record<string, { src: string }>).map((image) => `/covers/${image.src}`),
    ...Object.entries(REF_MANNEQUINS).flatMap(([id, angles]) =>
      (angles ?? []).flatMap((angle) => ([300, 600, 900] as const).map((w) => refMannequinUrl(id as RefId, angle, w)))),
  ];
  expect(paths.length).toBeGreaterThan(50);
  expect(paths.filter((path) => !exists(path))).toEqual([]);
});
