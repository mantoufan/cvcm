const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Convert an integer written in `from` base into `to` base. Bases are 2–36. */
export function convertRadix(raw: string, from: number, to: number): string | null {
  if (!Number.isInteger(from) || !Number.isInteger(to)) return null;
  if (from < 2 || from > 36 || to < 2 || to > 36) return null;
  const text = raw.trim();
  if (!text || text.length > 66) return null;
  let body = text;
  let negative = false;
  if (body[0] === "+" || body[0] === "-") {
    negative = body[0] === "-";
    body = body.slice(1);
  }
  if (!body || body.length > 64) return null;
  const allowed = ALPHABET.slice(0, from);
  const lower = body.toLowerCase();
  if (![...lower].every((ch) => allowed.includes(ch))) return null;

  let value = 0n;
  const base = BigInt(from);
  for (const ch of lower) value = value * base + BigInt(ALPHABET.indexOf(ch));
  if (value === 0n) return "0";

  const dest = BigInt(to);
  let out = "";
  let rest = value;
  while (rest > 0n) {
    out = ALPHABET[Number(rest % dest)] + out;
    rest /= dest;
  }
  return (negative ? "-" : "") + out.toUpperCase();
}
