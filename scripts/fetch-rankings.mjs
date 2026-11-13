// Snapshots the data behind /{locale}/rankings/ into src/shared/rankings-rows.json (geography: rankings-geo/<id>.json), rankings-meta.json and public/rankings/*.csv.
// Run daily by .github/workflows/refresh-rankings.yml, or by hand (`node scripts/fetch-rankings.mjs`). Pages never call these sources.
//   Arena leaderboard (CC BY 4.0): huggingface.co/datasets/lmarena-ai/leaderboard-dataset
//   OpenRouter rankings data API (CC BY 4.0, needs OPENROUTER_API_KEY, free): openrouter.ai/docs/cookbook/administration/data-api
//   StatCounter Global Stats (CC BY-SA 3.0): gs.statcounter.com
//   CoinMarketCap API (free Basic plan, needs COINMARKETCAP_API_KEY; no redistribution, so no CSV): coinmarketcap.com/api
//   World Bank Pink Sheet monthly commodity prices (CC BY 4.0): worldbank.org/en/research/commodity-markets
//   ECB euro foreign exchange reference rates (free reuse with the source named): ecb.europa.eu
//   Wikidata (CC0): the tallest mountains, query.wikidata.org
//   English Wikipedia lists (CC BY-SA 4.0): longest rivers, largest lakes, largest islands, largest deserts, tallest buildings,
//   largest cities, largest stadiums; names from Wikidata
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

async function get(url, headers = {}, timeout = 40_000, init = {}) {
  for (let attempt = 0; ; attempt += 1) {
    // The timeout covers the body too: a stalled body is retried like a stalled answer, and either names the request.
    const text = await fetch(url, { ...init, headers: { "User-Agent": UA, ...headers }, signal: AbortSignal.timeout(timeout) })
      .then(async (res) => ({ ok: res.ok, status: res.status, body: res.ok ? await res.text() : "" }))
      .catch((error) => {
        if (attempt === 3) throw new Error(`${error.message}: ${url.slice(0, 160)}`);
        return null;
      });
    if (text?.ok) return text.body;
    if (attempt === 3) throw new Error(`${text?.status} ${url}`);
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
    // Price and market cap rank the table; a coin listed days ago can lack a 7-day change or volume, shown as missing.
    if (![usd.price, usd.market_cap].every((v) => Number.isFinite(v) && v > 0)) throw new Error(`coinmarketcap: bad numbers for ${coin.symbol}`);
    const maybe = (v, d) => (Number.isFinite(v) ? round(v, d) : null);
    // Enough digits for coins worth a fraction of a cent.
    const priceDigits = usd.price >= 1 ? 2 : Math.min(10, 3 - Math.floor(Math.log10(usd.price)));
    return [i + 1, coin.name, coin.symbol, round(usd.price, priceDigits), maybe(usd.percent_change_24h, 2), maybe(usd.percent_change_7d, 2), Math.round(usd.market_cap), maybe(usd.volume_24h, 0)];
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

function decodeXml(text) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (all, code) => {
    if (code[0] !== "#") return named[code.toLowerCase()];
    return String.fromCodePoint(code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1)));
  }).replace(/\u00a0/g, " ").trim();
}

async function commodities() {
  const page = await get(PINK_SHEET);
  const url = page.match(/https:\/\/[^"']*CMO-Historical-Data-Monthly\.xlsx/)?.[0];
  if (!url) throw new Error("pink sheet: workbook link not found");
  const files = unzip(await getBuffer(url));
  const strings = [...files.get("xl/sharedStrings.xml").toString("utf8").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => decodeXml(m[1].replace(/<[^>]+>/g, "")));
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
  // Same day of an earlier month, kept inside that month (31 March → 28 February, not 3 March).
  const before = (months) => {
    const [y, m, d] = latest.date.split("-").map(Number);
    const target = new Date(Date.UTC(y, m - 1 - months, 1));
    const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(d, last));
    const day = target.toISOString().slice(0, 10);
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

/** The downloadable file for a table, from its rows and summary. CoinMarketCap rows are never written (NO_CSV). */
const NO_CSV = new Set(["crypto-market-cap"]);
function csvOf(id, table, set) {
  if (ARENA[id]) return toCsv(["rank", "model", "organization", "license", "score", "votes"], table, SOURCES.arena);
  // The citation OpenRouter asks for when its data is republished.
  const cite = [`OpenRouter (openrouter.ai/rankings), as of ${set.citedAt ?? set.asOf}`, "CC BY 4.0"];
  if (id === "ai-usage") return toCsv(["rank", "model", "author", "tokens", "share_of_public_tokens_percent"], table, cite);
  if (id === "ai-companies") return toCsv(["rank", "company", "tokens", "share_of_public_tokens_percent", "models_listed"], table, cite);
  if (id === "currency-strength") return toCsv(["rank", "currency", "per_usd", "change_vs_usd_1_month_percent", "change_vs_usd_1_year_percent", "as_of", "month_ago", "year_ago"], table.map((row) => [...row, set.asOf, set.monthAgo, set.yearAgo]), ["European Central Bank euro reference rates (ecb.europa.eu)", "Reuse with source named"]);
  if (id === "commodity-prices") return toCsv(["rank", "commodity", "unit", "price_usd", "change_1_month_percent", "change_12_months_percent", "month"], table.map((row) => [...row, set.asOf]), [PINK_SHEET, "CC BY 4.0"]);
  if (id === "tallest-mountains") return toCsv(["rank", "wikidata_id", "name", "elevation_m", "elevation_ft", "prominence_m", "countries", "range"], table.map(([rank, qid, names, elevation, prominence, countries, range]) => [rank, qid, names.en, elevation, Math.round(elevation / METRES_PER_FOOT), prominence, countries.join(" "), range?.en ?? ""]), ["Wikidata (wikidata.org)", "CC0 1.0"]);
  if (WP_LISTS[id]) {
    // CC BY-SA asks for the page and its revision; names and countries are Wikidata's (CC0).
    const cite = [`Wikipedia: ${WP_LISTS[id].page} (en.wikipedia.org/w/index.php?oldid=${set.revision}); names from Wikidata`, "CC BY-SA 4.0"];
    const countryCsv = (countries) => countries.map((c) => (typeof c === "string" ? c : c.en)).join("; ");
    if (id === "longest-rivers") return toCsv(["rank", "wikidata_id", "name", "length_km", "length_mi", "countries_in_basin", "river_system"], table.map(([rank, qid, names, km, countries, system]) => [rank, qid, names.en, km, Math.round(km / KM_PER_MILE), countryCsv(countries), system ?? ""]), cite);
    if (id === "largest-lakes") return toCsv(["rank", "wikidata_id", "name", "area_km2", "area_sq_mi", "countries", "max_depth_m", "water"], table.map(([rank, qid, names, km2, countries, depth, water]) => [rank, qid, names.en, km2, Math.round(km2 / KM2_PER_SQ_MI), countryCsv(countries), depth, water]), cite);
    if (id === "largest-deserts") return toCsv(["rank", "wikidata_id", "name", "area_km2", "area_sq_mi", "countries", "type"], table.map(([rank, qid, names, km2, countries, type]) => [rank, qid, names.en, km2, Math.round(km2 / KM2_PER_SQ_MI), countryCsv(countries), type]), cite);
    if (id === "tallest-buildings") return toCsv(["rank", "wikidata_id", "name", "height_m", "height_ft", "floors", "city", "countries", "completed"], table.map(([rank, qid, names, metres, countries, floors, city, year]) => [rank, qid, names.en, metres, Math.round(metres / METRES_PER_FOOT), floors, city?.en ?? "", countryCsv(countries), year]), cite);
    if (id === "largest-cities") return toCsv(["rank", "wikidata_id", "name", "population_un_2025", "countries"], table.map(([rank, qid, names, people, countries]) => [rank, qid, names.en, people, countryCsv(countries)]), cite);
    if (id === "largest-stadiums") return toCsv(["rank", "wikidata_id", "name", "capacity", "city", "countries"], table.map(([rank, qid, names, seats, countries, city]) => [rank, qid, names.en, seats, city?.en ?? "", countryCsv(countries)]), cite);
    return toCsv(["rank", "wikidata_id", "name", "area_km2", "area_sq_mi", "countries"], table.map(([rank, qid, names, km2, countries]) => [rank, qid, names.en, km2, Math.round(km2 / KM2_PER_SQ_MI), countryCsv(countries)]), cite);
  }
  return toCsv(["rank", "name", `world_${set.yearAgo}`, ...REGIONS.map((r) => (r === "ww" ? `world_${set.asOf}` : r))], table, SOURCES.statcounter);
}

// --- Wikidata: tallest mountains -----------------------------------------------------------------------------------

const MOUNTAIN_ROWS = 100;
const METRES_PER_FOOT = 0.3048;
/** A range named by at least this many Wikipedias is a real one; fewer is usually a stub with a garbled label. */
const RANGE_MIN_SITELINKS = 3;
/** Peaks rise at least this far above the col to a higher one: the usual line between a mountain and a shoulder of one. */
const MIN_PROMINENCE = 500;
const SPARQL = "https://query.wikidata.org/sparql";
/** The bindings of a Wikidata query (its own limit is 60 s, so the wait here is longer). */
async function sparql(query) {
  return JSON.parse(await get(`${SPARQL}?${new URLSearchParams({ query, format: "json" })}`, { Accept: "application/sparql-results+json" }, 70_000)).results.bindings;
}
/** "http://www.wikidata.org/entity/Q513" → "Q513". */
const qid = (uri) => uri.slice(uri.lastIndexOf("/") + 1);
/** Sitelinks that are not a Wikipedia. */
const NOT_WIKIPEDIA = new Set(["commonswiki", "specieswiki", "wikidatawiki", "metawiki", "mediawikiwiki", "sourceswiki", "wikimaniawiki", "incubatorwiki", "outreachwiki", "wikifunctionswiki"]);
/** The Wikidata label for each cv.cm locale; a locale without one shows the English name. */
const LABEL_LANGS = { en: "en", "zh-CN": "zh-cn", "zh-TW": "zh-tw", ja: "ja", ko: "ko", vi: "vi", id: "id", es: "es" };

/** A row's names from the names an item has: English always; other locales only where they differ from it, as the page
 * falls back to English (rows are shipped to the browser). */
function localeNames(own) {
  return Object.fromEntries(Object.entries(own).filter(([locale, name]) => locale === "en" || name !== own.en));
}

/** Names in every locale, and how many Wikipedias cover the item. Chinese falls back across scripts, converted by Wikidata (zh-tw from zh-hans and back). */
async function labels(ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const q = new URLSearchParams({ action: "wbgetentities", ids: ids.slice(i, i + 50).join("|"), props: "labels|sitelinks", languages: [...Object.values(LABEL_LANGS), "mul"].join("|"), languagefallback: "1", format: "json" });
    const data = JSON.parse(await get(`https://www.wikidata.org/w/api.php?${q}`));
    if (data.error) throw new Error(`wikidata labels: ${data.error.code} ${data.error.info ?? ""}`);
    for (const [id, entity] of Object.entries(data.entities)) {
      const label = (code) => {
        const found = entity.labels?.[code];
        if (!found) return null;
        // A fallback to another language (Vietnamese to English, say) is no name in this one; Chinese across scripts is.
        const from = found["source-language"] ?? found.language;
        return from === code || (code.startsWith("zh") && from.startsWith("zh")) ? found.value : null;
      };
      // "mul" is Wikidata's name for every language, used where editors dropped a duplicate English label.
      const en = label("en") ?? entity.labels?.mul?.value;
      if (!en) continue;
      // own: the names Wikidata (or a fix) really has; names: every locale, English where there is none, English copies dropped.
      const own = {};
      for (const [locale, code] of Object.entries(LABEL_LANGS)) {
        const name = LABEL_FIX[id]?.[locale] ?? label(code) ?? (locale === "en" ? LABEL_FIX[id]?.en ?? en : null);
        if (name) own[locale] = name;
      }
      // Wikipedias only: Commons, Wikivoyage and the rest link stubs too.
      out[id] = { own, sitelinks: Object.keys(entity.sitelinks ?? {}).filter((site) => /wiki$/.test(site) && !NOT_WIKIPEDIA.has(site)).length };
    }
    await pause();
  }
  // Wikidata's Chinese labels are not always in the script their code says (Lake Superior's zh-tw label is Simplified):
  // every one goes through MediaWiki's own converter, as zh.wikipedia shows it to readers of that variant.
  for (const [locale, variant] of [["zh-CN", "zh-cn"], ["zh-TW", "zh-tw"]]) {
    const ids = Object.keys(out).filter((id) => out[id].own[locale] && !LABEL_FIX[id]?.[locale]);
    const converted = await zhVariant(ids.map((id) => out[id].own[locale]), variant);
    ids.forEach((id, i) => {
      out[id].own[locale] = converted[i];
    });
  }
  for (const item of Object.values(out)) item.names = localeNames(item.own);
  return out;
}

/** Chinese text in one script variant (zh-cn Simplified, zh-tw Traditional), by zh.wikipedia's converter, characters only. */
async function zhVariant(texts, variant) {
  const out = [];
  const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/[[\]{}|'~]/g, (c) => `&#${c.charCodeAt(0)};`);
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100);
    // One span per paragraph: no line can start a list or heading, and each comes back on its own.
    const body = new URLSearchParams({ action: "parse", format: "json", formatversion: "2", prop: "text", contentmodel: "wikitext", disablelimitreport: "1", variant, text: batch.map((t) => `<span>${escape(t)}</span>`).join("\n\n") });
    const data = JSON.parse(await get("https://zh.wikipedia.org/w/api.php", {}, 40_000, { method: "POST", body }));
    if (data.error) throw new Error(`zh.wikipedia convert: ${data.error.code} ${data.error.info ?? ""}`);
    const spans = [...data.parse.text.matchAll(/<span>(.*?)<\/span>/gs)].map((m) => decode(m[1]));
    if (spans.length !== batch.length) throw new Error(`zh.wikipedia convert: ${spans.length} of ${batch.length} back`);
    out.push(...spans);
    await pause();
  }
  return out;
}

/** Wikidata labels that are wrong: a group's name on its highest peak, another peak's name, a fragment. */
const LABEL_FIX = {
  Q187138: { en: "Gasherbrum I" },
  Q2102394: { ja: "サセル・カンリ" },
  Q564576: { ja: "アンナプルナIII峰" },
  Q1207615: { "zh-CN": "道拉吉里山脉", "zh-TW": "道拉吉里山脈" },
  Q159621: { "zh-CN": "安纳布尔纳山脉", "zh-TW": "安納布爾納山脈" },
};

/** Elevation and prominence from the best-ranked statements (a preferred survey outranks the rest; among equals, the highest), in metres. */
async function mountains() {
  const query = `SELECT ?m (MAX(?e) AS ?elev) (MAX(?p) AS ?prom) (GROUP_CONCAT(DISTINCT ?cc; separator="|") AS ?cs) (GROUP_CONCAT(DISTINCT ?r; separator="|") AS ?ranges) (GROUP_CONCAT(DISTINCT CONCAT(STR(?lat), ",", STR(?lon)); separator="|") AS ?at) WHERE {
  ?m p:P2044 ?es . ?es a wikibase:BestRank ; psn:P2044/wikibase:quantityAmount ?e . FILTER(?e > 5000 && ?e < 9000)
  ?m p:P2660 ?ps . ?ps a wikibase:BestRank ; psn:P2660/wikibase:quantityAmount ?p . FILTER(?p >= ${MIN_PROMINENCE})
  OPTIONAL { ?m p:P17 ?cst . ?cst a wikibase:BestRank ; ps:P17 ?c . ?c wdt:P297 ?cc . FILTER NOT EXISTS { ?c wdt:P576 [] } }
  OPTIONAL { ?m wdt:P4552 ?r }
  OPTIONAL { ?m p:P625/psv:P625 [ wikibase:geoLatitude ?lat ; wikibase:geoLongitude ?lon ] }
} GROUP BY ?m ORDER BY DESC(?elev) LIMIT ${MOUNTAIN_ROWS * 2}`;
  const found = (await sparql(query)).map((b) => ({
    id: qid(b.m.value),
    elevation: Math.round(Number(b.elev.value) * 100) / 100,
    prominence: Math.round(Number(b.prom.value) * 100) / 100,
    countries: b.cs?.value ? b.cs.value.split("|").sort() : [],
    // "Unknown value" comes back as a blank-node URI, not an item: left out.
    ranges: b.ranges?.value ? b.ranges.value.split("|").map(qid).filter((id) => /^Q\d+$/.test(id)) : [],
    // An item with two coordinates (two surveys) keeps the same one on every run.
    at: b.at?.value ? b.at.value.split("|").sort()[0].split(",").map((v) => Math.round(Number(v) * 1e4) / 1e4) : null,
  }));
  const info = await labels([...new Set(found.flatMap((m) => [m.id, ...m.ranges]))]);
  for (const m of found) {
    [m.lat, m.lon] = m.at ?? [null, null];
    // No peak rises above its own height: Everest's prominence is its elevation, whatever survey each figure comes from.
    m.prominence = Math.min(m.prominence, m.elevation);
    // A peak in both "Himalayas" and "Mahalangur Himal" shows the narrower: the range with the fewest Wikipedias, among real ranges.
    const byReach = m.ranges.filter((id) => info[id]).sort((a, b) => info[a].sitelinks - info[b].sitelinks || a.localeCompare(b));
    m.range = byReach.find((id) => info[id].sitelinks >= RANGE_MIN_SITELINKS) ?? byReach.at(-1) ?? null;
  }
  // Wikidata has a few peaks twice (an item for the peak and one for its massif): within a metre, same spot. Keep the better known.
  const same = (a, b) => Math.abs(a.elevation - b.elevation) < 1 && a.lat !== null && b.lat !== null && Math.abs(a.lat - b.lat) < 0.02 && Math.abs(a.lon - b.lon) < 0.02;
  const kept = [];
  for (const m of found) {
    const at = kept.findIndex((p) => same(p, m));
    if (at < 0) kept.push(m);
    else if (info[m.id] && (!info[kept[at].id] || info[m.id].sitelinks > info[kept[at].id].sitelinks)) kept[at] = m;
  }
  const reach = (m) => info[m.id]?.sitelinks ?? 0;
  const sorted = kept.sort((a, b) => b.elevation - a.elevation || reach(b) - reach(a) || a.id.localeCompare(b.id));
  // A peak as high as the last one shares its place, so it is in the list too.
  let cut = MOUNTAIN_ROWS;
  while (cut < sorted.length && sorted[cut].elevation === sorted[MOUNTAIN_ROWS - 1].elevation) cut += 1;
  const peaks = sorted.slice(0, cut);
  // A peak with no English name would drop out unnoticed and move every one below it up a place.
  for (const m of peaks) if (!info[m.id]) throw new Error(`wikidata ${m.id}: a ${m.elevation} m peak with no English name`);
  if (peaks.length < MOUNTAIN_ROWS) throw new Error(`wikidata: only ${peaks.length} mountains`);
  if (peaks[0].id !== "Q513") throw new Error(`wikidata: ${peaks[0].id} above Everest`);
  // Peaks of the same height share a place.
  const rows = peaks.map((m, i) => [peaks.findIndex((p) => p.elevation === m.elevation) + 1, m.id, info[m.id].names, m.elevation, m.prominence, m.countries, m.range ? info[m.range].names : null]);
  return { rows, over8000: peaks.filter((m) => m.elevation > 8000).length, ...countryLeaders(rows, 5) };
}

// --- Wikipedia lists: longest rivers, largest lakes, largest islands ---------------------------------------------------

/** The island table only: rows the list links by their province or state, in the island's own name ("海南省" reads "海南岛").
 * Kept out of LABEL_FIX so the state keeps its name anywhere else it appears. */
const ISLAND_NAMES = {
  Q42200: { "zh-CN": "海南岛", "zh-TW": "海南島", ja: "海南島", ko: "하이난섬", vi: "Đảo Hải Nam", id: "Pulau Hainan", es: "Isla de Hainan" },
  Q34366: { "zh-CN": "塔斯马尼亚岛", "zh-TW": "塔斯馬尼亞島", ja: "タスマニア島", ko: "태즈메이니아섬", vi: "Đảo Tasmania", id: "Pulau Tasmania", es: "Isla de Tasmania" },
  Q1460: { ja: "シチリア島" },
  Q1462: { "zh-CN": "撒丁岛", ja: "サルデーニャ島" },
};

/** The desert table only: the list links the Antarctic Desert by Antarctica's geography article, whose item is the continent. */
const DESERT_NAMES = {
  Q51: { en: "Antarctic Desert", "zh-CN": "南极沙漠", "zh-TW": "南極沙漠", ja: "南極砂漠", ko: "남극 사막", vi: "Sa mạc Nam Cực", id: "Gurun Antarktika", es: "Desierto antártico" },
  // Wikidata's Chinese label for the Arctic desert was the German word for "Chinese".
  Q398398: { en: "Arctic Desert", "zh-CN": "北极沙漠", "zh-TW": "北極沙漠", ja: "北極砂漠", ko: "북극 사막", vi: "Sa mạc Bắc Cực", id: "Gurun Arktik", es: "Desierto ártico" },
};

/** Each table: its English Wikipedia list, which of the page's wikitables (`tables`: several read as one, the stadium list is split
 * by capacity), the columns read, and checks on the result. `spans`: the table merges cells, read as a grid. */
const WP_LISTS = {
  "longest-rivers": { page: "List of river systems by length", table: 1, name: 1, value: 2, countries: 7, rows: 100, first: "Q3392" },
  "largest-lakes": { page: "List of lakes by area", table: 1, name: 2, value: 5, countries: 3, depth: 7, type: 4, rows: 40, first: "Q5484" },
  "largest-islands": { page: "List of islands by area", table: 1, name: 1, value: 2, countries: 4, rows: 100, first: "Q223", unlinked: 3 },
  "largest-deserts": { page: "List of deserts by area", table: 0, name: 1, value: 4, countries: 7, desert: 2, rows: 30, first: "Q51", names: DESERT_NAMES, skip: ["Q783129"] },
  "tallest-buildings": { page: "List of tallest buildings", table: 1, spans: true, name: 1, value: 2, countries: 7, city: 6, floors: 4, year: 8, rows: 90, first: "Q12495", unlinked: 6 },
  "largest-cities": { page: "List of largest cities", table: 0, name: 0, value: 2, countries: 1, rows: 80, first: "Q3630" },
  "largest-stadiums": { page: "List of stadiums by capacity", tables: [0, 1, 2, 3, 4, 5], name: 0, value: 1, countries: 3, city: 2, rows: 100, first: "Q3531421" },
};
/** The tables a list is read from, in order. */
const tablesOf = (spec) => spec.tables ?? [spec.table];
const WIKI = "https://en.wikipedia.org/w/api.php";
const KM_PER_MILE = 1.609344;
const KM2_PER_SQ_MI = 2.589988110336;

const decode = (html) => decodeXml(html.replace(/&nbsp;/g, " "));
/** A cell's text without markup or footnote marks ("6,650[3]" → "6,650"). */
const cellText = (html) => decode(html.replace(/<sup[^>]*>.*?<\/sup>/gs, "").replace(/<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, "")).replace(/\[[^\]]*\]/g, "").trim();
const linkTitles = (html) => [...html.matchAll(/<a [^>]*href="\/wiki\/([^"#?]+)"[^>]*>/g)].map((m) => decodeURIComponent(m[1]).replace(/_/g, " ")).filter((t) => !/^(File|Help|Wikipedia|Template):/.test(t));
/** The first number in a cell, in the unit the column is in ("82,100 km2 31,700 sq mi" → 82100). */
function firstNumber(text) {
  const found = text.match(/\d[\d,]*(\.\d+)?/);
  return found ? Number(found[0].replace(/,/g, "")) : null;
}

/** A page's wikitables, found once (the stadium list reads six of them). */
const wikitables = (html) => [...html.matchAll(/<table class="[^"]*wikitable[^"]*".*?<\/table>/gs)].map((m) => m[0]);

/** The data rows of one of a page's wikitables as cells of HTML. With `spans`, a merged cell is copied into every row and column
 * it covers (the building list merges a country shared by the rows below it); without, a table with one is refused. */
function wikitable(tables, index, spans = false) {
  const table = tables[index];
  if (!table) throw new Error(`wikipedia: no table ${index}`);
  // A table inside a cell would end this one at its own </table> and pair the wrong row and cell tags.
  if (/<table/.test(table.slice(1))) throw new Error(`wikipedia: table ${index} has a table inside it`);
  const span = (attrs, name) => Math.min(Number(attrs.match(new RegExp(`\\b${name}="?(\\d+)`))?.[1] ?? 1) || 1, 200);
  const allRows = [...table.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)].map((row) => ({ data: /<td/.test(row[1]), cells: [...row[1].matchAll(/<t[hd]([^>]*)>(.*?)<\/t[hd]>/gs)].map((cell) => ({ attrs: cell[1], html: cell[2] })) }));
  // Header rows (no <td>, repeated down long tables) are left out: "Area (km2)" would read as the number 2.
  if (spans && (/rowspan="?0\b/.test(table) || (table.match(/<tbody/g) ?? []).length > 1)) {
    // A span to the end of a section, or several sections, would need the grid reset at each: not read rather than misread.
    throw new Error(`wikipedia: table ${index} has sections the span reader does not handle`);
  }
  if (!spans) {
    const dataRows = allRows.filter((row) => row.data).map((row) => row.cells);
    // A merged cell in a data row shifts every later cell in the rows it spans: rather than read the wrong column,
    // the table is not published. Header rows (all <th>) may span.
    if (dataRows.some((row) => row.some((cell) => span(cell.attrs, "rowspan") > 1 || span(cell.attrs, "colspan") > 1))) throw new Error(`wikipedia: table ${index} has merged cells`);
    return dataRows.map((row) => row.map((cell) => cell.html));
  }
  // The grid as a reader sees it: a cell carried down from a row above fills its column before the row's own cells are placed.
  // Every row takes part, header rows too, so a merged cell that runs across a repeated header row is counted down there as well.
  const carried = [];
  const grid = allRows.map((row) => {
    const out = [];
    let col = 0;
    const fillCarried = () => {
      while (carried[col]?.left > 0) {
        out[col] = carried[col].html;
        carried[col].left -= 1;
        col += 1;
      }
    };
    for (const cell of row.cells) {
      fillCarried();
      const [down, across] = [span(cell.attrs, "rowspan"), span(cell.attrs, "colspan")];
      for (let i = 0; i < across; i += 1) {
        out[col] = cell.html;
        if (down > 1) carried[col] = { html: cell.html, left: down - 1 };
        col += 1;
      }
    }
    fillCarried();
    // A span reaching past the row's last own cell still fills its column.
    for (let c = col; c < carried.length; c += 1) {
      if (carried[c]?.left > 0) {
        out[c] = carried[c].html;
        carried[c].left -= 1;
      }
    }
    return { data: row.data, cells: Array.from(out, (cell) => cell ?? "") };
  });
  return grid.filter((row) => row.data).map((row) => row.cells);
}

/** Wikidata ids for English Wikipedia titles, following redirects. */
async function titleIds(titles) {
  const out = {};
  const unique = [...new Set(titles)];
  for (let i = 0; i < unique.length; i += 50) {
    const q = new URLSearchParams({ action: "query", prop: "pageprops", ppprop: "wikibase_item", redirects: "1", titles: unique.slice(i, i + 50).join("|"), format: "json", formatversion: "2" });
    const data = JSON.parse(await get(`${WIKI}?${q}`));
    if (data.error || !data.query) throw new Error(`wikipedia titles: ${data.error?.info ?? "no query result"} (${unique.slice(i, i + 50).join(", ").slice(0, 120)})`);
    const renamed = new Map();
    // A redirect to a section ("X Island" → "Some Archipelago#X Island") is a part of that page: no item of its own.
    const toSection = new Set((data.query.redirects ?? []).filter((step) => step.tofragment).map((step) => step.from));
    for (const step of [...(data.query.normalized ?? []), ...(data.query.redirects ?? [])]) renamed.set(step.from, step.to);
    const ids = new Map(data.query.pages.filter((page) => page.pageprops?.wikibase_item).map((page) => [page.title, page.pageprops.wikibase_item]));
    for (const title of unique.slice(i, i + 50)) {
      let at = title;
      let section = false;
      for (let hop = 0; hop < 3 && renamed.has(at); hop += 1) {
        section ||= toSection.has(at);
        at = renamed.get(at);
      }
      if (ids.has(at) && !section) out[title] = ids.get(at);
    }
    await pause();
  }
  return out;
}

/** Which of these items are countries: an ISO 3166 code where they have one, else true for a state without one (the Danish Realm).
 * Anything else a country cell links (a "China–India relations" article, or Scotland, a "country" within another) is not a country. */
async function countryCodes(ids) {
  if (!ids.length) return {};
  const query = `SELECT ?c (SAMPLE(?code) AS ?iso) (COUNT(?t) AS ?state) WHERE { VALUES ?c { ${ids.map((id) => `wd:${id}`).join(" ")} }
  FILTER NOT EXISTS { ?c wdt:P576 [] }
  OPTIONAL { ?c wdt:P297 ?code }
  OPTIONAL { ?c wdt:P31 ?t . VALUES ?t { wd:Q3624078 wd:Q6256 wd:Q7275 wd:Q15634554 } FILTER NOT EXISTS { ?c wdt:P17 ?up . FILTER(?up != ?c) } } } GROUP BY ?c`;
  const out = {};
  for (const b of await sparql(query)) {
    const id = qid(b.c.value);
    // Antarctica has a code (AQ) but is no country: its islands and lakes show none.
    if (b.iso?.value === "AQ") continue;
    if (b.iso) out[id] = b.iso.value;
    else if (Number(b.state.value) > 0) out[id] = true;
  }
  return out;
}

/** Country cell → titles: its links and its comma-separated names ("Russia (97%), Mongolia (2.9%)"), as a cell often mixes the two.
 * A name that is no page, or no country, drops out later. */
function countryTitles(html) {
  // Brackets first ("Russia (Siberia, Yakutia)"), then commas; a part with "and" is tried whole too ("Bosnia and Herzegovina").
  const parts = cellText(html).replace(/\([^)]*\)/g, "").split(/[,;\n]/).map((part) => part.trim()).filter((part) => part && part.length < 60);
  const names = parts.flatMap((part) => (/ and /.test(part) ? [part, ...part.split(/ and /).map((p) => p.trim())] : [part]));
  return [...new Set([...linkTitles(html), ...names])];
}

/** A city cell's first part, its whole text, and the page its link names when the link is on that first part: a link can cover
 * "Ann Arbor, Michigan", or a word of it ("[Shenzhen] (Futian)", "Downtown [Dubai]"), but not the state alone ("Ann Arbor, [Michigan]"). */
function cityOfCell(html) {
  const cellWhole = cellText(html);
  const cityText = cellWhole.split(/[,\n]/)[0].trim();
  const links = [...html.matchAll(/<a [^>]*href="\/wiki\/([^"#?]+)"[^>]*>(.*?)<\/a>/gs)].filter((m) => !/^(File|Image|Help|Wikipedia|Template|Special):/.test(decodeURIComponent(m[1])));
  const own = links.find((m) => {
    const text = cellText(m[2]).split(/[,\n]/)[0].trim();
    return text && (text === cityText || cityText.includes(text));
  });
  return { city: own ? decodeURIComponent(own[1]).replace(/_/g, " ") : null, cityText, cellWhole };
}

/** The list's desert types: polar, subtropical, tropical ("Tropical/subtropical" too), cold winter, coastal (cool or mild);
 * anything else is no type. */
function desertOf(text) {
  if (/polar/i.test(text)) return "polar";
  if (/cold/i.test(text)) return "cold";
  if (/coast/i.test(text)) return "coastal";
  if (/^\s*tropic/i.test(text)) return "tropical";
  if (/subtropic/i.test(text)) return "subtropical";
  return null;
}

/** "Fresh", "Saline 1.2%", "Salt", "Brackish"; a cell naming both (fresh in one part, salt in another) or "Variable" varies. */
function waterOf(text) {
  const fresh = /fresh/i.test(text);
  const salt = /salin|salt|brackish/i.test(text);
  if (fresh && !salt) return "fresh";
  if (salt && !fresh) return "saline";
  // Both named, or the cell speaks of a varying lake ("Variable: …"); an empty or unknown cell is no water type at all.
  return fresh || /vari/i.test(text) ? "variable" : null;
}

/** Islands a list links by their state, province or country (an island country counts as an island in Wikidata, so every row is asked):
 * the island item Wikidata places them on (P706), named like them. */
async function islandItems(ids) {
  // Two small queries: the subclass walk over every candidate at once times the query service out.
  const pairs = await sparql(`SELECT ?c ?i WHERE { VALUES ?c { ${ids.map((id) => `wd:${id}`).join(" ")} }
  ?c wdt:P706 ?i . FILTER(?i != ?c)
  ?c rdfs:label ?cl FILTER(LANG(?cl) IN ("en", "mul")) ?i rdfs:label ?il FILTER(LANG(?il) IN ("en", "mul"))
  FILTER(STRSTARTS(LCASE(?il), LCASE(?cl))) }`);
  const candidates = [...new Set(pairs.map((b) => qid(b.i.value)))];
  if (!candidates.length) return {};
  const islands = new Set((await sparql(`SELECT DISTINCT ?i WHERE { VALUES ?i { ${candidates.map((id) => `wd:${id}`).join(" ")} } ?i wdt:P31/wdt:P279* wd:Q23442 . }`)).map((b) => qid(b.i.value)));
  const out = {};
  for (const b of pairs) {
    const [c, i] = [qid(b.c.value), qid(b.i.value)];
    if (islands.has(i)) (out[c] ??= []).push(i);
  }
  return out;
}

async function wikipediaList(id) {
  const spec = WP_LISTS[id];
  const q = new URLSearchParams({ action: "parse", page: spec.page, prop: "text|revid", redirects: "1", format: "json", formatversion: "2" });
  const page = JSON.parse(await get(`${WIKI}?${q}`));
  if (page.error) throw new Error(`wikipedia ${spec.page}: ${page.error.info}`);
  const tables = wikitables(page.parse.text);
  const cells = tablesOf(spec).flatMap((index) => wikitable(tables, index, spec.spans));
  const needs = Math.max(spec.name, spec.value, spec.countries, spec.depth ?? 0, spec.type ?? 0, spec.desert ?? 0, spec.city ?? 0, spec.floors ?? 0, spec.year ?? 0) + 1;
  const parsed = [];
  for (const row of cells) {
    if (row.length < needs) continue;
    const value = firstNumber(cellText(row[spec.value]));
    // The main island of a country links its geography article ("Geography of Madagascar"): the item is the place itself.
    // The first link names the row; if it is red (no page), the cell's next link (its archipelago, say) is not the row's item.
    // A link to a section of another page ("Kerguelen Islands#Grande Terre") names a part of it: no item of its own either.
    // The first anchor that could name the row: an article, red or section link (not a file, help, interwiki or external link).
    const firstLink = [...row[spec.name].matchAll(/<a [^>]*>/g)].map((m) => m[0]).find((a) => /class="new"|redlink=1/.test(a) || (/href="\/wiki\//.test(a) && !/href="\/wiki\/(File|Image|Help|Wikipedia|Template|Special):/.test(a))) ?? "";
    const title = /redlink=1|class="new"|href="[^"]*#/.test(firstLink) ? null : linkTitles(row[spec.name])[0]?.replace(/^Geography of (the )?/, "") ?? null;
    if (!value) continue;
    const lines = cellText(row[spec.name]).split("\n").map((line) => line.trim()).filter(Boolean);
    // An unlinked row keeps its qualifier ("Grande Terre (Kerguelen)"), so two of one name can be told apart.
    const name = title ? lines[0] : lines.join(" ");
    parsed.push({
      // No link (an unnamed Antarctic island): kept, with no item and its English name.
      title,
      name,
      value,
      // A river system ("Mississippi–Missouri–Jefferson…") is named after its main river, with the whole course alongside.
      // Written with en dashes or hyphens ("Padma-Ganges-Alaknanda"): more than one linked river means a system.
      system: id === "longest-rivers" && linkTitles(row[spec.name]).length > 1 && /[–-]/.test(name) ? name.replace(/\s*\(.*\)\s*$/, "") : null,
      countries: countryTitles(row[spec.countries]),
      depth: spec.depth === undefined ? undefined : firstNumber(cellText(row[spec.depth])),
      type: spec.type === undefined ? undefined : waterOf(cellText(row[spec.type])),
      desert: spec.desert === undefined ? undefined : desertOf(cellText(row[spec.desert])),
      // The city a building or stadium stands in: the cell's first part ("Ann Arbor, Michigan" → Ann Arbor), by the link written
      // on that part only, as a cell can link just its state ("Ann Arbor, [Michigan]"). The list links a city once and writes it
      // plain in the rows after: those are filled in below.
      ...(spec.city === undefined ? {} : { ...cityOfCell(row[spec.city]), countryText: cellText(row[spec.countries]) }),
      // "163 (+ 2 below ground)": floors above ground.
      floors: spec.floors === undefined ? undefined : firstNumber(cellText(row[spec.floors])),
      year: spec.year === undefined ? undefined : firstNumber(cellText(row[spec.year])),
    });
  }
  // A city written plain is the one linked under the same whole cell text ("Columbia, Missouri" is not "Columbia, South
  // Carolina") in a row of the same country (Athens, Georgia is not Athens, Greece); one never linked there has no city.
  const cityKey = (row) => `${row.cellWhole}\u0000${row.countryText}`;
  const cityTitles = new Map(parsed.filter((row) => row.city).map((row) => [cityKey(row), row.city]));
  for (const row of parsed) if (spec.city !== undefined && !row.city) row.city = cityTitles.get(cityKey(row)) ?? null;

  // Each row's item first (to drop repeats and cut the list), then names and countries for the kept rows only.
  // Only rows near the top can make the list (a repeat dropped below moves at most a few up): the rest are not looked up.
  parsed.sort((a, b) => b.value - a.value);
  parsed.splice(spec.rows + 50);
  const itemOf = await titleIds(parsed.map((row) => row.title).filter(Boolean));
  // A linked page with no Wikidata item (a new article) has no id: like an unlinked row, refused below only if it makes the list.
  for (const row of parsed) row.item = (row.title && itemOf[row.title]) || "";
  // A list's aggregate rows (all of Australia's deserts as one) would count their parts twice. One no longer found means the
  // list changed how it links it: the table is refused rather than let the aggregate back in unnoticed.
  for (const skipped of spec.skip ?? []) if (!parsed.some((row) => row.item === skipped)) throw new Error(`wikipedia ${spec.page}: skipped row ${skipped} not found`);
  // A river listed twice (its whole system and an upper course, say) keeps its longest entry.
  const seen = new Set();
  const sorted = parsed.filter((row) => !spec.skip?.includes(row.item) && (!row.item || (!seen.has(row.item) && seen.add(row.item))));
  if (sorted[0]?.item !== spec.first) throw new Error(`wikipedia ${spec.page}: ${sorted[0]?.name} first`);
  // A pool a little past the cut: an island remap below can merge two rows, and the next one then moves up.
  const kept = sorted.slice(0, spec.rows + 10);
  const countryOf = await titleIds(kept.flatMap((row) => row.countries));
  const countryIds = [...new Set(Object.values(countryOf))];
  const codes = await countryCodes(countryIds);
  const keptIds = [...new Set(kept.map((row) => row.item).filter(Boolean))];
  const cityOf = spec.city === undefined ? {} : await titleIds(kept.map((row) => row.city).filter(Boolean));
  const info = await labels([...new Set([...keptIds, ...Object.values(cityOf), ...countryIds.filter((c) => codes[c] === true)])]);
  // A list's own name fixes (the Antarctic Desert, linked by its continent), on the row's item only.
  for (const [c, fix] of Object.entries(spec.names ?? {})) if (info[c] && keptIds.includes(c)) info[c] = { ...info[c], own: { ...info[c].own, ...fix }, names: localeNames({ ...info[c].own, ...fix }) };
  // Islands: a row the list links by its state or country takes the island's own item, and its names where the island has them
  // ("中華民國" gives way to "臺灣島"); the state's names fill the rest, and an island-name fix on the state still wins.
  if (id === "largest-islands") {
    // Island-name fixes go on the state's names once, before any remap below, so both paths carry them.
    for (const [c, fix] of Object.entries(ISLAND_NAMES)) if (info[c]) info[c] = { ...info[c], own: { ...info[c].own, ...fix }, names: localeNames({ ...info[c].own, ...fix }) };
    const candidates = await islandItems(keptIds);
    const candidateInfo = await labels([...new Set(Object.values(candidates).flat())]);
    for (const [c, options] of Object.entries(candidates)) {
      const island = options.filter((i) => candidateInfo[i]).sort((a, b) => candidateInfo[b].sitelinks - candidateInfo[a].sitelinks)[0];
      if (!island || !info[c]) continue;
      // The island's own names, then the state's for locales the island has none in, then the fixes.
      const merged = { ...info[c].own, ...candidateInfo[island].own, ...ISLAND_NAMES[c] };
      info[island] = { names: localeNames(merged), own: merged, sitelinks: info[c].sitelinks };
      for (const row of kept) if (row.item === c) row.item = island;
    }
  }
  // Two rows that turn out to be one island (a province and the island itself): the larger entry stays.
  for (let i = kept.length - 1; i >= 0; i -= 1) {
    if (kept[i].item && kept.slice(0, i).some((row) => row.item === kept[i].item)) kept.splice(i, 1);
  }
  // The cut, with every row tied with the last.
  let cut = Math.min(spec.rows, kept.length);
  while (cut < kept.length && kept[cut].value === kept[cut - 1].value) cut += 1;
  kept.splice(cut);
  if (kept.length < spec.rows) throw new Error(`wikipedia ${spec.page}: only ${kept.length} rows`);
  // Unlinked rows: an unnamed island or a new tower with no article yet is real, a few of them (`unlinked`); elsewhere, or more,
  // the name column was misread.
  const unlinked = kept.filter((row) => !row.item);
  if (unlinked.length > (spec.unlinked ?? 0)) throw new Error(`wikipedia ${spec.page}: ${unlinked.map((row) => row.name).join(", ")} has no linked name`);
  const rows = kept.map((row) => {
    const item = row.item;
    if (item && !info[item]) throw new Error(`wikidata ${item} (${row.title}): no English name`);
    // A country link that resolves to nothing (a dependency's own page, say) is left out rather than shown raw.
    const countries = [...new Set(row.countries.map((title) => countryOf[title]).filter((c) => codes[c]))].map((c) => (codes[c] === true ? info[c]?.names : codes[c])).filter(Boolean);
    const place = kept.findIndex((other) => other.value === row.value) + 1;
    const base = [place, item, item ? info[item].names : { en: row.name }, row.value, countries];
    if (id === "longest-rivers") return [...base, row.system];
    if (id === "largest-lakes") return [...base, row.depth ?? null, row.type];
    if (id === "largest-deserts") return [...base, row.desert];
    // A city with no item or no English name shows a dash rather than a raw title.
    const city = row.city && cityOf[row.city] ? cityNames(info[cityOf[row.city]]?.own) : null;
    if (id === "tallest-buildings") return [...base, row.floors ?? null, city, row.year ?? null];
    if (id === "largest-stadiums") return [...base, city];
    return base;
  });
  return { rows, revision: page.parse.revid };
}

/** A city's names without the qualifier some labels carry ("科利奇镇区 (宾夕法尼亚州森特县)", "Columbus, Ohio"); a comma the
 * English name has too is part of the name ("Washington, D.C."). */
function cityNames(own) {
  if (!own) return null;
  const comma = /,\s/.test(own.en ?? "");
  const bare = Object.fromEntries(Object.entries(own).map(([locale, name]) => [locale, (comma ? name : name.replace(/,\s.*$/, "")).replace(/\s*[(（][^()（）]*[)）]\s*$/, "")]));
  return localeNames(bare);
}

/** The country, or countries tied (all named), with the most rows; ISO codes only (a named realm is not counted).
 * None at all means the country column was misread: the table is not published. */
function countryLeaders(rows, column) {
  const tally = new Map();
  for (const row of rows) for (const c of row[column]) if (typeof c === "string") tally.set(c, (tally.get(c) ?? 0) + 1);
  const count = Math.max(0, ...tally.values());
  if (!count) throw new Error("no countries in the rows");
  return { countryLead: [...tally.entries()].filter(([, n]) => n === count).map(([c]) => c).sort(), countryCount: count };
}

// --- Write ---------------------------------------------------------------------------------------------------------

const rows = {};
const meta = { updated: today.toISOString().slice(0, 10), sets: {} };
const rowsPath = join(root, "src/shared/rankings-rows.json");
/** Place rows (names in eight languages) are most of the bytes: one file per table, so a page loads only its own.
 * The ids must match the place tables in src/shared/rankings.ts, isPlaceRanking: the geography and cities groups (tests/rankings.test.ts checks). */
const geoDir = join(root, "src/shared/rankings-geo");
const GEO_IDS = new Set(["tallest-mountains", ...Object.keys(WP_LISTS)]);
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

const readRows = (path) => (existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {});
const oldRows = { ...readRows(rowsPath), ...Object.fromEntries([...GEO_IDS].map((id) => [id, readRows(join(geoDir, `${id}.json`))]).filter(([, table]) => Array.isArray(table))) };
const oldMeta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, "utf8")) : { sets: {} };
const keep = (id) => {
  rows[id] = oldRows[id];
  meta.sets[id] = oldMeta.sets[id];
};
rmSync(FAILURES_FILE, { force: true });
let attempts = 0;
let failures = 0;
/** RANKINGS_ONLY=id,id refreshes just those tables (skipping their monthly wait) and keeps the rest as they are, for a new or fixed table. */
// "memes" belongs to scripts/fetch-meme.mjs (same workflow input), not to a table here.
const listed = process.env.RANKINGS_ONLY?.split(",").map((id) => id.trim()).filter((id) => id && id !== "memes");
// Set but empty (an unfilled input) means every table, not none.
const only = listed?.length ? listed : undefined;
if (!listed?.length && process.env.RANKINGS_ONLY?.split(",").some((id) => id.trim() === "memes")) {
  // Only "memes" was asked for: that is scripts/fetch-meme.mjs's job, so leave every table as it is.
  console.log("RANKINGS_ONLY names no rankings table; nothing to refresh here.");
  process.exit(0);
}
/** One source failing keeps its last good tables, so it cannot hold back the others. With no earlier data there is nothing to keep. */
async function attempt(ids, fetchTables) {
  if (only && !ids.some((id) => only.includes(id))) {
    const missing = ids.filter((id) => !oldRows[id]);
    if (missing.length) throw new Error(`RANKINGS_ONLY: ${missing.join(", ")} has no earlier data to keep; list it too`);
    ids.forEach(keep);
    return;
  }
  attempts += 1;
  try {
    await fetchTables();
    // The day the source was last asked and answered. A kept table (failed, or not due) keeps its old day.
    for (const id of ids) if (meta.sets[id]) meta.sets[id].checkedOn = meta.updated;
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
  });
}
await attempt(["ai-usage", "ai-companies"], async () => {
  const or = await openRouter();
  rows["ai-usage"] = or.usage.rows;
  meta.sets["ai-usage"] = { asOf: or.usage.asOf, citedAt: or.citedAt, rows: or.usage.rows.length, top: topOf(or.usage.rows, 1, 4) };
  rows["ai-companies"] = or.authors.rows;
  meta.sets["ai-companies"] = { asOf: or.authors.asOf, citedAt: or.citedAt, rows: or.authors.rows.length, top: topOf(or.authors.rows, 1, 3) };
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
});
const month = lastMonth();
// The Pink Sheet comes out early each month: nothing to ask for until a new month is due.
if (!process.env.FORCE_COMMODITIES && !only?.includes("commodity-prices") && oldMeta.sets["commodity-prices"]?.asOf === month && oldRows["commodity-prices"]) keep("commodity-prices");
else {
  await attempt(["commodity-prices"], async () => {
    const set = await commodities();
    rows["commodity-prices"] = set.rows;
    meta.sets["commodity-prices"] = { asOf: set.asOf, rows: set.rows.length, top: topOf(set.rows, 1, 5), bottom: set.rows.slice(-3).reverse().map((r) => [r[1], r[5]]) };
  });
}

// Heights change only with a new survey: asked once a month (until a check succeeds). FORCE_MOUNTAINS=1 (or FORCE_GEO=1, every place table: geography, cities and buildings) asks again.
// asOf is the month the rows last changed; checked is the month they were last asked for.
const thisMonth = today.toISOString().slice(0, 7);
if (!process.env.FORCE_MOUNTAINS && !process.env.FORCE_GEO && !only?.includes("tallest-mountains") && oldMeta.sets["tallest-mountains"]?.checked === thisMonth && oldRows["tallest-mountains"]) keep("tallest-mountains");
else {
  await attempt(["tallest-mountains"], async () => {
    const set = await mountains();
    rows["tallest-mountains"] = set.rows;
    const unchanged = JSON.stringify(oldRows["tallest-mountains"]) === JSON.stringify(set.rows);
    meta.sets["tallest-mountains"] = { asOf: (unchanged && oldMeta.sets["tallest-mountains"]?.asOf) || thisMonth, checked: thisMonth, rows: set.rows.length, top: topOf(set.rows, 1, 3), bottom: [[set.rows.at(-1)[1], set.rows.at(-1)[3]]], lowRank: set.rows.at(-1)[0], over8000: set.over8000, countryLead: set.countryLead, countryCount: set.countryCount, names: Object.fromEntries([...set.rows.slice(0, 3), set.rows.at(-1)].map((r) => [r[1], r[2]])) };
  });
}

// Wikipedia lists change with an edit now and then: asked monthly like the mountains.
for (const id of Object.keys(WP_LISTS)) {
  if (!process.env.FORCE_GEO && !only?.includes(id) && oldMeta.sets[id]?.checked === thisMonth && oldRows[id]) {
    keep(id);
    continue;
  }
  await attempt([id], async () => {
    const set = await wikipediaList(id);
    rows[id] = set.rows;
    const unchanged = JSON.stringify(oldRows[id]) === JSON.stringify(set.rows);
    const last = set.rows.at(-1);
    // An edit elsewhere on the page moves its revision: the old one is still the citation for unchanged rows (and no commit follows).
    // Summary rows are keyed by item; an unlinked island by its row ("#77"), unique even when two tie for a place.
    const key = (r) => r[1] || `#${set.rows.indexOf(r) + 1}`;
    meta.sets[id] = { asOf: (unchanged && oldMeta.sets[id]?.asOf) || thisMonth, checked: thisMonth, revision: (unchanged && oldMeta.sets[id]?.revision) || set.revision, rows: set.rows.length, top: set.rows.slice(0, 3).map((r) => [key(r), r[3]]), bottom: [[key(last), last[3]]], lowRank: last[0], ...countryLeaders(set.rows, 4), names: Object.fromEntries([...set.rows.slice(0, 3), last].map((r) => [key(r), r[2]])) };
    console.log(id, set.rows.length, "rows, revision", set.revision);
  });
}

for (const [id, spec] of Object.entries(SHARE)) {
  // StatCounter publishes monthly: nothing to ask for until a new month is due.
  // FORCE_SHARE=1 asks again, for a fix to names or filters.
  if (!process.env.FORCE_SHARE && !only?.includes(id) && oldMeta.sets[id]?.asOf === month && oldRows[id]) {
    keep(id);
    continue;
  }
  await attempt([id], async () => {
    const set = await shareTable(spec, month);
    rows[id] = set.rows;
    meta.sets[id] = { asOf: set.asOf, yearAgo: set.yearAgo, rows: set.rows.length, top: topOf(set.rows, 1, 3), leaders: set.leaders };
    console.log(id, set.asOf, set.rows.length, "rows");
  });
}
if (attempts && failures === attempts) throw new Error("every source failed");
// Every table has passed through keep() or attempt() by now: an id still missing is a typo, and nothing is written.
const unknown = only?.filter((id) => !(id in meta.sets));
if (unknown?.length) throw new Error(`RANKINGS_ONLY: no table ${unknown.join(", ")}`);

// A table's date moves only when its rows changed, so a monthly table never claims a daily update.
for (const [id, set] of Object.entries(meta.sets)) {
  const same = oldMeta.sets[id]?.updated && oldMeta.sets[id].asOf === set.asOf && JSON.stringify(oldRows[id]) === JSON.stringify(rows[id]);
  set.updated = same ? oldMeta.sets[id].updated : meta.updated;
  // Same data: the file stays, so a re-run with only a newer citation time makes no commit.
  if (NO_CSV.has(id)) continue;
  // Built from the rows every run, kept tables too, so a format change reaches every file at once.
  csv[id] = csvOf(id, rows[id], set);
  // OpenRouter's citation time changes on every call; it alone is not a change worth a commit.
  const file = join(root, "public/rankings", `${id}.csv`);
  const plain = (text) => text.replace(/as of [0-9T:.\-]+Z/g, "as of");
  if (same && existsSync(file) && plain(readFileSync(file, "utf8")) === plain(csv[id])) delete csv[id];
}
meta.updated = Object.values(meta.sets).map((set) => set.updated).sort().at(-1);
writeFileSync(rowsPath, `${JSON.stringify(Object.fromEntries(Object.entries(rows).filter(([id]) => !GEO_IDS.has(id))))}\n`);
mkdirSync(geoDir, { recursive: true });
for (const id of GEO_IDS) if (rows[id]) writeFileSync(join(geoDir, `${id}.json`), `${JSON.stringify(rows[id])}\n`);
writeFileSync(metaPath, `${JSON.stringify(meta, null, 1)}\n`);
const dir = join(root, "public/rankings");
mkdirSync(dir, { recursive: true });
for (const [id, text] of Object.entries(csv)) writeFileSync(join(dir, `${id}.csv`), text);
console.log("wrote src/shared/rankings-rows.json, rankings-geo/, rankings-meta.json and public/rankings");
