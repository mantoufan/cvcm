/**
 * Dog and cat breed pages under `/{locale}/breeds/` (hub) and `/{locale}/breeds/{dogs|cats}/{slug}/`: origin, size,
 * coat, temperament and care for the most-read breeds, answering "golden retriever / maine coon / 犬種 / 猫 種類 /
 * razas de perros" searches. The breeds are the most-read Wikipedia articles about dog and cat breeds in the site's
 * languages that have names in all eight locales (rule in scripts/fetch-breeds.mjs). Placed under Data
 * (channel-parent.ts). Main bundle: keep it small (ids, kinds, dates, the footer and quiz links).
 */
import { BREEDS_SNAPSHOT, CAT_SLUGS, DOG_SLUGS } from "./breeds-slugs";

export { BREEDS_SNAPSHOT } from "./breeds-slugs";

export const BREEDS_SEGMENT = "breeds";

export const BREED_KINDS = ["dogs", "cats"] as const;
export type BreedKind = (typeof BREED_KINDS)[number];

export type DogSlug = (typeof DOG_SLUGS)[number];
export type CatSlug = (typeof CAT_SLUGS)[number];
/** A breed: its kind segment and slug, as in the URL (`dogs/golden-retriever`). */
export type BreedId = `dogs/${DogSlug}` | `cats/${CatSlug}`;

export const BREED_IDS: readonly BreedId[] = [
  ...DOG_SLUGS.map((slug) => `dogs/${slug}` as BreedId),
  ...CAT_SLUGS.map((slug) => `cats/${slug}` as BreedId),
];

export const DOG_COUNT = DOG_SLUGS.length;
export const CAT_COUNT = CAT_SLUGS.length;

/** A breeds page: the hub, one breed, or none. */
export type BreedsPage = BreedId | "hub" | null;

const IDS = new Set<string>(BREED_IDS);

export function isBreedId(value: string): value is BreedId {
  return IDS.has(value);
}

export function breedKindOf(id: BreedId): BreedKind {
  return id.startsWith("dogs/") ? "dogs" : "cats";
}

/** The breed of `kind` with this slug, or null. */
export function breedIdOf(kind: string, slug: string): BreedId | null {
  const id = `${kind}/${slug}`;
  return isBreedId(id) ? id : null;
}

/** File-name form of an id (`dog-golden-retriever`): picture names and copy chunk keys. */
export function breedKey(id: BreedId): string {
  return `${breedKindOf(id) === "dogs" ? "dog" : "cat"}-${id.slice(id.indexOf("/") + 1)}`;
}

export const BREEDS_PUBLISHED = "2026-11-18";

/** Breeds whose copy was edited after they went live, by id, for dateModified and the sitemap (set by hand). */
export const BREEDS_UPDATED: Partial<Record<BreedId, string>> = {};

/**
 * When a page last changed (dateModified and the sitemap lastmod): for a breed, the latest of the day the channel went
 * live, the data snapshot and its copy edit; for the hub (null), the latest of those over every breed.
 */
export function breedsUpdated(id: BreedId | null): string {
  const dates = [BREEDS_PUBLISHED, BREEDS_SNAPSHOT, ...(id ? [BREEDS_UPDATED[id]] : Object.values(BREEDS_UPDATED))];
  return dates.filter((d): d is string => Boolean(d)).sort().at(-1)!;
}

/** Breeds the site footer links directly (the biggest searches); names are core-pack `breedsFocus.*` (= the Wikidata names). */
export const BREEDS_FOCUS = [
  "dogs/golden-retriever",
  "dogs/labrador-retriever",
  "dogs/german-shepherd",
  "dogs/shiba-inu",
  "dogs/siberian-husky",
  "dogs/poodle",
  "cats/maine-coon",
  "cats/british-shorthair",
  "cats/ragdoll",
  "cats/siamese",
] as const satisfies readonly BreedId[];

/**
 * The tests column's breed quizzes and the breed page behind each result (`src/shared/quiz.ts` dims). The quiz result
 * links its breed page; every breed page of that kind links back to the quiz.
 */
export const BREED_QUIZ = {
  "dog-breed": {
    kind: "dogs",
    results: {
      golden: "dogs/golden-retriever",
      collie: "dogs/border-collie",
      shepherd: "dogs/german-shepherd",
      chihuahua: "dogs/chihuahua",
      husky: "dogs/siberian-husky",
      corgi: "dogs/pembroke-welsh-corgi",
      poodle: "dogs/poodle",
      beagle: "dogs/beagle",
    },
  },
  "cat-breed": {
    kind: "cats",
    results: {
      mainecoon: "cats/maine-coon",
      siamese: "cats/siamese",
      persian: "cats/persian",
      british: "cats/british-shorthair",
      bengal: "cats/bengal",
      ragdoll: "cats/ragdoll",
      sphynx: "cats/sphynx",
      russianblue: "cats/russian-blue",
    },
  },
} as const satisfies Record<string, { kind: BreedKind; results: Record<string, BreedId> }>;

export type BreedQuizId = keyof typeof BREED_QUIZ;

/** The breed page behind a quiz result, or null (another quiz, or a result without a page). */
export function breedOfQuizResult(quiz: string, result: string): BreedId | null {
  const entry = (BREED_QUIZ as Record<string, { results: Record<string, BreedId> }>)[quiz];
  return entry?.results[result] ?? null;
}

/** The quiz that goes with a breed's kind. */
export function quizOfBreed(id: BreedId): BreedQuizId {
  return breedKindOf(id) === "dogs" ? "dog-breed" : "cat-breed";
}
