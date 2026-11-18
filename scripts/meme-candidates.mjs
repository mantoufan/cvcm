// Suggests memes and songs to write up next for /{locale}/memes/: an editorial shortlist, never shown on the site.
// Run weekly by .github/workflows/meme-candidates.yml (the list lands in the run summary and in one GitHub issue), or by
// hand: `node scripts/meme-candidates.mjs [--tiktok]`.
//   Wikipedia (CC BY-SA titles, CC0 pageviews): every article in "Internet memes introduced in <this year / last year>"
//   that src/shared/meme-sources.json does not track yet, ranked by views over the last four weeks.
//   --tiktok (local only, needs SCRAPECREATORS_API_KEY; 1 credit per region): hashtags and sounds in TikTok's trending
//   feed. A third-party scrape, so it is only read here as a hint and never published.
// Next step for a candidate is a Keyword Planner check, then an entry (see .slang-work/SPEC.md).
import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const UA = "cv.cm meme candidates (https://cv.cm/)";
const SOURCES = JSON.parse(readFileSync(join(root, "src/shared/meme-sources.json"), "utf8"));
const LIMIT = 40;
const TIKTOK_REGIONS = ["US", "ID", "VN"];

async function getJson(url, headers = {}) {
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch(url, { headers: { "User-Agent": UA, ...headers }, signal: AbortSignal.timeout(60_000) }).catch((error) => ({ ok: false, status: 0, error }));
    if (res.ok) return res.json();
    if (res.status === 404) return null;
    if (attempt >= 3 || (res.status >= 400 && res.status < 500 && res.status !== 429)) throw new Error(`${res.status || res.error?.message} ${url}`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}

const day = (d) => d.toISOString().slice(0, 10).replaceAll("-", "");
const key = (title) => title.replaceAll(" ", "_");

/** Articles (namespace 0) in a category, following continuation. */
async function categoryPages(category) {
  const titles = [];
  let cont = "";
  do {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=${encodeURIComponent(category)}&cmnamespace=0&cmlimit=500&format=json${cont}`;
    const body = await getJson(url);
    titles.push(...(body?.query?.categorymembers ?? []).map((m) => m.title));
    cont = body?.continue?.cmcontinue ? `&cmcontinue=${encodeURIComponent(body.continue.cmcontinue)}` : "";
  } while (cont);
  return titles;
}

/** Views in the 28 days up to yesterday, and in the 28 days before. */
async function views(title) {
  const end = new Date(Date.now() - 86_400_000);
  const start = new Date(end.getTime() - 55 * 86_400_000);
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/${encodeURIComponent(key(title))}/daily/${day(start)}/${day(end)}`;
  const items = (await getJson(url))?.items ?? [];
  const cut = day(new Date(end.getTime() - 27 * 86_400_000));
  let recent = 0;
  let prior = 0;
  for (const item of items) {
    if (item.timestamp.slice(0, 8) >= cut) recent += item.views;
    else prior += item.views;
  }
  return { recent, prior };
}

/** Run `fn` over `list` with a few requests in flight (Wikimedia asks clients to keep it modest). */
async function pool(list, fn, size = 4) {
  const out = new Array(list.length);
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < list.length) {
      const i = next++;
      out[i] = await fn(list[i]);
    }
  }));
  return out;
}

async function wikipediaCandidates() {
  const year = new Date().getUTCFullYear();
  const tracked = new Set(Object.values(SOURCES).flatMap((s) => (s.wiki?.startsWith("en:") ? [key(s.wiki.slice(3))] : [])));
  const titles = [...new Set((await Promise.all([year, year - 1].map((y) => categoryPages(`Category:Internet memes introduced in ${y}`)))).flat())]
    .filter((title) => !tracked.has(key(title)));
  const counts = await pool(titles, views);
  return titles
    .map((title, i) => ({ title, ...counts[i] }))
    .sort((a, b) => b.recent - a.recent)
    .slice(0, LIMIT);
}

/** Hashtags and sounds seen in TikTok's trending feed, most frequent first. */
async function tiktokHints(apiKey) {
  const tags = new Map();
  const sounds = new Map();
  for (const region of TIKTOK_REGIONS) {
    const body = await getJson(`https://api.scrapecreators.com/v1/tiktok/get-trending-feed?region=${region}&trim=true`, { "x-api-key": apiKey });
    for (const video of body?.aweme_list ?? []) {
      for (const tag of (video.desc ?? "").match(/#[\p{L}\p{N}_]+/gu) ?? []) tags.set(tag.toLowerCase(), (tags.get(tag.toLowerCase()) ?? 0) + 1);
      const music = video.music?.title && !/original sound|suara asli|âm thanh gốc/i.test(video.music.title) ? `${video.music.title} — ${video.music.author ?? ""}`.trim() : null;
      if (music) sounds.set(music, (sounds.get(music) ?? 0) + 1);
    }
  }
  const top = (map) => [...map].sort((a, b) => b[1] - a[1]).slice(0, 20);
  return { tags: top(tags), sounds: top(sounds) };
}

const fmt = (n) => n.toLocaleString("en-US");
const lines = [`# Meme candidates (${new Date().toISOString().slice(0, 10)})`, "", "Wikipedia articles in *Internet memes introduced in* this year or last that /memes/ does not track yet, by views over the last 28 days. Check Keyword Planner before writing one up.", "", "| # | Article | 28 days | Change |", "|---|---|---|---|"];
const wiki = await wikipediaCandidates();
wiki.forEach((c, i) => {
  const change = c.prior ? `${c.recent >= c.prior ? "+" : ""}${Math.round((c.recent / c.prior - 1) * 100)}%` : "new";
  lines.push(`| ${i + 1} | [${c.title}](https://en.wikipedia.org/wiki/${encodeURIComponent(key(c.title))}) | ${fmt(c.recent)} | ${change} |`);
});

if (process.argv.includes("--tiktok")) {
  const apiKey = process.env.SCRAPECREATORS_API_KEY;
  if (!apiKey) throw new Error("--tiktok needs SCRAPECREATORS_API_KEY");
  const { tags, sounds } = await tiktokHints(apiKey);
  lines.push("", `## TikTok trending feed (${TIKTOK_REGIONS.join(", ")}; hints only, not for publishing)`, "", `Hashtags: ${tags.map(([t, n]) => `${t} (${n})`).join(", ") || "none"}`, "", `Sounds: ${sounds.map(([t, n]) => `${t} (${n})`).join("; ") || "none"}`);
}

const report = `${lines.join("\n")}\n`;
process.stdout.write(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
if (process.env.CANDIDATES_FILE) appendFileSync(process.env.CANDIDATES_FILE, report);
