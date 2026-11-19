/**
 * Billiards games, tables, balls and racks (written for cv.cm). Coordinates follow billiards-physics: x along the
 * table (the break comes from −x, the "head" or baulk end), y across it. Sizes are the governing bodies' nominal ones
 * (WPA pool, WPBSA snooker, Russian pyramid, UMB carom), with pocket mouths rounded to what plays well on screen.
 */

import { buildTable, newBall, type Ball, type TableGeom, type TableSpec } from "./billiards-physics";
import { shuffle } from "./cards";

export const VARIANTS = ["8-ball", "9-ball", "10-ball", "chinese-8-ball", "snooker", "snooker-6", "pyramid", "3-cushion"] as const;
export type Variant = (typeof VARIANTS)[number];

export function isVariant(v: unknown): v is Variant {
  return typeof v === "string" && (VARIANTS as readonly string[]).includes(v);
}

export type TableKind = "pool" | "chinese" | "snooker" | "pyramid" | "carom";

export const TABLE_OF: Record<Variant, TableKind> = {
  "8-ball": "pool",
  "9-ball": "pool",
  "10-ball": "pool",
  "chinese-8-ball": "chinese",
  snooker: "snooker",
  "snooker-6": "snooker",
  pyramid: "pyramid",
  "3-cushion": "carom",
};

const SPECS: Record<TableKind, TableSpec> = {
  // 9 ft WPA table, 2¼ in balls, corner pockets ~4½ in, side ~5 in.
  pool: { length: 2.54, width: 1.27, R: 0.028575, cornerMouth: 0.114, sideMouth: 0.128 },
  // Chinese eight-ball (中式台球): same bed, tighter pockets, quicker cloth.
  chinese: { length: 2.54, width: 1.27, R: 0.028575, cornerMouth: 0.09, sideMouth: 0.1, muRoll: 0.009 },
  // 12 ft snooker table, 52.5 mm balls, fast napped cloth.
  snooker: { length: 3.569, width: 1.778, R: 0.02625, cornerMouth: 0.086, sideMouth: 0.098, muRoll: 0.0085, eRail: 0.72 },
  // 12 ft pyramid table, 68 mm balls, pockets only a little wider than a ball.
  pyramid: { length: 3.569, width: 1.778, R: 0.034, cornerMouth: 0.079, sideMouth: 0.088, eRail: 0.7 },
  // Match carom table (2.84 × 1.42), no pockets, lively heated cushions.
  carom: { length: 2.84, width: 1.42, R: 0.03075, cornerMouth: 0, sideMouth: 0, muRoll: 0.011, eRail: 0.84, muRail: 0.22 },
};

const geomCache = new Map<TableKind, TableGeom>();

export function tableFor(variant: Variant): TableGeom {
  const kind = TABLE_OF[variant];
  let g = geomCache.get(kind);
  if (!g) geomCache.set(kind, (g = buildTable(SPECS[kind])));
  return g;
}

export type BallKind = "cue" | "solid" | "stripe" | "eight" | "red" | "colour" | "pyramid" | "carom";

export interface BallLook {
  kind: BallKind;
  /** Number printed on the ball (pool and pyramid), or null. */
  number: number | null;
  /** Main colour (hex). */
  color: number;
  /** Snooker colour value. */
  value: number;
}

/** Pool ball colours 1–8 (9–15 are the same with a white base). */
const POOL_COLORS = [0xf5c400, 0x1b4fd8, 0xd9241c, 0x5b2b8c, 0xf07800, 0x0f7a3a, 0x7a1f1f, 0x111111];
/** Snooker colours by value 2–7. */
export const SNOOKER_COLOURS: Record<number, number> = { 2: 0xf2c200, 3: 0x138a3f, 4: 0x7a4421, 5: 0x1b4fd8, 6: 0xf28aa6, 7: 0x111111 };
/** Snooker ids: 0 cue, 1–15 reds, 16–21 yellow … black (value = id − 14). */
export const SNOOKER_FIRST_COLOUR = 16;

export function snookerValue(id: number): number {
  if (id === 0) return 0;
  return id < SNOOKER_FIRST_COLOUR ? 1 : id - 14;
}

export function isRed(id: number): boolean {
  return id >= 1 && id < SNOOKER_FIRST_COLOUR;
}

/** How a ball looks and scores in a game. */
export function ballLook(variant: Variant, id: number): BallLook {
  const kind = TABLE_OF[variant];
  if (kind === "snooker") {
    if (id === 0) return { kind: "cue", number: null, color: 0xfbf8ef, value: 0 };
    if (isRed(id)) return { kind: "red", number: null, color: 0xc4161c, value: 1 };
    return { kind: "colour", number: null, color: SNOOKER_COLOURS[snookerValue(id)]!, value: snookerValue(id) };
  }
  if (kind === "pyramid") {
    // A coloured cue ball and fifteen numbered ivory balls.
    if (id === 0) return { kind: "cue", number: null, color: 0xd9a21b, value: 0 };
    return { kind: "pyramid", number: id, color: 0xfaf4e4, value: 1 };
  }
  if (kind === "carom") {
    return { kind: "carom", number: null, color: [0xfbf8ef, 0xf2c200, 0xc4161c][id]!, value: 0 };
  }
  if (id === 0) return { kind: "cue", number: null, color: 0xfbf8ef, value: 0 };
  if (id === 8) return { kind: "eight", number: 8, color: 0x111111, value: 0 };
  if (id < 8) return { kind: "solid", number: id, color: POOL_COLORS[id - 1]!, value: 0 };
  return { kind: "stripe", number: id, color: POOL_COLORS[id - 9]!, value: 0 };
}

/** Where a ball may be placed with ball in hand. */
export type PlaceZone = "anywhere" | "kitchen" | "d";

export interface Spots {
  /** Pool and pyramid: x of the head string (behind it is the kitchen) and the foot spot. */
  headX: number;
  footX: number;
  /** Snooker: baulk line x, D radius, colour spots by value. */
  baulkX: number;
  dRadius: number;
  colourSpots: Record<number, { x: number; y: number }>;
}

const spotsCache = new Map<Variant, Spots>();

export function spotsFor(variant: Variant): Spots {
  let cached = spotsCache.get(variant);
  if (!cached) spotsCache.set(variant, (cached = buildSpots(variant)));
  return cached;
}

function buildSpots(variant: Variant): Spots {
  const g = tableFor(variant);
  const L = g.length / 2;
  const baulkX = -L + 0.737;
  const dRadius = 0.292;
  return {
    headX: -g.length / 4,
    footX: g.length / 4,
    baulkX,
    dRadius,
    // Viewed from the baulk end (looking along +x), yellow is on the right (−y) and green on the left.
    colourSpots: {
      2: { x: baulkX, y: -dRadius },
      3: { x: baulkX, y: dRadius },
      4: { x: baulkX, y: 0 },
      5: { x: 0, y: 0 },
      6: { x: L / 2, y: 0 },
      7: { x: L - 0.324, y: 0 },
    },
  };
}

/** True when (x, y) is inside the ball-in-hand zone. */
export function inZone(variant: Variant, zone: PlaceZone, x: number, y: number): boolean {
  const s = spotsFor(variant);
  if (zone === "anywhere") return true;
  if (zone === "kitchen") return x <= s.headX;
  return x <= s.baulkX && Math.hypot(x - s.baulkX, y) <= s.dRadius;
}

/**
 * Points spread over a ball-in-hand zone in its real shape (the D's half disc, the kitchen up to the head string, or
 * the whole bed), nearest the usual starting spot first. Used by the page and the computer to find free spots.
 */
export function zoneSpots(variant: Variant, zone: PlaceZone): { x: number; y: number }[] {
  const g = tableFor(variant);
  const s = spotsFor(variant);
  const R = g.R;
  const out: { x: number; y: number }[] = [];
  if (zone === "d") {
    for (const fr of [0.35, 0.65, 0.92]) {
      for (let k = 0; k <= 8; k++) {
        const a = Math.PI / 2 + (k / 8) * Math.PI;
        out.push({ x: s.baulkX + Math.cos(a) * s.dRadius * fr, y: Math.sin(a) * s.dRadius * fr });
      }
    }
    return out;
  }
  const x0 = -g.length / 2 + 2 * R;
  const x1 = zone === "kitchen" ? s.headX : g.length / 2 - 2 * R;
  const cols = zone === "kitchen" ? 6 : 12;
  for (let i = cols; i >= 0; i--) {
    for (const k of [0, 1, -1, 2, -2, 3, -3]) out.push({ x: x0 + (i / cols) * (x1 - x0), y: (k / 3.3) * (g.width / 2 - 2 * R) });
  }
  return out;
}

/** The first point on the bed where `free` says a ball fits, scanning from the head end; null if none. */
export function firstFreePoint(variant: Variant, free: (x: number, y: number) => boolean): { x: number; y: number } | null {
  const g = tableFor(variant);
  for (let x = -g.length / 2 + 2 * g.R; x < g.length / 2 - g.R; x += g.R) {
    for (let y = 0; Math.abs(y) < g.width / 2 - g.R; y = y > 0 ? -y : -y + g.R) if (free(x, y)) return { x, y };
  }
  return null;
}

/** Ball ids used by a game. */
export function ballIds(variant: Variant): number[] {
  switch (variant) {
    case "8-ball":
    case "chinese-8-ball":
    case "pyramid":
      return Array.from({ length: 16 }, (_, i) => i);
    case "9-ball":
      return Array.from({ length: 10 }, (_, i) => i);
    case "10-ball":
      return Array.from({ length: 11 }, (_, i) => i);
    case "snooker":
      return Array.from({ length: 22 }, (_, i) => i);
    case "snooker-6":
      return [0, 1, 2, 3, 4, 5, 6, 16, 17, 18, 19, 20, 21];
    case "3-cushion":
      return [0, 1, 2];
  }
}

/** Random in [0, 1); tests pass a seeded one. */
export type Rand = () => number;


/**
 * Triangle positions, apex at (apexX, 0) pointing at the breaker, rows growing along +x. `rows` lists how many balls
 * each row holds (5 rows of 1–5 for a full rack, 1-2-3-2-1 for the nine-ball diamond).
 */
function rackSlots(apexX: number, R: number, rows: number[]): { x: number; y: number }[] {
  const gap = R * 0.004;
  const dx = (2 * R + gap) * Math.cos(Math.PI / 6);
  const out: { x: number; y: number }[] = [];
  rows.forEach((count, r) => {
    for (let k = 0; k < count; k++) out.push({ x: apexX + r * dx, y: (k - (count - 1) / 2) * (2 * R + gap) });
  });
  return out;
}

/** A fresh rack for the break. The cue ball sits where the breaker usually starts (it may be moved first). */
export function rack(variant: Variant, rand: Rand = Math.random): Ball[] {
  const g = tableFor(variant);
  const s = spotsFor(variant);
  const R = g.R;
  const balls: Ball[] = [];
  const kind = TABLE_OF[variant];
  if (kind === "snooker") {
    balls.push(newBall(0, s.baulkX - s.dRadius * 0.4, s.dRadius * 0.45));
    for (let v = 2; v <= 7; v++) balls.push(newBall(SNOOKER_FIRST_COLOUR + v - 2, s.colourSpots[v]!.x, s.colourSpots[v]!.y));
    const reds = variant === "snooker" ? [1, 2, 3, 4, 5] : [1, 2, 3];
    const slots = rackSlots(s.colourSpots[6]!.x + 2 * R + R * 0.1, R, reds);
    ballIds(variant).filter(isRed).forEach((id, i) => balls.push(newBall(id, slots[i]!.x, slots[i]!.y)));
    return balls;
  }
  if (kind === "carom") {
    // Red on the foot spot, the opponent's yellow on the head spot, the breaker's white on the head string, 15 cm aside.
    balls.push(newBall(0, s.headX, -0.1524), newBall(1, s.headX, 0), newBall(2, s.footX, 0));
    return balls;
  }
  balls.push(newBall(0, s.headX - 0.05 * g.length, 0));
  if (variant === "9-ball") {
    const slots = rackSlots(s.footX, R, [1, 2, 3, 2, 1]);
    const rest = shuffle([2, 3, 4, 5, 6, 7, 8], rand);
    // 1 at the apex, 9 in the middle.
    const order = [1, rest[0]!, rest[1]!, rest[2]!, 9, rest[3]!, rest[4]!, rest[5]!, rest[6]!];
    order.forEach((id, i) => balls.push(newBall(id, slots[i]!.x, slots[i]!.y)));
    return balls;
  }
  if (variant === "10-ball") {
    const slots = rackSlots(s.footX, R, [1, 2, 3, 4]);
    const rest = shuffle([2, 3, 4, 5, 6, 7, 8, 9], rand);
    // 1 at the apex, 10 in the middle of the third row.
    const order = [1, rest[0]!, rest[1]!, rest[2]!, 10, rest[3]!, rest[4]!, rest[5]!, rest[6]!, rest[7]!];
    order.forEach((id, i) => balls.push(newBall(id, slots[i]!.x, slots[i]!.y)));
    return balls;
  }
  const slots = rackSlots(s.footX, R, [1, 2, 3, 4, 5]);
  if (kind === "pyramid") {
    shuffle(Array.from({ length: 15 }, (_, i) => i + 1), rand).forEach((id, i) => balls.push(newBall(id, slots[i]!.x, slots[i]!.y)));
    return balls;
  }
  // Eight-ball: 8 in the middle of the third row, one solid and one stripe in the back corners.
  const solids = shuffle([1, 2, 3, 4, 5, 6, 7], rand);
  const stripes = shuffle([9, 10, 11, 12, 13, 14, 15], rand);
  const order: number[] = new Array(15);
  order[4] = 8;
  order[10] = solids.pop()!;
  order[14] = stripes.pop()!;
  const rest = shuffle([...solids, ...stripes], rand);
  for (let i = 0; i < 15; i++) if (order[i] === undefined) order[i] = rest.pop()!;
  order.forEach((id, i) => balls.push(newBall(id, slots[i]!.x, slots[i]!.y)));
  return balls;
}

/** The cue ball id of the player to shoot (carom: player 2 uses the yellow). */
export function cueIdFor(variant: Variant, player: number): number {
  return variant === "3-cushion" && player === 1 ? 1 : 0;
}

/** Puts a ball back on its spot (snooker colours: own spot, else the highest free one, else nearest behind). */
export function respot(variant: Variant, balls: Ball[], id: number, free: (x: number, y: number) => boolean): void {
  const ball = balls.find((b) => b.id === id);
  if (!ball) return;
  const s = spotsFor(variant);
  const g = tableFor(variant);
  const place = (x: number, y: number) => {
    Object.assign(ball, { x, y, vx: 0, vy: 0, wx: 0, wy: 0, wz: 0, on: true });
  };
  const candidates: { x: number; y: number }[] = [];
  if (TABLE_OF[variant] === "snooker") {
    // WPBSA: own spot, else the highest free spot, else as near its own spot as possible on its own line toward
    // the top cushion, else below it.
    const own = s.colourSpots[snookerValue(id)]!;
    candidates.push(own);
    for (let v = 7; v >= 2; v--) candidates.push(s.colourSpots[v]!);
    for (let x = own.x; x < g.length / 2 - g.R; x += g.R / 4) candidates.push({ x, y: own.y });
    for (let x = own.x; x > -g.length / 2 + g.R; x -= g.R / 4) candidates.push({ x, y: own.y });
  } else {
    // The foot spot, then up the long line toward the foot cushion, then back toward the head (on the bed only).
    for (let x = s.footX; x <= g.length / 2 - g.R; x += g.R / 4) candidates.push({ x, y: 0 });
    for (let x = s.footX; x >= -g.length / 2 + g.R; x -= g.R / 4) candidates.push({ x, y: 0 });
  }
  for (const c of candidates) {
    if (free(c.x, c.y)) {
      place(c.x, c.y);
      return;
    }
  }
  // Crowded beyond every rule (hand-placed balls): the first free point anywhere on the bed.
  const any = firstFreePoint(variant, free);
  place(any?.x ?? s.footX, any?.y ?? 0);
}
