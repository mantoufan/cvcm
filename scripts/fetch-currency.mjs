// Snapshots the ECB euro foreign exchange reference rates behind /{locale}/currency/ into src/shared/currency-data.json
// (latest rates, 90 days of daily cross rates, monthly averages since each series began, high/low/average windows) and
// src/shared/currency-asof.ts (the snapshot date: sitemap lastmod). Run daily by .github/workflows/refresh-rankings.yml
// after fetch-rankings.mjs, or by hand (`node scripts/fetch-currency.mjs`; CURRENCY_CSV=<eurofxref-hist.csv> reads a
// local file). The ECB allows reuse with the source named; pages never call it. Pairs are src/shared/currency-pairs.json.
// A failed download keeps the last snapshot and is listed in RANKINGS_FAILURES_FILE, which turns the run red.
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { inflateRawSync } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCurrencySnapshot, snapshotText } from "./currency-snapshot.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FAILURES_FILE = process.env.RANKINGS_FAILURES_FILE ?? join(tmpdir(), "rankings-failures.txt");
const ZIP = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.zip";
const dataPath = join(root, "src/shared/currency-data.json");
const asOfPath = join(root, "src/shared/currency-asof.ts");

/** RANKINGS_ONLY (the workflow's `only` input) limits a manual run; this script runs when it is empty or lists "currency". */
const only = (process.env.RANKINGS_ONLY ?? "").split(",").map((id) => id.trim()).filter(Boolean);
if (only.length && !only.includes("currency")) {
  console.log(`currency: skipped (RANKINGS_ONLY=${process.env.RANKINGS_ONLY})`);
  process.exit(0);
}

/** The single CSV in the ECB's zip (stored or deflated). */
function firstFile(buffer) {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error("not a zip file");
  const at = buffer.readUInt32LE(end + 16);
  const method = buffer.readUInt16LE(at + 10);
  const size = buffer.readUInt32LE(at + 20);
  const local = buffer.readUInt32LE(at + 42);
  const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
  const raw = buffer.subarray(start, start + size);
  return (method === 8 ? inflateRawSync(raw) : raw).toString("utf8");
}

async function download() {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const res = await fetch(ZIP, { headers: { "User-Agent": "cv.cm exchange-rate snapshot (https://cv.cm/)" }, signal: AbortSignal.timeout(90_000) });
      if (!res.ok) throw new Error(`${res.status} ${ZIP}`);
      return firstFile(Buffer.from(await res.arrayBuffer()));
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
}

try {
  const csv = process.env.CURRENCY_CSV ? readFileSync(process.env.CURRENCY_CSV, "utf8") : await download();
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
