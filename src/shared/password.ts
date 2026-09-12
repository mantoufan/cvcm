const LOWER = "abcdefghijkmnopqrstuvwxyz";
const LOWER_ALL = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const UPPER_ALL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "23456789";
const DIGITS_ALL = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.?";
const SIMILAR = /[0OIl1]/g;

export type PasswordOpts = {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  excludeSimilar: boolean;
};

export function charsetFor(opts: PasswordOpts): string {
  let set = "";
  if (opts.lower) set += opts.excludeSimilar ? LOWER : LOWER_ALL;
  if (opts.upper) set += opts.excludeSimilar ? UPPER : UPPER_ALL;
  if (opts.digits) set += opts.excludeSimilar ? DIGITS : DIGITS_ALL;
  if (opts.symbols) set += SYMBOLS;
  if (opts.excludeSimilar) set = set.replace(SIMILAR, "");
  return [...new Set(set)].join("");
}

export function entropyBits(length: number, charsetSize: number): number {
  if (length <= 0 || charsetSize <= 1) return 0;
  return length * Math.log2(charsetSize);
}

function randIndex(max: number): number {
  if (max <= 0) return 0;
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
}

export function generatePassword(opts: PasswordOpts): string {
  const length = Math.max(4, Math.min(128, Math.round(opts.length) || 16));
  const set = charsetFor(opts);
  if (!set) return "";
  const required: string[] = [];
  const groups = [
    opts.lower ? (opts.excludeSimilar ? LOWER : LOWER_ALL) : "",
    opts.upper ? (opts.excludeSimilar ? UPPER : UPPER_ALL) : "",
    opts.digits ? (opts.excludeSimilar ? DIGITS : DIGITS_ALL) : "",
    opts.symbols ? SYMBOLS : "",
  ].map((g) => (opts.excludeSimilar ? g.replace(SIMILAR, "") : g)).filter(Boolean);
  for (const group of groups) {
    if (required.length >= length) break;
    required.push(group[randIndex(group.length)]!);
  }
  const out = required.slice();
  while (out.length < length) out.push(set[randIndex(set.length)]!);
  for (let i = out.length - 1; i > 0; i--) {
    const j = randIndex(i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out.join("");
}
