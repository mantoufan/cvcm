// Every breed's full copy (sections included), for the prerender and tests. Not imported by the Worker (breeds-all.ts).
import { BREEDS_ALL } from "../locales/breeds/all";
import type { Locale } from "./locale";
import type { BreedId } from "./breeds";
import { registerBreedEntry } from "./breeds-store";
import "./breeds-all";

for (const [locale, entries] of Object.entries(BREEDS_ALL)) {
  for (const [id, copy] of Object.entries(entries)) registerBreedEntry(locale as Locale, id as BreedId, copy);
}
