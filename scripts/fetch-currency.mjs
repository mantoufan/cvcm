// Snapshots the ECB euro foreign exchange reference rates behind /{locale}/currency/ into src/shared/currency-data.json
// (per-EUR rates once per currency: the latest day, the last 90 days and monthly averages; per-pair high/low/average
// windows) and
// src/shared/currency-asof.ts (the snapshot date: sitemap lastmod). Run daily by .github/workflows/refresh-rankings.yml
// after fetch-rankings.mjs, reading the archive fetch-rankings.mjs already downloaded in that run (scripts/fetch-util.mjs caches it), or by
// hand (`node scripts/fetch-currency.mjs`; CURRENCY_CSV=<eurofxref-hist.csv> reads a
// local file). The ECB allows reuse with the source named; pages never call it. Pairs are src/shared/currency-pairs.json.
// A failed download keeps the last snapshot and is listed in RANKINGS_FAILURES_FILE, which turns the run red.
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCurrencySnapshot, snapshotText } from "./currency-snapshot.mjs";
import { ecbHistCsv } from "./fetch-util.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FAILURES_FILE = process.env.RANKINGS_FAILURES_FILE ?? join(tmpdir(), "rankings-failures.txt");
const dataPath = join(root, "src/shared/currency-data.json");
const asOfPath = join(root, "src/shared/currency-asof.ts");

/** RANKINGS_ONLY (the workflow's `only` input) limits a manual run; this script runs when it is empty or lists "currency". */
const only = (process.env.RANKINGS_ONLY ?? "").split(",").map((id) => id.trim()).filter(Boolean);
if (only.length && !only.includes("currency")) {
  console.log(`currency: skipped (RANKINGS_ONLY=${process.env.RANKINGS_ONLY})`);
  process.exit(0);
}

try {
  const csv = process.env.CURRENCY_CSV ? readFileSync(process.env.CURRENCY_CSV, "utf8") : await ecbHistCsv("cv.cm exchange-rate snapshot (https://cv.cm/)");
  const pairs = JSON.parse(readFileSync(join(root, "src/shared/currency-pairs.json"), "utf8"));
  const snapshot = buildCurrencySnapshot(csv, pairs);
  const text = snapshotText(snapshot);
  const asOf = `// Written by scripts/fetch-currency.mjs: the ECB reference-rate day in currency-data.json (sitemap lastmod).\nexport const CURRENCY_SNAPSHOT = ${JSON.stringify(snapshot.asOf)};\n`;
  const same = (path, next) => {
    try {
      return readFileSync(path, "utf8") === next;
    } catch {
      return false;
    }
  };
  if (same(dataPath, text) && same(asOfPath, asOf)) {
    console.log(`currency: no new ECB data (${snapshot.asOf})`);
  } else {
    writeFileSync(dataPath, text);
    writeFileSync(asOfPath, asOf);
    console.log(`currency: wrote ${pairs.length} pairs as of ${snapshot.asOf}`);
  }
} catch (error) {
  console.error(`currency: ${error.message}; keeping the last snapshot`);
  appendFileSync(FAILURES_FILE, `currency: ${error.message}\n`);
}
