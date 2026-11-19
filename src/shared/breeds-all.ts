// Breeds packs and each breed's head copy (description, answer, FAQ; the blurb comes from the pack, no sections), registered at once for the
// Worker (src/shared/messages-all.ts). The Worker serves the prerendered body, so it never needs the full articles;
// the prerender and tests also import breeds-all-full.ts, which registers every breed in full.
import enBreeds from "../locales/packs/breeds-en";
import zhCNBreeds from "../locales/packs/breeds-zh-CN";
import zhTWBreeds from "../locales/packs/breeds-zh-TW";
import jaBreeds from "../locales/packs/breeds-ja";
import koBreeds from "../locales/packs/breeds-ko";
import viBreeds from "../locales/packs/breeds-vi";
import idBreeds from "../locales/packs/breeds-id";
import esBreeds from "../locales/packs/breeds-es";
import enHead from "../locales/breeds/head/en.json";
import zhCNHead from "../locales/breeds/head/zh-CN.json";
import zhTWHead from "../locales/breeds/head/zh-TW.json";
import jaHead from "../locales/breeds/head/ja.json";
import koHead from "../locales/breeds/head/ko.json";
import viHead from "../locales/breeds/head/vi.json";
import idHead from "../locales/breeds/head/id.json";
import esHead from "../locales/breeds/head/es.json";
import type { Locale } from "./locale";
import type { BreedId } from "./breeds";
import { registerBreedEntry, registerBreedsMessages, type BreedEntryCopy, type BreedsMessages } from "./breeds-store";

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
const HEADS = {
  "en": enHead,
  "zh-CN": zhCNHead,
  "zh-TW": zhTWHead,
  "ja": jaHead,
  "ko": koHead,
  "vi": viHead,
  "id": idHead,
  "es": esHead,
} as unknown as Record<Locale, Record<BreedId, Omit<BreedEntryCopy, "blurb" | "sections">>>;
for (const [locale, pack] of Object.entries(PACKS)) registerBreedsMessages(locale as Locale, pack);
for (const [locale, entries] of Object.entries(HEADS)) {
  const list = PACKS[locale as Locale].list;
  for (const [id, copy] of Object.entries(entries)) registerBreedEntry(locale as Locale, id as BreedId, { ...copy, blurb: list[id as BreedId], sections: [] });
}
