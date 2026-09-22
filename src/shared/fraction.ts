export type Fraction = { n: number; d: number; text: string; decimal: number };

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function pack(n: number, d: number): Fraction {
  return { n, d, text: d === 1 ? String(n) : `${n}/${d}`, decimal: n / d };
}

/** Whole numerator and denominator. Sign stays on the numerator. */
export function simplifyFraction(num: number, den: number): Fraction | null {
  if (!Number.isInteger(num) || !Number.isInteger(den) || den === 0) return null;
  let n = num;
  let d = den;
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return pack(n / g, d / g);
}

/** Continued fraction. maxDen caps the denominator (default 10_000). */
export function decimalToFraction(value: number, maxDen = 10_000): Fraction | null {
  if (!Number.isFinite(value)) return null;
  if (!Number.isInteger(maxDen) || maxDen < 1 || maxDen > 1_000_000) return null;
  const sign = value < 0 ? -1 : 1;
  const target = Math.abs(value);
  if (target > 1e15) return null;

  let prevN = 0;
  let prevD = 1;
  let n = 1;
  let d = 0;
  let x = target;

  for (let i = 0; i < 64; i++) {
    const a = Math.floor(x + 1e-12);
    const nextN = a * n + prevN;
    const nextD = a * d + prevD;
    if (nextD > maxDen) {
      if (d > 0) {
        const k = Math.floor((maxDen - prevD) / d);
        if (k > 0) {
          const semiN = k * n + prevN;
          const semiD = k * d + prevD;
          if (semiD <= maxDen && Math.abs(semiN / semiD - target) < Math.abs(n / d - target)) {
            n = semiN;
            d = semiD;
          }
        }
      }
      break;
    }
    prevN = n;
    prevD = d;
    n = nextN;
    d = nextD;
    if (d > 0 && Math.abs(n / d - target) < 1e-12) break;
    const frac = x - a;
    if (frac < 1e-12) break;
    x = 1 / frac;
  }
  if (d === 0) return null;
  return simplifyFraction(sign * n, d);
}
