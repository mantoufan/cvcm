/**
 * Pinball (games3d group): the table and its physics on the table plane, shared by the page and the tests. Pure and
 * deterministic: the same inputs over the same frames give the same game. Units are table units (about 5 cm); x runs
 * left to right (0–10), y from the player's end (0) up the table (20). The plunger lane is the strip right of
 * LANE_X. Gravity pulls toward y = 0 (the table's tilt). The ball moves in fixed substeps short enough that, even with
 * a flipper sweeping at full speed toward a ball at full speed, neither moves more than the ball's radius per substep,
 * so nothing tunnels.
 */

export const W = 10;
export const H = 20;
export const LANE_X = 9.2;
export const BALL_R = 0.3;
export const GRAVITY = 25;
export const SUBSTEP = 1 / 480;
export const MAX_SPEED = 45;
export const BALLS = 3;
/** Seconds after a ball's first launch during which a drain gives the ball back. */
export const BALL_SAVE = 8;

export const FLIPPER_LEN = 1.4;
export const FLIPPER_R = 0.18;
export const FLIP_REST = -0.5;
export const FLIP_UP = 0.45;
export const FLIP_UP_SPEED = 30;
export const FLIP_DOWN_SPEED = 18;
/** Pivots: the left flipper points right, the right one points left. */
export const LEFT_PIVOT: Vec = [2.8, 1.7];
export const RIGHT_PIVOT: Vec = [6.4, 1.7];

export const PLUNGER_REST: Vec = [9.6, 0.8];
/** Seconds of holding for a full plunger pull. */
export const CHARGE_TIME = 0.9;

export type Vec = [number, number];
export type Side = "left" | "right";

export interface Seg {
  a: Vec;
  b: Vec;
  kind: "wall" | "sling" | "target";
  /** Index within its kind (slings 0–1, targets 0–2). */
  id: number;
  /** The side that kicks or scores (slings, targets). */
  normal?: Vec;
}

export interface Bumper {
  x: number;
  y: number;
  r: number;
}

/** Rollover sensors at the top: the ball passing over lights one. */
export const ROLLOVERS: readonly Vec[] = [[2.6, 17.6], [4.6, 18.0], [6.6, 17.6]];
export const ROLLOVER_R = 0.45;

export const BUMPERS: readonly Bumper[] = [
  { x: 3.0, y: 13.4, r: 0.6 },
  { x: 6.2, y: 13.4, r: 0.6 },
  { x: 4.6, y: 15.5, r: 0.6 },
];

function polyline(points: Vec[]): Seg[] {
  const out: Seg[] = [];
  for (let i = 0; i + 1 < points.length; i++) out.push({ a: points[i]!, b: points[i + 1]!, kind: "wall", id: 0 });
  return out;
}

function unit(x: number, y: number): Vec {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

/** Every solid edge of the table: outer walls, the plunger lane, the slopes to the flippers, slingshots, targets. */
export const SEGMENTS: readonly Seg[] = [
  // Left side: slope to the left flipper, the wall, the top arch, then the outer right wall down to the lane floor.
  ...polyline([
    [2.6, 1.9], [0, 4], [0, 17],
    [0.3, 18.3], [1.2, 19.3], [2.5, 19.85], [4.6, 20.05], [6.7, 19.85], [8.4, 19.3], [9.5, 18.4], [10, 17.2],
    [10, 0.5], [LANE_X, 0.5],
  ]),
  // The lane's inner wall, and the slope to the right flipper.
  { a: [LANE_X, 0.5], b: [LANE_X, 15], kind: "wall", id: 0 },
  { a: [LANE_X, 4], b: [6.6, 1.9], kind: "wall", id: 0 },
  // Slingshots above the flippers, kicking toward the middle.
  { a: [1.1, 5.2], b: [2.3, 3.1], kind: "sling", id: 0, normal: unit(2.1, 1.2) },
  { a: [8.1, 5.2], b: [6.9, 3.1], kind: "sling", id: 1, normal: unit(-2.1, 1.2) },
  // Three stand-up targets along the left wall.
  { a: [0.3, 8.0], b: [0.3, 8.8], kind: "target", id: 0, normal: [1, 0] },
  { a: [0.3, 9.3], b: [0.3, 10.1], kind: "target", id: 1, normal: [1, 0] },
  { a: [0.3, 10.6], b: [0.3, 11.4], kind: "target", id: 2, normal: [1, 0] },
];

export interface Flipper {
  /** Angle from horizontal, REST (down) to UP. */
  a: number;
  /** Rate of change of `a` (rad/s). */
  w: number;
}

export interface Input {
  left: boolean;
  right: boolean;
  plunger: boolean;
}

export const NO_INPUT: Input = { left: false, right: false, plunger: false };

export type NoticeKind = "" | "launch" | "saved" | "lost" | "over" | "multiplier" | "targets";

export interface Pin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  left: Flipper;
  right: Flipper;
  /** Game clock (s) and the time not yet stepped. */
  t: number;
  acc: number;
  score: number;
  /** Balls left, the one in play included. */
  balls: number;
  multiplier: number;
  combo: number;
  comboUntil: number;
  rollovers: boolean[];
  targets: boolean[];
  /** The ball is over each rollover sensor now (a light toggles on entering). */
  inRoll: boolean[];
  charge: number;
  prevPlunger: boolean;
  saveArmed: boolean;
  /** Launched from the plunger and not yet out of the lane: the ball save starts when it leaves. */
  savePending: boolean;
  saveUntil: number;
  /** Last hit time per part ("b0", "s1", "t2", "f-left"), for the lights. */
  hits: Record<string, number>;
  notice: { kind: NoticeKind; t: number };
  over: boolean;
}

export function launchSpeed(charge: number): number {
  return 16 + 26 * Math.min(1, Math.max(0, charge));
}

function placeOnPlunger(s: Pin): void {
  s.x = PLUNGER_REST[0];
  s.y = PLUNGER_REST[1];
  s.vx = 0;
  s.vy = 0;
  s.charge = 0;
}

export function newGame(): Pin {
  const s: Pin = {
    x: 0, y: 0, vx: 0, vy: 0,
    left: { a: FLIP_REST, w: 0 },
    right: { a: FLIP_REST, w: 0 },
    t: 0, acc: 0,
    score: 0, balls: BALLS, multiplier: 1, combo: 0, comboUntil: 0,
    rollovers: [false, false, false], targets: [false, false, false], inRoll: [false, false, false],
    charge: 0, prevPlunger: false, saveArmed: true, savePending: false, saveUntil: 0,
    hits: {}, notice: { kind: "", t: 0 }, over: false,
  };
  placeOnPlunger(s);
  return s;
}

/** A copy with the ball somewhere else (tests and demos). */
export function withBall(p: Pin, x: number, y: number, vx = 0, vy = 0): Pin {
  return { ...clone(p), x, y, vx, vy };
}

/** A flipper's pivot, unit direction and tip. */
export function flipperGeom(side: Side, a: number): { pivot: Vec; dir: Vec; tip: Vec } {
  const pivot = side === "left" ? LEFT_PIVOT : RIGHT_PIVOT;
  const dir: Vec = side === "left" ? [Math.cos(a), Math.sin(a)] : [-Math.cos(a), Math.sin(a)];
  return { pivot, dir, tip: [pivot[0] + dir[0] * FLIPPER_LEN, pivot[1] + dir[1] * FLIPPER_LEN] };
}

/** The ball sits in the plunger lane's launch spot. */
export function onPlunger(s: Pick<Pin, "x" | "y">): boolean {
  return s.x > LANE_X && s.y < 1.8;
}

function clone(p: Pin): Pin {
  return {
    ...p,
    left: { ...p.left },
    right: { ...p.right },
    rollovers: [...p.rollovers],
    targets: [...p.targets],
    inRoll: [...p.inRoll],
    hits: { ...p.hits },
    notice: { ...p.notice },
  };
}

function add(s: Pin, points: number): void {
  s.score += points * s.multiplier;
}

function closest(a: Vec, b: Vec, px: number, py: number): { qx: number; qy: number; u: number } {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy || 1;
  const u = Math.min(1, Math.max(0, ((px - a[0]) * dx + (py - a[1]) * dy) / len2));
  return { qx: a[0] + dx * u, qy: a[1] + dy * u, u };
}

/**
 * Pushes the ball out of contact along n (unit, pointing at the ball) and bounces the velocity relative to a surface
 * moving at (sx, sy). Returns the speed the ball was approaching with (0 when it was already leaving).
 */
function bounce(s: Pin, nx: number, ny: number, depth: number, e: number, sx = 0, sy = 0): number {
  s.x += nx * depth;
  s.y += ny * depth;
  const rvx = s.vx - sx, rvy = s.vy - sy;
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0) return 0;
  // Bounce the normal part, keep most of the sliding part.
  const tx = rvx - vn * nx, ty = rvy - vn * ny;
  s.vx = sx + tx * 0.98 - e * vn * nx;
  s.vy = sy + ty * 0.98 - e * vn * ny;
  return -vn;
}

function hitOnce(s: Pin, key: string, gap = 0.08): boolean {
  const last = s.hits[key];
  s.hits[key] = s.t;
  return last === undefined || s.t - last > gap;
}

function collideSegment(s: Pin, seg: Seg): void {
  const { qx, qy } = closest(seg.a, seg.b, s.x, s.y);
  let dx = s.x - qx, dy = s.y - qy;
  const d = Math.hypot(dx, dy);
  if (d >= BALL_R) return;
  if (d < 1e-9) {
    const n = seg.normal ?? unit(-(seg.b[1] - seg.a[1]), seg.b[0] - seg.a[0]);
    dx = n[0];
    dy = n[1];
  } else {
    dx /= d;
    dy /= d;
  }
  const front = !seg.normal || dx * seg.normal[0] + dy * seg.normal[1] > 0;
  const speed = bounce(s, dx, dy, BALL_R - d, seg.kind === "sling" && front ? 0.4 : 0.45);
  if (seg.kind === "sling" && front && speed > 1.5) {
    // The slingshot kicks the ball away at a good pace.
    const out = s.vx * dx + s.vy * dy;
    if (out < 11) {
      s.vx += dx * (11 - out);
      s.vy += dy * (11 - out);
    }
    if (hitOnce(s, `s${seg.id}`)) add(s, 10);
  } else if (seg.kind === "target" && front && speed > 1) {
    if (hitOnce(s, `t${seg.id}`)) {
      add(s, 200);
      s.targets[seg.id] = true;
      if (s.targets.every(Boolean)) {
        add(s, 2500);
        s.targets = [false, false, false];
        s.notice = { kind: "targets", t: s.t };
      }
    }
  }
}

function collideBumper(s: Pin, b: Bumper, i: number): void {
  const dx = s.x - b.x, dy = s.y - b.y;
  const d = Math.hypot(dx, dy);
  const reach = b.r + BALL_R;
  if (d >= reach || d < 1e-9) return;
  const nx = dx / d, ny = dy / d;
  bounce(s, nx, ny, reach - d, 0.6);
  const out = s.vx * nx + s.vy * ny;
  if (out < 14) {
    s.vx += nx * (14 - out);
    s.vy += ny * (14 - out);
  }
  if (hitOnce(s, `b${i}`)) {
    s.combo = s.t < s.comboUntil ? s.combo + 1 : 1;
    s.comboUntil = s.t + 1.5;
    add(s, 100 + 50 * Math.min(10, s.combo - 1));
  }
}

function collideFlipper(s: Pin, side: Side): void {
  const f = side === "left" ? s.left : s.right;
  const { pivot, tip } = flipperGeom(side, f.a);
  const { qx, qy } = closest(pivot, tip, s.x, s.y);
  let dx = s.x - qx, dy = s.y - qy;
  const d = Math.hypot(dx, dy);
  const reach = BALL_R + FLIPPER_R;
  if (d >= reach) return;
  if (d < 1e-9) {
    dx = 0;
    dy = 1;
  } else {
    dx /= d;
    dy /= d;
  }
  // Surface velocity at the contact point: Ω × r, Ω counter-clockwise positive.
  const omega = side === "left" ? f.w : -f.w;
  const rx = qx - pivot[0], ry = qy - pivot[1];
  const sx = -omega * ry, sy = omega * rx;
  const speed = bounce(s, dx, dy, reach - d, 0.3, sx, sy);
  if (speed > 2 && f.w > 0) s.hits[`f-${side}`] = s.t;
}

function moveFlipper(f: Flipper, pressed: boolean, h: number): void {
  if (pressed) {
    f.w = f.a < FLIP_UP ? FLIP_UP_SPEED : 0;
    f.a = Math.min(FLIP_UP, f.a + f.w * h);
  } else {
    f.w = f.a > FLIP_REST ? -FLIP_DOWN_SPEED : 0;
    f.a = Math.max(FLIP_REST, f.a + f.w * h);
  }
  if (f.a === FLIP_UP || f.a === FLIP_REST) f.w = 0;
}

function drain(s: Pin): void {
  if (s.t < s.saveUntil) {
    s.saveUntil = 0;
    s.notice = { kind: "saved", t: s.t };
    placeOnPlunger(s);
    return;
  }
  s.balls -= 1;
  s.combo = 0;
  if (s.balls <= 0) {
    s.balls = 0;
    s.over = true;
    s.notice = { kind: "over", t: s.t };
    s.vx = s.vy = 0;
    return;
  }
  s.notice = { kind: "lost", t: s.t };
  s.saveArmed = true;
  s.savePending = false;
  placeOnPlunger(s);
}

function substep(s: Pin, input: Input, h: number): void {
  s.t += h;
  moveFlipper(s.left, input.left, h);
  moveFlipper(s.right, input.right, h);

  // Plunger: hold to pull, release to launch (only with the ball on it).
  if (onPlunger(s)) {
    if (input.plunger) s.charge = Math.min(1, s.charge + h / CHARGE_TIME);
    else if (s.prevPlunger && s.charge > 0) {
      s.vy = launchSpeed(s.charge);
      s.vx = 0;
      s.charge = 0;
      s.notice = { kind: "launch", t: s.t };
      s.savePending = true;
    }
  } else {
    s.charge = 0;
  }
  // The ball save starts when the ball leaves the launch lane, not on release: a weak pull that falls back onto
  // the plunger must not use it up.
  if (s.savePending && s.x < LANE_X) {
    s.savePending = false;
    if (s.saveArmed) {
      s.saveArmed = false;
      s.saveUntil = s.t + BALL_SAVE;
    }
  }
  s.prevPlunger = input.plunger;

  s.vy -= GRAVITY * h;
  // A little rolling drag.
  const drag = 1 - 0.04 * h;
  s.vx *= drag;
  s.vy *= drag;
  const sp = Math.hypot(s.vx, s.vy);
  if (sp > MAX_SPEED) {
    s.vx *= MAX_SPEED / sp;
    s.vy *= MAX_SPEED / sp;
  }
  s.x += s.vx * h;
  s.y += s.vy * h;

  for (const seg of SEGMENTS) collideSegment(s, seg);
  BUMPERS.forEach((b, i) => collideBumper(s, b, i));
  collideFlipper(s, "left");
  collideFlipper(s, "right");

  // Rollovers light on entering; all three lit raises the multiplier.
  ROLLOVERS.forEach(([rx, ry], i) => {
    const inside = Math.hypot(s.x - rx, s.y - ry) < ROLLOVER_R;
    if (inside && !s.inRoll[i]) {
      s.rollovers[i] = true;
      add(s, 50);
      if (s.rollovers.every(Boolean)) {
        s.multiplier = Math.min(5, s.multiplier + 1);
        add(s, 1000);
        s.rollovers = [false, false, false];
        s.notice = { kind: "multiplier", t: s.t };
      }
    }
    s.inRoll[i] = inside;
  });

  if (s.y < -0.6) drain(s);
}

/**
 * Advances the game by `dt` seconds in fixed SUBSTEPs (time left over is kept for the next call), so the result does
 * not depend on the frame rate. Returns a new state; the input is not changed.
 */
export function step(p: Pin, input: Input, dt: number): Pin {
  const s = clone(p);
  if (s.over) return s;
  s.acc += Math.min(0.1, Math.max(0, dt));
  while (s.acc >= SUBSTEP && !s.over) {
    s.acc -= SUBSTEP;
    substep(s, input, SUBSTEP);
  }
  return s;
}
