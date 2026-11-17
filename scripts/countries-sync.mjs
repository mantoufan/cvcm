// Builds the country profiles' data (/{locale}/countries/) from snapshots already in the repo, offline:
//   src/data/*.json (World Bank WDI, ISO 3166, ITU, ISO 4217, IANA tz: scripts/fetch-datasets.mjs)
//   src/shared/countries-capitals.json (Wikidata capitals and the flag list: scripts/fetch-countries.mjs)
//   src/shared/rankings-geo/*.json, src/shared/rankings-rows.json (which rankings list a country)
// Writes src/shared/countries-index.json (slugs, in the main bundle: keep it small), src/shared/countries/summary.json
// (what lists need: continent, flag, capitals, population; rides in the countries pack chunk) and
// src/shared/countries/b<n>.json (every figure and code, COUNTRY_BUCKETS chunks by `countryBucket`, so a page loads
// one small file, not every country).
// `npm run countries:sync` after either fetch script; tests/countries.test.ts fails while the output is stale.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** How many data chunks the profiles are split into; each code's bucket is written to countries-index.json. */
export const COUNTRY_BUCKETS = 16;
export function countryBucket(code) {
  return (code.charCodeAt(0) * 31 + code.charCodeAt(1)) % COUNTRY_BUCKETS;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => JSON.parse(readFileSync(join(root, file), "utf8"));

/** Self-harm figures need the crisis box the dataset page shows; a country profile is no place for them. */
export const LEFT_OUT = ["suicide-rate"];
/** The share tables compare these markets (RANKING_REGIONS in src/shared/rankings.ts). */
const SHARE_REGIONS = ["US", "CN", "TW", "JP", "KR", "VN", "ID", "ES"];
const SHARE_RANKINGS = ["browser-market-share", "os-market-share", "search-engine-market-share", "phone-market-share", "social-media-market-share"];
/** Economies the World Bank lists without an ISO 3166 row (no continent in countries.json). */
const CONTINENT = { XK: "EU", JG: "EU" };
/** URL names fixed by hand where the English short name reads badly in a URL. Existing slugs never change. */
const SLUG = { HK: "hong-kong", MO: "macao", PS: "palestine", MM: "myanmar", JG: "channel-islands", CD: "dr-congo", CG: "republic-of-the-congo", VI: "us-virgin-islands" };

function slugify(name) {
  return name
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ").replace(/\bSt\.\s/g, "saint ").replace(/\(.*?\)/g, "")
    .toLowerCase().replace(/['’]/g, "-").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function buildCountries() {
  const spec = read("src/shared/indicators.json");
  const ids = Object.keys(spec).filter((id) => !LEFT_OUT.includes(id));
  const meta = read("src/data/meta.json");
  const caps = read("src/shared/countries-capitals.json");
  const iso = new Map(read("src/data/countries.json").map((r) => [r[0], r]));
  const zones = read("src/data/time-zones.json");
  const english = new Map();
  const values = new Map();
  const rows = {};
  for (const id of ids) {
    const table = read(`src/data/${id}.json`);
    rows[id] = table.length;
    // Rows come sorted by value, largest first; equal values share a rank (as on the dataset page).
    let rank = 0;
    table.forEach((row, index) => {
      if (index === 0 || row[2] !== table[index - 1][2]) rank = index + 1;
      if (!values.has(row[0])) values.set(row[0], {});
      values.get(row[0])[id] = [row[2], row[3], rank];
      if (!english.has(row[0])) english.set(row[0], row[4]);
    });
  }
  // Rankings that list the country: place tables by the codes in each row, share tables for their eight markets, the
  // currency table for its currencies.
  const ranked = new Map();
  const add = (code, id) => {
    if (!ranked.has(code)) ranked.set(code, {});
    ranked.get(code)[id] = (ranked.get(code)[id] ?? 0) + 1;
  };
  for (const file of readdirSync(join(root, "src/shared/rankings-geo")).filter((f) => f.endsWith(".json")).sort()) {
    const id = file.slice(0, -5);
    for (const row of read(`src/shared/rankings-geo/${file}`)) {
      const list = row.find((cell) => Array.isArray(cell) && cell.length && cell.every((c) => typeof c === "string" && /^[A-Z]{2}$/.test(c)));
      for (const code of new Set(list ?? [])) add(code, id);
    }
  }
  const currencyRanked = new Set(read("src/shared/rankings-rows.json")["currency-strength"].map((r) => r[1]));

  const old = (() => {
    try {
      return read("src/shared/countries-index.json").slugs;
    } catch {
      return {};
    }
  })();
  const slugOf = new Map(Object.entries(old).map(([slug, code]) => [code, slug]));
  const names = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });
  const codes = [...values.keys()].sort();
  for (const code of codes) {
    if (slugOf.has(code)) continue;
    const slug = SLUG[code] ?? slugify(names.of(code) ?? english.get(code));
    if (!slug || [...slugOf.values()].includes(slug)) throw new Error(`countries-sync: no unique slug for ${code} (${slug})`);
    slugOf.set(code, slug);
  }
  const slugs = Object.fromEntries(codes.map((code) => [slugOf.get(code), code]).sort((a, b) => a[0].localeCompare(b[0])));

  const summary = {};
  const buckets = Array.from({ length: COUNTRY_BUCKETS }, () => ({}));
  for (const code of codes) {
    const r = iso.get(code);
    const continent = r?.[4] || CONTINENT[code];
    // Every place must sit under a continent, or the hub would silently leave it out.
    if (!continent) throw new Error(`countries-sync: no continent for ${code}; add it to CONTINENT`);
    const tz = zones.filter((z) => z[3] === code).map((z) => [z[0], z[1], z[2]]);
    const cur = r?.[6] ? r[6].split(",").filter(Boolean) : [];
    const rk = { ...(ranked.get(code) ?? {}) };
    if (SHARE_REGIONS.includes(code)) for (const id of SHARE_RANKINGS) rk[id] = 1;
    if (cur.some((c) => currencyRanked.has(c))) rk["currency-strength"] = 1;
    summary[code] = {
      en: english.get(code),
      c: continent,
      flag: caps.flags.includes(code),
      cap: (caps.capitals[code] ?? []).map(({ q, ...labels }) => labels),
      ...(values.get(code).population ? { pop: values.get(code).population } : {}),
    };
    buckets[countryBucket(code)][code] = {
      ...(r ? { a3: r[1], num: r[2], tld: r[3], dial: r[5], cur } : {}),
      tz,
      v: values.get(code),
      rk,
    };
  }
  // The data date: the newest change to any table a page reads, or to the capitals and flags.
  const used = [...ids, "country-codes", "calling-codes", "currency-codes", "time-zones"];
  const updated = [...used.map((id) => meta.sets[id].updated), caps.updated].sort().at(-1);
  return {
    index: { updated, slugs, bucket: Object.fromEntries(codes.map((code) => [code, countryBucket(code)])) },
    summary: { updated, rows, countries: summary },
    buckets,
  };
}

export function serialize(value) {
  return JSON.stringify(value) + "\n";
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { index, summary, buckets } = buildCountries();
  mkdirSync(join(root, "src/shared/countries"), { recursive: true });
  writeFileSync(join(root, "src/shared/countries-index.json"), serialize(index));
  writeFileSync(join(root, "src/shared/countries/summary.json"), serialize(summary));
  buckets.forEach((bucket, n) => writeFileSync(join(root, `src/shared/countries/b${n}.json`), serialize(bucket)));
  console.log(`countries: ${Object.keys(index.slugs).length} pages, data ${index.updated}`);
}
