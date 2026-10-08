// Writes small WebP copies of the covers listed in src/shared/covers.ts to dist/thumbs/,
// at the URLs thumbSrc() builds. Menus and tiles show these instead of the 1280×720 originals.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WIDTHS = [160, 640, 960];
const COVER = /"(\/covers\/[A-Za-z0-9._/-]+\.(?:jpe?g|png))(?:\?v=(\d+))?"/g;

const source = readFileSync(resolve(root, "src/shared/covers.ts"), "utf8");
const covers = new Map();
for (const [, path, v] of source.matchAll(COVER)) covers.set(`${path}?v=${v ?? ""}`, { path, v });

let made = 0;
let missing = 0;
await Promise.all([...covers.values()].map(async ({ path, v }) => {
  const file = resolve(root, "public", path.slice(1));
  // Covers that live only on S3 have no local copy; the Worker sends those thumb URLs to the original.
  if (!existsSync(file)) {
    missing++;
    return;
  }
  const rest = path.slice("/covers/".length);
  for (const width of WIDTHS) {
    const out = resolve(root, "dist/thumbs", String(width), `${rest}${v ? `.v${v}` : ""}.webp`);
    mkdirSync(dirname(out), { recursive: true });
    await sharp(file).resize({ width, withoutEnlargement: true }).webp({ quality: width <= 160 ? 70 : 78 }).toFile(out);
    made++;
  }
}));
console.log(`wrote ${made} thumbs for ${covers.size - missing} covers (${missing} without a local copy)`);
