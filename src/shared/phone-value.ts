/**
 * Phone number valuation: how sought after a number is to the people who buy and sell "golden" numbers, from its digit
 * patterns alone. A rule-based estimate, not a quote: real prices depend on the carrier, the plan tied to the number,
 * and whoever is selling.
 *
 * Markets: China (11-digit mobiles, prices in CNY), Vietnam (10-digit mobiles, VND; "sim số đẹp") and elsewhere (USD).
 * The tier comes from the strongest pattern; the place inside the tier from lucky digits, how few digits are used, and
 * (China) the number 4.
 */
import { distinctDigits, logBetween, longestRun, roundEstimate, tailRun, tailShape, tailStraight, type TailShape } from "./number-pattern";
import { halfWidth } from "./factors";

export const PHONE_MARKETS = ["cn", "vn", "intl"] as const;
export type PhoneMarket = (typeof PHONE_MARKETS)[number];

export const PHONE_CURRENCY: Record<PhoneMarket, string> = { cn: "CNY", vn: "VND", intl: "USD" };

/** Price band per tier (0 ordinary … 6 seven or more of a digit at the end), in the market's currency. */
const LADDER: Record<PhoneMarket, ReadonlyArray<readonly [number, number]>> = {
  cn: [[10, 80], [80, 600], [600, 5_000], [5_000, 40_000], [40_000, 300_000], [300_000, 2_000_000], [2_000_000, 10_000_000]],
  vn: [[100_000, 500_000], [500_000, 3_000_000], [3_000_000, 20_000_000], [20_000_000, 150_000_000], [150_000_000, 1_000_000_000], [1_000_000_000, 8_000_000_000], [8_000_000_000, 40_000_000_000]],
  intl: [[0, 10], [10, 60], [60, 400], [400, 3_000], [3_000, 20_000], [20_000, 120_000], [120_000, 600_000]],
};

/** Endings that sell on their own in Vietnam: lộc phát 68/86, thần tài 39/79, ông địa 38/78, and doubled lucky digits. */
const VN_LUCKY_TAILS = new Set(["68", "86", "39", "79", "38", "78", "88", "66", "99"]);
const CN_LUCKY_TAILS = new Set(["88", "66", "99", "68", "86", "168", "518", "888", "666", "999", "1314", "520"]);

/** The 81 numbers (数理) read as lucky in the folk method that takes the last four digits mod 80. */
const NUMEROLOGY_GOOD = new Set([1, 3, 5, 6, 7, 8, 11, 13, 15, 16, 17, 18, 21, 23, 24, 25, 29, 31, 32, 33, 35, 37, 39, 41, 45, 47, 48, 52, 57, 61, 63, 65, 67, 68, 81]);

export type PhoneFeature =
  | { key: "tailRun"; n: number; digit: string }
  | { key: "straight"; n: number }
  | { key: "shape"; shape: Exclude<TailShape, null> }
  | { key: "midRun"; n: number; digit: string }
  | { key: "luckyTail"; tail: string }
  | { key: "yearTail"; year: string }
  | { key: "fours"; n: number }
  | { key: "fewDigits"; n: number }
  | { key: "plain" };

export type PhoneValue = {
  digits: string;
  market: PhoneMarket;
  /** 0 ordinary … 6 seven or more of one digit at the end. */
  tier: number;
  /** 0–100, for the gauge. */
  score: number;
  estimate: number;
  low: number;
  high: number;
  currency: string;
  features: PhoneFeature[];
  /** China: the 1–80 number from the last four digits and whether the folk table calls it lucky. */
  numerology: { n: number; good: boolean } | null;
  /** Vietnam: "nút", the last digit of the digit sum (0 reads as 10); 9 and 10 are the best. */
  nut: number | null;
};

export type PhoneError = "empty" | "invalid";

/** Digits only, with a country code (+86, 0086, +84, 0084) turned into the national form. */
export function phoneDigits(raw: string, market: PhoneMarket): string {
  let d = halfWidth(raw).replace(/\D/g, "");
  if (market === "cn") d = d.replace(/^(?:0086|86)(?=1\d{10}$)/, "");
  if (market === "vn") d = d.replace(/^(?:0084|84)(?=[35789]\d{8}$)/, "0");
  return d;
}

export function isValidPhone(digits: string, market: PhoneMarket): boolean {
  if (market === "cn") return /^1[3-9]\d{9}$/.test(digits);
  if (market === "vn") return /^0[35789]\d{8}$/.test(digits);
  return /^\d{6,15}$/.test(digits);
}

/** The market a number most likely belongs to, for the default choice: an 11-digit 1… is Chinese, a 10-digit 0… Vietnamese. */
export function guessMarket(raw: string, fallback: PhoneMarket): PhoneMarket {
  const plain = halfWidth(raw).replace(/\D/g, "");
  if (/^(?:0086|86)?1[3-9]\d{9}$/.test(plain)) return "cn";
  if (/^(?:0084|84)[35789]\d{8}$|^0[35789]\d{8}$/.test(plain)) return "vn";
  return fallback;
}

export function phoneNumerology(digits: string): { n: number; good: boolean } {
  const n = Number(digits.slice(-4)) % 80 || 80;
  return { n, good: NUMEROLOGY_GOOD.has(n) };
}

export function phoneNut(digits: string): number {
  const sum = [...digits].reduce((s, c) => s + Number(c), 0);
  return sum % 10 || 10;
}

export function valuePhone(raw: string, market: PhoneMarket): { ok: true; value: PhoneValue } | { ok: false; error: PhoneError } {
  if (!raw.trim()) return { ok: false, error: "empty" };
  const digits = phoneDigits(raw, market);
  if (!isValidPhone(digits, market)) return { ok: false, error: "invalid" };

  // The part a buyer looks at: past the carrier prefix (3 digits in China and Vietnam).
  const body = market === "intl" ? digits : digits.slice(3);
  const features: PhoneFeature[] = [];
  let tier = 0;
  let tierDigit = "";
  const lift = (t: number, digit = "") => {
    if (t > tier) {
      tier = t;
      tierDigit = digit;
    }
  };

  const run = tailRun(body);
  const last = body[body.length - 1]!;
  if (run >= 3) {
    features.push({ key: "tailRun", n: run, digit: last });
    lift(Math.min(6, run - 1), last);
  }
  const straight = tailStraight(body);
  if (straight >= 4) {
    features.push({ key: "straight", n: straight });
    lift(straight >= 6 ? 4 : straight === 5 ? 3 : 2);
  }
  const shape = tailShape(body);
  if (shape === "AAAABBBB") {
    // Two runs of four (44448888) sell above a single run of four.
    features.push({ key: "shape", shape });
    lift(4, last);
  } else if (shape && run < 4) {
    features.push({ key: "shape", shape });
    lift(shape.length >= 6 ? 3 : 2);
  }
  // A run inside the number (not at the end) counts for less.
  const inner = longestRun(body.slice(0, body.length - run));
  if (inner.length >= 4 && shape !== "AAAABBBB") {
    features.push({ key: "midRun", n: inner.length, digit: inner.digit });
    lift(inner.length >= 6 ? 3 : inner.length - 3, inner.digit);
  }
  const luckyTails = market === "vn" ? VN_LUCKY_TAILS : market === "cn" ? CN_LUCKY_TAILS : null;
  if (luckyTails) {
    const tail = [4, 3, 2].map((n) => body.slice(-n)).find((t) => luckyTails.has(t));
    if (tail && run < 3) {
      features.push({ key: "luckyTail", tail });
      lift(1);
    }
  }
  const year = Number(body.slice(-4));
  if (tier === 0 && body.length >= 6 && year >= 1950 && year <= 2030) {
    features.push({ key: "yearTail", year: body.slice(-4) });
    lift(1);
  }
  // In Chinese 4 sounds like "death": a pattern built on 4 sells a tier lower.
  if (market === "cn" && tierDigit === "4" && tier > 0) tier -= 1;

  const fours = [...body].filter((c) => c === "4").length;
  if (market === "cn" && fours >= 2) features.push({ key: "fours", n: fours });
  const few = distinctDigits(body);
  if (few <= 3 && body.length >= 7) features.push({ key: "fewDigits", n: few });
  if (!features.length) features.push({ key: "plain" });

  const lucky = market === "intl" ? 0 : [...body].filter((c) => c === "6" || c === "8" || c === "9").length / body.length;
  const luckyLead = market !== "intl" && (tierDigit === "8" || tierDigit === "9" || tierDigit === "6") ? 0.25 : 0;
  let f = 0.3 + 0.35 * lucky + 0.3 * (1 - (few - 1) / 9) + luckyLead - (run === 2 ? 0 : 0.05);
  if (market === "cn") f -= 0.12 * fours;
  // Classic China Mobile 13x prefixes carry a little more.
  if (market === "cn" && digits.startsWith("13")) f += 0.08;
  f = Math.min(1, Math.max(0, f));

  const [lo, hi] = LADDER[market][tier]!;
  const at = (x: number, spill = false) => roundEstimate(logBetween(Math.max(lo, 1), hi, x, spill));
  const estimate = at(f);
  const low = tier === 0 ? roundEstimate(lo) : at(f - 0.3, true);
  const high = at(f + 0.3, true);
  const score = Math.round(Math.min(100, tier * 14 + f * 16));
  return {
    ok: true,
    value: {
      digits,
      market,
      tier,
      score,
      estimate,
      low: Math.min(low, estimate),
      high: Math.max(high, estimate),
      currency: PHONE_CURRENCY[market],
      features,
      numerology: market === "cn" ? phoneNumerology(digits) : null,
      nut: market === "vn" ? phoneNut(digits) : null,
    },
  };
}
