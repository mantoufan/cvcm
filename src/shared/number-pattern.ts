/**
 * Digit patterns that make a phone number or a number plate sought after: a run of one digit at the end (888, 8888),
 * a straight (1234, 98765), and the two-digit shapes dealers name (AABB, ABAB, ABBA, ABCABC). Shared by the phone
 * number and licence plate valuers.
 */

/** How many times the last digit repeats at the very end: "1388888" → 5. */
export function tailRun(digits: string): number {
  if (!digits) return 0;
  const last = digits[digits.length - 1];
  let n = 0;
  for (let i = digits.length - 1; i >= 0 && digits[i] === last; i--) n++;
  return n;
}

/** The longest run of one digit anywhere, with the digit. */
export function longestRun(digits: string): { length: number; digit: string } {
  let best = { length: 0, digit: "" };
  let run = 0;
  for (let i = 0; i < digits.length; i++) {
    run = i > 0 && digits[i] === digits[i - 1] ? run + 1 : 1;
    if (run > best.length) best = { length: run, digit: digits[i]! };
  }
  return best;
}

/** The longest straight (each digit one up, or each one down) ending at the last digit: "…5678" → 4, "…4321" → 4. */
export function tailStraight(digits: string): number {
  if (digits.length < 2) return digits.length;
  const step = Number(digits[digits.length - 1]) - Number(digits[digits.length - 2]);
  if (step !== 1 && step !== -1) return 1;
  let n = 2;
  for (let i = digits.length - 2; i > 0 && Number(digits[i]) - Number(digits[i - 1]) === step; i--) n++;
  return n;
}

export type TailShape = "AAAABBBB" | "ABCDABCD" | "ABCABC" | "AABBCC" | "ABABAB" | "AABB" | "ABAB" | "ABBA" | null;

/** The named shape of the last eight, six or four digits (all different letters stand for different digits). */
export function tailShape(digits: string): TailShape {
  const eight = digits.slice(-8);
  if (eight.length === 8) {
    if (/^(\d)\1{3}(\d)\2{3}$/.test(eight) && eight[0] !== eight[7]) return "AAAABBBB";
    if (eight.slice(0, 4) === eight.slice(4) && new Set(eight.slice(0, 4)).size === 4) return "ABCDABCD";
  }
  const six = digits.slice(-6);
  if (six.length === 6) {
    const [a, b, c, d, e, f] = six;
    if (a !== b && b !== c && a !== c && a === d && b === e && c === f) return "ABCABC";
    if (a === b && c === d && e === f && a !== c && c !== e && a !== e) return "AABBCC";
    if (a !== b && a === c && c === e && b === d && d === f) return "ABABAB";
  }
  const four = digits.slice(-4);
  if (four.length === 4) {
    const [a, b, c, d] = four;
    if (a === b && c === d && a !== c) return "AABB";
    if (a === c && b === d && a !== b) return "ABAB";
    if (a === d && b === c && a !== b) return "ABBA";
  }
  return null;
}

/** Different digits used. */
export function distinctDigits(digits: string): number {
  return new Set(digits).size;
}

/**
 * A value between lo and hi on a log scale: f 0 is lo, 1 is hi. Prices spread by orders of magnitude, not linearly.
 * With `spill`, f may run past 0 or 1, so a range around an estimate at the top of its band reaches past the band.
 */
export function logBetween(lo: number, hi: number, f: number, spill = false): number {
  const x = spill ? f : Math.min(1, Math.max(0, f));
  return lo * Math.pow(hi / lo, x);
}

/** Two significant figures, so an estimate does not look more exact than it is: 12,345 → 12,000. */
export function roundEstimate(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(n)) - 1));
  return Math.round(n / p) * p;
}

/** Endings that sell on their own in Vietnam (phone numbers and plates): lộc phát 68/86, thần tài 39/79, ông địa 38/78, and doubled lucky digits. */
export const VN_LUCKY_TAILS: ReadonlySet<string> = new Set(["68", "86", "39", "79", "38", "78", "88", "66", "99"]);
export const CN_LUCKY_TAILS: ReadonlySet<string> = new Set(["88", "66", "99", "68", "86", "168", "518", "888", "666", "999", "1314", "520"]);

/** The ending (four, three or two characters) found in a list of lucky endings, longest first. */
export function luckyTail(s: string, tails: ReadonlySet<string>): string | undefined {
  return [4, 3, 2].map((n) => s.slice(-n)).find((t) => tails.has(t));
}
