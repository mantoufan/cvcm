/** Integer tools for the factor and LCM/GCF calculators. BigInt throughout, so 18-digit inputs stay exact. */

/** Inputs up to 18 digits: Pollard's rho splits any of them in well under a second. */
export const MAX_DIGITS = 18;
/** At most this many divisors are listed (the count is always exact). */
export const MAX_LISTED_DIVISORS = 1000;
export const MAX_NUMBERS = 20;

export type ParseError = "empty" | "notInteger" | "tooBig" | "notPositive";

/** The mark written between thousands: "." where the decimal mark is a comma (es, id, vi), "," elsewhere. */
export type ThousandsMark = "," | ".";

export function thousandsMarkFor(loc: string): ThousandsMark {
  return loc === "es" || loc === "id" || loc === "vi" ? "." : ",";
}

/**
 * Reads one whole number. Spaces and apostrophes may group digits; the locale's thousands mark counts only between
 * groups of three (1,234,567 in English, 1.234.567 in Spanish). The other mark is a decimal point, so 4.5 and 4.500 in
 * English, or 1,5 in Spanish, are rejected instead of being read as 45, 4500 or 15.
 */
export function parseWhole(raw: string, thousands: ThousandsMark = ","): { ok: true; n: bigint } | { ok: false; error: ParseError } {
  let s = raw.trim().replace(/[\s\u00a0\u202f_]/g, "");
  if (!s) return { ok: false, error: "empty" };
  const mark = thousands === "," ? "," : "\\.";
  if (new RegExp(`^[-−]?\\d{1,3}([${mark}'’])\\d{3}(\\1\\d{3})*$`).test(s)) s = s.replace(/[,.'’]/g, "");
  if (/^[-−]\d+$/.test(s)) return { ok: false, error: "notPositive" };
  if (!/^\d+$/.test(s)) return { ok: false, error: "notInteger" };
  const digits = s.replace(/^0+(?=\d)/, "");
  if (digits.length > MAX_DIGITS) return { ok: false, error: "tooBig" };
  return { ok: true, n: BigInt(digits) };
}

/**
 * Splits a list typed with commas, spaces, semicolons or new lines. Every comma separates numbers (12,345 is 12 and
 * 345); where the thousands mark is "." (es, id, vi), 12.345 inside one entry is still twelve thousand.
 */
export function splitNumbers(raw: string): string[] {
  return raw.split(/[\s,;，、;]+/).map((x) => x.trim()).filter(Boolean);
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let r = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) r = (r * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return r;
}

const SMALL_PRIMES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];

/** Deterministic Miller–Rabin: these 12 bases are exact for every n below 3.3 × 10^24. */
export function isPrime(n: bigint): boolean {
  if (n < 2n) return false;
  for (const p of SMALL_PRIMES) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }
  let d = n - 1n;
  let s = 0;
  while ((d & 1n) === 0n) {
    d >>= 1n;
    s++;
  }
  outer: for (const a of SMALL_PRIMES) {
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    for (let i = 1; i < s; i++) {
      x = (x * x) % n;
      if (x === n - 1n) continue outer;
    }
    return false;
  }
  return true;
}

export function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) [x, y] = [y, x % y];
  return x;
}

export function lcm(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  return (a / gcd(a, b)) * b;
}

/** Brent's variant of Pollard's rho with fixed starting values, so results never depend on chance. */
function rho(n: bigint): bigint {
  if (n % 2n === 0n) return 2n;
  for (let c = 1n; ; c++) {
    let y = 2n;
    let x = 2n;
    let g = 1n;
    let q = 1n;
    let ys = 2n;
    let r = 1;
    const m = 64;
    const f = (v: bigint) => (v * v + c) % n;
    do {
      x = y;
      for (let i = 0; i < r; i++) y = f(y);
      let k = 0;
      do {
        ys = y;
        for (let i = 0; i < Math.min(m, r - k); i++) {
          y = f(y);
          q = (q * (x > y ? x - y : y - x)) % n;
        }
        g = gcd(q, n);
        k += m;
      } while (k < r && g === 1n);
      r *= 2;
    } while (g === 1n && r < 1 << 26);
    if (g === n) {
      do {
        ys = f(ys);
        g = gcd(x > ys ? x - ys : ys - x, n);
      } while (g === 1n);
    }
    if (g !== n && g !== 1n) return g;
  }
}

export type PrimePower = { p: bigint; e: number };

/** Prime factorisation, smallest prime first. 1 has none; 0 is not factored. */
export function factorize(n: bigint): PrimePower[] {
  if (n < 2n) return [];
  const found: bigint[] = [];
  let m = n;
  for (const p of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n, 43n, 47n]) {
    while (m % p === 0n) {
      found.push(p);
      m /= p;
    }
  }
  const stack = m > 1n ? [m] : [];
  while (stack.length) {
    const x = stack.pop()!;
    if (x === 1n) continue;
    if (isPrime(x)) {
      found.push(x);
      continue;
    }
    const d = rho(x);
    stack.push(d, x / d);
  }
  found.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const out: PrimePower[] = [];
  for (const p of found) {
    const last = out[out.length - 1];
    if (last && last.p === p) last.e++;
    else out.push({ p, e: 1 });
  }
  return out;
}

export function divisorCount(f: readonly PrimePower[]): number {
  return f.reduce((acc, { e }) => acc * (e + 1), 1);
}

export function divisorSum(f: readonly PrimePower[]): bigint {
  return f.reduce((acc, { p, e }) => {
    let s = 1n;
    let pk = 1n;
    for (let i = 0; i < e; i++) {
      pk *= p;
      s += pk;
    }
    return acc * s;
  }, 1n);
}

/** All divisors in increasing order, at most `limit` of them (the smallest). */
export function divisors(f: readonly PrimePower[], limit = MAX_LISTED_DIVISORS): bigint[] {
  let list = [1n];
  for (const { p, e } of f) {
    const next: bigint[] = [];
    for (const d of list) {
      let v = d;
      for (let i = 0; i <= e; i++) {
        next.push(v);
        v *= p;
      }
    }
    list = next;
  }
  list.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return list.slice(0, limit);
}

const SUPERSCRIPT = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];

function sup(n: number): string {
  return String(n).split("").map((d) => SUPERSCRIPT[Number(d)]).join("");
}

/** 2³ × 3 × 5² ; "1" for no factors. */
export function factorText(f: readonly PrimePower[]): string {
  if (!f.length) return "1";
  return f.map(({ p, e }) => (e > 1 ? `${p}${sup(e)}` : String(p))).join(" × ");
}

/** The same with every factor written out: 2 × 2 × 2 × 3. Long lists fall back to powers. */
export function factorTextExpanded(f: readonly PrimePower[]): string {
  const total = f.reduce((s, { e }) => s + e, 0);
  if (!f.length || total > 40) return factorText(f);
  return f.flatMap(({ p, e }) => Array.from({ length: e }, () => String(p))).join(" × ");
}

export function nextPrime(n: bigint): bigint {
  let c = n < 2n ? 2n : n + 1n;
  while (!isPrime(c)) c++;
  return c;
}

export function previousPrime(n: bigint): bigint | null {
  for (let c = n - 1n; c >= 2n; c--) if (isPrime(c)) return c;
  return null;
}

/** Factor pairs a × b = n with a ≤ b, from the listed divisors. */
export function factorPairs(n: bigint, divs: readonly bigint[]): Array<[bigint, bigint]> {
  const out: Array<[bigint, bigint]> = [];
  for (const d of divs) {
    if (d * d > n) break;
    if (n % d === 0n) out.push([d, n / d]);
  }
  return out;
}

/** Euclid's steps for two numbers: a = q × b + r until r is 0. */
export function euclidSteps(a: bigint, b: bigint): Array<{ a: bigint; q: bigint; b: bigint; r: bigint }> {
  let x = a >= b ? a : b;
  let y = a >= b ? b : a;
  const steps: Array<{ a: bigint; q: bigint; b: bigint; r: bigint }> = [];
  while (y > 0n && steps.length < 200) {
    const r = x % y;
    steps.push({ a: x, q: x / y, b: y, r });
    x = y;
    y = r;
  }
  return steps;
}

/** GCF takes the lowest power of each prime in every number, LCM the highest power in any of them. */
export function gcfLcmByPrimes(factors: readonly (readonly PrimePower[])[]): { gcf: PrimePower[]; lcm: PrimePower[] } {
  const primes = new Set<bigint>();
  for (const f of factors) for (const { p } of f) primes.add(p);
  const sorted = [...primes].sort((a, b) => (a < b ? -1 : 1));
  const gcfOut: PrimePower[] = [];
  const lcmOut: PrimePower[] = [];
  for (const p of sorted) {
    const exps = factors.map((f) => f.find((x) => x.p === p)?.e ?? 0);
    const lo = Math.min(...exps);
    const hi = Math.max(...exps);
    if (lo > 0) gcfOut.push({ p, e: lo });
    if (hi > 0) lcmOut.push({ p, e: hi });
  }
  return { gcf: gcfOut, lcm: lcmOut };
}
