// Snapshots the live data behind /{locale}/memes/ pages into src/shared/meme-data.json.
// Run daily by .github/workflows/refresh-rankings.yml, or by hand (`node scripts/fetch-meme.mjs`). Pages never call these sources.
//   Wikimedia pageviews (CC0): weekly views of each meme's Wikipedia article, the "how hot is it now" curve
//   CoinMarketCap API (free Basic plan, needs COINMARKETCAP_API_KEY; no redistribution, so no CSV): coins named after a meme
// Which article and which coin belong to an entry is fixed by hand in src/shared/meme-sources.json.
// A source that fails keeps its last good data and is listed in RANKINGS_FAILURES_FILE, which turns the run red.
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FAILURES_FILE = process.env.RANKINGS_FAILURES_FILE ?? join(tmpdir(), "rankings-failures.txt");
const UA = "cv.cm meme snapshot (https://cv.cm/)";
const SOURCES = JSON.parse(readFileSync(join(root, "src/shared/meme-sources.json"), "utf8"));
const OUT = join(root, "src/shared/meme-data.json");
const WEEKS = 13;
/** A coin is shown only when it is this big and this old: new or tiny tokens are where most rug pulls are. */
const COIN_MIN_CAP = 10_000_000;
const COIN_MIN_AGE_DAYS = 30;

const old = (() => {
  try {
    return JSON.parse(readFileSync(OUT, "utf8"));
  } catch {
    return { trend: {}, coins: {}, coinsAsOf: null };
  }
})();
const failures = [];

async function getJson(url, headers = {}) {
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch(url, { headers: { "User-Agent": UA, ...headers }, signal: AbortSignal.timeout(60_000) }).catch((error) => ({ ok: false, status: 0, error }));
    if (res.ok) return res.json();
    if (res.status === 404) return null;
    if (attempt >= 3) throw new Error(`${res.status || res.error?.message} ${url}`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}

const day = (d) => d.toISOString().slice(0, 10);
const compact = (d) => day(d).replaceAll("-", "");

/**
 * The last day whose pageviews Wikimedia has published: the most recent Sunday, or the one before when that Sunday's
 * daily figures are not out yet (a Monday-morning run). Checked once on the busiest article, because a quiet article
 * simply has no row for a day with no views, which must not be read as "not published".
 */
async function lastPublishedSunday() {
  const now = new Date();
  const sunday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 7) % 7 || 7)));
  const probe = await getJson(`https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/Main_Page/daily/${compact(sunday)}/${compact(sunday)}`);
  return probe?.items?.length ? sunday : new Date(sunday.getTime() - 7 * 86_400_000);
}

/**
 * WEEKS full weeks (Monday to Sunday, UTC) of views ending on `end`, oldest first, and a direction: "up" when the last
 * four weeks are a quarter above the four before, "down" when a fifth below, else "flat".
 */
async function trendOf(wiki, end) {
  const [lang, ...rest] = wiki.split(":");
  const title = encodeURIComponent(rest.join(":").replaceAll(" ", "_"));
  const start = new Date(end.getTime() - (WEEKS * 7 - 1) * 86_400_000);
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${lang}.wikipedia.org/all-access/user/${title}/daily/${compact(start)}/${compact(end)}`;
  const body = await getJson(url);
  if (!body) throw new Error(`no pageviews for ${wiki}`);
  const byDay = new Map(body.items.map((item) => [item.timestamp.slice(0, 8), item.views]));
  const weeks = Array.from({ length: WEEKS }, (_, w) => {
    let sum = 0;
    for (let d = 0; d < 7; d += 1) sum += byDay.get(compact(new Date(start.getTime() + (w * 7 + d) * 86_400_000))) ?? 0;
    return sum;
  });
  const recent = weeks.slice(-4).reduce((a, b) => a + b, 0);
  const before = weeks.slice(-8, -4).reduce((a, b) => a + b, 0);
  const dir = before === 0 ? (recent > 0 ? "up" : "flat") : recent >= before * 1.25 ? "up" : recent <= before * 0.8 ? "down" : "flat";
  return { w: weeks, dir, to: day(end) };
}

const trend = {};
const end = await lastPublishedSunday().catch((error) => {
  failures.push(`meme trend: ${error.message}`);
  return null;
});
for (const [id, src] of Object.entries(SOURCES)) {
  if (!src.wiki) continue;
  try {
    if (!end) throw new Error("pageviews unavailable");
    trend[id] = await trendOf(src.wiki, end);
  } catch (error) {
    failures.push(`meme trend ${id}: ${error.message}`);
    if (old.trend?.[id]) trend[id] = old.trend[id];
  }
}

let coins = old.coins ?? {};
let coinsAsOf = old.coinsAsOf ?? null;
const coinIds = Object.entries(SOURCES).filter(([, src]) => src.coin).map(([id, src]) => [id, src.coin]);
const key = process.env.COINMARKETCAP_API_KEY;
if (!key) {
  failures.push("meme coins: COINMARKETCAP_API_KEY is not set");
} else if (coinIds.length) {
  try {
    const ids = [...new Set(coinIds.map(([, coin]) => coin))].join(",");
    const body = await getJson(`https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?id=${ids}&convert=USD`, { "X-CMC_PRO_API_KEY": key });
    if (body?.status?.error_code) throw new Error(body.status.error_message);
    const next = {};
    const now = Date.now();
    for (const [id, coin] of coinIds) {
      const c = body.data?.[String(coin)];
      const usd = c?.quote?.USD;
      if (!c || !usd) continue;
      const age = (now - Date.parse(c.date_added)) / 86_400_000;
      if (!(usd.market_cap >= COIN_MIN_CAP) || age < COIN_MIN_AGE_DAYS) continue;
      if (![usd.price, usd.percent_change_24h, usd.percent_change_7d].every(Number.isFinite)) continue;
      next[id] = {
        cmc: c.id,
        slug: c.slug,
        symbol: c.symbol,
        name: c.name,
        price: Number(usd.price.toPrecision(4)),
        cap: Math.round(usd.market_cap),
        d1: Math.round(usd.percent_change_24h * 10) / 10,
        d7: Math.round(usd.percent_change_7d * 10) / 10,
        added: c.date_added.slice(0, 10),
        rank: c.cmc_rank ?? null,
      };
    }
    coins = next;
    coinsAsOf = new Date().toISOString().slice(0, 16) + "Z";
  } catch (error) {
    failures.push(`meme coins: ${error.message}`);
  }
}

// No run date in the file: unchanged figures leave it byte-identical, so the workflow commits and deploys only real changes.
const data = { trend, coins, coinsAsOf };
writeFileSync(OUT, `${JSON.stringify(data, null, 1)}\n`);
console.log(`meme: ${Object.keys(trend).length} trends, ${Object.keys(coins).length} coins`);
if (failures.length) {
  appendFileSync(FAILURES_FILE, `${failures.join("\n")}\n`);
  console.error(failures.join("\n"));
}
