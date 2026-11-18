// Suggests memes and songs to write up next for /{locale}/memes/: an editorial shortlist, never shown on the site.
// Run weekly by .github/workflows/meme-candidates.yml (the list lands in the run summary and in one GitHub issue), or by
// hand: `node scripts/meme-candidates.mjs [--tiktok]`.
//   Wikipedia (CC BY-SA titles, CC0 pageviews): every article in "Internet memes introduced in <this year / last year>"
//   that src/shared/meme-sources.json does not track yet, ranked by views over the last four weeks.
//   --tiktok (local only, needs SCRAPECREATORS_API_KEY; 1 credit per region): hashtags and sounds in TikTok's trending
//   feed. A third-party scrape, so it is only read here as a hint and never published.
// Next step for a candidate is a Keyword Planner check, then an entry (see the Memes channel section of AGENTS.md).
import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { jsonGetter, pageviewsDay as compact } from "./get-json.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const UA = "cv.cm meme candidates (https://cv.cm/)";
const SOURCES = JSON.parse(readFileSync(join(root, "src/shared/meme-sources.json"), "utf8"));
/** slang.ts cites the articles of entries whose own trend article is null (a person, a song page), so read those too. */
const SLANG_TS = readFileSync(join(root, "src/shared/slang.ts"), "utf8");
const LIMIT = 40;
const TIKTOK_REGIONS = ["US", "ID", "VN"];

const getJson = jsonGetter(UA);

const key = (title) => title.replaceAll(" ", "_");

/** The query string that continues a MediaWiki query: every key of `continue`, sent back as the API asks; "" at the end. */
const nextPage = (body) => (body?.continue ? `&${new URLSearchParams(body.continue)}` : "");

/** Articles (namespace 0) in a category, following continuation. */
async function categoryPages(category) {
  const titles = [];
  let cont = "";
  do {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=${encodeURIComponent(category)}&cmnamespace=0&cmlimit=500&format=json${cont}`;
    const body = await getJson(url);
    titles.push(...(body?.query?.categorymembers ?? []).map((m) => m.title));
    cont = nextPage(body);
  } while (cont);
  return titles;
}

/**
 * The last day whose pageviews Wikimedia has published: yesterday, or the day before when yesterday's are not out yet
 * (an early-morning run). Checked on the busiest article, since a quiet one simply has no row for a day with no views.
 */
async function lastPublishedDay() {
  const yesterday = new Date(Date.now() - 86_400_000);
  const probe = await getJson(`https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/Main_Page/daily/${compact(yesterday)}/${compact(yesterday)}`);
  return probe?.items?.length ? yesterday : new Date(yesterday.getTime() - 86_400_000);
}

/** Views in the 28 days up to `end`, and in the 28 days before. */
async function views(title, end) {
  const start = new Date(end.getTime() - 55 * 86_400_000);
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/${encodeURIComponent(key(title))}/daily/${compact(start)}/${compact(end)}`;
  const items = (await getJson(url))?.items ?? [];
  const cut = compact(new Date(end.getTime() - 27 * 86_400_000));
  let recent = 0;
  let prior = 0;
  for (const item of items) {
    if (item.timestamp.slice(0, 8) >= cut) recent += item.views;
    else prior += item.views;
  }
  return { recent, prior };
}

/**
 * English Wikipedia articles the channel already covers: each entry's trend article, its `also` list in meme-sources.json
 * (articles about the same meme it does not track, e.g. mog → "Mogging") and every en.wikipedia source it cites, resolved
 * through redirects (a source may link "Apt. (song)" while the category lists "APT. (song)").
 */
async function trackedTitles() {
  const raw = new Set(Object.values(SOURCES).flatMap((s) => [...(s.wiki?.startsWith("en:") ? [s.wiki.slice(3)] : []), ...(s.also ?? [])]));
  for (const m of SLANG_TS.matchAll(/https:\/\/en\.wikipedia\.org\/wiki\/([^"#?\s]+)/g)) {
    // A malformed escape (a literal "%") must not stop the weekly run: keep the raw title then.
    try {
      raw.add(decodeURIComponent(m[1]));
    } catch {
      raw.add(m[1]);
    }
  }
  const titles = [...raw].map((t) => t.replaceAll("_", " "));
  return new Set([...titles, ...(await resolveTitles(titles)).values()].map(key));
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

/** Each title mapped to the article it ends at through redirects (a category may list a redirect page). */
async function resolveTitles(titles) {
  const to = new Map(titles.map((t) => [t, t]));
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const body = await getJson(`https://en.wikipedia.org/w/api.php?action=query&redirects=1&format=json&titles=${encodeURIComponent(batch.join("|"))}`);
    const norm = new Map((body?.query?.normalized ?? []).map((n) => [n.from, n.to]));
    const redirect = new Map((body?.query?.redirects ?? []).map((r) => [r.from, r.to]));
    for (const t of batch) {
      // Follow a chain (A → B → C) to its end; the seen set stops a redirect loop.
      let n = norm.get(t) ?? t;
      for (const seen = new Set([n]); redirect.has(n) && !seen.has(redirect.get(n)); seen.add(n)) n = redirect.get(n);
      to.set(t, n);
    }
  }
  return to;
}

async function wikipediaCandidates() {
  const year = new Date().getUTCFullYear();
  const [tracked, end, ...lists] = await Promise.all([trackedTitles(), lastPublishedDay(), ...[year, year - 1].map((y) => categoryPages(`Category:Internet memes introduced in ${y}`))]);
  const members = new Set(lists.flat());
  const resolved = await resolveTitles([...members]);
  // A member that redirects into a broader article (a meme title pointing at a film, a person, a section) would be
  // ranked by that article's views, so it is kept only when its target is itself in the category.
  const own = [...members].flatMap((title) => {
    const to = resolved.get(title) ?? title;
    return to === title || members.has(to) ? [to] : [];
  });
  const titles = [...new Set(own)].filter((title) => !tracked.has(key(title)) && !DECIDED.has(title) && !title.startsWith("List of "));
  const counts = await pool(titles, (title) => views(title, end).catch((error) => {
    console.warn(`views ${title}: ${error.message}`);
    return null;
  }));
  // An article whose views could not be read is named separately instead of sinking to the bottom unseen.
  const failed = titles.filter((_, i) => counts[i] === null);
  const ranked = titles.flatMap((title, i) => (counts[i] ? [{ title, ...counts[i] }] : [])).sort((a, b) => b.recent - a.recent);
  // The channel takes no politics or tragedies (AGENTS.md) and the list is public, so only articles whose categories
  // were checked can make it: the top LIMIT × 2 are checked and the list is cut from those.
  const checked = ranked.slice(0, LIMIT * 2);
  const off = await offTopic([...checked.map((c) => c.title), ...failed]);
  return { list: checked.filter((c) => !off.has(c.title)).slice(0, LIMIT), failed: failed.filter((t) => !off.has(t)) };
}

/**
 * Articles left out on purpose (Clanker is a slur, Kirkification is politics; AGENTS.md) or general articles that sit in
 * the category without being a meme to write up. "List of …" pages are skipped by name. Articles an entry covers belong
 * in that entry's `also` in meme-sources.json, not here.
 */
const DECIDED = new Set([
  "Clanker", "Kirkification",
  "Jet2.com", "Jet2 plc", "Jet2holidays", // the airline and its brands, not the meme (jet2-holiday)
  "Internet meme", "4chan", "Wikipedia mascots", // general articles, not a meme to write up
]);

/**
 * Wikipedia categories (whole words) that mark an article as politics, a crime or a disaster rather than a meme to write
 * up. Kept narrow: "Star Wars memes" or a "2025 deaths" category alone must not hide a meme.
 */
const OFF_TOPIC = /\b(politic\w*|elections?|parliament\w*|administration|protests?|corruption|controvers(y|ies)|scandals?|crimes?|criminal\w*|terroris\w*|assassinat\w*|murders?|killings?|homicides?|shootings?|disasters?|sexual\w*|pornograph\w*)\b|charlie kirk|donald trump|jeffrey epstein/i;

/**
 * Titles whose categories mark them off-topic. A batch whose categories cannot be read is dropped whole (and warned
 * about): the list is public, so an unchecked article stays out rather than in.
 */
async function offTopic(titles) {
  const off = new Set();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const categories = new Map(batch.map((t) => [t, []]));
    const seen = new Set();
    try {
      let cont = "";
      do {
        const body = await getJson(`https://en.wikipedia.org/w/api.php?action=query&prop=categories&clshow=!hidden&cllimit=max&format=json&titles=${encodeURIComponent(batch.join("|"))}${cont}`);
        // Titles come from resolveTitles, already canonical, so each page's title is the key.
        for (const page of Object.values(body?.query?.pages ?? {})) {
          if (!categories.has(page.title) || "missing" in page) continue;
          seen.add(page.title);
          categories.get(page.title).push(...(page.categories ?? []).map((c) => c.title));
        }
        // The 500-category cap is per request, not per page: follow clcontinue until every page's list is complete.
        cont = nextPage(body);
      } while (cont);
    } catch (error) {
      console.warn(`categories for ${batch.length} articles: ${error.message}; leaving them out`);
      for (const t of batch) off.add(t);
      continue;
    }
    // A title the API returned no page for was not checked, so it stays out like a failed batch.
    for (const [title, cats] of categories) if (!seen.has(title) || cats.some((c) => OFF_TOPIC.test(c))) off.add(title);
  }
  return off;
}

/** Hashtags and sounds seen in TikTok's trending feed, most frequent first. */
async function tiktokHints(apiKey) {
  const tags = new Map();
  const sounds = new Map();
  for (const region of TIKTOK_REGIONS) {
    const body = await getJson(`https://api.scrapecreators.com/v1/tiktok/get-trending-feed?region=${region}&trim=true`, { "x-api-key": apiKey });
    for (const video of body?.aweme_list ?? []) {
      for (const tag of (video.desc ?? "").match(/#[\p{L}\p{N}_]+/gu) ?? []) tags.set(tag.toLowerCase(), (tags.get(tag.toLowerCase()) ?? 0) + 1);
      const music = video.music?.title && !/original sound|suara asli|âm thanh gốc/i.test(video.music.title) ? [video.music.title, video.music.author].filter(Boolean).join(" — ") : null;
      if (music) sounds.set(music, (sounds.get(music) ?? 0) + 1);
    }
  }
  const top = (map) => [...map].sort((a, b) => b[1] - a[1]).slice(0, 20);
  return { tags: top(tags), sounds: top(sounds) };
}

const tiktok = process.argv.includes("--tiktok");
// Check the key before the Wikipedia pass, so a missing key costs no requests.
if (tiktok && !process.env.SCRAPECREATORS_API_KEY) throw new Error("--tiktok needs SCRAPECREATORS_API_KEY");
const fmt = (n) => n.toLocaleString("en-US");
/** A title as inline code, so "@name", "#123", "_" or "*" in it cannot ping a user, link an issue or turn into emphasis. */
const code = (title) => `\`${title.replaceAll("`", "'")}\``;
const lines = [`# Meme candidates (${new Date().toISOString().slice(0, 10)})`, "", "Wikipedia articles in *Internet memes introduced in* this year or last that /memes/ does not track yet, by views over the last 28 days. Check Keyword Planner before writing one up.", "", "| # | Article | 28 days | Change |", "|---|---|---|---|"];
const wiki = await wikipediaCandidates();
wiki.list.forEach((c, i) => {
  const change = c.prior ? `${c.recent >= c.prior ? "+" : ""}${Math.round((c.recent / c.prior - 1) * 100)}%` : "new";
  lines.push(`| ${i + 1} | [${code(c.title)}](https://en.wikipedia.org/wiki/${encodeURIComponent(key(c.title))}) | ${fmt(c.recent)} | ${change} |`);
});
if (wiki.failed.length) lines.push("", `Views unavailable this week (check by hand): ${wiki.failed.map(code).join(", ")}`);

if (tiktok) {
  const { tags, sounds } = await tiktokHints(process.env.SCRAPECREATORS_API_KEY);
  lines.push("", `## TikTok trending feed (${TIKTOK_REGIONS.join(", ")}; hints only, not for publishing)`, "", `Hashtags: ${tags.map(([t, n]) => `${t} (${n})`).join(", ") || "none"}`, "", `Sounds: ${sounds.map(([t, n]) => `${t} (${n})`).join("; ") || "none"}`);
}

const report = `${lines.join("\n")}\n`;
process.stdout.write(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
if (process.env.CANDIDATES_FILE) appendFileSync(process.env.CANDIDATES_FILE, report);
