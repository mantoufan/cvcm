/**
 * Pool (8-ball) on cv.cm: table geometry, a deterministic 2D ball physics, simplified WPA-style 8-ball rules and the
 * computer's shot search. Pure functions only, shared by the page (src/client/pool-game/) and the tests. Units are
 * metres and seconds; x runs along the table (head at -x, foot at +x), y across it.
 */

/** Play area of an 8-foot table (cushion nose to cushion nose). */
export const TABLE_L = 2.24;
export const TABLE_W = 1.12;
/** Ball radius (57.15 mm balls). */
export const R = 0.028575;
/** Cue speed at full power. */
export const MAX_SPEED = 5.5;
/** Where the cue ball starts (head spot) and the rack's apex (foot spot). */
export const HEAD_SPOT = { x: -TABLE_L / 4, y: 0 };
export const FOOT_SPOT = { x: TABLE_L / 4, y: 0 };

const HL = TABLE_L / 2;
const HW = TABLE_W / 2;
/** Corner pocket mouth along each rail, side pocket half-mouth. */
const MOUTH_CORNER = 0.065;
const MOUTH_SIDE = 0.06;
const BALL_E = 0.95;
const RAIL_E = 0.75;
/** Constant rolling resistance (m/s²) plus a speed-proportional part (1/s). */
const ROLL = 0.2;
const DRAG = 0.06;
const STOP = 0.006;

export interface Pocket {
  x: number;
  y: number;
  /** A ball whose centre comes this close to (x, y) drops. */
  r: number;
  /** The point the computer aims a ball at. */
  ax: number;
  ay: number;
}

export const POCKETS: readonly Pocket[] = [
  { x: -HL - 0.012, y: -HW - 0.012, r: 0.055, ax: -HL + 0.01, ay: -HW + 0.01 },
  { x: HL + 0.012, y: -HW - 0.012, r: 0.055, ax: HL - 0.01, ay: -HW + 0.01 },
  { x: -HL - 0.012, y: HW + 0.012, r: 0.055, ax: -HL + 0.01, ay: HW - 0.01 },
  { x: HL + 0.012, y: HW + 0.012, r: 0.055, ax: HL - 0.01, ay: HW - 0.01 },
  { x: 0, y: -HW - 0.03, r: 0.05, ax: 0, ay: -HW },
  { x: 0, y: HW + 0.03, r: 0.05, ax: 0, ay: HW },
];

/** Cushion noses between the pocket mouths; their end points act as the pocket jaws. */
export const CUSHIONS: readonly { ax: number; ay: number; bx: number; by: number }[] = [
  { ax: -HL + MOUTH_CORNER, ay: -HW, bx: -MOUTH_SIDE, by: -HW },
  { ax: MOUTH_SIDE, ay: -HW, bx: HL - MOUTH_CORNER, by: -HW },
  { ax: -HL + MOUTH_CORNER, ay: HW, bx: -MOUTH_SIDE, by: HW },
  { ax: MOUTH_SIDE, ay: HW, bx: HL - MOUTH_CORNER, by: HW },
  { ax: -HL, ay: -HW + MOUTH_CORNER, bx: -HL, by: HW - MOUTH_CORNER },
  { ax: HL, ay: -HW + MOUTH_CORNER, bx: HL, by: HW - MOUTH_CORNER },
];

export interface Ball {
  /** 0 = cue ball, 1–7 solids, 8, 9–15 stripes. */
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** On the table (false once pocketed). */
  on: boolean;
}

export type Group = "solids" | "stripes";
export type Foul = "scratch" | "noContact" | "wrongBall" | "noRail";

export interface PoolState {
  balls: Ball[];
  /** Player to shoot: 0 or 1. */
  turn: 0 | 1;
  /** Each player's group once the table is no longer open. */
  groups: [Group | null, Group | null];
  /** True until the first shot (the break) has been played. */
  breakShot: boolean;
  /** The shooter may place the cue ball anywhere (after the opponent's foul). */
  ballInHand: boolean;
  winner: 0 | 1 | null;
}

export interface ShotEvents {
  /** First ball the cue ball touched. */
  first: number | null;
  /** Some ball touched a cushion after that first contact. */
  railAfter: boolean;
  /** Balls pocketed, in order. */
  pocketed: number[];
}

export interface Shot {
  /** Direction the cue ball is sent, radians (0 = +x). */
  angle: number;
  /** 0–1 of MAX_SPEED. */
  power: number;
}

export type Outcome =
  | { kind: "win"; player: 0 | 1; reason: "eight" | "eightEarly" | "eightFoul" }
  | { kind: "continue"; foul: null }
  | { kind: "pass"; foul: Foul | null };

export const groupOf = (id: number): Group | null => (id >= 1 && id <= 7 ? "solids" : id >= 9 && id <= 15 ? "stripes" : null);

/** Rack order by rows from the apex: the 8 in the middle, a solid and a stripe on the back corners. */
const RACK = [[1], [10, 2], [3, 8, 11], [12, 4, 13, 5], [6, 14, 7, 15, 9]];

/** A fresh table: cue ball on the head spot, the rack on the foot spot. Always the same (deterministic mount). */
export function newRack(): Ball[] {
  const balls: Ball[] = [{ id: 0, x: HEAD_SPOT.x, y: HEAD_SPOT.y, vx: 0, vy: 0, on: true }];
  const gap = 2 * R * 1.002;
  RACK.forEach((row, r) => {
    row.forEach((id, k) => {
      balls.push({ id, x: FOOT_SPOT.x + r * gap * Math.cos(Math.PI / 6), y: (k - (row.length - 1) / 2) * gap, vx: 0, vy: 0, on: true });
    });
  });
  return balls.sort((a, b) => a.id - b.id);
}

export function newGame(): PoolState {
  return { balls: newRack(), turn: 0, groups: [null, null], breakShot: true, ballInHand: false, winner: null };
}

export function cloneBalls(balls: readonly Ball[]): Ball[] {
  return balls.map((b) => ({ ...b }));
}

export function moving(balls: readonly Ball[]): boolean {
  return balls.some((b) => b.on && (b.vx !== 0 || b.vy !== 0));
}

export function emptyEvents(): ShotEvents {
  return { first: null, railAfter: false, pocketed: [] };
}

/** Starts a shot: the cue ball gets its speed. */
export function strike(balls: Ball[], shot: Shot): void {
  const cue = balls.find((b) => b.id === 0)!;
  const v = Math.max(0, Math.min(1, shot.power)) * MAX_SPEED;
  cue.vx = Math.cos(shot.angle) * v;
  cue.vy = Math.sin(shot.angle) * v;
}

function closest(px: number, py: number, s: (typeof CUSHIONS)[number]): [number, number] {
  const dx = s.bx - s.ax, dy = s.by - s.ay;
  const t = Math.max(0, Math.min(1, ((px - s.ax) * dx + (py - s.ay) * dy) / (dx * dx + dy * dy)));
  return [s.ax + dx * t, s.ay + dy * t];
}

function substep(balls: Ball[], h: number, ev: ShotEvents): void {
  for (const b of balls) {
    if (!b.on || (b.vx === 0 && b.vy === 0)) continue;
    b.x += b.vx * h;
    b.y += b.vy * h;
    const sp = Math.hypot(b.vx, b.vy);
    const next = sp - (ROLL + DRAG * sp) * h;
    if (next <= STOP) {
      b.vx = 0;
      b.vy = 0;
    } else {
      b.vx *= next / sp;
      b.vy *= next / sp;
    }
  }
  // Ball against ball: equal masses, impulse along the line of centres.
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i]!;
    if (!a.on) continue;
    for (let j = i + 1; j < balls.length; j++) {
      const b = balls[j]!;
      if (!b.on) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= 4 * R * R || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d, ny = dy / d;
      const approach = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (approach > 0) {
        const j2 = ((1 + BALL_E) / 2) * approach;
        a.vx -= j2 * nx;
        a.vy -= j2 * ny;
        b.vx += j2 * nx;
        b.vy += j2 * ny;
        if (ev.first === null && (a.id === 0 || b.id === 0)) ev.first = a.id === 0 ? b.id : a.id;
      }
      const push = (2 * R - d) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
    }
  }
  for (const b of balls) {
    if (!b.on) continue;
    // Cushions and jaws.
    for (const s of CUSHIONS) {
      const [cx, cy] = closest(b.x, b.y, s);
      const dx = b.x - cx, dy = b.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= R * R) continue;
      const d = Math.sqrt(d2) || 1e-9;
      const nx = dx / d, ny = dy / d;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        const tx = b.vx - vn * nx, ty = b.vy - vn * ny;
        b.vx = tx * 0.97 - RAIL_E * vn * nx;
        b.vy = ty * 0.97 - RAIL_E * vn * ny;
        if (ev.first !== null) ev.railAfter = true;
      }
      b.x = cx + nx * R;
      b.y = cy + ny * R;
    }
    // Pockets; anything that slipped past the cushion line drops into the nearest one.
    let drop = POCKETS.some((p) => (b.x - p.x) ** 2 + (b.y - p.y) ** 2 < p.r * p.r);
    if (!drop && (Math.abs(b.x) > HL + 0.04 || Math.abs(b.y) > HW + 0.04)) drop = true;
    if (drop) {
      b.on = false;
      b.vx = 0;
      b.vy = 0;
      ev.pocketed.push(b.id);
    }
  }
}

/**
 * Advances the balls by `dt` seconds. Substeps are small enough that no ball moves more than 0.4 R per step, so a
 * hard break cannot pass one ball through another.
 */
export function step(balls: Ball[], dt: number, ev: ShotEvents): void {
  let left = dt;
  while (left > 1e-9) {
    let vmax = 0;
    for (const b of balls) if (b.on) vmax = Math.max(vmax, Math.abs(b.vx) + Math.abs(b.vy));
    if (vmax === 0) return;
    const h = Math.min(left, 1 / 240, (0.4 * R) / vmax);
    substep(balls, h, ev);
    left -= h;
  }
}

/** Plays a shot to the end (all balls still) on a copy and returns the balls and what happened. */
export function simulate(balls: readonly Ball[], shot: Shot, maxSeconds = 25): { balls: Ball[]; ev: ShotEvents } {
  const b = cloneBalls(balls);
  const ev = emptyEvents();
  strike(b, shot);
  for (let t = 0; t < maxSeconds && moving(b); t += 0.05) step(b, 0.05, ev);
  for (const ball of b) {
    ball.vx = 0;
    ball.vy = 0;
  }
  return { balls: b, ev };
}

const remaining = (balls: readonly Ball[], g: Group) => balls.filter((b) => b.on && groupOf(b.id) === g).length;

/** Balls the player may hit first: any but the 8 on an open table, their group, or the 8 once it is cleared. */
export function legalTargets(state: PoolState, player: 0 | 1, balls: readonly Ball[] = state.balls): number[] {
  const g = state.groups[player];
  const on = balls.filter((b) => b.on && b.id !== 0);
  if (!g) return on.filter((b) => b.id !== 8).map((b) => b.id);
  const own = on.filter((b) => groupOf(b.id) === g);
  return own.length ? own.map((b) => b.id) : [8];
}

/** True if (x, y) is a free place for the cue ball (ball in hand). */
/** Whether ball `placing` (the cue ball unless said) fits at (x, y): on the cloth and clear of every other ball. */
export function canPlace(balls: readonly Ball[], x: number, y: number, placing = 0): boolean {
  if (Math.abs(x) > HL - R || Math.abs(y) > HW - R) return false;
  return balls.every((b) => b.id === placing || !b.on || (b.x - x) ** 2 + (b.y - y) ** 2 >= 4 * R * R * 1.01);
}

/** The free place nearest to (x, y) along the table's long axis (for re-spotting). */
function spotNear(balls: readonly Ball[], x: number, y: number, dir: 1 | -1, placing = 0): { x: number; y: number } {
  for (let k = 0; k < 200; k++) {
    const px = x + dir * k * R * 0.5;
    if (Math.abs(px) > HL - R) break;
    if (canPlace(balls, px, y, placing)) return { x: px, y };
  }
  for (let k = 0; k < 400; k++) {
    const px = x - dir * k * R * 0.5;
    if (canPlace(balls, px, y, placing)) return { x: px, y };
  }
  return { x, y };
}

/**
 * Applies a finished shot (`after`, `ev`) to the state: fouls, group assignment, the 8, whose turn it is. Returns the
 * new state and what happened. The state passed in is the one before the shot (for the cleared-group test).
 */
export function resolve(state: PoolState, after: Ball[], ev: ShotEvents): { state: PoolState; outcome: Outcome } {
  const p = state.turn;
  const opp = (1 - p) as 0 | 1;
  const isBreak = state.breakShot;
  const balls = cloneBalls(after);
  const pot = ev.pocketed.filter((id) => id !== 0);
  let foul: Foul | null = null;
  if (ev.pocketed.includes(0)) foul = "scratch";
  else if (ev.first === null) foul = "noContact";
  else if (!isBreak && !legalTargets(state, p).includes(ev.first)) foul = "wrongBall";
  else if (!isBreak && pot.length === 0 && !ev.railAfter) foul = "noRail";

  const next: PoolState = { ...state, balls, groups: [...state.groups] as PoolState["groups"], breakShot: false, ballInHand: false };
  const cue = balls.find((b) => b.id === 0)!;
  if (!cue.on) {
    const s = spotNear(balls, HEAD_SPOT.x, HEAD_SPOT.y, -1);
    Object.assign(cue, { x: s.x, y: s.y, vx: 0, vy: 0, on: true });
  }

  if (pot.includes(8)) {
    if (isBreak) {
      // The 8 on the break is spotted again; play goes on.
      const eight = balls.find((b) => b.id === 8)!;
      // Clear of every ball, the cue ball included.
      const s = spotNear(balls, FOOT_SPOT.x, FOOT_SPOT.y, 1, 8);
      Object.assign(eight, { x: s.x, y: s.y, vx: 0, vy: 0, on: true });
    } else {
      const g = state.groups[p];
      const cleared = g !== null && remaining(state.balls, g) === 0;
      if (cleared && !foul) return { state: { ...next, winner: p }, outcome: { kind: "win", player: p, reason: "eight" } };
      return { state: { ...next, winner: opp }, outcome: { kind: "win", player: opp, reason: cleared ? "eightFoul" : "eightEarly" } };
    }
  }

  if (!foul && !isBreak && state.groups[p] === null) {
    const firstGroup = pot.map(groupOf).find((g): g is Group => g !== null);
    if (firstGroup) {
      next.groups[p] = firstGroup;
      next.groups[opp] = firstGroup === "solids" ? "stripes" : "solids";
    }
  }
  const mine = next.groups[p];
  const scored = pot.some((id) => id !== 8 && (isBreak || mine === null || groupOf(id) === mine));
  if (!foul && scored) return { state: next, outcome: { kind: "continue", foul: null } };
  next.turn = opp;
  next.ballInHand = foul !== null;
  return { state: next, outcome: { kind: "pass", foul } };
}

/** Distance from (px, py) to the segment a–b. */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1e-12;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

function clear(balls: readonly Ball[], ax: number, ay: number, bx: number, by: number, skip: readonly number[]): boolean {
  return balls.every((b) => !b.on || skip.includes(b.id) || segDist(b.x, b.y, ax, ay, bx, by) >= 2 * R * 0.98);
}

export type Level = 0 | 1 | 2;
/** Aim error (radians, standard deviation) and the powers tried per level. */
export const LEVELS: readonly { noise: number; powers: readonly number[] }[] = [
  { noise: 0.045, powers: [0.45] },
  { noise: 0.018, powers: [0.35, 0.6] },
  { noise: 0.005, powers: [0.3, 0.5, 0.75] },
];

/** Candidate shots: each legal target into each pocket with a clear path and a makeable cut. */
export function candidates(state: PoolState, powers: readonly number[]): (Shot & { ease: number })[] {
  const cue = state.balls.find((b) => b.id === 0)!;
  const out: (Shot & { ease: number })[] = [];
  for (const id of legalTargets(state, state.turn)) {
    const t = state.balls.find((b) => b.id === id)!;
    for (const pk of POCKETS) {
      const dx = pk.ax - t.x, dy = pk.ay - t.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1e-6) continue;
      const gx = t.x - (dx / dist) * 2 * R, gy = t.y - (dy / dist) * 2 * R;
      const ax = gx - cue.x, ay = gy - cue.y;
      const alen = Math.hypot(ax, ay);
      if (alen < R) continue;
      const cut = Math.acos(Math.max(-1, Math.min(1, (ax * dx + ay * dy) / (alen * dist))));
      if (cut > (78 * Math.PI) / 180) continue;
      if (!clear(state.balls, cue.x, cue.y, gx, gy, [0, id])) continue;
      if (!clear(state.balls, t.x, t.y, pk.ax, pk.ay, [0, id])) continue;
      // Thinner cuts and longer distances are harder: the search simulates the easiest first.
      const ease = Math.cos(cut) / (1 + alen + dist);
      for (const power of powers) out.push({ angle: Math.atan2(ay, ax), power, ease });
    }
  }
  return out;
}

/** A plain fallback: straight at the nearest legal ball at medium power. */
export function nearestShot(state: PoolState): Shot {
  const cue = state.balls.find((b) => b.id === 0)!;
  let best: Ball | null = null;
  let bd = Infinity;
  for (const id of legalTargets(state, state.turn)) {
    const b = state.balls.find((x) => x.id === id)!;
    const d = Math.hypot(b.x - cue.x, b.y - cue.y);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best ? { angle: Math.atan2(best.y - cue.y, best.x - cue.x), power: 0.55 } : { angle: 0, power: 0.5 };
}

/** Score of a simulated shot for the shooter: winning, keeping the turn, a legal miss, a foul, losing. */
function score(state: PoolState, after: Ball[], ev: ShotEvents): number {
  const { state: s, outcome } = resolve(state, after, ev);
  if (outcome.kind === "win") return outcome.player === state.turn ? 10000 : -10000;
  if (outcome.kind === "continue") {
    // Prefer leaving the cue ball away from the cushions, with a next shot available.
    const cue = s.balls.find((b) => b.id === 0)!;
    const margin = Math.min(HL - Math.abs(cue.x), HW - Math.abs(cue.y));
    return 1000 + Math.min(margin, 0.3) * 100 + Math.min(candidates(s, [0.5]).length, 5) * 20;
  }
  return outcome.foul ? -500 : 0;
}

/**
 * The computer's shot: the break goes at the apex at full power; otherwise every candidate is simulated with the
 * real physics and the best kept, then the level's aim error is added (`rand` gives uniform [0, 1)).
 */
/** At most this many candidate shots are simulated per computer turn. */
const MAX_SIMULATED = 12;

export function chooseShot(state: PoolState, level: Level, rand: () => number): Shot {
  const lv = LEVELS[level]!;
  const noisy = (s: Shot): Shot => {
    // Sum of uniforms ≈ normal with the level's spread.
    const n = (rand() + rand() + rand() - 1.5) * 2 * lv.noise;
    return { angle: s.angle + n, power: s.power };
  };
  if (state.breakShot) {
    const cue = state.balls.find((b) => b.id === 0)!;
    const apex = state.balls.find((b) => b.id === 1)!;
    return noisy({ angle: Math.atan2(apex.y - cue.y, apex.x - cue.x), power: 1 });
  }
  let best: Shot | null = null;
  let bestScore = -Infinity;
  // Only the easiest shots are simulated: each simulation is a full shot of physics, and this runs on the page's
  // main thread on the computer's turn (phones are several times slower than a desktop).
  const shortlist = candidates(state, lv.powers).sort((a, b) => b.ease - a.ease).slice(0, MAX_SIMULATED);
  for (const shot of shortlist) {
    const { balls, ev } = simulate(state.balls, shot);
    const sc = score(state, balls, ev);
    if (sc > bestScore) {
      bestScore = sc;
      best = shot;
    }
  }
  if (!best || bestScore < 0) {
    // No makeable pot: try a few plain hits at legal balls and keep a legal one.
    const fallback = nearestShot(state);
    const tries = [fallback, ...[-0.06, 0.06, -0.12, 0.12].map((d) => ({ angle: fallback.angle + d, power: 0.6 }))];
    for (const shot of tries) {
      const { balls, ev } = simulate(state.balls, shot);
      const sc = score(state, balls, ev);
      if (sc > bestScore) {
        bestScore = sc;
        best = shot;
      }
    }
  }
  return noisy(best ?? nearestShot(state));
}

/**
 * Where the aim line meets something first: the ghost position of the cue ball at the first ball it would touch, or
 * the cushion point. Used for the aiming guide.
 */
export function aimHit(balls: readonly Ball[], angle: number): { x: number; y: number; ball: number | null } {
  const cue = balls.find((b) => b.id === 0)!;
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let tBest = Infinity;
  let hit: number | null = null;
  for (const b of balls) {
    if (!b.on || b.id === 0) continue;
    const ox = b.x - cue.x, oy = b.y - cue.y;
    const proj = ox * dx + oy * dy;
    if (proj <= 0) continue;
    const perp2 = ox * ox + oy * oy - proj * proj;
    if (perp2 >= 4 * R * R) continue;
    const t = proj - Math.sqrt(4 * R * R - perp2);
    if (t < tBest) {
      tBest = t;
      hit = b.id;
    }
  }
  // Cushion: the ball centre stops R short of a rail line.
  const tx = dx > 0 ? (HL - R - cue.x) / dx : dx < 0 ? (-HL + R - cue.x) / dx : Infinity;
  const ty = dy > 0 ? (HW - R - cue.y) / dy : dy < 0 ? (-HW + R - cue.y) / dy : Infinity;
  const tRail = Math.max(0, Math.min(tx, ty));
  if (tRail < tBest) return { x: cue.x + dx * tRail, y: cue.y + dy * tRail, ball: null };
  return { x: cue.x + dx * tBest, y: cue.y + dy * tBest, ball: hit };
}

/** Checks a saved state from storage; null if anything is off. */
export function parseSaved(raw: unknown): PoolState | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<PoolState>;
  if (!Array.isArray(s.balls) || s.balls.length !== 16) return null;
  const ids = new Set<number>();
  for (const b of s.balls) {
    if (!b || typeof b !== "object" || !Number.isInteger(b.id) || b.id < 0 || b.id > 15) return null;
    if (![b.x, b.y].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
    if (Math.abs(b.x) > HL || Math.abs(b.y) > HW || typeof b.on !== "boolean") return null;
    ids.add(b.id);
  }
  if (ids.size !== 16) return null;
  const okGroup = (g: unknown) => g === null || g === "solids" || g === "stripes";
  if (s.turn !== 0 && s.turn !== 1) return null;
  if (!Array.isArray(s.groups) || s.groups.length !== 2 || !s.groups.every(okGroup)) return null;
  if (s.winner !== null && s.winner !== 0 && s.winner !== 1) return null;
  const balls = s.balls.map((b) => ({ id: b.id, x: b.x, y: b.y, vx: 0, vy: 0, on: b.on })).sort((a, b) => a.id - b.id);
  if (!balls[0]!.on) return null;
  return { balls, turn: s.turn, groups: [s.groups[0] ?? null, s.groups[1] ?? null], breakShot: !!s.breakShot, ballInHand: !!s.ballInHand, winner: s.winner ?? null };
}
