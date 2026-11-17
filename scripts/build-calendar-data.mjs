// Builds src/shared/calendar-data.json: the lunisolar calendar for UTC+7 (Vietnam), UTC+8 (China, Taiwan, Hong Kong)
// and UTC+9 (Korea, Japan's kyūreki) from 1900 to 2100, plus the 24 solar terms and the moon's quarters for the years
// the calendar pages show. Everything is computed here with astronomy-engine (MIT); pages never compute astronomy.
//
//   node scripts/build-calendar-data.mjs
//
// Rules (the modern Chinese calendar, GB/T 33661-2017, applied in each zone's standard time):
// - a month starts on the local date of a new moon;
// - the month holding the winter solstice is month 11;
// - when 13 months start between two such months 11, the first of them without a major solar term
//   (sun longitude a multiple of 30°) is a leap month and repeats the number of the month before it.
import * as Astronomy from "astronomy-engine";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(root, "src/shared/calendar-data.json");
const FIRST = 1900;
const LAST = 2100;
/** Years with solar terms and moon phases on the pages. */
const DETAIL_FIRST = 2025;
const DETAIL_LAST = 2029;
const ZONES = { vn: 7, cn: 8, kr: 9 };
const DAY = 86400000;

/** Days since 1970-01-01 of the local date of `time` in UTC+offset. */
function localDay(time, offset) {
  return Math.floor((time.date.getTime() + offset * 3600000) / DAY);
}

function newMoons(fromYear, toYear) {
  const out = [];
  let t = Astronomy.MakeTime(new Date(Date.UTC(fromYear, 0, 1)));
  const end = new Date(Date.UTC(toYear, 0, 1)).getTime();
  for (;;) {
    const nm = Astronomy.SearchMoonPhase(0, t, 40);
    if (nm.date.getTime() > end) break;
    out.push(nm);
    t = nm.AddDays(20);
  }
  return out;
}

/** Instants where the sun's apparent longitude reaches a multiple of 15°, in order. */
function solarTerms(fromYear, toYear) {
  const out = [];
  for (let y = fromYear; y <= toYear; y++) {
    for (let k = 0; k < 24; k++) {
      const lon = (285 + 15 * k) % 360; // k = 0 is Minor Cold (285°) in early January
      const start = Astronomy.MakeTime(new Date(Date.UTC(y, 0, 1) + (k * 15.22 - 5) * DAY));
      const t = Astronomy.SearchSunLongitude(lon, start, 20);
      if (!t) throw new Error(`no solar term ${lon}° in ${y}`);
      out.push({ lon, time: t });
    }
  }
  return out;
}

function lunisolar(offset, moons, terms) {
  const starts = moons.map((m) => localDay(m, offset));
  const majors = terms.filter((t) => t.lon % 30 === 0).map((t) => ({ lon: t.lon, day: localDay(t.time, offset) }));
  const solstices = majors.filter((t) => t.lon === 270).map((t) => t.day);
  const monthOf = (day) => {
    let i = starts.length - 1;
    while (i >= 0 && starts[i] > day) i--;
    return i;
  };
  // month index → { num, leap }
  const label = new Map();
  for (let s = 0; s + 1 < solstices.length; s++) {
    const m0 = monthOf(solstices[s]);
    const m1 = monthOf(solstices[s + 1]);
    const count = m1 - m0;
    if (count !== 12 && count !== 13) throw new Error(`odd sui length ${count}`);
    let leapAt = -1;
    if (count === 13) {
      for (let i = m0 + 1; i < m1; i++) {
        const hasMajor = majors.some((t) => t.day >= starts[i] && t.day < starts[i + 1]);
        if (!hasMajor) { leapAt = i; break; }
      }
      if (leapAt < 0) throw new Error("13-month sui without a month lacking a major term");
    }
    let num = 11;
    for (let i = m0; i < m1; i++) {
      if (i === leapAt) label.set(i, { num: label.get(i - 1).num, leap: true });
      else {
        label.set(i, { num, leap: false });
        num = num === 12 ? 1 : num + 1;
      }
    }
  }
  // Lunar years: from each month 1 (not leap) to the next; encode start day, month lengths and the leap month.
  const years = [];
  for (let i = 0; i < starts.length - 14; i++) {
    const l = label.get(i);
    if (!l || l.num !== 1 || l.leap) continue;
    let j = i + 1;
    while (j < starts.length && !(label.get(j)?.num === 1 && !label.get(j)?.leap)) j++;
    if (j >= starts.length || !label.has(j)) break;
    const lengths = [];
    let leap = 0;
    for (let k = i; k < j; k++) {
      lengths.push(starts[k + 1] - starts[k]);
      if (label.get(k).leap) leap = label.get(k).num;
    }
    const year = new Date(starts[i] * DAY).getUTCFullYear();
    years.push({ year, start: starts[i], leap, lengths });
  }
  return years;
}

/** One lunar year as a compact string: base-36 start day (days since 1970), leap month (0–c), then a bit string of
 *  month lengths in base 36 (bit k set = month k is 30 days). */
function encodeYear(y) {
  let bits = 0;
  y.lengths.forEach((len, k) => {
    if (len !== 29 && len !== 30) throw new Error(`month of ${len} days`);
    if (len === 30) bits |= 1 << k;
  });
  return `${y.start.toString(36)}.${y.leap.toString(36)}.${bits.toString(36)}`;
}

const moons = newMoons(FIRST - 1, LAST + 2);
const terms = solarTerms(FIRST - 1, LAST + 1);
const zones = {};
for (const [id, offset] of Object.entries(ZONES)) {
  const years = lunisolar(offset, moons, terms).filter((y) => y.year >= FIRST && y.year <= LAST);
  zones[id] = { first: years[0].year, years: years.map(encodeYear) };
}

const minutes = (t) => Math.round(t.date.getTime() / 60000);
const detailTerms = terms.filter((t) => {
  const y = t.time.date.getUTCFullYear();
  return y >= DETAIL_FIRST && y <= DETAIL_LAST;
}).map((t) => [t.lon, minutes(t.time)]);

const phases = [];
{
  let q = Astronomy.SearchMoonQuarter(Astronomy.MakeTime(new Date(Date.UTC(DETAIL_FIRST, 0, 1))));
  for (;;) {
    if (q.time.date.getUTCFullYear() > DETAIL_LAST) break;
    phases.push([q.quarter, minutes(q.time)]);
    q = Astronomy.NextMoonQuarter(q);
  }
}

const data = {
  source: "Computed with astronomy-engine (MIT) by scripts/build-calendar-data.mjs",
  zones,
  detail: { from: DETAIL_FIRST, to: DETAIL_LAST },
  /** [sun longitude°, Unix minutes UTC] */
  terms: detailTerms,
  /** [quarter 0 new / 1 first quarter / 2 full / 3 last quarter, Unix minutes UTC] */
  phases,
};
const text = JSON.stringify(data) + "\n";
let old = "";
try { old = readFileSync(OUT, "utf8"); } catch {}
if (old !== text) writeFileSync(OUT, text);
console.log(`calendar data: ${Object.entries(zones).map(([k, z]) => `${k} ${z.years.length} years`).join(", ")}; ${detailTerms.length} terms; ${phases.length} phases${old === text ? " (unchanged)" : ""}`);
