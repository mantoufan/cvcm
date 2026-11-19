/**
 * Ten-pin bowling (games3d group): lane physics, pins, scoring and the computer bowler, shared by the page and the
 * tests. Pure and deterministic. Units are metres and seconds; x runs across the lane (0 = centre, negative = the
 * bowler's left), y runs from the foul line (0) toward the pins. The ball and pins move in fixed substeps short
 * enough that nothing passes through anything else at the top speed.
 */
import { approxNormal } from "./random";

/** Foul line to the head pin. */
export const LANE_LEN = 18.29;
/** Half the lane's width (41.5 in). */
export const LANE_HALF = 0.527;
export const GUTTER_W = 0.235;
export const BALL_R = 0.109;
export const PIN_R = 0.06;
export const PIN_H = 0.381;
/** Pin spacing (12 in between neighbouring spots). */
const SPACING = 0.3048;
const ROW = SPACING * Math.sqrt(3) / 2;
/** The back of the pin deck; past it a pin or the ball falls into the pit. */
export const DECK_END = LANE_LEN + 3 * ROW + 0.45;
export const PIT_Y = DECK_END + 0.35;
/** The lane is oiled up to here; past it a spinning ball hooks. */
export const OIL_END = 10.5;
export const SPEED_MIN = 4.5;
export const SPEED_MAX = 9.5;
/** Fixed physics step: at the top speed a step moves 0.02 m, far less than a pin's radius. */
export const SUBSTEP = 1 / 480;
/** A roll always ends by this many seconds. */
export const ROLL_TIMEOUT = 9;
export const FRAMES = 10;
export const PINS = 10;

const BALL_MASS = 6.8;
const PIN_MASS = 1.5;
const RESTITUTION = 0.65;
const HOOK_ACC = 0.6;
const BALL_DECEL = 0.12;
const STANDING_DECEL = 7;
const DOWN_DECEL = 2.2;
/** A standing pin whose speed changes by more than this in one hit falls over. */
const FALL_DV = 0.32;
const MAX_SPEED = 16;
/** A lying pin is long: it reaches further than a standing one. */
const DOWN_R = PIN_R * 1.7;

/** Pin spots, pins 1–10: the head pin, then rows of 2, 3, 4 from the bowler's left to right. */
export const PIN_SPOTS: readonly { x: number; y: number }[] = (() => {
  const out: { x: number; y: number }[] = [];
  for (let r = 0; r < 4; r++) for (let k = 0; k <= r; k++) out.push({ x: (k - r / 2) * SPACING, y: LANE_LEN + r * ROW });
  return out;
})();

export interface Pin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Knocked over (stays down for the rest of the roll). */
  down: boolean;
  /** Fell off the deck into the pit or a gutter. */
  gone: boolean;
  /** Direction it fell (radians, like atan2(vy, vx)) and how far over it is (0 standing → 1 lying). */
  fall: number;
  tilt: number;
  /** Was on the deck when the roll started (not swept away earlier in the frame). */
  inPlay: boolean;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hook: number;
  gutter: boolean;
  /** In the pit or stopped. */
  done: boolean;
}

export interface Roll {
  ball: Ball;
  pins: Pin[];
  t: number;
  /** Unused part of the last frame's time (fixed substeps). */
  acc: number;
  ended: boolean;
}

/** What the bowler chooses: where the ball is released, its direction, its speed and its spin. */
export interface Release {
  /** Across the lane at the foul line, metres from the centre. */
  x: number;
  /** Radians from straight down the lane, positive toward the bowler's right. */
  angle: number;
  /** 0–1 → SPEED_MIN–SPEED_MAX. */
  power: number;
  /** −1 (curves left) to 1 (curves right). */
  hook: number;
}

export const RELEASE_X = LANE_HALF - BALL_R;
export const MAX_ANGLE = 0.06;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function launchSpeed(power: number): number {
  return SPEED_MIN + (SPEED_MAX - SPEED_MIN) * clamp(power, 0, 1);
}

export function cleanRelease(r: Release): Release {
  return {
    x: clamp(r.x, -RELEASE_X, RELEASE_X),
    angle: clamp(r.angle, -MAX_ANGLE, MAX_ANGLE),
    power: clamp(r.power, 0, 1),
    hook: clamp(r.hook, -1, 1),
  };
}

export function rackPins(standing: readonly boolean[]): Pin[] {
  return PIN_SPOTS.map((s, i) => ({
    x: s.x, y: s.y, vx: 0, vy: 0,
    down: !standing[i], gone: !standing[i], fall: Math.PI / 2, tilt: standing[i] ? 0 : 1, inPlay: !!standing[i],
  }));
}

export function startRoll(standing: readonly boolean[], release: Release): Roll {
  const r = cleanRelease(release);
  const v = launchSpeed(r.power);
  return {
    ball: { x: r.x, y: 0, vx: v * Math.sin(r.angle), vy: v * Math.cos(r.angle), hook: r.hook, gutter: false, done: false },
    pins: rackPins(standing),
    t: 0,
    acc: 0,
    ended: false,
  };
}

/** Pushes two overlapping circles apart and exchanges momentum along the line between them. Returns b's speed change. */
function bounce(a: { x: number; y: number; vx: number; vy: number }, ma: number, ra: number, b: { x: number; y: number; vx: number; vy: number }, mb: number, rb: number): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d2 = dx * dx + dy * dy;
  const min = ra + rb;
  if (d2 >= min * min) return -1;
  const d = Math.sqrt(d2) || 1e-6;
  const nx = d2 ? dx / d : 0, ny = d2 ? dy / d : 1;
  const ia = 1 / ma, ib = 1 / mb;
  const push = (min - d) / (ia + ib);
  a.x -= nx * push * ia;
  a.y -= ny * push * ia;
  b.x += nx * push * ib;
  b.y += ny * push * ib;
  const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rel >= 0) return 0;
  const j = (-(1 + RESTITUTION) * rel) / (ia + ib);
  a.vx -= j * ia * nx;
  a.vy -= j * ia * ny;
  b.vx += j * ib * nx;
  b.vy += j * ib * ny;
  return j * ib;
}

function knock(p: Pin, dv: number): void {
  if (!p.down && dv > FALL_DV) {
    p.down = true;
    p.fall = Math.atan2(p.vy, p.vx);
  }
}

function capSpeed(o: { vx: number; vy: number }): void {
  const s = Math.hypot(o.vx, o.vy);
  if (s > MAX_SPEED) {
    o.vx *= MAX_SPEED / s;
    o.vy *= MAX_SPEED / s;
  }
}

function slow(o: { vx: number; vy: number }, decel: number, h: number): void {
  const s = Math.hypot(o.vx, o.vy);
  if (!s) return;
  const n = Math.max(0, s - decel * h);
  o.vx *= n / s;
  o.vy *= n / s;
}

function substep(r: Roll, h: number): void {
  r.t += h;
  const b = r.ball;
  if (!b.done) {
    if (!b.gutter && Math.abs(b.x) > LANE_HALF - BALL_R * 0.3) {
      // Over the edge: the ball drops into the gutter and runs past the pins.
      b.gutter = true;
      b.x = Math.sign(b.x) * (LANE_HALF + GUTTER_W / 2);
      b.vx = 0;
    }
    if (!b.gutter && b.y > OIL_END && b.y < LANE_LEN) b.vx += b.hook * HOOK_ACC * h;
    slow(b, BALL_DECEL, h);
    b.x += b.vx * h;
    b.y += b.vy * h;
    if (b.y > PIT_Y) {
      b.y = PIT_Y;
      b.done = true;
      b.vx = b.vy = 0;
    } else if (Math.hypot(b.vx, b.vy) < 0.2) {
      b.done = true;
      b.vx = b.vy = 0;
    }
  }
  for (const p of r.pins) {
    if (p.gone) continue;
    slow(p, p.down ? DOWN_DECEL : STANDING_DECEL, h);
    p.x += p.vx * h;
    p.y += p.vy * h;
    if (p.down && p.tilt < 1) p.tilt = Math.min(1, p.tilt + h / 0.28);
    if (p.y > DECK_END || p.y < LANE_LEN - 1.2 || Math.abs(p.x) > LANE_HALF + 0.02) {
      p.gone = true;
      p.down = true;
      p.tilt = 1;
      p.vx = p.vy = 0;
    }
  }
  // Ball against pins (not from the gutter), then pins against pins.
  if (!b.gutter && !b.done) {
    for (const p of r.pins) {
      if (p.gone) continue;
      const dv = bounce(b, BALL_MASS, BALL_R, p, PIN_MASS, p.down ? DOWN_R : PIN_R);
      if (dv >= 0) knock(p, dv);
    }
  }
  const pins = r.pins;
  for (let i = 0; i < pins.length; i++) {
    const a = pins[i]!;
    if (a.gone) continue;
    for (let k = i + 1; k < pins.length; k++) {
      const c = pins[k]!;
      if (c.gone) continue;
      const before = Math.hypot(a.vx, a.vy);
      const dv = bounce(a, PIN_MASS, a.down ? DOWN_R : PIN_R, c, PIN_MASS, c.down ? DOWN_R : PIN_R);
      if (dv >= 0) {
        knock(c, dv);
        knock(a, Math.abs(Math.hypot(a.vx, a.vy) - before) + (dv > 0 ? dv * 0.5 : 0));
      }
    }
  }
  capSpeed(b);
  for (const p of pins) capSpeed(p);
}

function settled(r: Roll): boolean {
  if (!r.ball.done) return false;
  return r.pins.every((p) => p.gone || Math.hypot(p.vx, p.vy) < 0.04);
}

/** Advances a roll in place by `dt` seconds in fixed substeps (the page's frame loop: no allocation). */
export function advanceRoll(r: Roll, dt: number): void {
  if (r.ended) return;
  r.acc += Math.max(0, dt);
  while (r.acc >= SUBSTEP && !r.ended) {
    r.acc -= SUBSTEP;
    substep(r, SUBSTEP);
    if (settled(r) || r.t >= ROLL_TIMEOUT) r.ended = true;
  }
  if (r.ended) for (const p of r.pins) if (p.down) p.tilt = 1;
}

/** Advances a roll by `dt` seconds in fixed substeps. Returns a new roll; the input is not changed. */
export function stepRoll(roll: Roll, dt: number): Roll {
  const r: Roll = { ...roll, ball: { ...roll.ball }, pins: roll.pins.map((p) => ({ ...p })) };
  advanceRoll(r, dt);
  return r;
}

/** Plays a roll to its end at once (leaving the page mid-roll, the computer's preview, tests). */
export function finishRoll(roll: Roll): Roll {
  let r = roll;
  for (let i = 0; i < 200 && !r.ended; i++) r = stepRoll(r, 0.05);
  return r.ended ? r : { ...r, ended: true };
}

/** Pins still standing after the roll. */
export function standingAfter(r: Roll): boolean[] {
  return r.pins.map((p) => p.inPlay && !p.down && !p.gone);
}

/** Pins knocked down by this roll. */
export function knocked(r: Roll): number {
  return r.pins.filter((p) => p.inPlay && (p.down || p.gone)).length;
}

// ---------------------------------------------------------------- scoring

export interface Card {
  /** Running total after each frame, null until it can be scored. */
  cumulative: (number | null)[];
  total: number;
  /** All ten frames bowled. */
  done: boolean;
  /** Frame (0–9) and ball in it (0–2) of the next roll; frame 10 when done. */
  frame: number;
  ball: number;
  /** The next roll is at a full rack. */
  fresh: boolean;
  /** Pins the next roll can knock down. */
  left: number;
}

/** Scores a list of pin counts per roll (ten-pin rules: strike = 10 + next two rolls, spare = 10 + next roll). */
export function scoreCard(rolls: readonly number[]): Card {
  const cumulative: (number | null)[] = [];
  let total = 0;
  let i = 0;
  let frame = 0;
  let ball = 0;
  let fresh = true;
  let left = PINS;
  let done = false;
  for (let f = 0; f < FRAMES; f++) {
    const a = rolls[i];
    if (a === undefined) {
      frame = f;
      ball = 0;
      fresh = true;
      left = PINS;
      break;
    }
    if (f < FRAMES - 1) {
      if (a === PINS) {
        const b1 = rolls[i + 1], b2 = rolls[i + 2];
        if (b1 !== undefined && b2 !== undefined) {
          total += PINS + b1 + b2;
          cumulative.push(total);
        } else cumulative.push(null);
        i += 1;
        continue;
      }
      const b = rolls[i + 1];
      if (b === undefined) {
        cumulative.push(null);
        frame = f;
        ball = 1;
        fresh = false;
        left = PINS - a;
        break;
      }
      if (a + b === PINS) {
        const c = rolls[i + 2];
        if (c !== undefined) {
          total += PINS + c;
          cumulative.push(total);
        } else cumulative.push(null);
      } else {
        total += a + b;
        cumulative.push(total);
      }
      i += 2;
      continue;
    }
    // Tenth frame: up to three balls.
    const b = rolls[i + 1], c = rolls[i + 2];
    if (b === undefined) {
      cumulative.push(null);
      frame = f;
      ball = 1;
      fresh = a === PINS;
      left = a === PINS ? PINS : PINS - a;
      break;
    }
    const third = a === PINS || a + b === PINS;
    if (third && c === undefined) {
      cumulative.push(null);
      frame = f;
      ball = 2;
      // A full rack again after a strike on the second ball or a spare; otherwise what the second ball left.
      fresh = (a === PINS && b === PINS) || (a < PINS && a + b === PINS);
      left = fresh ? PINS : PINS - b;
      break;
    }
    total += a + b + (third ? c! : 0);
    cumulative.push(total);
    done = true;
    frame = FRAMES;
    ball = 0;
    left = 0;
    fresh = false;
  }
  while (cumulative.length < FRAMES) cumulative.push(null);
  return { cumulative, total, done, frame, ball, fresh, left };
}

/** What each frame box shows: "X", "/", "-" (a miss) or the pin count, per ball. */
export function frameMarks(rolls: readonly number[]): string[][] {
  const out: string[][] = [];
  let i = 0;
  const pins = (n: number) => (n === 0 ? "-" : String(n));
  for (let f = 0; f < FRAMES; f++) {
    const a = rolls[i];
    if (a === undefined) {
      out.push([]);
      continue;
    }
    if (f < FRAMES - 1) {
      if (a === PINS) {
        out.push(["X"]);
        i += 1;
        continue;
      }
      const b = rolls[i + 1];
      out.push(b === undefined ? [pins(a)] : [pins(a), a + b === PINS ? "/" : pins(b)]);
      i += 2;
      continue;
    }
    const marks: string[] = [a === PINS ? "X" : pins(a)];
    const b = rolls[i + 1], c = rolls[i + 2];
    if (b !== undefined) marks.push(a === PINS ? (b === PINS ? "X" : pins(b)) : a + b === PINS ? "/" : pins(b));
    if (c !== undefined) {
      const firstTwoOpenOnSecond = a === PINS && b !== PINS;
      marks.push(c === PINS && !firstTwoOpenOnSecond ? "X" : firstTwoOpenOnSecond && b! + c === PINS ? "/" : pins(c));
    }
    out.push(marks);
  }
  return out;
}

// ---------------------------------------------------------------- game

export type Level = 0 | 1 | 2;
export const LEVELS: readonly Level[] = [0, 1, 2];

export interface Player {
  cpu: boolean;
  rolls: number[];
}

export interface Game {
  players: Player[];
  /** Whose roll it is. */
  turn: number;
  /** Pins standing for the next roll. */
  standing: boolean[];
  over: boolean;
}

export const FULL_RACK: readonly boolean[] = Array.from({ length: PINS }, () => true);

export function newGame(withCpu: boolean): Game {
  return { players: withCpu ? [{ cpu: false, rolls: [] }, { cpu: true, rolls: [] }] : [{ cpu: false, rolls: [] }], turn: 0, standing: [...FULL_RACK], over: false };
}

/** Records a roll that left `after` standing (of `game.standing`), and moves on to the next roll or player. */
export function applyRoll(game: Game, after: readonly boolean[]): Game {
  if (game.over) return game;
  const players = game.players.map((p) => ({ ...p, rolls: [...p.rolls] }));
  const me = players[game.turn]!;
  const before = scoreCard(me.rolls);
  const down = game.standing.filter((s, i) => s && !after[i]).length;
  me.rolls.push(Math.min(before.left, down));
  const card = scoreCard(me.rolls);
  const frameDone = card.done || card.frame !== before.frame;
  if (!frameDone) {
    return { ...game, players, standing: card.fresh ? [...FULL_RACK] : game.standing.map((s, i) => s && !!after[i]) };
  }
  // Next player who still has frames to bowl, in order.
  for (let k = 1; k <= players.length; k++) {
    const next = (game.turn + k) % players.length;
    if (!scoreCard(players[next]!.rolls).done) return { players, turn: next, standing: [...FULL_RACK], over: false };
  }
  return { players, turn: game.turn, standing: [...FULL_RACK], over: true };
}

/** A saved game read back from storage, or null when it does not hold together. */
export function cleanGame(raw: unknown): Game | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Partial<Game>;
  if (!Array.isArray(g.players) || g.players.length < 1 || g.players.length > 2) return null;
  const players: Player[] = [];
  for (const p of g.players) {
    if (!p || !Array.isArray(p.rolls) || p.rolls.length > 21) return null;
    if (!p.rolls.every((n) => Number.isInteger(n) && n >= 0 && n <= PINS)) return null;
    players.push({ cpu: !!p.cpu, rolls: [...p.rolls] });
  }
  // Replay the rolls frame by frame to check every count fits the pins that were standing.
  for (const p of players) {
    for (let k = 0; k < p.rolls.length; k++) {
      const card = scoreCard(p.rolls.slice(0, k));
      if (card.done || p.rolls[k]! > card.left) return null;
    }
  }
  const turn = typeof g.turn === "number" && g.turn >= 0 && g.turn < players.length ? g.turn : 0;
  const standing = Array.isArray(g.standing) && g.standing.length === PINS ? g.standing.map((s) => !!s) : [...FULL_RACK];
  const over = players.every((p) => scoreCard(p.rolls).done);
  const card = scoreCard(players[turn]!.rolls);
  if (card.fresh) return { players, turn, standing: [...FULL_RACK], over };
  // Mid-frame, the standing pins must be exactly the pins the card says are left.
  if (standing.filter(Boolean).length !== card.left) return null;
  return { players, turn, standing, over };
}

// ---------------------------------------------------------------- computer bowler

const NOISE: Record<Level, { angle: number; x: number; power: number }> = {
  0: { angle: 0.011, x: 0.05, power: 0.12 },
  1: { angle: 0.0065, x: 0.03, power: 0.08 },
  2: { angle: 0.0032, x: 0.015, power: 0.04 },
};

/** Where the computer aims: the 1–3 pocket at a full rack, otherwise the front of what is left. */
export function cpuTarget(standing: readonly boolean[]): number {
  if (standing.every(Boolean)) return 0.065;
  let best = -1;
  let sumX = 0;
  let n = 0;
  // The front-most standing row, then the middle of its pins.
  for (let i = 0; i < PINS; i++) {
    if (!standing[i]) continue;
    const y = PIN_SPOTS[i]!.y;
    if (best < 0 || y < best - 1e-6) {
      best = y;
      sumX = 0;
      n = 0;
    }
    if (Math.abs(y - best) < 1e-6) {
      sumX += PIN_SPOTS[i]!.x;
      n++;
    }
  }
  return n ? sumX / n : 0;
}

/** The computer's release: straight at its target from the same side, with the level's scatter. */
export function cpuRelease(standing: readonly boolean[], level: Level, rand: () => number): Release {
  const noise = NOISE[level];
  const gauss = () => approxNormal(rand);
  const tx = cpuTarget(standing);
  const x0 = clamp(tx * 1.6, -RELEASE_X, RELEASE_X) + gauss() * noise.x;
  const angle = Math.atan2(tx - x0, LANE_LEN) + gauss() * noise.angle;
  return cleanRelease({ x: x0, angle, power: 0.78 + gauss() * noise.power, hook: 0 });
}

/** Best score and settings saved in `cvcm.bowling.v1`. */
export interface Saved {
  best: number;
  mode: "solo" | "cpu";
  level: Level;
  game: Game | null;
}

export function cleanSaved(raw: unknown): Saved {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Saved>;
  const best = typeof r.best === "number" && r.best >= 0 && r.best <= 300 ? Math.floor(r.best) : 0;
  const mode = r.mode === "solo" ? "solo" : "cpu";
  const level = LEVELS.includes(r.level as Level) ? (r.level as Level) : 1;
  return { best, mode, level, game: cleanGame(r.game) };
}
