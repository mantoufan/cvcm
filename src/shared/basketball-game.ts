/**
 * Basketball shooting game (games3d group): ball flight, rim and backboard, scoring and the two modes. Pure and
 * deterministic, shared by the page and the tests. Metres and seconds; y is up, the rim's centre is at x = 0, z = 0,
 * height RIM_Y; the backboard is the plane z = BOARD_Z behind it; shooters stand at positive z.
 *
 * The ball moves in fixed SUBSTEP steps: at MAX_SPEED a step is 11 / 480 ≈ 0.023 m, far less than the ball's radius
 * (0.12 m) and the rim tube's reach, so a ball can never pass through the board or the rim between two checks. A shot
 * always ends: when it goes in and drops below the net, when it lands on the floor, or after SHOT_MAX seconds (a ball
 * that rests on the rim or wedges between rim and board cannot stall the game).
 */

export const BALL_R = 0.12;
/** Inner radius of the rim (the circle through the middle of the tube). */
export const RIM_R = 0.2286;
export const RIM_TUBE = 0.01;
export const RIM_Y = 3.05;
/** Board face, 0.15 m behind the rim's back edge. */
export const BOARD_Z = -(RIM_R + 0.15);
export const BOARD_W = 1.8;
export const BOARD_BOTTOM = 2.9;
export const BOARD_TOP = 3.95;
export const RELEASE_Y = 2.1;
export const GRAVITY = 9.81;
export const DRAG = 0.02;
export const SUBSTEP = 1 / 480;
export const MIN_SPEED = 4.5;
export const MAX_SPEED = 11;
/**
 * Launch elevation for a shot from `dist` metres: the player chooses direction and strength, the arc comes from the
 * spot, higher close in (a flat shot from under the hoop could only hit the front of the rim), flatter from far out.
 */
export function elevationFor(dist: number): number {
  const deg = Math.max(50, Math.min(68, 68 - (dist - 1.8) * 3));
  return (deg * Math.PI) / 180;
}
/** Largest aim offset either side of straight at the rim. */
export const MAX_YAW = 0.35;
export const SHOT_MAX = 4;
/** Seconds after a release before the next ball can be thrown. */
export const RELOAD = 0.45;
export const TIME_LIMIT = 60;
/** Distance from the rim's centre (on the floor) from which a basket counts 3. */
export const THREE_POINT = 6.75;
/** Baskets in a row from which each basket earns a bonus point. */
export const STREAK_BONUS_FROM = 3;
/** Timed mode moves to the next spot after this many baskets from one spot. */
export const MAKES_PER_SPOT = 3;
export const RIM_BOUNCE = 0.6;
export const BOARD_BOUNCE = 0.65;

/** Shooting spots (feet on the floor), from close to beyond the arc. */
export const SPOTS: readonly { x: number; z: number }[] = [
  { x: 0, z: 1.8 },
  { x: -2.2, z: 3.0 },
  { x: 0, z: 4.6 },
  { x: 2.6, z: 5.2 },
  { x: -1.5, z: 6.9 },
];

export type Mode = "timed" | "practice";
export type ShotResult = "swish" | "bank" | "rim" | "miss";

export interface Ball {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Seconds in flight. */
  t: number;
  rim: boolean;
  board: boolean;
  made: boolean;
  done: boolean;
  /** Where the shot was taken from (for the 3-point check). */
  from: number;
  /** Time not yet simulated (less than one SUBSTEP), carried to the next call so any frame rate plays the same. */
  acc?: number;
}

export interface Game {
  mode: Mode;
  /** Index into SPOTS. */
  spot: number;
  score: number;
  streak: number;
  bestStreak: number;
  makes: number;
  shots: number;
  /** Baskets from the current spot (timed mode moves on after MAKES_PER_SPOT). */
  spotMakes: number;
  /** Seconds left in timed mode; null in practice. */
  timeLeft: number | null;
  /** Seconds since the last release. */
  sinceShot: number;
  balls: Ball[];
  over: boolean;
}

export interface ShotEvent {
  result: ShotResult;
  points: number;
  streak: number;
}

export function distanceOf(spot: number): number {
  const s = SPOTS[spot]!;
  return Math.hypot(s.x, s.z);
}

export function newGame(mode: Mode, spot = 0): Game {
  return {
    mode,
    spot: mode === "timed" ? 0 : clampSpot(spot),
    score: 0,
    streak: 0,
    bestStreak: 0,
    makes: 0,
    shots: 0,
    spotMakes: 0,
    timeLeft: mode === "timed" ? TIME_LIMIT : null,
    sinceShot: RELOAD,
    balls: [],
    over: false,
  };
}

export function clampSpot(n: number): number {
  return Number.isInteger(n) && n >= 0 && n < SPOTS.length ? n : 0;
}

/** Launch speed for a power in [0, 1]. */
export function speedFor(power: number): number {
  const p = Math.min(1, Math.max(0, power));
  return MIN_SPEED + p * (MAX_SPEED - MIN_SPEED);
}

/** A ball leaving the shooter at `spot`, turned `yaw` radians off the line to the rim, at `power`. */
export function launch(spot: number, yaw: number, power: number): Ball {
  const s = SPOTS[clampSpot(spot)]!;
  const base = Math.atan2(-s.x, -s.z);
  // Positive yaw turns to the shooter's right. Facing the hoop along (sin base, cos base) in three's right-handed
  // y-up frame, the right is the smaller heading, hence the minus.
  const dir = base - Math.max(-MAX_YAW, Math.min(MAX_YAW, yaw));
  const v = speedFor(power);
  const el = elevationFor(Math.hypot(s.x, s.z));
  const h = v * Math.cos(el);
  return {
    x: s.x, y: RELEASE_Y, z: s.z,
    vx: Math.sin(dir) * h, vy: v * Math.sin(el), vz: Math.cos(dir) * h,
    t: 0, rim: false, board: false, made: false, done: false,
    from: Math.hypot(s.x, s.z),
  };
}

/** The point on the rim's centre circle nearest to (x, y, z). */
function rimPoint(x: number, z: number): { px: number; pz: number } {
  const d = Math.hypot(x, z);
  if (d < 1e-9) return { px: RIM_R, pz: 0 };
  return { px: (x / d) * RIM_R, pz: (z / d) * RIM_R };
}

/** Distance from (x, y, z) to the rim's centre circle (the tube's axis). */
export function rimDistance(x: number, y: number, z: number): number {
  const { px, pz } = rimPoint(x, z);
  return Math.hypot(x - px, y - RIM_Y, z - pz);
}

function substep(b: Ball, h: number): void {
  b.t += h;
  const drag = 1 - DRAG * h;
  b.vx *= drag;
  b.vz *= drag;
  b.vy = b.vy * drag - GRAVITY * h;
  const prevY = b.y;
  b.x += b.vx * h;
  b.y += b.vy * h;
  b.z += b.vz * h;

  // Rim: a ring of tube radius RIM_TUBE; the ball bounces off the nearest point of the tube's axis.
  const { px, pz } = rimPoint(b.x, b.z);
  const dx = b.x - px, dy = b.y - RIM_Y, dz = b.z - pz;
  const dist = Math.hypot(dx, dy, dz);
  const reach = BALL_R + RIM_TUBE;
  if (dist < reach) {
    const nx = dist > 1e-9 ? dx / dist : 0, ny = dist > 1e-9 ? dy / dist : 1, nz = dist > 1e-9 ? dz / dist : 0;
    b.x = px + nx * reach;
    b.y = RIM_Y + ny * reach;
    b.z = pz + nz * reach;
    const vn = b.vx * nx + b.vy * ny + b.vz * nz;
    if (vn < 0) {
      b.vx -= (1 + RIM_BOUNCE) * vn * nx;
      b.vy -= (1 + RIM_BOUNCE) * vn * ny;
      b.vz -= (1 + RIM_BOUNCE) * vn * nz;
      b.vx *= 0.9;
      b.vy *= 0.9;
      b.vz *= 0.9;
    }
    b.rim = true;
  }

  // Backboard: the front face, within its rectangle (the ball's reach included).
  if (b.z - BALL_R < BOARD_Z && b.z > BOARD_Z - 0.2
    && Math.abs(b.x) < BOARD_W / 2 + BALL_R * 0.5
    && b.y > BOARD_BOTTOM - BALL_R * 0.5 && b.y < BOARD_TOP + BALL_R * 0.5) {
    b.z = BOARD_Z + BALL_R;
    if (b.vz < 0) b.vz = -b.vz * BOARD_BOUNCE;
    if (!b.made) b.board = true;
  }

  // Through the hoop: the centre crosses the rim's plane going down, inside the circle.
  if (!b.made && prevY > RIM_Y && b.y <= RIM_Y && Math.hypot(b.x, b.z) < RIM_R) b.made = true;

  // Floor.
  if (b.y < BALL_R) {
    b.y = BALL_R;
    b.vy = Math.abs(b.vy) * 0.55;
    b.vx *= 0.8;
    b.vz *= 0.8;
    b.done = true;
  }
  if (b.made && b.y < RIM_Y - 1.2) b.done = true;
  if (b.t >= SHOT_MAX) b.done = true;
}

/** Advances one ball by `dt` seconds in fixed substeps. Returns a new ball. */
export function stepBall(ball: Ball, dt: number): Ball {
  const b = { ...ball };
  // Whole SUBSTEPs only: the remainder waits in `acc`, so a 60 Hz and a 144 Hz screen run the same steps.
  let acc = (b.acc ?? 0) + Math.max(0, dt);
  while (acc >= SUBSTEP - 1e-12 && !b.done) {
    substep(b, SUBSTEP);
    acc -= SUBSTEP;
  }
  b.acc = b.done ? 0 : acc;
  return b;
}

export function resultOf(b: Ball): ShotResult {
  if (!b.made) return "miss";
  if (b.board) return "bank";
  if (b.rim) return "rim";
  return "swish";
}

/** Points for a basket: 2, or 3 from beyond the arc, plus 1 while on a streak (the streak including this basket). */
export function pointsFor(from: number, streak: number): number {
  return (from >= THREE_POINT ? 3 : 2) + (streak >= STREAK_BONUS_FROM ? 1 : 0);
}

export function canShoot(g: Game): boolean {
  return !g.over && g.sinceShot >= RELOAD && (g.timeLeft === null || g.timeLeft > 0);
}

/** Throws a ball if one is ready. Returns a new game. */
export function shoot(g: Game, yaw: number, power: number): Game {
  if (!canShoot(g)) return g;
  return { ...g, balls: [...g.balls, launch(g.spot, yaw, power)], shots: g.shots + 1, sinceShot: 0 };
}

/**
 * Advances the game `dt` seconds: balls fly, finished shots are scored, the clock runs down in timed mode. A timed
 * game is over once the time is up and every ball in the air has come down.
 */
export function step(game: Game, dt: number): { game: Game; events: ShotEvent[] } {
  if (game.over) return { game, events: [] };
  const g: Game = { ...game, balls: [] };
  const events: ShotEvent[] = [];
  g.sinceShot += dt;
  if (g.timeLeft !== null) g.timeLeft = Math.max(0, g.timeLeft - dt);
  for (const ball of game.balls) {
    const b = stepBall(ball, dt);
    if (!b.done) {
      g.balls.push(b);
      continue;
    }
    const result = resultOf(b);
    if (result === "miss") {
      g.streak = 0;
      events.push({ result, points: 0, streak: 0 });
      continue;
    }
    g.streak += 1;
    g.bestStreak = Math.max(g.bestStreak, g.streak);
    g.makes += 1;
    const points = pointsFor(b.from, g.streak);
    g.score += points;
    events.push({ result, points, streak: g.streak });
    if (g.mode === "timed") {
      g.spotMakes += 1;
      if (g.spotMakes >= MAKES_PER_SPOT) {
        g.spotMakes = 0;
        g.spot = (g.spot + 1) % SPOTS.length;
      }
    }
  }
  if (g.timeLeft === 0 && g.balls.length === 0) g.over = true;
  return { game: g, events };
}

/** Saved settings and records, `cvcm.basketballgame.v1`. */
export interface Saved {
  mode: Mode;
  spot: number;
  best: number;
}

export function cleanSaved(raw: unknown): Saved {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Saved>;
  const best = typeof r.best === "number" && Number.isFinite(r.best) && r.best >= 0 ? Math.floor(r.best) : 0;
  return { mode: r.mode === "practice" ? "practice" : "timed", spot: clampSpot(Number(r.spot)), best };
}
