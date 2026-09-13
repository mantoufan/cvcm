export const COMMON_ZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

export function listTimeZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  const all = intl.supportedValuesOf?.("timeZone") ?? [...COMMON_ZONES];
  const extra = COMMON_ZONES.filter((z) => !all.includes(z));
  return [...COMMON_ZONES, ...all.filter((z) => !(COMMON_ZONES as readonly string[]).includes(z)), ...extra];
}

export function guessTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function zoneParts(date: Date, timeZone: string): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  return map;
}

export function offsetMs(date: Date, timeZone: string): number {
  const p = zoneParts(date, timeZone);
  const hour = Number(p.hour) % 24;
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    hour,
    Number(p.minute),
    Number(p.second),
  );
  return asUtc - date.getTime();
}

export function wallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  let t = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 3; i++) {
    const off = offsetMs(new Date(t), timeZone);
    t = Date.UTC(year, month - 1, day, hour, minute, second) - off;
  }
  return new Date(t);
}

export function formatInZone(date: Date, timeZone: string): string {
  const p = zoneParts(date, timeZone);
  const hour = String(Number(p.hour) % 24).padStart(2, "0");
  return `${p.year}-${p.month}-${p.day} ${hour}:${p.minute}:${p.second}`;
}

export function offsetLabel(date: Date, timeZone: string): string {
  const ms = offsetMs(date, timeZone);
  const sign = ms >= 0 ? "+" : "-";
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  return `UTC${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export type ConvertedTime = {
  utc: Date;
  formatted: string;
  offset: string;
  iso: string;
};

export function convertWallTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  fromZone: string,
  toZone: string,
): ConvertedTime {
  const utc = wallTimeToUtc(year, month, day, hour, minute, second, fromZone);
  return {
    utc,
    formatted: formatInZone(utc, toZone),
    offset: offsetLabel(utc, toZone),
    iso: utc.toISOString(),
  };
}
