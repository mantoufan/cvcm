// `import names from "…/games/<locale>.json?names"` keeps only each game's name and blurb, so the
// core locale pack can list every game without carrying the full copy (loaded on game pages).
import { readFileSync } from "node:fs";

export const NAMES_SUFFIX = ".json?names";
export const NAMES_FILTER = /\.json\?names$/;

/** JSON file behind a `…/<locale>.json?names` specifier. */
export function namesJsonPath(specifier) {
  return specifier.slice(0, -"?names".length);
}

export function gameNamesSource(jsonFile) {
  const names = {};
  for (const [id, copy] of Object.entries(JSON.parse(readFileSync(jsonFile, "utf8")))) {
    names[id] = { name: copy.name, blurb: copy.blurb };
  }
  return JSON.stringify(names);
}
