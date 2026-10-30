// Snapshots the public data behind /{locale}/datasets/ into src/data/*.json and public/datasets/*.csv.
// Run by hand to refresh (`node scripts/fetch-datasets.mjs`), then commit. Pages never call these APIs.
//   World Bank indicators (CC BY 4.0): https://data.worldbank.org/ (CO2 from EDGAR via the World Bank)
//   ISO 3166 / ITU dialing / ISO 4217 via datahub.io core datasets (ODC-PDDL)
//   IANA time zones from zone.tab (data.iana.org), offsets from the Node ICU tz database
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "src/data");
mkdirSync(dataDir, { recursive: true });
const today = new Date().toISOString().slice(0, 10);

async function getJson(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (err) {
      if (attempt >= 3) throw err;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

async function getText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((v) => v.trim()));
  return body.map((r) => Object.fromEntries(head.map((k, i) => [k, (r[i] ?? "").trim()])));
}

function writeJson(name, value) {
  writeFileSync(join(dataDir, name), JSON.stringify(value) + "\n");
}

// --- World Bank -----------------------------------------------------------

const WB = {
  population: "SP.POP.TOTL",
  gdp: "NY.GDP.MKTP.CD",
  "gdp-per-capita": "NY.GDP.PCAP.CD",
  "life-expectancy": "SP.DYN.LE00.IN",
  "fertility-rate": "SP.DYN.TFRT.IN",
  "internet-users": "IT.NET.USER.ZS",
  "gdp-ppp-per-capita": "NY.GDP.PCAP.PP.CD",
  "gdp-growth": "NY.GDP.MKTP.KD.ZG",
  inflation: "FP.CPI.TOTL.ZG",
  unemployment: "SL.UEM.TOTL.ZS",
  "land-area": "AG.LND.TOTL.K2",
  "population-density": "EN.POP.DNST",
  "urban-population": "SP.URB.TOTL.IN.ZS",
  "aged-65-plus": "SP.POP.65UP.TO.ZS",
  "birth-rate": "SP.DYN.CBRT.IN",
  "infant-mortality": "SP.DYN.IMRT.IN",
  "co2-per-capita": "EN.GHG.CO2.PC.CE.AR5",
  "electricity-access": "EG.ELC.ACCS.ZS",
};
// Whole numbers; every other indicator keeps two decimals.
const WHOLE = new Set(["population", "gdp", "land-area"]);

const economies = (await getJson("https://api.worldbank.org/v2/country?format=json&per_page=400"))[1];
// Aggregates (regions, income groups) have region id "NA"; keep the 217 economies.
const countries = new Map(economies.filter((e) => e.region.id !== "NA").map((e) => [e.id, e]));

const meta = { updated: today, sets: {} };
for (const [id, code] of Object.entries(WB)) {
  // `mrnev=1` can return two years for one country and skip others, so read a window of years and keep each
  // economy's latest non-empty value. Values older than 15 years are dropped below anyway.
  const thisYear = new Date().getUTCFullYear();
  const [info, all] = await getJson(`https://api.worldbank.org/v2/country/all/indicator/${code}?format=json&date=${thisYear - 16}:${thisYear}&per_page=20000`);
  const latestBy = new Map();
  for (const r of all) {
    if (r.value === null) continue;
    const seen = latestBy.get(r.countryiso3code);
    if (!seen || Number(r.date) > Number(seen.date)) latestBy.set(r.countryiso3code, r);
  }
  const list = [...latestBy.values()];
  const world = latestBy.get("WLD");
  const rows = list
    .filter((r) => countries.has(r.countryiso3code))
    .map((r) => {
      const c = countries.get(r.countryiso3code);
      const decimals = WHOLE.has(id) ? 0 : 2;
      return [c.iso2Code, c.id, Number(r.value.toFixed(decimals)), Number(r.date), c.name.trim()];
    })
    // Ties (several countries at 100% internet use) fall back to name order, so reruns do not reshuffle them.
    .sort((a, b) => b[2] - a[2] || a[4].localeCompare(b[4]));
  // A last value from decades ago (1990 internet use) misleads more than a gap does.
  const latest = Math.max(...rows.map((r) => r[3]));
  rows.splice(0, rows.length, ...rows.filter((r) => r[3] >= latest - 15));
  writeJson(`${id}.json`, rows);
  const years = rows.map((r) => r[3]);
  meta.sets[id] = {
    rows: rows.length,
    from: Math.min(...years),
    to: Math.max(...years),
    sourceUpdated: info.lastupdated,
    world: world ? [Number(world.value.toFixed(2)), Number(world.date)] : null,
    top: rows.slice(0, 3).map((r) => [r[0], r[2], r[4], r[3]]),
    bottom: rows.slice(-1).map((r) => [r[0], r[2], r[4], r[3]]),
  };
  writeCsv(id, ["rank", "iso2", "iso3", "country", "value", "year"], rows.map((r, i) => [i + 1, r[0], r[1], r[4], r[2], r[3]]));
  console.log(`${id}: ${rows.length} rows, ${meta.sets[id].from}-${meta.sets[id].to}`);
}

// --- ISO 3166 + dialing codes --------------------------------------------

const cc = parseCsv(await getText("https://datahub.io/core/country-codes/r/country-codes.csv"))
  .filter((r) => /^[A-Z]{2}$/.test(r["ISO3166-1-Alpha-2"]))
  .map((r) => [
    r["ISO3166-1-Alpha-2"],
    r["ISO3166-1-Alpha-3"],
    r["ISO3166-1-numeric"].padStart(3, "0"),
    r.TLD,
    r.Continent,
    // Some areas have several codes ("1-809,1-829,1-849").
    r.Dial ? r.Dial.split(",").map((d) => `+${d.trim().replace(/^\+/, "")}`).join(", ") : "",
    // Every currency in use, comma-separated (Bhutan: "INR,BTN"; Panama: "PAB,USD").
    r["ISO4217-currency_alphabetic_code"],
    r["CLDR display name"] || r["UNTERM English Short"] || r.official_name_en,
  ])
  .sort((a, b) => a[0].localeCompare(b[0]));
writeJson("countries.json", cc);
meta.sets["country-codes"] = { rows: cc.length };
meta.sets["calling-codes"] = { rows: cc.filter((r) => r[5]).length };
writeCsv("country-codes", ["alpha2", "alpha3", "numeric", "name", "tld", "continent"], cc.map((r) => [r[0], r[1], r[2], r[7], r[3], r[4]]));
writeCsv("calling-codes", ["alpha2", "name", "calling_code"], cc.filter((r) => r[5]).map((r) => [r[0], r[7], r[5]]));
console.log(`countries: ${cc.length}`);

// --- ISO 4217 -------------------------------------------------------------

const cur = new Map();
for (const r of parseCsv(await getText("https://datahub.io/core/currency-codes/r/codes-all.csv"))) {
  if (r.WithdrawalDate || !/^[A-Z]{3}$/.test(r.AlphabeticCode)) continue;
  // Funds and metals (XAU, XDR, BOV...) have no minor unit; keep them, they are part of ISO 4217.
  if (!cur.has(r.AlphabeticCode)) {
    cur.set(r.AlphabeticCode, [r.AlphabeticCode, r.NumericCode.padStart(3, "0"), r.MinorUnit === "N.A." ? null : Number(r.MinorUnit), [], r.Currency]);
  }
}
for (const c of cc) {
  for (const code of c[6].split(",").map((x) => x.trim())) if (cur.has(code)) cur.get(code)[3].push(c[0]);
}
const currencies = [...cur.values()].sort((a, b) => a[0].localeCompare(b[0]));
writeJson("currencies.json", currencies);
meta.sets["currency-codes"] = { rows: currencies.length };
writeCsv("currency-codes", ["code", "numeric", "minor_unit", "name", "countries"], currencies.map((r) => [r[0], r[1], r[2] ?? "", r[4], r[3].join(" ")]));
console.log(`currencies: ${currencies.length}`);

// --- IANA time zones ------------------------------------------------------

const year = new Date().getUTCFullYear();
function offsetMinutes(tz, month) {
  const at = new Date(Date.UTC(year, month, 15, 12));
  const name = new Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "longOffset" })
    .formatToParts(at).find((p) => p.type === "timeZoneName").value;
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}
// zone.tab: one line per country and zone with current IANA names (Asia/Kolkata, not ICU's Asia/Calcutta).
const zoneTab = (await getText("https://data.iana.org/time-zones/tzdb/zone.tab"))
  .split("\n").filter((line) => line && !line.startsWith("#")).map((line) => line.split("\t"));
const tzVersion = (await getText("https://data.iana.org/time-zones/tzdb/version")).trim();
const zones = zoneTab
  .flatMap(([country, , tz]) => {
    // A zone newer than Node's ICU data has no offsets here: skip it rather than guess (update Node to pick it up).
    try {
      return [[tz, offsetMinutes(tz, 0), offsetMinutes(tz, 6), country]];
    } catch {
      console.warn(`time zones: ${tz} is unknown to this Node's ICU (${process.versions.tz}), skipped`);
      return [];
    }
  })
  .sort((a, b) => Math.min(a[1], a[2]) - Math.min(b[1], b[2]) || a[0].localeCompare(b[0]));
writeJson("time-zones.json", zones);
const offsets = zones.flatMap((z) => [z[1], z[2]]);
meta.sets["time-zones"] = { rows: zones.length, year, tzdata: process.versions.tz ?? tzVersion, west: Math.min(...offsets), east: Math.max(...offsets), offsets: new Set(offsets).size };
const fmt = (m) => `${m < 0 ? "-" : "+"}${String(Math.floor(Math.abs(m) / 60)).padStart(2, "0")}:${String(Math.abs(m) % 60).padStart(2, "0")}`;
writeCsv("time-zones", ["time_zone", "country", `utc_offset_jan_${year}`, `utc_offset_jul_${year}`], zones.map((z) => [z[0], z[3], fmt(z[1]), fmt(z[2])]));
console.log(`time zones: ${zones.length} (zone.tab ${tzVersion}, offsets from ICU tzdata ${process.versions.tz})`);

// --- Paper sizes (ISO 216 / 269, JIS P 0138, ANSI) -------------------------

function halve(first, count) {
  const out = [first];
  for (let i = 1; i <= count; i++) {
    const [w, h] = out[i - 1];
    out.push([Math.floor(h / 2), w]);
  }
  return out;
}
const paper = [
  ...halve([841, 1189], 10).map(([w, h], n) => [`A${n}`, "A", w, h]),
  ...halve([1000, 1414], 10).map(([w, h], n) => [`B${n}`, "B", w, h]),
  ...halve([917, 1297], 10).map(([w, h], n) => [`C${n}`, "C", w, h]),
  ...halve([1030, 1456], 10).map(([w, h], n) => [`JIS B${n}`, "JIS", w, h]),
  ["Letter", "US", 215.9, 279.4],
  ["Legal", "US", 215.9, 355.6],
  ["Tabloid / Ledger", "US", 279.4, 431.8],
  ["Executive", "US", 184.15, 266.7],
  ["Half Letter", "US", 139.7, 215.9],
  ["Junior Legal", "US", 127, 203.2],
];
writeJson("paper-sizes.json", paper);
meta.sets["paper-sizes"] = { rows: paper.length };
const inch = (mm) => (mm / 25.4).toFixed(2);
const px = (mm, dpi) => Math.round((mm / 25.4) * dpi);
writeCsv("paper-sizes", ["size", "series", "width_mm", "height_mm", "width_in", "height_in", "width_px_300dpi", "height_px_300dpi", "width_px_96dpi", "height_px_96dpi"],
  paper.map(([n, s, w, h]) => [n, s, w, h, inch(w), inch(h), px(w, 300), px(h, 300), px(w, 96), px(h, 96)]));

// --- ASCII ----------------------------------------------------------------

const CONTROL = [
  ["NUL", "Null"], ["SOH", "Start of Heading"], ["STX", "Start of Text"], ["ETX", "End of Text"],
  ["EOT", "End of Transmission"], ["ENQ", "Enquiry"], ["ACK", "Acknowledge"], ["BEL", "Bell"],
  ["BS", "Backspace"], ["HT", "Horizontal Tab"], ["LF", "Line Feed"], ["VT", "Vertical Tab"],
  ["FF", "Form Feed"], ["CR", "Carriage Return"], ["SO", "Shift Out"], ["SI", "Shift In"],
  ["DLE", "Data Link Escape"], ["DC1", "Device Control 1 (XON)"], ["DC2", "Device Control 2"], ["DC3", "Device Control 3 (XOFF)"],
  ["DC4", "Device Control 4"], ["NAK", "Negative Acknowledge"], ["SYN", "Synchronous Idle"], ["ETB", "End of Transmission Block"],
  ["CAN", "Cancel"], ["EM", "End of Medium"], ["SUB", "Substitute"], ["ESC", "Escape"],
  ["FS", "File Separator"], ["GS", "Group Separator"], ["RS", "Record Separator"], ["US", "Unit Separator"],
];
const ascii = Array.from({ length: 128 }, (_, code) => {
  if (code < 32) return [code, ...CONTROL[code]];
  if (code === 32) return [code, "SP", "Space"];
  if (code === 127) return [code, "DEL", "Delete"];
  return [code, String.fromCharCode(code), ""];
});
writeJson("ascii.json", ascii);
meta.sets.ascii = { rows: ascii.length };
writeCsv("ascii", ["decimal", "hex", "octal", "binary", "char", "name"],
  ascii.map(([d, c, n]) => [d, d.toString(16).toUpperCase().padStart(2, "0"), d.toString(8).padStart(3, "0"), d.toString(2).padStart(7, "0"), c, n]));

writeJson("meta.json", meta);
console.log("wrote src/data and public/datasets");

function writeCsv(id, head, rows) {
  const dir = join(root, "public/datasets");
  mkdirSync(dir, { recursive: true });
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  // BOM so Excel opens accented names (Åland, Curaçao) as UTF-8.
  writeFileSync(join(dir, `${id}.csv`), "\ufeff" + [head, ...rows].map((r) => r.map(esc).join(",")).join("\n") + "\n");
}
