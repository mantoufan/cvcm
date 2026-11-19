/**
 * Practice drills for the billiards trainer (written for cv.cm): a fixed layout, the ball to pot and, for the
 * position drills, a circle the cue ball has to stop in. Names and tips are under `billiards.drills.<id>`.
 */

import { newBall, type Ball, type Vec } from "./billiards-physics";
import { spotsFor, tableFor, SNOOKER_FIRST_COLOUR, type Variant } from "./billiards-tables";

export const DRILLS = ["straight", "cut30", "cut55", "stop", "draw", "follow", "rail", "long", "blue", "clearance"] as const;
export type DrillId = (typeof DRILLS)[number];

export function isDrill(v: unknown): v is DrillId {
  return typeof v === "string" && (DRILLS as readonly string[]).includes(v);
}

export interface Drill {
  id: DrillId;
  variant: Variant;
  balls: Ball[];
  /** The ball to pot (the clearance: every colour in order, checked by the referee instead). */
  pot: number | null;
  /** The cue ball must stop inside this circle. */
  zone?: { x: number; y: number; r: number };
}

/** Builds a drill's layout. `jitter` (0–1 random) moves the layout a little so repeats are not identical. */
export function drill(id: DrillId, jitter: () => number = () => 0.5): Drill {
  const j = (span: number) => (jitter() - 0.5) * span;
  const pool = tableFor("9-ball");
  const L = pool.length / 2;
  const W = pool.width / 2;
  const R = pool.R;
  // Pool drills aim at the top-right corner pocket (+x, +y) from the middle of the table.
  const corner: Vec = { x: L, y: W };
  const along = (from: Vec, to: Vec, d: number): Vec => {
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    return { x: from.x + ((to.x - from.x) / len) * d, y: from.y + ((to.y - from.y) / len) * d };
  };
  /** Object ball `objFromPocket` from the corner on a line at `lineDeg`, cue ball `cueBack` behind it, cut by `cutDeg`. */
  const cutLayout = (objFromPocket: number, cueBack: number, cutDeg: number, lineDeg = 200): { cue: Vec; obj: Vec } => {
    const a = (lineDeg * Math.PI) / 180;
    const obj = { x: corner.x + Math.cos(a) * objFromPocket, y: corner.y + Math.sin(a) * objFromPocket };
    // Ghost ball, then the cue ball off the pot line by the cut angle.
    const pot = Math.atan2(corner.y - obj.y, corner.x - obj.x);
    const ghost = { x: obj.x - Math.cos(pot) * 2 * R, y: obj.y - Math.sin(pot) * 2 * R };
    const c = pot + (cutDeg * Math.PI) / 180;
    return { obj, cue: { x: ghost.x - Math.cos(c) * cueBack, y: ghost.y - Math.sin(c) * cueBack } };
  };
  switch (id) {
    case "straight":
    case "stop":
    case "draw":
    case "follow": {
      const { cue, obj } = cutLayout(0.75 + j(0.1), 0.55 + j(0.1), 0, 205 + j(6));
      const toPocket = Math.atan2(corner.y - obj.y, corner.x - obj.x);
      const d: Drill = { id, variant: "9-ball", balls: [newBall(0, cue.x, cue.y), newBall(1, obj.x, obj.y)], pot: 1 };
      const ghost = { x: obj.x - Math.cos(toPocket) * 2 * R, y: obj.y - Math.sin(toPocket) * 2 * R };
      if (id === "stop") d.zone = { ...ghost, r: 0.07 };
      if (id === "draw") d.zone = { ...along(ghost, cue, 0.35), r: 0.09 };
      if (id === "follow") d.zone = { ...along(ghost, corner, 0.4), r: 0.1 };
      return d;
    }
    case "cut30":
    case "cut55": {
      const { cue, obj } = cutLayout(0.6 + j(0.1), 0.45 + j(0.1), id === "cut30" ? 30 : -55, 215 + j(8));
      return { id, variant: "9-ball", balls: [newBall(0, cue.x, cue.y), newBall(1, obj.x, obj.y)], pot: 1 };
    }
    case "rail": {
      // Object ball frozen to the long cushion, cue ball along the same cushion: a rail cut into the corner.
      const y = W - R - 0.0005;
      return { id, variant: "9-ball", balls: [newBall(0, -0.2 + j(0.1), y - 0.12), newBall(1, L - 0.55 + j(0.1), y)], pot: 1 };
    }
    case "long":
    case "blue":
    case "clearance": {
      const sn = tableFor("snooker");
      const s = spotsFor("snooker");
      const SL = sn.length / 2;
      const SW = sn.width / 2;
      if (id === "long") {
        // Cue ball in the D, a red part of the way up the line to a top corner: a straight long pot.
        const cue = { x: s.baulkX - 0.08, y: -0.12 + j(0.1) };
        const top = { x: SL, y: SW };
        const red = along(cue, top, Math.hypot(top.x - cue.x, top.y - cue.y) * (0.42 + j(0.08)));
        return { id, variant: "snooker", balls: [newBall(0, cue.x, cue.y), newBall(1, red.x, red.y)], pot: 1 };
      }
      if (id === "blue") {
        // Blue off its spot into a middle pocket, cue ball at an angle.
        const blue = s.colourSpots[5]!;
        return { id, variant: "snooker", balls: [newBall(0, -0.35 + j(0.1), -0.3 + j(0.1)), newBall(SNOOKER_FIRST_COLOUR + 3, blue.x, blue.y)], pot: SNOOKER_FIRST_COLOUR + 3 };
      }
      // All six colours on their spots, cue ball in hand in the D.
      const balls = [newBall(0, s.baulkX - 0.1, 0.12)];
      for (let v = 2; v <= 7; v++) balls.push(newBall(SNOOKER_FIRST_COLOUR + v - 2, s.colourSpots[v]!.x, s.colourSpots[v]!.y));
      return { id, variant: "snooker", balls, pot: null };
    }
  }
}

/** Did the attempt work: the ball potted, the cue ball still up and, for position drills, stopped in the circle. */
export function drillDone(d: Drill, after: readonly Ball[], potted: readonly number[]): boolean {
  const cue = after.find((b) => b.id === 0);
  if (!cue?.on || d.pot === null) return false;
  if (!potted.includes(d.pot)) return false;
  if (d.zone && Math.hypot(cue.x - d.zone.x, cue.y - d.zone.y) > d.zone.r) return false;
  return true;
}
