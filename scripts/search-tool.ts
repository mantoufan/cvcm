/**
 * Site search demand, run by the owner (never by the Worker or CI):
 *
 *   npm run search:demand [-- --days 30 --min 2 --json out.json]
 *     Queries that found nothing, grouped across locales, with distinct visitors and whether today's index (this
 *     checkout) now answers them. Feed the list to the SEO review in docs/search-demand.md.
 *
 * Reads the remote D1 database through `wrangler d1 execute` (needs CLOUDFLARE_API_TOKEN or wrangler login).
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import "../src/shared/messages-all";
import "../src/shared/kb-code-meta";
import "../src/shared/kb-ai-meta";
import { isLocale, LOCALES, type Locale } from "../src/shared/locale";
import { searchEntries, type SearchEntry } from "../src/shared/search";
import { buildAllSearchIndexes } from "../src/shared/search-index";

const args = process.argv.slice(2);
const command = args[0];
function option(name: string, fallback: string): string {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

function d1<T>(sql: string): T[] {
  const out = execFileSync("npx", ["wrangler", "d1", "execute", "cvcm", "--remote", "--json", "--command", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 64 * 1024 * 1024,
  });
  const parsed = JSON.parse(out) as Array<{ results: T[]; success: boolean }>;
  if (!parsed[0]?.success) throw new Error(`D1 query failed: ${sql}`);
  return parsed[0].results;
}

let indexes: Record<Locale, SearchEntry[]> | null = null;
function hitsFor(q: string, locale: Locale): SearchEntry[] {
  indexes ??= buildAllSearchIndexes();
  return searchEntries(indexes[locale], q, 3);
}

type MissRow = { q: string; locale: string; count: number; visitors: number; first_at: number; last_at: number };

function day(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function demand(): void {
  const days = Number(option("days", "30"));
  const min = Number(option("min", "1"));
  const since = Date.now() - days * 86_400_000;
  const misses = d1<MissRow>(`SELECT q, locale, count, visitors, first_at, last_at FROM search_misses WHERE last_at >= ${since}`);
  type Row = { q: string; visitors: number; count: number; locales: string[]; first: string; last: string; answered: string[] };
  const byQuery = new Map<string, Row>();
  const seenLocale = new Set<string>();
  const rowOf = (q: string) => {
    let row = byQuery.get(q);
    if (!row) byQuery.set(q, (row = { q, visitors: 0, count: 0, locales: [], first: "", last: "", answered: [] }));
    return row;
  };
  const addLocale = (row: Row, locale: string, lastAt: number, firstAt: number) => {
    if (day(lastAt) > row.last) row.last = day(lastAt);
    if (!row.first || day(firstAt) < row.first) row.first = day(firstAt);
    if (seenLocale.has(`${locale}|${row.q}`)) return;
    seenLocale.add(`${locale}|${row.q}`);
    row.locales.push(locale);
    if (isLocale(locale)) {
      const now = hitsFor(row.q, locale);
      if (now.length) row.answered.push(`${locale}: ${now[0][2]}`);
    }
  };
  for (const m of misses) {
    const row = rowOf(m.q);
    row.visitors += m.visitors;
    row.count += m.count;
    addLocale(row, m.locale, m.last_at, m.first_at);
  }
  const rows = [...byQuery.values()]
    .filter((r) => r.visitors >= min)
    .sort((a, b) => b.visitors - a.visitors || b.count - a.count);
  console.log(`No-result queries last seen in the past ${days} days (≥${min} visitors): ${rows.length}`);
  console.log("visitors and searches are totals since the first time a query was seen (column first), not counts within the window.\n");
  console.log("| query | visitors | searches | locales | first | last | answered now |");
  console.log("|---|---|---|---|---|---|---|");
  for (const r of rows) {
    console.log(`| ${r.q.replace(/\|/g, "\\|")} | ${r.visitors} | ${r.count} | ${r.locales.join(" ")} | ${r.first} | ${r.last} | ${r.answered.join("; ")} |`);
  }
  const out = option("json", "");
  if (out) {
    writeFileSync(out, JSON.stringify(rows, null, 2));
    console.log(`\nwrote ${out}`);
  }
}

if (command === "demand") demand();
else {
  console.error("usage: search-tool demand [--days 30] [--min 1] [--json file]");
  console.error(`locales: ${LOCALES.join(", ")}`);
  process.exit(1);
}
