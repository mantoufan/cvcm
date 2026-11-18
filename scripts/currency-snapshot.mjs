// Builds the exchange-rate channel's snapshot (src/shared/currency-data.json) from the ECB's eurofxref-hist.csv.
// Pure: the same CSV always gives the same bytes, so a day without new ECB data changes nothing.
// Rates are stored per currency (units per EUR); cross rates go through the euro: 1 FROM = (TO per EUR) / (FROM per EUR) TO.

/** Daily points shown on the pages: ECB working days in the last 90 calendar days. */
export const DAILY_DAYS = 90;

/** ECB working days, oldest first, each with the rates it published (units per 1 EUR; N/A cells left out). */
export function parseEcbCsv(text) {
  const lines = text.trim().split(/\r?\n/).map((line) => line.split(",").map((cell) => cell.trim()));
  const head = lines[0];
  if (head[0] !== "Date") throw new Error("ecb: unexpected header");
  const days = [];
  for (const cells of lines.slice(1)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cells[0])) continue;
    const rates = {};
    head.forEach((code, i) => {
      if (i === 0 || !/^[A-Z]{3}$/.test(code)) return;
      const value = Number(cells[i]);
      if (cells[i] && cells[i] !== "N/A" && Number.isFinite(value) && value > 0) rates[code] = value;
    });
    days.push({ date: cells[0], rates });
  }
  days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return days;
}

/** A number kept to n significant digits (deterministic: toPrecision, then back to a number). */
export const sig = (value, n) => Number(value.toPrecision(n));

/** A date moved by whole days or years (UTC calendar arithmetic, as text). */
function shift(date, { days = 0, years = 0 }) {
  const [y, m, d] = date.split("-").map(Number);
  const at = new Date(Date.UTC(y + years, m - 1, d + days));
  return at.toISOString().slice(0, 10);
}

const perEur = (day, code) => (code === "EUR" ? 1 : day.rates[code]);

/** The cross rate on one day, or undefined when either side is missing. */
export function crossRate(day, from, to) {
  const a = perEur(day, from);
  const b = perEur(day, to);
  return a && b ? b / a : undefined;
}

/** High, low (first day each was reached), average, first day and first rate of a window. */
export function windowStats(points) {
  let hi = points[0];
  let lo = points[0];
  let sum = 0;
  for (const point of points) {
    if (point.v > hi.v) hi = point;
    if (point.v < lo.v) lo = point;
    sum += point.v;
  }
  return { from: points[0].date, open: sig(points[0].v, 6), hi: sig(hi.v, 6), hiOn: hi.date, lo: sig(lo.v, 6), loOn: lo.date, avg: sig(sum / points.length, 6), n: points.length };
}

/** Currencies the pairs use, other than the euro, sorted. */
function pairCurrencies(pairs) {
  return [...new Set(pairs.flatMap((pair) => pair.toUpperCase().split("-")))].filter((code) => code !== "EUR").sort();
}

const sorted = (object) => Object.fromEntries(Object.entries(object).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

/**
 * The snapshot for these pairs ("usd-cny" …). Rates are stored once per currency, as the ECB publishes them (units per
 * 1 EUR): every currency on the latest day, the pairs' currencies for each day of the last 90 days and as monthly
 * averages. Cross rates are derived from those at render time; only the window stats (high, low, average over every
 * day in the window) are worked out here per pair, as they need the whole daily history.
 * Throws when a pair has no rate on the latest ECB day.
 */
export function buildCurrencySnapshot(csvText, pairs) {
  const days = parseEcbCsv(csvText);
  if (!days.length) throw new Error("ecb: no rows");
  const latest = days.at(-1);
  const asOf = latest.date;
  const dailyFrom = shift(asOf, { days: -DAILY_DAYS });
  const windows = {
    d30: shift(asOf, { days: -30 }),
    y1: shift(asOf, { years: -1 }),
    y5: shift(asOf, { years: -5 }),
  };
  const stats = {};
  for (const pair of pairs) {
    const [from, to] = pair.toUpperCase().split("-");
    const series = [];
    for (const day of days) {
      const v = crossRate(day, from, to);
      if (v !== undefined) series.push({ date: day.date, v });
    }
    if (!series.length || series.at(-1).date !== asOf) throw new Error(`ecb: no ${from}/${to} rate on ${asOf}`);
    const own = { start: series[0].date };
    for (const [key, after] of Object.entries(windows)) own[key] = windowStats(series.filter((point) => point.date > after));
    own.all = windowStats(series);
    stats[pair] = own;
  }
  const codes = pairCurrencies(pairs);
  const pick = (rates) => Object.fromEntries(codes.filter((code) => rates[code] !== undefined).map((code) => [code, rates[code]]));
  const daily = {};
  for (const day of days) if (day.date > dailyFrom) daily[day.date] = pick(day.rates);
  const sums = new Map();
  for (const day of days) {
    const key = day.date.slice(0, 7);
    const month = sums.get(key) ?? {};
    for (const code of codes) {
      const v = day.rates[code];
      if (v === undefined) continue;
      const cell = month[code] ?? { sum: 0, n: 0 };
      cell.sum += v;
      cell.n += 1;
      month[code] = cell;
    }
    sums.set(key, month);
  }
  const months = {};
  for (const [key, month] of sums) months[key] = Object.fromEntries(Object.entries(month).map(([code, cell]) => [code, sig(cell.sum / cell.n, 6)]));
  return { asOf, latest: sorted(latest.rates), stats, days: daily, months };
}

/** The snapshot as file text: one line per pair, day and month, so a daily update changes a few lines (new day, oldest day, this month, the pairs' stats). */
export function snapshotText(snapshot) {
  const block = (object) => Object.entries(object).map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(",\n");
  return `{\n "asOf": ${JSON.stringify(snapshot.asOf)},\n "latest": ${JSON.stringify(snapshot.latest)},\n "stats": {\n${block(snapshot.stats)}\n },\n "days": {\n${block(snapshot.days)}\n },\n "months": {\n${block(snapshot.months)}\n }\n}\n`;
}
