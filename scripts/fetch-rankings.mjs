// Snapshots the data behind /{locale}/rankings/ into src/shared/rankings-rows.json, rankings-meta.json and public/rankings/*.csv.
// Run by hand to refresh (`node scripts/fetch-rankings.mjs`), then commit. Pages never call these sources.
//   Arena leaderboard (CC BY 4.0): huggingface.co/datasets/lmarena-ai/leaderboard-dataset
//   OpenRouter rankings data API (CC BY 4.0, needs OPENROUTER_API_KEY, free): openrouter.ai/docs/cookbook/administration/data-api
//   StatCounter Global Stats (CC BY-SA 3.0): gs.statcounter.com
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const UA = "cv.cm rankings snapshot (https://cv.cm/)";
const REGIONS = ["ww", "US", "CN", "TW", "JP", "KR", "VN", "ID", "ES"];
const ARENA = { "ai-models": "text", "ai-coding-models": "webdev", "ai-image-models": "text_to_image", "ai-video-models": "text_to_video" };
const ARENA_ROWS = 30;
const USAGE_DAYS = 7;
const USAGE_ROWS = 20;
const COMPANY_ROWS = 15;
const SHARE = {
  // StatCounter's "Android" and "Mozilla" browsers are leftovers (old WebViews, unnamed Gecko), not products to rank.
  "browser-market-share": { stat: "browser", device: "desktop+mobile+tablet+console", drop: ["Android", "Mozilla"] },
  "os-market-share": { stat: "os_combined", device: "desktop+mobile+tablet+console" },
  "search-engine-market-share": { stat: "search_engine", device: "desktop+mobile+tablet+console" },
  "phone-market-share": { stat: "vendor", device: "mobile" },
  "social-media-market-share": { stat: "social_media", device: "desktop+mobile+tablet+console" },
};
/** Rows a table keeps: the top by world share, plus anything this big in one of the listed markets. */
const SHARE_TOP = 10;
const SHARE_LOCAL_MIN = 5;
const DROP = new Set(["Other", "Unknown"]);
/** Names in the sources that read wrong on a page. */
const NAMES = {
  google: "Google", openai: "OpenAI", anthropic: "Anthropic", xai: "xAI", "x-ai": "xAI", deepseek: "DeepSeek", meta: "Meta", "meta-llama": "Meta", alibaba: "Alibaba", qwen: "Qwen", tencent: "Tencent", "z-ai": "Z.ai", zhipu: "Zhipu", moonshotai: "Moonshot AI", moonshot: "Moonshot AI", minimax: "MiniMax", mistral: "Mistral AI", mistralai: "Mistral AI", bytedance: "ByteDance", "bytedance-seed": "ByteDance", baidu: "Baidu", nvidia: "NVIDIA", microsoft: "Microsoft", amazon: "Amazon", cohere: "Cohere", kuaishou: "Kuaishou", kling: "Kling", runway: "Runway", luma: "Luma AI", pika: "Pika", "black-forest-labs": "Black Forest Labs", bfl: "Black Forest Labs", ideogram: "Ideogram", recraft: "Recraft", stabilityai: "Stability AI", xiaomi: "Xiaomi", stepfun: "StepFun", liquid: "Liquid AI", nousresearch: "Nous Research", arcee: "Arcee AI", "arcee-ai": "Arcee AI", inception: "Inception", perplexity: "Perplexity",
  zai: "Z.ai", "luma-ai": "Luma AI", "microsoft-ai": "Microsoft", skyreel: "SkyReels", "news.ycombinator.com": "Hacker News",
  bing: "Bing", YANDEX: "Yandex", "YANDEX RU": "Yandex", reddit: "Reddit", "Yahoo!": "Yahoo", "OS X": "macOS", macOS: "macOS", iOS: "iOS", "Unknown Mobile": "Other", "Twitter": "X (Twitter)", "VKontakte": "VK",
};
const nameOf = (raw) => NAMES[raw] ?? (/^[a-z]/.test(raw) ? raw[0].toUpperCase() + raw.slice(1) : raw);

async function get(url, headers = {}) {
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(url, { headers: { "User-Agent": UA, ...headers }, signal: AbortSignal.timeout(40_000) }).catch((error) => {
      if (attempt === 3) throw error;
      return null;
    });
    if (res?.ok) return res.text();
    if (attempt === 3) throw new Error(`${res?.status} ${url}`);
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
}

const today = new Date();

// --- Arena ---------------------------------------------------------------------------------------------------------

/** The dataset lists each category's rows in rank order with "overall" first, so the first page holds what we need. */
async function arena(config) {
  const q = new URLSearchParams({ dataset: "lmarena-ai/leaderboard-dataset", config, split: "latest", offset: "0", length: "100" });
  const data = JSON.parse(await get(`https://datasets-server.huggingface.co/rows?${q}`));
  const overall = data.rows.map(({ row }) => row).filter((row) => row.category === "overall").sort((a, b) => a.rank - b.rank).slice(0, ARENA_ROWS);
  const rows = overall.map((row) => [Math.round(row.rank), row.model_name, row.organization ? nameOf(row.organization) : "", row.license ?? "", Math.round(row.rating), Math.round(row.vote_count)]);
  if (rows.length < ARENA_ROWS) throw new Error(`arena ${config}: only ${rows.length} overall rows in the first page`);
  return { asOf: overall[0].leaderboard_publish_date, rows };
}

// --- OpenRouter ----------------------------------------------------------------------------------------------------

/** Free dataset endpoint: read-only statistics, no model is called, so the key spends nothing. Never call inference here. */
async function openRouter() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));
  const start = new Date(end.getTime() - (USAGE_DAYS - 1) * 86_400_000);
  const q = new URLSearchParams({ start_date: start.toISOString().slice(0, 10), end_date: end.toISOString().slice(0, 10) });
  const { data, meta: source } = JSON.parse(await get(`https://openrouter.ai/api/v1/datasets/rankings-daily?${q}`, { Authorization: `Bearer ${key}` }));
  if (!Array.isArray(data) || !data.length) throw new Error("openrouter: no rows");
  // The public model list names them; a slug's date suffix is what is left when a model is not listed any more.
  const listed = JSON.parse(await get("https://openrouter.ai/api/v1/models")).data;
  const fullName = new Map();
  for (const model of listed) {
    const name = model.name.replace(/^[^:]+:\s*/, "");
    if (!fullName.has(model.canonical_slug) || !/\(/.test(name)) fullName.set(model.canonical_slug, name);
  }
  const bySlug = new Map();
  for (const row of data) {
    const tokens = Number(row.total_tokens);
    if (!Number.isFinite(tokens)) throw new Error(`openrouter: bad tokens for ${row.model_permaslug}`);
    // A model's ":free" variant is the same model.
    const slug = row.model_permaslug.split(":")[0];
    bySlug.set(slug, (bySlug.get(slug) ?? 0) + tokens);
  }
  // The "other" row counts towards the total, so shares are of everything on the platform.
  const total = [...bySlug.values()].reduce((sum, tokens) => sum + tokens, 0);
  const share = (tokens) => Math.round((tokens / total) * 1000) / 10;
  const models = [...bySlug.entries()]
    .filter(([slug]) => slug !== "other")
    .map(([slug, tokens]) => {
      const [author, rest] = slug.split("/");
      const date = /-(\d{4})(\d{4})$/.exec(rest)?.[2];
      // "stealth" is OpenRouter's namespace for unannounced models, not a company.
      return { name: fullName.get(slug) ?? rest.replace(/-\d{8}$/, ""), date, author: author === "stealth" ? "" : nameOf(author), tokens };
    })
    .sort((a, b) => b.tokens - a.tokens);
  if (models.length < USAGE_ROWS) throw new Error(`openrouter: only ${models.length} models`);
  // Two versions of a model can share a name: their release date tells them apart.
  const top = models.slice(0, USAGE_ROWS);
  const seen = new Map();
  for (const m of top) seen.set(m.name, (seen.get(m.name) ?? 0) + 1);
  const label = (m) => (seen.get(m.name) > 1 && m.date ? `${m.name} (${m.date})` : m.name);
  const authors = new Map();
  for (const m of models) {
    if (!m.author) continue;
    const entry = authors.get(m.author) ?? { tokens: 0, models: 0 };
    entry.tokens += m.tokens;
    entry.models += 1;
    authors.set(m.author, entry);
  }
  const asOf = source.end_date;
  return {
    usage: { asOf, rows: top.map((m, i) => [i + 1, label(m), m.author, m.tokens, share(m.tokens)]) },
    authors: { asOf, rows: [...authors.entries()].sort((a, b) => b[1].tokens - a[1].tokens).slice(0, COMPANY_ROWS).map(([author, a], i) => [i + 1, author, a.tokens, share(a.tokens), a.models]) },
  };
}

// --- StatCounter ---------------------------------------------------------------------------------------------------

/** Empty cells stay in place, so values never shift onto the wrong name. */
function parseCsvLine(line) {
  return [...line.matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^,]*))/g)].map((m) => m[1] ?? m[2]);
}

async function statCounter(stat, device, region, month) {
  const compact = month.replace("-", "");
  const q = new URLSearchParams({ device_hidden: device, statType_hidden: stat, region_hidden: region, granularity: "monthly", fromInt: compact, toInt: compact, fromMonthYear: month, toMonthYear: month, csv: "1" });
  const text = await get(`https://gs.statcounter.com/chart.php?${q}`);
  const lines = text.trim().split(/\r?\n/).map(parseCsvLine);
  if (lines[0]?.[1]?.startsWith("Market Share")) {
    const values = lines.slice(1).map(([name, value]) => [name, Number(value)]);
    if (!values.length || values.some(([, value]) => !Number.isFinite(value))) throw new Error(`statcounter ${stat} ${region} ${month}: bad values`);
    return new Map(values);
  }
  // Some requests come back as one row per month with a column per name.
  const row = lines.find((cells) => cells[0] === month);
  if (!row) throw new Error(`statcounter ${stat} ${region} ${month}: no data`);
  return new Map(lines[0].slice(1).map((name, i) => [name, Number(row[i + 1] || 0)]));
}

const pause = () => new Promise((r) => setTimeout(r, 400));

/** Merges names that map to one label (the two Yandex rows). */
function merged(values) {
  const out = new Map();
  for (const [name, value] of values) {
    const label = nameOf(name);
    out.set(label, Math.round(((out.get(label) ?? 0) + value) * 100) / 100);
  }
  return out;
}

async function shareTable({ stat, device, drop = [] }) {
  const skip = new Set([...DROP, ...drop]);
  const last = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const month = last.toISOString().slice(0, 7);
  const yearAgo = `${last.getUTCFullYear() - 1}-${month.slice(5)}`;
  const byRegion = {};
  for (const region of REGIONS) {
    byRegion[region] = merged(await statCounter(stat, device, region, month));
    await pause();
  }
  const before = merged(await statCounter(stat, device, "ww", yearAgo));
  await pause();
  const names = new Set([...byRegion.ww.entries()].filter(([name]) => !skip.has(name)).sort((a, b) => b[1] - a[1]).slice(0, SHARE_TOP).map(([name]) => name));
  for (const region of REGIONS) for (const [name, value] of byRegion[region]) if (value >= SHARE_LOCAL_MIN && !skip.has(name)) names.add(name);
  const rows = [...names]
    .map((name) => [name, before.get(name) ?? null, ...REGIONS.map((region) => byRegion[region].get(name) ?? 0)])
    .sort((a, b) => b[2] - a[2])
    .map((row, i) => [i + 1, ...row]);
  const leaders = Object.fromEntries(REGIONS.map((region) => {
    const top = [...byRegion[region].entries()].filter(([name]) => !skip.has(name)).sort((a, b) => b[1] - a[1])[0];
    return [region, top];
  }));
  return { asOf: month, yearAgo, rows, leaders };
}

// --- Write ---------------------------------------------------------------------------------------------------------

const rows = {};
const meta = { updated: today.toISOString().slice(0, 10), sets: {} };
const rowsPath = join(root, "src/shared/rankings-rows.json");
const metaPath = join(root, "src/shared/rankings-meta.json");
const csv = {};
const esc = (v) => (v === null ? "" : typeof v === "string" && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v));
/** Every row carries its credit, so the licence travels with a downloaded or fetched file. */
const SOURCES = {
  arena: ["https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset", "CC BY 4.0"],
  openrouter: ["https://openrouter.ai/rankings", "CC BY 4.0"],
  statcounter: ["https://gs.statcounter.com/", "CC BY-SA 3.0"],
};
const toCsv = (head, table, source) => [[...head, "source", "license"], ...table.map((row) => [...row, ...SOURCES[source]])].map((r) => r.map(esc).join(",")).join("\n") + "\n";
const topOf = (table, nameCol, valueCol) => table.slice(0, 3).map((r) => [r[nameCol], r[valueCol]]);

for (const [id, config] of Object.entries(ARENA)) {
  const set = await arena(config);
  rows[id] = set.rows;
  const tally = new Map();
  for (const row of set.rows.slice(0, 10)) if (row[2]) tally.set(row[2], (tally.get(row[2]) ?? 0) + 1);
  const [leadOrg, leadCount] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
  meta.sets[id] = { asOf: set.asOf, rows: set.rows.length, top: topOf(set.rows, 1, 4), leadOrg, leadCount };
  csv[id] = toCsv(["rank", "model", "organization", "license", "score", "votes"], set.rows, "arena");
}
const or = await openRouter();
rows["ai-usage"] = or.usage.rows;
meta.sets["ai-usage"] = { asOf: or.usage.asOf, rows: or.usage.rows.length, top: topOf(or.usage.rows, 1, 4) };
csv["ai-usage"] = toCsv(["rank", "model", "author", "tokens", "share_of_all_tokens_percent"], or.usage.rows, "openrouter");
rows["ai-companies"] = or.authors.rows;
meta.sets["ai-companies"] = { asOf: or.authors.asOf, rows: or.authors.rows.length, top: topOf(or.authors.rows, 1, 3) };
csv["ai-companies"] = toCsv(["rank", "company", "tokens", "share_of_all_tokens_percent", "models_listed"], or.authors.rows, "openrouter");
for (const [id, spec] of Object.entries(SHARE)) {
  const set = await shareTable(spec);
  rows[id] = set.rows;
  meta.sets[id] = { asOf: set.asOf, yearAgo: set.yearAgo, rows: set.rows.length, top: topOf(set.rows, 1, 3), leaders: set.leaders };
  csv[id] = toCsv(["rank", "name", `world_${set.yearAgo}`, ...REGIONS.map((r) => (r === "ww" ? `world_${set.asOf}` : r))], set.rows, "statcounter");
  console.log(id, set.asOf, set.rows.length, "rows");
}

// Nothing new from the sources: keep the old date, so no empty commit and no false sitemap date.
const rowsText = `${JSON.stringify(rows)}\n`;
if (existsSync(rowsPath) && readFileSync(rowsPath, "utf8") === rowsText) {
  meta.updated = JSON.parse(readFileSync(metaPath, "utf8")).updated;
}
writeFileSync(rowsPath, rowsText);
writeFileSync(metaPath, `${JSON.stringify(meta, null, 1)}\n`);
const dir = join(root, "public/rankings");
mkdirSync(dir, { recursive: true });
for (const [id, text] of Object.entries(csv)) writeFileSync(join(dir, `${id}.csv`), text);
console.log("wrote src/shared/rankings-rows.json, rankings-meta.json and public/rankings");
