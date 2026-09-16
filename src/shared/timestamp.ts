export const MIN_MS = -8_640_000_000_000_000;
export const MAX_MS = 8_640_000_000_000_000;

export type Stamp = {
  ms: number;
  seconds: string;
  milliseconds: string;
  iso: string;
  utc: string;
};

export type StampOk = { ok: true; stamp: Stamp; kind: "now" | "unix" | "date" };
export type StampErr = { ok: false; error: "empty" | "invalid" | "range" };
export type StampResult = StampOk | StampErr;

export function toStamp(ms: number): Stamp {
  const n = Math.trunc(ms);
  const d = new Date(n);
  return {
    ms: n,
    seconds: String(Math.trunc(n / 1000)),
    milliseconds: String(n),
    iso: d.toISOString(),
    utc: d.toUTCString(),
  };
}

export function unixToMs(n: number): number {
  const abs = Math.abs(n);
  if (abs >= 1e15) return n / 1000;
  if (abs >= 1e12) return n;
  return n * 1000;
}

export function parseStamp(raw: string, now = Date.now()): StampResult {
  const input = raw.trim();
  if (!input) return { ok: false, error: "empty" };
  if (/^now$/i.test(input)) {
    return inRange(now, "now");
  }
  if (/^[+-]?\d+(?:\.\d+)?$/.test(input)) {
    const n = Number(input);
    if (!Number.isFinite(n)) return { ok: false, error: "invalid" };
    return inRange(unixToMs(n), "unix");
  }
  const parsed = Date.parse(input);
  if (Number.isNaN(parsed)) return { ok: false, error: "invalid" };
  return inRange(parsed, "date");
}

function inRange(ms: number, kind: StampOk["kind"]): StampResult {
  if (!Number.isFinite(ms) || ms < MIN_MS || ms > MAX_MS) return { ok: false, error: "range" };
  return { ok: true, stamp: toStamp(ms), kind };
}
