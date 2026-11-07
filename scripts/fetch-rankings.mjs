// Snapshots the data behind /{locale}/rankings/ into src/shared/rankings-rows.json, rankings-meta.json and public/rankings/*.csv.
// Run daily by .github/workflows/refresh-rankings.yml, or by hand (`node scripts/fetch-rankings.mjs`). Pages never call these sources.
//   Arena leaderboard (CC BY 4.0): huggingface.co/datasets/lmarena-ai/leaderboard-dataset
//   OpenRouter rankings data API (CC BY 4.0, needs OPENROUTER_API_KEY, free): openrouter.ai/docs/cookbook/administration/data-api
//   StatCounter Global Stats (CC BY-SA 3.0): gs.statcounter.com
//   CoinMarketCap API (free Basic plan, needs COINMARKETCAP_API_KEY; no redistribution, so no CSV): coinmarketcap.com/api
//   World Bank Pink Sheet monthly commodity prices (CC BY 4.0): worldbank.org/en/research/commodity-markets
//   ECB euro foreign exchange reference rates (free reuse with the source named): ecb.europa.eu
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { inflateRawSync } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FAILURES_FILE = process.env.RANKINGS_FAILURES_FILE ?? join(tmpdir(), "rankings-failures.txt");
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

async function getBuffer(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** The files in a zip (or xlsx), by name: enough of the format for the two archives read here. */
function unzip(buffer) {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error("not a zip file");
  const count = buffer.readUInt16LE(end + 10);
  let at = buffer.readUInt32LE(end + 16);
  const files = new Map();
  for (let i = 0; i < count; i += 1) {
    const method = buffer.readUInt16LE(at + 10);
    const size = buffer.readUInt32LE(at + 20);
    const nameLength = buffer.readUInt16LE(at + 28);
    const extra = buffer.readUInt16LE(at + 30);
    const comment = buffer.readUInt16LE(at + 32);
    const local = buffer.readUInt32LE(at + 42);
    const name = buffer.toString("utf8", at + 46, at + 46 + nameLength);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const raw = buffer.subarray(start, start + size);
    files.set(name, method === 8 ? inflateRawSync(raw) : raw);
    at += 46 + nameLength + extra + comment;
  }
  return files;
}

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
  // Two days back: at 02:17 UTC yesterday may still be loading, and a partial day would understate every total.
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 2));
  const start = new Date(end.getTime() - (USAGE_DAYS - 1) * 86_400_000);
  const q = new URLSearchParams({ start_date: start.toISOString().slice(0, 10), end_date: end.toISOString().slice(0, 10) });
  const { data, meta: source } = JSON.parse(await get(`https://openrouter.ai/api/v1/datasets/rankings-daily?${q}`, { Authorization: `Bearer ${key}` }));
  if (!Array.isArray(data) || !data.length) throw new Error("openrouter: no rows");
  // The pages say "7 days": a shorter window would understate every total.
  const days = new Set(data.map((row) => row.date)).size;
  if (days !== USAGE_DAYS || source.end_date !== q.get("end_date")) throw new Error(`openrouter: ${days} days to ${source.end_date}`);
  // The public model list names them; a slug's date suffix is what is left when a model is not listed any more.
  const listed = JSON.parse(await get("https://openrouter.ai/api/v1/models")).data;
  const fullName = new Map();
  for (const model of listed) {
    // ":free" variants merge with their model below, so their "(free)" label goes too.
    const name = model.name.replace(/^[^:]+:\s*/, "").replace(/\s*\(free\)$/i, "");
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
    citedAt: source.as_of,
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

function lastMonth() {
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
}

async function shareTable({ stat, device, drop = [] }, month) {
  const skip = new Set([...DROP, ...drop]);
  const yearAgo = `${Number(month.slice(0, 4)) - 1}-${month.slice(5)}`;
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

// --- CoinMarketCap -------------------------------------------------------------------------------------------------

const CRYPTO_ROWS = 100;

/** One call to the free plan: one credit of 15,000 a month. Never redistributed as a file. */
async function crypto() {
  const key = process.env.COINMARKETCAP_API_KEY;
  if (!key) throw new Error("COINMARKETCAP_API_KEY is not set");
  const q = new URLSearchParams({ limit: String(CRYPTO_ROWS), convert: "USD", sort: "market_cap" });
  const body = JSON.parse(await get(`https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?${q}`, { "X-CMC_PRO_API_KEY": key }));
  if (body.status?.error_code) throw new Error(`coinmarketcap: ${body.status.error_message}`);
  const coins = body.data ?? [];
  if (coins.length < CRYPTO_ROWS) throw new Error(`coinmarketcap: only ${coins.length} coins`);
  const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
  const rows = coins.map((coin, i) => {
    const usd = coin.quote.USD;
    const values = [usd.price, usd.percent_change_24h, usd.percent_change_7d, usd.market_cap, usd.volume_24h];
    if (values.some((v) => !Number.isFinite(v))) throw new Error(`coinmarketcap: bad numbers for ${coin.symbol}`);
    // Enough digits for coins worth a fraction of a cent.
    const priceDigits = usd.price >= 1 ? 2 : Math.min(10, 3 - Math.floor(Math.log10(usd.price)));
    return [i + 1, coin.name, coin.symbol, round(usd.price, priceDigits), round(usd.percent_change_24h, 2), round(usd.percent_change_7d, 2), Math.round(usd.market_cap), Math.round(usd.volume_24h)];
  });
  return {
    asOf: body.status.timestamp.slice(0, 10),
    rows,
    total: rows.reduce((sum, row) => sum + row[6], 0),
    dominance: Math.round(coins[0].quote.USD.market_cap_dominance * 10) / 10,
  };
}

// --- World Bank Pink Sheet -----------------------------------------------------------------------------------------

/** Pink Sheet column name → id, for the commodities people look up; the copy names them in each language. */
const COMMODITIES = {
  "Crude oil, Brent": "crude-oil-brent", "Crude oil, WTI": "crude-oil-wti", "Natural gas, US": "natural-gas-us", "Natural gas, Europe": "natural-gas-europe",
  "Liquefied natural gas, Japan": "lng-japan", "Coal, Australian": "coal", Cocoa: "cocoa", "Coffee, Arabica": "coffee-arabica", "Coffee, Robusta": "coffee-robusta",
  "Tea, avg 3 auctions": "tea", "Palm oil": "palm-oil", Soybeans: "soybeans", "Soybean oil": "soybean-oil", Maize: "maize", "Wheat, US HRW": "wheat",
  "Rice, Thai 5%": "rice", "Sugar, world": "sugar", Orange: "orange", Beef: "beef", Chicken: "chicken", "Shrimps, Mexican": "shrimp", "Cotton, A Index": "cotton",
  "Rubber, RSS3": "rubber", Urea: "urea", Aluminum: "aluminum", "Iron ore, cfr spot": "iron-ore", Copper: "copper", Lead: "lead", Tin: "tin", Nickel: "nickel",
  Zinc: "zinc", Gold: "gold", Platinum: "platinum", Silver: "silver",
};
const PINK_SHEET = "https://www.worldbank.org/en/research/commodity-markets";

async function commodities() {
  const page = await get(PINK_SHEET);
  const url = page.match(/https:\/\/[^"']*CMO-Historical-Data-Monthly\.xlsx/)?.[0];
  if (!url) throw new Error("pink sheet: workbook link not found");
  const files = unzip(await getBuffer(url));
  const strings = [...files.get("xl/sharedStrings.xml").toString("utf8").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&"));
  const book = files.get("xl/workbook.xml").toString("utf8");
  const rid = book.match(/<sheet name="Monthly Prices"[^>]*r:id="([^"]+)"/)?.[1];
  const target = files.get("xl/_rels/workbook.xml.rels").toString("utf8").match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`))?.[1];
  const sheet = files.get(`xl/${target}`)?.toString("utf8");
  if (!sheet) throw new Error("pink sheet: Monthly Prices not found");
  const table = [];
  for (const [, body] of sheet.matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const [, col, attrs, inner] of body.matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const v = inner?.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? inner?.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "";
      cells[col] = /t="s"/.test(attrs) ? strings[Number(v)] : v;
    }
    table.push(cells);
  }
  const headAt = table.findIndex((cells) => Object.values(cells).includes("Crude oil, Brent"));
  if (headAt < 0) throw new Error("pink sheet: header row not found");
  const head = table[headAt];
  const units = table[headAt + 1];
  const months = table.filter((cells) => /^\d{4}M\d{2}$/.test(cells.A ?? ""));
  const at = (offset) => months[months.length - 1 - offset];
  const rows = [];
  for (const [col, raw] of Object.entries(head)) {
    const id = COMMODITIES[String(raw).replace(/\*/g, "").trim()];
    if (!id) continue;
    const [now, month, year] = [0, 1, 12].map((offset) => Number(at(offset)[col]));
    // A series the World Bank has not filled in for the latest month is left out rather than shown stale.
    if (![now, month, year].every((v) => Number.isFinite(v) && v > 0)) {
      console.log(`pink sheet: skipping ${raw}, no recent values`);
      continue;
    }
    const pct = (old) => Math.round((now / old - 1) * 1000) / 10;
    rows.push([id, (units[col] ?? "").replace(/[()]/g, ""), Math.round(now * 100) / 100, pct(month), pct(year)]);
  }
  if (rows.length < Object.keys(COMMODITIES).length - 5) throw new Error(`pink sheet: only ${rows.length} commodities matched`);
  rows.sort((a, b) => b[4] - a[4]);
  const last = at(0).A;
  return { asOf: `${last.slice(0, 4)}-${last.slice(5)}`, rows: rows.map((row, i) => [i + 1, ...row]) };
}

// --- ECB reference rates -------------------------------------------------------------------------------------------

/** Each currency against the US dollar, from the euro rates: how many per dollar, and how its value moved. */
async function currencies() {
  const files = unzip(await getBuffer("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.zip"));
  const csv = [...files.values()][0].toString("utf8").trim().split(/\r?\n/).map((line) => line.split(","));
  const head = csv[0].map((cell) => cell.trim());
  const days = csv.slice(1).map((cells) => ({ date: cells[0], rates: Object.fromEntries(head.slice(1).map((code, i) => [code, Number(cells[i + 1])])) }));
  const latest = days[0];
  const before = (months) => {
    const d = new Date(`${latest.date}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - months);
    const day = d.toISOString().slice(0, 10);
    return days.find((entry) => entry.date <= day);
  };
  const monthAgo = before(1);
  const yearAgo = before(12);
  const perUsd = (entry, code) => (code === "EUR" ? 1 / entry.rates.USD : entry.rates[code] / entry.rates.USD);
  const codes = ["EUR", ...head.slice(1).filter((code) => code && code !== "USD" && Number.isFinite(latest.rates[code]) && latest.rates[code] > 0)];
  const rows = codes.map((code) => {
    const now = perUsd(latest, code);
    // Fewer units per dollar than before means the currency gained value.
    const change = (entry) => Math.round((perUsd(entry, code) / now - 1) * 1000) / 10;
    const digits = now >= 100 ? 2 : now >= 1 ? 4 : 6;
    return [code, Math.round(now * 10 ** digits) / 10 ** digits, change(monthAgo), change(yearAgo)];
  }).filter((row) => Number.isFinite(row[2]) && Number.isFinite(row[3]));
  if (rows.length < 20) throw new Error(`ecb: only ${rows.length} currencies`);
  rows.sort((a, b) => b[3] - a[3]);
  return { asOf: latest.date, monthAgo: monthAgo.date, yearAgo: yearAgo.date, rows: rows.map((row, i) => [i + 1, ...row]) };
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
  statcounter: ["https://gs.statcounter.com/", "CC BY-SA 3.0"],
};
const toCsv = (head, table, source) => [[...head, "source", "license"], ...table.map((row) => [...row, ...source])].map((r) => r.map(esc).join(",")).join("\n") + "\n";
const topOf = (table, nameCol, valueCol) => table.slice(0, 3).map((r) => [r[nameCol], r[valueCol]]);

const oldRows = existsSync(rowsPath) ? JSON.parse(readFileSync(rowsPath, "utf8")) : {};
const oldMeta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, "utf8")) : { sets: {} };
const keep = (id) => {
  rows[id] = oldRows[id];
  meta.sets[id] = oldMeta.sets[id];
};
rmSync(FAILURES_FILE, { force: true });
let attempts = 0;
let failures = 0;
/** One source failing keeps its last good tables, so it cannot hold back the others. With no earlier data there is nothing to keep. */
async function attempt(ids, fetchTables) {
  attempts += 1;
  try {
    await fetchTables();
  } catch (error) {
    if (ids.some((id) => !oldRows[id])) throw error;
    failures += 1;
    console.log(`::warning::keeping the last good ${ids.join(", ")}: ${error.message}`);
    // The workflow publishes what did refresh, then fails on this file so the stale table gets noticed.
    appendFileSync(FAILURES_FILE, `${ids.join(", ")}: ${error.message}\n`);
    ids.forEach(keep);
  }
}

for (const [id, config] of Object.entries(ARENA)) {
  await attempt([id], async () => {
    const set = await arena(config);
    const tally = new Map();
    for (const row of set.rows.slice(0, 10)) if (row[2]) tally.set(row[2], (tally.get(row[2]) ?? 0) + 1);
    const [leadOrg, leadCount] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    rows[id] = set.rows;
    meta.sets[id] = { asOf: set.asOf, rows: set.rows.length, top: topOf(set.rows, 1, 4), leadOrg, leadCount };
    csv[id] = toCsv(["rank", "model", "organization", "license", "score", "votes"], set.rows, SOURCES.arena);
  });
}
await attempt(["ai-usage", "ai-companies"], async () => {
  const or = await openRouter();
  // The citation OpenRouter asks for when its data is republished.
  const cite = [`OpenRouter (openrouter.ai/rankings), as of ${or.citedAt}`, "CC BY 4.0"];
  rows["ai-usage"] = or.usage.rows;
  meta.sets["ai-usage"] = { asOf: or.usage.asOf, rows: or.usage.rows.length, top: topOf(or.usage.rows, 1, 4) };
  csv["ai-usage"] = toCsv(["rank", "model", "author", "tokens", "share_of_public_tokens_percent"], or.usage.rows, cite);
  rows["ai-companies"] = or.authors.rows;
  meta.sets["ai-companies"] = { asOf: or.authors.asOf, rows: or.authors.rows.length, top: topOf(or.authors.rows, 1, 3) };
  csv["ai-companies"] = toCsv(["rank", "company", "tokens", "share_of_public_tokens_percent", "models_listed"], or.authors.rows, cite);
});
await attempt(["crypto-market-cap"], async () => {
  const set = await crypto();
  rows["crypto-market-cap"] = set.rows;
  meta.sets["crypto-market-cap"] = { asOf: set.asOf, rows: set.rows.length, top: topOf(set.rows, 1, 6), total: set.total, dominance: set.dominance };
});
await attempt(["currency-strength"], async () => {
  const set = await currencies();
  rows["currency-strength"] = set.rows;
  meta.sets["currency-strength"] = { asOf: set.asOf, monthAgo: set.monthAgo, yearAgo: set.yearAgo, rows: set.rows.length, top: topOf(set.rows, 1, 4), bottom: set.rows.slice(-3).reverse().map((r) => [r[1], r[4]]) };
  csv["currency-strength"] = toCsv(["rank", "currency", "per_usd", `change_vs_usd_since_${set.monthAgo}_percent`, `change_vs_usd_since_${set.yearAgo}_percent`], set.rows, ["European Central Bank euro reference rates (ecb.europa.eu)", "Reuse with source named"]);
});
const month = lastMonth();
// The Pink Sheet comes out early each month: nothing to ask for until a new month is due.
if (!process.env.FORCE_SHARE && oldMeta.sets["commodity-prices"]?.asOf === month && oldRows["commodity-prices"]) keep("commodity-prices");
else {
  await attempt(["commodity-prices"], async () => {
    const set = await commodities();
    rows["commodity-prices"] = set.rows;
    meta.sets["commodity-prices"] = { asOf: set.asOf, rows: set.rows.length, top: topOf(set.rows, 1, 5), bottom: set.rows.slice(-3).reverse().map((r) => [r[1], r[5]]) };
    csv["commodity-prices"] = toCsv(["rank", "commodity", "unit", "price_usd", "change_1_month_percent", "change_12_months_percent"], set.rows, [PINK_SHEET, "CC BY 4.0"]);
  });
}

for (const [id, spec] of Object.entries(SHARE)) {
  // StatCounter publishes monthly: nothing to ask for until a new month is due.
  // FORCE_SHARE=1 asks again, for a fix to names or filters.
  if (!process.env.FORCE_SHARE && oldMeta.sets[id]?.asOf === month && oldRows[id]) {
    keep(id);
    continue;
  }
  await attempt([id], async () => {
    const set = await shareTable(spec, month);
    rows[id] = set.rows;
    meta.sets[id] = { asOf: set.asOf, yearAgo: set.yearAgo, rows: set.rows.length, top: topOf(set.rows, 1, 3), leaders: set.leaders };
    csv[id] = toCsv(["rank", "name", `world_${set.yearAgo}`, ...REGIONS.map((r) => (r === "ww" ? `world_${set.asOf}` : r))], set.rows, SOURCES.statcounter);
    console.log(id, set.asOf, set.rows.length, "rows");
  });
}
if (attempts && failures === attempts) throw new Error("every source failed");

// A table's date moves only when its rows changed, so a monthly table never claims a daily update.
for (const [id, set] of Object.entries(meta.sets)) {
  const same = oldMeta.sets[id]?.updated && oldMeta.sets[id].asOf === set.asOf && JSON.stringify(oldRows[id]) === JSON.stringify(rows[id]);
  set.updated = same ? oldMeta.sets[id].updated : meta.updated;
  // Same data: the file stays, so a re-run with only a newer citation time makes no commit.
  if (same) delete csv[id];
}
meta.updated = Object.values(meta.sets).map((set) => set.updated).sort().at(-1);
writeFileSync(rowsPath, `${JSON.stringify(rows)}\n`);
writeFileSync(metaPath, `${JSON.stringify(meta, null, 1)}\n`);
const dir = join(root, "public/rankings");
mkdirSync(dir, { recursive: true });
for (const [id, text] of Object.entries(csv)) writeFileSync(join(dir, `${id}.csv`), text);
console.log("wrote src/shared/rankings-rows.json, rankings-meta.json and public/rankings");
