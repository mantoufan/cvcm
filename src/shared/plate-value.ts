/**
 * Licence plate valuation from the plate's own characters.
 *
 * - UK (GBP): DVLA registrations are bought and sold. Shorter is dearer; dateless marks (no age identifier, such as
 *   "1 A", "ABC 1") are dearest; then prefix (A123 BCD) and suffix (ABC 123D) marks; current marks (AB12 CDE) least.
 * - Vietnam (VND): plates have been sold at public auction since 2023; ngũ quý (five of a digit, 51K-888.88) reached
 *   tens of billions of dong, tứ quý, sảnh (straights) and tam hoa follow.
 * - Mainland China (CNY): plates cannot be sold on their own, so this is a notional "how good is the number" figure.
 *
 * A rule-based estimate, not an appraisal: names and words spelt by a UK mark, a buyer's own initials, and auction day
 * moves real prices more than any rule can.
 */
import { distinctDigits, logBetween, roundEstimate, tailRun, tailShape, tailStraight, type TailShape } from "./number-pattern";
import { halfWidth } from "./factors";
import { CN_LUCKY_TAILS, VN_LUCKY_TAILS } from "./phone-value";

export const PLATE_MARKETS = ["uk", "vn", "cn"] as const;
export type PlateMarket = (typeof PLATE_MARKETS)[number];
export const PLATE_CURRENCY: Record<PlateMarket, string> = { uk: "GBP", vn: "VND", cn: "CNY" };

export type UkFormat = "dateless" | "prefix" | "suffix" | "current";

export type PlateFeature =
  | { key: "ukFormat"; format: UkFormat; length: number }
  | { key: "singleOne" }
  | { key: "sameLetters" }
  | { key: "sameDigits" }
  | { key: "tailRun"; n: number; digit: string }
  | { key: "straight"; n: number }
  | { key: "shape"; shape: Exclude<TailShape, null> }
  | { key: "luckyTail"; tail: string }
  | { key: "bigCity" }
  | { key: "letters" }
  | { key: "plain" };

export type PlateValue = {
  plate: string;
  market: PlateMarket;
  tier: number;
  score: number;
  estimate: number;
  low: number;
  high: number;
  currency: string;
  features: PlateFeature[];
};

export type PlateError = "empty" | "invalid";

const CN_PROVINCES = "京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼";
/** Province, city letter, then 5 characters, or a new-energy 6: D/F + letter or digit + 4 digits, or 5 digits + D/F. */
const CN_RE = new RegExp(`^([${CN_PROVINCES}])?([A-HJ-NP-Z])([A-HJ-NP-Z0-9]{5}|[DF][A-HJ-NP-Z0-9]\\d{4}|\\d{5}[DF])$`);
/** Province code, series letters, then 4–6 digits: six is a series digit + the 5-digit serial (29-B1 123.45). */
const VN_RE = /^(\d{2})([A-Z]{1,2})(\d{4,6})$/;
/** Hanoi (29–33, 40) and Ho Chi Minh City (41, 50–59) plates draw the most bidders. */
const VN_BIG = /^(29|30|31|32|33|40|41|50|51|52|53|54|55|56|57|58|59)$/;

/** What people put between parts of a plate: spaces, dots, hyphens, middle dots, underscores. */
const SEP = "\\s.\\-·•・_";

const SEP_RE = new RegExp(`[${SEP}]`, "g");
/** A Vietnamese plate with a separator after the series digit (29B1-8888): the serial starts after it. */
const VN_SPLIT_RE = new RegExp(`^\\d{2}[${SEP}]*[A-Z]{1,2}\\d[${SEP}]+[\\d${SEP}]+$`);

/** Upper case, with the separators taken out (and full-width forms from CJK input). */
export function normalizePlate(raw: string): string {
  return halfWidth(raw).toUpperCase().replace(SEP_RE, "");
}

export function ukFormat(p: string): UkFormat | null {
  if (/^[A-Z]{2}\d{2}[A-Z]{3}$/.test(p)) return "current";
  if (/^[A-Z]\d{1,3}[A-Z]{3}$/.test(p)) return "prefix";
  if (/^[A-Z]{3}\d{1,3}[A-Z]$/.test(p)) return "suffix";
  if (/^(\d{1,4}[A-Z]{1,3}|[A-Z]{1,3}\d{1,4})$/.test(p)) return "dateless";
  return null;
}

/** Guess the market from the plate's shape, for the default choice. */
export function guessPlateMarket(raw: string, fallback: PlateMarket): PlateMarket {
  const p = normalizePlate(raw);
  if (/[一-鿿]/.test(p) || /^[A-HJ-NP-Z][A-HJ-NP-Z0-9]{5,6}$/.test(p) && /\d{4}/.test(p) && !ukFormat(p)) return "cn";
  if (VN_RE.test(p)) return "vn";
  if (ukFormat(p)) return "uk";
  return fallback;
}

type Scored = { tier: number; f: number; features: PlateFeature[] };

const UK_BANDS: Record<UkFormat, ReadonlyArray<readonly [number, number]>> = {
  // by total characters: 2, 3, 4, 5, 6, 7
  dateless: [[80_000, 450_000], [8_000, 60_000], [2_500, 15_000], [1_000, 5_000], [500, 3_000], [500, 3_000]],
  // by digits in the mark: 1, 2, 3
  prefix: [[600, 3_500], [350, 1_500], [250, 700]],
  suffix: [[600, 3_500], [350, 1_500], [250, 700]],
  current: [[250, 1_200]],
};

function scoreUk(p: string, format: UkFormat): { band: readonly [number, number]; f: number; features: PlateFeature[] } {
  const digits = p.replace(/\D/g, "");
  const letters = p.replace(/\d/g, "");
  const features: PlateFeature[] = [{ key: "ukFormat", format, length: p.length }];
  let f = 0.3;
  if (format === "current") {
    // A current mark's own letters (AB12 CDE → CDE) all the same, or a repeated age pair (11, 22…).
    if (new Set(p.slice(4)).size === 1) {
      features.push({ key: "sameLetters" });
      f += 0.4;
    }
    if (p[2] === p[3]) {
      features.push({ key: "sameDigits" });
      f += 0.2;
    }
  } else if (digits === "1") {
    features.push({ key: "singleOne" });
    f += 0.45;
  } else if (digits.length >= 2 && distinctDigits(digits) === 1) {
    features.push({ key: "sameDigits" });
    f += 0.25;
  }
  if (format !== "current" && letters.length >= 2 && new Set(letters).size === 1) {
    features.push({ key: "sameLetters" });
    f += 0.25;
  }
  const band = format === "dateless"
    ? UK_BANDS.dateless[Math.min(5, p.length - 2)]!
    : format === "current"
      ? UK_BANDS.current[0]!
      : UK_BANDS[format][digits.length - 1]!;
  return { band, f, features };
}

/** Patterns in the serial number of a Vietnamese or Chinese plate. */
function scoreSerial(serial: string, lucky: ReadonlySet<string> | null): Scored {
  const features: PlateFeature[] = [];
  let tier = 0;
  let tierDigit = "";
  const lift = (t: number, d = "") => {
    if (t > tier) {
      tier = t;
      tierDigit = d;
    }
  };
  const run = tailRun(serial);
  const last = serial[serial.length - 1]!;
  const allDigits = /^\d+$/.test(serial);
  if (run >= 3 && /\d/.test(last)) {
    features.push({ key: "tailRun", n: run, digit: last });
    // Five of a digit is the top; four, then three ("tam hoa").
    lift(run >= 5 ? 4 : run === 4 ? 3 : 2, last);
  }
  const straight = /\d$/.test(serial) ? tailStraight(serial.replace(/^.*?(\d+)$/, "$1")) : 0;
  if (straight >= 4) {
    features.push({ key: "straight", n: straight });
    lift(straight >= 5 ? 3 : 2);
  }
  const shape = run >= 4 ? null : tailShape(serial);
  if (shape) {
    features.push({ key: "shape", shape });
    lift(2);
  }
  if (lucky && run < 3) {
    const tail = serial.slice(-2);
    if (lucky.has(tail)) {
      features.push({ key: "luckyTail", tail });
      lift(1);
    }
  }
  if (!allDigits) features.push({ key: "letters" });
  const digits = serial.replace(/\D/g, "");
  const luckyShare = digits ? [...digits].filter((c) => c === "8" || c === "9" || c === "6").length / digits.length : 0;
  let f = 0.25 + 0.35 * luckyShare + 0.2 * (1 - (distinctDigits(digits || "0") - 1) / 9);
  if (tierDigit === "8" || tierDigit === "9") f += 0.3;
  else if (tierDigit === "6") f += 0.15;
  else if (tierDigit === "4" || tierDigit === "7") f -= 0.15;
  if (!allDigits) f -= 0.2;
  return { tier, f, features };
}

const VN_LADDER: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [40_000_000, 150_000_000],
  [150_000_000, 700_000_000],
  [700_000_000, 4_000_000_000],
  [4_000_000_000, 35_000_000_000],
];
const CN_LADDER: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [2_000, 10_000],
  [10_000, 60_000],
  [60_000, 400_000],
  [400_000, 3_000_000],
];

export function valuePlate(raw: string, market: PlateMarket): { ok: true; value: PlateValue } | { ok: false; error: PlateError } {
  if (!raw.trim()) return { ok: false, error: "empty" };
  const p = normalizePlate(raw);
  let band: readonly [number, number];
  let tier: number;
  let f: number;
  let features: PlateFeature[];

  if (market === "uk") {
    const format = ukFormat(p);
    if (!format) return { ok: false, error: "invalid" };
    const s = scoreUk(p, format);
    ({ band, f, features } = s);
    tier = format === "dateless" ? Math.max(1, 6 - p.length) : format === "current" ? 0 : 4 - p.replace(/\D/g, "").length;
  } else if (market === "vn") {
    const m = VN_RE.exec(p);
    if (!m) return { ok: false, error: "invalid" };
    // A separator after a series digit marks where the serial starts (29B1-8888 is series B1, serial 8888);
    // without one, six digits are a series digit and a 5-digit serial and fewer are all serial.
    const split = VN_SPLIT_RE.test(halfWidth(raw).toUpperCase().trim());
    const serial = split ? m[3]!.slice(1) : m[3]!.length === 6 ? m[3]!.slice(1) : m[3]!;
    if (serial.length < 4) return { ok: false, error: "invalid" };
    const s = scoreSerial(serial, VN_LUCKY_TAILS);
    ({ tier, f, features } = s);
    // A four-digit serial (older plates) is not auctioned the same way: one tier lower.
    if (serial.length === 4 && tier > 0) tier -= 1;
    if (VN_BIG.test(m[1]!) && tier > 0) {
      features.push({ key: "bigCity" });
      f += 0.15;
    }
    band = VN_LADDER[tier]!;
  } else {
    const m = CN_RE.exec(p);
    if (!m) return { ok: false, error: "invalid" };
    const s = scoreSerial(m[3]!, CN_LUCKY_TAILS);
    ({ tier, f, features } = s);
    band = CN_LADDER[tier]!;
  }
  if (!features.length) features.push({ key: "plain" });
  f = Math.min(1, Math.max(0, f));
  const [lo, hi] = band;
  const at = (x: number, spill = false) => (hi === 0 ? 0 : roundEstimate(logBetween(lo, hi, x, spill)));
  const estimate = at(f);
  const score = Math.round(Math.min(100, (market === "uk" ? tier * 18 : tier * 22) + f * 12));
  return {
    ok: true,
    value: {
      plate: p,
      market,
      tier,
      score,
      estimate,
      low: Math.min(at(f - 0.3, true), estimate),
      high: Math.max(at(f + 0.3, true), estimate),
      currency: PLATE_CURRENCY[market],
      features,
    },
  };
}
