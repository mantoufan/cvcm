// Snapshots the data behind /{locale}/breeds/ (dog and cat breed pages). Run by hand, then commit. Pages never call
// these sources.
//
//   node scripts/fetch-breeds.mjs --select   rank candidates and (re)write scripts/breeds-selection.json
//   node scripts/fetch-breeds.mjs            facts + names for the selected breeds
//   node scripts/fetch-breeds.mjs --images   Commons pictures for the selected breeds (then look at every one)
//
// Sources
//   Wikidata (CC0): breed items (P31 Q39367 dog breed / Q43577 cat breed), labels, country of origin (P495 → ISO 3166
//     alpha-2 via P297, names come from Intl), FCI number (P528 with catalog P972 = Q38603), height P2048, mass P2067,
//     life expectancy P2250, picture P18. Values are copied, never estimated; a missing one is null ("—" on the page).
//   FCI nomenclature (fci.be): the group of each FCI number and the links to its breed page and standard.
//   English Wikipedia (CC BY-SA 4.0): the article (linked as a source) and the registries its infobox links a breed
//     standard for (kc_name/kc_std, fcistd, cfastd, fifestd, ticastd …); each standard URL is opened, dead ones dropped.
//   Wikipedia pageviews (Wikimedia REST API): only to choose the breeds (--select), see RULE below.
//
// Names, per locale, in the locale's own script and never invented:
//   en: the English Wikipedia title (disambiguation in brackets dropped)
//   zh-CN: Wikidata zh-cn, zh-hans label, else the zh-cn variant title zh.wikipedia shows for the breed's article
//   zh-TW: Wikidata zh-tw, zh-hant label, else zh.wikipedia's zh-tw variant title (never the bare "zh" label)
//   ja / ko / vi / id / es: the Wikidata label, else Wikidata's "mul" label (Latin-script locales only), else that
//     language's Wikipedia title. Anything else is a gap: --select leaves the breed out, a normal run fails.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const today = new Date().toISOString().slice(0, 10);
const UA = "cv.cm breed pages snapshot (https://cv.cm/; m@cv.cm; scripts/fetch-breeds.mjs)";
const CACHE = process.env.BREEDS_CACHE ?? join(homedir(), ".cache/cvcm-breeds");
mkdirSync(join(CACHE, "http"), { recursive: true });
const SELECTION = join(root, "scripts/breeds-selection.json");

/**
 * RULE (how the breeds were chosen, --select): every Wikidata dog breed / cat breed item with an English Wikipedia
 * article, ranked by its articles' user pageviews from 2025-11 to 2026-10 summed over the en, zh, ja, ko, vi, id and es
 * Wikipedias (the site's languages). From the top, a breed is kept when it has a name in all eight locales (see above)
 * and a country of origin with an ISO code; wild or feral canids and extinct breeds are left out (EXCLUDE). The first
 * 120 dogs and 45 cats are written to scripts/breeds-selection.json; slugs never change once written.
 */
const TARGET = { dog: 120, cat: 45 };
const VIEW_WIKIS = ["en", "zh", "ja", "ko", "vi", "id", "es"];
const VIEW_RANGE = ["2025110100", "2026103100"];
const EXCLUDE = {
  Q38584: "dingo: a wild canid, not a kept breed",
  Q38884: "New Guinea singing dog: wild",
  Q1135818: "Nureongi: a landrace kept mainly as livestock, no kennel-club standard",
};

// ---------- http ----------
async function get(url, { json = true, accept, cache = true, ua = UA } = {}) {
  const key = createHash("sha1").update(url).digest("hex");
  const file = join(CACHE, "http", key);
  if (cache && existsSync(file)) {
    const text = readFileSync(file, "utf8");
    return json ? JSON.parse(text) : text;
  }
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": ua, ...(accept ? { Accept: accept } : {}) }, signal: AbortSignal.timeout(120_000) });
      if (res.status === 404) {
        if (cache && json) writeFileSync(file, "null");
        return null;
      }
      if (res.status === 429) throw new Error(`429 ${url}`);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      const text = await res.text();
      if (cache) writeFileSync(file, text);
      return json ? JSON.parse(text) : text;
    } catch (err) {
      if (attempt >= 8) throw err;
      await new Promise((r) => setTimeout(r, (String(err.message).startsWith("429") ? 15_000 : 3000) * attempt));
    }
  }
}

async function pool(items, n, work) {
  const queue = items.map((item, i) => [item, i]);
  const out = new Array(items.length);
  await Promise.all(Array.from({ length: n }, async () => {
    for (let next = queue.shift(); next; next = queue.shift()) out[next[1]] = await work(next[0]);
  }));
  return out;
}

const chunks = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

async function sparql(query) {
  return get(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`, { accept: "application/sparql-results+json" });
}

/** Wikidata entities (labels, claims, sitelinks) by id, 50 per request. */
async function entities(ids, props = "labels|claims|sitelinks") {
  const out = {};
  for (const batch of chunks([...new Set(ids)], 50)) {
    const res = await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=${encodeURIComponent(props)}&ids=${batch.join("|")}`);
    Object.assign(out, res.entities);
  }
  return out;
}

// ---------- names ----------
const LOCALES = ["en", "zh-CN", "zh-TW", "ja", "ko", "vi", "id", "es"];
const WIKI_OF = { ja: "jawiki", ko: "kowiki", vi: "viwiki", id: "idwiki", es: "eswiki" };
const LATIN = new Set(["vi", "id", "es"]);
/** Simplified-only and Traditional-only characters that turn up in breed names; a name in the wrong script fails. */
const TRAD_ONLY = /[國亞灣鬥獵種貓爾蘭羅馬維納薩奧瑪麗凱勞達諾龍雙獅頭鬍嘯細長鏽黃]/u;
const SIMP_ONLY = /[国亚湾斗猎种猫尔兰罗马维纳萨奥玛丽凯劳达诺龙双狮头啸细长锈黄]/u;
const stripTitle = (title) => title.replace(/\s*[(（][^)）]*[)）]\s*$/u, "").trim();
const cap = (s, lang) => (lang === "en" || LATIN.has(lang) ? s.charAt(0).toLocaleUpperCase(lang) + s.slice(1) : s);

/** zh.wikipedia's zh-cn and zh-tw variant titles for a list of zhwiki titles. */
async function zhVariants(titles) {
  const out = {};
  for (const batch of chunks([...new Set(titles)], 40)) {
    const res = await get(`https://zh.wikipedia.org/w/api.php?action=query&format=json&prop=info&inprop=varianttitles&redirects=1&titles=${encodeURIComponent(batch.join("|"))}`);
    const back = {};
    for (const r of res.query.redirects ?? []) back[r.to] = r.from;
    for (const n of res.query.normalized ?? []) back[n.to] = n.from;
    for (const page of Object.values(res.query.pages)) {
      if (!page.varianttitles) continue;
      let from = page.title;
      const seen = new Set();
      while (back[from] && !seen.has(from)) { seen.add(from); out[from] = page.varianttitles; from = back[from]; }
      out[from] = page.varianttitles;
      out[page.title] = page.varianttitles;
    }
  }
  return out;
}

/**
 * Names fixed by hand after a check, by Wikidata item and locale, with the check. Each overrides whatever the sources
 * above give (a typo or an odd label), so a refetch keeps it.
 */
const NAME_OVERRIDES = {
  // Affenpinscher: Wikidata's zh-cn/zh-hans label 猴绠 is a typo; zh.wikipedia's article title is 猴面犬 in both variants (checked 2026-11-19).
  Q7254: { "zh-CN": "猴面犬", "zh-TW": "猴面犬" },
};

/** Whether a name is written in the locale's own script (zh-CN Simplified, zh-TW Traditional, ja kana/kanji, ko Hangul). */
/** Strings that zh.wikipedia's converter changes for a variant: a label in the other script ("腊肠犬" filed as zh-tw). */
const ZH_CHANGED = { "zh-CN": new Set(), "zh-TW": new Set() };

/** Run zh.wikipedia's variant converter over Chinese labels and remember which ones it changes. */
async function zhScriptCheck(entities) {
  for (const [locale, variant, keys] of [["zh-CN", "zh-cn", ["zh-cn", "zh-hans"]], ["zh-TW", "zh-tw", ["zh-tw", "zh-hant"]]]) {
    const labels = [...new Set(entities.flatMap((e) => keys.map((k) => e?.labels?.[k]?.value?.trim()).filter(Boolean)))];
    for (const batch of chunks(labels, 60)) {
      const body = new URLSearchParams({ action: "parse", format: "json", formatversion: "2", contentmodel: "wikitext", variant, prop: "text", disablelimitreport: "1", text: batch.join("\n\n") });
      const res = await fetch("https://zh.wikipedia.org/w/api.php", { method: "POST", body, headers: { "User-Agent": UA } }).then((r) => r.json());
      const out = res.parse.text.replace(/<[^>]+>/g, "\n").split(/\n+/).map((x) => x.trim()).filter(Boolean);
      if (out.length !== batch.length) throw new Error(`zh conversion returned ${out.length} of ${batch.length}`);
      batch.forEach((label, i) => { if (out[i] !== label) ZH_CHANGED[locale].add(label); });
    }
  }
}

function scriptOk(locale, name) {
  if (locale === "zh-CN") return /[一-鿿]/u.test(name) && !TRAD_ONLY.test(name) && !ZH_CHANGED["zh-CN"].has(name);
  if (locale === "zh-TW") return /[一-鿿]/u.test(name) && !SIMP_ONLY.test(name) && !ZH_CHANGED["zh-TW"].has(name);
  if (locale === "ja") return /[぀-ヿ一-鿿]/u.test(name);
  if (locale === "ko") return /[가-힯]/u.test(name);
  return !/[一-鿿가-힯぀-ヿ]/u.test(name);
}

/**
 * Names in the eight locales for one entity, with where each came from; `gaps` lists locales with none. Sources are
 * tried in order and one in the wrong script is skipped (a Latin "German shepherd" filed as a zh-hant label).
 * Indonesian and Vietnamese write most breed names in English ("Golden Retriever"), so with no label, no "mul" label and
 * no article in that language, they take the English Wikipedia name (logged as `en`).
 */
function namesOf(entity, zh) {
  const labels = Object.fromEntries(Object.entries(entity.labels ?? {}).map(([k, v]) => [k, v.value.trim()]));
  const links = entity.sitelinks ?? {};
  const names = {};
  const from = {};
  const gaps = [];
  const en = links.enwiki ? stripTitle(links.enwiki.title) : null;
  const pick = (locale, options) => {
    const hit = options.find(([value]) => value && scriptOk(locale, value));
    if (hit) { names[locale] = hit[0]; from[locale] = hit[1]; } else gaps.push(locale);
  };
  pick("en", [[en, "enwiki"]]);
  for (const [locale, keys, variant] of [["zh-CN", ["zh-cn", "zh-hans"], "zh-cn"], ["zh-TW", ["zh-tw", "zh-hant"], "zh-tw"]]) {
    const v = links.zhwiki ? zh[links.zhwiki.title]?.[variant] : null;
    pick(locale, [...keys.map((k) => [labels[k], `wikidata:${k}`]), [v ? stripTitle(v) : null, `zhwiki:${variant}`]]);
  }
  for (const locale of ["ja", "ko", "vi", "id", "es"]) {
    const wiki = links[WIKI_OF[locale]] ? stripTitle(links[WIKI_OF[locale]].title) : null;
    pick(locale, [
      [labels[locale] ? cap(locale === "ja" || locale === "ko" ? stripTitle(labels[locale]) : labels[locale], locale) : null, `wikidata:${locale}`],
      [LATIN.has(locale) && labels.mul ? cap(labels.mul, locale) : null, "wikidata:mul"],
      [wiki ? cap(wiki, locale) : null, WIKI_OF[locale]],
      [locale === "id" || locale === "vi" ? en : null, "en"],
    ]);
  }
  for (const [locale, name] of Object.entries(NAME_OVERRIDES[entity.id] ?? {})) {
    names[locale] = name;
    from[locale] = "override";
    const i = gaps.indexOf(locale);
    if (i >= 0) gaps.splice(i, 1);
  }
  return { names, from, gaps };
}

// ---------- claims ----------
/**
 * Countries of origin Wikidata records as a historic state or a region inside one country: shown as today's country.
 * Continents and regions spanning several countries (Europe, Kurdistan, Epirus, Ancient Rome) are left out.
 */
const ORIGIN_MAP = {
  Q1081620: "TH", Q186096: "RU", Q207521: "ET", Q23148: "GB", Q21: "GB", Q22: "GB", Q25: "GB", Q99: "US", Q797: "US",
  Q52636: "ES", Q8828: "ES", Q52631: "ES", Q17252: "CN", Q5428: "RU", Q6605: "RU", Q22502: "TW", Q43287: "DE",
  Q217169: "ZW", Q29520: "CN", Q327: "FR", Q22890: "IE", Q3348614: "BD",
};
const isoOf = (countries, id) => countries[id] ?? ORIGIN_MAP[id] ?? null;

/** ISO 3166-1 alpha-2 (P297) of Wikidata country items, by item id (SPARQL: country items are too big to fetch whole). */
async function isoCodes(ids) {
  const out = {};
  for (const batch of chunks([...new Set(ids)], 200)) {
    const res = await sparql(`SELECT ?c ?iso WHERE { VALUES ?c { ${batch.map((id) => `wd:${id}`).join(" ")} } ?c wdt:P297 ?iso }`);
    for (const b of res.results.bindings) out[b.c.value.split("/").pop()] = b.iso.value;
  }
  return out;
}

const REGION_EN = (() => {
  const dn = new Intl.DisplayNames(["en"], { type: "region" });
  const map = {};
  for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
    const code = String.fromCharCode(a, b);
    const name = dn.of(code);
    if (name && name !== code) map[name.toLowerCase()] = code;
  }
  return Object.assign(map, {
    "great britain": "GB", "britain": "GB", "england": "GB", "scotland": "GB", "wales": "GB", "uk": "GB", "united kingdom": "GB",
    "usa": "US", "united states": "US", "united states of america": "US", "us": "US", "china": "CN", "russia": "RU",
    "tibet": "CN", "czech republic": "CZ", "turkey": "TR", "türkiye": "TR", "iran": "IR", "persia": "IR", "south korea": "KR", "korea": "KR",
  });
})();

/** Countries named in the English Wikipedia infobox's `country` field ({{flag|France}}, [[Germany]], {{USA}}). */
function infoboxCountries(value) {
  if (!value) return [];
  const text = value
    .replace(/<ref[\s\S]*?(<\/ref>|\/>)/g, " ")
    .replace(/\{\{\s*(?:unbulleted list|ubl|plainlist|hlist)\s*\|/gi, "{{x|")
    .replace(/\{\{x\|([\s\S]*?)\}\}/g, (m, inner) => inner.replace(/\|/g, ","))
    .replace(/\{\{\s*(?:flag|flagicon|flagcountry|flagu)\s*\|([^|}]+)[^}]*\}\}/gi, " $1 ")
    .replace(/\{\{\s*([A-Z]{3})\s*\}\}/g, (m, c) => ({ USA: " United States ", GBR: " United Kingdom ", DEU: " Germany ", FRA: " France " })[c] ?? " ")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, " $1 ")
    .replace(/\{\{[^}]*\}\}/g, " ")
    .replace(/<[^>]+>/g, ",");
  const out = [];
  const clean = (part) => part.replace(/[()]/g, " ").replace(/\bmodern-day\b|\blater development\b/gi, " ").replace(/\s+/g, " ").trim().toLowerCase();
  for (const part of text.split(/,|;|\//)) {
    // A whole known name first ("Antigua and Barbuda", "Trinidad and Tobago"); only then "X and Y" / "X or Y" as two names.
    const whole = REGION_EN[clean(part)];
    const codes = whole ? [whole] : part.split(/\band\b|\bor\b/).map((p) => REGION_EN[clean(p)]);
    for (const code of codes) if (code && !out.includes(code)) out.push(code);
  }
  return out;
}

const UNIT = {
  Q174728: ["cm", 1], Q11573: ["cm", 100], Q218593: ["cm", 2.54], Q174789: ["cm", 0.1],
  Q11570: ["kg", 1], Q41803: ["kg", 0.001], Q100995: ["kg", 0.45359237],
  Q577: ["y", 1], Q1092296: ["y", 1],
};
const SANE = { dog: { cm: [10, 110], kg: [0.5, 120] }, cat: { cm: [15, 50], kg: [1, 15] }, y: [4, 25] };
const claimValues = (entity, p) => (entity.claims?.[p] ?? []).filter((c) => c.rank !== "deprecated" && c.mainsnak.snaktype === "value");
const itemIds = (entity, p) => claimValues(entity, p).map((c) => c.mainsnak.datavalue.value.id);

/** min–max of a quantity property in one unit, or null; odd units and values outside SANE are dropped and logged. */
function range(entity, p, want, kind, log) {
  const values = [];
  for (const c of claimValues(entity, p)) {
    const v = c.mainsnak.datavalue.value;
    const unit = UNIT[v.unit.split("/").pop()];
    if (!unit || unit[0] !== want) { log.push(`${p} unit ${v.unit}`); continue; }
    const n = Number(v.amount) * unit[1];
    const lo = Number(v.lowerBound ?? v.amount) * unit[1];
    const hi = Number(v.upperBound ?? v.amount) * unit[1];
    const [min, max] = want === "y" ? SANE.y : SANE[kind][want];
    if (!(n >= min && n <= max)) { log.push(`${p} ${n}${want} out of range`); continue; }
    values.push(n);
    if (lo !== n && lo >= min) values.push(lo);
    if (hi !== n && hi <= max) values.push(hi);
  }
  if (!values.length) return null;
  const round = (x) => (want === "kg" && x < 10 ? Math.round(x * 10) / 10 : Math.round(x));
  return { min: round(Math.min(...values)), max: round(Math.max(...values)) };
}

const fciNumber = (entity) => {
  const c = claimValues(entity, "P528").find((c) => (c.qualifiers?.P972 ?? []).some((q) => q.datavalue?.value?.id === "Q38603"));
  return c ? Number(c.mainsnak.datavalue.value) : null;
};

/** URL slug from the English name; a lowercase " cat" / " dog" that Wikipedia adds to tell the breed apart ("Siamese cat", "Newfoundland dog") is left out, a capitalised one belongs to the name ("Norwegian Forest Cat"). */
const slugOf = (en) => en.replace(/ (cat|dog)$/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’.]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const enwikiText = (e) => get(`https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(e.sitelinks.enwiki.title.replace(/ /g, "_"))}&action=raw`, { json: false });

// ---------- select ----------
async function select() {
  const kinds = { dog: "Q39367", cat: "Q43577" };
  const candidates = [];
  for (const [kind, q] of Object.entries(kinds)) {
    const res = await sparql(`SELECT DISTINCT ?item WHERE {
      ?item wdt:P31 wd:${q} .
      ?en schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
      FILTER NOT EXISTS { ?item wdt:P576 ?gone }
    }`);
    for (const b of res.results.bindings) candidates.push({ kind, qid: b.item.value.split("/").pop() });
  }
  console.log(`candidates: ${candidates.length}`);
  const ents = await entities(candidates.map((c) => c.qid), "labels|claims|sitelinks");
  const zhTitles = candidates.map((c) => ents[c.qid]?.sitelinks?.zhwiki?.title).filter(Boolean);
  const zh = await zhVariants(zhTitles);
  const countryIds = candidates.flatMap((c) => itemIds(ents[c.qid], "P495"));
  const countries = await isoCodes(countryIds);
  let done = 0;
  const views = await pool(candidates, 3, async (c) => {
    const links = ents[c.qid].sitelinks;
    let sum = 0;
    for (const wiki of VIEW_WIKIS) {
      const link = links[`${wiki}wiki`];
      if (!link) continue;
      const title = encodeURIComponent(link.title.replace(/ /g, "_"));
      const res = await get(`https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${wiki}.wikipedia/all-access/user/${title}/monthly/${VIEW_RANGE[0]}/${VIEW_RANGE[1]}`);
      for (const item of res?.items ?? []) sum += item.views;
    }
    if (++done % 50 === 0) console.log(`  pageviews ${done}/${candidates.length}`);
    return sum;
  });
  candidates.forEach((c, i) => (c.views = views[i]));
  const out = [];
  const report = [];
  // Slugs never change once written: an earlier selection's slug wins, before any duplicate check.
  const old = existsSync(SELECTION) ? JSON.parse(readFileSync(SELECTION, "utf8")) : null;
  const oldSlug = new Map((old?.breeds ?? []).map((o) => [o.qid, o.slug]));
  for (const kind of ["dog", "cat"]) {
    const ranked = candidates.filter((c) => c.kind === kind).sort((a, b) => b.views - a.views);
    const kept = [];
    const slugs = new Set();
    for (const c of ranked) {
      if (kept.length >= TARGET[kind]) break;
      const e = ents[c.qid];
      const { names, gaps } = namesOf(e, zh);
      let iso = itemIds(e, "P495").map((id) => isoOf(countries, id)).filter(Boolean);
      if (!iso.length && !EXCLUDE[c.qid]) iso = infoboxCountries(infobox((await enwikiText(e)) ?? "").country);
      const why = EXCLUDE[c.qid] ?? (gaps.length ? `no name: ${gaps.join(", ")}` : !iso.length ? "no country of origin with an ISO code" : null);
      const slug = oldSlug.get(c.qid) ?? (names.en ? slugOf(names.en) : null);
      if (!why && slugs.has(slug)) { report.push(`${kind} ${c.qid} ${names.en}: duplicate slug`); continue; }
      if (why) { report.push(`${kind} #${ranked.indexOf(c) + 1} ${c.qid} ${names.en ?? e.labels?.en?.value}: ${why} (${c.views} views)`); continue; }
      slugs.add(slug);
      kept.push({ kind, qid: c.qid, slug, views: c.views });
    }
    if (kept.length < TARGET[kind]) console.warn(`only ${kept.length} ${kind} breeds pass`);
    out.push(...kept);
  }
  for (const kind of ["dog", "cat"]) {
    const list = out.filter((b) => b.kind === kind).map((b) => b.slug);
    const dup = list.find((slug, i) => list.indexOf(slug) !== i);
    if (dup) throw new Error(`duplicate ${kind} slug ${dup} (nothing written)`);
  }
  writeFileSync(SELECTION, `${JSON.stringify({ rule: "see RULE in scripts/fetch-breeds.mjs", views: VIEW_RANGE, chosen: today, breeds: out.map(({ kind, qid, slug }) => ({ kind, qid, slug })) }, null, 1)}\n`);
  writeFileSync(join(CACHE, "selection-report.txt"), `${out.map((b) => `${b.kind} ${b.qid} ${b.slug} ${b.views}`).join("\n")}\n\nleft out:\n${report.join("\n")}\n`);
  console.log(`selected ${out.length}; report in ${join(CACHE, "selection-report.txt")}`);
}

// ---------- FCI ----------
const FCI_GROUPS = [
  "1-Sheepdogs-and-Cattledogs-except-Swiss-Cattledogs", "2-Pinscher-and-Schnauzer-Molossoid-and-Swiss-Mountain-and-Cattledogs",
  "3-Terriers", "4-Dachshunds", "5-Spitz-and-primitive-types", "6-Scent-hounds-and-related-breeds", "7-Pointing-Dogs",
  "8-Retrievers-Flushing-Dogs-Water-Dogs", "9-Companion-and-Toy-Dogs", "10-Sighthounds",
];
async function fciTable() {
  const table = {};
  for (const [i, page] of FCI_GROUPS.entries()) {
    const html = await get(`https://www.fci.be/en/nomenclature/${page}.html`, { json: false, ua: "Mozilla/5.0 (compatible; cv.cm breed snapshot)" });
    const re = /href="\/en\/nomenclature\/([A-Za-z0-9-]+)-(\d+)\.html"[^>]*>[^<]*<\/a>\s*<div class="standard">\s*<a[^>]*href="\.\.\/\.\.\/Nomenclature\/Standards\/([^"]+\.pdf)"/g;
    for (const m of html.matchAll(re)) table[Number(m[2])] = { group: i + 1, page: `https://www.fci.be/en/nomenclature/${m[1]}-${m[2]}.html`, standard: `https://www.fci.be/Nomenclature/Standards/${m[3]}` };
    // Breeds listed without a standard link still get their group and page.
    for (const m of html.matchAll(/href="\/en\/nomenclature\/([A-Za-z0-9-]+)-(\d+)\.html"/g)) table[Number(m[2])] ??= { group: i + 1, page: `https://www.fci.be/en/nomenclature/${m[1]}-${m[2]}.html`, standard: null };
  }
  if (Object.keys(table).length < 300) throw new Error(`FCI: only ${Object.keys(table).length} breeds parsed`);
  return table;
}

// ---------- registries (English Wikipedia infobox) ----------
const DOG_CLUBS = [
  [/American Kennel Club/i, "AKC"], [/^(The )?Kennel Club( \(UK\))?$|The Kennel Club/i, "KC"], [/United Kennel Club/i, "UKC"],
  [/Canadian Kennel Club/i, "CKC"], [/Australian National Kennel Council|ANKC/i, "ANKC"], [/New Zealand Kennel Club|Dogs New Zealand/i, "NZKC"],
  [/Japan Kennel Club/i, "JKC"], [/Kennel Union of Southern Africa/i, "KUSA"],
];
const CAT_KEYS = { cfastd: "CFA", fifestd: "FIFe", ticastd: "TICA", gccfstd: "GCCF", wcfstd: "WCF", acfastd: "ACFA", acfstd: "ACF", ccastd: "CCA", nzcfstd: "NZCF", cffstd: "CFF", loofstd: "LOOF", saccstd: "SACC", aacestd: "AACE" };

function infobox(wikitext) {
  const start = wikitext.search(/\{\{\s*Infobox[ _]?(dog|cat)[ _]?breed/i);
  if (start < 0) return {};
  let depth = 0;
  let end = start;
  for (let i = start; i < wikitext.length - 1; i++) {
    if (wikitext.startsWith("{{", i)) { depth++; i++; } else if (wikitext.startsWith("}}", i)) { depth--; i++; if (depth === 0) { end = i + 1; break; } }
  }
  const body = wikitext.slice(start, end);
  const params = {};
  // Top-level "| key = value" only (nested templates and links keep their pipes).
  let d = 0, cur = "";
  const parts = [];
  for (let i = 2; i < body.length - 2; i++) {
    const two = body.slice(i, i + 2);
    if (two === "{{" || two === "[[") { d++; cur += two; i++; continue; }
    if (two === "}}" || two === "]]") { d--; cur += two; i++; continue; }
    if (body[i] === "|" && d === 0) { parts.push(cur); cur = ""; continue; }
    cur += body[i];
  }
  parts.push(cur);
  for (const p of parts.slice(1)) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim();
  }
  return params;
}

const firstUrl = (v) => /https?:\/\/[^\s|\]}<]+/.exec(v ?? "")?.[0] ?? null;

function registriesOf(kind, params) {
  const out = [];
  if (kind === "dog") {
    for (const [k, v] of Object.entries(params)) {
      const m = /^kc_name(\d*)$/.exec(k);
      if (!m || !v) continue;
      const text = v.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1").replace(/<[^>]+>/g, "").trim();
      const club = DOG_CLUBS.find(([re]) => re.test(text))?.[1];
      const url = firstUrl(params[`kc_std${m[1]}`]);
      if (club && url && !out.some((r) => r.id === club)) out.push({ id: club, url });
    }
  } else {
    for (const [key, id] of Object.entries(CAT_KEYS)) {
      const url = firstUrl(params[key]);
      if (url) out.push({ id, url });
    }
  }
  return out;
}

/** Whether a URL answers (redirects followed); results cached for the run in the http cache. */
async function alive(url) {
  const key = join(CACHE, "http", `alive-${createHash("sha1").update(url).digest("hex")}`);
  if (existsSync(key)) return readFileSync(key, "utf8") === "1";
  let ok = false;
  for (const method of ["HEAD", "GET"]) {
    try {
      const res = await fetch(url, { method, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36", Range: "bytes=0-2047" }, signal: AbortSignal.timeout(30_000) });
      if (res.ok || res.status === 206) { ok = true; await res.body?.cancel(); break; }
      await res.body?.cancel();
    } catch { /* try GET, then give up */ }
  }
  writeFileSync(key, ok ? "1" : "0");
  return ok;
}

// ---------- facts ----------
async function facts() {
  const sel = JSON.parse(readFileSync(SELECTION, "utf8")).breeds;
  const ents = await entities(sel.map((b) => b.qid));
  const zh = await zhVariants(sel.map((b) => ents[b.qid].sitelinks?.zhwiki?.title).filter(Boolean));
  await zhScriptCheck(sel.map((b) => ents[b.qid]));
  const countries = await isoCodes(sel.flatMap((b) => itemIds(ents[b.qid], "P495")));
  const fci = await fciTable();
  const names = Object.fromEntries(LOCALES.map((l) => [l, {}]));
  const data = {};
  const problems = [];
  const notes = [];
  await pool(sel, 6, async (b) => {
    const id = `${b.kind}s/${b.slug}`;
    const e = ents[b.qid];
    const n = namesOf(e, zh);
    if (n.gaps.length) problems.push(`${id} (${b.qid}): no name for ${n.gaps.join(", ")}`);
    for (const l of LOCALES) names[l][id] = n.names[l] ?? "";
    for (const [l, src] of Object.entries(n.from)) if (!src.startsWith("wikidata:") && l !== "en") notes.push(`${id} ${l} from ${src}`);
    const enTitle = e.sitelinks.enwiki.title;
    const wikitext = await enwikiText(e);
    let origin = [...new Set(itemIds(e, "P495").map((cid) => isoOf(countries, cid)).filter(Boolean))];
    if (!origin.length) { origin = infoboxCountries(infobox(wikitext ?? "").country); if (origin.length) notes.push(`${id}: origin from the enwiki infobox`); }
    if (!origin.length) problems.push(`${id}: no country of origin`);
    const log = [];
    const number = b.kind === "dog" ? fciNumber(e) : null;
    const f = number ? fci[number] : null;
    if (number && !f) log.push(`FCI ${number} not on the FCI group pages (provisional or removed)`);
    const registries = [];
    for (const r of registriesOf(b.kind, infobox(wikitext ?? ""))) {
      if (await alive(r.url)) registries.push(r);
      else log.push(`registry ${r.id} standard ${r.url} does not answer: dropped`);
    }
    if (f && !registries.some((r) => r.id === "FCI")) registries.unshift({ id: "FCI", url: f.standard ?? f.page });
    data[id] = {
      qid: b.qid,
      origin,
      fci: f ? { number, group: f.group, page: f.page } : null,
      height: range(e, "P2048", "cm", b.kind, log),
      weight: range(e, "P2067", "kg", b.kind, log),
      life: range(e, "P2250", "y", b.kind, log),
      registries,
      wikipedia: `https://en.wikipedia.org/wiki/${encodeURIComponent(enTitle.replace(/ /g, "_")).replace(/%2C/g, ",").replace(/%28/g, "(").replace(/%29/g, ")")}`,
    };
    if (log.length) notes.push(`${id}: ${log.join("; ")}`);
  });
  if (problems.length) throw new Error(`gaps (nothing written):\n  ${problems.join("\n  ")}`);
  const order = sel.map((b) => `${b.kind}s/${b.slug}`);
  const sorted = Object.fromEntries(order.map((id) => [id, data[id]]));
  const dataFile = join(root, "src/shared/breeds-data.json");
  const slugsFile = join(root, "src/shared/breeds-slugs.ts");
  let snapshot = today;
  try {
    const old = readFileSync(dataFile, "utf8");
    const oldNames = LOCALES.map((l) => readFileSync(join(root, `src/locales/breeds/names/${l}.json`), "utf8")).join("");
    const oldSnap = /BREEDS_SNAPSHOT = "(\d{4}-\d{2}-\d{2})"/.exec(readFileSync(slugsFile, "utf8"))?.[1];
    const newNames = LOCALES.map((l) => `${JSON.stringify(Object.fromEntries(order.map((id) => [id, names[l][id]])), null, 1)}\n`).join("");
    if (oldSnap && old === `${JSON.stringify(sorted, null, 1)}\n` && oldNames === newNames) snapshot = oldSnap;
  } catch { /* first run */ }
  writeFileSync(dataFile, `${JSON.stringify(sorted, null, 1)}\n`);
  mkdirSync(join(root, "src/locales/breeds/names"), { recursive: true });
  for (const l of LOCALES) writeFileSync(join(root, `src/locales/breeds/names/${l}.json`), `${JSON.stringify(Object.fromEntries(order.map((id) => [id, names[l][id]])), null, 1)}\n`);
  const list = (kind) => sel.filter((b) => b.kind === kind).map((b) => `  "${b.slug}",`).join("\n");
  writeFileSync(slugsFile, `// Generated by \`node scripts/fetch-breeds.mjs\`; do not edit. Breed slugs in the selection's order (scripts/breeds-selection.json).
/** The day the Wikidata / FCI / Wikipedia snapshot last changed (sitemap lastmod and dateModified, with the copy dates). */
export const BREEDS_SNAPSHOT = "${snapshot}";

export const DOG_SLUGS = [
${list("dog")}
] as const;

export const CAT_SLUGS = [
${list("cat")}
] as const;
`);
  writeFileSync(join(CACHE, "facts-notes.txt"), `${notes.sort().join("\n")}\n`);
  console.log(`wrote ${order.length} breeds (snapshot ${snapshot}); notes in ${join(CACHE, "facts-notes.txt")}`);
}

// ---------- images ----------
const FREE = /^(public domain|pd\b|pd-|cc0|cc by(-sa)? \d\.\d)/i;
const stripHtml = (s) => (s ?? "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, " ").trim();

async function images() {
  const { default: sharp } = await import("sharp");
  const sel = JSON.parse(readFileSync(SELECTION, "utf8")).breeds;
  const ents = await entities(sel.map((b) => b.qid), "claims|sitelinks");
  // Per-breed choices after looking at each picture: a Commons file name to use instead, or null for no picture.
  const overridesFile = join(root, "scripts/breeds-image-overrides.json");
  const overrides = existsSync(overridesFile) ? JSON.parse(readFileSync(overridesFile, "utf8")) : {};
  const outDir = join(root, "public/covers/breeds");
  const reviewDir = join(CACHE, "review");
  mkdirSync(outDir, { recursive: true });
  mkdirSync(reviewDir, { recursive: true });
  const table = {};
  const log = [];
  await pool(sel, 4, async (b) => {
    const id = `${b.kind}s/${b.slug}`;
    const e = ents[b.qid];
    const files = [];
    if (Object.hasOwn(overrides, id)) { if (overrides[id]) files.push(overrides[id]); } else {
      files.push(...claimValues(e, "P18").map((c) => c.mainsnak.datavalue.value));
      const wt = await get(`https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(e.sitelinks.enwiki.title.replace(/ /g, "_"))}&action=raw`, { json: false });
      const img = infobox(wt ?? "").image;
      if (img) files.push(img.replace(/^(File|Image):/i, "").trim());
    }
    for (const file of [...new Set(files)]) {
      const res = await get(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=640&titles=${encodeURIComponent(`File:${file}`)}`);
      const page = Object.values(res.query?.pages ?? {})[0];
      const info = page?.imageinfo?.[0];
      if (!info) { log.push(`${id}: ${file} not on Commons`); continue; }
      const meta = info.extmetadata ?? {};
      const license = stripHtml(meta.LicenseShortName?.value);
      if (!FREE.test(license)) { log.push(`${id}: ${file} licence "${license}" not allowed`); continue; }
      if (!/^image\/(jpeg|png|webp|tiff)$/.test(info.mime)) { log.push(`${id}: ${file} ${info.mime} skipped`); continue; }
      const pd = /^(public domain|pd)/i.test(license);
      const cc0 = /^cc0/i.test(license);
      let author = stripHtml(meta.Artist?.value) || null;
      if (author && /^(unknown|anonymous|unknown author)$/i.test(author)) author = null;
      const licenseUrl = pd ? "https://creativecommons.org/publicdomain/mark/1.0/" : cc0 ? "https://creativecommons.org/publicdomain/zero/1.0/" : stripHtml(meta.LicenseUrl?.value).replace(/^http:/, "https:");
      if (!licenseUrl) { log.push(`${id}: ${file} no licence URL`); continue; }
      const thumb = await fetch(info.thumburl, { headers: { "User-Agent": UA } }).catch((err) => ({ ok: false, status: String(err) }));
      if (!thumb.ok) { log.push(`${id}: ${file} thumbnail download failed (${thumb.status}): skipped`); continue; }
      const bytes = Buffer.from(await thumb.arrayBuffer());
      const name = `${b.kind}-${b.slug}.webp`;
      const out = await sharp(bytes).rotate().resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true }).webp({ quality: 72 }).toBuffer({ resolveWithObject: true });
      writeFileSync(join(outDir, name), out.data);
      writeFileSync(join(reviewDir, name), out.data);
      table[id] = {
        src: `breeds/${name}`,
        width: out.info.width,
        height: out.info.height,
        author,
        creatorType: author ? "Person" : null,
        license: pd ? "Public domain" : cc0 ? "CC0" : license.replace(/^cc/i, "CC"),
        licenseUrl,
        page: info.descriptionurl,
      };
      return;
    }
    log.push(`${id}: no usable picture`);
  });
  const order = sel.map((b) => `${b.kind}s/${b.slug}`).filter((id) => table[id]);
  // Keep hand edits (author names, creatorType) from an earlier run when the file is the same.
  const file = join(root, "src/shared/breeds-images.json");
  const old = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  for (const id of order) if (old[id]?.page === table[id].page) table[id] = { ...table[id], author: old[id].author, creatorType: old[id].creatorType };
  writeFileSync(file, `${JSON.stringify(Object.fromEntries(order.map((id) => [id, table[id]])), null, 1)}\n`);
  writeFileSync(join(CACHE, "images-log.txt"), `${log.sort().join("\n")}\n`);
  console.log(`pictures: ${order.length}/${sel.length}; log in ${join(CACHE, "images-log.txt")}`);
}

if (process.argv.includes("--select")) await select();
else if (process.argv.includes("--images")) await images();
else await facts();
