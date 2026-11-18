// Download and zip helpers shared by the data scripts (fetch-rankings.mjs, fetch-currency.mjs).
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { inflateRawSync } from "node:zlib";

const DEFAULT_UA = "cv.cm data snapshot (https://cv.cm/)";

/** A URL's body as bytes (90 s timeout, body included). */
export async function getBuffer(url, ua = DEFAULT_UA) {
  const res = await fetch(url, { headers: { "User-Agent": ua }, signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** The files in a zip (or xlsx), by name: enough of the format for the archives read here. */
export function unzip(buffer) {
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

export const ECB_HIST_ZIP = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.zip";
/** Where one run keeps the ECB archive, so the rankings table and the currency snapshot read the same download. */
const ECB_CACHE = process.env.ECB_HIST_CACHE ?? join(process.env.RUNNER_TEMP ?? tmpdir(), "cvcm-eurofxref-hist.zip");
/** A cached archive older than this is fetched again (a later run, not the same one). */
const ECB_CACHE_MS = 2 * 60 * 60 * 1000;

/** eurofxref-hist.csv as text: from the run's cached archive when fresh, else downloaded (with retries) and cached. */
export async function ecbHistCsv(ua = DEFAULT_UA) {
  let zip = null;
  if (existsSync(ECB_CACHE) && Date.now() - statSync(ECB_CACHE).mtimeMs < ECB_CACHE_MS) zip = readFileSync(ECB_CACHE);
  if (!zip) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        zip = await getBuffer(ECB_HIST_ZIP, ua);
        break;
      } catch (error) {
        if (attempt === 3) throw error;
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
    mkdirSync(dirname(ECB_CACHE), { recursive: true });
    writeFileSync(ECB_CACHE, zip);
  }
  return [...unzip(zip).values()][0].toString("utf8");
}
