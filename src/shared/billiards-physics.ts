/**
 * Billiards physics (written for cv.cm). Balls move on the table plane (x along the length, y across it, z up, metres
 * and seconds). Each ball has a centre velocity and a full spin vector, so draw, follow, stun and side all come out of
 * the same friction model:
 *
 * - The cloth touches a ball at (0, 0, −R). While that point slides (u ≠ 0) sliding friction μs·g acts against it,
 *   slowing the centre and changing the spin until the ball rolls; a rolling ball slows with rolling friction μr·g.
 *   Side spin (about z) decays on its own.
 * - Ball–ball contacts are smooth: equal masses swap the normal parts of their velocities (restitution eBall), spins
 *   are kept. That is what makes a stunned cue ball leave at 90° and a screwed one come back.
 * - Cushions are segments at the cushion nose; pocket jaws are their rounded ends. A cushion reverses the normal speed
 *   (restitution eRail) and its friction trades slide against side spin, so running and check side change the angle.
 * - A ball whose centre comes within a pocket's capture radius, or leaves the cushion rectangle through a mouth, drops.
 *
 * Steps are adaptive: no ball moves more than a fifth of its radius per sub-step, so fast breaks do not tunnel.
 * Pure: the page, the computer player and the aim prediction all run the same code.
 */

export const GRAVITY = 9.81;

export interface Vec {
  x: number;
  y: number;
}

/** A ball on (or off) the table. Spin w is in rad/s about the x, y and z axes. */
export interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  wx: number;
  wy: number;
  wz: number;
  /** False once potted (or taken off). */
  on: boolean;
}

export interface Segment {
  a: Vec;
  b: Vec;
  /** Unit normal pointing into the playing area. */
  n: Vec;
}

export interface Pocket {
  x: number;
  y: number;
  /** A ball whose centre comes this close drops. */
  r: number;
  corner: boolean;
}

/** Everything the simulation needs to know about a table. Built by `buildTable`. */
export interface TableGeom {
  /** Playing length and width between the cushion noses. */
  length: number;
  width: number;
  /** Ball radius. */
  R: number;
  muSlide: number;
  muRoll: number;
  /** Side-spin decay, rad/s². */
  spinDecay: number;
  eBall: number;
  eRail: number;
  /** Friction between ball and cushion (couples side and slide). */
  muRail: number;
  rails: Segment[];
  /** Rounded cushion ends at the pocket mouths. */
  jaws: Vec[];
  pockets: Pocket[];
}

export interface TableSpec {
  length: number;
  width: number;
  R: number;
  /** Corner and middle pocket mouths (between the jaw points); 0 for a table without pockets. */
  cornerMouth: number;
  sideMouth: number;
  muSlide?: number;
  muRoll?: number;
  spinDecay?: number;
  eBall?: number;
  eRail?: number;
  muRail?: number;
}

function seg(ax: number, ay: number, bx: number, by: number, nx: number, ny: number): Segment {
  return { a: { x: ax, y: ay }, b: { x: bx, y: by }, n: { x: nx, y: ny } };
}

/** Cushion segments, jaw points and pocket capture circles for a table. */
export function buildTable(spec: TableSpec): TableGeom {
  const L = spec.length / 2;
  const W = spec.width / 2;
  const R = spec.R;
  const rails: Segment[] = [];
  const jaws: Vec[] = [];
  const pockets: Pocket[] = [];
  if (spec.cornerMouth <= 0) {
    rails.push(seg(-L, -W, L, -W, 0, 1), seg(-L, W, L, W, 0, -1), seg(-L, -W, -L, W, 1, 0), seg(L, -W, L, W, -1, 0));
  } else {
    // A corner mouth m across the diagonal meets each cushion m/√2 from the corner.
    const d = spec.cornerMouth / Math.SQRT2;
    const s = spec.sideMouth / 2;
    for (const sy of [-1, 1]) {
      const y = sy * W;
      rails.push(seg(-L + d, y, -s, y, 0, -sy), seg(s, y, L - d, y, 0, -sy));
      jaws.push({ x: -L + d, y }, { x: -s, y }, { x: s, y }, { x: L - d, y });
    }
    for (const sx of [-1, 1]) {
      const x = sx * L;
      rails.push(seg(x, -W + d, x, W - d, -sx, 0));
      jaws.push({ x, y: -W + d }, { x, y: W - d });
    }
    // Capture circles sit a little behind the mouth, so a ball that only grazes the mouth stays up.
    const back = R * 0.35;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        pockets.push({ x: sx * (L + back / Math.SQRT2), y: sy * (W + back / Math.SQRT2), r: spec.cornerMouth / 2, corner: true });
      }
    }
    // Middle pockets: the capture circle only reaches the cushion line, so a ball rolling past along the rail
    // stays up unless its centre gets over the mouth.
    const sr = spec.sideMouth / 2;
    for (const sy of [-1, 1]) pockets.push({ x: 0, y: sy * (W + sr), r: sr, corner: false });
  }
  return {
    length: spec.length,
    width: spec.width,
    R,
    muSlide: spec.muSlide ?? 0.2,
    muRoll: spec.muRoll ?? 0.01,
    spinDecay: spec.spinDecay ?? 9,
    eBall: spec.eBall ?? 0.94,
    eRail: spec.eRail ?? 0.76,
    muRail: spec.muRail ?? 0.18,
    rails,
    jaws,
    pockets,
  };
}

export type SimEvent =
  | { kind: "ball"; t: number; a: number; b: number; speed: number }
  | { kind: "rail"; t: number; a: number; speed: number }
  | { kind: "pot"; t: number; a: number; pocket: number };

export function newBall(id: number, x: number, y: number): Ball {
  return { id, x, y, vx: 0, vy: 0, wx: 0, wy: 0, wz: 0, on: true };
}

export function cloneBalls(balls: readonly Ball[]): Ball[] {
  return balls.map((b) => ({ ...b }));
}

const STILL_V = 0.004;
const STILL_U = 0.004;

/** Slip of the cloth contact point (zero while rolling). */
function slip(b: Ball, R: number): Vec {
  return { x: b.vx - R * b.wy, y: b.vy + R * b.wx };
}

export function isMoving(b: Ball, R: number): boolean {
  if (!b.on) return false;
  if (Math.hypot(b.vx, b.vy) > STILL_V) return true;
  const u = slip(b, R);
  return Math.hypot(u.x, u.y) > STILL_U;
}

export function anyMoving(balls: readonly Ball[], R: number): boolean {
  return balls.some((b) => isMoving(b, R));
}

/**
 * Hits the cue ball: `angle` is the direction in radians, `speed` the cue ball's speed in m/s, `side` and `top` where
 * the tip meets the ball as a fraction of its radius (side > 0 is right-hand side, top > 0 above centre, below is
 * screw). Natural roll is top = 0.4.
 */
export function strike(ball: Ball, angle: number, speed: number, side: number, top: number, R: number): void {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  ball.vx = dx * speed;
  ball.vy = dy * speed;
  const k = (5 * speed) / (2 * R);
  // ω = 5v/(2R²)·(r × d) with r = R·(side·right + top·up): right × d = +z, up × d = (−dy, dx, 0).
  ball.wx = k * top * -dy;
  ball.wy = k * top * dx;
  ball.wz = k * side;
}

function frictionStep(b: Ball, g: TableGeom, h: number): void {
  const R = g.R;
  const u = slip(b, R);
  const us = Math.hypot(u.x, u.y);
  if (us > 1e-9) {
    const decel = g.muSlide * GRAVITY;
    // The slip shrinks at 7/2·μs·g; stop exactly at rolling instead of overshooting.
    const dt = Math.min(h, us / (3.5 * decel));
    const ux = u.x / us;
    const uy = u.y / us;
    b.vx -= decel * ux * dt;
    b.vy -= decel * uy * dt;
    b.wx -= ((5 * decel) / (2 * R)) * uy * dt;
    b.wy += ((5 * decel) / (2 * R)) * ux * dt;
    const rest = h - dt;
    if (rest > 0) roll(b, g, rest);
  } else {
    roll(b, g, h);
  }
  const dz = g.spinDecay * h;
  b.wz = Math.abs(b.wz) <= dz ? 0 : b.wz - Math.sign(b.wz) * dz;
}

function roll(b: Ball, g: TableGeom, h: number): void {
  const v = Math.hypot(b.vx, b.vy);
  const dv = g.muRoll * GRAVITY * h;
  if (v <= dv) {
    b.vx = 0;
    b.vy = 0;
  } else {
    b.vx -= (b.vx / v) * dv;
    b.vy -= (b.vy / v) * dv;
  }
  b.wx = -b.vy / g.R;
  b.wy = b.vx / g.R;
}

/** Cushion contact: normal n points from the cushion into the table. Returns the impact speed, or 0. */
function cushion(b: Ball, g: TableGeom, nx: number, ny: number): number {
  const vn = b.vx * nx + b.vy * ny;
  if (vn >= 0) return 0;
  const tx = -ny;
  const ty = nx;
  const vt = b.vx * tx + b.vy * ty;
  const dvn = -(1 + g.eRail) * vn;
  // Slip at the cushion contact (side spin against the cushion), killed by friction up to μ·normal impulse.
  const s = vt - b.wz * g.R;
  const j = Math.max(-g.muRail * dvn, Math.min(g.muRail * dvn, (-2 * s) / 7));
  b.vx += nx * dvn + tx * j;
  b.vy += ny * dvn + ty * j;
  b.wz -= (5 / (2 * g.R)) * j;
  // The cushion nose sits above the ball's centre, so it also turns the roll toward the cushion (spin about the
  // axis along it) round: the ball leaves with a little roll in its new direction (−0.1 of the old spin) instead
  // of the heavy screw a plain bounce would leave, which would kill it.
  const wt = b.wx * tx + b.wy * ty;
  const keep = -0.1 * wt - wt;
  b.wx += tx * keep;
  b.wy += ty * keep;
  return -vn;
}

const STRUCK = new Map<number, number>();
const RESTING = new Set<number>();

/** Advances every ball by `dt` seconds (sub-stepped). Contacts and pots are pushed to `events` with time `t0 + …`. */
export function step(g: TableGeom, balls: Ball[], dt: number, events?: SimEvent[], t0 = 0): void {
  let maxV = 0;
  for (const b of balls) if (b.on) maxV = Math.max(maxV, Math.hypot(b.vx, b.vy));
  if (maxV < STILL_V && !anyMoving(balls, g.R)) return;
  const n = Math.max(1, Math.ceil((maxV * dt) / (g.R * 0.2)));
  const h = dt / n;
  const R = g.R;
  const R2 = 4 * R * R;
  // Per sub-step: when a ball that was at rest got struck, so its cushion hit (it was resting against the cushion)
  // is never stamped before that contact. Moving balls keep their own cushion times, cushion-first included.
  // (Module-level scratch, reused: step runs thousands of times per prediction.)
  const struck = STRUCK;
  const resting = RESTING;
  for (let s = 0; s < n; s++) {
    const t = t0 + (s + 1) * h;
    struck.clear();
    resting.clear();
    for (const b of balls) if (b.on && b.vx === 0 && b.vy === 0) resting.add(b.id);
    for (const b of balls) {
      if (!b.on) continue;
      frictionStep(b, g, h);
      b.x += b.vx * h;
      b.y += b.vy * h;
    }
    // Ball–ball (two balls at rest cannot meet).
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i]!;
      if (!a.on) continue;
      for (let k = i + 1; k < balls.length; k++) {
        const c = balls[k]!;
        // Read a's motion here: an earlier pair in this sub-step may just have set it moving.
        if (!c.on || (a.vx === 0 && a.vy === 0 && c.vx === 0 && c.vy === 0)) continue;
        const dx = c.x - a.x;
        const dy = c.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= R2 || d2 === 0) continue;
        // Back both balls up along their paths to the moment they touched (|d − v·τ| = 2R), so the contact
        // normal, and with it the cut angle, does not depend on the step size.
        const rvx = c.vx - a.vx;
        const rvy = c.vy - a.vy;
        const rv2 = rvx * rvx + rvy * rvy;
        let tau = 0;
        if (rv2 > 1e-12) {
          const dot = dx * rvx + dy * rvy;
          const disc = dot * dot - rv2 * (d2 - R2);
          if (disc >= 0) tau = Math.max(0, Math.min(h, (dot + Math.sqrt(disc)) / rv2));
        }
        a.x -= a.vx * tau;
        a.y -= a.vy * tau;
        c.x -= c.vx * tau;
        c.y -= c.vy * tau;
        const ex = c.x - a.x;
        const ey = c.y - a.y;
        const d = Math.hypot(ex, ey) || 1e-9;
        const nx = ex / d;
        const ny = ey / d;
        // Still overlapping (balls placed touching, or no relative motion): separate them.
        if (d < 2 * R) {
          const push = (2 * R - d) / 2;
          a.x -= nx * push;
          a.y -= ny * push;
          c.x += nx * push;
          c.y += ny * push;
        }
        const vrel = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
        if (vrel > 0) {
          const j = ((1 + g.eBall) / 2) * vrel;
          a.vx -= j * nx;
          a.vy -= j * ny;
          c.vx += j * nx;
          c.vy += j * ny;
          // Stamped with the real contact time, so two contacts in one sub-step keep their true order.
          events?.push({ kind: "ball", t: t - tau, a: a.id, b: c.id, speed: vrel });
          if (resting.has(a.id)) struck.set(a.id, Math.max(struck.get(a.id) ?? -Infinity, t - tau));
          if (resting.has(c.id)) struck.set(c.id, Math.max(struck.get(c.id) ?? -Infinity, t - tau));
        }
        // Use up the backed-off time with the new velocities.
        a.x += a.vx * tau;
        a.y += a.vy * tau;
        c.x += c.vx * tau;
        c.y += c.vy * tau;
      }
    }
    // Cushions, jaws and pockets.
    for (const b of balls) {
      if (!b.on) continue;
      for (const r of g.rails) {
        const dist = (b.x - r.a.x) * r.n.x + (b.y - r.a.y) * r.n.y;
        if (dist >= R || dist < -R) continue;
        // Within the segment's span?
        const ex = r.b.x - r.a.x;
        const ey = r.b.y - r.a.y;
        const along = ((b.x - r.a.x) * ex + (b.y - r.a.y) * ey) / (ex * ex + ey * ey);
        if (along < 0 || along > 1) continue;
        // When it touched: back off the overshoot at the inbound speed (keeps cushion and ball contacts in order).
        const inbound = -(b.vx * r.n.x + b.vy * r.n.y);
        const tc = Math.max(struck.get(b.id) ?? -Infinity, inbound > 1e-9 ? t - Math.min(h, (R - dist) / inbound) : t);
        b.x += r.n.x * (R - dist);
        b.y += r.n.y * (R - dist);
        const sp = cushion(b, g, r.n.x, r.n.y);
        if (sp > 0) events?.push({ kind: "rail", t: tc, a: b.id, speed: sp });
      }
      for (const p of g.jaws) {
        const dx = b.x - p.x;
        const dy = b.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= R * R || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        const inbound = -(b.vx * nx + b.vy * ny);
        const tc = Math.max(struck.get(b.id) ?? -Infinity, inbound > 1e-9 ? t - Math.min(h, (R - d) / inbound) : t);
        b.x = p.x + nx * R;
        b.y = p.y + ny * R;
        const sp = cushion(b, g, nx, ny);
        if (sp > 0) events?.push({ kind: "rail", t: tc, a: b.id, speed: sp });
      }
      const pocket = pocketOf(g, b);
      if (pocket >= 0) {
        b.on = false;
        b.vx = b.vy = b.wx = b.wy = b.wz = 0;
        events?.push({ kind: "pot", t, a: b.id, pocket });
      }
    }
  }
  for (const b of balls) {
    if (b.on && !isMoving(b, R)) {
      b.vx = b.vy = b.wx = b.wy = b.wz = 0;
    }
  }
}

/** Index of the pocket the ball drops into now, or −1. */
export function pocketOf(g: TableGeom, b: Vec): number {
  if (!g.pockets.length) return -1;
  for (let i = 0; i < g.pockets.length; i++) {
    const p = g.pockets[i]!;
    if (Math.hypot(b.x - p.x, b.y - p.y) < p.r) return i;
  }
  // Out through a mouth (the cushions keep balls in everywhere else).
  if (Math.abs(b.x) > g.length / 2 + g.R * 0.2 || Math.abs(b.y) > g.width / 2 + g.R * 0.2) {
    let best = 0;
    let bestD = Infinity;
    g.pockets.forEach((p, i) => {
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }
  return -1;
}

export interface SimResult {
  events: SimEvent[];
  /** Seconds until everything stopped (or the cap). */
  time: number;
  /** Sampled positions per ball id while it moved (prediction lines), when `trace` was asked for. */
  traces?: Map<number, Vec[]>;
}

/** The fixed tick every run uses (live shot, prediction, computer), so they all play out the same. */
export const TICK = 1 / 120;

/** Runs until every ball stops (or `maxTime`). Mutates `balls`. */
export function simulate(g: TableGeom, balls: Ball[], opts: { maxTime?: number; trace?: number } = {}): SimResult {
  const events: SimEvent[] = [];
  const maxTime = opts.maxTime ?? 40;
  const traces = opts.trace ? new Map<number, Vec[]>() : undefined;
  const dt = TICK;
  let t = 0;
  let sinceTrace = Infinity;
  while (t < maxTime && anyMoving(balls, g.R)) {
    if (traces && sinceTrace >= opts.trace!) {
      sinceTrace = 0;
      for (const b of balls) {
        if (!b.on || !isMoving(b, g.R)) continue;
        let line = traces.get(b.id);
        if (!line) traces.set(b.id, (line = []));
        line.push({ x: b.x, y: b.y });
      }
    }
    step(g, balls, dt, events, t);
    t += dt;
    sinceTrace += dt;
    if (traces) {
      for (const b of balls) {
        const line = traces.get(b.id);
        if (!line) continue;
        const last = line[line.length - 1]!;
        // Close each line where the ball stopped or dropped.
        if ((!b.on || !isMoving(b, g.R)) && (last.x !== b.x || last.y !== b.y)) line.push({ x: b.x, y: b.y });
      }
    }
  }
  return { events, time: t, traces };
}

/** True when a ball centred at (x, y) fits: inside the cushions and not touching another ball on the table. */
export function freeSpot(g: TableGeom, balls: readonly Ball[], x: number, y: number, ignore = -1): boolean {
  const R = g.R;
  if (Math.abs(x) > g.length / 2 - R || Math.abs(y) > g.width / 2 - R) return false;
  for (const b of balls) {
    if (!b.on || b.id === ignore) continue;
    if (Math.hypot(b.x - x, b.y - y) < 2 * R + 1e-4) return false;
  }
  return pocketOf(g, { x, y }) < 0;
}
