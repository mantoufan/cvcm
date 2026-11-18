/**
 * Darts (games3d group): board geometry and scoring, the throw model, the checkout table and the match rules for 501
 * (double out), Around the Clock and free practice. Pure functions only, so the page and the tests share them.
 * Board coordinates are millimetres from the centre, x to the right, y up; 20 is at the top.
 */

/** Sector numbers clockwise from the top. */
export const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5] as const;

/** Regulation ring radii (mm, to the outer edge of each wire). */
export const BULL_R = 6.35;
export const OUTER_BULL_R = 15.9;
export const TRIPLE_IN = 99;
export const TRIPLE_OUT = 107;
export const DOUBLE_IN = 162;
export const DOUBLE_OUT = 170;

/** One dart's result. `sector` 25 is the bull (mult 1 = outer bull 25, mult 2 = bull 50); `sector` 0 is a miss. */
export interface Hit {
  sector: number;
  mult: 0 | 1 | 2 | 3;
  score: number;
}

export const MISS: Hit = { sector: 0, mult: 0, score: 0 };

/** The bed a dart lands in. */
export function scoreAt(x: number, y: number): Hit {
  const r = Math.hypot(x, y);
  if (r <= BULL_R) return { sector: 25, mult: 2, score: 50 };
  if (r <= OUTER_BULL_R) return { sector: 25, mult: 1, score: 25 };
  if (r > DOUBLE_OUT) return MISS;
  // Degrees clockwise from the top; each sector spans ±9° around its centre line.
  const deg = (Math.atan2(x, y) * 180) / Math.PI;
  const idx = Math.floor((((deg + 9) % 360) + 360) % 360 / 18) % 20;
  const sector = SECTORS[idx]!;
  const mult = r >= TRIPLE_IN && r <= TRIPLE_OUT ? 3 : r >= DOUBLE_IN ? 2 : 1;
  return { sector, mult, score: sector * mult };
}

/** A bed to aim at: `mult` 1 means the big outer single. */
export interface Target {
  sector: number;
  mult: 1 | 2 | 3;
}

/** Centre of a bed, the point a thrower aims at. */
export function targetPoint(target: Target): { x: number; y: number } {
  if (target.sector === 25) return target.mult === 2 ? { x: 0, y: 0 } : { x: 0, y: (BULL_R + OUTER_BULL_R) / 2 };
  const idx = SECTORS.indexOf(target.sector as (typeof SECTORS)[number]);
  const r = target.mult === 3 ? (TRIPLE_IN + TRIPLE_OUT) / 2 : target.mult === 2 ? (DOUBLE_IN + DOUBLE_OUT) / 2 : (TRIPLE_OUT + DOUBLE_IN) / 2;
  const a = (idx * 18 * Math.PI) / 180;
  return { x: r * Math.sin(a), y: r * Math.cos(a) };
}

/** Short label: "T20", "D16", "5", "Bull", "25", or "" for a miss (the page localizes Bull and Miss). */
export function hitLabel(hit: Hit | Target): string {
  if (hit.sector === 25) return hit.mult === 2 ? "Bull" : "25";
  if (!hit.sector) return "";
  return `${hit.mult === 3 ? "T" : hit.mult === 2 ? "D" : ""}${hit.sector}`;
}

/** A normal deviate from two uniform numbers in [0, 1) (Box–Muller). */
export function gaussian(rand: () => number): number {
  const u = Math.max(1e-12, rand());
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Where a dart thrown at (x, y) lands, with a round scatter of `sigma` mm. */
export function throwAt(x: number, y: number, sigma: number, rand: () => number): { x: number; y: number } {
  return { x: x + gaussian(rand) * sigma, y: y + gaussian(rand) * sigma };
}

/**
 * The aim reticle's sway (mm) after holding steady for `held` seconds at time `t`: it settles over the first second,
 * then a hand held too long starts to shake again.
 */
export function swayAmplitude(held: number): number {
  if (held <= 0) return 22;
  if (held < 0.9) return 22 - (15 * held) / 0.9;
  return Math.min(36, 7 + (held - 0.9) * 18);
}

export function swayOffset(t: number, held: number): { x: number; y: number } {
  const a = swayAmplitude(held);
  return {
    x: a * (0.75 * Math.sin(2.1 * t) + 0.35 * Math.sin(3.7 * t + 1)),
    y: a * (0.7 * Math.cos(1.7 * t) + 0.4 * Math.sin(2.9 * t + 2)),
  };
}

/** Scatter (mm) of the computer per level, and of the player on top of the sway. */
export const CPU_SIGMA = [46, 28, 15] as const;
export type CpuLevel = 0 | 1 | 2;
export const PLAYER_SIGMA = 8;

// ---------------------------------------------------------------- checkouts

/** Every bed a dart can score, as an aim target. */
const BEDS: Target[] = [
  ...SECTORS.flatMap((s) => [{ sector: s, mult: 1 }, { sector: s, mult: 2 }, { sector: s, mult: 3 }] as Target[]),
  { sector: 25, mult: 1 },
  { sector: 25, mult: 2 },
];
const value = (b: Target) => (b.sector === 25 ? (b.mult === 2 ? 50 : 25) : b.sector * b.mult);
const isDouble = (b: Target) => b.mult === 2;
/** Doubles in the order players prefer to finish on (D20 and D16 split well when missed). */
const DOUBLE_ORDER = [20, 16, 18, 10, 12, 8, 14, 19, 17, 15, 13, 11, 9, 6, 4, 2, 7, 5, 3, 1, 25];
/** Setup darts: big singles are easiest, then trebles, then doubles and the bull. */
const setupCost = (b: Target) => (b.sector === 25 ? 3 : b.mult === 1 ? 0 : b.mult === 3 ? 1 : 2);

const cache = new Map<string, Target[] | null>();

/**
 * The finish for `remaining` with at most `darts` darts, ending on a double (or the bull): fewest darts, then the
 * preferred double, then the easiest setup darts, then the biggest first dart. Null when there is none (169, 168,
 * 166, 165, 163, 162, 159 and anything over 170 with three darts).
 */
export function checkout(remaining: number, darts = 3): Target[] | null {
  if (remaining < 2 || remaining > 170 || darts < 1) return null;
  const key = `${remaining}|${darts}`;
  if (cache.has(key)) return cache.get(key)!;
  let best: { route: Target[]; rank: number[] } | null = null;
  const consider = (route: Target[]) => {
    const last = route[route.length - 1]!;
    const setup = route.slice(0, -1).sort((a, b) => value(b) - value(a));
    const rank = [route.length, DOUBLE_ORDER.indexOf(last.sector), setup.reduce((s, b) => s + setupCost(b), 0), ...setup.map((b) => -value(b))];
    if (!best || lexLess(rank, best.rank)) best = { route: [...setup, last], rank };
  };
  const doubles = BEDS.filter(isDouble);
  for (const d of doubles) {
    if (value(d) === remaining) consider([d]);
    if (darts >= 2) for (const a of BEDS) if (value(a) + value(d) === remaining) consider([a, d]);
    if (darts >= 3) for (const a of BEDS) for (const b of BEDS) if (value(a) + value(b) + value(d) === remaining) consider([a, b, d]);
    if (best && (best as { route: Target[] }).route.length === 1) break;
  }
  const result = best ? (best as { route: Target[] }).route : null;
  cache.set(key, result);
  return result;
}

function lexLess(a: number[], b: number[]): boolean {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0, y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

// ---------------------------------------------------------------- match

export type Mode = "x01" | "clock" | "practice";
export const X01_START = 501;
export const CLOCK_ORDER = [...Array.from({ length: 20 }, (_, i) => i + 1), 25];

export interface Player {
  cpu: boolean;
  /** 501: points left. */
  remaining: number;
  /** Around the Clock: index into CLOCK_ORDER of the next target. */
  clock: number;
  /** Darts thrown this leg and points scored (busted darts count as thrown, not scored). */
  darts: number;
  points: number;
  /** 501 score at the start of this turn, restored on a bust. */
  turnStart: number;
}

export interface Match {
  mode: Mode;
  players: Player[];
  current: number;
  /** Darts thrown in the current turn. */
  turn: Hit[];
  winner: number | null;
}

export type ThrowEvent = "score" | "bust" | "win" | "advance" | "turnEnd";

export function newMatch(mode: Mode, cpu: boolean): Match {
  const player = (isCpu: boolean): Player => ({ cpu: isCpu, remaining: X01_START, clock: 0, darts: 0, points: 0, turnStart: X01_START });
  // Practice is always solo.
  const players = mode === "practice" || !cpu ? [player(false)] : [player(false), player(true)];
  return { mode, players, current: 0, turn: [], winner: null };
}

/** Average per three darts. */
export function threeDartAverage(p: Pick<Player, "darts" | "points">): number {
  return p.darts ? (p.points / p.darts) * 3 : 0;
}

/**
 * Applies one dart and returns the new match and what happened. A turn is three darts, or ends early on a bust or a
 * finish; the next player then throws.
 */
export function applyHit(match: Match, hit: Hit): { match: Match; events: ThrowEvent[] } {
  if (match.winner !== null) return { match, events: [] };
  const players = match.players.map((p) => ({ ...p }));
  const p = players[match.current]!;
  const turn = [...match.turn, hit];
  const events: ThrowEvent[] = [];
  p.darts += 1;
  let endTurn = turn.length >= 3;
  let winner: number | null = null;

  if (match.mode === "x01") {
    const left = p.remaining - hit.score;
    if (left < 0 || left === 1 || (left === 0 && hit.mult !== 2)) {
      // Bust: the turn's points are taken back and the turn ends.
      p.points -= p.turnStart - p.remaining;
      p.remaining = p.turnStart;
      events.push("bust");
      endTurn = true;
    } else {
      p.remaining = left;
      p.points += hit.score;
      events.push("score");
      if (left === 0) {
        winner = match.current;
        events.push("win");
      }
    }
  } else if (match.mode === "clock") {
    p.points += hit.score;
    if (hit.sector === CLOCK_ORDER[p.clock]) {
      p.clock += 1;
      events.push("advance");
      if (p.clock >= CLOCK_ORDER.length) {
        winner = match.current;
        events.push("win");
      }
    } else events.push("score");
  } else {
    p.points += hit.score;
    events.push("score");
  }

  if (winner !== null) return { match: { ...match, players, turn, winner }, events };
  if (!endTurn) return { match: { ...match, players, turn }, events };
  events.push("turnEnd");
  const next = (match.current + 1) % players.length;
  players[next]!.turnStart = players[next]!.remaining;
  return { match: { ...match, players, current: next, turn: [], winner: null }, events };
}

/** What the computer aims at for its next dart. */
export function cpuTarget(match: Match): Target {
  const p = match.players[match.current]!;
  if (match.mode === "clock") {
    const s = CLOCK_ORDER[p.clock] ?? 25;
    return s === 25 ? { sector: 25, mult: 1 } : { sector: s, mult: 1 };
  }
  if (match.mode === "x01") {
    const left = 3 - match.turn.length;
    const route = checkout(p.remaining, left);
    if (route) return route[0]!;
    // Out of range: score heavily, but never aim to leave 1 or bust.
    if (p.remaining > 60 + 1) return { sector: 20, mult: 3 };
    for (let s = 20; s >= 1; s--) {
      const rest = p.remaining - s;
      if (rest >= 2 && rest <= 40 && rest % 2 === 0) return { sector: s, mult: 1 };
    }
    return { sector: 1, mult: 1 };
  }
  return { sector: 20, mult: 3 };
}

/** Saved stats, `cvcm.darts.v1`. */
export interface Stats {
  bestAvg: number;
  bestLeg: number;
  bestClock: number;
}

export function cleanStats(raw: unknown): Stats {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= max ? v : 0);
  return { bestAvg: num(r.bestAvg, 180), bestLeg: Math.round(num(r.bestLeg, 999)), bestClock: Math.round(num(r.bestClock, 9999)) };
}
