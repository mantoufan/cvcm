// Builds the exchange-rate channel's snapshot (src/shared/currency-data.json) from the ECB's eurofxref-hist.csv.
// Pure: the same CSV always gives the same bytes, so a day without new ECB data changes nothing.
// Cross rates go through the euro: 1 FROM = (TO per EUR) / (FROM per EUR) TO.

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

/** The snapshot object for these pairs ("usd-cny" …). Throws when a pair has no rate on the latest ECB day. */
export function buildCurrencySnapshot(csvText, pairs) {
  const days = parseEcbCsv(csvText);
  if (!days.length) throw new Error("ecb: no rows");
  const latest = days.at(-1);
  const asOf = latest.date;
  const dailyFrom = shift(asOf, { days: -DAILY_DAYS });
  const recent = days.filter((day) => day.date > dailyFrom);
  const windows = {
    d30: shift(asOf, { days: -30 }),
    y1: shift(asOf, { years: -1 }),
    y5: shift(asOf, { years: -5 }),
  };
  const out = {};
  for (const pair of pairs) {
    const [from, to] = pair.toUpperCase().split("-");
    const series = [];
    for (const day of days) {
      const v = crossRate(day, from, to);
      if (v !== undefined) series.push({ date: day.date, v });
    }
    if (!series.length || series.at(-1).date !== asOf) throw new Error(`ecb: no ${from}/${to} rate on ${asOf}`);
    const months = new Map();
    for (const point of series) {
      const key = point.date.slice(0, 7);
      const month = months.get(key) ?? { sum: 0, n: 0 };
      month.sum += point.v;
      month.n += 1;
      months.set(key, month);
    }
    const stats = {};
    for (const [key, after] of Object.entries(windows)) stats[key] = windowStats(series.filter((point) => point.date > after));
    stats.all = windowStats(series);
    out[pair] = {
      rate: sig(series.at(-1).v, 6),
      start: series[0].date,
      m0: series[0].date.slice(0, 7),
      monthly: [...months.values()].map((month) => sig(month.sum / month.n, 5)),
      daily: recent.map((day) => {
        const v = crossRate(day, from, to);
        return v === undefined ? null : sig(v, 6);
      }),
      stats,
    };
  }
  const rates = Object.fromEntries(Object.entries(latest.rates).sort(([a], [b]) => (a < b ? -1 : 1)));
  return { asOf, latest: rates, days: recent.map((day) => day.date), pairs: out };
}

/** The snapshot as file text: one line per pair, so a daily update is a small diff. */
export function snapshotText(snapshot) {
  const pairs = Object.entries(snapshot.pairs).map(([pair, data]) => `  ${JSON.stringify(pair)}: ${JSON.stringify(data)}`);
  return `{\n "asOf": ${JSON.stringify(snapshot.asOf)},\n "latest": ${JSON.stringify(snapshot.latest)},\n "days": ${JSON.stringify(snapshot.days)},\n "pairs": {\n${pairs.join(",\n")}\n }\n}\n`;
}
