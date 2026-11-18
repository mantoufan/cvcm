/**
 * Stack game rules (written for cv.cm): each slab slides along one axis over the top of the tower; dropping it keeps
 * the part over the slab below and cuts the overhang off. A drop within `tolerance` of the slab below snaps exactly on
 * it ("perfect"); from the third perfect drop in a row the slab grows back a little, never past the starting size.
 */

export type Axis = "x" | "z";

/** A slab seen from above: centre (x, z), width along x (w) and depth along z (d). */
export interface Slab {
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface Placement {
  /** The part that stays on the tower; null on a miss. */
  kept: Slab | null;
  /** The overhang that falls off; null when nothing is cut (perfect drop). On a miss, the whole moving slab. */
  cut: Slab | null;
  perfect: boolean;
  missed: boolean;
}

/** Side of the first slab. */
export const START_SIZE = 3;
/** Height of one slab. */
export const SLAB_HEIGHT = 0.4;
/** A drop this close to the slab below (in world units) counts as perfect. */
export const PERFECT_TOLERANCE = 0.08;
/** How far either side of the tower a slab slides. */
export const SLIDE_RANGE = 3.6;
/** Perfect drops in a row before the slab starts growing back. */
export const COMBO_TO_GROW = 3;
/** Growth per perfect drop once the combo is reached, on each side. */
export const GROW_STEP = 0.15;

const sizeOf = (s: Slab, axis: Axis) => (axis === "x" ? s.w : s.d);

function withAxis(s: Slab, axis: Axis, centre: number, size: number): Slab {
  return axis === "x" ? { ...s, x: centre, w: size } : { ...s, z: centre, d: size };
}

export function placeSlab(prev: Slab, moving: Slab, axis: Axis, tolerance = PERFECT_TOLERANCE): Placement {
  const p = prev[axis];
  const m = moving[axis];
  if (Math.abs(m - p) <= tolerance) {
    // Snap onto the slab below. The moving slab is spawned as a copy of the top, so it is never wider than it.
    return { kept: withAxis(moving, axis, p, sizeOf(moving, axis)), cut: null, perfect: true, missed: false };
  }
  const pLo = p - sizeOf(prev, axis) / 2;
  const pHi = p + sizeOf(prev, axis) / 2;
  const mLo = m - sizeOf(moving, axis) / 2;
  const mHi = m + sizeOf(moving, axis) / 2;
  const lo = Math.max(pLo, mLo);
  const hi = Math.min(pHi, mHi);
  if (hi - lo <= 1e-9) return { kept: null, cut: moving, perfect: false, missed: true };
  const kept = withAxis(moving, axis, (lo + hi) / 2, hi - lo);
  // The overhang is on the side the moving slab sticks out (only one side, as both have the same size).
  const cut = m > p
    ? withAxis(moving, axis, (hi + mHi) / 2, mHi - hi)
    : withAxis(moving, axis, (mLo + lo) / 2, lo - mLo);
  return { kept, cut: sizeOf(cut, axis) > 1e-9 ? cut : null, perfect: false, missed: false };
}

/** After a perfect drop: from the COMBO_TO_GROW-th in a row, grow the slab a little on both axes, capped at `max`. */
export function growSlab(slab: Slab, combo: number, max = START_SIZE): Slab {
  if (combo < COMBO_TO_GROW) return slab;
  return { ...slab, w: Math.min(max, slab.w + GROW_STEP), d: Math.min(max, slab.d + GROW_STEP) };
}

/** Slide speed in world units per second for the slab at `level` (1 = the first slab placed). */
export function speed(level: number): number {
  return 3.2 * (1 + Math.min(Math.max(level, 0), 60) * 0.015);
}

/**
 * Offset of the sliding slab from the tower centre after travelling `distance`: starts at -range and goes back and
 * forth between -range and +range (a triangle wave), so pausing the clock pauses the slab.
 */
export function slideOffset(distance: number, range = SLIDE_RANGE): number {
  const period = 4 * range;
  const u = ((distance % period) + period) % period;
  return u <= 2 * range ? -range + u : 3 * range - u;
}

/** Axis the slab at `level` slides along: alternates, starting with x. */
export function axisFor(level: number): Axis {
  return level % 2 === 1 ? "x" : "z";
}

/** Soft pastel hue (degrees) for a level: drifts through pink, peach and lavender. */
export function hueFor(level: number): number {
  return (340 + 40 * Math.sin(level * 0.18) + 360) % 360;
}
