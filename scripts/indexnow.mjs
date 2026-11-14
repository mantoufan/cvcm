// Tells IndexNow (Bing, Yandex, Naver, Seznam, Yep) which pages a deploy added, changed or removed, so they are
// crawled now instead of whenever the sitemap is next read. Run after `wrangler deploy` (.github/workflows/deploy.yml):
//
//   node scripts/indexnow.mjs            submit and remember what was submitted
//   node scripts/indexnow.mjs --dry-run  only print the counts
//
// A page counts as changed when what a search engine reads of it differs from what was submitted last time: its
// title, description and structured data, and its <main> content, taken from the HTML the built Worker answers with
// (dist/_worker.js over dist/). The site header and footer (the tool directory is on every page) and asset file
// names are left out, so a new tool or a new build does not resubmit the whole site. The signatures are kept in
// .indexnow/pages.json, which CI carries from run to run in the Actions cache.
// With no state (the first run, or an evicted cache) every sitemap page is submitted once. A failed submission
// never fails the deploy: the state is left alone and the same pages go out with the next one.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const INDEXNOW_HOST = "cv.cm";
/** Public by design: search engines read it at https://cv.cm/<key>.txt (public/, STATIC_FILE in path.ts). */
export const INDEXNOW_KEY = "4972981e4cdf3fdd13b674ad85304c11";
/** IndexNow takes up to 10,000 URLs in one request. */
export const INDEXNOW_BATCH = 10000;

/** Every <loc> of a sitemap file. */
export function sitemapUrls(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

/** What a search engine reads of a page: title, description, canonical, robots, structured data and <main>. */
export function pageSignature(html) {
  const head = [
    /<title>[^<]*<\/title>/.exec(html)?.[0] ?? "",
    ...[...html.matchAll(/<meta\s+name="(?:description|robots)"[^>]*>/g)].map((m) => m[0].replace(/\s+/g, " ")),
    /<link rel="canonical"[^>]*>/.exec(html)?.[0] ?? "",
    ...[...html.matchAll(/<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g)].map((m) => m[0]),
  ];
  const start = html.indexOf("<main");
  const end = html.lastIndexOf("</main>");
  const main = start >= 0 && end > start ? html.slice(start, end) : "";
  // Hashed asset names change with every build.
  const text = [...head, main].join("\n").replace(/\/assets\/[A-Za-z0-9_.-]+/g, "/assets/");
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".xml": "application/xml", ".txt": "text/plain", ".svg": "image/svg+xml" };

/** dist/ standing in for the Worker's ASSETS binding. */
function distAssets(dist) {
  return {
    async fetch(input) {
      const path = decodeURIComponent(new URL(typeof input === "string" ? input : input.url).pathname);
      const file = join(dist, path.endsWith("/") ? `${path}index.html` : path);
      if (path.includes("..") || !existsSync(file) || statSync(file).isDirectory()) return new Response("Not Found", { status: 404 });
      return new Response(readFileSync(file), { headers: { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" } });
    },
  };
}

/** URL -> signature of the page the built Worker serves, for every page in dist/sitemaps/*.xml. */
export async function pageSignatures(dist) {
  const worker = (await import(pathToFileURL(join(dist, "_worker.js")).href)).default;
  const env = { ASSETS: distAssets(dist) };
  const pages = {};
  const dir = join(dist, "sitemaps");
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".xml")).sort()) {
    for (const url of sitemapUrls(readFileSync(join(dir, file), "utf8"))) {
      const res = await worker.fetch(new Request(url), env);
      if (res.status !== 200) throw new Error(`indexnow: ${url} is in the sitemap but answers ${res.status}`);
      pages[url] = pageSignature(await res.text());
    }
  }
  return pages;
}

/** Pages to submit: new and changed ones, and removed ones (so engines drop them). Everything when there is no earlier state. */
export function changedUrls(previous, next) {
  if (!previous) return Object.keys(next);
  const changed = Object.keys(next).filter((url) => previous[url] !== next[url]);
  const removed = Object.keys(previous).filter((url) => !(url in next));
  return [...changed, ...removed];
}

export function indexNowBody(urls) {
  return { host: INDEXNOW_HOST, key: INDEXNOW_KEY, keyLocation: `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`, urlList: urls };
}

async function submit(urls) {
  for (let i = 0; i < urls.length; i += INDEXNOW_BATCH) {
    const batch = urls.slice(i, i + INDEXNOW_BATCH);
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(indexNowBody(batch)),
      signal: AbortSignal.timeout(30000),
    });
    // 200 = received, 202 = received, key check pending.
    if (res.status !== 200 && res.status !== 202) throw new Error(`IndexNow answered ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const dist = join(root, "dist");
  const stateFile = join(root, ".indexnow", "pages.json");
  const dryRun = process.argv.includes("--dry-run");
  if (!existsSync(join(dist, "_worker.js"))) throw new Error("indexnow: dist/_worker.js missing, run `npm run build` first");
  const next = await pageSignatures(dist);
  let previous = null;
  try {
    previous = JSON.parse(readFileSync(stateFile, "utf8"));
  } catch {
    /* no state yet */
  }
  const urls = changedUrls(previous, next);
  console.log(`indexnow: ${Object.keys(next).length} pages, ${urls.length} to submit${previous ? "" : " (no earlier state: all of them)"}`);
  if (dryRun) return;
  if (urls.length) {
    try {
      await submit(urls);
    } catch (err) {
      console.warn(`indexnow: not submitted, will retry with the next deploy: ${err instanceof Error ? err.message : err}`);
      return;
    }
    console.log(`indexnow: submitted ${urls.length} URLs`);
  }
  mkdirSync(dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, JSON.stringify(next));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
