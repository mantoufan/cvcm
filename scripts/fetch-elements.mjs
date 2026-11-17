// Snapshots the data behind /{locale}/periodic-table/ (the periodic table channel). Run by hand to refresh
// (`node scripts/fetch-elements.mjs`), then commit. Pages never call these APIs.
//   PubChem periodic table (NCBI/NLM, U.S. government work, no restrictions on use):
//     https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON
//     PubChem compiles it from IUPAC CIAAW, the IAEA Atomic Mass Data Center, NIST, Los Alamos National Laboratory and
//     Jefferson Lab (see each element's record, e.g. https://pubchem.ncbi.nlm.nih.gov/element/6).
//   Element names in eight languages: Wikidata labels (CC0), https://query.wikidata.org/
// Writes src/shared/elements-data.json (language-neutral rows), src/shared/elements-slugs.ts (slugs + snapshot date)
// and src/locales/elements/names/<locale>.json (118 names, index = atomic number − 1).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const today = new Date().toISOString().slice(0, 10);
const UA = "cv.cm periodic table snapshot (https://cv.cm/; scripts/fetch-elements.mjs)";

async function getJson(url, init = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { ...init, headers: { "User-Agent": UA, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(120_000) });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (err) {
      if (attempt >= 4) throw err;
      await new Promise((r) => setTimeout(r, 4000 * attempt));
    }
  }
}

// ---------- PubChem ----------
const pub = await getJson("https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON");
const columns = pub.Table.Columns.Column;
const col = (name) => {
  const i = columns.indexOf(name);
  if (i < 0) throw new Error(`PubChem column ${name} missing`);
  return i;
};
const C = Object.fromEntries(["AtomicNumber", "Symbol", "Name", "AtomicWeight", "CPKHexColor", "ElectronConfiguration", "Electronegativity", "AtomicRadius", "IonizationEnergy", "ElectronAffinity", "OxidationStates", "StandardState", "MeltingPoint", "BoilingPoint", "Density", "GroupBlock", "YearDiscovered"].map((n) => [n, col(n)]));

const CATEGORY = {
  "Nonmetal": "nonmetal",
  "Noble gas": "noble-gas",
  "Alkali metal": "alkali-metal",
  "Alkaline earth metal": "alkaline-earth-metal",
  "Metalloid": "metalloid",
  "Halogen": "halogen",
  "Post-transition metal": "post-transition-metal",
  "Transition metal": "transition-metal",
  "Lanthanide": "lanthanide",
  "Actinide": "actinide",
};
const STATE = { Solid: "solid", Liquid: "liquid", Gas: "gas" };

/** A number as PubChem wrote it (keeps its digits), or null for an empty cell. Throws on anything else. */
function num(value, what) {
  const v = value.trim();
  if (v === "") return null;
  if (!/^-?\d+(\.\d+)?$/.test(v)) throw new Error(`${what}: not a number: ${v}`);
  return v;
}

const rows = pub.Table.Row.map((row) => row.Cell);
if (rows.length !== 118) throw new Error(`PubChem returned ${rows.length} elements, expected 118`);
const elements = rows.map((cell, i) => {
  const z = Number(cell[C.AtomicNumber]);
  if (z !== i + 1) throw new Error(`row ${i}: atomic number ${z}`);
  const what = `Z=${z}`;
  const category = CATEGORY[cell[C.GroupBlock]];
  if (!category) throw new Error(`${what}: unknown group block ${cell[C.GroupBlock]}`);
  const rawState = cell[C.StandardState];
  const expected = /^Expected to be an? /.exec(rawState);
  const state = STATE[expected ? rawState.slice(expected[0].length) : rawState];
  if (!state) throw new Error(`${what}: unknown state ${rawState}`);
  const rawConfig = cell[C.ElectronConfiguration].trim();
  const note = /\s*\((predicted|calculated)\)$/.exec(rawConfig);
  const year = cell[C.YearDiscovered].trim();
  if (year !== "Ancient" && !/^\d{4}$/.test(year)) throw new Error(`${what}: year ${year}`);
  const ox = cell[C.OxidationStates].trim();
  // PubChem writes palladium's Jmol colour 006985 as the number 6985: pad lost leading zeros back to six digits.
  const cpk = cell[C.CPKHexColor].trim().padStart(cell[C.CPKHexColor].trim() ? 6 : 0, "0");
  if (cpk && !/^[0-9A-F]{6}$/i.test(cpk)) throw new Error(`${what}: colour ${cpk}`);
  return {
    z,
    symbol: cell[C.Symbol].trim(),
    pubchemName: cell[C.Name].trim(),
    mass: num(cell[C.AtomicWeight], `${what} mass`),
    cpk: cpk ? cpk.toUpperCase() : null,
    config: note ? rawConfig.slice(0, note.index).trim() : rawConfig,
    configNote: note ? note[1] : null,
    electronegativity: num(cell[C.Electronegativity], `${what} electronegativity`),
    radius: num(cell[C.AtomicRadius], `${what} radius`),
    ionization: num(cell[C.IonizationEnergy], `${what} ionization`),
    affinity: num(cell[C.ElectronAffinity], `${what} affinity`),
    oxidation: ox ? ox.split(/,\s*/) : [],
    state,
    stateExpected: Boolean(expected),
    melting: num(cell[C.MeltingPoint], `${what} melting`),
    boiling: num(cell[C.BoilingPoint], `${what} boiling`),
    density: num(cell[C.Density], `${what} density`),
    category,
    year: year === "Ancient" ? "ancient" : Number(year),
  };
});

// ---------- Wikidata names ----------
// Only labels in the locale's own script: zh-CN takes Simplified variants (mainland, generic, Singapore, Malaysia), zh-TW
// Traditional ones (Taiwan, generic). The bare "zh" label is never used: it can be either script.
const LOCALES = { en: ["en"], "zh-CN": ["zh-cn", "zh-hans", "zh-sg", "zh-my"], "zh-TW": ["zh-tw", "zh-hant"], ja: ["ja"], ko: ["ko"], vi: ["vi"], id: ["id"], es: ["es"] };
/**
 * Mainland names for elements whose Wikidata items carry no Simplified label (only zh-hant / zh-tw / bare zh). Not
 * converted character by character: element names differ by region (Taiwan's lutetium 鎦 would become 镏; the mainland
 * name is 镥). Each was checked against zh.wikipedia's zh-cn variant title of the element's article (2026-11-17), which
 * follows the names fixed by China's National Committee for Terms in Sciences and Technologies (CNTERM). Any other gap
 * fails the script: add it here only after the same check.
 */
const ZH_CN_GAPS = { 54: "氙", 60: "钕", 62: "钐", 64: "钆", 65: "铽", 66: "镝", 71: "镥", 75: "铼" };
/** Metal-radical characters in the Traditional form (釒, U+91D2–U+9484) and the Simplified form (钅, U+9485–U+95AB). */
const TRADITIONAL_METAL = /[\u91D2-\u9484]/u;
const SIMPLIFIED_METAL = /[\u9485-\u95AB]/u;
const langs = [...new Set(Object.values(LOCALES).flat())];
const query = `SELECT ?item ?z (LANG(?l) AS ?lang) ?l WHERE {
  ?item wdt:P31 wd:Q11344; wdt:P1086 ?z .
  FILTER(?z >= 1 && ?z <= 118)
  ?item rdfs:label ?l .
  FILTER(LANG(?l) IN (${langs.map((l) => `"${l}"`).join(",")}))
}`;
const wd = await getJson(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`, { headers: { Accept: "application/sparql-results+json" } });
/** Labels by atomic number, then by Wikidata item (more than one item can carry an atomic number). */
const byZ = new Map();
for (const b of wd.results.bindings) {
  const z = Math.round(Number(b.z.value));
  const item = b.item.value;
  if (!byZ.has(z)) byZ.set(z, new Map());
  const items = byZ.get(z);
  if (!items.has(item)) items.set(item, {});
  items.get(item)[b.lang.value] = b.l.value;
}
const capital = (s, lang) => (lang === "en" || lang === "es" || lang === "id" || lang === "vi" ? s.charAt(0).toLocaleUpperCase(lang) + s.slice(1) : s);
const names = Object.fromEntries(Object.keys(LOCALES).map((locale) => [locale, []]));
const items = [];
const fallbacks = [];
const missing = [];
for (const el of elements) {
  const candidates = [...(byZ.get(el.z) ?? new Map()).entries()];
  // The element's own item: its English label is PubChem's name (or the IUPAC spelling of it); else the one with most labels.
  const iupac = { aluminum: "aluminium", cesium: "caesium" };
  const want = el.pubchemName.toLowerCase();
  const pick = candidates.find(([, l]) => l.en && (l.en.toLowerCase() === want || l.en.toLowerCase() === iupac[want]))
    ?? candidates.sort((a, b) => Object.keys(b[1]).length - Object.keys(a[1]).length)[0];
  if (!pick) throw new Error(`Wikidata: no item for Z=${el.z}`);
  const [item, labels] = pick;
  items.push(item.replace("http://www.wikidata.org/entity/", ""));
  for (const [locale, keys] of Object.entries(LOCALES)) {
    const key = keys.find((k) => labels[k]);
    let name = key ? labels[key].trim() : null;
    if (!name && locale === "zh-CN" && ZH_CN_GAPS[el.z]) {
      name = ZH_CN_GAPS[el.z];
      fallbacks.push(`zh-CN Z=${el.z} from ZH_CN_GAPS`);
    }
    if (!name) missing.push(`${locale} Z=${el.z} ${el.pubchemName} (${item})`);
    else {
      if (key && key !== keys[0]) fallbacks.push(`${locale} Z=${el.z} from ${key}`);
      if (locale === "zh-CN" && TRADITIONAL_METAL.test(name)) missing.push(`zh-CN Z=${el.z} ${el.pubchemName}: "${name}" has a Traditional character`);
      if (locale === "zh-TW" && SIMPLIFIED_METAL.test(name)) missing.push(`zh-TW Z=${el.z} ${el.pubchemName}: "${name}" has a Simplified character`);
    }
    names[locale].push(name ? capital(name, keys[0].slice(0, 2)) : "");
  }
}
if (missing.length) throw new Error(`no name in the locale's own script (nothing written):\n  ${missing.join("\n  ")}`);
const slugs = names.en.map((name) => name.toLowerCase());
for (const slug of slugs) if (!/^[a-z]+$/.test(slug)) throw new Error(`slug ${slug}`);
if (new Set(slugs).size !== 118) throw new Error("duplicate slugs");
elements.forEach((el, i) => (el.wikidata = items[i]));

// ---------- write ----------
const dataFile = join(root, "src/shared/elements-data.json");
let snapshot = today;
try {
  const old = JSON.parse(readFileSync(dataFile, "utf8"));
  const oldNames = Object.fromEntries(Object.keys(LOCALES).map((l) => [l, JSON.parse(readFileSync(join(root, `src/locales/elements/names/${l}.json`), "utf8"))]));
  const oldSnapshot = /ELEMENTS_SNAPSHOT = "(\d{4}-\d{2}-\d{2})"/.exec(readFileSync(join(root, "src/shared/elements-slugs.ts"), "utf8"))?.[1];
  if (oldSnapshot && JSON.stringify(old) === JSON.stringify(elements) && JSON.stringify(oldNames) === JSON.stringify(names)) snapshot = oldSnapshot;
} catch {
  /* first run */
}
writeFileSync(dataFile, `${JSON.stringify(elements, null, 1)}\n`);
mkdirSync(join(root, "src/locales/elements/names"), { recursive: true });
for (const [locale, list] of Object.entries(names)) writeFileSync(join(root, `src/locales/elements/names/${locale}.json`), `${JSON.stringify(list, null, 1)}\n`);
writeFileSync(join(root, "src/shared/elements-slugs.ts"), `// Generated by \`node scripts/fetch-elements.mjs\`; do not edit. Element slugs (IUPAC English names, Wikidata) by atomic number.
/** The day the PubChem / Wikidata snapshot last changed (page dateModified and sitemap lastmod). */
export const ELEMENTS_SNAPSHOT = "${snapshot}";

export const ELEMENT_SLUGS = [
${slugs.map((s) => `  "${s}",`).join("\n")}
] as const;
`);
console.log(`wrote 118 elements (snapshot ${snapshot})`);
if (fallbacks.length) console.log(`name fallbacks: ${fallbacks.join("; ")}`);
