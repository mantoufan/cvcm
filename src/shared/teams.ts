/** Random team generator: split a list of names into balanced teams with an unbiased crypto shuffle. */

export const MAX_NAMES = 500;
export const MAX_TEAMS = 50;

/** One name per line; commas also separate names. Blank entries are dropped, duplicates kept (two people can share a name). */
export function parseNames(text: string): string[] {
  return text
    .split(/[\n,，、;；]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Uniform integer in [0, n) from Web Crypto, rejecting the biased top of the range. */
export function randomBelow(n: number, rand: (buf: Uint32Array) => Uint32Array = (b) => crypto.getRandomValues(b)): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    rand(buf);
    if (buf[0]! < limit) return buf[0]! % n;
  }
}

export function shuffle<T>(items: readonly T[], below: (n: number) => number = randomBelow): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = below(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** How many teams: "count" asks for that many teams, "size" for teams of about that many people. */
export function teamCount(names: number, mode: "count" | "size", value: number): number {
  if (names <= 0 || !Number.isInteger(value) || value < 1) return 0;
  const n = mode === "count" ? value : Math.ceil(names / value);
  return Math.min(n, names, MAX_TEAMS);
}

/** Deals shuffled names round-robin, so team sizes differ by at most one. */
export function makeTeams(names: readonly string[], count: number, below?: (n: number) => number): string[][] {
  if (count < 1) return [];
  const teams: string[][] = Array.from({ length: count }, () => []);
  // Which teams get the extra person is random too, not always the first ones.
  const order = shuffle(teams.map((_, i) => i), below);
  shuffle(names, below).forEach((name, i) => teams[order[i % count]!]!.push(name));
  return teams;
}
