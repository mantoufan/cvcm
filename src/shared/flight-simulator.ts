/**
 * Flight simulator (games3d group): an arcade flight model and a deterministic low-poly island. Pure functions only,
 * so the page and the tests share them. Units are metres, seconds and radians; y is up, sea level is y = 0. Yaw 0
 * faces -z ("north") and grows clockwise seen from above, so the forward vector is
 * (sin yaw · cos pitch, sin pitch, -cos yaw · cos pitch). Roll > 0 is the right wing down.
 */
import { formatClock } from "./game-clock";
import { seeded } from "./random";

export const G = 9.81;
/** Island terrain spans [-WORLD, WORLD] on x and z; outside it is open sea. */
export const WORLD = 3200;
const ISLAND_R = 2700;
export const RUNWAY_Y = 20;
/** Top of the drawn runway slab: above the terrain mesh around it (which wanders ±0.4 m over its 50 m cells). */
export const RUNWAY_TOP = RUNWAY_Y + 0.5;
/** Runway along the z axis, centred on the origin. */
export const RUNWAY_LENGTH = 900;
export const RUNWAY_WIDTH = 40;
/** Wheels below the plane's centre. */
export const GEAR = 1.6;
/** Fastest roll (m/s, about 90 km/h) the wheels survive off the runway. */
const TAXI_MAX = 25;
/** Below this airspeed the wing stalls in the air. */
export const STALL_SPEED = 30;
/** Level flight needs this airspeed (lift = weight). */
const LIFT_SPEED = 40;
/** Thrust at full throttle, as an acceleration. */
const THRUST = 10;
/** Drag coefficient: top speed in level flight is sqrt(THRUST / DRAG) ≈ 77 m/s (about 280 km/h). */
const DRAG = THRUST / 77 ** 2;
/** Highest sink rate (m/s) that still counts as a landing on the runway. */
export const MAX_SINK = 4;
const CEILING = 2400;
const SUBSTEP = 1 / 120;
const MAX_PITCH = 1.3;
const MAX_ROLL = 1.3;

export const RING_COUNT = 12;
export const RING_RADIUS = 24;

export interface Plane {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  /** Airspeed along the nose. */
  speed: number;
  /** Extra vertical speed from too little (or no) lift, on top of the path along the nose. */
  sink: number;
  /** 0–1 */
  throttle: number;
  pitchRate: number;
  rollRate: number;
  yawRate: number;
  onGround: boolean;
  stalled: boolean;
  /** Has been well clear of the ground since the last stop, so the next stop on the runway is a landing. */
  flown: boolean;
  landed: boolean;
  crashed: CrashReason | null;
}

export type CrashReason = "terrain" | "water" | "hard";

export interface Controls {
  /** -1 throttle down, +1 up (rate per second ≈ 50%). */
  throttle: number;
  /** -1…1, positive = nose up. */
  pitch: number;
  /** -1…1, positive = roll right. */
  roll: number;
  /** -1…1, positive = yaw right. */
  yaw: number;
}

export const NO_INPUT: Controls = { throttle: 0, pitch: 0, roll: 0, yaw: 0 };

export function forward(p: Pick<Plane, "yaw" | "pitch">): [number, number, number] {
  const c = Math.cos(p.pitch);
  return [Math.sin(p.yaw) * c, Math.sin(p.pitch), -Math.cos(p.yaw) * c];
}

/** Compass heading in degrees, 0–360 (0 = north = -z). */
export function heading(p: Pick<Plane, "yaw">): number {
  const d = (p.yaw * 180) / Math.PI;
  return ((d % 360) + 360) % 360;
}

// ---------------------------------------------------------------- terrain

function hash(ix: number, iz: number, seed: number): number {
  let n = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 2246822519);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 0x1_0000_0000;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const a = hash(ix, iz, seed);
  const b = hash(ix + 1, iz, seed);
  const c = hash(ix, iz + 1, seed);
  const d = hash(ix + 1, iz + 1, seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

/** Fractal noise in [0, 1). */
function fbm(x: number, z: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let o = 0; o < 4; o++) {
    sum += amp * valueNoise(x * freq, z * freq, 7 + o);
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / 0.9375;
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return smooth(t);
}

export function onRunway(x: number, z: number): boolean {
  return Math.abs(x) <= RUNWAY_WIDTH / 2 && Math.abs(z) <= RUNWAY_LENGTH / 2;
}

/**
 * Ground height (may be below sea level). Lowland around the runway, hills and peaks further out, sea past the
 * island's edge. Deterministic: the same island on every visit.
 */
export function terrainHeight(x: number, z: number): number {
  const n = fbm(x / 650, z / 650);
  const ridge = 1 - Math.abs(2 * fbm(x / 1300 + 11, z / 1300 - 5) - 1);
  const hills = 30 + n * 260 + ridge * ridge * 260;
  const low = RUNWAY_Y + (n - 0.5) * 16;
  const r = Math.hypot(x, z);
  // Flat country within ~600 m of the runway so take-offs and approaches are clear, rising to the hills.
  let height = low + (hills - low) * smoothstep(600, 1500, r);
  // The coast: down below the sea past the island radius.
  const coast = smoothstep(ISLAND_R * 0.82, ISLAND_R, r + (n - 0.5) * 400);
  height = height * (1 - coast) - 40 * coast;
  // The runway itself is level, blended into the land around it.
  const dx = Math.max(0, Math.abs(x) - RUNWAY_WIDTH / 2);
  const dz = Math.max(0, Math.abs(z) - RUNWAY_LENGTH / 2);
  const flat = 1 - smoothstep(0, 80, Math.hypot(dx, dz));
  return height + (RUNWAY_Y - height) * flat;
}

/** Grid of the drawn terrain (one size on every device), so what is drawn is what the plane can hit. */
export const TERRAIN_SEGMENTS = 128;
const CELL = (WORLD * 2) / TERRAIN_SEGMENTS;

/**
 * The drawn ground: terrainHeight at the grid's corners, linear inside each triangle, split the way three's
 * PlaneGeometry (rotated flat) splits a cell — (x0,z0)(x0,z1)(x1,z0) and (x0,z1)(x1,z1)(x1,z0).
 */
export function meshHeight(x: number, z: number): number {
  if (Math.abs(x) >= WORLD || Math.abs(z) >= WORLD) return terrainHeight(x, z);
  const u = (x + WORLD) / CELL;
  const v = (z + WORLD) / CELL;
  const ix = Math.min(TERRAIN_SEGMENTS - 1, Math.floor(u));
  const iz = Math.min(TERRAIN_SEGMENTS - 1, Math.floor(v));
  const fu = u - ix;
  const fv = v - iz;
  const x0 = ix * CELL - WORLD, z0 = iz * CELL - WORLD;
  const h01 = terrainHeight(x0, z0 + CELL);
  const h10 = terrainHeight(x0 + CELL, z0);
  if (fu + fv <= 1) {
    const h00 = terrainHeight(x0, z0);
    return h00 + (h10 - h00) * fu + (h01 - h00) * fv;
  }
  const h11 = terrainHeight(x0 + CELL, z0 + CELL);
  return h11 + (h01 - h11) * (1 - fu) + (h10 - h11) * (1 - fv);
}

/** What the plane can touch: the runway slab, the drawn ground or the sea surface. */
export function surfaceHeight(x: number, z: number): number {
  if (onRunway(x, z)) return RUNWAY_TOP;
  return Math.max(0, meshHeight(x, z));
}

// ---------------------------------------------------------------- plane

/** Parked at the south end of the runway, facing north along it. */
export function onRunwayStart(): Plane {
  return {
    x: 0, y: RUNWAY_TOP + GEAR, z: RUNWAY_LENGTH / 2 - 40,
    yaw: 0, pitch: 0, roll: 0, speed: 0, sink: 0, throttle: 0,
    pitchRate: 0, rollRate: 0, yawRate: 0,
    onGround: true, stalled: false, flown: false, landed: false, crashed: null,
  };
}

/** Already flying north of the runway, for the rings course. */
export function airborneStart(): Plane {
  return {
    x: 0, y: 260, z: -RUNWAY_LENGTH / 2 - 300,
    yaw: 0, pitch: 0, roll: 0, speed: 55, sink: 0, throttle: 0.7,
    pitchRate: 0, rollRate: 0, yawRate: 0,
    onGround: false, stalled: false, flown: true, landed: false, crashed: null,
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const toward = (v: number, target: number, k: number) => v + (target - v) * Math.min(1, k);

function substep(p: Plane, c: Controls, h: number): void {
  p.throttle = clamp(p.throttle + c.throttle * 0.5 * h, 0, 1);
  // Controls bite less when slow.
  const eff = clamp((p.speed - 12) / 28, 0.15, 1);
  const pitchIn = p.onGround && p.speed < 33 ? Math.max(0, c.pitch) * 0.3 : c.pitch;
  p.pitchRate = toward(p.pitchRate, pitchIn * 0.8 * eff, 6 * h);
  p.rollRate = toward(p.rollRate, c.roll * 1.5 * eff, 6 * h);
  p.yawRate = toward(p.yawRate, c.yaw * 0.45 * eff, 6 * h);

  if (p.onGround) {
    p.roll = 0;
    p.rollRate = 0;
    // Nose-wheel steering on the ground.
    p.yaw += (c.yaw + c.roll) * 0.6 * clamp(p.speed / 15, 0, 1) * h;
  } else {
    p.roll = clamp(p.roll + p.rollRate * h, -MAX_ROLL, MAX_ROLL);
    // Wings level themselves slowly when the stick is centred (arcade help).
    if (c.roll === 0) p.roll = toward(p.roll, 0, 0.6 * h);
    // Coordinated turn: a bank turns the nose; the rudder adds a little.
    const turn = (G * Math.tan(p.roll)) / Math.max(p.speed, 20);
    p.yaw += (turn + p.yawRate) * h;
  }
  // The elevator works in the plane's frame: in a bank it pulls the nose round as well as up.
  p.pitch += p.pitchRate * Math.cos(p.roll) * h;
  if (!p.onGround) p.yaw += p.pitchRate * Math.sin(p.roll) * h * 0.5;

  p.stalled = !p.onGround && p.speed < STALL_SPEED;
  if (p.stalled) p.pitch -= 0.5 * h * (1 + Math.max(0, p.pitch));
  p.pitch = clamp(p.pitch, -MAX_PITCH, MAX_PITCH);

  // Speed along the nose: thrust, drag, gravity on a climb or dive, rolling friction on the ground.
  let accel = p.throttle * THRUST - DRAG * p.speed * p.speed - G * Math.sin(p.pitch);
  if (p.onGround) accel -= p.throttle < 0.05 ? 3 : 0.4;
  if (p.y > CEILING) accel -= 4;
  p.speed = Math.max(0, p.speed + accel * h);

  // Lift holds the plane on its path up to what the wing can give; any shortfall becomes sink.
  const capacity = G * (p.speed / LIFT_SPEED) ** 2;
  const cosRoll = Math.max(Math.cos(p.roll), 0.2);
  if (p.onGround) {
    p.sink = 0;
  } else {
    const lift = Math.min(capacity * cosRoll, G);
    p.sink += (lift - G) * h;
    // A flying wing damps the sink away.
    if (capacity * cosRoll >= G) p.sink *= 1 - Math.min(1, 1.5 * h);
  }

  const [fx, fy, fz] = forward(p);
  p.x += fx * p.speed * h;
  p.z += fz * p.speed * h;
  let vy = fy * p.speed + p.sink;
  if (p.onGround) {
    // Lift-off once the wing carries the weight and the nose is up.
    if (capacity >= G && p.pitch > 0.04) {
      p.onGround = false;
      p.landed = false;
    } else {
      vy = 0;
      // Wheels on the ground: the nose cannot go below level, and the tail stops it rising far.
      p.pitch = clamp(p.pitch, 0, 0.22);
    }
  }
  p.y += vy * h;

  const ground = surfaceHeight(p.x, p.z);
  // Rolling wheels follow the ground (off the runway edge too), instead of hovering where it drops away.
  if (p.onGround && p.y - GEAR > ground) p.y = ground + GEAR;
  if (p.y - GEAR - ground > 15) p.flown = true;
  if (p.y - GEAR <= ground) {
    const water = meshHeight(p.x, p.z) < 0;
    const gentle = -vy <= MAX_SINK && Math.abs(p.roll) < 0.3 && p.pitch > -0.12;
    // On the runway, or rolling slowly off its edge onto the grass: wheels stay down. Fast on the grass is a crash.
    const rollable = onRunway(p.x, p.z) || (p.onGround && p.speed < TAXI_MAX);
    if (!water && rollable && (p.onGround || gentle)) {
      p.y = ground + GEAR;
      p.onGround = true;
      p.sink = 0;
      p.pitch = Math.max(0, p.pitch);
    } else {
      p.y = ground + GEAR;
      p.crashed = water ? "water" : gentle ? "terrain" : "hard";
      p.speed = 0;
      return;
    }
  }
  if (p.onGround && p.speed < 3 && p.flown) {
    p.landed = true;
    p.flown = false;
  }
}

/** Advances the plane by `dt` seconds in fixed 1/120 s steps. Returns a new state; the input is not changed. */
export function step(plane: Plane, controls: Controls, dt: number): Plane {
  const p = { ...plane };
  if (p.crashed) return p;
  let left = Math.max(0, dt);
  while (left > 1e-9 && !p.crashed) {
    const h = Math.min(SUBSTEP, left);
    substep(p, controls, h);
    left -= h;
  }
  return p;
}

// ---------------------------------------------------------------- rings

export interface Ring {
  x: number;
  y: number;
  z: number;
  /** Unit normal: the way to fly through. */
  nx: number;
  ny: number;
  nz: number;
}

/** A course of RING_COUNT rings ahead of airborneStart(), each well above the ground below it. */
export function ringCourse(seed = 1): Ring[] {
  const rand = seeded(seed);
  const start = airborneStart();
  let x = start.x;
  let z = start.z;
  let yaw = 0;
  const rings: Ring[] = [];
  for (let i = 0; i < RING_COUNT; i++) {
    yaw += (rand() - 0.5) * 1.3;
    // Keep the course over the island: turn back towards the middle when far out.
    const r = Math.hypot(x, z);
    if (r > 1700) {
      const toCentre = Math.atan2(-x, z);
      let d = toCentre - yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      yaw += d * 0.6;
    }
    const dist = 420 + rand() * 180;
    x += Math.sin(yaw) * dist;
    z -= Math.cos(yaw) * dist;
    let floor = 0;
    for (let s = 0; s <= 8; s++) {
      const t = s / 8;
      floor = Math.max(floor, terrainHeight(x - Math.sin(yaw) * dist * t, z + Math.cos(yaw) * dist * t));
    }
    const y = Math.max(floor + 90, 150) + rand() * 180;
    rings.push({ x, y, z, nx: Math.sin(yaw), ny: 0, nz: -Math.cos(yaw) });
  }
  return rings;
}

/** The segment a→b crosses the ring's disc (either way through). */
export function throughRing(ring: Ring, a: readonly [number, number, number], b: readonly [number, number, number]): boolean {
  const da = (a[0] - ring.x) * ring.nx + (a[1] - ring.y) * ring.ny + (a[2] - ring.z) * ring.nz;
  const db = (b[0] - ring.x) * ring.nx + (b[1] - ring.y) * ring.ny + (b[2] - ring.z) * ring.nz;
  if (da === db || (da > 0 && db > 0) || (da < 0 && db < 0)) return false;
  const t = da / (da - db);
  const px = a[0] + (b[0] - a[0]) * t - ring.x;
  const py = a[1] + (b[1] - a[1]) * t - ring.y;
  const pz = a[2] + (b[2] - a[2]) * t - ring.z;
  return px * px + py * py + pz * pz <= RING_RADIUS * RING_RADIUS;
}

/** m:ss.t */
export function formatFlightTime(ms: number): string {
  return formatClock(ms, 1);
}
