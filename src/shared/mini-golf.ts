/**
 * Mini golf (games3d group): nine original holes and the ball physics on the green, shared by the page and the
 * tests. Pure and deterministic. Units are metres and seconds; the green is the x–z plane, a hole runs from its tee
 * (low z) toward its cup. The ball moves in fixed substeps short enough (SUBSTEP × MAX_SPEED < BALL_R) that it never
 * passes through a wall, a bumper or the rotating blocker.
 *
 * Every slope's push is weaker than the rolling friction, so a rolling ball always slows down and a stopped ball stays
 * put: a putt always ends (and SHOT_LIMIT caps it anyway), and no ball can rock on a slope for ever.
 */

export type Pt = readonly [number, number];

export interface Slope {
  /** Rectangle x0..x1 × z0..z1 where the green tilts. */
  x0: number; z0: number; x1: number; z1: number;
  /** Downhill pull (m/s²), always weaker than FRICTION. */
  ax: number; az: number;
}

export interface Rect { x0: number; z0: number; x1: number; z1: number }

export interface Bumper { x: number; z: number; r: number }

/** A bar turning about its middle (the windmill-style blocker). */
export interface Mover { x: number; z: number; half: number; speed: number }

export interface Hole {
  par: number;
  tee: Pt;
  cup: Pt;
  /** The green's outline (a simple polygon, counter-clockwise in x–z); its edges are the walls. */
  green: readonly Pt[];
  /** Solid blocks on the green (simple polygons); their edges are walls too. */
  blocks: readonly (readonly Pt[])[];
  bumpers: readonly Bumper[];
  slopes: readonly Slope[];
  water: readonly Rect[];
  mover: Mover | null;
}

export const BALL_R = 0.05;
export const CUP_R = 0.1;
/** Fastest putt and fastest possible ball (m/s). */
export const MAX_SPEED = 5.5;
const MIN_SPEED = 0.35;
/** Rolling friction as a steady deceleration (m/s²), plus a little drag. */
export const FRICTION = 0.9;
const DRAG = 0.15;
/** Below this the ball stops (m/s). */
const STOP_SPEED = 0.04;
/** Into the cup when slower than this over it; faster balls lip out. */
export const CAPTURE_SPEED = 1.2;
const WALL_KEEP = 0.72;
const BUMPER_KEEP = 0.95;
export const SUBSTEP = 1 / 400;
/** A putt is stopped after this many seconds whatever happens. */
export const SHOT_LIMIT = 30;
/** Strokes allowed on a hole; reaching it without holing out picks the ball up. */
export const MAX_STROKES = 8;

const rect = (x0: number, z0: number, x1: number, z1: number): Pt[] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

export const HOLES: readonly Hole[] = [
  // 1. Straight and short.
  { par: 2, tee: [0, 0.5], cup: [0, 5.4], green: rect(-0.6, 0, 0.6, 6), blocks: [], bumpers: [], slopes: [], water: [], mover: null },
  // 2. Dogleg right.
  {
    par: 3, tee: [0, 0.5], cup: [2.5, 4],
    green: [[-0.6, 0], [0.6, 0], [0.6, 3.4], [3, 3.4], [3, 4.6], [-0.6, 4.6]],
    blocks: [], bumpers: [], slopes: [], water: [], mover: null,
  },
  // 3. Three bumpers in the middle.
  {
    par: 2, tee: [0, 0.5], cup: [0, 5.3], green: rect(-1, 0, 1, 6), blocks: [],
    bumpers: [{ x: 0, z: 2.5, r: 0.25 }, { x: -0.5, z: 3.6, r: 0.2 }, { x: 0.5, z: 3.6, r: 0.2 }],
    slopes: [], water: [], mover: null,
  },
  // 4. A side slope across the middle.
  {
    par: 2, tee: [0, 0.5], cup: [0, 5.4], green: rect(-0.8, 0, 0.8, 6), blocks: [], bumpers: [],
    slopes: [{ x0: -0.8, z0: 2, x1: 0.8, z1: 4, ax: 0.38, az: 0 }], water: [], mover: null,
  },
  // 5. The turning blocker.
  {
    par: 3, tee: [0, 0.5], cup: [0, 6.4], green: rect(-0.7, 0, 0.7, 7), blocks: [], bumpers: [], slopes: [], water: [],
    mover: { x: 0, z: 3.5, half: 0.5, speed: 1.4 },
  },
  // 6. Water on the left: carry past it on the right.
  {
    par: 3, tee: [0, 0.5], cup: [0, 6], green: rect(-0.8, 0, 0.8, 6.5), blocks: [], bumpers: [], slopes: [],
    water: [{ x0: -0.8, z0: 2.5, x1: 0.25, z1: 3.5 }], mover: null,
  },
  // 7. A block in the way.
  {
    par: 3, tee: [0, 0.5], cup: [0, 5.4], green: rect(-1.2, 0, 1.2, 6), blocks: [rect(-0.6, 2.7, 0.6, 3.3)],
    bumpers: [], slopes: [], water: [], mover: null,
  },
  // 8. Zigzag.
  {
    par: 3, tee: [0, 0.5], cup: [2, 5.1],
    green: [[-0.6, 0], [0.6, 0], [0.6, 2.4], [2.6, 2.4], [2.6, 5.6], [1.4, 5.6], [1.4, 3.6], [-0.6, 3.6]],
    blocks: [], bumpers: [], slopes: [], water: [], mover: null,
  },
  // 9. Uphill start, two bumpers and a pond by the cup.
  {
    par: 3, tee: [0, 0.5], cup: [0.3, 6.4], green: rect(-1, 0, 1, 7), blocks: [],
    bumpers: [{ x: -0.5, z: 4.2, r: 0.2 }, { x: 0.5, z: 4.8, r: 0.2 }],
    slopes: [{ x0: -1, z0: 1.5, x1: 1, z1: 3, ax: 0, az: -0.32 }],
    water: [{ x0: -1, z0: 5, x1: -0.4, z1: 5.8 }], mover: null,
  },
];

export const COURSE_PAR = HOLES.reduce((s, h) => s + h.par, 0);

export interface Seg { ax: number; az: number; bx: number; bz: number }

/** Every wall of a hole: the green's outline and the blocks' outlines. */
export function walls(hole: Hole): Seg[] {
  const out: Seg[] = [];
  for (const poly of [hole.green, ...hole.blocks]) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
      out.push({ ax: a[0], az: a[1], bx: b[0], bz: b[1] });
    }
  }
  return out;
}

const wallCache = new WeakMap<Hole, Seg[]>();
function wallsOf(hole: Hole): Seg[] {
  let w = wallCache.get(hole);
  if (!w) wallCache.set(hole, (w = walls(hole)));
  return w;
}

export function insidePoly(poly: readonly Pt[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]!, [xj, zj] = poly[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

const inRect = (r: Rect, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

/** Off the playable green: outside the outline or inside a block (a safety net; the walls keep the ball in). */
export function outOfBounds(hole: Hole, x: number, z: number): boolean {
  return !insidePoly(hole.green, x, z) || hole.blocks.some((b) => insidePoly(b, x, z));
}

/** The blocker's ends at time t. */
export function moverEnds(m: Mover, t: number): Seg {
  const a = m.speed * t;
  const dx = Math.cos(a) * m.half, dz = Math.sin(a) * m.half;
  return { ax: m.x - dx, az: m.z - dz, bx: m.x + dx, bz: m.z + dz };
}

export interface Ball {
  x: number;
  z: number;
  vx: number;
  vz: number;
  moving: boolean;
  /** Sim clock (s): turns the blocker. */
  t: number;
  /** Seconds since this putt started. */
  shotTime: number;
  /** Time not yet simulated, in substeps (advance runs whole substeps only, so any frame rate gives the same play). */
  acc: number;
  holed: boolean;
  /** Ended in the water or off the green this putt (the page puts it back and adds a stroke). */
  wet: boolean;
}

export function ballAt(x: number, z: number, t = 0): Ball {
  return { x, z, vx: 0, vz: 0, moving: false, t, shotTime: 0, acc: 0, holed: false, wet: false };
}

/** Putt speed for a power of 0–1. */
export function puttSpeed(power: number): number {
  const p = Math.max(0, Math.min(1, power));
  return MIN_SPEED + (MAX_SPEED - MIN_SPEED) * p;
}

/** Starts a putt (angle in radians in the x–z plane: 0 = +z, π/2 = +x). */
export function putt(ball: Ball, angle: number, power: number): Ball {
  const v = puttSpeed(power);
  return { ...ball, vx: Math.sin(angle) * v, vz: Math.cos(angle) * v, moving: true, shotTime: 0, holed: false, wet: false };
}

/** Pushes the ball out of a segment and reflects the part of its velocity (relative to the segment) going into it. */
function hitSegment(b: Ball, s: Seg, keep: number, svx = 0, svz = 0): boolean {
  const ex = s.bx - s.ax, ez = s.bz - s.az;
  const len2 = ex * ex + ez * ez || 1;
  const k = Math.max(0, Math.min(1, ((b.x - s.ax) * ex + (b.z - s.az) * ez) / len2));
  const cx = s.ax + ex * k, cz = s.az + ez * k;
  const dx = b.x - cx, dz = b.z - cz;
  const d = Math.hypot(dx, dz);
  if (d >= BALL_R) return false;
  let nx: number, nz: number;
  if (d > 1e-9) {
    nx = dx / d;
    nz = dz / d;
  } else {
    // Exactly on the line: push along the segment's left normal.
    const l = Math.sqrt(len2);
    nx = -ez / l;
    nz = ex / l;
  }
  b.x = cx + nx * BALL_R;
  b.z = cz + nz * BALL_R;
  const rvx = b.vx - svx, rvz = b.vz - svz;
  const vn = rvx * nx + rvz * nz;
  if (vn < 0) {
    b.vx -= (1 + keep) * vn * nx;
    b.vz -= (1 + keep) * vn * nz;
  }
  return true;
}

function hitBumper(b: Ball, p: Bumper): boolean {
  const dx = b.x - p.x, dz = b.z - p.z;
  const d = Math.hypot(dx, dz);
  const min = BALL_R + p.r;
  if (d >= min || d < 1e-9) return false;
  const nx = dx / d, nz = dz / d;
  b.x = p.x + nx * min;
  b.z = p.z + nz * min;
  const vn = b.vx * nx + b.vz * nz;
  if (vn < 0) {
    b.vx -= (1 + BUMPER_KEEP) * vn * nx;
    b.vz -= (1 + BUMPER_KEEP) * vn * nz;
  }
  return true;
}

/** The blocker against the ball, with the bar's own surface speed at the contact (ω × r). */
function hitMover(m: Mover, b: Ball): boolean {
  const s = moverEnds(m, b.t);
  const rx = b.x - m.x, rz = b.z - m.z;
  return hitSegment(b, s, WALL_KEEP, -m.speed * rz, m.speed * rx);
}

function substep(hole: Hole, b: Ball, h: number): void {
  b.t += h;
  if (!b.moving) {
    // A resting ball in the blocker's path gets swept along instead of being passed through.
    if (hole.mover && hitMover(hole.mover, b) && Math.hypot(b.vx, b.vz) > 0) {
      b.moving = true;
      b.shotTime = 0;
    }
    return;
  }
  b.shotTime += h;
  // Slope push, then rolling friction against the motion.
  for (const s of hole.slopes) {
    if (b.x >= s.x0 && b.x <= s.x1 && b.z >= s.z0 && b.z <= s.z1) {
      b.vx += s.ax * h;
      b.vz += s.az * h;
    }
  }
  let sp = Math.hypot(b.vx, b.vz);
  if (sp > 0) {
    const drop = (FRICTION + DRAG * sp) * h;
    const k = sp > drop ? (sp - drop) / sp : 0;
    b.vx *= k;
    b.vz *= k;
    sp *= k;
  }
  if (sp > MAX_SPEED) {
    b.vx *= MAX_SPEED / sp;
    b.vz *= MAX_SPEED / sp;
  }
  b.x += b.vx * h;
  b.z += b.vz * h;

  for (const w of wallsOf(hole)) hitSegment(b, w, WALL_KEEP);
  for (const p of hole.bumpers) hitBumper(b, p);
  if (hole.mover) hitMover(hole.mover, b);

  // The cup: slow enough over it, the ball drops in; faster, it lips out (loses some speed, kicks a little aside).
  const cx = b.x - hole.cup[0], cz = b.z - hole.cup[1];
  const cd = Math.hypot(cx, cz);
  if (cd < CUP_R) {
    const speed = Math.hypot(b.vx, b.vz);
    if (speed < CAPTURE_SPEED) {
      Object.assign(b, { x: hole.cup[0], z: hole.cup[1], vx: 0, vz: 0, moving: false, holed: true });
      return;
    }
    if (cd < CUP_R * 0.6) {
      b.vx *= 0.97;
      b.vz *= 0.97;
    }
  }

  if (hole.water.some((r) => inRect(r, b.x, b.z)) || outOfBounds(hole, b.x, b.z)) {
    b.wet = true;
    b.moving = false;
    b.vx = b.vz = 0;
    return;
  }
  if (Math.hypot(b.vx, b.vz) < STOP_SPEED || b.shotTime > SHOT_LIMIT) {
    b.vx = b.vz = 0;
    b.moving = false;
  }
}

/** Advances the ball by dt seconds in fixed substeps (the clock runs while it rests, turning the blocker). */
export function advance(hole: Hole, ball: Ball, dt: number): Ball {
  const b = { ...ball };
  advanceInPlace(hole, b, dt);
  return b;
}

/** Same as advance, changing `b` itself (the page's frame loop, no allocation per frame). */
export function advanceInPlace(hole: Hole, b: Ball, dt: number): void {
  b.acc += Math.max(0, dt) / SUBSTEP;
  // The small tolerance keeps 120 frames of 1/60 s and 240 of 1/120 s at exactly the same number of substeps.
  while (b.acc >= 1 - 1e-6) {
    b.acc -= 1;
    substep(hole, b, SUBSTEP);
    if (b.holed || b.wet) {
      b.t += Math.max(0, b.acc) * SUBSTEP;
      b.acc = 0;
      break;
    }
  }
}

/** Plays a putt to its end (holed, in the water, or at rest). */
export function simulate(hole: Hole, ball: Ball): Ball {
  let b = ball;
  for (let i = 0; i < SHOT_LIMIT * 20 + 1 && b.moving; i++) b = advance(hole, b, 0.05);
  return b;
}

/** Score name for strokes against par on one hole. */
export function scoreName(strokes: number, par: number): "ace" | "eagle" | "birdie" | "par" | "bogey" | "over" {
  if (strokes === 1) return "ace";
  const d = strokes - par;
  if (d <= -2) return "eagle";
  if (d === -1) return "birdie";
  if (d === 0) return "par";
  if (d === 1) return "bogey";
  return "over";
}

export interface Round {
  hole: number;
  /** Strokes per hole; holes not reached yet are 0. */
  strokes: number[];
  /** Where the ball rests on the current hole. */
  x: number;
  z: number;
}

export function newRound(): Round {
  const h = HOLES[0]!;
  return { hole: 0, strokes: HOLES.map(() => 0), x: h.tee[0], z: h.tee[1] };
}

export function roundOver(r: Round): boolean {
  return r.hole >= HOLES.length;
}

export function roundTotal(r: Round): number {
  return r.strokes.reduce((s, n) => s + n, 0);
}

export interface Saved {
  round: Round;
  best: number | null;
}

/** Reads a saved round; anything odd gives a fresh round. A finished round is not resumed. */
export function cleanSaved(raw: unknown): Saved {
  const fresh: Saved = { round: newRound(), best: null };
  if (!raw || typeof raw !== "object") return fresh;
  const o = raw as Record<string, unknown>;
  const best = typeof o.best === "number" && Number.isInteger(o.best) && o.best >= HOLES.length && o.best <= HOLES.length * MAX_STROKES ? o.best : null;
  const r = o.round as Record<string, unknown> | undefined;
  if (!r || typeof r !== "object") return { ...fresh, best };
  const hole = r.hole;
  const strokes = r.strokes;
  if (typeof hole !== "number" || !Number.isInteger(hole) || hole < 0 || hole >= HOLES.length) return { ...fresh, best };
  if (!Array.isArray(strokes) || strokes.length !== HOLES.length) return { ...fresh, best };
  if (!strokes.every((n, i) => Number.isInteger(n) && n >= (i < hole ? 1 : 0) && n <= MAX_STROKES && (i <= hole || n === 0))) return { ...fresh, best };
  const x = typeof r.x === "number" ? r.x : NaN, z = typeof r.z === "number" ? r.z : NaN;
  const h = HOLES[hole]!;
  const ok = Number.isFinite(x) && Number.isFinite(z) && !outOfBounds(h, x, z) && !h.water.some((w) => inRect(w, x, z));
  return { round: { hole, strokes: strokes as number[], x: ok ? x : h.tee[0], z: ok ? z : h.tee[1] }, best };
}
