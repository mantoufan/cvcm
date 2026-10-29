export type DistanceUnit = "km" | "mi";
export type Solve = "pace" | "time" | "distance";

export const KM_PER_MI = 1.609344;

/** Race distances in kilometres for the finish-time table. */
export const RACES = [
  { id: "5k", km: 5 },
  { id: "10k", km: 10 },
  { id: "half", km: 21.0975 },
  { id: "marathon", km: 42.195 },
] as const;
export type RaceId = (typeof RACES)[number]["id"];

/** "H:MM:SS", "MM:SS", "M:SS" or plain minutes → seconds; null when malformed or zero. */
export function parseTime(value: string): number | null {
  const s = value.trim();
  if (s === "") return null;
  if (/^\d+(\.\d+)?$/.test(s)) {
    const sec = Number(s) * 60;
    return sec > 0 && Number.isFinite(sec) ? sec : null;
  }
  const m = /^(?:(\d{1,3}):)?(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const hh = Number(m[1] ?? 0);
  const mm = Number(m[2]);
  const ss = Number(m[3]);
  if (mm > 59 && m[1] != null) return null;
  if (ss > 59) return null;
  const sec = hh * 3600 + mm * 60 + ss;
  return sec > 0 ? sec : null;
}

/** Seconds → "H:MM:SS" when an hour or more, else "MM:SS". */
export function formatTime(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export type PaceInput = { solve: Solve; unit: DistanceUnit; distance?: number; timeSec?: number; paceSec?: number };
export type PaceResult = {
  unit: DistanceUnit;
  distance: number;
  timeSec: number;
  /** Seconds per unit (km or mile). */
  paceSec: number;
  /** Seconds per the other unit. */
  paceOtherSec: number;
  /** Units per hour. */
  speed: number;
  races: Array<{ id: RaceId; timeSec: number }>;
};

const MAX_DISTANCE_KM = 10000;
const MAX_TIME_SEC = 100 * 3600;

export function solvePace(input: PaceInput): PaceResult | null {
  const { solve, unit } = input;
  let distance = input.distance ?? NaN;
  let timeSec = input.timeSec ?? NaN;
  let paceSec = input.paceSec ?? NaN;
  const ok = (n: number) => Number.isFinite(n) && n > 0;
  if (solve === "pace") {
    if (!ok(distance) || !ok(timeSec)) return null;
    paceSec = timeSec / distance;
  } else if (solve === "time") {
    if (!ok(distance) || !ok(paceSec)) return null;
    timeSec = distance * paceSec;
  } else {
    if (!ok(timeSec) || !ok(paceSec)) return null;
    distance = timeSec / paceSec;
  }
  const km = unit === "km" ? distance : distance * KM_PER_MI;
  if (km > MAX_DISTANCE_KM || timeSec > MAX_TIME_SEC || !ok(paceSec)) return null;
  const paceKm = unit === "km" ? paceSec : paceSec / KM_PER_MI;
  const paceOtherSec = unit === "km" ? paceSec * KM_PER_MI : paceSec / KM_PER_MI;
  return {
    unit,
    distance,
    timeSec,
    paceSec,
    paceOtherSec,
    speed: 3600 / paceSec,
    races: RACES.map((r) => ({ id: r.id, timeSec: r.km * paceKm })),
  };
}
