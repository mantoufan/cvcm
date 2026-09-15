export const MAX_TEXT = 20_000;
export const MAX_MATCHES = 200;
export const FLAG_ORDER = ["g", "i", "m", "s", "u"] as const;
export type FlagChar = (typeof FLAG_ORDER)[number];
export type RegexFlags = Record<FlagChar, boolean>;

export type RegexMatch = {
  index: number;
  text: string;
  groups: string[];
};

export type RegexOk = {
  ok: true;
  flags: string;
  matches: RegexMatch[];
  replaced: string | null;
  truncated: boolean;
};

export type RegexErr = { ok: false; error: string };
export type RegexResult = RegexOk | RegexErr;

export function normalizeFlags(flags: string | Partial<RegexFlags>): string {
  const set = new Set<string>();
  if (typeof flags === "string") {
    for (const ch of flags) {
      if ((FLAG_ORDER as readonly string[]).includes(ch)) set.add(ch);
    }
  } else {
    for (const ch of FLAG_ORDER) {
      if (flags[ch]) set.add(ch);
    }
  }
  return FLAG_ORDER.filter((ch) => set.has(ch)).join("");
}

export function runRegex(
  pattern: string,
  flags: string | Partial<RegexFlags>,
  text: string,
  replacement: string | null = null,
): RegexResult {
  if (!pattern) return { ok: false, error: "empty-pattern" };
  const flagStr = normalizeFlags(flags);
  const truncated = text.length > MAX_TEXT;
  const body = truncated ? text.slice(0, MAX_TEXT) : text;
  try {
    void new RegExp(pattern, flagStr);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "invalid-regex" };
  }
  const matches: RegexMatch[] = [];
  const findRe = new RegExp(pattern, flagStr);
  if (findRe.global) {
    let m: RegExpExecArray | null;
    while ((m = findRe.exec(body)) !== null) {
      matches.push({ index: m.index, text: m[0], groups: m.slice(1) });
      if (m[0].length === 0) {
        findRe.lastIndex += 1;
        if (findRe.lastIndex > body.length) break;
      }
      if (matches.length >= MAX_MATCHES) break;
    }
  } else {
    const m = findRe.exec(body);
    if (m) matches.push({ index: m.index, text: m[0], groups: m.slice(1) });
  }
  let replaced: string | null = null;
  if (replacement !== null) {
    try {
      replaced = body.replace(new RegExp(pattern, flagStr), replacement);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "replace-failed" };
    }
  }
  return { ok: true, flags: flagStr, matches, replaced, truncated };
}
