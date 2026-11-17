// Snapshots what the country profiles (/{locale}/countries/) need beyond the data tables in src/data/:
//   capitals: Wikidata (CC0), property P36 on the item with the ISO 3166-1 alpha-2 code (P297), labels in the eight
//             site languages through wbgetentities with language fallback → src/shared/countries-capitals.json
//   flags:    the flag-icons npm package (MIT, pinned below), 4:3 SVGs → public/flags/<code>.svg + LICENSE
// Run by hand (`node scripts/fetch-countries.mjs`), then `npm run countries:sync` and commit. Pages never call these.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FLAG_ICONS = "7.5.0";
const UA = "cv.cm country profiles (https://cv.cm; m@cv.cm)";
const LANGS = { en: "en", "zh-CN": "zh-cn", "zh-TW": "zh-tw", ja: "ja", ko: "ko", vi: "vi", id: "id", es: "es" };

/**
 * No capital is shown where naming one would take a side: Taiwan, Israel (Jerusalem), Palestine, Kosovo and Yemen
 * (Sanaa and Aden are held by rival governments). Several capitals that are a constitutional fact stay (South Africa,
 * Bolivia, Sri Lanka, Eswatini). Taiwan
 * also gets no flag. The pages state no sovereignty either way; they show the World Bank figures and codes only.
 */
export const NO_CAPITAL = ["TW", "IL", "PS", "XK", "YE"];
export const NO_FLAG = ["TW"];

/** Every economy with at least one World Bank figure in src/data: the pages the channel has. */
function codes() {
  const spec = JSON.parse(readFileSync(join(root, "src/shared/indicators.json"), "utf8"));
  const set = new Set();
  for (const id of Object.keys(spec)) for (const row of JSON.parse(readFileSync(join(root, "src/data", `${id}.json`), "utf8"))) set.add(row[0]);
  return [...set].sort();
}

async function getJson(url, init = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { ...init, headers: { "User-Agent": UA, Accept: "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(90_000) });
      if (!res.ok) throw new Error(`${res.status} ${url.slice(0, 120)}`);
      return await res.json();
    } catch (err) {
      if (attempt >= 5) throw err;
      await new Promise((r) => setTimeout(r, 4000 * attempt));
    }
  }
}

async function capitals(list) {
  const query = "SELECT ?code ?cap WHERE { ?item wdt:P297 ?code . ?item wdt:P36 ?cap }";
  const sparql = await getJson(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, { headers: { Accept: "application/sparql-results+json" } });
  const byCode = new Map();
  for (const b of sparql.results.bindings) {
    const code = b.code.value.toUpperCase();
    if (!list.includes(code) || NO_CAPITAL.includes(code)) continue;
    const q = b.cap.value.split("/").pop();
    if (!/^Q\d+$/.test(q)) continue;
    byCode.set(code, [...new Set([...(byCode.get(code) ?? []), q])]);
  }
  const ids = [...new Set([...byCode.values()].flat())];
  const labels = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&languagefallback=1&ids=${batch.join("|")}&languages=${Object.values(LANGS).join("|")}`;
    const data = await getJson(url);
    for (const [q, entity] of Object.entries(data.entities)) {
      const out = {};
      for (const [locale, lang] of Object.entries(LANGS)) {
        const label = entity.labels?.[lang]?.value;
        if (label) out[locale] = label;
      }
      if (!out.en) throw new Error(`capital ${q} has no English label`);
      // Disambiguated labels ("La Paz, Bolivia", "Victoria (Seychelles)") lose the part the English label does not have.
      for (const locale of Object.keys(out)) {
        if (!out.en.includes(",")) out[locale] = out[locale].split(/,\s|，/)[0];
        if (!out.en.includes("(")) out[locale] = out[locale].replace(/\s*[(（][^)）]*[)）]$/, "");
      }
      labels.set(q, out);
    }
  }
  const result = {};
  for (const code of [...byCode.keys()].sort()) {
    // Several capitals (South Africa, Bolivia, Sri Lanka …): in the order of their English names, so reruns are stable.
    result[code] = byCode.get(code).map((q) => ({ q, ...labels.get(q) })).sort((a, b) => a.en.localeCompare(b.en, "en"));
  }
  return result;
}

function flags(list) {
  const work = mkdtempSync(join(tmpdir(), "cvcm-flags-"));
  try {
    const tgz = join(work, "flag-icons.tgz");
    execFileSync("curl", ["-sSfL", "-o", tgz, `https://registry.npmjs.org/flag-icons/-/flag-icons-${FLAG_ICONS}.tgz`]);
    execFileSync("tar", ["xzf", tgz, "-C", work]);
    const src = join(work, "package/flags/4x3");
    const out = join(root, "public/flags");
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    const have = new Set(readdirSync(src));
    const written = [];
    for (const code of list) {
      const file = `${code.toLowerCase()}.svg`;
      if (NO_FLAG.includes(code) || !have.has(file)) continue;
      copyFileSync(join(src, file), join(out, file));
      written.push(code);
    }
    copyFileSync(join(work, "package/LICENSE"), join(out, "LICENSE"));
    return written;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const list = codes();
  const caps = await capitals(list);
  const flagged = flags(list);
  const file = join(root, "src/shared/countries-capitals.json");
  const old = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  const same = old && JSON.stringify(old.capitals) === JSON.stringify(caps) && JSON.stringify(old.flags) === JSON.stringify(flagged);
  const today = new Date().toISOString().slice(0, 10);
  const snapshot = {
    updated: same ? old.updated : today,
    source: "Wikidata P36 (CC0); flags: flag-icons " + FLAG_ICONS + " (MIT)",
    flags: flagged,
    capitals: caps,
  };
  writeFileSync(file, JSON.stringify(snapshot, null, 0).replace(/\],"/g, '],\n"') + "\n");
  console.log(`capitals: ${Object.keys(caps).length} of ${list.length}; flags: ${flagged.length}; missing flags: ${list.filter((c) => !flagged.includes(c)).join(" ")}`);
}
