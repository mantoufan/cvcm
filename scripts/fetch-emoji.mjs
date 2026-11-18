// Snapshots the data behind /{locale}/emoji/ (the emoji meanings channel). Run by hand to refresh
// (`node scripts/fetch-emoji.mjs`; `EMOJI_DIR=<dir>` reuses files downloaded before), then commit. Pages never call
// these sources.
//   Unicode emoji-test.txt (groups, subgroups, CLDR order, status, emoji version), Unicode License v3:
//     https://unicode.org/Public/17.0.0/emoji/emoji-test.txt
//   CLDR annotations (short names and keywords in eight languages), Unicode License v3, npm packages pinned:
//     cldr-annotations-full@49.0.0 (annotations/<locale>/annotations.json)
//     cldr-annotations-derived-full@49.0.0 (annotationsDerived/<locale>/annotations.json: skin-tone and gender forms)
//     zh-CN reads CLDR "zh" (Simplified), zh-TW reads "zh-Hant"; the others read their own locale.
// Which emoji get a page: EMOJI below (the order is not shown on the site).
// Writes src/shared/emoji-data.json (language-neutral rows in CLDR order), src/shared/emoji-slugs.ts (slugs + snapshot
// date; the date moves only when the data does) and src/locales/emoji/names/<locale>.json (names, keywords, variant
// names, and outside English the English names). The usage sentences are written by hand in src/locales/emoji/usage/<locale>.json.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assignSlugs, slugify } from "./emoji-slugs.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const today = new Date().toISOString().slice(0, 10);
const UA = "cv.cm emoji snapshot (https://cv.cm/; scripts/fetch-emoji.mjs)";
const CACHE = process.env.EMOJI_DIR ?? null;
const EMOJI_TEST = "https://unicode.org/Public/17.0.0/emoji/emoji-test.txt";
const CLDR = "49.0.0";
const LOCALES = { en: "en", "zh-CN": "zh", "zh-TW": "zh-Hant", ja: "ja", ko: "ko", vi: "vi", id: "id", es: "es" };

/**
 * The covered emoji. The first 188 are the top of Unicode's emoji frequency ranking (2019, median frequency across
 * sources, gender and skin-tone forms counted together; https://home.unicode.org/emoji/emoji-frequency/) with the
 * country flags and the middle finger left out. That count under-ranks emoji added in Emoji 11.0 (2018) and later, so
 * twelve of those, chosen by hand, close the list. Order here does not matter: pages and the hub use CLDR order.
 */
const RANKED = "😂 ❤️ 😍 🤣 😊 🙏 💕 😭 😘 👍 😅 👏 😁 ♥️ 🔥 💔 💖 💙 😢 🤔 😆 🙄 💪 😉 ☺️ 👌 🤗 💜 😔 😎 😇 🌹 🤦 🎉 ‼️ 💞 ✌️ ✨ 🤷 😱 😌 🌸 🙌 😋 💗 💚 😏 💛 🙂 💓 🤩 😄 😀 🖤 😃 💯 🙈 👇 🎶 😒 🤭 ❣️ ❗ 😜 💋 👀 😪 😑 💥 🙋 😞 😩 😡 🤪 👊 ☀️ 😥 🤤 👉 💃 😳 ✋ 😚 😝 😴 🌟 😬 🙃 🍀 🌷 😻 😓 ⭐ ✅ 🌈 😈 🤘 💦 ✔️ 😣 🏃 💐 ☹️ 🎊 💘 😠 ☝️ 😕 🌺 🎂 🌻 😐 💝 🙊 😹 🗣️ 💫 💀 👑 🎵 🤞 😛 🔴 😤 🌼 😫 ⚽ 🤙 ☕ 🏆 🧡 🎁 ⚡ 🌞 🎈 ❌ ✊ 👋 😲 🌿 🤫 👈 😮 🙆 🍻 🍃 🐶 💁 😰 🤨 😶 🤝 🚶 💰 🍓 💢 🤟 🙁 🚨 💨 🤬 ✈️ 🎀 🍺 🤓 😙 💟 🌱 😖 👶 ▶️ ➡️ ❓ 💎 💸 ⬇️ 😨 🌚 🦋 😷 🕺 ⚠️ 🙅 😟 😵 👎 🤲 🤠".split(" ");
const NEWER = "🥺 🥰 🥳 🥵 🥶 🥲 🫠 🥹 🫶 🫡 🤌 🫣".split(" ");
const EMOJI = [...RANKED, ...NEWER];

/**
 * Release year of each emoji version (UTS #51 and https://unicode.org/emoji/charts/emoji-versions.html). E0.6 and E0.7
 * are the emoji first given emoji status with Unicode 6.0 (2010) and 7.0 (2014); some of those characters are older
 * as plain symbols, so pages say "added as emoji".
 */
const VERSION_YEAR = {
  "0.6": 2010, "0.7": 2014, "1.0": 2015, "2.0": 2015, "3.0": 2016, "4.0": 2016, "5.0": 2017, "11.0": 2018,
  "12.0": 2019, "12.1": 2019, "13.0": 2020, "13.1": 2020, "14.0": 2021, "15.0": 2022, "15.1": 2023, "16.0": 2024,
  "17.0": 2025,
};

async function get(url, file) {
  if (CACHE && existsSync(join(CACHE, file))) return readFileSync(join(CACHE, file), "utf8");
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(300_000) });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      const text = await res.text();
      if (CACHE) {
        mkdirSync(CACHE, { recursive: true });
        writeFileSync(join(CACHE, file), text);
      }
      return text;
    } catch (err) {
      if (attempt >= 4) throw err;
      await new Promise((r) => setTimeout(r, 4000 * attempt));
    }
  }
}

const hex = (s) => [...s].map((c) => c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0"));
const noVs = (s) => s.replace(/\uFE0F/g, "");
const TONES = /[\u{1F3FB}-\u{1F3FF}]/gu;
const GENDER = /\u200D[\u2640\u2642]$/u;


// ---------- emoji-test.txt ----------
const test = await get(EMOJI_TEST, "emoji-test.txt");
const version = /^# Version: (.+)$/m.exec(test)?.[1];
const rows = [];
let group = null;
let subgroup = null;
for (const line of test.split("\n")) {
  if (line.startsWith("# group: ")) group = line.slice(9).trim();
  else if (line.startsWith("# subgroup: ")) subgroup = line.slice(12).trim();
  else if (line.trim() && !line.startsWith("#")) {
    const m = /^([0-9A-F ]+?)\s*;\s*([a-z-]+)\s*# (\S+) E(\d+\.\d+) (.+)$/.exec(line);
    if (!m) throw new Error(`emoji-test: cannot read ${line}`);
    const emoji = m[1].split(" ").map((c) => String.fromCodePoint(parseInt(c, 16))).join("");
    rows.push({ emoji, status: m[2], v: m[4], name: m[5], group, subgroup });
  }
}
const fullyQualified = new Map(rows.filter((r) => r.status === "fully-qualified").map((r) => [noVs(r.emoji), r]));

// ---------- CLDR ----------
const cldr = {};
for (const [locale, code] of Object.entries(LOCALES)) {
  const base = JSON.parse(await get(`https://cdn.jsdelivr.net/npm/cldr-annotations-full@${CLDR}/annotations/${code}/annotations.json`, `annotations-${code}.json`)).annotations.annotations;
  const derived = JSON.parse(await get(`https://cdn.jsdelivr.net/npm/cldr-annotations-derived-full@${CLDR}/annotationsDerived/${code}/annotations.json`, `derived-${code}.json`)).annotationsDerived.annotations;
  cldr[locale] = (emoji) => base[noVs(emoji)] ?? derived[noVs(emoji)] ?? base[emoji] ?? derived[emoji] ?? null;
}

// ---------- the covered emoji ----------
const picked = new Set();
for (const e of EMOJI) {
  const row = fullyQualified.get(noVs(e));
  if (!row) throw new Error(`${e} is not a fully-qualified emoji in emoji-test ${version}`);
  if (row.subgroup === "country-flag" || row.group === "Flags") throw new Error(`${e}: flags are left out`);
  if (picked.has(row.emoji)) throw new Error(`${e} listed twice`);
  picked.add(row.emoji);
}

/** Skin-tone and gender forms of an emoji: fully-qualified sequences that reduce to it without tones, ♀/♂ or VS16. */
const baseOf = (emoji) => noVs(emoji).replace(TONES, "").replace(GENDER, "");
const slugTableFile = "src/shared/emoji-slug-table.json";
let slugTable = existsSync(resolve(root, slugTableFile)) ? JSON.parse(readFileSync(resolve(root, slugTableFile), "utf8")) : {};
const data = [];
const names = Object.fromEntries(Object.keys(LOCALES).map((l) => [l, { names: {}, keywords: {}, variants: {} }]));
for (const row of rows) {
  if (row.status !== "fully-qualified" || !picked.has(row.emoji)) continue;
  const year = VERSION_YEAR[row.v];
  if (!year) throw new Error(`${row.emoji}: no year for emoji version ${row.v}`);
  const en = cldr.en(row.emoji);
  if (!en) throw new Error(`${row.emoji}: no English CLDR name`);
  // A new slug follows CLDR's English short name (the same name emoji-test.txt gives); a published one never changes.
  if (!slugTable[row.emoji] && slugify(en.tts[0]) !== slugify(row.name)) throw new Error(`${row.emoji}: CLDR "${en.tts[0]}" vs emoji-test "${row.name}"`);
  const slug = assignSlugs(slugTable, [{ emoji: row.emoji, name: en.tts[0] }]);
  slugTable = slug.table;
  const base = baseOf(row.emoji);
  const variants = rows.filter((r) => r.status === "fully-qualified" && r.emoji !== row.emoji && r.subgroup === row.subgroup && baseOf(r.emoji) === base).map((r) => r.emoji);
  data.push({
    slug: slug.slugs[0],
    emoji: row.emoji,
    cp: hex(row.emoji),
    v: row.v,
    year,
    group: slugify(row.group),
    subgroup: row.subgroup,
    variants,
  });
  for (const locale of Object.keys(LOCALES)) {
    const a = cldr[locale](row.emoji);
    if (!a?.tts?.[0]) throw new Error(`${row.emoji}: no CLDR name in ${locale}`);
    names[locale].names[slug.slugs[0]] = a.tts[0];
    names[locale].keywords[slug.slugs[0]] = (a.default ?? []).filter((k) => k !== a.tts[0]);
    for (const v of variants) {
      const va = cldr[locale](v);
      if (!va?.tts?.[0]) throw new Error(`${v} (variant of ${row.emoji}): no CLDR name in ${locale}`);
      names[locale].variants[v] = va.tts[0];
    }
  }
}
if (data.length !== EMOJI.length) throw new Error(`picked ${EMOJI.length}, wrote ${data.length}`);
const slugs = data.map((d) => d.slug);
if (new Set(slugs).size !== slugs.length) throw new Error("duplicate slug");

// Every file this script writes, as text. The snapshot date moves only when one of them changes against HEAD.
const out = new Map();
out.set("src/shared/emoji-data.json", `${JSON.stringify(data, null, 1)}\n`);
out.set(slugTableFile, `${JSON.stringify(slugTable, null, 1)}\n`);
for (const [locale, table] of Object.entries(names)) {
  // Other locales show the English name too ("English name: loudly crying face"); their file carries it.
  if (locale !== "en") table.english = names.en.names;
  out.set(`src/locales/emoji/names/${locale}.json`, `${JSON.stringify(table, null, 1)}\n`);
}
const slugsBody = (date) => [
  "// Generated by scripts/fetch-emoji.mjs: do not edit by hand.",
  `// emoji-test.txt ${version}, CLDR annotations ${CLDR}.`,
  `export const EMOJI_SNAPSHOT = "${date}";`,
  "",
  "/** Page slugs (CLDR English short names when first published) in CLDR order. */",
  "export const EMOJI_SLUGS = [",
  ...slugs.map((s) => `  "${s}",`),
  "] as const;",
  "",
].join("\n");
const atHead = (path) => {
  try {
    return execFileSync("git", ["show", `HEAD:${path}`], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 << 20 });
  } catch {
    return null;
  }
};
const headSlugs = atHead("src/shared/emoji-slugs.ts");
const headSnapshot = headSlugs && /EMOJI_SNAPSHOT = "(\d{4}-\d{2}-\d{2})"/.exec(headSlugs)?.[1];
const unchanged = headSnapshot && headSlugs === slugsBody(headSnapshot) && [...out].every(([path, text]) => atHead(path) === text);
const snapshot = unchanged ? headSnapshot : today;
out.set("src/shared/emoji-slugs.ts", slugsBody(snapshot));
mkdirSync(resolve(root, "src/locales/emoji/names"), { recursive: true });
for (const [path, text] of out) writeFileSync(resolve(root, path), text);
console.log(`emoji: ${data.length} emoji, ${data.reduce((n, d) => n + d.variants.length, 0)} variants, snapshot ${snapshot}`);
