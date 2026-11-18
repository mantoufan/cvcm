/**
 * Air hockey (games3d group): table physics and the computer player. Pure and deterministic, so the page and the
 * tests share it. Units are table units: the table is TABLE_W wide (x from -W/2 to W/2) and TABLE_L long (y from -L/2
 * at the player's end to L/2 at the computer's end). The player defends the goal at y = -L/2.
 */

export const TABLE_W = 1;
export const TABLE_L = 1.6;
export const GOAL_W = 0.34;
export const PUCK_R = 0.04;
export const MALLET_R = 0.06;
export const PUCK_MAX = 3.6;
export const MALLET_MAX = 4.2;
export const WIN_SCORE = 7;
/** Seconds the puck rests after a goal before play goes on. */
export const SERVE_PAUSE = 0.8;
/** Fixed substep: at the fastest closing speed (PUCK_MAX + MALLET_MAX) a substep moves 0.033 < PUCK_R + MALLET_R. */
export const SUBSTEP = 1 / 240;
const RESTITUTION = 0.9;
const WALL_KEEP = 0.92;
const FRICTION = 0.12;

export type Level = 0 | 1 | 2;
export const LEVELS: readonly Level[] = [0, 1, 2];

/** Computer strength per level: top speed, how often it rethinks (s), and how far its aim may be off. */
const AI = [
  { speed: 1.5, react: 0.26, aimErr: 0.14 },
  { speed: 2.4, react: 0.15, aimErr: 0.07 },
  { speed: 3.5, react: 0.06, aimErr: 0.02 },
] as const;

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Match {
  puck: Body;
  player: Body;
  ai: Body;
  /** Goals: [player, computer]. */
  score: [number, number];
  /** Seconds left of the pause after a goal (the puck waits on the conceding side). */
  serve: number;
  winner: "player" | "ai" | null;
  /** Who scored last, for the page's message. */
  lastGoal: "player" | "ai" | null;
  /** Computer's current target and time to its next decision. */
  aiTarget: { x: number; y: number };
  aiThink: number;
  /** Count of computer decisions, the source of its (deterministic) aim error. */
  aiShots: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The player's mallet stays in its own half, inside the rails. */
export function clampPlayer(x: number, y: number): { x: number; y: number } {
  return {
    x: clamp(x, -TABLE_W / 2 + MALLET_R, TABLE_W / 2 - MALLET_R),
    y: clamp(y, -TABLE_L / 2 + MALLET_R, -MALLET_R),
  };
}

function clampAi(x: number, y: number): { x: number; y: number } {
  return {
    x: clamp(x, -TABLE_W / 2 + MALLET_R, TABLE_W / 2 - MALLET_R),
    y: clamp(y, MALLET_R, TABLE_L / 2 - MALLET_R),
  };
}

const AI_HOME = { x: 0, y: TABLE_L / 2 - 0.16 };

export function newMatch(): Match {
  return {
    puck: { x: 0, y: -0.25, vx: 0, vy: 0 },
    player: { x: 0, y: -TABLE_L / 2 + 0.18, vx: 0, vy: 0 },
    ai: { ...AI_HOME, vx: 0, vy: 0 },
    score: [0, 0],
    serve: SERVE_PAUSE,
    winner: null,
    lastGoal: null,
    aiTarget: { ...AI_HOME },
    aiThink: 0,
    aiShots: 0,
  };
}

/** Moves a mallet toward a target at most `max` per second; its velocity is what it really moved this substep. */
function moveMallet(m: Body, target: { x: number; y: number }, max: number, h: number): void {
  const dx = target.x - m.x;
  const dy = target.y - m.y;
  const d = Math.hypot(dx, dy);
  const step = Math.min(d, max * h);
  const k = d > 1e-9 ? step / d : 0;
  m.vx = (dx * k) / h;
  m.vy = (dy * k) / h;
  m.x += dx * k;
  m.y += dy * k;
}

/** Puck against a mallet: pushed out of overlap, and the relative velocity along the contact normal bounces. */
export function collide(puck: Body, mallet: Body): boolean {
  let nx = puck.x - mallet.x;
  let ny = puck.y - mallet.y;
  const d = Math.hypot(nx, ny);
  const min = PUCK_R + MALLET_R;
  if (d >= min) return false;
  if (d < 1e-9) {
    nx = 0;
    ny = mallet.y < 0 ? 1 : -1;
  } else {
    nx /= d;
    ny /= d;
  }
  puck.x = mallet.x + nx * min;
  puck.y = mallet.y + ny * min;
  const vn = (puck.vx - mallet.vx) * nx + (puck.vy - mallet.vy) * ny;
  if (vn < 0) {
    puck.vx -= (1 + RESTITUTION) * vn * nx;
    puck.vy -= (1 + RESTITUTION) * vn * ny;
  }
  const s = Math.hypot(puck.vx, puck.vy);
  if (s > PUCK_MAX) {
    puck.vx *= PUCK_MAX / s;
    puck.vy *= PUCK_MAX / s;
  }
  return true;
}

/** Deterministic aim error in [-1, 1] for the computer's n-th decision. */
function wobble(n: number): number {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

/** Where the computer wants its mallet: hit the puck toward the player's goal, or guard its own goal. */
export function aiDecide(m: Match, level: Level): { x: number; y: number } {
  const { puck, ai } = m;
  const cfg = AI[level];
  if (puck.y > 0) {
    if (puck.y > ai.y - 0.01) {
      // The puck slipped behind the mallet: go round it, staying off its line to the goal.
      const side = puck.x > ai.x ? -1 : 1;
      return clampAi(puck.x + side * (PUCK_R + MALLET_R + 0.04), puck.y + 0.12);
    }
    // Strike: stand behind the puck on the line from an aim point in the player's goal through the puck.
    const aimX = clamp(wobble(m.aiShots) * cfg.aimErr * 2, -GOAL_W / 2 + PUCK_R, GOAL_W / 2 - PUCK_R);
    const gx = puck.x - aimX;
    const gy = puck.y + TABLE_L / 2;
    const g = Math.hypot(gx, gy) || 1;
    // Aim a little past the puck's centre so the mallet drives through it.
    return clampAi(puck.x - (gx / g) * (PUCK_R * 0.5), puck.y - (gy / g) * (PUCK_R * 0.5));
  }
  // Defend: between the puck and the middle of the own goal, back near the goal line.
  const x = clamp(puck.x * 0.55, -GOAL_W / 2, GOAL_W / 2);
  return clampAi(x, AI_HOME.y);
}

function placeForServe(m: Match, conceded: "player" | "ai"): void {
  m.puck = { x: 0, y: conceded === "player" ? -0.25 : 0.25, vx: 0, vy: 0 };
  m.serve = SERVE_PAUSE;
  // The computer walks back to guard its goal (no teleport).
  m.aiTarget = { ...AI_HOME };
  m.aiThink = SERVE_PAUSE;
}

function substep(m: Match, target: { x: number; y: number }, level: Level, h: number): void {
  if (m.winner) return;
  const cfg = AI[level];
  // Mallets.
  moveMallet(m.player, clampPlayer(target.x, target.y), MALLET_MAX, h);
  m.aiThink -= h;
  if (m.aiThink <= 0) {
    m.aiThink = cfg.react;
    m.aiTarget = aiDecide(m, level);
    m.aiShots++;
  }
  moveMallet(m.ai, m.aiTarget, cfg.speed, h);
  if (m.serve > 0) {
    m.serve = Math.max(0, m.serve - h);
    // Mallets may still meet the resting puck (a serve), but it does not move on its own.
    collide(m.puck, m.player);
    collide(m.puck, m.ai);
    if (m.puck.vx !== 0 || m.puck.vy !== 0) m.serve = 0;
    return;
  }
  const p = m.puck;
  p.x += p.vx * h;
  p.y += p.vy * h;
  const drag = 1 - FRICTION * h;
  p.vx *= drag;
  p.vy *= drag;
  collide(p, m.player);
  collide(p, m.ai);
  // Side rails.
  const xMax = TABLE_W / 2 - PUCK_R;
  if (p.x > xMax) {
    p.x = xMax;
    p.vx = -Math.abs(p.vx) * WALL_KEEP;
  } else if (p.x < -xMax) {
    p.x = -xMax;
    p.vx = Math.abs(p.vx) * WALL_KEEP;
  }
  // End rails, open where the goals are.
  const yMax = TABLE_L / 2 - PUCK_R;
  const inMouth = Math.abs(p.x) < GOAL_W / 2 - PUCK_R * 0.5;
  if (p.y < -yMax) {
    if (inMouth) {
      if (p.y < -TABLE_L / 2 - PUCK_R) return goal(m, "ai");
    } else {
      p.y = -yMax;
      p.vy = Math.abs(p.vy) * WALL_KEEP;
    }
  } else if (p.y > yMax) {
    if (inMouth) {
      if (p.y > TABLE_L / 2 + PUCK_R) return goal(m, "player");
    } else {
      p.y = yMax;
      p.vy = -Math.abs(p.vy) * WALL_KEEP;
    }
  }
}

function goal(m: Match, scorer: "player" | "ai"): void {
  if (scorer === "player") m.score[0]++;
  else m.score[1]++;
  m.lastGoal = scorer;
  if (m.score[0] >= WIN_SCORE) m.winner = "player";
  else if (m.score[1] >= WIN_SCORE) m.winner = "ai";
  placeForServe(m, scorer === "player" ? "ai" : "player");
}

/**
 * Advances the match by `dt` seconds in fixed substeps (frame rate does not change the play). `target` is where the
 * player wants the mallet (pointer or keys); it is clamped to the player's half. Returns a new match.
 */
export function step(match: Match, target: { x: number; y: number }, level: Level, dt: number): Match {
  const m: Match = {
    ...match,
    puck: { ...match.puck },
    player: { ...match.player },
    ai: { ...match.ai },
    score: [match.score[0], match.score[1]],
    aiTarget: { ...match.aiTarget },
  };
  let left = Math.max(0, dt);
  while (left > 1e-9 && !m.winner) {
    const h = Math.min(SUBSTEP, left);
    substep(m, target, level, h);
    left -= h;
  }
  return m;
}

/** Saved wins and losses per level, `cvcm.airhockey.v1`. */
export interface Record3 {
  wins: [number, number, number];
  losses: [number, number, number];
  level: Level;
}

export function cleanRecord(raw: unknown): Record3 {
  const out: Record3 = { wins: [0, 0, 0], losses: [0, 0, 0], level: 1 };
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Partial<Record3>;
  const nums = (a: unknown): [number, number, number] =>
    Array.isArray(a) && a.length === 3 && a.every((n) => Number.isInteger(n) && n >= 0) ? [a[0], a[1], a[2]] : [0, 0, 0];
  out.wins = nums(r.wins);
  out.losses = nums(r.losses);
  if (r.level === 0 || r.level === 1 || r.level === 2) out.level = r.level;
  return out;
}
