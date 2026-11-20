import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LOCALES } from "../src/shared/locale";
import { DATASETS } from "../src/shared/datasets";
import { datasetJsonLd } from "../src/shared/datasets-i18n";
import { RANKINGS } from "../src/shared/rankings";
import { rankingJsonLd } from "../src/shared/rankings-i18n";
import { FOODS } from "../src/shared/calories";
import { caloriesPageJsonLd } from "../src/shared/calories-i18n";
import { CURRENCY_PAIRS } from "../src/shared/currency";
import { currencyPageJsonLd } from "../src/shared/currency-i18n";
import { BREED_IDS } from "../src/shared/breeds";
import { breedsArticleJsonLd } from "../src/shared/breeds-i18n";
import { ELEMENT_SLUGS } from "../src/shared/elements-slugs";
import { elementsPageJsonLd } from "../src/shared/elements-i18n";
import { EMOJI_SLUGS } from "../src/shared/emoji-slugs";
import { emojiPageJsonLd } from "../src/shared/emoji-i18n";

/** Every node of a JSON-LD tree, depth first. */
function* nodes(value: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(value)) for (const item of value) yield* nodes(item);
  else if (value && typeof value === "object") {
    yield value as Record<string, unknown>;
    for (const child of Object.values(value)) yield* nodes(child);
  }
}

/**
 * Google Search Console reads every node typed Dataset as a dataset rich result: it needs a 50-5000 character description,
 * and creator must be exactly Organization or Person (GovernmentOrganization was flagged as an invalid object type).
 * A source we only cite is a CreativeWork, not a Dataset.
 */
function expectValidDatasets(ld: Record<string, unknown>): void {
  for (const node of nodes(ld)) {
    if (node["@type"] !== "Dataset") continue;
    const length = typeof node.description === "string" ? [...node.description.trim()].length : 0;
    expect(length >= 50 && length <= 5000, `${length} chars: ${JSON.stringify(node).slice(0, 200)}`).toBe(true);
    expect(node.license, String(node.name)).toBeTruthy();
    for (const creator of nodes(node.creator)) {
      if ("@type" in creator) expect(["Organization", "Person"]).toContain(creator["@type"]);
    }
  }
}

describe("Dataset structured data", () => {
  it.each(LOCALES)("gives every Dataset node a description and a valid creator (%s)", (locale) => {
    for (const id of [null, ...DATASETS]) expectValidDatasets(datasetJsonLd(locale, id));
    for (const id of [null, ...RANKINGS]) expectValidDatasets(rankingJsonLd(locale, id));
    for (const id of [null, ...FOODS]) expectValidDatasets(caloriesPageJsonLd(locale, id));
    for (const pair of [null, ...CURRENCY_PAIRS]) expectValidDatasets(currencyPageJsonLd(locale, pair));
    for (const id of [null, ...BREED_IDS]) expectValidDatasets(breedsArticleJsonLd(locale, id));
    for (const slug of [null, ...ELEMENT_SLUGS]) expectValidDatasets(elementsPageJsonLd(locale, slug));
    for (const slug of [null, ...EMOJI_SLUGS]) expectValidDatasets(emojiPageJsonLd(locale, slug));
  });

  it("only types Dataset in the tables cv.cm publishes", () => {
    const allowed = new Set(["shared/datasets-i18n.ts", "shared/rankings-i18n.ts"]);
    const src = fileURLToPath(new URL("../src/", import.meta.url));
    for (const file of readdirSync(src, { recursive: true }) as string[]) {
      if (!/\.tsx?$/.test(file) || allowed.has(file.replaceAll("\\", "/"))) continue;
      expect(readFileSync(`${src}${file}`, "utf8"), file).not.toMatch(/["']@type["']\s*:\s*["']Dataset["']/);
    }
  });
});
