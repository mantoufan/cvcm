/**
 * Computer player for the billiards games (written for cv.cm). It lists pots by geometry (ghost ball behind each ball
 * on, toward each pocket, with clear paths), tries the most promising ones in the physics simulation with the real
 * referee, and keeps the best outcome; with nothing on it plays a legal contact. Three-cushion samples directions and
 * keeps one that scores. Skill sets the aim error added afterwards, so an easy computer misses.
 */

import { GRAVITY, cloneBalls, freeSpot, simulate, strike, type Ball, type TableGeom, type Vec } from "./billiards-physics";
import { ballsOn, judge, readShot, type Match } from "./billiards-rules";
import { cueIdFor, inZone, respot, TABLE_OF, zoneSpots, type Rand, type Variant } from "./billiards-tables";

export interface Plan {
  angle: number;
  speed: number;
  side: number;
  top: number;
  /** Ball in hand: where to put the cue ball first. */
  place?: Vec;
}

export type Skill = "easy" | "medium" | "hard";

const AIM_ERROR: Record<Skill, number> = { easy: 0.035, medium: 0.012, hard: 0.003 };

interface Candidate {
  angle: number;
  speed: number;
  score: number;
  place?: Vec;
}

/** Distance from p to segment a–b. */
function segDist(p: Vec, a: Vec, b: Vec): number {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const len2 = ex * ex + ey * ey;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.y - a.y) * ey) / len2)) : 0;
  return Math.hypot(p.x - (a.x + ex * t), p.y - (a.y + ey * t));
}

function clear(balls: readonly Ball[], a: Vec, b: Vec, skip: number[], R: number): boolean {
  return balls.every((o) => !o.on || skip.includes(o.id) || segDist(o, a, b) >= 2 * R * 0.98);
}

/** Point just inside a pocket mouth to aim object balls at. */
function pocketAim(g: TableGeom, i: number): Vec {
  const p = g.pockets[i]!;
  const inset = p.corner ? g.R * 0.6 : g.R * 1.2;
  if (p.corner) return { x: p.x - (Math.sign(p.x) * inset) / Math.SQRT2, y: p.y - (Math.sign(p.y) * inset) / Math.SQRT2 };
  // Middle pockets: aim at the mouth on the cushion line.
  return { x: p.x, y: Math.sign(p.y) * (g.width / 2 - inset * 0.25) };
}

/** Speed the cue ball needs so the object ball still reaches the pocket (with some to spare). */
function potSpeed(g: TableGeom, d1: number, d2: number, cut: number): number {
  const a = g.muRoll * GRAVITY * 1.6;
  const arrive = 0.45;
  const vObj = Math.sqrt(arrive * arrive + 2 * a * d2);
  const v = Math.sqrt((vObj / Math.max(0.2, Math.cos(cut))) ** 2 + 2 * a * d1) * 1.25 + 0.25;
  return Math.max(0.7, Math.min(5.5, v));
}

function geometricPots(g: TableGeom, balls: readonly Ball[], cue: Ball, targets: number[]): Candidate[] {
  const out: Candidate[] = [];
  const R = g.R;
  for (const id of targets) {
    const t = balls.find((b) => b.id === id && b.on);
    if (!t) continue;
    g.pockets.forEach((_, pi) => {
      const aim = pocketAim(g, pi);
      const d2 = Math.hypot(aim.x - t.x, aim.y - t.y);
      if (d2 < 1e-6) return;
      const ux = (aim.x - t.x) / d2;
      const uy = (aim.y - t.y) / d2;
      const ghost = { x: t.x - ux * 2 * R, y: t.y - uy * 2 * R };
      const d1 = Math.hypot(ghost.x - cue.x, ghost.y - cue.y);
      if (d1 < 1e-6) return;
      const cx = (ghost.x - cue.x) / d1;
      const cy = (ghost.y - cue.y) / d1;
      const cos = cx * ux + cy * uy;
      if (cos < 0.2) return;
      if (!clear(balls, cue, ghost, [cue.id, id], R)) return;
      if (!clear(balls, t, aim, [cue.id, id], R)) return;
      const cut = Math.acos(Math.min(1, cos));
      out.push({ angle: Math.atan2(cy, cx), speed: potSpeed(g, d1, d2, cut), score: (cos * cos) / (1 + d1 * 0.6 + d2 * 0.9) });
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Ball in hand: try spots straight behind each ghost ball, inside the zone. */
function placements(g: TableGeom, variant: Variant, zone: NonNullable<Match["inHand"]>, balls: readonly Ball[], cue: Ball, targets: number[]): Vec[] {
  const R = g.R;
  const spots: Vec[] = [];
  for (const id of targets) {
    const t = balls.find((b) => b.id === id && b.on);
    if (!t) continue;
    g.pockets.forEach((_, pi) => {
      const aim = pocketAim(g, pi);
      const d2 = Math.hypot(aim.x - t.x, aim.y - t.y);
      const ux = (aim.x - t.x) / d2;
      const uy = (aim.y - t.y) / d2;
      for (const back of [0.18, 0.32, 0.5]) {
        for (const skew of [0, 0.25, -0.25]) {
          const c = Math.cos(skew);
          const s = Math.sin(skew);
          const dx = ux * c - uy * s;
          const dy = ux * s + uy * c;
          const p = { x: t.x - dx * (2 * R + back), y: t.y - dy * (2 * R + back) };
          if (spots.length < 6 && inZone(variant, zone, p.x, p.y) && freeSpot(g, balls, p.x, p.y, cue.id)) spots.push(p);
        }
      }
    });
  }
  // zoneSpots only gives points inside the zone; they just need to be free.
  const spread = zoneSpots(variant, zone).filter((p) => freeSpot(g, balls, p.x, p.y, cue.id));
  // A few pot spots, then the whole zone spread (every other point first), so a safety can come from anywhere.
  const even = spread.filter((_, k) => k % 2 === 0);
  const odd = spread.filter((_, k) => k % 2 === 1);
  return [...spots, ...even, ...odd];
}

/** Scores a simulated outcome for the shooter: higher is better. */
function evaluate(match: Match, before: Ball[], g: TableGeom, c: Candidate, cueId: number, side: number, top: number): number {
  const balls = cloneBalls(before);
  const cue = balls.find((b) => b.id === cueId)!;
  if (c.place) Object.assign(cue, { x: c.place.x, y: c.place.y, on: true });
  const start = cloneBalls(balls);
  strike(cue, c.angle, c.speed, side, top, g.R);
  // Long enough for a firm shot on slow snooker cloth to settle.
  const res = simulate(g, balls, { maxTime: 20 });
  const v = judge(match, start, balls, readShot(res.events, cueId));
  if (v.match.drawn) return 0;
  if (v.match.winner !== null) return v.match.winner === match.turn ? 1000 : -1000;
  let score = 0;
  if (v.foul) score -= 50;
  if (v.match.turn === match.turn && !v.foul) score += 40;
  const gained = v.match.scores[match.turn] - match.scores[match.turn];
  const lost = v.match.scores[match.turn === 0 ? 1 : 0] - match.scores[match.turn === 0 ? 1 : 0];
  score += gained * 6 - lost * 6;
  // Leave: a pot on next time is worth a little, judged with re-spotted balls back on the table.
  if (v.match.turn === match.turn && !v.foul) {
    for (const id of v.respot) respot(match.variant, balls, id, (x, y) => freeSpot(g, balls, x, y, id));
    const nextCue = balls.find((b) => b.id === cueId);
    if (nextCue?.on) score += (geometricPots(g, balls, nextCue, ballsOn(v.match, balls))[0]?.score ?? 0) * 20;
  }
  return score + c.score;
}

export function planShot(match: Match, balls: Ball[], g: TableGeom, skill: Skill, rand: Rand = Math.random, budgetMs = 60): Plan {
  const variant = match.variant;
  const cueId = cueIdFor(variant, match.turn);
  const cue0 = balls.find((b) => b.id === cueId)!;
  const targets = ballsOn(match, balls);
  let candidates: Candidate[] = [];

  // Breaking (pool and pyramid): full power into the head ball of the rack.
  if (match.breakShot && variant !== "3-cushion" && TABLE_OF[variant] !== "snooker") {
    const head = balls.filter((b) => b.on && b.id !== cueId).reduce((a, b) => (b.x < a.x ? b : a));
    const err = (rand() - 0.5) * AIM_ERROR[skill];
    return { angle: Math.atan2(head.y - cue0.y, head.x - cue0.x) + err, speed: 7, side: 0, top: 0.1 };
  }
  if (variant === "3-cushion") {
    const offset = rand();
    for (let i = 0; i < 64; i++) {
      const angle = ((i + offset) / 64) * Math.PI * 2;
      for (const speed of [2.6, 3.6]) candidates.push({ angle, speed, score: 0 });
    }
  } else {
    const places = match.inHand ? placements(g, variant, match.inHand, balls, cue0, targets) : [undefined];
    for (const place of places) {
      const cue = place ? { ...cue0, ...place } : cue0;
      const pots = geometricPots(g, balls, cue, targets).slice(0, 4);
      for (const p of pots) candidates.push({ ...p, place });
    }
    candidates.sort((a, b) => b.score - a.score);
    candidates = candidates.slice(0, 10);
    // Nothing to pot: a legal contact on a ball on, along a clear path, from the first few spots.
    if (!candidates.length) {
      const ids = targets.length ? targets : balls.filter((b) => b.on && b.id !== cueId).map((b) => b.id);
      // Spots spread across the whole list (pot spots and zone), at most two tries each.
      const stride = Math.max(1, Math.ceil(places.length / 12));
      for (const place of places.filter((_, k) => k % stride === 0)) {
        let fromHere = 0;
        const cue = place ? { ...cue0, ...place } : cue0;
        // The two nearest balls on from each spot, so the 24 tries spread over several spots.
        const near = ids
          .map((id) => balls.find((b) => b.id === id && b.on))
          .filter((b): b is Ball => Boolean(b))
          .sort((p, q) => Math.hypot(p.x - cue.x, p.y - cue.y) - Math.hypot(q.x - cue.x, q.y - cue.y))
          .slice(0, 2);
        for (const t of near) {
          const id = t.id;
          const d = Math.hypot(t.x - cue.x, t.y - cue.y);
          const base = Math.atan2(t.y - cue.y, t.x - cue.x);
          for (const off of [0, 0.3, -0.3]) {
            const angle = base + Math.asin(Math.max(-1, Math.min(1, (off * g.R * 2) / d)));
            // Where the cue ball meets the target, roughly: stop short of it by two radii along the line.
            const reach = Math.max(0, d - 2 * g.R);
            const meet = { x: cue.x + Math.cos(angle) * reach, y: cue.y + Math.sin(angle) * reach };
            if (fromHere >= 2 || !clear(balls, cue, meet, [cueId, id], g.R)) continue;
            fromHere++;
            candidates.push({ angle, speed: Math.min(4, 1.4 + d * 0.8), score: 0, place });
          }
        }
      }
      // Snookered from everywhere: at least aim at a ball on (the referee will call it if it is blocked).
      if (!candidates.length) {
        const t = balls.find((b) => b.on && ids.includes(b.id));
        const from = places[0] ?? cue0;
        if (t) candidates.push({ angle: Math.atan2(t.y - from.y, t.x - from.x), speed: 2, score: 0, place: places[0] });
      }
      candidates = candidates.slice(0, 24);
    }
  }
  const top = TABLE_OF[variant] === "carom" ? 0.25 : 0.1;
  let best: Candidate | null = null;
  let bestScore = -Infinity;
  // Think for a bounded time on the main thread: the best line found so far is played.
  const clock = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  const deadline = clock() + budgetMs;
  for (const c of candidates) {
    if (best && clock() > deadline) break;
    const s = evaluate(match, balls, g, c, cueId, 0, top);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
    // Three-cushion: the first scoring line is good enough.
    if (variant === "3-cushion" && s > 0) break;
  }
  const pick = best ?? { angle: rand() * Math.PI * 2, speed: 2, score: 0 };
  // Gaussian-ish aim error.
  const err = (rand() + rand() + rand() - 1.5) * AIM_ERROR[skill] * 1.4;
  return { angle: pick.angle + err, speed: pick.speed * (1 + (rand() - 0.5) * AIM_ERROR[skill] * 3), side: 0, top, place: pick.place };
}
