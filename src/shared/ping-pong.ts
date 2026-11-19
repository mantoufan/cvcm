/**
 * Ping pong / table tennis (games3d group): ball physics, the rules of a rally and the computer player. Pure and
 * deterministic, shared by the page and the tests. Metres and seconds. x runs across the table (−W/2 … W/2), y along
 * it (the player's end line at −L/2, the computer's at +L/2), z is height above the playing surface (the floor is at
 * −FLOOR). The ball moves in fixed substeps; paddle contact is a plane sweep (the ball crossing the paddle's face
 * between two substeps), so a fast ball can never pass through a paddle, and the table is hit on its surface.
 *
 * The paddles: each side's paddle moves in x and y (depth) toward a target; its height follows the ball by itself.
 * A hit sends the ball to a planned landing point (direction from where on the paddle it met, length from the swing),
 * clearing the net, so a rally is about placement and timing rather than exact angles. The computer predicts where
 * the ball will come and reacts with a delay, a position error and an error rate per level.
 */
import { seeded } from "./random";

export const TABLE_W = 1.525;
export const TABLE_L = 2.74;
export const NET_H = 0.1525;
/** The net posts stand this far outside the table's sides. */
export const NET_OVERHANG = 0.1525;
export const BALL_R = 0.02;
export const PADDLE_R = 0.085;
/** Contact reach: paddle face plus ball, a little generous so the game reads fairly on screen. */
export const HIT_R = 0.12;
export const FLOOR = 0.76;
export const WIN_POINTS = 11;
export const SUBSTEP = 1 / 240;
const G = 9.81;
const BOUNCE = 0.88;
const DRAG = 0.03;
/** A bounce that leaves less upward speed than this is a dead ball: it rolls, and the side it dies on loses. */
const DEAD_BOUNCE = 0.25;
/** No hit and no bounce for this long ends the point (a ball stuck rolling or resting somewhere). */
const IDLE_LIMIT = 4;
/** Pause after a point, and before the computer serves. */
export const POINT_PAUSE = 1;
const CPU_SERVE_DELAY = 0.9;
const PADDLE_SPEED = 7;
const SWING_TIME = 0.18;

export type Side = "p" | "c";
export type Level = 0 | 1 | 2;
export const LEVELS: readonly Level[] = [0, 1, 2];
export type Phase = "serve" | "rally" | "point" | "over";
/** Why a point ended, from the loser's side: out (long or wide), net, double (two bounces), miss, fault (serve), let. */
export type Reason = "out" | "net" | "double" | "miss" | "fault" | "own" | "dead" | "let";

/** Computer strength per level. */
const AI = [
  { react: 0.34, speed: 1.7, posErr: 0.06, pNet: 0.12, pOut: 0.1, power: 0.3 },
  { react: 0.2, speed: 2.5, posErr: 0.035, pNet: 0.06, pOut: 0.05, power: 0.5 },
  { react: 0.09, speed: 3.6, posErr: 0.012, pNet: 0.02, pOut: 0.02, power: 0.72 },
] as const;

export interface Ball {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Topspin (+) or backspin (−), −1 … 1: shown on screen, and kicks the ball on the bounce. */
  spin: number;
}

export interface Paddle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
}

export interface Input {
  /** Where the player wants the paddle (table coordinates). */
  x: number;
  y: number;
  /** A swing (Space or a click / tap): serves when it is the player's serve, adds pace to a hit otherwise. */
  swing: boolean;
}

export interface Game {
  level: Level;
  ball: Ball;
  player: Paddle;
  cpu: Paddle;
  /** Points: [player, computer]. */
  score: [number, number];
  phase: Phase;
  server: Side;
  /** Seconds in the current phase (serve wait, point pause). */
  timer: number;
  /** The last side to hit the ball (the server after a serve). */
  lastHitter: Side;
  /** Serve progress: 0 in flight to the server's own half, 1 after that bounce, 2 a normal rally. */
  serveStage: 0 | 1 | 2;
  /** Bounces on the receiving side since the last hit (0 or 1; a second one ends the point). */
  bounces: number;
  /** The ball touched the top of the net since the last hit (a let on a serve). */
  netTouch: boolean;
  /** Seconds with no hit and no bounce. */
  idle: number;
  /** Swing time left (s). */
  swingT: number;
  /** Where the computer heads, and when it starts moving there. */
  aiTarget: { x: number; y: number };
  aiWait: number;
  /** State of the computer's random choices (its errors), advanced on each decision. */
  rng: number;
  /** The last point: who won it and why (for the page's message). */
  lastPoint: { winner: Side | null; reason: Reason } | null;
  /** Points played so far, lets included (the page shows a message when it changes). */
  rallies: number;
  winner: Side | null;
  /** Time not yet stepped (fixed substeps). */
  acc: number;
}

const other = (s: Side): Side => (s === "p" ? "c" : "p");
const sideOf = (y: number): Side => (y < 0 ? "p" : "c");
/** +1 when a side's shots travel toward +y (the player hits toward the computer). */
const dirOf = (s: Side): 1 | -1 => (s === "p" ? 1 : -1);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Who serves at this score: two serves each, the player first; from 10–10 one serve each. */
export function serverFor(score: readonly [number, number]): Side {
  const total = score[0] + score[1];
  if (score[0] >= WIN_POINTS - 1 && score[1] >= WIN_POINTS - 1) return total % 2 === 0 ? "p" : "c";
  return Math.floor(total / 2) % 2 === 0 ? "p" : "c";
}

/** The match winner, if any: 11 points and two clear. */
export function matchWinner(score: readonly [number, number]): Side | null {
  const [p, c] = score;
  if (p >= WIN_POINTS && p - c >= 2) return "p";
  if (c >= WIN_POINTS && c - p >= 2) return "c";
  return null;
}

const HOME_P = { x: 0, y: -TABLE_L / 2 - 0.35 };
const HOME_C = { x: 0, y: TABLE_L / 2 + 0.35 };

export function newGame(level: Level = 1, seed = 1): Game {
  const g: Game = {
    level,
    ball: { x: 0, y: 0, z: 0.3, vx: 0, vy: 0, vz: 0, spin: 0 },
    player: { ...HOME_P, z: 0.2, vx: 0, vy: 0 },
    cpu: { ...HOME_C, z: 0.2, vx: 0, vy: 0 },
    score: [0, 0],
    phase: "serve",
    server: "p",
    timer: 0,
    lastHitter: "p",
    serveStage: 0,
    bounces: 0,
    netTouch: false,
    idle: 0,
    swingT: 0,
    aiTarget: { ...HOME_C },
    aiWait: 0,
    rng: seed >>> 0,
    lastPoint: null,
    rallies: 0,
    winner: null,
    acc: 0,
  };
  holdForServe(g);
  return g;
}

function holdForServe(g: Game): void {
  g.phase = "serve";
  // A swing pressed during the pause between points must not carry over and serve by itself.
  g.swingT = 0;
  g.server = serverFor(g.score);
  g.timer = 0;
  g.serveStage = 0;
  g.bounces = 0;
  g.netTouch = false;
  g.idle = 0;
  g.lastHitter = g.server;
  g.aiTarget = { ...HOME_C };
  placeServeBall(g);
}

function placeServeBall(g: Game): void {
  const pad = g.server === "p" ? g.player : g.cpu;
  const d = dirOf(g.server);
  g.ball = { x: clamp(pad.x, -TABLE_W / 2 + 0.1, TABLE_W / 2 - 0.1), y: -d * (TABLE_L / 2 + 0.06), z: 0.22, vx: 0, vy: 0, vz: 0, spin: 0 };
}

/** One random number for the computer, advancing its state. */
function rand(g: Game): number {
  // A counter hashed through mulberry32 (feeding outputs back as seeds can fall into short cycles).
  g.rng = (g.rng + 1) >>> 0;
  return seeded(Math.imul(g.rng, 0x9e3779b1))();
}

/** Launch from `b` to land at (xt, yt) at horizontal speed |vy|, clearing the net by `clear` (negative: into it). */
export function planShot(b: Ball, xt: number, yt: number, speed: number, clear = 0.03): void {
  const dir = yt > b.y ? 1 : -1;
  const vy = dir * speed;
  const T = Math.max(0.05, Math.abs(yt - b.y) / speed);
  let vz = (BALL_R - b.z + 0.5 * G * T * T) / T;
  // Net clearance (only when the shot crosses the net).
  if ((b.y < 0) !== (yt < 0)) {
    const tn = Math.abs(b.y) / speed;
    const zn = b.z + vz * tn - 0.5 * G * tn * tn;
    const need = NET_H + BALL_R + clear;
    if (zn < need || clear < 0) vz = (need - b.z + 0.5 * G * tn * tn) / tn;
  }
  b.vx = (xt - b.x) / T;
  b.vy = vy;
  b.vz = vz;
}

/**
 * A legal serve from `b` toward `dir`: bounce once on the server's own half, clear the net, land on the receiver's
 * half near `xt`. Tries speeds and first-bounce points 0.3–0.8 m in from the server's end line and keeps the first
 * whose flight (simulated with the real physics) clears the net with room to spare and lands on the far half.
 */
const SERVE_SPEEDS = [4.4, 4.0, 4.8, 3.6, 5.2];

export function planServe(b: Ball, dir: 1 | -1, xt: number): void {
  for (const speed of SERVE_SPEEDS) for (let d1 = 0.3; d1 <= 0.8001; d1 += 0.05) {
    const y1 = -dir * (TABLE_L / 2 - d1);
    const t1 = Math.abs(y1 - b.y) / speed;
    const vz = (BALL_R - b.z + 0.5 * G * t1 * t1) / t1;
    const vx = (xt - b.x) / (t1 + 0.5);
    const probe: Ball = { ...b, vx, vy: dir * speed, vz };
    let bounced = false;
    let ok = false;
    for (let i = 0; i < 2 / SUBSTEP; i++) {
      const yPrev = probe.y;
      flight(probe, SUBSTEP);
      if (probe.vz < 0 && probe.z - BALL_R <= 0 && onTable(probe.x, probe.y)) {
        if (bounced) {
          ok = sideOf(probe.y) !== sideOf(b.y) && Math.abs(probe.y) < TABLE_L / 2 - 0.08;
          break;
        }
        bounced = true;
        probe.z = BALL_R;
        probe.vz = -probe.vz * BOUNCE;
      }
      if ((yPrev < 0) !== (probe.y < 0) && probe.z < NET_H + BALL_R + 0.04) break;
      if (probe.z < -0.3) break;
    }
    if (ok) {
      b.vx = vx;
      b.vy = dir * speed;
      b.vz = vz;
      return;
    }
  }
  // Fallback (never expected): a high, slow serve.
  b.vy = dir * 2.6;
  b.vz = 0.6;
  b.vx = 0;
}

function serve(g: Game, x: number): void {
  const d = dirOf(g.server);
  g.ball.x = clamp(x, -TABLE_W / 2 + 0.1, TABLE_W / 2 - 0.1);
  const xt = g.server === "p" ? clamp(g.ball.x * 0.3, -0.5, 0.5) : (rand(g) - 0.5) * 0.9;
  planServe(g.ball, d, xt);
  g.ball.spin = 0.2;
  g.phase = "rally";
  g.serveStage = 0;
  g.lastHitter = g.server;
  g.bounces = 0;
  g.netTouch = false;
  g.idle = 0;
  g.timer = 0;
  g.swingT = 0;
  if (g.server === "c") g.aiTarget = { ...HOME_C };
  else {
    const target = predictIntercept(g, true);
    g.aiTarget = target ? { x: target.x, y: clamp(target.y, 0.25, TABLE_L / 2 + 0.6) } : { ...HOME_C };
    g.aiWait = AI[g.level].react;
  }
}

function endPoint(g: Game, loser: Side, reason: Reason): void {
  const winner = other(loser);
  if (winner === "p") g.score[0]++;
  else g.score[1]++;
  g.lastPoint = { winner, reason };
  g.rallies++;
  g.winner = matchWinner(g.score);
  g.phase = g.winner ? "over" : "point";
  g.timer = 0;
}

function letServe(g: Game): void {
  g.lastPoint = { winner: null, reason: "let" };
  g.rallies++;
  g.phase = "point";
  g.timer = 0;
}

/** The ball bounced on the table at side `s` with upward speed `up` after the bounce. */
function onBounce(g: Game, s: Side, up: number): void {
  g.idle = 0;
  if (g.serveStage === 0) {
    if (s !== g.server) return endPoint(g, g.server, "fault");
    g.serveStage = 1;
    if (up < DEAD_BOUNCE) return endPoint(g, g.server, "fault");
    return;
  }
  if (g.serveStage === 1) {
    if (s === g.server) return endPoint(g, g.server, "fault");
    if (g.netTouch) return letServe(g);
    g.serveStage = 2;
    g.bounces = 1;
    if (up < DEAD_BOUNCE) return endPoint(g, s, "dead");
    return;
  }
  const hitter = g.lastHitter;
  if (s === hitter) return endPoint(g, hitter, "own");
  if (g.bounces >= 1) return endPoint(g, s, "double");
  g.bounces = 1;
  if (up < DEAD_BOUNCE) endPoint(g, s, "dead");
}

/** The ball is out of play (on the floor, far away, or idle too long): who loses? */
function deadBall(g: Game, why: Reason): void {
  if (g.serveStage < 2) return endPoint(g, g.server, "fault");
  // It had bounced on the receiver's side: the receiver failed to return it.
  if (g.bounces >= 1) return endPoint(g, other(g.lastHitter), "miss");
  endPoint(g, g.lastHitter, why);
}

function canHit(g: Game, s: Side): boolean {
  return g.phase === "rally" && g.serveStage === 2 && g.lastHitter !== s && g.bounces === 1;
}

/** The player's return: direction from where on the paddle the ball met it and the paddle's sideways motion. */
function playerShot(g: Game, offset: number): void {
  const p = g.player;
  const forward = Math.max(0, p.vy) + (g.swingT > 0 ? 3 : 0);
  const power = clamp(0.2 + 0.15 * forward + 0.04 * Math.hypot(p.vx, p.vy), 0.15, 1);
  const xt = g.ball.x * 0.2 + offset * 0.6 * (TABLE_W / 2) + p.vx * 0.12;
  const yt = 0.4 + 0.8 * power;
  planShot(g.ball, xt, yt, 3.2 + 4.5 * power);
  // A hit on the paddle's edge comes off low: it may find the net.
  if (Math.abs(offset) > 0.8) g.ball.vz *= 0.7;
  g.ball.spin = clamp(power * 0.8, -1, 1);
}

function cpuShot(g: Game): void {
  const lv = AI[g.level];
  const xt = (rand(g) * 2 - 1) * 0.65 * (TABLE_W / 2);
  let yt = -(0.5 + rand(g) * 0.6);
  const err = rand(g);
  let clear = 0.03;
  if (err < lv.pNet) clear = -0.05;
  // A long error: well past the end line (air drag shortens a flight by a few centimetres).
  else if (err < lv.pNet + lv.pOut) yt = -(TABLE_L / 2 + 0.35);
  planShot(g.ball, xt, yt, 3.2 + 4.5 * lv.power, clear);
  g.ball.spin = lv.power * 0.8;
}

/**
 * Where the ball will be when the computer should meet it: after it bounces on the computer's side, at the top of
 * that bounce or where it crosses the computer's usual depth. Null when it will not bounce there (going out).
 */
export function predictIntercept(g: Game, serveFlight = false): { x: number; y: number } | null {
  const b = { ...g.ball };
  let bounced = false;
  // A serve bounces once on the server's own half first.
  let ownBounces = serveFlight ? 1 : 0;
  let peakSeen = false;
  for (let i = 0; i < 2.5 / SUBSTEP; i++) {
    const zPrev = b.z;
    flight(b, SUBSTEP);
    if (b.vz < 0 && b.z - BALL_R <= 0 && onTable(b.x, b.y)) {
      b.z = BALL_R;
      b.vz = -b.vz * BOUNCE;
      if (sideOf(b.y) === "c") {
        if (bounced) return null;
        bounced = true;
      } else if (!bounced) {
        // Bouncing on the hitter's own side (other than a serve's first bounce): a point for us, nothing to play.
        if (ownBounces === 0) return null;
        ownBounces--;
      }
    }
    if (bounced) {
      if (!peakSeen && b.vz <= 0 && zPrev >= b.z) peakSeen = true;
      if (peakSeen || b.y >= TABLE_L / 2 + 0.25) return { x: b.x, y: b.y };
    }
    if (b.z < -0.3) return null;
  }
  return null;
}

function onTable(x: number, y: number): boolean {
  return Math.abs(x) <= TABLE_W / 2 && Math.abs(y) <= TABLE_L / 2;
}

/** Gravity and air drag. */
function flight(b: Ball, h: number): void {
  const v = Math.hypot(b.vx, b.vy, b.vz);
  const k = 1 - DRAG * v * h;
  b.vx *= k;
  b.vy *= k;
  b.vz = b.vz * k - G * h;
  b.x += b.vx * h;
  b.y += b.vy * h;
  b.z += b.vz * h;
}

function movePaddle(p: Paddle, tx: number, ty: number, maxSpeed: number, h: number): void {
  const dx = tx - p.x, dy = ty - p.y;
  const d = Math.hypot(dx, dy);
  const step = Math.min(d, maxSpeed * h);
  const nx = d > 1e-9 ? (dx / d) * step : 0;
  const ny = d > 1e-9 ? (dy / d) * step : 0;
  p.x += nx;
  p.y += ny;
  p.vx = nx / h;
  p.vy = ny / h;
}

/** Paddle height follows the ball while it comes toward that side, else rests at a ready height. */
function trackHeight(p: Paddle, b: Ball, toward: boolean, h: number): void {
  const want = toward ? clamp(b.z, 0.03, 0.7) : 0.2;
  const dz = want - p.z;
  p.z += clamp(dz, -4 * h, 4 * h);
}

/** A paddle at plane y = p.y (moving) meets the ball that crossed it this substep (`dir`: ball travel toward it). */
function crossed(p: Paddle, pyPrev: number, b: Ball, byPrev: number, dir: 1 | -1): boolean {
  const rel0 = (byPrev - pyPrev) * dir;
  const rel1 = (b.y - p.y) * dir;
  if (!(rel0 < 0 && rel1 >= 0)) return false;
  return Math.hypot(b.x - p.x, b.z - p.z) <= HIT_R;
}

export function clampPlayer(x: number, y: number): { x: number; y: number } {
  // Back to 0.9 m behind the end line, forward to 0.1 m over it. A legal return bounces on the player's half before
  // it gets that far, so the paddle plane is never crossed before the bounce (a paddle further in would let the
  // ball fly through it unhit: contact only counts after the bounce).
  return { x: clamp(x, -TABLE_W / 2 - 0.45, TABLE_W / 2 + 0.45), y: clamp(y, -TABLE_L / 2 - 0.9, -TABLE_L / 2 + 0.1) };
}

function substep(g: Game, input: Input, swingEdge: boolean, h: number): void {
  if (g.phase === "over") return;
  g.timer += h;
  g.swingT = Math.max(0, g.swingT - h);
  if (swingEdge) g.swingT = SWING_TIME;
  const swinging = g.swingT > 0;

  // Paddles.
  const pyPrev = g.player.y, cyPrev = g.cpu.y;
  const t = clampPlayer(input.x, input.y);
  movePaddle(g.player, t.x, t.y, PADDLE_SPEED, h);
  const lv = AI[g.level];
  if (g.aiWait > 0) g.aiWait -= h;
  else movePaddle(g.cpu, g.aiTarget.x, g.aiTarget.y, lv.speed, h);
  const towardP = g.ball.vy < 0, towardC = g.ball.vy > 0;
  trackHeight(g.player, g.ball, towardP && g.phase === "rally", h);
  trackHeight(g.cpu, g.ball, towardC && g.phase === "rally", h);

  if (g.phase === "point") {
    if (g.timer >= POINT_PAUSE) holdForServe(g);
    return;
  }
  if (g.phase === "serve") {
    placeServeBall(g);
    if (g.server === "p" && swinging) serve(g, g.player.x);
    else if (g.server === "c" && g.timer >= CPU_SERVE_DELAY) serve(g, g.cpu.x);
    return;
  }

  // Rally: the ball flies.
  const b = g.ball;
  const yPrev = b.y, zPrev = b.z;
  flight(b, h);
  g.idle += h;

  // Net (and its posts beyond the sides).
  if ((yPrev < 0) !== (b.y < 0) && Math.abs(b.x) <= TABLE_W / 2 + NET_OVERHANG) {
    const f = Math.abs(yPrev) / (Math.abs(yPrev) + Math.abs(b.y) || 1);
    const zc = zPrev + (b.z - zPrev) * f;
    if (zc < NET_H + BALL_R && zc > -BALL_R) {
      if (zc > NET_H - BALL_R * 0.5) {
        // Clips the top of the net and dribbles over.
        g.netTouch = true;
        b.vy *= 0.55;
        b.vz = Math.abs(b.vz) * 0.3 + 0.2;
        b.vx *= 0.7;
      } else {
        // Into the net: it drops back on the hitter's side.
        b.y = yPrev < 0 ? -0.01 : 0.01;
        b.vy = -b.vy * 0.12;
        b.vx *= 0.3;
        b.vz = Math.min(b.vz, 0);
        if (g.serveStage < 2) return endPoint(g, g.server, "net");
        return endPoint(g, g.lastHitter, "net");
      }
    }
  }

  // Table.
  if (b.vz < 0 && b.z - BALL_R <= 0 && zPrev - BALL_R >= -0.005 && onTable(b.x, b.y)) {
    b.z = BALL_R;
    const up = -b.vz * BOUNCE;
    b.vz = up;
    b.vx *= 0.97;
    b.vy *= 0.97 + 0.06 * b.spin;
    b.spin *= 0.6;
    onBounce(g, sideOf(b.y), up);
    if (g.phase !== "rally") return;
  }

  // Paddles.
  if (canHit(g, "p") && crossed(g.player, pyPrev, b, yPrev, -1)) {
    const offset = clamp((b.x - g.player.x) / HIT_R, -1, 1);
    playerShot(g, offset);
    afterHit(g, "p");
    // The computer reads the shot after its reaction time.
    const target = predictIntercept(g);
    const err = (rand(g) * 2 - 1) * lv.posErr;
    g.aiTarget = target ? { x: target.x + err, y: clamp(target.y, 0.25, TABLE_L / 2 + 0.6) } : { ...HOME_C };
    g.aiWait = lv.react;
  } else if (canHit(g, "c") && crossed(g.cpu, cyPrev, b, yPrev, 1)) {
    cpuShot(g);
    afterHit(g, "c");
    g.aiTarget = { ...HOME_C };
  }

  // Out of play.
  if (b.z < -0.3 || Math.abs(b.y) > TABLE_L / 2 + 3 || Math.abs(b.x) > 3) return deadBall(g, "out");
  if (g.idle > IDLE_LIMIT) return deadBall(g, "dead");
}

function afterHit(g: Game, s: Side): void {
  g.lastHitter = s;
  g.bounces = 0;
  g.netTouch = false;
  g.idle = 0;
}

/** Advances the game by `dt` seconds in fixed substeps. `input.swing` is a press (edge), used once. */
export function step(game: Game, input: Input, dt: number): Game {
  const g: Game = {
    ...game,
    ball: { ...game.ball },
    player: { ...game.player },
    cpu: { ...game.cpu },
    score: [game.score[0], game.score[1]],
    aiTarget: { ...game.aiTarget },
    lastPoint: game.lastPoint ? { ...game.lastPoint } : null,
  };
  g.acc += Math.min(0.1, Math.max(0, dt));
  let swing = input.swing;
  while (g.acc >= SUBSTEP) {
    g.acc -= SUBSTEP;
    substep(g, input, swing, SUBSTEP);
    swing = false;
  }
  // A press between substeps still counts on the next one.
  if (swing) g.swingT = SWING_TIME;
  return g;
}

/** Saved wins and losses per level, `cvcm.pingpong.v1`. */
export interface PongRecord {
  wins: [number, number, number];
  losses: [number, number, number];
  level: Level;
}

export function cleanRecord(raw: unknown): PongRecord {
  const out: PongRecord = { wins: [0, 0, 0], losses: [0, 0, 0], level: 1 };
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Partial<PongRecord>;
  const nums = (a: unknown): [number, number, number] =>
    Array.isArray(a) && a.length === 3 && a.every((n) => Number.isInteger(n) && n >= 0) ? [a[0], a[1], a[2]] : [0, 0, 0];
  out.wins = nums(r.wins);
  out.losses = nums(r.losses);
  if (r.level === 0 || r.level === 1 || r.level === 2) out.level = r.level;
  return out;
}
