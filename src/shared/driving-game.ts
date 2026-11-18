import { formatClock } from "./game-clock";
import { seeded } from "./random";

/**
 * Driving game (games3d group): pure track, car and scoring logic. Units are metres and seconds; the car drives on the
 * x/z plane, heading 0 points along +z and grows towards +x. Everything here is deterministic so the same input gives
 * the same lap on any device: the page steps the car in fixed 1/120 s substeps (`advance`).
 */

export const TRACK_COUNT = 3;
export const TRACK_SEEDS = [11, 23, 37] as const;
export const TRACK_WIDTH = 12;
/** Grass between the road edge and the tyre wall. */
export const RUNOFF = 7;
export const SAMPLES = 480;
export const CHECKPOINTS = 8;
/** A checkpoint counts while the car is within this many samples after it (about 10 m). */
export const CP_WINDOW = 8;
export const LAPS = 3;
export const DRIFT_SECONDS = 60;

export interface Vec2 { x: number; z: number }

export interface Track {
  index: number;
  /** Centre line, closed (the last point connects back to the first). */
  points: Vec2[];
  /** Unit tangent at each point, in driving direction. */
  tangents: Vec2[];
  length: number;
  width: number;
  /** Sample index of each checkpoint; checkpoints[0] = 0 is the start / finish line. */
  checkpoints: number[];
  /** Cone positions beside the road. */
  cones: Vec2[];
}

/** Centripetal-free uniform Catmull-Rom between p1 and p2. */
function catmull(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return { x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) };
}

/** One of the three fixed circuits: jittered points around a circle, smoothed into a closed loop. */
export function buildTrack(index: number): Track {
  const i = ((index % TRACK_COUNT) + TRACK_COUNT) % TRACK_COUNT;
  const rand = seeded(TRACK_SEEDS[i]!);
  const n = 10 + Math.floor(rand() * 5);
  const base = 95 + i * 18;
  const ctrl: Vec2[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + (rand() - 0.5) * (Math.PI / n) * 0.6;
    const r = base * (0.72 + rand() * 0.42);
    // Stretch the loop a little so it is not a plain circle.
    ctrl.push({ x: Math.sin(a) * r * 1.25, z: Math.cos(a) * r });
  }
  // Dense curve, then resample to even spacing so a sample index measures distance.
  const dense: Vec2[] = [];
  const per = 60;
  for (let k = 0; k < n; k++) {
    const p0 = ctrl[(k - 1 + n) % n]!, p1 = ctrl[k]!, p2 = ctrl[(k + 1) % n]!, p3 = ctrl[(k + 2) % n]!;
    for (let s = 0; s < per; s++) dense.push(catmull(p0, p1, p2, p3, s / per));
  }
  const cum = [0];
  for (let k = 1; k <= dense.length; k++) {
    const a = dense[k - 1]!, b = dense[k % dense.length]!;
    cum.push(cum[k - 1]! + Math.hypot(b.x - a.x, b.z - a.z));
  }
  const length = cum[dense.length]!;
  const points: Vec2[] = [];
  let j = 0;
  for (let s = 0; s < SAMPLES; s++) {
    const d = (s / SAMPLES) * length;
    while (cum[j + 1]! < d) j++;
    const a = dense[j]!, b = dense[(j + 1) % dense.length]!;
    const t = (d - cum[j]!) / (cum[j + 1]! - cum[j]! || 1);
    points.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
  }
  const tangents = points.map((_, s) => {
    const a = points[(s - 1 + SAMPLES) % SAMPLES]!, b = points[(s + 1) % SAMPLES]!;
    const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return { x: (b.x - a.x) / l, z: (b.z - a.z) / l };
  });
  const checkpoints = Array.from({ length: CHECKPOINTS }, (_, c) => Math.round((c * SAMPLES) / CHECKPOINTS));
  const cones: Vec2[] = [];
  for (let c = 0; c < 10; c++) {
    const s = Math.floor(((c + 0.5) * SAMPLES) / 10);
    const p = points[s]!, tg = tangents[s]!;
    const side = c % 2 ? 1 : -1;
    const off = TRACK_WIDTH / 2 + 1.6;
    cones.push({ x: p.x + tg.z * off * side, z: p.z - tg.x * off * side });
  }
  return { index: i, points, tangents, length, width: TRACK_WIDTH, checkpoints, cones };
}

export interface Located {
  index: number;
  /** Signed distance from the centre line (positive = right of the driving direction). */
  lateral: number;
}

/** Nearest centre-line sample; `hint` (last index) keeps the search local and stops it jumping across the infield. */
export function locate(track: Track, x: number, z: number, hint = -1): Located {
  let best = 0;
  let bestD = Infinity;
  const scan = (s: number) => {
    const p = track.points[s]!;
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bestD) { bestD = d; best = s; }
  };
  if (hint >= 0) for (let o = -40; o <= 40; o++) scan((hint + o + SAMPLES) % SAMPLES);
  if (hint < 0 || bestD > (TRACK_WIDTH + RUNOFF * 2) ** 2) for (let s = 0; s < SAMPLES; s++) scan(s);
  const p = track.points[best]!, tg = track.tangents[best]!;
  // Signed offset along (tz, -tx), which is the driver's LEFT in three's right-handed y-up frame (screen left for
  // the chase camera). Walls and kerbs are symmetric, so only the size matters today.
  const lateral = (x - p.x) * tg.z - (z - p.z) * tg.x;
  return { index: best, lateral };
}

export interface Car {
  x: number;
  z: number;
  heading: number;
  vx: number;
  vz: number;
  /** Front wheel angle (radians), eased towards the input. */
  steer: number;
}

export interface Input {
  throttle: boolean;
  brake: boolean;
  /** -1 left … 1 right. */
  steer: number;
  handbrake: boolean;
}

export const NO_INPUT: Input = { throttle: false, brake: false, steer: 0, handbrake: false };

export const TOP_SPEED = 44;
export const OFFROAD_TOP = 17;
const ACCEL = 14;
const BRAKE = 26;
const REVERSE_TOP = 9;
const WHEELBASE = 2.6;
const MAX_STEER = 0.55;
const GRIP = 9;
const SLIDE_GRIP = 1.1;
export const STEP = 1 / 120;

export function carAt(track: Track, sample = 0): Car {
  const p = track.points[sample]!, tg = track.tangents[sample]!;
  return { x: p.x, z: p.z, heading: Math.atan2(tg.x, tg.z), vx: 0, vz: 0, steer: 0 };
}

export function speedOf(car: Car): number {
  return Math.hypot(car.vx, car.vz);
}

/** Forward speed (negative when reversing). */
export function forwardSpeed(car: Car): number {
  return car.vx * Math.sin(car.heading) + car.vz * Math.cos(car.heading);
}

/** Angle between where the car points and where it moves, in degrees (0 when nearly stopped). */
export function slipAngle(car: Car): number {
  const s = speedOf(car);
  if (s < 2) return 0;
  const f = Math.abs(forwardSpeed(car));
  const lat = Math.abs(car.vx * Math.cos(car.heading) - car.vz * Math.sin(car.heading));
  return (Math.atan2(lat, f) * 180) / Math.PI;
}

/** One physics step of `dt` seconds. Pure: returns a new car. */
export function step(car: Car, input: Input, dt: number, onRoad: boolean): Car {
  const sin = Math.sin(car.heading), cos = Math.cos(car.heading);
  let vf = car.vx * sin + car.vz * cos;
  let vl = car.vx * cos - car.vz * sin;
  const top = onRoad ? TOP_SPEED : OFFROAD_TOP;
  if (input.throttle) {
    if (vf < top) vf += ACCEL * dt * Math.max(0.1, 1 - (vf / top) ** 2);
  }
  if (input.brake) {
    if (vf > 0.5) vf = Math.max(0, vf - BRAKE * dt);
    else if (vf > -REVERSE_TOP) vf -= ACCEL * 0.5 * dt;
  }
  // Rolling drag and air drag; grass drags much harder and caps the speed.
  const drag = onRoad ? 0.03 : 0.9;
  vf -= vf * drag * dt + Math.sign(vf) * Math.min(Math.abs(vf), (onRoad ? 0.6 : 2) * dt);
  if (vf > top) vf += (top - vf) * Math.min(1, 2.5 * dt);
  if (input.handbrake) vf -= vf * 0.6 * dt;
  // Less lock at speed so the car stays drivable on a keyboard.
  const speed = Math.abs(vf);
  const target = input.steer * MAX_STEER / (1 + speed / 22);
  const steer = car.steer + (target - car.steer) * Math.min(1, 10 * dt);
  let yaw = (vf * Math.tan(steer)) / WHEELBASE;
  // Hard steering at speed or the handbrake lets the rear step out.
  const hard = Math.abs(input.steer) > 0.8 && speed > 24;
  const grip = input.handbrake ? SLIDE_GRIP : hard ? GRIP * 0.4 : GRIP;
  if (input.handbrake && speed > 6) yaw *= 1.45;
  const heading = car.heading + yaw * dt;
  // Velocity keeps its world direction while the body turns, then sideways speed bleeds off by grip.
  const vx0 = vf * sin + vl * cos;
  const vz0 = vf * cos - vl * sin;
  const s2 = Math.sin(heading), c2 = Math.cos(heading);
  vf = vx0 * s2 + vz0 * c2;
  vl = (vx0 * c2 - vz0 * s2) * Math.exp(-grip * dt);
  const vx = vf * s2 + vl * c2;
  const vz = vf * c2 - vl * s2;
  return { x: car.x + vx * dt, z: car.z + vz * dt, heading, vx, vz, steer };
}

export interface World {
  car: Car;
  /** Last located sample. */
  index: number;
  lateral: number;
  onRoad: boolean;
  /** Set when the car touched the tyre wall during this advance. */
  hit: boolean;
}

/** Steps the car `dt` seconds in fixed substeps, keeping it inside the tyre walls. */
export function advance(track: Track, world: World, input: Input, dt: number): World {
  let { car, index, lateral, onRoad } = world;
  let hit = false;
  let left = dt;
  const wall = track.width / 2 + RUNOFF;
  while (left > 1e-9) {
    const h = Math.min(STEP, left);
    left -= h;
    car = step(car, input, h, onRoad);
    const loc = locate(track, car.x, car.z, index);
    index = loc.index;
    lateral = loc.lateral;
    if (Math.abs(lateral) > wall) {
      // Push back inside. The part of the velocity into the wall bounces back a little (so the car leaves the wall
      // instead of hitting it again every substep), and the scrape takes speed along the wall too.
      const tg = track.tangents[index]!, p = track.points[index]!;
      const side = Math.sign(lateral);
      const back = wall - 0.2;
      const nx = tg.z * side, nz = -tg.x * side;
      const into = car.vx * nx + car.vz * nz;
      const bounce = into > 0 ? into * 1.2 : 0;
      // Only the sideways position is clamped; the car keeps its place along the track (no snap to the sample).
      const along = (car.x - p.x) * tg.x + (car.z - p.z) * tg.z;
      car = {
        ...car,
        x: p.x + tg.x * along + nx * back,
        z: p.z + tg.z * along + nz * back,
        vx: (car.vx - nx * bounce) * 0.6,
        vz: (car.vz - nz * bounce) * 0.6,
      };
      lateral = back * side;
      hit = true;
    }
    onRoad = Math.abs(lateral) <= track.width / 2 + 0.5;
  }
  return { car, index, lateral, onRoad, hit: world.hit || hit };
}

export function startWorld(track: Track): World {
  return { car: carAt(track, 0), index: 0, lateral: 0, onRoad: true, hit: false };
}

export interface Laps {
  /** Next checkpoint to pass (0 = the finish line). */
  next: number;
  /** Completed laps. */
  lap: number;
}

export function startLaps(): Laps {
  return { next: 1, lap: 0 };
}

function inWindow(index: number, cp: number): boolean {
  const d = (index - cp + SAMPLES) % SAMPLES;
  return d < CP_WINDOW;
}

/** Updates lap progress for the car at `index`. `lapDone` is true when the finish line closes a full lap. */
export function updateLaps(track: Track, laps: Laps, index: number): { laps: Laps; lapDone: boolean } {
  const cp = track.checkpoints[laps.next]!;
  if (!inWindow(index, cp)) return { laps, lapDone: false };
  if (laps.next === 0) return { laps: { next: 1, lap: laps.lap + 1 }, lapDone: true };
  return { laps: { next: (laps.next + 1) % track.checkpoints.length, lap: laps.lap }, lapDone: false };
}

/** The checkpoint sample the car goes back to with R (the last one passed). */
export function lastCheckpoint(track: Track, laps: Laps): number {
  const n = track.checkpoints.length;
  return track.checkpoints[(laps.next - 1 + n) % n]!;
}

export interface Drift {
  /** Banked points. */
  total: number;
  /** Points of the slide in progress. */
  chain: number;
  /** Seconds since the car stopped sliding (the chain banks after 0.7 s). */
  calm: number;
  /** Seconds off the road (over 1 s drops the chain). */
  offroad: number;
}

export const DRIFT_MIN_ANGLE = 15;
export const DRIFT_MIN_SPEED = 8;

export function startDrift(): Drift {
  return { total: 0, chain: 0, calm: 0, offroad: 0 };
}

/** Drift scoring for one frame: points flow while sliding past 15° above 8 m/s, scaled by speed and angle. */
export function driftStep(d: Drift, slipDeg: number, speed: number, onRoad: boolean, hit: boolean, dt: number): Drift {
  let { total, chain, calm, offroad } = d;
  offroad = onRoad ? 0 : offroad + dt;
  if (hit || offroad > 1) return { total, chain: 0, calm: 0, offroad };
  if (slipDeg > DRIFT_MIN_ANGLE && speed > DRIFT_MIN_SPEED) {
    chain += speed * dt * (1 + Math.min(60, slipDeg) / 30);
    calm = 0;
  } else if (chain > 0) {
    calm += dt;
    if (calm > 0.7) {
      total += chain;
      chain = 0;
      calm = 0;
    }
  }
  return { total, chain, calm, offroad };
}

export function driftScore(d: Drift): number {
  return Math.floor(d.total + d.chain);
}

/** "1:05.32" from milliseconds. */
export function formatLap(ms: number): string {
  return formatClock(ms, 2);
}

/** Saved bests, `cvcm.drivinggame.v1`: lap ms per track, drift points per track. */
export interface Bests {
  lap: Record<string, number>;
  drift: Record<string, number>;
}

export function cleanBests(raw: unknown): Bests {
  const out: Bests = { lap: {}, drift: {} };
  if (!raw || typeof raw !== "object") return out;
  for (const kind of ["lap", "drift"] as const) {
    const table = (raw as Record<string, unknown>)[kind];
    if (!table || typeof table !== "object") continue;
    for (const [k, v] of Object.entries(table as Record<string, unknown>)) {
      if (/^[0-2]$/.test(k) && typeof v === "number" && Number.isFinite(v) && v > 0) out[kind][k] = v;
    }
  }
  return out;
}
