/**
 * Target archery (games3d group): the range, the target face, the arrow's flight and the round, shared by the page
 * and the tests. Pure and deterministic. Units are metres and seconds; the archer stands at z = 0 and shoots toward
 * -z, y is up (ground at 0), x is to the right. The target face hangs at z = -distance with its centre FACE_Y up.
 */
import { seeded } from "./random";

export const G = 9.81;
/** The bow's arrow height at release. */
export const RELEASE_Y = 1.5;
/** Height of the target face's centre (World Archery: 130 cm ± 5). */
export const FACE_Y = 1.3;
/** Arrow shaft radius: an arrow touching a line scores the higher ring (it "cuts" the line). */
export const ARROW_R = 0.00275;
/** The straw boss behind the face: a square this wide, centred on the face. */
export const BOSS_HALF = 0.65;
/** Arrow speed at full draw (a recurve bow), and at the lightest draw that still leaves the bow. */
export const FULL_SPEED = 60;
export const MIN_SPEED = 28;
/** Seconds of holding to reach full draw. */
export const DRAW_TIME = 0.8;
/** Fixed simulation step: at full speed an arrow moves 0.25 m per step; the face is crossed by a swept test. */
export const STEP = 1 / 240;
const DRAG = 0.0009;
/** How fast the arrow takes up the wind's speed sideways (per second). */
const WIND_GRIP = 0.16;

export const DISTANCES = [18, 30, 50, 70] as const;
export type Distance = (typeof DISTANCES)[number];

/** Face radius per distance (World Archery: 40 cm face at 18 m, 80 cm at 30 m, 122 cm at 50 and 70 m). */
export function faceRadius(d: Distance): number {
  return d === 18 ? 0.2 : d === 30 ? 0.4 : 0.61;
}

export const ENDS = 6;
export const ARROWS_PER_END = 3;

/** WA ring colours from the 1 (outside) to the 10: white, black, blue, red, gold. */
export const RING_COLORS = [0xf5f5f0, 0xf5f5f0, 0x2a2a2e, 0x2a2a2e, 0x2f8fd8, 0x2f8fd8, 0xe23b3b, 0xe23b3b, 0xf7d23a, 0xf7d23a] as const;

export interface Score {
  /** 0 (miss) to 10. */
  value: number;
  /** Inside the inner 10 (the X ring, used to break ties). */
  x: boolean;
}

/**
 * Score of an arrow whose centre lands `r` metres from the face's centre. The arrow's own width counts: touching a
 * ring line gives the higher ring.
 */
export function scoreAt(r: number, faceR: number): Score {
  const w = faceR / 10;
  const edge = Math.max(0, r - ARROW_R);
  if (edge >= faceR) return { value: 0, x: false };
  const value = Math.max(1, 10 - Math.floor(edge / w));
  return { value, x: edge <= w / 2 };
}

export function scoreLabel(s: Score): string {
  if (s.x) return "X";
  return s.value ? String(s.value) : "M";
}

// ---------------------------------------------------------------- flight

export interface Arrow {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export type Landing =
  | { kind: "face"; x: number; y: number; t: number; score: Score }
  | { kind: "boss"; x: number; y: number; t: number }
  | { kind: "ground"; x: number; z: number; t: number }
  | { kind: "lost"; t: number };

/** Draw strength 0–1 from the seconds the string has been held. */
export function drawOf(held: number): number {
  return Math.max(0, Math.min(1, held / DRAW_TIME));
}

export function speedOf(draw: number): number {
  return MIN_SPEED + (FULL_SPEED - MIN_SPEED) * Math.max(0, Math.min(1, draw));
}

/** One fixed step: gravity, a little air drag and the side wind. */
export function stepArrow(a: Arrow, wind: number, h: number): Arrow {
  const v = Math.hypot(a.vx, a.vy, a.vz);
  const k = DRAG * v;
  const vx = a.vx + (-k * a.vx + WIND_GRIP * (wind - a.vx)) * h;
  const vy = a.vy + (-k * a.vy - G) * h;
  const vz = a.vz + -k * a.vz * h;
  return { x: a.x + vx * h, y: a.y + vy * h, z: a.z + vz * h, vx, vy, vz };
}

/** Launch from the bow toward a direction given as yaw (right +) and pitch (up +), radians. */
export function launch(yaw: number, pitch: number, speed: number): Arrow {
  return {
    x: 0, y: RELEASE_Y, z: 0,
    vx: speed * Math.cos(pitch) * Math.sin(yaw),
    vy: speed * Math.sin(pitch),
    vz: -speed * Math.cos(pitch) * Math.cos(yaw),
  };
}

/**
 * Flies an arrow until it lands. The face plane is crossed with a swept test: the step that goes from in front of
 * z = -distance to behind it is cut at the crossing point, so no speed can carry an arrow through the face.
 * `path` (optional) receives the positions every `every` steps, for the page's animation.
 */
export function fly(a0: Arrow, distance: Distance, wind: number, path?: { x: number; y: number; z: number; t: number }[], every = 4): Landing {
  const fz = -distance;
  const faceR = faceRadius(distance);
  let a = a0;
  let t = 0;
  path?.push({ x: a.x, y: a.y, z: a.z, t });
  for (let i = 1; i <= 240 * 12; i++) {
    const b = stepArrow(a, wind, STEP);
    t += STEP;
    if (a.z > fz && b.z <= fz) {
      const k = (a.z - fz) / (a.z - b.z);
      const x = a.x + (b.x - a.x) * k;
      const y = a.y + (b.y - a.y) * k;
      const tc = t - STEP + STEP * k;
      const dx = x, dy = y - FACE_Y;
      const r = Math.hypot(dx, dy);
      if (r < faceR + ARROW_R) {
        path?.push({ x, y, z: fz, t: tc });
        return { kind: "face", x: dx, y: dy, t: tc, score: scoreAt(r, faceR) };
      }
      if (Math.abs(dx) <= BOSS_HALF && Math.abs(dy) <= BOSS_HALF && y > 0) {
        path?.push({ x, y, z: fz, t: tc });
        return { kind: "boss", x: dx, y: dy, t: tc };
      }
    }
    if (b.y <= 0) {
      const k = a.y / (a.y - b.y);
      const x = a.x + (b.x - a.x) * k, z = a.z + (b.z - a.z) * k;
      path?.push({ x, y: 0, z, t });
      return { kind: "ground", x, z, t };
    }
    a = b;
    if (path && i % every === 0) path.push({ x: a.x, y: a.y, z: a.z, t });
    if (a.z < fz - 60) break;
  }
  return { kind: "lost", t };
}

/**
 * The sight is set for a full draw in still air: aim (a point on the face, metres from its centre) gives the launch
 * angles that put a full-draw, windless arrow there. Releasing early drops the arrow low; the wind drifts it.
 */
export function sightFor(aimX: number, aimY: number, distance: Distance): { yaw: number; pitch: number } {
  let yaw = Math.atan2(aimX, distance);
  let pitch = Math.atan2(FACE_Y + aimY - RELEASE_Y, distance);
  for (let i = 0; i < 8; i++) {
    const at = crossing(launch(yaw, pitch, FULL_SPEED), distance, 0);
    const ex = aimX - at.x, ey = aimY - (at.y - FACE_Y);
    yaw += ex / distance;
    pitch += ey / distance;
    if (Math.hypot(ex, ey) < 1e-5) break;
  }
  return { yaw, pitch };
}

/** Where the arrow's path meets the plane of the face (ignoring the ground), for setting the sight. */
function crossing(a0: Arrow, distance: Distance, wind: number): { x: number; y: number } {
  const fz = -distance;
  let a = a0;
  for (let i = 0; i < 240 * 12; i++) {
    const b = stepArrow(a, wind, STEP);
    if (a.z > fz && b.z <= fz) {
      const k = (a.z - fz) / (a.z - b.z);
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    a = b;
  }
  return { x: a.x, y: a.y };
}

// ---------------------------------------------------------------- aiming

/** Sway amplitude (metres at 18 m; scaled by distance on the page) while holding: settles, then fatigue. */
export function swayAmplitude(held: number): number {
  if (held <= 0) return 0.05;
  if (held < 1) return 0.05 - 0.035 * held;
  if (held < 4) return 0.015;
  return Math.min(0.06, 0.015 + (held - 4) * 0.012);
}

/** Deterministic sway offset at time `t` (seconds) after `held` seconds of holding, scaled for `distance`. */
export function swayOffset(t: number, held: number, distance: Distance): { x: number; y: number } {
  const a = swayAmplitude(held) * (distance / 18) ** 0.7;
  return {
    x: a * (0.7 * Math.sin(1.9 * t) + 0.35 * Math.sin(3.3 * t + 1)),
    y: a * (0.65 * Math.cos(1.6 * t) + 0.4 * Math.sin(2.7 * t + 2)),
  };
}

/** Side wind for an end, in m/s (+ blows to the right), stronger at longer distances. */
export function windFor(seed: number, end: number, distance: Distance): number {
  const r = seeded(seed * 31 + end * 7 + 1)();
  const max = distance === 18 ? 1 : distance === 30 ? 2.5 : 4;
  return Math.round((r * 2 - 1) * max * 10) / 10;
}

// ---------------------------------------------------------------- round

export interface Round {
  distance: Distance;
  seed: number;
  /** Scores per end, in shooting order. */
  ends: Score[][];
}

export function newRound(distance: Distance, seed: number): Round {
  return { distance, seed, ends: [[]] };
}

export function currentEnd(r: Round): number {
  return r.ends.length - 1;
}

export function roundDone(r: Round): boolean {
  return r.ends.length === ENDS && r.ends[ENDS - 1]!.length === ARROWS_PER_END;
}

/** Adds an arrow; a full end opens the next one (until the last). Returns a new round. */
export function addArrow(r: Round, s: Score): Round {
  if (roundDone(r)) return r;
  const ends = r.ends.map((e) => [...e]);
  ends[ends.length - 1]!.push(s);
  if (ends[ends.length - 1]!.length === ARROWS_PER_END && ends.length < ENDS) ends.push([]);
  return { ...r, ends };
}

export function endTotal(e: readonly Score[]): number {
  return e.reduce((sum, s) => sum + s.value, 0);
}

export function roundTotal(r: Round): number {
  return r.ends.reduce((sum, e) => sum + endTotal(e), 0);
}

export function xCount(r: Round): number {
  return r.ends.reduce((n, e) => n + e.filter((s) => s.x).length, 0);
}

export function arrowsShot(r: Round): number {
  return r.ends.reduce((n, e) => n + e.length, 0);
}

export interface Best {
  score: number;
  x: number;
}

/** Saved bests per distance, checked field by field. */
export function cleanBests(raw: unknown): Partial<Record<Distance, Best>> {
  const out: Partial<Record<Distance, Best>> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const d of DISTANCES) {
    const b = (raw as Record<string, unknown>)[String(d)] as { score?: unknown; x?: unknown } | undefined;
    if (!b || typeof b.score !== "number" || typeof b.x !== "number") continue;
    const max = ENDS * ARROWS_PER_END;
    if (b.score < 0 || b.score > max * 10 || !Number.isInteger(b.score) || b.x < 0 || b.x > max || !Number.isInteger(b.x)) continue;
    out[d] = { score: b.score, x: b.x };
  }
  return out;
}

/** True when `a` beats `b` (score, then Xs). */
export function better(a: Best, b: Best | undefined): boolean {
  return !b || a.score > b.score || (a.score === b.score && a.x > b.x);
}
