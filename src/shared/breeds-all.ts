// Every breeds pack and breed copy, registered at once: the Worker, the prerender and tests (src/shared/messages-all.ts).
import enBreeds from "../locales/packs/breeds-en";
import zhCNBreeds from "../locales/packs/breeds-zh-CN";
import zhTWBreeds from "../locales/packs/breeds-zh-TW";
import jaBreeds from "../locales/packs/breeds-ja";
import koBreeds from "../locales/packs/breeds-ko";
import viBreeds from "../locales/packs/breeds-vi";
import idBreeds from "../locales/packs/breeds-id";
import esBreeds from "../locales/packs/breeds-es";
import { BREEDS_ALL } from "../locales/breeds/all";
import type { Locale } from "./locale";
import type { BreedId } from "./breeds";
import { registerBreedEntry, registerBreedsMessages, type BreedsMessages } from "./breeds-store";

const PACKS: Record<Locale, BreedsMessages> = {
  "en": enBreeds,
  "zh-CN": zhCNBreeds,
  "zh-TW": zhTWBreeds,
  "ja": jaBreeds,
  "ko": koBreeds,
  "vi": viBreeds,
  "id": idBreeds,
  "es": esBreeds,
};
for (const [locale, pack] of Object.entries(PACKS)) registerBreedsMessages(locale as Locale, pack);
for (const [locale, entries] of Object.entries(BREEDS_ALL)) {
  for (const [id, copy] of Object.entries(entries)) registerBreedEntry(locale as Locale, id as BreedId, copy);
}
